import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

type PatientDashboardPageProps = {
  user?: {
    name?: string
    email?: string
  } | null
  onLogout: () => void
  onRequireAuth: () => void
}

function PatientDashboardPage({ user, onLogout, onRequireAuth }: PatientDashboardPageProps) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!localStorage.getItem('helthgate_token')) {
      onRequireAuth()
    }
  }, [onRequireAuth])

  return (
    <main className="login-page">
      <section className="login-shell" style={{ gridTemplateColumns: '1fr' }}>
        <div className="form-panel" style={{ padding: '48px 32px' }}>
          <div className="form-header">
            <p className="welcome-tag">Patient dashboard</p>
            <h2>Welcome{user?.name ? `, ${user.name}` : ''}</h2>
          </div>
          <p className="status-message">Manage your healthcare profile and stay connected with your care team.</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '28px' }}>
            <button type="button" className="signin-button" onClick={() => navigate('/patient/profile')}>
              View profile
            </button>
            <button type="button" className="signin-button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

export default PatientDashboardPage
