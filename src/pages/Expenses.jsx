import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { formatDate, formatSoles, CATEGORIAS_GASTO } from '../utils';

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm());

  function defaultForm() {
    return { descripcion: '', monto: '', categoria: 'Alquiler', fecha: new Date().toISOString().split('T')[0], recurrente: false, frecuencia: 'mensual', cuentaId: '', cuentaNombre: '', notas: '' };
  }

  useEffect(() => { loadExpenses(); }, []);

  async function loadExpenses() {
    const [expSnap, bankSnap] = await Promise.all([
      getDocs(query(collection(db, 'expenses'), orderBy('fecha', 'desc'))),
      getDocs(query(collection(db, 'bank_accounts'), orderBy('banco'))),
    ]);
    setExpenses(expSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setBankAccounts(bankSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  const handleCuenta = (cuentaId) => {
    const c = bankAccounts.find(x => x.id === cuentaId);
    setForm(f => ({ ...f, cuentaId, cuentaNombre: c ? (c.nombre || c.banco) : '' }));
  };

  async function saveExpense(e) {
    e.preventDefault();
    await addDoc(collection(db, 'expenses'), {
      ...form,
      monto: Number(form.monto),
      fecha: Timestamp.fromDate(new Date(`${form.fecha}T12:00:00`)),
      createdAt: Timestamp.now(),
    });
    const cuenta = bankAccounts.find(x => x.id === form.cuentaId);
    if (cuenta) {
      await updateDoc(doc(db, 'bank_accounts', form.cuentaId), { saldo: (cuenta.saldo || 0) - Number(form.monto), updatedAt: Timestamp.now() });
    }
    setShowModal(false);
    setForm(defaultForm());
    loadExpenses();
  }

  const filtered = tab === 'todos' ? expenses
    : tab === 'recurrente' ? expenses.filter(e => e.recurrente)
    : expenses.filter(e => !e.recurrente);

  const total = filtered.reduce((a, e) => a + (e.monto || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">💸 Gastos</h2>
        <button className="btn btn-primary" onClick={() => { setForm(defaultForm()); setShowModal(true); }}>
          + Registrar Gasto
        </button>
      </div>

      <div className="tabs">
        {[['todos','Todos'],['recurrente','Recurrentes'],['puntual','Puntuales']].map(([val, lbl]) => (
          <button key={val} className={`tab-btn ${tab === val ? 'active' : ''}`} onClick={() => setTab(val)}>{lbl}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-3)', alignSelf: 'center', paddingRight: '8px' }}>
          Total: <strong style={{ color: 'var(--danger)' }}>{formatSoles(total)}</strong>
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Descripción</th><th>Categoría</th><th>Monto</th><th>Fecha</th><th>Tipo</th><th>Notas</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>Sin gastos registrados</td></tr>
            ) : filtered.map(e => (
              <tr key={e.id}>
                <td><strong>{e.descripcion}</strong></td>
                <td><span className="badge badge-neutral">{e.categoria}</span></td>
                <td><strong style={{ color: 'var(--danger)' }}>{formatSoles(e.monto)}</strong></td>
                <td style={{ color: 'var(--text-3)' }}>{formatDate(e.fecha)}</td>
                <td>
                  {e.recurrente
                    ? <span className="badge badge-info">🔄 {e.frecuencia}</span>
                    : <span className="badge badge-neutral">Puntual</span>}
                </td>
                <td style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{e.notas || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Registrar Gasto</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={saveExpense}>
              <div className="form-group">
                <label className="form-label">Descripción *</label>
                <input className="form-input" required value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} placeholder="Ej: Alquiler consultorio enero" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Categoría</label>
                  <select className="form-select" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                    {CATEGORIAS_GASTO.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Monto (S/.) *</label>
                  <input className="form-input" type="number" required min="0" step="0.01" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} placeholder="0.00" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input className="form-input" type="date" required value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">¿Es recurrente?</label>
                  <select className="form-select" value={form.recurrente ? 'si' : 'no'} onChange={e => setForm({...form, recurrente: e.target.value === 'si'})}>
                    <option value="no">No, pago puntual</option>
                    <option value="si">Sí, recurrente</option>
                  </select>
                </div>
              </div>
              {form.recurrente && (
                <div className="form-group">
                  <label className="form-label">Frecuencia</label>
                  <select className="form-select" value={form.frecuencia} onChange={e => setForm({...form, frecuencia: e.target.value})}>
                    <option value="mensual">Mensual</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="semanal">Semanal</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">💳 ¿De dónde salió el pago? *</label>
                <select className="form-select" required value={form.cuentaId} onChange={e => handleCuenta(e.target.value)}>
                  <option value="">Seleccionar cuenta...</option>
                  {bankAccounts.map(a => <option key={a.id} value={a.id}>🏦 {a.nombre || a.banco} — {formatSoles(a.saldo || 0)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea className="form-textarea" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Detalles adicionales..." style={{ minHeight: '60px' }} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-danger">Registrar gasto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
