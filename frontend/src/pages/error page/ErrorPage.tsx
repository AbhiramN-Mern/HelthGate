import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './ErrorPage.css'

export type ErrorPageProps = {
  code?: number | string
  title?: string
  message?: string
  details?: string
  onRetry?: () => void
}

type LocationState = {
  code?: number | string
  title?: string
  message?: string
  details?: string
}

const ErrorPage: React.FC<ErrorPageProps> = ({
  code: propCode,
  title: propTitle,
  message: propMessage,
  details: propDetails,
  onRetry,
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as LocationState) || {}

  const [showDetails, setShowDetails] = useState(false)

  const code = propCode || state.code || 404
  const is404 = String(code) === '404'
  const is403 = String(code) === '403'

  const title =
    propTitle ||
    state.title ||
    (is404
      ? 'Page Not Found'
      : is403
      ? 'Access Denied'
      : 'Something Went Wrong')

  const message =
    propMessage ||
    state.message ||
    (is404
      ? "The page you are looking for doesn't exist or has been moved."
      : is403
      ? 'You do not have permission to access this resource.'
      : 'An unexpected error occurred while processing your request. Please try again or return home.')

  const details = propDetails || state.details

  const handleGoHome = () => {
    const token = localStorage.getItem('helthgate_token')
    const userStr = localStorage.getItem('helthgate_user')
    let role = ''
    try {
      if (userStr) {
        const u = JSON.parse(userStr)
        role = u.role || ''
      }
    } catch {
      // ignore
    }

    if (token) {
      if (role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/profile')
      }
    } else {
      navigate('/login')
    }
  }

  const handleReload = () => {
    if (onRetry) {
      onRetry()
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="error-page">
      <div className="error-card">
        <div className="error-badge-wrapper">
          <div className="error-icon-badge">
            {is404 ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
                <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" />
                <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" />
              </svg>
            ) : is403 ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3" />
              </svg>
            )}
          </div>
          <span className="error-code-chip">{code}</span>
        </div>

        <h1 className="error-title">{title}</h1>
        <p className="error-message">{message}</p>

        {details && (
          <>
            <button className="error-details-toggle" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? 'Hide technical details ▲' : 'Show technical details ▼'}
            </button>
            {showDetails && (
              <pre className="error-details-box">
                {details}
              </pre>
            )}
          </>
        )}

        <div className="error-actions">
          <button className="error-btn error-btn-primary" onClick={handleGoHome}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Return to Dashboard
          </button>
          <button className="error-btn error-btn-secondary" onClick={handleReload}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Try Again
          </button>
        </div>
      </div>
    </div>
  )
}

export default ErrorPage
