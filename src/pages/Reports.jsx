import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { formatSoles, calcularIGV } from '../utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function Reports() {
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [data, setData] = useState({ payments: [], expenses: [], patients: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadReport(); }, [selMonth, selYear]);

  async function loadReport() {
    setLoading(true);
    const start = new Date(selYear, selMonth, 1);
    const end = new Date(selYear, selMonth + 1, 0, 23, 59, 59);

    const [paySnap, expSnap, patSnap] = await Promise.all([
      getDocs(query(collection(db, 'payments'), where('fecha', '>=', Timestamp.fromDate(start)), where('fecha', '<=', Timestamp.fromDate(end)))),
      getDocs(query(collection(db, 'expenses'), where('fecha', '>=', Timestamp.fromDate(start)), where('fecha', '<=', Timestamp.fromDate(end)))),
      getDocs(query(collection(db, 'patients'), where('estado', '==', 'activo'))),
    ]);

    setData({
      payments: paySnap.docs.map(d => ({ id: d.id, ...d.data() })),
      expenses: expSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      patients: patSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    });
    setLoading(false);
  }

  const cobrados = data.payments.filter(p => p.estado === 'cobrado');
  const pendientes = data.payments.filter(p => p.estado === 'pendiente');
  const totalIngresos = cobrados.reduce((a, p) => a + (p.monto || 0), 0);
  const totalPendientes = pendientes.reduce((a, p) => a + (p.monto || 0), 0);
  const totalGastos = data.expenses.reduce((a, e) => a + (e.monto || 0), 0);
  const balance = totalIngresos - totalGastos;
  const igvTotal = totalIngresos - totalIngresos / 1.18;
  const baseTotal = totalIngresos / 1.18;

  // Chart: ingresos por tipo de servicio
  const byService = {};
  cobrados.forEach(p => {
    const key = p.servicio === 'entrada' ? 'Sesión Entrada' : p.servicio === 'paquete4' ? 'Paquete 4' : 'Individual';
    byService[key] = (byService[key] || 0) + (p.monto || 0);
  });
  const serviceChart = Object.entries(byService).map(([name, value]) => ({ name, value }));

  // Gastos por categoría
  const byCat = {};
  data.expenses.forEach(e => { byCat[e.categoria] = (byCat[e.categoria] || 0) + (e.monto || 0); });
  const catChart = Object.entries(byCat).map(([name, value]) => ({ name, value }));

  const exportPDF = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text('Madurando Talentos', 14, 20);
    pdf.setFontSize(12);
    pdf.text(`Reporte Financiero — ${MONTHS[selMonth]} ${selYear}`, 14, 30);
    pdf.setFontSize(10);
    pdf.text(`Generado: ${new Date().toLocaleDateString('es-PE')}`, 14, 38);

    let y = 50;
    const addLine = (label, value, color) => {
      pdf.setTextColor(100, 100, 100);
      pdf.text(label, 14, y);
      pdf.setTextColor(0, 0, 0);
      pdf.text(value, 120, y);
      y += 8;
    };

    pdf.setFontSize(11);
    pdf.setTextColor(80, 122, 107);
    pdf.text('RESUMEN FINANCIERO', 14, y); y += 10;
    pdf.setTextColor(0, 0, 0);

    addLine('Total ingresos cobrados:', formatSoles(totalIngresos));
    addLine('Base imponible:', formatSoles(baseTotal));
    addLine('IGV 18%:', formatSoles(igvTotal));
    addLine('Total gastos:', formatSoles(totalGastos));
    addLine('Balance neto:', formatSoles(balance));
    addLine('Cobros pendientes:', formatSoles(totalPendientes));
    addLine('Pacientes activos:', `${data.patients.length}`);

    y += 10;
    pdf.setTextColor(80, 122, 107);
    pdf.text('DETALLE DE COBROS', 14, y); y += 8;
    pdf.setTextColor(0,0,0);
    cobrados.forEach(p => {
      pdf.setFontSize(9);
      pdf.text(`${p.pacienteNombre} — ${p.servicio}`, 14, y);
      pdf.text(formatSoles(p.monto), 160, y);
      y += 6;
      if (y > 270) { pdf.addPage(); y = 20; }
    });

    pdf.save(`reporte-${MONTHS[selMonth]}-${selYear}.pdf`);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Resumen
    const resumen = [
      ['Reporte Financiero — Madurando Talentos'],
      [`${MONTHS[selMonth]} ${selYear}`],
      [],
      ['Concepto', 'Monto (S/.)'],
      ['Total ingresos cobrados', totalIngresos],
      ['Base imponible', baseTotal],
      ['IGV 18%', igvTotal],
      ['Total gastos', totalGastos],
      ['Balance neto', balance],
      ['Cobros pendientes', totalPendientes],
      ['Pacientes activos', data.patients.length],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'Resumen');

    // Cobros
    const cobrosData = [['Paciente', 'Servicio', 'Base', 'IGV', 'Total', 'Estado', 'Fecha'],
      ...data.payments.map(p => {
        const igv = calcularIGV(p.monto || 0);
        const fecha = p.fecha?.toDate ? p.fecha.toDate().toLocaleDateString('es-PE') : '';
        return [p.pacienteNombre, p.servicio, igv.base, igv.igv, p.monto, p.estado, fecha];
      })
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cobrosData), 'Cobros');

    // Gastos
    const gastosData = [['Descripción', 'Categoría', 'Monto', 'Recurrente', 'Fecha'],
      ...data.expenses.map(e => {
        const fecha = e.fecha?.toDate ? e.fecha.toDate().toLocaleDateString('es-PE') : '';
        return [e.descripcion, e.categoria, e.monto, e.recurrente ? 'Sí' : 'No', fecha];
      })
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gastosData), 'Gastos');

    XLSX.writeFile(wb, `reporte-${MONTHS[selMonth]}-${selYear}.xlsx`);
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">📈 Reportes</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={exportExcel}>📊 Exportar Excel</button>
          <button className="btn btn-primary" onClick={exportPDF}>📄 Exportar PDF</button>
        </div>
      </div>

      {/* Selector de mes */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-3)', fontSize: '0.85rem', fontWeight: '600' }}>Período:</span>
          <select className="form-select" style={{ width: 'auto' }} value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="form-select" style={{ width: 'auto' }} value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          {loading && <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>Cargando...</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        {[
          { title: 'Ingresos cobrados', value: formatSoles(totalIngresos), color: 'var(--success)', icon: '💰' },
          { title: 'Por cobrar', value: formatSoles(totalPendientes), color: 'var(--warning)', icon: '⏳' },
          { title: 'Total gastos', value: formatSoles(totalGastos), color: 'var(--danger)', icon: '💸' },
          { title: 'Balance neto', value: formatSoles(balance), color: balance >= 0 ? 'var(--primary-light)' : 'var(--danger)', icon: '📊' },
        ].map(s => (
          <div key={s.title} className="card" style={{ borderLeft: `3px solid ${s.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="card-title">{s.title}</div>
                <div className="card-value" style={{ color: s.color, fontSize: '1.4rem' }}>{s.value}</div>
              </div>
              <span style={{ fontSize: '22px' }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* IGV Box */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '12px' }}>🧾 Desglose IGV — Para la contadora</div>
          <div className="igv-box">
            <div className="igv-row"><span style={{ color: 'var(--text-3)' }}>Total facturable</span><span>{formatSoles(totalIngresos)}</span></div>
            <div className="igv-row"><span style={{ color: 'var(--text-3)' }}>Base imponible (÷1.18)</span><span>{formatSoles(baseTotal)}</span></div>
            <div className="igv-row"><span style={{ color: 'var(--text-3)' }}>IGV 18%</span><span style={{ color: 'var(--warning)' }}>{formatSoles(igvTotal)}</span></div>
            <div className="igv-row total"><span>Neto a declarar</span><span>{formatSoles(baseTotal)}</span></div>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: '12px' }}>💰 Ingresos por servicio</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={serviceChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#6e8c80', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#6e8c80', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `S/.${v}`} />
              <Tooltip contentStyle={{ background: '#1a2920', border: '1px solid rgba(92,122,107,0.3)', borderRadius: '8px', fontSize: '12px' }} formatter={v => [formatSoles(v)]} />
              <Bar dataKey="value" fill="var(--primary)" radius={[4,4,0,0]} name="Ingresos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cobros pendientes */}
      {pendientes.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-title" style={{ marginBottom: '12px' }}>⚠️ Cobros Pendientes — {MONTHS[selMonth]}</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Paciente</th><th>Servicio</th><th>Monto</th><th>Fecha cita</th></tr></thead>
              <tbody>
                {pendientes.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.pacienteNombre}</strong></td>
                    <td>{p.servicio}</td>
                    <td style={{ color: 'var(--warning)' }}><strong>{formatSoles(p.monto)}</strong></td>
                    <td style={{ color: 'var(--text-3)' }}>{p.fecha?.toDate ? p.fecha.toDate().toLocaleDateString('es-PE') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
