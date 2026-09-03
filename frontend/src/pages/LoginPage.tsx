import { useState } from 'react'
import type { FormEvent } from 'react'
import { loginUser } from '../api/auth.api'

type LoginPageProps = {
  onSuccess: (user: { name?: string; email?: string; role?: string }) => void
  onSwitchToRegister: () => void
}

function LoginPage({ onSuccess, onSwitchToRegister }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!email.trim() || !password.trim()) {
      setMessage('Please enter both email and password.')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const data = await loginUser({ email, password })
      const user = {
        name: data.user?.name || 'User',
        email: data.user?.email || email,
        role: data.user?.role || 'patient',
      }

      if (rememberMe) {
        localStorage.setItem('helthgate_token', data.token || 'demo-token')
        localStorage.setItem('helthgate_user', JSON.stringify(user))
      }

      onSuccess(user)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to sign in right now. Please try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="brand-panel">
          <div className="brand-badge">HG</div>
          <p className="eyebrow">Trusted healthcare access</p>
          <h1>HelthGate</h1>
          <p className="brand-copy">
            Secure patient and provider access to appointments, medical records,
            and care plans in one place.
          </p>

          <ul className="feature-list">
            <li>24/7 appointment care</li>
            <li>HIPAA-focused security</li>
            <li>Connected digital health support</li>
          </ul>
        </div>

        <div className="form-panel">
          <div className="form-header">
            <p className="welcome-tag">Welcome back</p>
            <h2>Sign in to your account</h2>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="input-group">
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
              />
            </label>

            <label className="input-group">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                aria-label="Password"
              />
            </label>

            <div className="form-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={() => setRememberMe((current) => !current)}
                />
                <span>Remember me</span>
              </label>

              <a href="#">Forgot password?</a>
            </div>

            {message ? <p className="status-message">{message}</p> : null}

            <button type="submit" className="signin-button" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="signup-link">
            Need an account? <a href="#" onClick={onSwitchToRegister}>Create one</a>
          </p>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
