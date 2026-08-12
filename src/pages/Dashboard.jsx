import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { formatSoles, esCumpleanosHoy, cumpleanosProximo } from '../utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ title, value, sub, color, icon }) => (
  <div className="card stat-card" style={{ borderTop: `3px solid ${color}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div className="card-title">{title}</div>
        <div className="card-value" style={{ color }}>{value}</div>
        {sub && <div className="card-sub">{sub}</div>}
      </div>
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px',
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
    </div>
  </div>
);

const icons = {
  income: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#29B5D8" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  expense: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E05252" strokeWidth="2">
      <path d="M21 4H3M21 12H8M21 20H3"/><path d="M5 8 2 12l3 4"/>
    </svg>
  ),
  balance: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFCB05" strokeWidth="2">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
  pending: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  patients: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
};

export default function Dashboard() {
  const [stats, setStats] = useState({ ingresos: 0, gastos: 0, pendientes: 0, pacientes: 0 });
  const [chartData, setChartData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  const [todayAppts, setTodayAppts] = useState([]);
  const [birthdayIds, setBirthdayIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const paymentsQ = query(
        collection(db, 'payments'),
        where('fecha', '>=', Timestamp.fromDate(startOfMonth)),
        where('fecha', '<=', Timestamp.fromDate(endOfMonth))
      );
      const paymentsSnap = await getDocs(paymentsQ);
      let ingresos = 0, pendientes = 0;
      const pendingItems = [];
      paymentsSnap.forEach(d => {
        const p = d.data();
        if (p.estado === 'cobrado') ingresos += p.monto || 0;
        else if (p.estado === 'pendiente') {
          pendientes += p.monto || 0;
          pendingItems.push({ id: d.id, ...p });
        }
      });

      const expQ = query(
        collection(db, 'expenses'),
        where('fecha', '>=', Timestamp.fromDate(startOfMonth)),
        where('fecha', '<=', Timestamp.fromDate(endOfMonth))
      );
      const expSnap = await getDocs(expQ);
      let gastos = 0;
      expSnap.forEach(d => { gastos += d.data().monto || 0; });

      const patSnap = await getDocs(query(collection(db, 'patients'), where('estado', '==', 'activo')));
      let pacientes = patSnap.size;
      const birthdaySet = new Set();

      const alertList = [];
      patSnap.forEach(d => {
        const p = d.data();
        if (esCumpleanosHoy(p.fechaNacimiento)) {
          birthdaySet.add(d.id);
          alertList.push({ type: 'birthday_today', msg: `Hoy es el cumpleaños de ${p.nombre} — no contactar`, color: 'warning' });
        } else if (cumpleanosProximo(p.fechaNacimiento, 3)) {
          alertList.push({ type: 'birthday_soon', msg: `Cumpleaños próximo: ${p.nombre} (en menos de 3 días)`, color: 'info' });
        }
      });

      // Citas de hoy, ordenadas por hora
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const todaySnap = await getDocs(query(
        collection(db, 'appointments'),
        where('fecha', '>=', Timestamp.fromDate(todayStart)),
        where('fecha', '<=', Timestamp.fromDate(todayEnd))
      ));
      const todayList = todaySnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const da = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
          const dbb = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
          return da - dbb;
        });

      const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
      const apptsSnap = await getDocs(query(
        collection(db, 'appointments'),
        where('fecha', '>=', Timestamp.fromDate(tomorrowStart)),
        where('fecha', '<=', Timestamp.fromDate(tomorrowEnd))
      ));
      let tomorrowCount = 0;
      apptsSnap.forEach(d => { if (d.data().estado === 'programada') tomorrowCount++; });
      if (tomorrowCount > 0) {
        alertList.push({ type: 'appts_tomorrow', msg: `${tomorrowCount} cita(s) programada(s) para mañana. Recuerda confirmarlas.`, color: 'info' });
      }

      let vencidosCount = 0;
      pendingItems.forEach(p => {
        const pDate = p.fecha?.toDate ? p.fecha.toDate() : new Date(p.fecha);
        if (pDate < now && pDate.toDateString() !== now.toDateString()) vencidosCount++;
      });
      if (vencidosCount > 0) {
        alertList.push({ type: 'payments_overdue', msg: `Hay ${vencidosCount} cobro(s) pendiente(s) de citas pasadas.`, color: 'danger' });
      }

      // Ingresos y gastos reales de los últimos 6 meses, para la gráfica
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const [chartPaySnap, chartExpSnap] = await Promise.all([
        getDocs(query(collection(db, 'payments'), where('fecha', '>=', Timestamp.fromDate(sixMonthsAgo)), where('fecha', '<=', Timestamp.fromDate(endOfMonth)))),
        getDocs(query(collection(db, 'expenses'), where('fecha', '>=', Timestamp.fromDate(sixMonthsAgo)), where('fecha', '<=', Timestamp.fromDate(endOfMonth)))),
      ]);
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, mes: d.toLocaleDateString('es-PE', { month: 'short' }), ingresos: 0, gastos: 0 });
      }
      const monthIdx = (d) => months.findIndex(m => m.key === `${d.getFullYear()}-${d.getMonth()}`);
      chartPaySnap.forEach(doc => {
        const p = doc.data();
        if (p.estado !== 'cobrado') return;
        const d = p.fecha?.toDate ? p.fecha.toDate() : new Date(p.fecha);
        const idx = monthIdx(d);
        if (idx >= 0) months[idx].ingresos += p.montoPagado || p.monto || 0;
      });
      chartExpSnap.forEach(doc => {
        const e = doc.data();
        const d = e.fecha?.toDate ? e.fecha.toDate() : new Date(e.fecha);
        const idx = monthIdx(d);
        if (idx >= 0) months[idx].gastos += e.monto || 0;
      });

      setStats({ ingresos, gastos, pendientes, pacientes });
      setChartData(months);
      setAlerts(alertList);
      setPendingList(pendingItems.slice(0, 5));
      setTodayAppts(todayList);
      setBirthdayIds(birthdaySet);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos, mismo patrón usado en el resto de páginas
  useEffect(() => { loadData(); }, [loadData]);

  const balance = stats.ingresos - stats.gastos;
  const mesActual = new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  const hoyTexto = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  const activasHoy = todayAppts.filter(a => a.estado === 'programada').length;

  const TIPO_LABEL = { entrada: 'Sesión de entrada', paquete4: 'Paquete 4 sesiones', sesion_suelta: 'Sesión individual' };
  const ESTADO_AGENDA = {
    programada: { label: 'Programada', badge: 'info', border: 'var(--primary)' },
    completada: { label: '✅ Hecha', badge: 'success', border: '#10B981' },
    cancelada: { label: 'Anulada', badge: 'neutral', border: 'var(--text-3)' },
    reprogramada: { label: '🔄 Reprogramada', badge: 'warning', border: 'var(--accent)' },
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard <span>— {mesActual}</span></h2>
          <p style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: '4px' }}>
            Resumen financiero y operativo del consultorio
          </p>
        </div>
        <button className="btn btn-accent" onClick={() => navigate('/appointments')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva Cita
        </button>
      </div>

      {/* Agenda de hoy */}
      <div className="card" style={{ marginBottom: '18px', borderTop: '3px solid var(--accent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div className="card-title" style={{ marginBottom: '2px' }}>📅 Agenda de hoy</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', textTransform: 'capitalize', fontWeight: 600 }}>{hoyTexto}</div>
          </div>
          {todayAppts.length > 0 && (
            <span className="badge badge-info">{activasHoy} programada{activasHoy === 1 ? '' : 's'}</span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-3)', fontSize: '0.84rem' }}>Cargando agenda...</div>
        ) : todayAppts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 10px', color: 'var(--text-3)' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" style={{ margin: '0 auto 10px', display: 'block' }}>
              <rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M16 2v4M8 2v4M3 9h18"/>
            </svg>
            <p style={{ fontSize: '0.85rem' }}>No tienes citas programadas para hoy</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todayAppts.map(a => {
              const d = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
              const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
              const cumple = birthdayIds.has(a.pacienteId);
              const info = ESTADO_AGENDA[a.estado] || ESTADO_AGENDA.programada;
              const inactiva = a.estado === 'cancelada' || a.estado === 'completada';
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  background: 'var(--bg-3)', borderLeft: `3px solid ${info.border}`,
                  borderRadius: '8px', padding: '10px 14px',
                  opacity: a.estado === 'cancelada' ? 0.55 : 1,
                }}>
                  <div style={{ minWidth: '58px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>{hora}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: '0.86rem', color: 'var(--text)',
                      textDecoration: inactiva ? 'line-through' : 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {a.pacienteNombre} {cumple && '🎂'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{TIPO_LABEL[a.tipo] || a.tipo}</div>
                  </div>
                  <span className={`badge badge-${info.badge}`} style={{ fontSize: '0.68rem', flexShrink: 0 }}>{info.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alertas */}
      {alerts.map((a, i) => (
        <div key={i} className={`alert alert-${a.color}`} style={{ marginBottom: '10px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {a.msg}
        </div>
      ))}

      {/* Stats */}
      <div className="stats-grid">
        <StatCard title="Ingresos del mes" value={formatSoles(stats.ingresos)} sub="Cobros realizados" color="#29B5D8" icon={icons.income} />
        <StatCard title="Gastos del mes" value={formatSoles(stats.gastos)} sub="Total de egresos" color="#E05252" icon={icons.expense} />
        <StatCard title="Balance neto" value={formatSoles(balance)} sub={balance >= 0 ? 'Positivo' : 'Negativo'} color={balance >= 0 ? '#FFCB05' : '#E05252'} icon={icons.balance} />
        <StatCard title="Por cobrar" value={formatSoles(stats.pendientes)} sub="Pagos pendientes" color="#F59E0B" icon={icons.pending} />
        <StatCard title="Pacientes activos" value={stats.pacientes} sub="Este mes" color="#10B981" icon={icons.patients} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Gráfica */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '16px' }}>Ingresos vs Gastos — Últimos 6 meses</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#29B5D8" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#29B5D8" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E05252" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#E05252" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="mes" tick={{ fill: 'var(--text-3)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `S/.${v}`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px', boxShadow: 'var(--shadow)' }}
                formatter={(v) => [formatSoles(v)]}
              />
              <Area type="monotone" dataKey="ingresos" stroke="#29B5D8" strokeWidth={2} fill="url(#gIngresos)" name="Ingresos" />
              <Area type="monotone" dataKey="gastos" stroke="#E05252" strokeWidth={2} fill="url(#gGastos)" name="Gastos" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* IGV del mes */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="card-title" style={{ textAlign: 'center', marginBottom: '16px' }}>Resumen IGV (18%)</div>
          <div className="igv-box">
            <div className="igv-row"><span style={{ color: 'var(--text-3)' }}>Base imponible</span><span>{formatSoles(stats.ingresos / 1.18)}</span></div>
            <div className="igv-row"><span style={{ color: 'var(--text-3)' }}>IGV 18%</span><span style={{ color: 'var(--accent-dark)', fontWeight: '600' }}>{formatSoles(stats.ingresos - stats.ingresos / 1.18)}</span></div>
            <hr className="divider" />
            <div className="igv-row total" style={{ fontSize: '1rem' }}><span>Total cobrado</span><span>{formatSoles(stats.ingresos)}</span></div>
          </div>
        </div>
      </div>

      {/* Cobros Pendientes */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="card-title">Cobros Pendientes</div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/payments')}>Ver todos →</button>
        </div>
        {pendingList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-3)', fontSize: '0.84rem' }}>
            Sin cobros pendientes
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingList.map(p => (
              <div key={p.id} style={{
                background: 'var(--bg-3)', borderRadius: '8px', padding: '11px 14px',
                borderLeft: '3px solid var(--accent)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.855rem', color: 'var(--text)' }}>{p.pacienteNombre}</div>
                  <div style={{ fontSize: '0.77rem', color: 'var(--text-3)', marginTop: '2px' }}>{p.servicio}</div>
                </div>
                <span style={{ color: 'var(--accent-dark)', fontWeight: '700', fontSize: '0.9rem' }}>{formatSoles(p.monto)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
