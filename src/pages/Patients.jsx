import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { formatDate, esCumpleanosHoy, cumpleanosProximo, getInitials, formatSoles, esMenorDeEdad, getSesionesPaquete, getEdadTexto, GRADOS_ESCOLARES, getAnioEscolarActual, getGradoActual } from '../utils';

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit', 'history', 'delete'
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm());
  
  // Historial state
  const [history, setHistory] = useState({ appointments: [], payments: [] });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState('citas'); // 'citas', 'pagos'

  function defaultForm() {
    return {
      nombre: '', dni: '', fechaNacimiento: '', telefono: '', email: '', direccion: '', notas: '', estado: 'activo', servicio: 'entrada',
      apoderado_nombre: '', apoderado_dni: '', apoderado_telefono: '', apoderado_email: '', apoderado_relacion: 'madre',
      colegio: '', grado: '',
    };
  }

  useEffect(() => { loadPatients(); }, []);

  async function loadPatients() {
    const snap = await getDocs(query(collection(db, 'patients'), orderBy('nombre')));
    setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  async function savePatient(e) {
    e.preventDefault();
    const gradoCambio = !selected || selected.grado !== form.grado;
    const data = {
      ...form,
      gradoAnioReferencia: form.grado ? (gradoCambio ? getAnioEscolarActual() : selected.gradoAnioReferencia) : null,
      updatedAt: Timestamp.now(),
    };
    if (selected && modalMode === 'edit') {
      await updateDoc(doc(db, 'patients', selected.id), data);
    } else {
      await addDoc(collection(db, 'patients'), { ...data, createdAt: Timestamp.now() });
    }
    setShowModal(false);
    setSelected(null);
    setForm(defaultForm());
    loadPatients();
  }

  async function toggleStatus(patient) {
    await updateDoc(doc(db, 'patients', patient.id), {
      estado: patient.estado === 'activo' ? 'inactivo' : 'activo'
    });
    loadPatients();
  }

  const openDelete = (p) => {
    setSelected(p);
    setModalMode('delete');
    setShowModal(true);
  };

  async function confirmDelete() {
    if (!selected) return;
    await deleteDoc(doc(db, 'patients', selected.id));
    setShowModal(false);
    setSelected(null);
    loadPatients();
  }

  const openCreate = () => {
    setSelected(null);
    setForm(defaultForm());
    setModalMode('create');
    setShowModal(true);
  };

  const openEdit = (p) => {
    setSelected(p);
    setForm({
      nombre: p.nombre || '', dni: p.dni || '', fechaNacimiento: p.fechaNacimiento || '',
      telefono: p.telefono || '', email: p.email || '', direccion: p.direccion || '',
      notas: p.notas || '', estado: p.estado || 'activo', servicio: p.servicio || 'entrada',
      apoderado_nombre: p.apoderado_nombre || '', apoderado_dni: p.apoderado_dni || '',
      apoderado_telefono: p.apoderado_telefono || '', apoderado_email: p.apoderado_email || '',
      apoderado_relacion: p.apoderado_relacion || 'madre',
      colegio: p.colegio || '', grado: p.grado || '',
    });
    setModalMode('edit');
    setShowModal(true);
  };

  const openHistory = async (p) => {
    setSelected(p);
    setModalMode('history');
    setHistoryTab('citas');
    setShowModal(true);
    setHistoryLoading(true);
    
    try {
      const [appSnap, paySnap] = await Promise.all([
        getDocs(query(collection(db, 'appointments'), where('pacienteId', '==', p.id), orderBy('fecha', 'desc'))),
        getDocs(query(collection(db, 'payments'), where('pacienteId', '==', p.id), orderBy('fecha', 'desc')))
      ]);
      
      setHistory({
        appointments: appSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        payments: paySnap.docs.map(d => ({ id: d.id, ...d.data() }))
      });
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filtered = patients.filter(p =>
    p.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    p.dni?.includes(search) ||
    p.telefono?.includes(search)
  );

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">👥 Pacientes</h2>
        <button className="btn btn-primary" onClick={openCreate}>
          + Nuevo Paciente
        </button>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="form-input search-input" placeholder="Buscar por nombre, DNI o teléfono..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Paciente</th><th>DNI</th><th>Teléfono</th><th>Servicio</th>
              <th>Cumpleaños</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px' }}>Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px' }}>No hay pacientes registrados</td></tr>
            ) : filtered.map(p => {
              const cumple = esCumpleanosHoy(p.fechaNacimiento);
              const proxCumple = !cumple && cumpleanosProximo(p.fechaNacimiento, 7);
              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}>
                        {getInitials(p.nombre)}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong>{p.nombre}</strong>
                          {cumple && <span title="🎂 NO CONTACTAR HOY">🎂</span>}
                          {esMenorDeEdad(p.fechaNacimiento) && (
                            <span style={{ fontSize: '10px', background: 'rgba(255,203,5,0.18)', color: '#b8860b', border: '1px solid rgba(255,203,5,0.5)', borderRadius: '4px', padding: '1px 6px', fontWeight: '600' }}>Menor</span>
                          )}
                        </div>
                        {proxCumple && <span style={{ fontSize: '11px', color: 'var(--accent)' }}>próximo cumple</span>}
                        {esMenorDeEdad(p.fechaNacimiento) && p.apoderado_nombre && (
                          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                            Apoderado: {p.apoderado_nombre}
                          </div>
                        )}
                        {esMenorDeEdad(p.fechaNacimiento) && p.grado && (
                          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                            🎒 {getGradoActual(p.grado, p.gradoAnioReferencia)}{p.colegio ? ` — ${p.colegio}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{p.dni || '—'}</td>
                  <td>{p.telefono || '—'}</td>
                  <td>{p.servicio === 'paquete4' ? 'Paquete 4 ses.' : p.servicio === 'sesion_suelta' ? 'Ses. individual' : 'Sesión entrada'}</td>
                  <td>
                    {p.fechaNacimiento ? (
                      <span style={{ color: cumple ? 'var(--accent)' : 'inherit' }}>
                        {formatDate(p.fechaNacimiento)}
                        {cumple && <span style={{ marginLeft: '4px', fontSize: '10px', background: 'rgba(232,168,124,0.2)', color: 'var(--accent)', padding: '1px 5px', borderRadius: '4px' }}>HOY</span>}
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{getEdadTexto(p.fechaNacimiento)}</div>
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <span className={`badge badge-${p.estado === 'activo' ? 'success' : 'neutral'}`}>
                      {p.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openHistory(p)} title="Historial">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
                        Historial
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)} title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(p)} title={p.estado === 'activo' ? 'Desactivar' : 'Activar'}>
                        {p.estado === 'activo'
                          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        }
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openDelete(p)} title="Eliminar" style={{ color: 'var(--danger)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
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
          {/* Delete Confirmation Modal */}
          {modalMode === 'delete' ? (
            <div className="modal" style={{ maxWidth: '420px' }}>
              <div className="modal-header">
                <h3 className="modal-title">Eliminar paciente</h3>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div style={{ padding: '0 4px 8px' }}>
                <div style={{
                  background: 'var(--danger-light)', border: '1px solid rgba(224,82,82,0.25)',
                  borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '16px',
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--danger)', marginBottom: '4px' }}>Esta acción no se puede deshacer</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: '1.5' }}>
                      Se eliminará permanentemente el paciente <strong>{selected?.nombre}</strong> y todos sus registros del sistema.
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-3)', marginBottom: '4px' }}>¿Estás segura de que deseas continuar?</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn btn-danger" onClick={confirmDelete}>Sí, eliminar</button>
              </div>
            </div>
          ) : (
          <div className="modal" style={modalMode === 'history' ? { maxWidth: '700px' } : {}}>
            <div className="modal-header">
              <h3 className="modal-title">
                {modalMode === 'history' ? `Historial: ${selected?.nombre}` : selected ? 'Editar Paciente' : 'Nuevo Paciente'}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            
            {modalMode === 'history' ? (
              <div style={{ padding: '0 20px 20px' }}>
                {selected?.fechaNacimiento && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginBottom: '12px' }}>
                    Edad: <strong style={{ color: 'var(--text-1)' }}>{getEdadTexto(selected.fechaNacimiento)}</strong>
                    {esMenorDeEdad(selected.fechaNacimiento) && selected?.grado && (
                      <span> · 🎒 <strong style={{ color: 'var(--text-1)' }}>{getGradoActual(selected.grado, selected.gradoAnioReferencia)}</strong>{selected.colegio ? ` — ${selected.colegio}` : ''}</span>
                    )}
                  </div>
                )}
                {esMenorDeEdad(selected?.fechaNacimiento) && selected?.apoderado_nombre && (
                  <div style={{ background: 'rgba(255,203,5,0.08)', border: '1px solid rgba(255,203,5,0.4)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: '16px', fontSize: '0.82rem' }}>
                    <strong style={{ color: 'var(--accent)' }}>Apoderado:</strong>{' '}
                    {selected.apoderado_nombre}
                    {selected.apoderado_relacion && <span style={{ color: 'var(--text-3)', marginLeft: '6px' }}>({selected.apoderado_relacion})</span>}
                    {selected.apoderado_telefono && <span style={{ marginLeft: '10px' }}>📞 {selected.apoderado_telefono}</span>}
                    {selected.apoderado_dni && <span style={{ marginLeft: '10px', color: 'var(--text-3)' }}>DNI: {selected.apoderado_dni}</span>}
                  </div>
                )}
                <div className="tabs" style={{ marginBottom: '20px' }}>
                  <button className={`tab-btn ${historyTab === 'citas' ? 'active' : ''}`} onClick={() => setHistoryTab('citas')}>🗓️ Citas ({history.appointments.length})</button>
                  <button className={`tab-btn ${historyTab === 'pagos' ? 'active' : ''}`} onClick={() => setHistoryTab('pagos')}>💰 Pagos ({history.payments.length})</button>
                </div>

                {historyLoading ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-3)' }}>Cargando historial...</div>
                ) : historyTab === 'citas' ? (() => {
                  const sesionesHistorial = getSesionesPaquete(history.appointments);
                  return (
                  <div className="table-wrap" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table>
                      <thead><tr><th>Fecha</th><th>Hora</th><th>Servicio</th><th>Estado</th></tr></thead>
                      <tbody>
                        {history.appointments.length === 0 ? (
                          <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-3)' }}>Sin citas registradas</td></tr>
                        ) : history.appointments.map(a => {
                          const d = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
                          const sesion = sesionesHistorial[a.id];
                          return (
                            <tr key={a.id}>
                              <td>{d.toLocaleDateString('es-PE')}</td>
                              <td>{d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</td>
                              <td>{a.tipo === 'paquete4' && sesion ? `Paquete · Sesión ${sesion.sesion}/${sesion.total}` : a.tipo}</td>
                              <td>
                                <span className={`badge badge-${a.estado === 'completada' ? 'success' : a.estado === 'cancelada' ? 'danger' : 'info'}`}>
                                  {a.estado}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  );
                })() : (
                  <div className="table-wrap" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table>
                      <thead><tr><th>Fecha</th><th>Servicio</th><th>Monto</th><th>Estado</th></tr></thead>
                      <tbody>
                        {history.payments.length === 0 ? (
                          <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-3)' }}>Sin pagos registrados</td></tr>
                        ) : history.payments.map(p => {
                          const d = p.fecha?.toDate ? p.fecha.toDate() : new Date(p.fecha);
                          return (
                            <tr key={p.id}>
                              <td>{d.toLocaleDateString('es-PE')}</td>
                              <td>{p.servicio}</td>
                              <td><strong>{formatSoles(p.monto)}</strong></td>
                              <td>
                                <span className={`badge badge-${p.estado === 'cobrado' ? 'success' : p.estado === 'vencido' ? 'danger' : 'warning'}`}>
                                  {p.estado}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                
                <div className="modal-footer" style={{ marginTop: '20px', padding: 0 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cerrar</button>
                </div>
              </div>
            ) : (
              <form onSubmit={savePatient}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nombre completo *</label>
                    <input className="form-input" required value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} placeholder="Nombre apellido" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">DNI</label>
                    <input className="form-input" value={form.dni} onChange={e => setForm({...form, dni: e.target.value})} placeholder="12345678" maxLength={8} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Fecha de nacimiento</label>
                    <input className="form-input" type="date" value={form.fechaNacimiento} onChange={e => setForm({...form, fechaNacimiento: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <input className="form-input" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} placeholder="9XXXXXXXX" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Correo electrónico</label>
                    <input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="correo@ejemplo.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Servicio</label>
                    <select className="form-select" value={form.servicio} onChange={e => setForm({...form, servicio: e.target.value})}>
                      <option value="entrada">Sesión de entrada (S/. 180)</option>
                      <option value="paquete4">Paquete 4 sesiones (S/. 650)</option>
                      <option value="sesion_suelta">Sesión individual</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Dirección</label>
                  <input className="form-input" value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})} placeholder="Dirección del paciente" />
                </div>
                <div className="form-group">
                  <label className="form-label">Notas internas</label>
                  <textarea className="form-textarea" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Información adicional relevante..." />
                </div>

                {esMenorDeEdad(form.fechaNacimiento) && (
                  <div style={{ marginTop: '8px', border: '1.5px solid var(--accent)', borderRadius: 'var(--radius)', padding: '16px', background: 'rgba(255,203,5,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--accent)' }}>Datos del padre / madre / tutor apoderado</span>
                      <span style={{ fontSize: '0.75rem', background: 'var(--accent)', color: '#fff', borderRadius: '4px', padding: '1px 7px', fontWeight: '600' }}>Menor de edad</span>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Nombre completo del apoderado *</label>
                        <input className="form-input" required={esMenorDeEdad(form.fechaNacimiento)} value={form.apoderado_nombre} onChange={e => setForm({...form, apoderado_nombre: e.target.value})} placeholder="Nombre y apellidos" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Relación con el paciente</label>
                        <select className="form-select" value={form.apoderado_relacion} onChange={e => setForm({...form, apoderado_relacion: e.target.value})}>
                          <option value="madre">Madre</option>
                          <option value="padre">Padre</option>
                          <option value="tutor_legal">Tutor legal</option>
                          <option value="abuelo">Abuelo/a</option>
                          <option value="tio">Tío/a</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">DNI del apoderado</label>
                        <input className="form-input" value={form.apoderado_dni} onChange={e => setForm({...form, apoderado_dni: e.target.value})} placeholder="12345678" maxLength={8} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Teléfono del apoderado</label>
                        <input className="form-input" value={form.apoderado_telefono} onChange={e => setForm({...form, apoderado_telefono: e.target.value})} placeholder="9XXXXXXXX" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Correo del apoderado</label>
                      <input className="form-input" type="email" value={form.apoderado_email} onChange={e => setForm({...form, apoderado_email: e.target.value})} placeholder="correo@ejemplo.com" />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Colegio</label>
                        <input className="form-input" value={form.colegio} onChange={e => setForm({...form, colegio: e.target.value})} placeholder="Nombre del colegio" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Grado actual</label>
                        <select className="form-select" value={form.grado} onChange={e => setForm({...form, grado: e.target.value})}>
                          <option value="">Seleccionar...</option>
                          {GRADOS_ESCOLARES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '4px' }}>
                          Se actualiza automáticamente cada año escolar
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">
                    {selected ? 'Guardar cambios' : 'Registrar paciente'}
                  </button>
                </div>
              </form>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
