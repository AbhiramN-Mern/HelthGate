import React, { useState, useEffect, useRef } from 'react'
import {
  forgotPasswordApi,
  verifyResetOtpApi,
  resendResetOtpApi,
  resetPasswordApi,
  getFriendlyErrorMessage,
} from '../api/auth.api'

type Step = 'EMAIL' | 'OTP' | 'NEW_PASSWORD' | 'SUCCESS'

type ForgotPasswordViewProps = {
  onBackToLogin: () => void
  onSuccess: (email: string) => void
  initialEmail?: string
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({
  onBackToLogin,
  onSuccess,
  initialEmail = '',
}) => {
  const [step, setStep] = useState<Step>('EMAIL')
  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', ''])
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [cooldown, setCooldown] = useState(60)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const newPasswordInputRef = useRef<HTMLInputElement | null>(null)

  // Focus on mount based on step
  useEffect(() => {
    if (step === 'EMAIL') {
      emailInputRef.current?.focus()
    } else if (step === 'OTP') {
      inputRefs.current[0]?.focus()
    } else if (step === 'NEW_PASSWORD') {
      newPasswordInputRef.current?.focus()
    }
  }, [step])

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return

    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [cooldown])

  // Step 1: Send OTP to email
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.')
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    setInfoMessage('')

    try {
      const res = await forgotPasswordApi({ email: trimmedEmail })
      setInfoMessage(res.message || 'If an account exists, a 6-digit code has been sent.')
      setCooldown(res.cooldownSeconds || 60)
      setOtp(['', '', '', '', '', ''])
      setStep('OTP')
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err, 'Failed to send reset code. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }

  // OTP box input handling
  const handleOtpChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '')
    const nextOtp = [...otp]
    nextOtp[index] = cleaned.slice(-1)
    setOtp(nextOtp)
    setErrorMessage('')

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const nextOtp = [...otp]
        nextOtp[index - 1] = ''
        setOtp(nextOtp)
        inputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, 6)
    if (!pastedData) return

    const nextOtp = [...otp]
    for (let i = 0; i < pastedData.length; i++) {
      nextOtp[i] = pastedData[i]
    }
    setOtp(nextOtp)
    setErrorMessage('')

    const targetIndex = Math.min(pastedData.length, 5)
    inputRefs.current[targetIndex]?.focus()
  }

  const fullOtp = otp.join('')
  const isOtpComplete = fullOtp.length === 6

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!isOtpComplete) {
      setErrorMessage('Please enter all 6 digits of your verification code.')
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    setInfoMessage('')

    try {
      const res = await verifyResetOtpApi({
        email: email.trim(),
        otp: fullOtp,
      })
      setResetToken(res.resetToken)
      setStep('NEW_PASSWORD')
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err, 'Invalid or expired verification code.'))
    } finally {
      setIsLoading(false)
    }
  }

  // Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || isResending) return

    setIsResending(true)
    setErrorMessage('')
    setInfoMessage('')

    try {
      const res = await resendResetOtpApi({ email: email.trim() })
      setInfoMessage(res.message || 'A new verification code has been sent to your email.')
      setCooldown(res.cooldownSeconds || 60)
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err, 'Failed to resend code. Please try again.'))
    } finally {
      setIsResending(false)
    }
  }

  // Step 3: Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newPassword.trim()) {
      setErrorMessage('Please enter a new password.')
      return
    }

    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    setInfoMessage('')

    try {
      await resetPasswordApi({
        email: email.trim(),
        resetToken,
        newPassword,
      })
      setStep('SUCCESS')
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err, 'Failed to reset password. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="forgot-password-container">
      {/* STEP 1: ENTER EMAIL */}
      {step === 'EMAIL' && (
        <>
          <div className="form-header">
            <div className="otp-icon-badge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p className="welcome-tag">Account Recovery</p>
            <h2>Forgot your password?</h2>
            <p className="otp-subtitle">
              Enter your registered patient email address and we'll send you a 6-digit verification code to reset your password.
            </p>
          </div>

          <form onSubmit={handleRequestOtp} className="login-form">
            <label className="input-group">
              <span>Email address</span>
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setErrorMessage('')
                }}
                placeholder="you@example.com"
                aria-label="Email address"
                disabled={isLoading}
                autoComplete="email"
                required
              />
            </label>

            {errorMessage && <p className="status-message">{errorMessage}</p>}

            <button
              type="submit"
              className={`signin-button ${isLoading ? 'btn-loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="hg-spinner" />
                  Sending Code...
                </>
              ) : (
                'Send Verification Code'
              )}
            </button>

            <div className="otp-back-wrapper">
              <button type="button" onClick={onBackToLogin} className="otp-back-btn">
                &larr; Back to Sign In
              </button>
            </div>
          </form>
        </>
      )}

      {/* STEP 2: VERIFY 6-DIGIT OTP */}
      {step === 'OTP' && (
        <>
          <div className="form-header">
            <div className="otp-icon-badge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <p className="welcome-tag">Security Verification</p>
            <h2>Enter Verification Code</h2>
            <p className="otp-subtitle">
              We sent a 6-digit verification code to <strong className="otp-email-text">{email}</strong>.
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="otp-form">
            <div className="otp-input-row" onPaste={handleOtpPaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className={`otp-digit-box ${digit ? 'filled' : ''}`}
                  aria-label={`Digit ${index + 1} of verification code`}
                  autoComplete="one-time-code"
                  disabled={isLoading}
                />
              ))}
            </div>

            <div className="otp-meta-row">
              <span className="otp-expiry-hint">⏱ Code expires in 10 minutes</span>
              <span className="otp-security-hint">Max 5 attempts</span>
            </div>

            {infoMessage && <p className="otp-info-message">{infoMessage}</p>}
            {errorMessage && <p className="status-message">{errorMessage}</p>}

            <button
              type="submit"
              className={`signin-button ${isLoading ? 'btn-loading' : ''}`}
              disabled={isLoading || !isOtpComplete}
            >
              {isLoading ? (
                <>
                  <span className="hg-spinner" />
                  Verifying Code...
                </>
              ) : (
                'Verify & Continue'
              )}
            </button>

            <div className="otp-resend-wrapper">
              <p className="otp-resend-text">
                Didn't receive the code?{' '}
                {cooldown > 0 ? (
                  <span className="otp-cooldown-timer">Resend available in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isResending}
                    className="otp-resend-btn"
                  >
                    {isResending ? 'Sending...' : 'Resend Code'}
                  </button>
                )}
              </p>
            </div>

            <div className="otp-back-wrapper">
              <button
                type="button"
                onClick={() => {
                  setStep('EMAIL')
                  setErrorMessage('')
                  setInfoMessage('')
                }}
                className="otp-back-btn"
              >
                &larr; Use a different email address
              </button>
            </div>
          </form>
        </>
      )}

      {/* STEP 3: SET NEW PASSWORD */}
      {step === 'NEW_PASSWORD' && (
        <>
          <div className="form-header">
            <div className="otp-icon-badge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </div>
            <p className="welcome-tag">Password Reset</p>
            <h2>Set New Password</h2>
            <p className="otp-subtitle">
              Identity verified for <strong className="otp-email-text">{email}</strong>. Choose a strong, memorable password.
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="login-form">
            <label className="input-group">
              <span>New Password</span>
              <div className="password-input-wrapper">
                <input
                  ref={newPasswordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    setErrorMessage('')
                  }}
                  placeholder="At least 6 characters"
                  aria-label="New password"
                  disabled={isLoading}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <label className="input-group">
              <span>Confirm New Password</span>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setErrorMessage('')
                  }}
                  placeholder="Re-enter your new password"
                  aria-label="Confirm new password"
                  disabled={isLoading}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {newPassword && confirmPassword && (
              <div className="password-match-hint">
                {newPassword === confirmPassword ? (
                  <span className="match-ok">✓ Passwords match</span>
                ) : (
                  <span className="match-fail">✕ Passwords do not match</span>
                )}
              </div>
            )}

            {errorMessage && <p className="status-message">{errorMessage}</p>}

            <button
              type="submit"
              className={`signin-button ${isLoading ? 'btn-loading' : ''}`}
              disabled={isLoading || !newPassword || newPassword !== confirmPassword}
            >
              {isLoading ? (
                <>
                  <span className="hg-spinner" />
                  Updating Password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        </>
      )}

      {/* STEP 4: SUCCESS CONFIRMATION */}
      {step === 'SUCCESS' && (
        <div className="reset-success-card">
          <div className="success-icon-badge">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="welcome-tag">All Done</p>
          <h2>Password Reset Successful!</h2>
          <p className="otp-subtitle">
            Your patient account password has been updated securely. You can now sign in with your new credentials.
          </p>

          <button
            type="button"
            className="signin-button"
            onClick={() => onSuccess(email)}
          >
            Proceed to Sign In &rarr;
          </button>
        </div>
      )}
    </div>
  )
}

export default ForgotPasswordView
