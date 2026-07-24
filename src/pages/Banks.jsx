import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { formatSoles } from '../utils';

const BANCOS = ['BCP', 'Interbank', 'BBVA', 'Scotiabank', 'BanBif', 'Banco de la Nación', 'Mibanco', 'Pichincha', 'Yape / BCP', 'Plin', 'Efectivo / Caja', 'Otro'];
const TIPOS_CUENTA = ['Corriente', 'Ahorros', 'Billetera digital', 'Caja chica'];
const BANK_COLORS = {
  BCP: '#003da5', Interbank: '#00a859', BBVA: '#004481', Scotiabank: '#ec111a', BanBif: '#f37021',
  'Banco de la Nación': '#d4a017', Mibanco: '#e30613', Pichincha: '#0066b3', 'Yape / BCP': '#742d91',
  Plin: '#00b4d8', 'Efectivo / Caja': '#10B981', Otro: '#888888',
};

function BankAvatar({ banco, size = 38 }) {
  const color = BANK_COLORS[banco] || '#888';
  const letter = (banco || '?')[0].toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '10px',
      background: `${color}18`, border: `1.5px solid ${color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontSize: size * 0.38, fontWeight: 800, color,
    }}>
      {letter}
    </div>
  );
}

export default function Banks() {
  const [accounts, setAccounts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('cuentas');

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountForm, setAccountForm] = useState(defaultAccountForm());

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(null);

  const [showMovModal, setShowMovModal] = useState(false);
  const [movForm, setMovForm] = useState(defaultMovForm());

  function defaultAccountForm() {
    return { banco: 'BCP', tipo: 'Ahorros', nombre: '', numero: '', saldo: '', moneda: 'PEN', notas: '' };
  }

  function defaultMovForm() {
    return { cuentaId: '', tipo: 'ingreso', monto: '', concepto: '', fecha: new Date().toISOString().split('T')[0], notas: '' };
  }

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [accSnap, movSnap] = await Promise.all([
        getDocs(query(collection(db, 'bank_accounts'), orderBy('banco'))),
        getDocs(query(collection(db, 'bank_movements'), orderBy('fecha', 'desc'))),
      ]);
      setAccounts(accSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setMovements(movSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  }

  async function saveAccount(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        banco: accountForm.banco,
        tipo: accountForm.tipo,
        nombre: accountForm.nombre.trim(),
        numero: accountForm.numero.trim(),
        saldo: parseFloat(accountForm.saldo) || 0,
        moneda: accountForm.moneda,
        notas: accountForm.notas.trim(),
        updatedAt: Timestamp.now(),
      };
      if (editingAccount) {
        await updateDoc(doc(db, 'bank_accounts', editingAccount.id), data);
      } else {
        await addDoc(collection(db, 'bank_accounts'), { ...data, createdAt: Timestamp.now() });
      }
      setShowAccountModal(false);
      setEditingAccount(null);
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteAccount() {
    if (!deletingAccount) return;
    await deleteDoc(doc(db, 'bank_accounts', deletingAccount.id));
    setShowDeleteModal(false);
    setDeletingAccount(null);
    loadData();
  }

  const openEditAccount = (acc) => {
    setEditingAccount(acc);
    setAccountForm({
      banco: acc.banco || 'BCP', tipo: acc.tipo || 'Ahorros', nombre: acc.nombre || '',
      numero: acc.numero || '', saldo: String(acc.saldo ?? ''), moneda: acc.moneda || 'PEN', notas: acc.notas || '',
    });
    setShowAccountModal(true);
  };

  async function saveMovement(e) {
    e.preventDefault();
    if (!movForm.cuentaId) return;
    setSaving(true);
    try {
      const monto = parseFloat(movForm.monto) || 0;
      const delta = movForm.tipo === 'ingreso' ? monto : -monto;
      await addDoc(collection(db, 'bank_movements'), {
        cuentaId: movForm.cuentaId,
        tipo: movForm.tipo,
        concepto: movForm.concepto.trim(),
        monto,
        fecha: Timestamp.fromDate(new Date(`${movForm.fecha}T12:00:00`)),
        notas: movForm.notas.trim(),
        createdAt: Timestamp.now(),
      });
      const cuenta = accounts.find(a => a.id === movForm.cuentaId);
      if (cuenta) {
        await updateDoc(doc(db, 'bank_accounts', movForm.cuentaId), { saldo: (cuenta.saldo || 0) + delta, updatedAt: Timestamp.now() });
      }
      setShowMovModal(false);
      setMovForm(defaultMovForm());
      loadData();
    } finally {
      setSaving(false);
    }
  }

  const saldoTotal = accounts.reduce((a, c) => a + (c.saldo || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">🏦 Cuentas Bancarias</h2>
          <p style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: '4px' }}>Saldos y movimientos de las cuentas del consultorio</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {accounts.length > 0 && (
            <button className="btn btn-secondary" onClick={() => { setMovForm({ ...defaultMovForm(), cuentaId: accounts[0]?.id || '' }); setShowMovModal(true); }}>
              + Registrar movimiento
            </button>
          )}
          <button className="btn btn-accent" onClick={() => { setEditingAccount(null); setAccountForm(defaultAccountForm()); setShowAccountModal(true); }}>
            + Nueva cuenta
          </button>
        </div>
      </div>

      {accounts.length > 0 && (
        <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, var(--primary-dark) 0%, #1a3a5c 100%)', border: 'none', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.6, marginBottom: '8px' }}>Saldo total consolidado</div>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#FFCB05' }}>{formatSoles(saldoTotal)}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.55, marginTop: '4px' }}>{accounts.length} cuenta{accounts.length === 1 ? '' : 's'} registrada{accounts.length === 1 ? '' : 's'}</div>
            </div>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,203,5,0.2)" strokeWidth="1.5">
              <rect x="2" y="6" width="20" height="13" rx="2.5" /><path d="M2 10h20" />
              <circle cx="7" cy="15" r="1.5" fill="rgba(255,203,5,0.2)" stroke="none" />
              <circle cx="11" cy="15" r="1.5" fill="rgba(255,203,5,0.2)" stroke="none" />
            </svg>
          </div>
        </div>
      )}

      <div className="tabs">
        {[['cuentas', '🏦 Cuentas'], ['movimientos', '📋 Movimientos']].map(([val, lbl]) => (
          <button key={val} className={`tab-btn ${tab === val ? 'active' : ''}`} onClick={() => setTab(val)}>{lbl}</button>
        ))}
      </div>

      {tab === 'cuentas' ? (
        loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-3)' }}>Cargando...</div>
        ) : accounts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block' }}>
              <rect x="2" y="6" width="20" height="13" rx="2.5" /><path d="M2 10h20" />
            </svg>
            <p style={{ color: 'var(--text-3)', marginBottom: '16px' }}>No hay cuentas bancarias registradas</p>
            <button className="btn btn-accent" onClick={() => { setEditingAccount(null); setAccountForm(defaultAccountForm()); setShowAccountModal(true); }}>+ Agregar primera cuenta</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {accounts.map(acc => (
              <div key={acc.id} className="card" style={{ borderTop: `3px solid ${BANK_COLORS[acc.banco] || '#888'}`, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <BankAvatar banco={acc.banco} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{acc.nombre || acc.banco}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '2px' }}>{acc.tipo} · {acc.banco}</div>
                      {acc.numero && <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontFamily: 'monospace', marginTop: '2px' }}>···· {acc.numero.slice(-4)}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEditAccount(acc)} title="Editar">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setDeletingAccount(acc); setShowDeleteModal(true); }} title="Eliminar">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                </div>
                <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: '4px' }}>Saldo actual</div>
                  <div style={{ fontSize: '1.7rem', fontWeight: 800, color: (acc.saldo || 0) >= 0 ? 'var(--primary-dark)' : 'var(--danger)', letterSpacing: '-0.03em' }}>{formatSoles(acc.saldo || 0)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '2px' }}>{acc.moneda === 'USD' ? 'Dólares americanos' : 'Soles peruanos'}</div>
                </div>
                {acc.notas && <div style={{ marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-3)', fontStyle: 'italic' }}>{acc.notas}</div>}
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: '12px', width: '100%', justifyContent: 'center', fontSize: '0.78rem' }}
                  onClick={() => { setMovForm({ ...defaultMovForm(), cuentaId: acc.id }); setShowMovModal(true); }}
                >
                  + Registrar movimiento en esta cuenta
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Cuenta</th><th>Concepto</th><th>Tipo</th><th>Monto</th><th>Notas</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>Cargando...</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>Sin movimientos registrados</td></tr>
              ) : movements.map(mov => {
                const cuenta = accounts.find(a => a.id === mov.cuentaId);
                const d = mov.fecha?.toDate ? mov.fecha.toDate() : new Date(mov.fecha);
                return (
                  <tr key={mov.id}>
                    <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {cuenta && <BankAvatar banco={cuenta.banco} size={26} />}
                        <span style={{ fontSize: '0.83rem' }}>{cuenta?.nombre || cuenta?.banco || '—'}</span>
                      </div>
                    </td>
                    <td><strong>{mov.concepto || '—'}</strong></td>
                    <td><span className={`badge ${mov.tipo === 'ingreso' ? 'badge-success' : 'badge-danger'}`}>{mov.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}</span></td>
                    <td><strong style={{ color: mov.tipo === 'ingreso' ? 'var(--success)' : 'var(--danger)' }}>{mov.tipo === 'ingreso' ? '+' : '-'}{formatSoles(mov.monto)}</strong></td>
                    <td style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{mov.notas || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAccountModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAccountModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editingAccount ? 'Editar cuenta' : 'Nueva cuenta bancaria'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAccountModal(false)}>✕</button>
            </div>
            <form onSubmit={saveAccount}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Banco *</label>
                  <select className="form-select" value={accountForm.banco} onChange={e => setAccountForm({ ...accountForm, banco: e.target.value })}>
                    {BANCOS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de cuenta</label>
                  <select className="form-select" value={accountForm.tipo} onChange={e => setAccountForm({ ...accountForm, tipo: e.target.value })}>
                    {TIPOS_CUENTA.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Nombre o alias *</label>
                <input className="form-input" required value={accountForm.nombre} onChange={e => setAccountForm({ ...accountForm, nombre: e.target.value })} placeholder="Ej: Cuenta principal BCP" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Últimos 4 dígitos (opcional)</label>
                  <input className="form-input" value={accountForm.numero} maxLength={20} onChange={e => setAccountForm({ ...accountForm, numero: e.target.value })} placeholder="0000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Moneda</label>
                  <select className="form-select" value={accountForm.moneda} onChange={e => setAccountForm({ ...accountForm, moneda: e.target.value })}>
                    <option value="PEN">Soles (S/.)</option>
                    <option value="USD">Dólares ($)</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Saldo actual (S/.) *</label>
                <input className="form-input" type="number" required min="0" step="0.01" value={accountForm.saldo} onChange={e => setAccountForm({ ...accountForm, saldo: e.target.value })} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Notas</label>
                <input className="form-input" value={accountForm.notas} onChange={e => setAccountForm({ ...accountForm, notas: e.target.value })} placeholder="Ej: Cuenta para cobros de pacientes" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAccountModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-accent" disabled={saving}>{saving ? 'Guardando...' : editingAccount ? 'Guardar cambios' : 'Crear cuenta'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMovModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowMovModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Registrar movimiento</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowMovModal(false)}>✕</button>
            </div>
            <form onSubmit={saveMovement}>
              <div className="form-group">
                <label className="form-label">Cuenta *</label>
                <select className="form-select" required value={movForm.cuentaId} onChange={e => setMovForm({ ...movForm, cuentaId: e.target.value })}>
                  <option value="">Seleccionar cuenta...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.nombre || a.banco} — {formatSoles(a.saldo || 0)}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo *</label>
                  <select className="form-select" value={movForm.tipo} onChange={e => setMovForm({ ...movForm, tipo: e.target.value })}>
                    <option value="ingreso">↑ Ingreso (entra dinero)</option>
                    <option value="egreso">↓ Egreso (sale dinero)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Monto (S/.) *</label>
                  <input className="form-input" type="number" required min="0.01" step="0.01" value={movForm.monto} onChange={e => setMovForm({ ...movForm, monto: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Concepto *</label>
                  <input className="form-input" required value={movForm.concepto} onChange={e => setMovForm({ ...movForm, concepto: e.target.value })} placeholder="Ej: Cobro sesión, Alquiler..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input className="form-input" type="date" value={movForm.fecha} onChange={e => setMovForm({ ...movForm, fecha: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notas</label>
                <input className="form-input" value={movForm.notas} onChange={e => setMovForm({ ...movForm, notas: e.target.value })} placeholder="Detalles adicionales..." />
              </div>
              {movForm.cuentaId && movForm.monto && (() => {
                const cuenta = accounts.find(a => a.id === movForm.cuentaId);
                const monto = parseFloat(movForm.monto) || 0;
                const nuevoSaldo = (cuenta?.saldo || 0) + (movForm.tipo === 'ingreso' ? monto : -monto);
                return (
                  <div style={{
                    background: movForm.tipo === 'ingreso' ? 'var(--success-light)' : 'var(--danger-light)',
                    border: `1px solid ${movForm.tipo === 'ingreso' ? 'rgba(16,185,129,0.3)' : 'rgba(224,82,82,0.3)'}`,
                    borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: '16px', fontSize: '0.83rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-3)' }}>Saldo después del movimiento:</span>
                      <strong style={{ color: nuevoSaldo >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatSoles(nuevoSaldo)}</strong>
                    </div>
                  </div>
                );
              })()}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMovModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-accent" disabled={saving}>{saving ? 'Guardando...' : 'Registrar movimiento'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDeleteModal(false)}>
          <div className="modal" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Eliminar cuenta</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowDeleteModal(false)}>✕</button>
            </div>
            <div style={{ padding: '0 4px 8px' }}>
              <div style={{ background: 'var(--danger-light)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '12px' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--danger)', fontWeight: 600, marginBottom: '4px' }}>Esta acción no se puede deshacer</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>Se eliminará la cuenta <strong>{deletingAccount?.nombre || deletingAccount?.banco}</strong> y no se podrá recuperar.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={confirmDeleteAccount}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
