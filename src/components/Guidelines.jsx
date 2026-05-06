export default function Guidelines() {
  return (
    <div className="card" style={{ background: 'linear-gradient(145deg, var(--bg-2), var(--bg-3))', borderColor: 'var(--accent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <span style={{ fontSize: '24px' }}>📋</span>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text)' }}>
          Directrices de la Empresa
        </h3>
      </div>
      
      <div style={{ color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: '1.6' }}>
        <p style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--accent)' }}>
          Para una mejor organización de las agendas y respeto del tiempo de todos:
        </p>
        
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <li style={{ display: 'flex', gap: '10px' }}>
            <span style={{ color: 'var(--accent)' }}>•</span>
            <span>Las cancelaciones o reprogramaciones deben realizarse con al menos <strong>24 horas de anticipación</strong>. De lo contrario, la sesión será contabilizada.</span>
          </li>
          <li style={{ display: 'flex', gap: '10px' }}>
            <span style={{ color: 'var(--accent)' }}>•</span>
            <span>Se considera una <strong>tolerancia máxima de 10 minutos</strong> para el inicio de la sesión. Pasado ese tiempo, la sesión se considerará cancelada.</span>
          </li>
        </ul>
        
        <div style={{ marginTop: '20px', textAlign: 'right', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-3)' }}>
          Gracias por la comprensión y por cuidar este espacio 💛
        </div>
      </div>
    </div>
  );
}
