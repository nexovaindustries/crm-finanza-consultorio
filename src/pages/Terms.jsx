export default function Terms() {
  const sections = [
    {
      title: '1. Identificación del consultorio',
      content: 'Madurando Talentos es un consultorio de psicología clínica ubicado en Perú. Los servicios son prestados por profesionales debidamente colegiados y habilitados por el Colegio de Psicólogos del Perú.',
    },
    {
      title: '2. Servicios ofrecidos',
      content: 'El consultorio ofrece los siguientes servicios:\n\n• Sesión de entrada / evaluación inicial: S/. 180.00 (IGV incluido)\n• Paquete de 4 sesiones de terapia: S/. 650.00 (IGV incluido)\n• Sesiones individuales a tarifa acordada con el profesional\n\nLos precios están sujetos a cambios previo aviso.',
    },
    {
      title: '3. Política de cancelaciones y reprogramaciones',
      content: 'Las cancelaciones o reprogramaciones deben realizarse con al menos 24 horas de anticipación. De lo contrario, la sesión será contabilizada como realizada.\n\nCancelaciones dentro de las 24 horas previas o ausencias sin aviso (no-show) serán cobradas al 50% del valor de la sesión.',
      highlight: true,
    },
    {
      title: '4. Tolerancia de puntualidad',
      content: 'Se considera una tolerancia máxima de 10 minutos para el inicio de la sesión. Pasado ese tiempo, la sesión se considerará como cancelada y podrá ser cobrada según la política vigente.',
      highlight: true,
    },
    {
      title: '5. Política de pagos',
      content: 'Los pagos deben realizarse al inicio de cada sesión o según lo acordado con la psicóloga. Se emiten comprobantes de pago (boletas o facturas) por todos los servicios. El consultorio opera bajo el régimen tributario peruano con IGV al 18%.',
    },
    {
      title: '6. Confidencialidad y privacidad',
      content: 'Toda la información compartida durante las sesiones es estrictamente confidencial, conforme al Código de Ética del Colegio de Psicólogos del Perú. Los datos personales del paciente son almacenados de forma segura y no son compartidos con terceros sin consentimiento explícito, salvo obligación legal.',
    },
    {
      title: '7. Límites de la confidencialidad',
      content: 'La confidencialidad tiene excepciones legales y éticas: riesgo inminente para la vida del paciente o de terceros, maltrato o abuso de menores de edad, u orden judicial. En estos casos, el profesional actuará conforme a la normativa vigente.',
    },
    {
      title: '8. Consentimiento informado',
      content: 'Al iniciar el proceso terapéutico, el paciente (o su representante legal si es menor de edad) firma un documento de consentimiento informado donde acepta las condiciones del servicio, la política de privacidad y los términos aquí descritos.',
    },
    {
      title: '9. Uso del sistema de gestión',
      content: 'El sistema de gestión Madurando Talentos es de uso exclusivo del personal autorizado del consultorio. El acceso no autorizado está prohibido. Los datos de pacientes son protegidos conforme a la Ley N.° 29733 — Ley de Protección de Datos Personales del Perú.',
    },
    {
      title: '10. Modificaciones',
      content: 'El consultorio se reserva el derecho de modificar estos términos en cualquier momento. Las modificaciones serán notificadas con anticipación razonable a los pacientes activos.',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Términos y Condiciones</h2>
          <p style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: '4px' }}>
            Políticas y lineamientos del consultorio
          </p>
        </div>
      </div>

      {/* Directrices destacadas */}
      <div style={{
        background: 'var(--accent-glow)',
        border: '1.5px solid var(--accent)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        marginBottom: '24px',
        maxWidth: '860px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-dark)" strokeWidth="2.2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary-dark)' }}>
              Directrices del consultorio
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--primary-light)', marginTop: '1px' }}>
              Para una mejor organización de las agendas y respeto del tiempo de todos
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {/* Directriz 1 */}
          <div style={{
            background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '16px 18px',
            borderLeft: '3px solid var(--accent-dark)',
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary-dark)" strokeWidth="2.5">
                  <rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>
                  Cancelaciones y reprogramaciones
                </p>
                <p style={{ fontSize: '0.81rem', color: 'var(--text-2)', lineHeight: '1.55' }}>
                  Deben realizarse con al menos <strong>24 horas de anticipación</strong>. De lo contrario, la sesión será contabilizada.
                </p>
              </div>
            </div>
          </div>

          {/* Directriz 2 */}
          <div style={{
            background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '16px 18px',
            borderLeft: '3px solid var(--cyan)',
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', background: 'var(--cyan-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px',
                border: '1.5px solid var(--cyan)',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>
                  Tolerancia de puntualidad
                </p>
                <p style={{ fontSize: '0.81rem', color: 'var(--text-2)', lineHeight: '1.55' }}>
                  Máximo <strong>10 minutos</strong> de tolerancia al inicio de la sesión. Pasado ese tiempo, se considerará cancelada.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--primary-light)', fontStyle: 'italic', textAlign: 'right' }}>
          Gracias por la comprensión y por cuidar este espacio 💛
        </p>
      </div>

      {/* Términos completos */}
      <div className="card" style={{ maxWidth: '860px' }}>
        <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Versión 1.0 · Vigente desde mayo 2025
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text)' }}>
            Términos y Condiciones del Servicio — Consultorio Psicológico Madurando Talentos
          </h3>
        </div>

        {sections.map((section, i) => (
          <div
            key={i}
            style={{
              marginBottom: '20px',
              paddingLeft: section.highlight ? '14px' : '0',
              borderLeft: section.highlight ? '2px solid var(--accent)' : 'none',
            }}
          >
            <h4 style={{
              fontSize: '0.875rem', fontWeight: '700',
              color: section.highlight ? 'var(--accent-dark)' : 'var(--primary)',
              marginBottom: '6px',
            }}>
              {section.title}
            </h4>
            <p style={{ fontSize: '0.855rem', color: 'var(--text-2)', lineHeight: '1.7', whiteSpace: 'pre-line' }}>
              {section.content}
            </p>
          </div>
        ))}

        <div style={{
          marginTop: '24px', padding: '14px 16px',
          background: 'var(--bg-3)', borderRadius: 'var(--radius)',
          fontSize: '0.78rem', color: 'var(--text-3)',
        }}>
          Para consultas sobre estos términos, contactar a:{' '}
          <strong style={{ color: 'var(--text-2)' }}>madurando.talentos@gmail.com</strong>
        </div>
      </div>
    </div>
  );
}
