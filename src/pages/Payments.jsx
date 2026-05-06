import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { formatDate, calcularIGV, formatSoles, PRECIO_SESION_ENTRADA, PRECIO_PAQUETE_4 } from '../utils';

const SERVICIOS = [
  { id: 'entrada', label: 'Sesión de Entrada', precio: PRECIO_SESION_ENTRADA },
  { id: 'paquete4', label: 'Paquete 4 Sesiones', precio: PRECIO_PAQUETE_4 },
  { id: 'sesion_suelta', label: 'Sesión Individual', precio: 0 },
];

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm());

  function defaultForm() {
    return { pacienteId: '', pacienteNombre: '', servicio: 'entrada', monto: PRECIO_SESION_ENTRADA, fecha: new Date().toISOString().split('T')[0], estado: 'cobrado', notas: '' };
  }

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [paySnap, patSnap] = await Promise.all([
      getDocs(query(collection(db, 'payments'), orderBy('fecha', 'desc'))),
      getDocs(query(collection(db, 'patients'), orderBy('nombre')))
    ]);
    setPayments(paySnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setPatients(patSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  const handleServicio = (servicioId) => {
    const s = SERVICIOS.find(x => x.id === servicioId);
    setForm(f => ({ ...f, servicio: servicioId, monto: s ? s.precio : 0 }));
  };

  const handlePaciente = (id) => {
    const p = patients.find(x => x.id === id);
    setForm(f => ({ ...f, pacienteId: id, pacienteNombre: p?.nombre || '' }));
  };

  async function savePayment(e) {
    e.preventDefault();
    const igv = calcularIGV(Number(form.monto));
    await addDoc(collection(db, 'payments'), {
      ...form,
      monto: Number(form.monto),
      baseImponible: igv.base,
      igv: igv.igv,
      fecha: Timestamp.fromDate(new Date(form.fecha)),
      createdAt: Timestamp.now(),
    });
    setShowModal(false);
    setForm(defaultForm());
    loadAll();
  }

  async function changeStatus(id, estado) {
    await updateDoc(doc(db, 'payments', id), { estado });
    loadAll();
  }

  const filtered = filter === 'todos' ? payments : payments.filter(p => p.estado === filter);
  const totalFiltrado = filtered.reduce((a, p) => a + (p.monto || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">💰 Cobros</h2>
        <button className="btn btn-primary" onClick={() => { setForm(defaultForm()); setShowModal(true); }}>
          + Registrar Cobro
        </button>
      </div>

      {/* Filtros */}
      <div className="tabs">
        {[['todos','Todos'],['cobrado','Cobrados'],['pendiente','Pendientes'],['vencido','Vencidos']].map(([val, lbl]) => (
          <button key={val} className={`tab-btn ${filter === val ? 'active' : ''}`} onClick={() => setFilter(val)}>{lbl}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-3)', alignSelf: 'center', paddingRight: '8px' }}>
          Total: <strong style={{ color: 'var(--text)' }}>{formatSoles(totalFiltrado)}</strong>
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Paciente</th><th>Servicio</th><th>Base</th><th>IGV 18%</th><th>Total</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>Sin registros</td></tr>
            ) : filtered.map(p => {
              const igv = calcularIGV(p.monto || 0);
              return (
                <tr key={p.id}>
                  <td><strong>{p.pacienteNombre}</strong></td>
                  <td>{SERVICIOS.find(s => s.id === p.servicio)?.label || p.servicio}</td>
                  <td style={{ color: 'var(--text-3)' }}>{formatSoles(p.baseImponible || igv.base)}</td>
                  <td style={{ color: 'var(--warning)' }}>{formatSoles(p.igv || igv.igv)}</td>
                  <td><strong>{formatSoles(p.monto)}</strong></td>
                  <td style={{ color: 'var(--text-3)' }}>{p.fecha?.toDate ? formatDate(p.fecha.toDate().toISOString()) : formatDate(p.fecha)}</td>
                  <td>
                    <span className={`badge badge-${p.estado === 'cobrado' ? 'success' : p.estado === 'pendiente' ? 'warning' : 'danger'}`}>
                      {p.estado === 'cobrado' ? '✅ Cobrado' : p.estado === 'pendiente' ? '⏳ Pendiente' : '❌ Vencido'}
                    </span>
                  </td>
                  <td>
                    {p.estado === 'pendiente' && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-sm btn-primary" onClick={() => changeStatus(p.id, 'cobrado')}>✅ Cobrar</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => changeStatus(p.id, 'vencido')}>❌</button>
                      </div>
                    )}
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
              <h3 className="modal-title">Registrar Cobro</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={savePayment}>
              <div className="form-group">
                <label className="form-label">Paciente *</label>
                <select className="form-select" required value={form.pacienteId} onChange={e => handlePaciente(e.target.value)}>
                  <option value="">Seleccionar paciente...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Servicio *</label>
                  <select className="form-select" value={form.servicio} onChange={e => handleServicio(e.target.value)}>
                    {SERVICIOS.map(s => <option key={s.id} value={s.id}>{s.label}{s.precio > 0 ? ` — S/. ${s.precio}` : ''}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Monto (S/.) *</label>
                  <input className="form-input" type="number" required min="0" step="0.01" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input className="form-input" type="date" required value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select className="form-select" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                    <option value="cobrado">✅ Cobrado</option>
                    <option value="pendiente">⏳ Pendiente</option>
                  </select>
                </div>
              </div>
              {/* IGV preview */}
              {form.monto > 0 && (
                <div className="igv-box" style={{ marginBottom: '16px' }}>
                  {(() => { const igv = calcularIGV(Number(form.monto)); return (
                    <>
                      <div className="igv-row"><span style={{color:'var(--text-3)'}}>Base imponible</span><span>{formatSoles(igv.base)}</span></div>
                      <div className="igv-row"><span style={{color:'var(--text-3)'}}>IGV 18%</span><span style={{color:'var(--warning)'}}>{formatSoles(igv.igv)}</span></div>
                      <div className="igv-row total"><span>Total al cliente</span><span>{formatSoles(igv.total)}</span></div>
                    </>
                  );})()}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea className="form-textarea" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Notas opcionales..." style={{ minHeight: '60px' }} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar cobro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
