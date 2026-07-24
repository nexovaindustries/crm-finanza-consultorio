import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { formatDate, calcularIGV, formatSoles, PRECIO_SESION_ENTRADA, PRECIO_PAQUETE_4 } from '../utils';

const SERVICIOS = [
  { id: 'entrada', label: 'Sesión de Entrada', precio: PRECIO_SESION_ENTRADA },
  { id: 'paquete4', label: 'Paquete 4 Sesiones', precio: PRECIO_PAQUETE_4 },
  { id: 'sesion_suelta', label: 'Sesión Individual', precio: 0 },
];

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm());

  const [cobroTarget, setCobroTarget] = useState(null);
  const [cobroCuentaId, setCobroCuentaId] = useState('');
  const [saving, setSaving] = useState(false);

  function defaultForm() {
    return { pacienteId: '', pacienteNombre: '', servicio: 'entrada', monto: PRECIO_SESION_ENTRADA, fecha: new Date().toISOString().split('T')[0], estado: 'cobrado', cuentaId: '', cuentaNombre: '', notas: '' };
  }

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [paySnap, patSnap, bankSnap] = await Promise.all([
      getDocs(query(collection(db, 'payments'), orderBy('fecha', 'desc'))),
      getDocs(query(collection(db, 'patients'), orderBy('nombre'))),
      getDocs(query(collection(db, 'bank_accounts'), orderBy('banco'))),
    ]);
    setPayments(paySnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setPatients(patSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setBankAccounts(bankSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  const handleCuenta = (cuentaId) => {
    if (cuentaId === 'efectivo') {
      setForm(f => ({ ...f, cuentaId: 'efectivo', cuentaNombre: 'Efectivo' }));
    } else {
      const c = bankAccounts.find(x => x.id === cuentaId);
      setForm(f => ({ ...f, cuentaId, cuentaNombre: c ? (c.nombre || c.banco) : '' }));
    }
  };

  async function incrementarSaldo(cuentaId, monto) {
    const cuenta = bankAccounts.find(x => x.id === cuentaId);
    if (cuenta) {
      await updateDoc(doc(db, 'bank_accounts', cuentaId), { saldo: (cuenta.saldo || 0) + monto, updatedAt: Timestamp.now() });
    }
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
    if (form.estado === 'cobrado' && form.cuentaId && form.cuentaId !== 'efectivo') {
      await incrementarSaldo(form.cuentaId, Number(form.monto));
    }
    setShowModal(false);
    setForm(defaultForm());
    loadAll();
  }

  async function changeStatus(id, estado) {
    await updateDoc(doc(db, 'payments', id), { estado });
    loadAll();
  }

  async function confirmarCobro() {
    if (!cobroTarget || !cobroCuentaId) return;
    setSaving(true);
    try {
      const cuentaNombre = cobroCuentaId === 'efectivo' ? 'Efectivo' : (bankAccounts.find(x => x.id === cobroCuentaId)?.nombre || bankAccounts.find(x => x.id === cobroCuentaId)?.banco || '');
      await updateDoc(doc(db, 'payments', cobroTarget.id), { estado: 'cobrado', cuentaId: cobroCuentaId, cuentaNombre });
      if (cobroCuentaId !== 'efectivo') {
        await incrementarSaldo(cobroCuentaId, cobroTarget.monto || 0);
      }
      setCobroTarget(null);
      setCobroCuentaId('');
      loadAll();
    } finally {
      setSaving(false);
    }
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
                        <button className="btn btn-sm btn-primary" onClick={() => { setCobroTarget(p); setCobroCuentaId(''); }}>✅ Cobrar</button>
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
              <div className="form-group">
                <label className="form-label">💳 ¿Dónde ingresó el cobro?</label>
                <select className="form-select" value={form.cuentaId} onChange={e => handleCuenta(e.target.value)}>
                  <option value="">Sin especificar</option>
                  <option value="efectivo">💵 Efectivo</option>
                  {bankAccounts.map(a => <option key={a.id} value={a.id}>🏦 {a.nombre || a.banco} — {formatSoles(a.saldo || 0)}</option>)}
                </select>
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

      {cobroTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCobroTarget(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">✅ Confirmar cobro</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setCobroTarget(null)}>✕</button>
            </div>
            <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '20px', borderLeft: '3px solid var(--success)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '4px' }}>{cobroTarget.pacienteNombre}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginBottom: '8px' }}>{SERVICIOS.find(s => s.id === cobroTarget.servicio)?.label || cobroTarget.servicio}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success)', letterSpacing: '-0.03em' }}>{formatSoles(cobroTarget.monto)}</div>
            </div>
            <div className="form-group">
              <label className="form-label">💳 ¿Dónde ingresó este cobro? *</label>
              <select className="form-select" value={cobroCuentaId} onChange={e => setCobroCuentaId(e.target.value)}>
                <option value="">Seleccionar fuente...</option>
                <option value="efectivo">💵 Efectivo</option>
                {bankAccounts.map(a => <option key={a.id} value={a.id}>🏦 {a.nombre || a.banco} — {formatSoles(a.saldo || 0)}</option>)}
              </select>
            </div>
            {cobroCuentaId && cobroCuentaId !== 'efectivo' && (() => {
              const cuenta = bankAccounts.find(x => x.id === cobroCuentaId);
              if (!cuenta) return null;
              const nuevoSaldo = (cuenta.saldo || 0) + (cobroTarget.monto || 0);
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--success-light)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: '16px', fontSize: '0.83rem' }}>
                  <span style={{ color: 'var(--text-3)' }}>Nuevo saldo de <strong>{cuenta.nombre || cuenta.banco}</strong>:</span>
                  <strong style={{ color: 'var(--success)' }}>{formatSoles(nuevoSaldo)}</strong>
                </div>
              );
            })()}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCobroTarget(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!cobroCuentaId || saving} onClick={confirmarCobro}>{saving ? 'Guardando...' : 'Confirmar cobro'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
