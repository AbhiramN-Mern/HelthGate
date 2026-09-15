import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { loginUser, getFriendlyErrorMessage } from '../api/auth.api'
import GoogleAuthButton from '../components/GoogleAuthButton'

type LoginPageProps = {
  onSuccess: (user: { name?: string; email?: string; role?: string }, token?: string) => void
  onSwitchToRegister: () => void
}

function LoginPage({ onSuccess, onSwitchToRegister }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [message, setMessage] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlError = params.get('error')
      return urlError ? decodeURIComponent(urlError) : ''
    }
    return ''
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const googleToken = params.get('google_token')
    const googleUserData = params.get('google_user')
    const urlError = params.get('error')

    if (urlError) {
      window.history.replaceState({}, document.title, window.location.pathname)
      return
    }

    if (googleToken && googleUserData) {
      try {
        const parsedUser = JSON.parse(decodeURIComponent(googleUserData))
        localStorage.setItem('helthgate_token', googleToken)
        localStorage.setItem('helthgate_user', JSON.stringify(parsedUser))
        window.history.replaceState({}, document.title, window.location.pathname)
        onSuccess(parsedUser, googleToken)
      } catch (e) {
        console.error('Failed to parse Google user payload from redirect', e)
      }
    }
  }, [onSuccess])

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

      onSuccess(user, data.token)
    } catch (error) {
      setMessage(getFriendlyErrorMessage(error, 'Invalid email or password. Please verify your credentials and try again.'))
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

          <div className="patient-google-block">
            <GoogleAuthButton
              onSuccess={onSuccess}
              label="Continue with Google"
            />
          </div>

          <div className="auth-divider">
            <span>or sign in with email</span>
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

            <button
              type="submit"
              className={`signin-button ${isLoading ? 'btn-loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="hg-spinner" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
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
