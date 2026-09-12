import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreditCardIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  CalendarIcon,
  HospitalIcon,
  ShieldCheckIcon,
  MenuIcon,
  CloseIcon,
} from '../../components/common/Icons'
import {
  getPaymentsApi,
  createPaymentOrderApi,
  getFriendlyErrorMessage,
  type PaymentRecord,
  type PaymentOrderResult,
} from '../../api/auth.api'
import { MockPaymentModal } from '../../components/payment/MockPaymentModal'
import { launchPaymentCheckout } from '../../utils/checkoutLauncher'
import './PatientPaymentsPage.css'

export type PatientPaymentsPageProps = {
  user?: {
    name?: string
    email?: string
    role?: string
  } | null
  onLogout: () => void
  onRequireAuth?: () => void
}

export const PatientPaymentsPage: React.FC<PatientPaymentsPageProps> = ({
  user,
  onLogout,
  onRequireAuth,
}) => {
  const navigate = useNavigate()
  const token = localStorage.getItem('helthgate_token') || ''

  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED'>('ALL')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Retry checkout modal state
  const [activeModal, setActiveModal] = useState<{
    paymentRecord: PaymentRecord
    orderInfo: PaymentOrderResult
    appointmentDetails: any
  } | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  useEffect(() => {
    if (!token && onRequireAuth) {
      onRequireAuth()
      return
    }
    fetchPayments()
  }, [token])

  const fetchPayments = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getPaymentsApi({}, token)
      if (res.success && res.payments) {
        setPayments(res.payments)
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'Failed to load payment records. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleRetryPayment = async (payment: PaymentRecord) => {
    setRetryingId(payment._id)
    setActionFeedback(null)
    try {
      const bookingId =
        typeof payment.bookingId === 'object' && payment.bookingId?._id
          ? payment.bookingId._id
          : String(payment.bookingId)

      // Create new payment order for this booking
      const res = await createPaymentOrderApi(bookingId, token)
      if (res.success && res.order) {
        const apptObj = typeof payment.bookingId === 'object' ? payment.bookingId : null
        const apptDetails = {
          doctorName: (apptObj?.doctor as any)?.user?.name || 'Doctor',
          specialization: (apptObj?.doctor as any)?.specialization || 'Consultation',
          hospitalName: (apptObj?.hospital as any)?.name || 'HealthGate Medical Practice',
          appointmentDate: apptObj?.appointmentDate,
          timeSlot: apptObj?.timeSlot,
          consultationType: apptObj?.type || 'In-Person',
        }

        await launchPaymentCheckout({
          paymentRecord: res.payment,
          orderInfo: res.order,
          appointmentDetails: apptDetails,
          user,
          token,
          onSuccess: async () => {
            setActionFeedback({ type: 'success', message: 'Payment confirmed successfully!' })
            await fetchPayments()
          },
          onFailure: async (_p, errMsg) => {
            setActionFeedback({ type: 'error', message: errMsg || 'Payment attempt was not completed.' })
            await fetchPayments()
          },
          onOpenMockModal: () => {
            setActiveModal({
              paymentRecord: res.payment,
              orderInfo: res.order,
              appointmentDetails: apptDetails,
            })
          },
        })
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: getFriendlyErrorMessage(err, 'Unable to initiate payment retry right now. Please try again.'),
      })
    } finally {
      setRetryingId(null)
    }
  }

  // Filtered payments
  const filteredPayments = payments.filter((p) => {
    if (statusFilter === 'ALL') return true
    return p.status === statusFilter
  })

  // Calculations for KPIs
  const successPayments = payments.filter((p) => p.status === 'SUCCESS')
  const totalSpent = successPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
  const failedCount = payments.filter((p) => p.status === 'FAILED').length
  const pendingCount = payments.filter((p) => p.status === 'PENDING').length

  return (
    <div className="ppp-page-layout">
      {/* Top Navigation */}
      <header className="ppp-navbar">
        <div className="ppp-nav-container">
          <div className="ppp-logo-wrap" onClick={() => navigate('/patient/home')}>
            <div className="ppp-logo-icon">
              <CreditCardIcon size={20} />
            </div>
            <span className="ppp-brand-name">HealthGate</span>
            <span className="ppp-brand-badge">Payments</span>
          </div>

          <nav className="ppp-nav-links">
            <button type="button" className="ppp-nav-link" onClick={() => navigate('/patient/home')}>
              Home Portal
            </button>
            <button
              type="button"
              className="ppp-nav-link"
              onClick={() => navigate('/patient/home#appointments')}
            >
              My Appointments
            </button>
            <button
              type="button"
              className="ppp-nav-link active"
              onClick={() => navigate('/patient/payments')}
            >
              Billing & History
            </button>
            <button type="button" className="ppp-nav-link" onClick={() => navigate('/profile')}>
              Profile
            </button>
          </nav>

          <div className="ppp-nav-user">
            <span className="ppp-user-greeting">Hi, {user?.name || 'Patient'}</span>
            <button type="button" className="ppp-btn-logout" onClick={onLogout}>
              Logout
            </button>
            <button
              type="button"
              className="ppp-mobile-toggle"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
            >
              {mobileNavOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div className="ppp-mobile-drawer">
            <button
              type="button"
              className="ppp-mobile-link"
              onClick={() => {
                setMobileNavOpen(false)
                navigate('/patient/home')
              }}
            >
              Home Portal
            </button>
            <button
              type="button"
              className="ppp-mobile-link"
              onClick={() => {
                setMobileNavOpen(false)
                navigate('/patient/home#appointments')
              }}
            >
              My Appointments
            </button>
            <button
              type="button"
              className="ppp-mobile-link active"
              onClick={() => setMobileNavOpen(false)}
            >
              Billing & History
            </button>
            <button
              type="button"
              className="ppp-mobile-link"
              onClick={() => {
                setMobileNavOpen(false)
                navigate('/profile')
              }}
            >
              My Profile
            </button>
            <button
              type="button"
              className="ppp-mobile-link logout"
              onClick={() => {
                setMobileNavOpen(false)
                onLogout()
              }}
            >
              Sign Out
            </button>
          </div>
        )}

        {mobileNavOpen && (
          <div
            className="ppp-mobile-backdrop"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}
      </header>

      {/* Main Content Area */}
      <main className="ppp-main">
        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div
            className={`ppp-feedback-banner ${actionFeedback.type}`}
            role="alert"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {actionFeedback.type === 'success' ? (
                <CheckCircleIcon size={18} />
              ) : (
                <AlertCircleIcon size={18} />
              )}
              <span>{actionFeedback.message}</span>
            </div>
            <button
              type="button"
              className="ppp-feedback-close"
              onClick={() => setActionFeedback(null)}
              aria-label="Dismiss message"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        )}

        {/* Page Header */}
        <section className="ppp-page-header">
          <div className="ppp-header-info">
            <span className="ppp-header-tag">Financial Transactions</span>
            <h1 className="ppp-page-title">Payment History & Billing</h1>
            <p className="ppp-page-desc">
              Review all consultation fees, transaction receipts, payment attempts, and retry failed
              bookings.
            </p>
          </div>

          <button
            type="button"
            className="ppp-btn-refresh"
            onClick={fetchPayments}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="hg-spinner" />
                Updating...
              </>
            ) : (
              'Refresh Records'
            )}
          </button>
        </section>

        {/* KPI Stats Bar */}
        <section className="ppp-kpi-grid">
          <div className="ppp-kpi-card total">
            <div className="ppp-kpi-icon total">
              <CreditCardIcon size={22} />
            </div>
            <div className="ppp-kpi-meta">
              <span className="ppp-kpi-label">Total Amount Paid</span>
              <span className="ppp-kpi-value">₹{totalSpent.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="ppp-kpi-card success">
            <div className="ppp-kpi-icon success">
              <CheckCircleIcon size={22} />
            </div>
            <div className="ppp-kpi-meta">
              <span className="ppp-kpi-label">Successful Payments</span>
              <span className="ppp-kpi-value">{successPayments.length}</span>
            </div>
          </div>

          <div className="ppp-kpi-card failed">
            <div className="ppp-kpi-icon failed">
              <AlertCircleIcon size={22} />
            </div>
            <div className="ppp-kpi-meta">
              <span className="ppp-kpi-label">Failed Attempts</span>
              <span className="ppp-kpi-value">{failedCount}</span>
            </div>
          </div>

          <div className="ppp-kpi-card pending">
            <div className="ppp-kpi-icon pending">
              <ClockIcon size={22} />
            </div>
            <div className="ppp-kpi-meta">
              <span className="ppp-kpi-label">Pending Verifications</span>
              <span className="ppp-kpi-value">{pendingCount}</span>
            </div>
          </div>
        </section>

        {/* Filter Pills */}
        <section className="ppp-filters-section">
          <div className="ppp-filter-tabs">
            <button
              type="button"
              className={`ppp-filter-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All Transactions ({payments.length})
            </button>
            <button
              type="button"
              className={`ppp-filter-tab ${statusFilter === 'SUCCESS' ? 'active success' : ''}`}
              onClick={() => setStatusFilter('SUCCESS')}
            >
              Successful ({successPayments.length})
            </button>
            <button
              type="button"
              className={`ppp-filter-tab ${statusFilter === 'PENDING' ? 'active pending' : ''}`}
              onClick={() => setStatusFilter('PENDING')}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              className={`ppp-filter-tab ${statusFilter === 'FAILED' ? 'active failed' : ''}`}
              onClick={() => setStatusFilter('FAILED')}
            >
              Failed ({failedCount})
            </button>
          </div>
        </section>

        {/* Payments List / States */}
        {loading ? (
          <div className="ppp-skeleton-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="ppp-skeleton-card">
                <div className="ppp-skeleton-row header"></div>
                <div className="ppp-skeleton-row body"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="ppp-error-card">
            <AlertCircleIcon size={36} />
            <h3>Unable to Load Payments</h3>
            <p>{error}</p>
            <button type="button" className="ppp-btn-primary" onClick={fetchPayments}>
              Try Again
            </button>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="ppp-empty-card">
            <div className="ppp-empty-icon">
              <CreditCardIcon size={42} />
            </div>
            <h3>No Payments Found</h3>
            <p>
              {statusFilter === 'ALL'
                ? 'You have not made any consultation payments yet. Once you schedule a doctor consultation and proceed with checkout, your records will appear here.'
                : `No transactions found with status "${statusFilter}".`}
            </p>
            <button
              type="button"
              className="ppp-btn-primary"
              onClick={() => navigate('/patient/home#doctors')}
            >
              Find a Doctor & Book
            </button>
          </div>
        ) : (
          <div className="ppp-payments-grid">
            {filteredPayments.map((p) => {
              const appt = typeof p.bookingId === 'object' ? p.bookingId : null
              const docName = (appt?.doctor as any)?.user?.name || 'Medical Specialist'
              const docSpec = (appt?.doctor as any)?.specialization || 'Consultation'
              const hospName = (appt?.hospital as any)?.name || 'HealthGate Medical Practice'
              const formattedDate = p.createdAt
                ? new Date(p.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                : 'Recent'

              const isSuccess = p.status === 'SUCCESS'
              const isFailed = p.status === 'FAILED'
              const isPending = p.status === 'PENDING'

              return (
                <div
                  key={p._id}
                  className={`ppp-payment-card ${isSuccess ? 'success' : isFailed ? 'failed' : 'pending'
                    }`}
                >
                  {/* Card Header */}
                  <div className="ppp-card-header">
                    <div className="ppp-card-title-group">
                      <span className={`ppp-status-badge ${p.status.toLowerCase()}`}>
                        {isSuccess && <CheckCircleIcon size={12} />}
                        {isFailed && <AlertCircleIcon size={12} />}
                        {isPending && <ClockIcon size={12} />}
                        {p.status}
                      </span>
                      <span className="ppp-provider-tag">
                        {p.provider === 'RAZORPAY' ? 'Razorpay' : 'Mock Gateway'}
                      </span>
                    </div>
                    <div className="ppp-card-amount">₹{p.amount}</div>
                  </div>

                  {/* Doctor & Appointment Details */}
                  <div className="ppp-card-doctor">
                    <div className="ppp-doc-avatar">
                      {docName.replace(/^Dr\.?\s*/i, '').charAt(0) || 'D'}
                    </div>
                    <div className="ppp-doc-info">
                      <h3 className="ppp-doc-name">{docName}</h3>
                      <span className="ppp-doc-spec">{docSpec}</span>
                    </div>
                  </div>

                  <div className="ppp-card-details">
                    <div className="ppp-detail-row">
                      <CalendarIcon size={14} />
                      <span>
                        Appt Date:{' '}
                        {appt?.appointmentDate
                          ? new Date(appt.appointmentDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                          : 'Scheduled Date'}{' '}
                        • {appt?.timeSlot || '10:00 AM'}
                      </span>
                    </div>

                    <div className="ppp-detail-row">
                      <HospitalIcon size={14} />
                      <span>{hospName}</span>
                    </div>

                    <div className="ppp-detail-row">
                      <ClockIcon size={14} />
                      <span>Transacted: {formattedDate}</span>
                    </div>
                  </div>

                  {/* Transaction Identifiers */}
                  <div className="ppp-card-identifiers">
                    <div className="ppp-id-row">
                      <span className="ppp-id-label">Order ID:</span>
                      <code className="ppp-id-code">{p.providerOrderId}</code>
                    </div>
                    {p.providerPaymentId && (
                      <div className="ppp-id-row">
                        <span className="ppp-id-label">Payment ID:</span>
                        <code className="ppp-id-code">{p.providerPaymentId}</code>
                      </div>
                    )}
                  </div>

                  {/* Failure Reason Alert */}
                  {isFailed && p.failureReason && (
                    <div className="ppp-failure-alert">
                      <AlertCircleIcon size={14} />
                      <span>Reason: {p.failureReason}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="ppp-card-actions">
                    {isFailed && (
                      <button
                        type="button"
                        className="ppp-btn-retry"
                        onClick={() => handleRetryPayment(p)}
                        disabled={retryingId === p._id}
                      >
                        {retryingId === p._id ? 'Preparing...' : 'Retry Payment Now'}
                      </button>
                    )}

                    {isSuccess && (
                      <span className="ppp-success-label">
                        <ShieldCheckIcon size={14} /> Appointment Confirmed
                      </span>
                    )}

                    {isPending && (
                      <button
                        type="button"
                        className="ppp-btn-pay"
                        onClick={() => handleRetryPayment(p)}
                        disabled={retryingId === p._id}
                      >
                        {retryingId === p._id ? 'Connecting...' : 'Complete Payment'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Checkout Modal for Retries or New Attempts */}
      {activeModal && (
        <MockPaymentModal
          isOpen={!!activeModal}
          onClose={() => {
            setActiveModal(null)
            fetchPayments()
          }}
          onSuccess={() => {
            setActiveModal(null)
            fetchPayments()
          }}
          onFailure={() => {
            fetchPayments()
          }}
          paymentRecord={activeModal.paymentRecord}
          orderInfo={activeModal.orderInfo}
          appointmentDetails={activeModal.appointmentDetails}
          token={token}
        />
      )}
    </div>
  )
}

export default PatientPaymentsPage
