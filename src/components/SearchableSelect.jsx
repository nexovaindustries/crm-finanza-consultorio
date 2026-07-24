import { useState, useEffect, useRef } from 'react';

// Input tipeable con lista desplegable filtrada, para reemplazar selects largos.
// Asume que el componente se monta de nuevo cada vez que `value` cambia externamente
// (p.ej. al abrir un modal con un formulario reiniciado).
export default function SearchableSelect({ options, value, onChange, placeholder = 'Buscar...', required = false }) {
  const selected = options.find(o => o.id === value);
  const [query, setQuery] = useState(selected?.label || '');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = query.trim() === ''
    ? options
    : options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        className="form-input"
        required={required}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (value) onChange(''); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <div className="search-select-dropdown">
          {filtered.length === 0 ? (
            <div className="search-select-empty">Sin resultados</div>
          ) : filtered.map(o => (
            <div
              key={o.id}
              className="search-select-option"
              onClick={() => { onChange(o.id); setQuery(o.label); setOpen(false); }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
