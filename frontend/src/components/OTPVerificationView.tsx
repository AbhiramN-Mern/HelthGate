import React, { useState, useEffect, useRef } from 'react'
import { verifyOtpApi, resendOtpApi, getFriendlyErrorMessage } from '../api/auth.api'

type OTPVerificationViewProps = {
  email: string
  onSuccess: (user: { name?: string; email?: string; role?: string }, token?: string) => void
  onCancel: () => void
  initialMessage?: string
}

export const OTPVerificationView: React.FC<OTPVerificationViewProps> = ({
  email,
  onSuccess,
  onCancel,
  initialMessage,
}) => {
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState(initialMessage || '')
  const [cooldown, setCooldown] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-focus the first input on load
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return

    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [cooldown])

  const handleChange = (index: number, value: string) => {
    // Only accept numeric digits
    const cleaned = value.replace(/\D/g, '')

    // Handle single digit input
    const nextOtp = [...otp]
    nextOtp[index] = cleaned.slice(-1)
    setOtp(nextOtp)
    setErrorMessage('')

    // Move to next input box if a digit was entered
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // Move back to previous box on backspace if current is empty
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

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
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
  const isComplete = fullOtp.length === 6

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!isComplete) {
      setErrorMessage('Please enter all 6 digits of your verification code.')
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    setInfoMessage('')

    try {
      const response = await verifyOtpApi({
        email,
        otp: fullOtp,
      })

      const user = {
        name: response.user?.name || 'Patient',
        email: response.user?.email || email,
        role: response.user?.role || 'patient',
      }

      if (response.token) {
        localStorage.setItem('helthgate_token', response.token)
        localStorage.setItem('helthgate_user', JSON.stringify(user))
      }

      onSuccess(user, response.token)
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err, 'Invalid or expired verification code.'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return

    setIsResending(true)
    setErrorMessage('')
    setInfoMessage('')

    try {
      const res = await resendOtpApi({ email })
      setInfoMessage(res.message || 'A new verification code has been sent to your email.')
      setCooldown(res.cooldownSeconds || 60)
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err, 'Failed to resend verification code. Please try again.'))
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="otp-verification-container">
      <div className="otp-header">
        <div className="otp-icon-badge">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p className="welcome-tag">Security Verification</p>
        <h2>Verify Your Email</h2>
        <p className="otp-subtitle">
          We sent a 6-digit verification code to <strong className="otp-email-text">{email}</strong>.
          Enter the code below to complete your registration.
        </p>
      </div>

      <form onSubmit={handleVerify} className="otp-form">
        <div className="otp-input-row" onPaste={handlePaste}>
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
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={`otp-digit-box ${digit ? 'filled' : ''}`}
              aria-label={`Digit ${index + 1} of verification code`}
              autoComplete="one-time-code"
              disabled={isLoading}
            />
          ))}
        </div>

        <div className="otp-meta-row">
          <span className="otp-expiry-hint">⏱ Code expires in 10 minutes</span>
          <span className="otp-security-hint">Never share your OTP</span>
        </div>

        {infoMessage && <p className="otp-info-message">{infoMessage}</p>}
        {errorMessage && <p className="status-message">{errorMessage}</p>}

        <button
          type="submit"
          className={`signin-button ${isLoading ? 'btn-loading' : ''}`}
          disabled={isLoading || !isComplete}
        >
          {isLoading ? (
            <>
              <span className="hg-spinner" />
              Verifying Code...
            </>
          ) : (
            'Verify & Activate Account'
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
                onClick={handleResend}
                disabled={isResending}
                className="otp-resend-btn"
              >
                {isResending ? 'Sending...' : 'Resend Code'}
              </button>
            )}
          </p>
        </div>

        <div className="otp-back-wrapper">
          <button type="button" onClick={onCancel} className="otp-back-btn">
            &larr; Use a different email address
          </button>
        </div>
      </form>
    </div>
  )
}

export default OTPVerificationView
