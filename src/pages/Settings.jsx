import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import {
  doc, setDoc, collection, addDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, Timestamp,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';

const IGV = 0.18;

function calcIGV(precio) {
  const base = precio / (1 + IGV);
  const igv = precio - base;
  return { base: base.toFixed(2), igv: igv.toFixed(2) };
}

const SERVICIOS_DEFAULT = [
  { id: '_entrada', nombre: 'Sesión de entrada', precio: 180, descripcion: 'Evaluación inicial', editable: false },
  { id: '_paquete4', nombre: 'Paquete 4 sesiones', precio: 650, descripcion: 'Pack mensual', editable: false },
];

export default function Settings() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('usuarios');
  const [userForm, setUserForm] = useState({ nombre: '', email: '', password: '', rol: 'secretaria' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Servicios / precios
  const [servicios, setServicios] = useState([]);
  const [serviciosLoading, setServiciosLoading] = useState(true);
  const [showServModal, setShowServModal] = useState(false);
  const [servMode, setServMode] = useState('create'); // 'create' | 'edit'
  const [servSelected, setServSelected] = useState(null);
  const [servForm, setServForm] = useState({ nombre: '', precio: '', descripcion: '' });
  const [servMsg, setServMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const isAdmin = profile?.rol === 'admin';

  useEffect(() => {
    if (tab === 'precios') loadServicios();
  }, [tab]);

  async function loadServicios() {
    setServiciosLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'servicios'), orderBy('nombre')));
      const fromDB = snap.docs.map(d => ({ id: d.id, ...d.data(), editable: true }));
      setServicios(fromDB.length > 0 ? fromDB : SERVICIOS_DEFAULT);
    } catch {
      setServicios(SERVICIOS_DEFAULT);
    } finally {
      setServiciosLoading(false);
    }
  }

  async function saveServicio(e) {
    e.preventDefault();
    if (!isAdmin) return;
    const precio = parseFloat(servForm.precio);
    if (isNaN(precio) || precio <= 0) return;
    setLoading(true);
    try {
      const data = {
        nombre: servForm.nombre.trim(),
        precio,
        descripcion: servForm.descripcion.trim(),
        updatedAt: Timestamp.now(),
      };
      if (servMode === 'edit' && servSelected?.id) {
        await updateDoc(doc(db, 'servicios', servSelected.id), data);
        setServMsg('Servicio actualizado correctamente.');
      } else {
        await addDoc(collection(db, 'servicios'), { ...data, createdAt: Timestamp.now() });
        setServMsg('Servicio creado correctamente.');
      }
      setShowServModal(false);
      setServSelected(null);
      setServForm({ nombre: '', precio: '', descripcion: '' });
      loadServicios();
    } catch (err) {
      setServMsg('Error al guardar: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteServicio(id) {
    if (!id || id.startsWith('_')) return;
    await deleteDoc(doc(db, 'servicios', id));
    setDeleteConfirm(null);
    loadServicios();
  }

  function openCreate() {
    setServMode('create');
    setServSelected(null);
    setServForm({ nombre: '', precio: '', descripcion: '' });
    setShowServModal(true);
  }

  function openEdit(s) {
    setServMode('edit');
    setServSelected(s);
    setServForm({ nombre: s.nombre, precio: String(s.precio), descripcion: s.descripcion || '' });
    setShowServModal(true);
  }

  // ── Usuario
  async function createUser(e) {
    e.preventDefault();
    if (!isAdmin) return;
    setLoading(true); setMsg(''); setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, userForm.email, userForm.password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        nombre: userForm.nombre, email: userForm.email, rol: userForm.rol,
        clinicaId: profile?.clinicaId || 'madurando-talentos', createdAt: Timestamp.now(),
      });
      setMsg(`Usuario "${userForm.nombre}" creado exitosamente.`);
      setUserForm({ nombre: '', email: '', password: '', rol: 'secretaria' });
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally { setLoading(false); }
  }

  const previewPrecio = servForm.precio ? parseFloat(servForm.precio) : null;
  const previewCalc = previewPrecio && !isNaN(previewPrecio) ? calcIGV(previewPrecio) : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Configuración</h2>
          <p style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: '4px' }}>
            Gestión de usuarios, tarifas y datos del consultorio
          </p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '24px' }}>
        {[
          { key: 'usuarios', label: 'Usuarios', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
          { key: 'precios', label: 'Precios & IGV', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
          { key: 'consultorio', label: 'Consultorio', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
        ].map(t => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── USUARIOS ── */}
      {tab === 'usuarios' && (
        <div style={{ maxWidth: '560px' }}>
          {!isAdmin ? (
            <div className="alert alert-warning">Solo la administradora puede gestionar usuarios.</div>
          ) : (
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '16px', color: 'var(--text)' }}>
                Crear nuevo usuario
              </h3>
              {msg && <div className="alert alert-success" style={{ marginBottom: '14px' }}>{msg}</div>}
              {error && <div className="alert alert-danger" style={{ marginBottom: '14px' }}>{error}</div>}
              <form onSubmit={createUser}>
                <div className="form-group">
                  <label className="form-label">Nombre completo *</label>
                  <input className="form-input" required value={userForm.nombre} onChange={e => setUserForm({ ...userForm, nombre: e.target.value })} placeholder="Nombre del usuario" />
                </div>
                <div className="form-group">
                  <label className="form-label">Correo electrónico *</label>
                  <input className="form-input" type="email" required value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} placeholder="correo@ejemplo.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Contraseña *</label>
                  <input className="form-input" type="password" required minLength={6} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="form-group">
                  <label className="form-label">Rol</label>
                  <select className="form-select" value={userForm.rol} onChange={e => setUserForm({ ...userForm, rol: e.target.value })}>
                    <option value="secretaria">Secretaria</option>
                    <option value="admin">Administrador / Psicóloga</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-accent" disabled={loading}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {loading ? 'Creando...' : 'Crear usuario'}
                </button>
              </form>
            </div>
          )}
          <div className="card" style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '12px', color: 'var(--text-2)' }}>Roles del sistema</h3>
            {[
              { rol: 'admin', label: 'Administrador / Psicóloga', permisos: 'Acceso completo: pacientes, finanzas, reportes, configuración y usuarios.' },
              { rol: 'secretaria', label: 'Secretaria', permisos: 'Acceso a: citas, pacientes, cobros y calendario. Sin acceso a configuración de usuarios.' },
            ].map(r => (
              <div key={r.rol} style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: '12px', marginBottom: '8px' }}>
                <div style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--text)' }}>{r.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: '4px' }}>{r.permisos}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PRECIOS & IGV ── */}
      {tab === 'precios' && (
        <div style={{ maxWidth: '620px' }}>
          {servMsg && (
            <div className="alert alert-success" style={{ marginBottom: '16px' }}>
              {servMsg}
              <button onClick={() => setServMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text)' }}>Tarifas vigentes</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: '3px' }}>Todos los precios incluyen IGV 18%</p>
              </div>
              {isAdmin && (
                <button className="btn btn-accent" onClick={openCreate}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Nuevo servicio
                </button>
              )}
            </div>

            {serviciosLoading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-3)' }}>Cargando tarifas...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {servicios.map(s => {
                  const { base, igv } = calcIGV(s.precio);
                  return (
                    <div key={s.id} style={{
                      background: 'var(--bg-3)', borderRadius: 'var(--radius)',
                      padding: '16px 18px', borderLeft: '3px solid var(--accent)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text)' }}>{s.nombre}</div>
                          {s.descripcion && (
                            <div style={{ fontSize: '0.77rem', color: 'var(--text-3)', marginTop: '2px' }}>{s.descripcion}</div>
                          )}
                        </div>
                        {isAdmin && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)} title="Editar">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              Editar
                            </button>
                            {s.editable && (
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleteConfirm(s)} title="Eliminar">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="igv-box">
                        <div className="igv-row">
                          <span style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>Base imponible</span>
                          <span style={{ fontSize: '0.82rem' }}>S/. {base}</span>
                        </div>
                        <div className="igv-row">
                          <span style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>IGV 18%</span>
                          <span style={{ color: 'var(--warning)', fontSize: '0.82rem', fontWeight: '600' }}>S/. {igv}</span>
                        </div>
                        <hr className="divider" />
                        <div className="igv-row total">
                          <span>Precio al paciente</span>
                          <span style={{ color: 'var(--primary-dark)', fontWeight: '800', fontSize: '1.05rem' }}>S/. {Number(s.precio).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="alert alert-info" style={{ marginTop: '16px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              El IGV se calcula automáticamente en todos los reportes y cobros del sistema.
            </div>
          </div>
        </div>
      )}

      {/* ── CONSULTORIO ── */}
      {tab === 'consultorio' && (
        <div style={{ maxWidth: '560px' }}>
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '16px', color: 'var(--text)' }}>Información del Consultorio</h3>
            <div style={{ display: 'grid', gap: '4px' }}>
              {[
                { label: 'Nombre', value: 'Madurando Talentos' },
                { label: 'Tipo', value: 'Consultorio Psicológico' },
                { label: 'País', value: 'Perú' },
                { label: 'Régimen tributario', value: 'IGV 18%' },
                { label: 'Moneda', value: 'Soles peruanos (S/.)' },
                { label: 'Sistema', value: 'CRM Madurando Talentos v1.0' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>{item.label}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Crear/Editar Servicio ── */}
      {showServModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowServModal(false)}>
          <div className="modal" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{servMode === 'edit' ? 'Editar servicio' : 'Nuevo servicio'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowServModal(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={saveServicio}>
              <div className="form-group">
                <label className="form-label">Nombre del servicio *</label>
                <input className="form-input" required value={servForm.nombre} onChange={e => setServForm({ ...servForm, nombre: e.target.value })} placeholder="Ej: Sesión individual" />
              </div>
              <div className="form-group">
                <label className="form-label">Precio al paciente (S/.) — IGV incluido *</label>
                <input
                  className="form-input" type="number" required min="1" step="0.01"
                  value={servForm.precio} onChange={e => setServForm({ ...servForm, precio: e.target.value })}
                  placeholder="Ej: 180"
                />
              </div>
              {/* Preview IGV en tiempo real */}
              {previewCalc && (
                <div style={{
                  background: 'var(--accent-glow)', border: '1px solid var(--accent)',
                  borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: '16px',
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-dark)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Vista previa IGV
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-3)' }}>Base imponible</span><span>S/. {previewCalc.base}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-3)' }}>IGV 18%</span>
                    <span style={{ color: 'var(--warning)', fontWeight: '600' }}>S/. {previewCalc.igv}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: '700', borderTop: '1px solid var(--border-light)', paddingTop: '6px', marginTop: '4px' }}>
                    <span>Total paciente</span><span>S/. {parseFloat(servForm.precio).toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Descripción (opcional)</label>
                <input className="form-input" value={servForm.descripcion} onChange={e => setServForm({ ...servForm, descripcion: e.target.value })} placeholder="Ej: Evaluación psicológica inicial" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowServModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-accent" disabled={loading}>
                  {loading ? 'Guardando...' : servMode === 'edit' ? 'Guardar cambios' : 'Crear servicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Eliminar ── */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Eliminar servicio</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteConfirm(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ padding: '0 4px 8px' }}>
              <div style={{ background: 'var(--danger-light)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '12px', display: 'flex', gap: '10px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  Se eliminará el servicio <strong>{deleteConfirm.nombre}</strong> (S/. {deleteConfirm.precio}). Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => deleteServicio(deleteConfirm.id)}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
