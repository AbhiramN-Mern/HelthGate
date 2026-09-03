import { useState } from 'react'
import type { FormEvent } from 'react'
import { registerUser } from '../api/auth.api'

type RegisterPageProps = {
  onSuccess: (user: { name?: string; email?: string; role?: string }, token?: string) => void
  onSwitchToLogin: () => void
}

function RegisterPage({ onSuccess, onSwitchToLogin }: RegisterPageProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<'patient' | 'doctor'>('patient')
  const [specialization, setSpecialization] = useState('')
  const [qualification, setQualification] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
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

    if (role === 'doctor' && (!specialization.trim() || !qualification.trim() || !licenseNumber.trim())) {
      setMessage('Doctor profile requires specialization, qualification, and license number.')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const profile: Record<string, unknown> = {}

      if (role === 'doctor') {
        Object.assign(profile, {
          specialization,
          qualification,
          licenseNumber,
        })
      }

      const data = await registerUser({
        name: fullName,
        email,
        password,
        role,
        profile,
      })

      const user = {
        name: data.user?.name || fullName,
        email: data.user?.email || email,
        role: data.user?.role || role,
      }

      localStorage.setItem('helthgate_token', data.token || 'demo-token')
      localStorage.setItem('helthgate_user', JSON.stringify(user))
      onSuccess(user, data.token)
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
              <span>Account role</span>
              <select value={role} onChange={(event) => setRole(event.target.value as 'patient' | 'doctor')}>
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
              </select>
            </label>

            {role === 'doctor' ? (
              <>
                <label className="input-group">
                  <span>Specialization</span>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(event) => setSpecialization(event.target.value)}
                    placeholder="Cardiology"
                  />
                </label>

                <label className="input-group">
                  <span>Qualification</span>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(event) => setQualification(event.target.value)}
                    placeholder="MD, Cardiologist"
                  />
                </label>

                <label className="input-group">
                  <span>License number</span>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(event) => setLicenseNumber(event.target.value)}
                    placeholder="LIC-12345"
                  />
                </label>
              </>
            ) : null}

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
            Already have an account? <a href="#" onClick={onSwitchToLogin}>Sign in</a>
          </p>
        </div>
      </section>
    </main>
  )
}

export default RegisterPage
