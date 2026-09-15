import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDoctorVerificationStatusApi, type AuthUser, type DoctorProfile } from '../../api/auth.api'

type DoctorPendingApprovalPageProps = {
  user: AuthUser | null
  onLogout: () => void
}

export const DoctorPendingApprovalPage: React.FC<DoctorPendingApprovalPageProps> = ({
  user,
  onLogout,
}) => {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<DoctorProfile | null>(null)
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>(
    user?.doctorApprovalStatus || 'pending'
  )
  const [isChecking, setIsChecking] = useState(false)
  const [checkMessage, setCheckMessage] = useState<string | null>(null)
  const [checkStatusType, setCheckStatusType] = useState<'info' | 'success' | 'warning'>('info')

  const fetchStatus = async (isManualCheck = false) => {
    const token = localStorage.getItem('helthgate_token')
    if (!token) {
      onLogout()
      return
    }

    if (isManualCheck) {
      setIsChecking(true)
      setCheckMessage(null)
    }

    try {
      const data = await getDoctorVerificationStatusApi(token)
      if (data.doctor) {
        setProfile(data.doctor)
      }

      if (data.isApproved || data.doctorApprovalStatus === 'approved' || data.verificationStatus === 'verified') {
        setStatus('approved')
        setCheckStatusType('success')
        setCheckMessage('Congratulations! Your doctor profile has been approved. Redirecting to your dashboard...')

        // Update stored user object
        const stored = localStorage.getItem('helthgate_user')
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            parsed.doctorApprovalStatus = 'approved'
            parsed.verificationStatus = 'verified'
            localStorage.setItem('helthgate_user', JSON.stringify(parsed))
          } catch {
            // Ignore parse errors
          }
        }

        setTimeout(() => {
          navigate('/doctor/dashboard', { replace: true })
        }, 1500)
        return
      }

      if (data.isRejected || data.doctorApprovalStatus === 'rejected') {
        setStatus('rejected')
        setCheckStatusType('warning')
        setCheckMessage('Your application was not approved by the administrator.')
        return
      }

      setStatus('pending')
      if (isManualCheck) {
        setCheckStatusType('info')
        setCheckMessage('Your application is still under review. Please check back shortly.')
      }
    } catch (err: any) {
      if (isManualCheck) {
        setCheckStatusType('warning')
        setCheckMessage(err?.message || 'Failed to check verification status. Please try again.')
      }
    } finally {
      if (isManualCheck) {
        setIsChecking(false)
      }
    }
  }

  useEffect(() => {
    void fetchStatus(false)
  }, [])

  return (
    <div className="doctor-pending-page" style={{ minHeight: '100vh', background: '#f8fafc', color: '#1e293b', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Bar */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0d5c63 0%, #14b8a6 100%)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '1.2rem',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            letterSpacing: '-0.5px'
          }}>
            HG
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>HelthGate</h1>
            <span style={{ fontSize: '0.75rem', color: '#0d5c63', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Doctor Credentialing Portal
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right', display: 'none', md: 'block' } as any}>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b' }}>
              {user?.name ? (user.name.startsWith('Dr.') ? user.name : `Dr. ${user.name}`) : 'Doctor'}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{user?.email}</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#64748b',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#e2e8f0')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#f1f5f9')}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{
          width: '100%',
          maxWidth: '680px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.06)',
          overflow: 'hidden',
        }}>
          {/* Card Header Banner */}
          <div style={{
            background: status === 'rejected'
              ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
              : status === 'approved'
              ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
              : 'linear-gradient(135deg, #0d5c63 0%, #0891b2 100%)',
            padding: '36px 32px',
            color: '#ffffff',
            textAlign: 'center',
            position: 'relative'
          }}>
            <div style={{
              width: '68px',
              height: '68px',
              margin: '0 auto 16px',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255, 255, 255, 0.4)'
            }}>
              {status === 'rejected' ? (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              ) : status === 'approved' ? (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              )}
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '12px'
            }}>
              {status === 'rejected'
                ? 'Registration Rejected'
                : status === 'approved'
                ? 'Account Approved'
                : '✓ Email Verified • Approval Pending'}
            </div>

            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.5px' }}>
              {status === 'rejected'
                ? 'Application Not Approved'
                : status === 'approved'
                ? 'Welcome to HealthGate'
                : 'Doctor Account Pending Approval'}
            </h2>

            <p style={{ fontSize: '0.95rem', margin: 0, opacity: 0.92, maxWidth: '520px', marginInline: 'auto', lineHeight: 1.5 }}>
              {status === 'rejected'
                ? 'Your doctor account application could not be verified or approved by the hospital administrators.'
                : status === 'approved'
                ? 'Your credentials have been verified. You can now access your patient consultations and schedule.'
                : 'Your email has been verified successfully. Your doctor account is currently pending admin approval. You will be able to access your dashboard after an administrator approves your account.'}
            </p>
          </div>

          {/* Card Body */}
          <div style={{ padding: '32px' }}>
            {/* Status Flash Message */}
            {checkMessage && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.88rem',
                fontWeight: 600,
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background:
                  checkStatusType === 'success'
                    ? '#ecfdf5'
                    : checkStatusType === 'warning'
                    ? '#fff1f2'
                    : '#f0f9ff',
                color:
                  checkStatusType === 'success'
                    ? '#065f46'
                    : checkStatusType === 'warning'
                    ? '#9f1239'
                    : '#0369a1',
                border: `1px solid ${
                  checkStatusType === 'success'
                    ? '#a7f3d0'
                    : checkStatusType === 'warning'
                    ? '#fecdd3'
                    : '#bae6fd'
                }`,
              }}>
                <span>{checkStatusType === 'success' ? '✓' : checkStatusType === 'warning' ? '✕' : 'ℹ'}</span>
                <span>{checkMessage}</span>
              </div>
            )}

            {/* Credentialing Process Steps */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                Onboarding Progress
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#10b981',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    flexShrink: 0
                  }}>
                    ✓
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                      Email Address Verified
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Your security OTP verification was completed for {user?.email}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: status === 'rejected' ? '#ef4444' : status === 'approved' ? '#10b981' : '#f59e0b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    flexShrink: 0
                  }}>
                    {status === 'rejected' ? '✕' : status === 'approved' ? '✓' : '2'}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                      {status === 'rejected'
                        ? 'Administrative Review: Rejected'
                        : status === 'approved'
                        ? 'Administrative Review: Approved'
                        : 'Administrative Review & License Verification'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {status === 'rejected'
                        ? 'Review completed. Registration rejected by hospital administrator.'
                        : status === 'approved'
                        ? 'Credentials verified and approved by HealthGate administration.'
                        : 'Hospital administrators are currently reviewing your medical license and qualifications.'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: status === 'approved' ? '#10b981' : '#e2e8f0',
                    color: status === 'approved' ? '#ffffff' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    flexShrink: 0
                  }}>
                    {status === 'approved' ? '✓' : '3'}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: status === 'approved' ? '#0f172a' : '#94a3b8' }}>
                      Dashboard & Consultation Access
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Unlocked automatically once your provider profile is approved.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Summary Card */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px 20px',
              marginBottom: '28px'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Application Details
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Applicant</span>
                  <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>
                    {user?.name ? (user.name.startsWith('Dr.') ? user.name : `Dr. ${user.name}`) : 'Doctor'}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Specialization</span>
                  <strong style={{ fontSize: '0.88rem', color: '#0d5c63' }}>
                    {profile?.specialization || 'Clinical Specialist'}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Qualifications</span>
                  <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>
                    {profile?.qualification || 'Medical Graduate'}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>License Number</span>
                  <strong style={{ fontSize: '0.88rem', color: '#1e293b', fontFamily: 'monospace' }}>
                    {profile?.licenseNumber || 'Under Review'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {status !== 'rejected' && (
                <button
                  type="button"
                  onClick={() => fetchStatus(true)}
                  disabled={isChecking}
                  style={{
                    padding: '12px 24px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    background: '#0d5c63',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: isChecking ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(13, 92, 99, 0.2)',
                    transition: 'all 0.2s',
                    opacity: isChecking ? 0.7 : 1,
                  }}
                  onMouseOver={(e) => {
                    if (!isChecking) e.currentTarget.style.background = '#0a494f'
                  }}
                  onMouseOut={(e) => {
                    if (!isChecking) e.currentTarget.style.background = '#0d5c63'
                  }}
                >
                  {isChecking ? (
                    <>
                      <span className="hg-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                      Checking Verification Status...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                      Check Approval Status
                    </>
                  )}
                </button>
              )}

              {status === 'rejected' && (
                <div style={{ textAlign: 'center', padding: '12px 0', color: '#64748b', fontSize: '0.86rem' }}>
                  If you believe this was an error or wish to appeal, please email <a href="mailto:support@healthgate.org" style={{ color: '#0d5c63', fontWeight: 600 }}>support@healthgate.org</a>.
                </div>
              )}

              <button
                type="button"
                onClick={onLogout}
                style={{
                  padding: '10px 20px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: '#64748b',
                  background: 'transparent',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Log Out of Account
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default DoctorPendingApprovalPage
