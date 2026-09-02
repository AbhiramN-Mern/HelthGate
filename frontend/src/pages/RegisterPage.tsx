import { useState } from 'react'
import type { FormEvent } from 'react'
import { registerUser } from '../api/auth.api'

function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!fullName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setMessage('Please fill in all fields.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const data = await registerUser({
        name: fullName,
        email,
        password,
      })

      setMessage(`Account created for ${data.user?.name || fullName}. You can now sign in to HelthGate.`)
      setFullName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to connect to the server. Please try again.',
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
          <p className="eyebrow">Your care, connected</p>
          <h1>HelthGate</h1>
          <p className="brand-copy">
            Create your secure account to manage appointments, access treatment
            plans, and stay informed about your health.
          </p>

          <ul className="feature-list">
            <li>Personalized health dashboard</li>
            <li>Appointment scheduling</li>
            <li>Secure medical communication</li>
          </ul>
        </div>

        <div className="form-panel">
          <div className="form-header">
            <p className="welcome-tag">Join now</p>
            <h2>Create your account</h2>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="input-group">
              <span>Full name</span>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="John Doe"
                aria-label="Full name"
              />
            </label>

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
                placeholder="Create a password"
                aria-label="Password"
              />
            </label>

            <label className="input-group">
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your password"
                aria-label="Confirm password"
              />
            </label>

            {message ? <p className="status-message">{message}</p> : null}

            <button type="submit" className="signin-button" disabled={isLoading}>
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="signup-link">
            Already have an account? <a href="#">Sign in</a>
          </p>
        </div>
      </section>
    </main>
  )
}

export default RegisterPage
