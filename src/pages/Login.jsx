import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError('Correo o contraseña incorrectos. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '20px',
    }}>
      {/* Left accent strip */}
      <div style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: '4px',
        background: 'linear-gradient(to bottom, var(--accent), var(--cyan))',
      }} />

      <div style={{ width: '100%', maxWidth: '380px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <img
            src="/logo.png"
            alt="Madurando Talentos"
            style={{ maxHeight: '80px', maxWidth: '220px', margin: '0 auto 8px', display: 'block' }}
          />
          <p style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: '6px', letterSpacing: '0.02em' }}>
            Sistema de gestión interno
          </p>
        </div>

        <div className="card" style={{ padding: '32px', boxShadow: 'var(--shadow-lg)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '22px', color: 'var(--text)' }}>
            Iniciar sesión
          </h2>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '16px', fontSize: '0.82rem' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <input
                className="form-input"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-accent"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: '10px', padding: '12px', fontSize: '0.9rem' }}
            >
              {loading ? 'Ingresando...' : 'Ingresar al sistema'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.72rem', color: 'var(--text-3)' }}>
          © 2025 Madurando Talentos · Uso interno
        </p>
      </div>
    </div>
  );
}
