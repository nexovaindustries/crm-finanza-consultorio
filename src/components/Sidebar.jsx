import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../utils';

const Icons = {
  Dashboard: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="17" rx="2.5"/>
      <path d="M16 2v4M8 2v4M3 9h18"/>
      <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none"/>
      <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  Patients: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="7" r="3.5"/>
      <path d="M2 20c0-3.866 3.134-7 7-7h.5"/>
      <circle cx="17" cy="15" r="3.5"/>
      <path d="M17 12.5v2.5l1.5 1.5"/>
    </svg>
  ),
  Appointments: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="17" rx="2.5"/>
      <path d="M16 2v4M8 2v4M3 9h18"/>
      <path d="M8 14h4M8 17h3"/>
    </svg>
  ),
  Payments: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="6" width="20" height="13" rx="2.5"/>
      <path d="M2 10h20"/>
      <circle cx="7" cy="15" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  Expenses: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  Reports: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 20V10M12 20V4M6 20v-6"/>
    </svg>
  ),
  Terms: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Logout: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

const nav = [
  { section: 'Principal', items: [
    { to: '/', label: 'Dashboard', Icon: Icons.Dashboard },
    { to: '/calendar', label: 'Calendario', Icon: Icons.Calendar },
  ]},
  { section: 'Gestión', items: [
    { to: '/patients', label: 'Pacientes', Icon: Icons.Patients },
    { to: '/appointments', label: 'Citas', Icon: Icons.Appointments },
    { to: '/payments', label: 'Cobros', Icon: Icons.Payments },
  ]},
  { section: 'Finanzas', items: [
    { to: '/expenses', label: 'Gastos', Icon: Icons.Expenses },
    { to: '/reports', label: 'Reportes', Icon: Icons.Reports },
  ]},
  { section: 'Sistema', items: [
    { to: '/terms', label: 'Términos y Condiciones', Icon: Icons.Terms },
    { to: '/settings', label: 'Configuración', Icon: Icons.Settings },
  ]},
];

export default function Sidebar() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img
          src="/logo.png"
          alt="Madurando Talentos"
          style={{ maxWidth: '100%', height: 'auto', maxHeight: '72px', display: 'block', margin: '0 auto' }}
        />
      </div>

      <nav className="sidebar-nav">
        {nav.map(section => (
          <div key={section.section}>
            <div className="nav-section-label">{section.section}</div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <item.Icon />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-badge">
          <div className="user-avatar">
            {getInitials(profile?.nombre || profile?.email || '?')}
          </div>
          <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
            <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.nombre || 'Usuario'}
            </p>
            <span>{profile?.rol === 'admin' ? 'Administrador' : 'Secretaria'}</span>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 8px', border: '1px solid rgba(224,82,82,0.3)',
              borderRadius: '6px', background: 'transparent', color: 'var(--danger)',
              fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(224,82,82,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Salir
          </button>
        </div>
      </div>
    </aside>
  );
}
