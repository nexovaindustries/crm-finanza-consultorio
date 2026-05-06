import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, query, Timestamp } from 'firebase/firestore';
import { esCumpleanosHoy } from '../utils';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function Calendar() {
  const [today] = useState(new Date());
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({ pacienteId: '', pacienteNombre: '', hora: '10:00', tipo: 'entrada', notas: '' });

  useEffect(() => { loadData(); }, [current]);

  async function loadData() {
    const [appSnap, patSnap] = await Promise.all([
      getDocs(query(collection(db, 'appointments'))),
      getDocs(query(collection(db, 'patients')))
    ]);
    setAppointments(appSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setPatients(patSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  const prevMonth = () => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  const nextMonth = () => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1));

  // Build calendar grid
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells = [];
  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, month: month - 1, year, other: true });
  }
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ day: i, month, year, other: false });
  }
  // Next month days
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, month: month + 1, year, other: true });
  }

  const getApptForDay = (cell) => {
    return appointments.filter(a => {
      const d = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
      return d.getDate() === cell.day && d.getMonth() === cell.month && d.getFullYear() === cell.year && a.estado !== 'cancelada';
    });
  };

  const getBirthdaysForDay = (cell) => {
    return patients.filter(p => {
      if (!p.fechaNacimiento) return false;
      const nac = new Date(p.fechaNacimiento);
      return nac.getDate() === cell.day && nac.getMonth() === cell.month;
    });
  };

  const isToday = (cell) => !cell.other && cell.day === today.getDate() && cell.month === today.getMonth() && cell.year === today.getFullYear();

  const openDay = (cell) => {
    if (cell.other) return;
    setSelectedDate(new Date(cell.year, cell.month, cell.day));
    setShowModal(true);
  };

  const handlePaciente = (id) => {
    const p = patients.find(x => x.id === id);
    setForm(f => ({ ...f, pacienteId: id, pacienteNombre: p?.nombre || '' }));
  };

  async function saveAppt(e) {
    e.preventDefault();
    const fechaHora = new Date(selectedDate);
    const [h, m] = form.hora.split(':');
    fechaHora.setHours(parseInt(h), parseInt(m));
    await addDoc(collection(db, 'appointments'), {
      pacienteId: form.pacienteId,
      pacienteNombre: form.pacienteNombre,
      fecha: Timestamp.fromDate(fechaHora),
      tipo: form.tipo,
      estado: 'programada',
      notas: form.notas,
      createdAt: Timestamp.now(),
    });
    setShowModal(false);
    setForm({ pacienteId: '', pacienteNombre: '', hora: '10:00', tipo: 'entrada', notas: '' });
    loadData();
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">📅 Calendario</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={prevMonth}>‹</button>
          <span style={{ fontWeight: '700', color: 'var(--text)', minWidth: '160px', textAlign: 'center', fontSize: '0.95rem' }}>
            {MONTHS[month]} {year}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth}>›</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '0.78rem', color: 'var(--text-3)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--primary)', display: 'inline-block' }}></span> Cita
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--accent)', display: 'inline-block' }}></span> 🎂 Cumpleaños (no contactar)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid var(--primary-light)', display: 'inline-block' }}></span> Hoy
        </span>
      </div>

      <div className="card" style={{ padding: '16px' }}>
        {/* Day headers */}
        <div className="cal-header">
          {DAYS.map(d => <div key={d} className="cal-day-label">{d}</div>)}
        </div>
        {/* Grid */}
        <div className="calendar-grid">
          {cells.map((cell, i) => {
            const appts = getApptForDay(cell);
            const birthdays = getBirthdaysForDay(cell);
            const hasBirthday = birthdays.length > 0;
            return (
              <div
                key={i}
                className={`cal-cell ${isToday(cell) ? 'today' : ''} ${cell.other ? 'other-month' : ''} ${hasBirthday ? 'has-birthday' : ''}`}
                onClick={() => openDay(cell)}
              >
                <div className="cal-date">{cell.day}</div>
                {appts.slice(0, 2).map(a => (
                  <div key={a.id} className="cal-event cal-event-appt">
                    {a.fecha?.toDate ? a.fecha.toDate().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : ''} {a.pacienteNombre}
                  </div>
                ))}
                {appts.length > 2 && <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: '2px' }}>+{appts.length - 2} más</div>}
                {birthdays.map(p => (
                  <div key={p.id} className="cal-event cal-event-birthday">🎂 {p.nombre.split(' ')[0]}</div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {showModal && selectedDate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">
                {selectedDate.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {/* Citas del día */}
            {(() => {
              const dayAppts = getApptForDay({ day: selectedDate.getDate(), month: selectedDate.getMonth(), year: selectedDate.getFullYear() });
              const dayBirthdays = getBirthdaysForDay({ day: selectedDate.getDate(), month: selectedDate.getMonth() });
              return (
                <>
                  {dayBirthdays.length > 0 && (
                    <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
                      🎂 <strong>Cumpleaños:</strong> {dayBirthdays.map(p => p.nombre).join(', ')} — <strong>No contactar</strong>
                    </div>
                  )}
                  {dayAppts.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-3)', marginBottom: '8px' }}>CITAS DEL DÍA</div>
                      {dayAppts.map(a => (
                        <div key={a.id} style={{ background: 'var(--bg-3)', borderRadius: '8px', padding: '8px 12px', marginBottom: '6px', borderLeft: '3px solid var(--primary)' }}>
                          <strong style={{ fontSize: '0.875rem' }}>{a.pacienteNombre}</strong>
                          <span style={{ color: 'var(--text-3)', fontSize: '0.78rem', marginLeft: '8px' }}>
                            {a.fecha?.toDate ? a.fecha.toDate().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-3)', marginBottom: '12px' }}>+ NUEVA CITA EN ESTE DÍA</div>
            <form onSubmit={saveAppt}>
              <div className="form-group">
                <label className="form-label">Paciente *</label>
                <select className="form-select" required value={form.pacienteId} onChange={e => handlePaciente(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {patients.filter(p => p.estado === 'activo').map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Hora</label>
                  <input className="form-input" type="time" value={form.hora} onChange={e => setForm({...form, hora: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-select" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                    <option value="entrada">Entrada (S/.180)</option>
                    <option value="paquete4">Paquete 4 (S/.650)</option>
                    <option value="sesion_suelta">Individual</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cerrar</button>
                <button type="submit" className="btn btn-primary">Agendar cita</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
