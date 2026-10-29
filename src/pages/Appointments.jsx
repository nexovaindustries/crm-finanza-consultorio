import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { formatSoles, PRECIO_SESION_ENTRADA, PRECIO_PAQUETE_4, getSesionesPaquete, getProximaSesion } from '../utils';
import TimeInput from '../components/TimeInput';

const ESTADOS = { programada: 'info', completada: 'success', cancelada: 'danger', reprogramada: 'warning' };

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm());
  const [editTarget, setEditTarget] = useState(null);
  const [reprogModal, setReprogModal] = useState(false);
  const [reprogTarget, setReprogTarget] = useState(null);
  const [reprogForm, setReprogForm] = useState({ fecha: '', hora: '10:00' });

  function defaultForm() {
    const now = new Date();
    return {
      pacienteId: '', pacienteNombre: '',
      fecha: now.toISOString().split('T')[0],
      hora: '10:00',
      tipo: 'entrada',
      estado: 'programada',
      notas: '',
      sesionNumero: '',
      generarCobro: true,
      precioEspecial: '',
    };
  }

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [appSnap, patSnap] = await Promise.all([
      getDocs(query(collection(db, 'appointments'), orderBy('fecha', 'desc'))),
      getDocs(query(collection(db, 'patients'), orderBy('nombre')))
    ]);
    setAppointments(appSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setPatients(patSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  const handlePaciente = (id) => {
    const p = patients.find(x => x.id === id);
    setForm(f => ({ ...f, pacienteId: id, pacienteNombre: p?.nombre || '' }));
  };

  const openNueva = () => {
    setEditTarget(null);
    setForm(defaultForm());
    setShowModal(true);
  };

  const openEditar = (a) => {
    const d = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
    const pad = n => String(n).padStart(2, '0');
    setEditTarget(a);
    setForm({
      ...defaultForm(),
      pacienteId: a.pacienteId || '', pacienteNombre: a.pacienteNombre || '',
      fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      tipo: a.tipo || 'entrada',
      estado: a.estado || 'programada',
      notas: a.notas || '',
      sesionNumero: a.sesionNumero || '',
      generarCobro: false,
    });
    setShowModal(true);
  };

  // Sesión que le tocaría a la nueva cita: la siguiente a la última sesión de paquete del paciente
  const sesionSugerida = (() => {
    if (form.tipo !== 'paquete4' || !form.pacienteId) return 1;
    if (editTarget) return getSesionesPaquete(appointments)[editTarget.id]?.sesion || 1;
    return getProximaSesion(appointments, form.pacienteId);
  })();
  const sesionElegida = form.sesionNumero || sesionSugerida;

  async function saveAppointment(e) {
    e.preventDefault();
    const fechaHora = new Date(`${form.fecha}T${form.hora}:00`);
    // Solo se guarda si se eligió a mano; si no, la sesión se sigue calculando sola
    const sesionNumero = form.tipo === 'paquete4' && form.sesionNumero ? Number(form.sesionNumero) : null;

    if (editTarget) {
      await updateDoc(doc(db, 'appointments', editTarget.id), {
        pacienteId: form.pacienteId,
        pacienteNombre: form.pacienteNombre,
        fecha: Timestamp.fromDate(fechaHora),
        tipo: form.tipo,
        estado: form.estado,
        notas: form.notas,
        sesionNumero,
        editadaAt: Timestamp.now(),
      });
      // Mantener alineado el cobro pendiente de la cita (si aún no tiene pagos)
      const cobros = await getDocs(query(collection(db, 'payments'), where('citaId', '==', editTarget.id)));
      await Promise.all(cobros.docs
        .filter(c => c.data().estado === 'pendiente' && !(c.data().montoPagado > 0))
        .map(c => updateDoc(c.ref, { pacienteId: form.pacienteId, pacienteNombre: form.pacienteNombre, fecha: Timestamp.fromDate(fechaHora) })));
      setShowModal(false);
      setEditTarget(null);
      setForm(defaultForm());
      loadAll();
      return;
    }

    const apptData = {
      pacienteId: form.pacienteId,
      pacienteNombre: form.pacienteNombre,
      fecha: Timestamp.fromDate(fechaHora),
      tipo: form.tipo,
      estado: form.estado,
      notas: form.notas,
      sesionNumero,
      createdAt: Timestamp.now(),
    };
    const apptRef = await addDoc(collection(db, 'appointments'), apptData);

    // Auto-generar cobro pendiente si se marcó
    if (form.generarCobro) {
      const precioBase = form.tipo === 'paquete4' ? PRECIO_PAQUETE_4 : form.tipo === 'entrada' ? PRECIO_SESION_ENTRADA : 0;
      const tienePrecioEspecial = form.precioEspecial !== '' && !isNaN(Number(form.precioEspecial));
      const monto = tienePrecioEspecial ? Number(form.precioEspecial) : precioBase;
      if (monto > 0) {
        const { calcularIGV } = await import('../utils');
        const igv = calcularIGV(monto);
        await addDoc(collection(db, 'payments'), {
          pacienteId: form.pacienteId,
          pacienteNombre: form.pacienteNombre,
          servicio: form.tipo,
          monto,
          baseImponible: igv.base,
          igv: igv.igv,
          precioEspecial: tienePrecioEspecial,
          estado: 'pendiente',
          citaId: apptRef.id,
          fecha: Timestamp.fromDate(fechaHora),
          createdAt: Timestamp.now(),
        });
      }
    }

    setShowModal(false);
    setForm(defaultForm());
    loadAll();
  }

  async function changeStatus(id, estado) {
    await updateDoc(doc(db, 'appointments', id), { estado });
    loadAll();
  }

  // Solo se puede reprogramar si faltan al menos 24 horas para la cita
  const puedeReprogramar = (a) => {
    const d = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
    return (d.getTime() - Date.now()) >= 24 * 60 * 60 * 1000;
  };

  const openReprogramar = (a) => {
    if (!puedeReprogramar(a)) {
      alert('Esta cita ya no se puede reprogramar: falta menos de 24 horas.');
      return;
    }
    const d = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
    setReprogTarget(a);
    setReprogForm({ fecha: d.toISOString().split('T')[0], hora: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` });
    setReprogModal(true);
  };

  async function confirmReprogramar(e) {
    e.preventDefault();
    const fechaHora = new Date(`${reprogForm.fecha}T${reprogForm.hora}:00`);
    await updateDoc(doc(db, 'appointments', reprogTarget.id), {
      fecha: Timestamp.fromDate(fechaHora),
      fechaAnterior: reprogTarget.fecha,
      reprogramada: true,
    });
    setReprogModal(false);
    setReprogTarget(null);
    loadAll();
  }

  const filtered = filter === 'todos' ? appointments : appointments.filter(a => a.estado === filter);
  const sesionesPaquete = getSesionesPaquete(appointments);

  const today = new Date().toDateString();
  const todayAppts = appointments.filter(a => {
    const d = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
    return d.toDateString() === today && a.estado === 'programada';
  });

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">🗓️ Citas</h2>
        <button className="btn btn-primary" onClick={openNueva}>
          + Nueva Cita
        </button>
      </div>

      {/* Citas de hoy */}
      {todayAppts.length > 0 && (
        <div className="alert alert-info" style={{ marginBottom: '16px' }}>
          📅 Hoy tienes <strong>{todayAppts.length}</strong> cita(s): {todayAppts.map(a => `${a.pacienteNombre} a las ${a.fecha?.toDate ? a.fecha.toDate().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : ''}`).join(', ')}
        </div>
      )}

      <div className="tabs">
        {[['todos','Todas'],['programada','Programadas'],['completada','Completadas'],['cancelada','Anuladas']].map(([val, lbl]) => (
          <button key={val} className={`tab-btn ${filter === val ? 'active' : ''}`} onClick={() => setFilter(val)}>{lbl}</button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Paciente</th><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Estado</th><th>Notas</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>Sin citas registradas</td></tr>
            ) : filtered.map(a => {
              const d = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
              return (
                <tr key={a.id}>
                  <td><strong>{a.pacienteNombre}</strong></td>
                  <td style={{ color: 'var(--text-3)' }}>{d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td style={{ color: 'var(--text-3)' }}>{d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <span className="badge badge-neutral">
                      {a.tipo === 'entrada' ? 'Entrada' : a.tipo === 'paquete4' ? `Paquete · Sesión ${sesionesPaquete[a.id]?.sesion ?? '?'}/${sesionesPaquete[a.id]?.total ?? 4}` : 'Individual'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${ESTADOS[a.estado] || 'neutral'}`}>
                      {a.estado === 'programada' ? '📅 Programada' : a.estado === 'completada' ? '✅ Completada' : a.estado === 'cancelada' ? '❌ Anulada' : '🔄 Reprogramada'}
                    </span>
                    {a.reprogramada && a.estado === 'programada' && (
                      <span className="badge badge-warning" style={{ marginLeft: '4px', fontSize: '0.65rem' }}>Reprogramada</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: '0.8rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.notas || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                    {a.estado === 'programada' && (
                      <>
                        <button className="btn btn-sm btn-primary" onClick={() => changeStatus(a.id, 'completada')}>✅</button>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => openReprogramar(a)}
                          title={puedeReprogramar(a) ? 'Reprogramar' : 'Solo se puede reprogramar con 24h de anticipación'}
                          style={!puedeReprogramar(a) ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
                        >🔄</button>
                        <button className="btn btn-sm btn-ghost" title="Anular cita" onClick={() => changeStatus(a.id, 'cancelada')}>❌</button>
                      </>
                    )}
                      <button className="btn btn-sm btn-ghost" title="Editar cita" onClick={() => openEditar(a)}>✏️</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editTarget ? 'Editar Cita' : 'Nueva Cita'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={saveAppointment}>
              <div className="form-group">
                <label className="form-label">Paciente *</label>
                <select className="form-select" required value={form.pacienteId} onChange={e => handlePaciente(e.target.value)}>
                  <option value="">Seleccionar paciente...</option>
                  {patients.filter(p => p.estado === 'activo' || p.id === form.pacienteId).map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input className="form-input" type="date" required value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hora *</label>
                  <TimeInput value={form.hora} onChange={hora => setForm({...form, hora})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo de servicio</label>
                  <select className="form-select" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                    <option value="entrada">Sesión de entrada (S/. 180)</option>
                    <option value="paquete4">Paquete 4 sesiones (S/. 650)</option>
                    <option value="sesion_suelta">Sesión individual</option>
                  </select>
                  {form.tipo === 'paquete4' && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                      <span>N° de sesión:</span>
                      <select className="form-select" style={{ width: 'auto', padding: '4px 28px 4px 10px' }} value={sesionElegida} onChange={e => setForm({...form, sesionNumero: Number(e.target.value)})}>
                        {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}/4</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select className="form-select" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                    <option value="programada">Programada</option>
                    <option value="completada">Completada</option>
                    <option value="cancelada">Anulada</option>
                  </select>
                </div>
              </div>
              {editTarget ? (
                editTarget.tipo !== form.tipo && (
                  <div className="alert alert-info" style={{ marginBottom: '16px', fontSize: '0.8rem' }}>
                    Cambiaste el tipo de servicio: revisa el monto del cobro de esta cita en Cobros.
                  </div>
                )
              ) : (
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.generarCobro} onChange={e => setForm({...form, generarCobro: e.target.checked})} />
                    <span className="form-label" style={{ margin: 0 }}>Generar cobro pendiente automáticamente</span>
                  </label>
                </div>
              )}
              {!editTarget && form.generarCobro && (
                <div className="form-group">
                  <label className="form-label">Precio especial / descuento (opcional)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={`Precio normal: ${formatSoles(form.tipo === 'paquete4' ? PRECIO_PAQUETE_4 : form.tipo === 'entrada' ? PRECIO_SESION_ENTRADA : 0)}`}
                    value={form.precioEspecial}
                    onChange={e => setForm({...form, precioEspecial: e.target.value})}
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea className="form-textarea" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Observaciones de la cita..." style={{ minHeight: '60px' }} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editTarget ? 'Guardar cambios' : 'Guardar cita'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reprogModal && reprogTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setReprogModal(false)}>
          <div className="modal" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Reprogramar cita</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setReprogModal(false)}>✕</button>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '14px' }}>
              {reprogTarget.pacienteNombre}
            </div>
            <form onSubmit={confirmReprogramar}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nueva fecha *</label>
                  <input className="form-input" type="date" required value={reprogForm.fecha} onChange={e => setReprogForm({...reprogForm, fecha: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nueva hora *</label>
                  <TimeInput value={reprogForm.hora} onChange={hora => setReprogForm({...reprogForm, hora})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setReprogModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Confirmar reprogramación</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
