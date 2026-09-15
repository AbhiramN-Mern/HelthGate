import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loginPatientWithGoogle,
  getGoogleAuthUrlApi,
  getFriendlyErrorMessage,
} from '../api/auth.api'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential?: string }) => void
            error_callback?: (error: unknown) => void
            cancel_on_tap_outside?: boolean
            auto_select?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon'
              theme?: 'outline' | 'filled_blue' | 'filled_black'
              size?: 'large' | 'medium' | 'small'
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
              shape?: 'rectangular' | 'pill' | 'circle' | 'square'
              logo_alignment?: 'left' | 'center'
              width?: number | string
            },
          ) => void
          prompt: (notification?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void
          cancel: () => void
        }
      }
    }
  }
}

type GoogleAuthButtonProps = {
  onSuccess: (user: { name?: string; email?: string; role?: string }, token?: string) => void
  onError?: (errorMessage: string) => void
  label?: string
  disabled?: boolean
}

export default function GoogleAuthButton({
  onSuccess,
  onError,
  label = 'Continue with Google',
  disabled = false,
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [internalError, setInternalError] = useState('')
  const googleBtnContainerRef = useRef<HTMLDivElement>(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

  const handleCredentialVerification = useCallback(
    async (credential: string) => {
      setIsLoading(true)
      setInternalError('')

      try {
        const data = await loginPatientWithGoogle(credential)
        const authenticatedUser = {
          name: data.user?.name || 'Patient',
          email: data.user?.email || '',
          role: data.user?.role || 'patient',
        }

        localStorage.setItem('helthgate_token', data.token || 'demo-token')
        localStorage.setItem('helthgate_user', JSON.stringify(authenticatedUser))

        onSuccess(authenticatedUser, data.token)
      } catch (err: unknown) {
        const message = getFriendlyErrorMessage(
          err,
          'Google authentication failed. Please try again or use email sign in.',
        )
        setInternalError(message)
        if (onError) onError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [onSuccess, onError],
  )

  useEffect(() => {
    if (!googleClientId) return

    let isMounted = true

    const initializeGsi = () => {
      if (!window.google?.accounts?.id) return

      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            if (!isMounted) return
            if (response.credential) {
              handleCredentialVerification(response.credential)
            } else {
              setInternalError('Google credential was not returned. Please try again.')
            }
          },
          error_callback: (err: unknown) => {
            if (!isMounted) return
            const msg =
              err &&
              typeof err === 'object' &&
              'message' in err &&
              typeof (err as { message?: string }).message === 'string'
                ? (err as { message: string }).message
                : 'Google Sign-In was cancelled or failed.'
            setInternalError(msg)
          },
          cancel_on_tap_outside: true,
        })

        if (googleBtnContainerRef.current) {
          googleBtnContainerRef.current.innerHTML = ''
          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 320,
          })
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn('Google Identity Services initialization warning:', msg)
      }
    }

    if (window.google?.accounts?.id) {
      initializeGsi()
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval)
          initializeGsi()
        }
      }, 200)

      return () => {
        isMounted = false
        clearInterval(interval)
      }
    }

    return () => {
      isMounted = false
    }
  }, [googleClientId, handleCredentialVerification])

  const redirectToOAuth = async () => {
    try {
      setIsLoading(true)
      const data = await getGoogleAuthUrlApi()
      if (data?.url) {
        window.location.href = data.url
      } else {
        setInternalError('Failed to obtain Google login URL.')
        setIsLoading(false)
      }
    } catch (err: unknown) {
      const msg = getFriendlyErrorMessage(err, 'Failed to connect to Google authentication.')
      setInternalError(msg)
      setIsLoading(false)
    }
  }

  const handleCustomButtonClick = () => {
    if (isLoading || disabled) return
    setInternalError('')

    if (!googleClientId) {
      setInternalError(
        'Google Client ID is not configured. Please set VITE_GOOGLE_CLIENT_ID in the frontend environment.',
      )
      return
    }

    // Try prompt if GSI loaded, or fallback to direct OAuth redirect
    if (window.google?.accounts?.id) {
      try {
        let promptShown = false
        window.google.accounts.id.prompt((notification) => {
          if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
            redirectToOAuth()
          } else {
            promptShown = true
          }
        })
        setTimeout(() => {
          if (!promptShown) {
            redirectToOAuth()
          }
        }, 1500)
      } catch {
        redirectToOAuth()
      }
    } else {
      redirectToOAuth()
    }
  }

  return (
    <div className="google-auth-wrapper">
      {/* Visual HelthGate styled Google Button */}
      <button
        type="button"
        id="google-patient-auth-btn"
        className={`google-signin-btn ${isLoading ? 'btn-loading' : ''}`}
        onClick={handleCustomButtonClick}
        disabled={isLoading || disabled}
        aria-label="Continue with Google for patients"
      >
        {isLoading ? (
          <>
            <span className="hg-spinner" />
            <span>Verifying with Google...</span>
          </>
        ) : (
          <>
            <svg
              className="google-icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="google-btn-text">{label}</span>
            <span className="patient-only-badge">Patients Only</span>
          </>
        )}
      </button>

      {/* Hidden/Anchor container for official Google Identity Services button */}
      <div
        ref={googleBtnContainerRef}
        id="google-hidden-anchor"
        className="google-gsi-anchor"
        style={{ display: 'none' }}
      />

      {internalError ? <p className="status-message google-error-msg">{internalError}</p> : null}
    </div>
  )
}
