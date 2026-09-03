import { useEffect } from 'react'

type HomePageProps = {
  user?: {
    name?: string
    email?: string
    role?: string
  } | null
  onLogout: () => void
  onRequireAuth: () => void
}

function HomePage({ user, onLogout, onRequireAuth }: HomePageProps) {
  useEffect(() => {
    const token = localStorage.getItem('helthgate_token')

    if (!token) {
      onRequireAuth()
    }
  }, [onRequireAuth])

  return (
    <main className="login-page">
      <section className="login-shell" style={{ gridTemplateColumns: '1fr' }}>
        <div className="form-panel" style={{ padding: '48px 32px' }}>
          <div className="form-header">
            <p className="welcome-tag">Welcome</p>
            <h2>HelthGate Home</h2>
          </div>

          <div className="status-message" style={{ marginBottom: '20px' }}>
            {user?.name ? `Signed in as ${user.name}` : 'You are signed in.'}
          </div>

          <div className="feature-list" style={{ marginTop: '0' }}>
            <li>Email: {user?.email || 'N/A'}</li>
            <li>Role: {user?.role || 'patient'}</li>
          </div>

          <button type="button" className="signin-button" onClick={onLogout} style={{ marginTop: '28px' }}>
            Logout
          </button>
        </div>
      </section>
    </main>
  )
}

export default HomePage
