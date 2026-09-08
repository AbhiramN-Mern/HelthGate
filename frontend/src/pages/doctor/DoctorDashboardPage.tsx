import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

type DoctorDashboardPageProps = {
  user?: {
    name?: string
    email?: string
  } | null
  onLogout: () => void
  onRequireAuth: () => void
}

function DoctorDashboardPage({ user, onLogout, onRequireAuth }: DoctorDashboardPageProps) {
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
            <p className="welcome-tag">Doctor dashboard</p>
            <h2>Welcome{user?.name ? `, Dr. ${user.name}` : ''}</h2>
          </div>
          <p className="status-message">Manage your professional profile and access your HelthGate workspace.</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '28px' }}>
            <button type="button" className="signin-button" onClick={() => navigate('/doctor/profile')}>
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

export default DoctorDashboardPage
