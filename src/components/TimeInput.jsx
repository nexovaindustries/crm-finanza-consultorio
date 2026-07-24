import { useState } from 'react';

function to12h(hora24) {
  if (!hora24) return { hh: '10', mm: '00', mer: 'AM' };
  const [h, m] = hora24.split(':').map(Number);
  const mer = h >= 12 ? 'PM' : 'AM';
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return { hh: String(hh).padStart(2, '0'), mm: String(m ?? 0).padStart(2, '0'), mer };
}

function to24h(hh, mm, mer) {
  let h = parseInt(hh, 10) || 0;
  h = h % 12;
  if (mer === 'PM') h += 12;
  const m = Math.min(parseInt(mm, 10) || 0, 59);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Input de hora tipeable (HH:MM + AM/PM) en vez del selector nativo tipo ruleta
export default function TimeInput({ value, onChange }) {
  const [hh, setHh] = useState(() => to12h(value).hh);
  const [mm, setMm] = useState(() => to12h(value).mm);
  const [mer, setMer] = useState(() => to12h(value).mer);

  const commit = (newHh, newMm, newMer) => onChange(to24h(newHh, newMm, newMer));

  const handleHh = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 2);
    setHh(v);
    if (v !== '') commit(v, mm, mer);
  };
  const handleMm = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMm(v);
    if (v !== '') commit(hh, v, mer);
  };
  const handleHhBlur = () => {
    let v = parseInt(hh, 10);
    if (isNaN(v) || v < 1) v = 12;
    if (v > 12) v = 12;
    const padded = String(v).padStart(2, '0');
    setHh(padded);
    commit(padded, mm, mer);
  };
  const handleMmBlur = () => {
    let v = parseInt(mm, 10);
    if (isNaN(v)) v = 0;
    if (v > 59) v = 59;
    const padded = String(v).padStart(2, '0');
    setMm(padded);
    commit(hh, padded, mer);
  };
  const setMeridiem = (m) => { setMer(m); commit(hh, mm, m); };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <input
        className="form-input"
        style={{ width: '52px', textAlign: 'center' }}
        inputMode="numeric"
        maxLength={2}
        value={hh}
        onChange={handleHh}
        onBlur={handleHhBlur}
        placeholder="10"
        aria-label="Hora"
      />
      <span>:</span>
      <input
        className="form-input"
        style={{ width: '52px', textAlign: 'center' }}
        inputMode="numeric"
        maxLength={2}
        value={mm}
        onChange={handleMm}
        onBlur={handleMmBlur}
        placeholder="00"
        aria-label="Minutos"
      />
      <div style={{ display: 'flex', gap: '2px', marginLeft: '4px' }}>
        <button type="button" className={`btn btn-sm ${mer === 'AM' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMeridiem('AM')}>AM</button>
        <button type="button" className={`btn btn-sm ${mer === 'PM' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMeridiem('PM')}>PM</button>
      </div>
    </div>
  );
}
