import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { formatDate, calcularIGV, formatSoles, PRECIO_SESION_ENTRADA, PRECIO_PAQUETE_4 } from '../utils';
import SearchableSelect from '../components/SearchableSelect';

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

  const [abonoTarget, setAbonoTarget] = useState(null);
  const [abonoForm, setAbonoForm] = useState(defaultAbonoForm());

  function defaultAbonoForm() {
    return { cuentaId: '', cuentaNombre: '', sesiones: 1, monto: '' };
  }

  function defaultForm() {
    return {
      pacienteId: '', pacienteNombre: '', servicio: 'entrada', monto: PRECIO_SESION_ENTRADA,
      sesionesCubre: 1, montoAbono: '',
      fecha: new Date().toISOString().split('T')[0], estado: 'cobrado', cuentaId: '', cuentaNombre: '', notas: '',
    };
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
    const c = bankAccounts.find(x => x.id === cuentaId);
    setForm(f => ({ ...f, cuentaId, cuentaNombre: c ? (c.nombre || c.banco) : '' }));
  };

  async function incrementarSaldo(cuentaId, monto) {
    const cuenta = bankAccounts.find(x => x.id === cuentaId);
    if (cuenta) {
      await updateDoc(doc(db, 'bank_accounts', cuentaId), { saldo: (cuenta.saldo || 0) + monto, updatedAt: Timestamp.now() });
    }
  }

  const handleServicio = (servicioId) => {
    const s = SERVICIOS.find(x => x.id === servicioId);
    const precio = s ? s.precio : 0;
    setForm(f => ({
      ...f,
      servicio: servicioId,
      monto: precio,
      sesionesCubre: 1,
      montoAbono: servicioId === 'paquete4' ? (precio / 4).toFixed(2) : '',
    }));
  };

  const handlePaciente = (id) => {
    const p = patients.find(x => x.id === id);
    setForm(f => ({ ...f, pacienteId: id, pacienteNombre: p?.nombre || '' }));
  };

  async function savePayment(e) {
    e.preventDefault();
    if (!form.pacienteId) { alert('Selecciona un paciente de la lista.'); return; }
    const fecha = Timestamp.fromDate(new Date(`${form.fecha}T12:00:00`));

    if (form.servicio === 'paquete4') {
      const montoTotal = PRECIO_PAQUETE_4;
      const montoAbono = Number(form.montoAbono) || 0;
      const sesiones = Math.min(Number(form.sesionesCubre) || 0, 4);
      const igv = calcularIGV(montoTotal);
      const estado = montoAbono >= montoTotal ? 'cobrado' : 'pendiente';
      const primerAbono = { cuentaId: form.cuentaId, cuentaNombre: form.cuentaNombre, sesiones, monto: montoAbono, fecha: Timestamp.now() };
      await addDoc(collection(db, 'payments'), {
        pacienteId: form.pacienteId, pacienteNombre: form.pacienteNombre,
        servicio: 'paquete4', monto: montoTotal,
        baseImponible: igv.base, igv: igv.igv,
        fecha, createdAt: Timestamp.now(),
        estado, montoPagado: montoAbono, sesionesPagadas: sesiones,
        abonos: [primerAbono],
        cuentaId: form.cuentaId, cuentaNombre: form.cuentaNombre,
        notas: form.notas,
      });
      if (form.cuentaId && montoAbono > 0) {
        await incrementarSaldo(form.cuentaId, montoAbono);
      }
    } else {
      const igv = calcularIGV(Number(form.monto));
      const pagadoDeUna = form.estado === 'cobrado';
      await addDoc(collection(db, 'payments'), {
        pacienteId: form.pacienteId, pacienteNombre: form.pacienteNombre,
        servicio: form.servicio, monto: Number(form.monto),
        baseImponible: igv.base, igv: igv.igv,
        fecha, createdAt: Timestamp.now(),
        estado: form.estado, montoPagado: pagadoDeUna ? Number(form.monto) : 0,
        sesionesPagadas: 0, abonos: [],
        cuentaId: form.cuentaId, cuentaNombre: form.cuentaNombre,
        notas: form.notas,
      });
      if (pagadoDeUna && form.cuentaId) {
        await incrementarSaldo(form.cuentaId, Number(form.monto));
      }
    }
    setShowModal(false);
    setForm(defaultForm());
    loadAll();
  }

  const handleAbonoCuenta = (cuentaId) => {
    const c = bankAccounts.find(x => x.id === cuentaId);
    setAbonoForm(f => ({ ...f, cuentaId, cuentaNombre: c ? (c.nombre || c.banco) : '' }));
  };

  const openAbono = (p) => {
    const saldoPendiente = (p.monto || 0) - (p.montoPagado || 0);
    const sesionesRestantes = 4 - (p.sesionesPagadas || 0);
    const sugerido = sesionesRestantes > 0 ? Math.min(saldoPendiente, (p.monto || 0) / 4) : saldoPendiente;
    setAbonoTarget(p);
    setAbonoForm({ cuentaId: '', cuentaNombre: '', sesiones: 1, monto: sugerido > 0 ? sugerido.toFixed(2) : '' });
  };

  async function saveAbono(e) {
    e.preventDefault();
    if (!abonoTarget || !abonoForm.cuentaId) return;
    setSaving(true);
    try {
      const monto = Number(abonoForm.monto) || 0;
      const sesiones = Number(abonoForm.sesiones) || 0;
      const abono = { cuentaId: abonoForm.cuentaId, cuentaNombre: abonoForm.cuentaNombre, sesiones, monto, fecha: Timestamp.now() };
      const montoPagado = (abonoTarget.montoPagado || 0) + monto;
      const sesionesPagadas = Math.min((abonoTarget.sesionesPagadas || 0) + sesiones, 4);
      const estado = montoPagado >= (abonoTarget.monto || 0) ? 'cobrado' : 'pendiente';
      await updateDoc(doc(db, 'payments', abonoTarget.id), {
        abonos: [...(abonoTarget.abonos || []), abono],
        montoPagado,
        sesionesPagadas,
        estado,
        cuentaId: abonoForm.cuentaId,
        cuentaNombre: abonoForm.cuentaNombre,
      });
      await incrementarSaldo(abonoForm.cuentaId, monto);
      setAbonoTarget(null);
      loadAll();
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id, estado) {
    await updateDoc(doc(db, 'payments', id), { estado });
    loadAll();
  }

  async function confirmarCobro() {
    if (!cobroTarget || !cobroCuentaId) return;
    setSaving(true);
    try {
      const cuentaNombre = bankAccounts.find(x => x.id === cobroCuentaId)?.nombre || bankAccounts.find(x => x.id === cobroCuentaId)?.banco || '';
      await updateDoc(doc(db, 'payments', cobroTarget.id), { estado: 'cobrado', cuentaId: cobroCuentaId, cuentaNombre });
      await incrementarSaldo(cobroCuentaId, cobroTarget.monto || 0);
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
                  <td>
                    <strong>{formatSoles(p.monto)}</strong>
                    {p.servicio === 'paquete4' && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '2px' }}>
                        {formatSoles(p.montoPagado || 0)} pagado · {p.sesionesPagadas || 0}/4 ses.
                      </div>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-3)' }}>{formatDate(p.fecha)}</td>
                  <td>
                    <span className={`badge badge-${p.estado === 'cobrado' ? 'success' : p.estado === 'pendiente' ? 'warning' : 'danger'}`}>
                      {p.estado === 'cobrado' ? '✅ Cobrado' : p.estado === 'pendiente' ? '⏳ Pendiente' : '❌ Vencido'}
                    </span>
                  </td>
                  <td>
                    {p.estado === 'pendiente' && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {p.servicio === 'paquete4' ? (
                          <button className="btn btn-sm btn-primary" onClick={() => openAbono(p)}>
                            {p.montoPagado > 0 ? '💳 Abonar' : '✅ Cobrar'}
                          </button>
                        ) : (
                          <button className="btn btn-sm btn-primary" onClick={() => { setCobroTarget(p); setCobroCuentaId(''); }}>✅ Cobrar</button>
                        )}
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
                <SearchableSelect
                  options={patients.map(p => ({ id: p.id, label: p.nombre }))}
                  value={form.pacienteId}
                  onChange={handlePaciente}
                  placeholder="Buscar paciente por nombre o apellido..."
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Servicio *</label>
                  <select className="form-select" value={form.servicio} onChange={e => handleServicio(e.target.value)}>
                    {SERVICIOS.map(s => <option key={s.id} value={s.id}>{s.label}{s.precio > 0 ? ` — S/. ${s.precio}` : ''}</option>)}
                  </select>
                </div>
                {form.servicio !== 'paquete4' && (
                  <div className="form-group">
                    <label className="form-label">Monto (S/.) *</label>
                    <input className="form-input" type="number" required min="0" step="0.01" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} />
                  </div>
                )}
              </div>

              {form.servicio === 'paquete4' && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Sesión(es) que cubre este pago *</label>
                    <input className="form-input" type="number" required min="1" max="4" value={form.sesionesCubre} onChange={e => setForm({...form, sesionesCubre: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monto a pagar ahora (S/.) *</label>
                    <input className="form-input" type="number" required min="0.01" step="0.01" max={PRECIO_PAQUETE_4} value={form.montoAbono} onChange={e => setForm({...form, montoAbono: e.target.value})} />
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input className="form-input" type="date" required value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
                </div>
                {form.servicio !== 'paquete4' && (
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select className="form-select" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                      <option value="cobrado">✅ Cobrado</option>
                      <option value="pendiente">⏳ Pendiente</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">💳 ¿Dónde ingresó el cobro? *</label>
                <select className="form-select" required value={form.cuentaId} onChange={e => handleCuenta(e.target.value)}>
                  <option value="">Seleccionar cuenta...</option>
                  {bankAccounts.map(a => <option key={a.id} value={a.id}>🏦 {a.nombre || a.banco} — {formatSoles(a.saldo || 0)}</option>)}
                </select>
              </div>

              {form.servicio === 'paquete4' ? (
                (() => {
                  const montoAbono = Number(form.montoAbono) || 0;
                  const restante = Math.max(PRECIO_PAQUETE_4 - montoAbono, 0);
                  const sesiones = Math.min(Number(form.sesionesCubre) || 0, 4);
                  return (
                    <div className="igv-box" style={{ marginBottom: '16px' }}>
                      <div className="igv-row"><span style={{color:'var(--text-3)'}}>Total del paquete</span><span>{formatSoles(PRECIO_PAQUETE_4)}</span></div>
                      <div className="igv-row"><span style={{color:'var(--text-3)'}}>Pagas ahora</span><span>{formatSoles(montoAbono)}</span></div>
                      <div className="igv-row total"><span>Saldo restante</span><span>{formatSoles(restante)}</span></div>
                      <div className="igv-row"><span style={{color:'var(--text-3)'}}>Sesiones cubiertas</span><span>{sesiones}/4</span></div>
                    </div>
                  );
                })()
              ) : form.monto > 0 && (
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
              <select className="form-select" required value={cobroCuentaId} onChange={e => setCobroCuentaId(e.target.value)}>
                <option value="">Seleccionar cuenta...</option>
                {bankAccounts.map(a => <option key={a.id} value={a.id}>🏦 {a.nombre || a.banco} — {formatSoles(a.saldo || 0)}</option>)}
              </select>
            </div>
            {cobroCuentaId && (() => {
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

      {abonoTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAbonoTarget(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">📦 Abono de paquete</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setAbonoTarget(null)}>✕</button>
            </div>
            <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '16px', borderLeft: '3px solid var(--primary)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '8px' }}>{abonoTarget.pacienteNombre}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-3)' }}>Total del paquete</span><strong>{formatSoles(abonoTarget.monto)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-3)' }}>Pagado hasta ahora</span><strong style={{ color: 'var(--success)' }}>{formatSoles(abonoTarget.montoPagado || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-3)' }}>Saldo pendiente</span><strong style={{ color: 'var(--warning)' }}>{formatSoles((abonoTarget.monto || 0) - (abonoTarget.montoPagado || 0))}</strong>
              </div>
            </div>
            <form onSubmit={saveAbono}>
              <div className="form-group">
                <label className="form-label">💳 ¿A qué cuenta se paga? *</label>
                <select className="form-select" required value={abonoForm.cuentaId} onChange={e => handleAbonoCuenta(e.target.value)}>
                  <option value="">Seleccionar cuenta...</option>
                  {bankAccounts.map(a => <option key={a.id} value={a.id}>🏦 {a.nombre || a.banco} — {formatSoles(a.saldo || 0)}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Sesión(es) que cubre *</label>
                  <input className="form-input" type="number" required min="1" max={4 - (abonoTarget.sesionesPagadas || 0)} value={abonoForm.sesiones} onChange={e => setAbonoForm({...abonoForm, sesiones: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Monto a pagar (S/.) *</label>
                  <input className="form-input" type="number" required min="0.01" step="0.01" max={(abonoTarget.monto || 0) - (abonoTarget.montoPagado || 0)} value={abonoForm.monto} onChange={e => setAbonoForm({...abonoForm, monto: e.target.value})} />
                </div>
              </div>
              {abonoForm.monto && (() => {
                const restante = (abonoTarget.monto || 0) - (abonoTarget.montoPagado || 0) - (Number(abonoForm.monto) || 0);
                const sesionesTotal = Math.min((abonoTarget.sesionesPagadas || 0) + (Number(abonoForm.sesiones) || 0), 4);
                return (
                  <div style={{
                    background: restante <= 0 ? 'var(--success-light)' : 'var(--warning-light)',
                    border: `1px solid ${restante <= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: '16px', fontSize: '0.83rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-3)' }}>Saldo restante después de este pago:</span>
                      <strong>{formatSoles(Math.max(restante, 0))}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ color: 'var(--text-3)' }}>Sesiones pagadas:</span>
                      <strong>{sesionesTotal}/4</strong>
                    </div>
                  </div>
                );
              })()}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAbonoTarget(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!abonoForm.cuentaId || saving}>{saving ? 'Guardando...' : 'Registrar abono'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
