import React, { useState } from 'react'
import {
  CreditCardIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  CloseIcon,
  ClockIcon,
  CalendarIcon,
  ShieldCheckIcon,
} from '../common/Icons'
import {
  verifyPaymentApi,
  retryPaymentApi,
  type PaymentRecord,
  type PaymentOrderResult,
} from '../../api/auth.api'
import './MockPaymentModal.css'

export type MockPaymentModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (payment: PaymentRecord, appointment?: any) => void
  onFailure?: (payment: PaymentRecord) => void
  paymentRecord: PaymentRecord
  orderInfo: PaymentOrderResult
  appointmentDetails: {
    doctorName?: string
    specialization?: string
    hospitalName?: string
    appointmentDate?: string
    timeSlot?: string
    consultationType?: string
  }
  token: string
}

const FAILURE_REASONS = [
  'Insufficient balance in customer bank account',
  'Payment declined by card issuing bank (Do Not Honor)',
  'Payment timed out at banking network gateway',
  'Transaction cancelled by patient',
  'Card expired or invalid CVV provided',
]

export const MockPaymentModal: React.FC<MockPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onFailure,
  paymentRecord,
  orderInfo,
  appointmentDetails,
  token,
}) => {
  const [currentPayment, setCurrentPayment] = useState<PaymentRecord>(paymentRecord)
  const [currentOrder, setCurrentOrder] = useState<PaymentOrderResult>(orderInfo)
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi')
  const [selectedFailureReason, setSelectedFailureReason] = useState<string>(FAILURE_REASONS[0])
  const [isCustomReason, setIsCustomReason] = useState(false)
  const [customReasonText, setCustomReasonText] = useState('')

  // Processing & result states
  const [processing, setProcessing] = useState(false)
  const [processingStage, setProcessingStage] = useState('')
  const [resultState, setResultState] = useState<'idle' | 'success' | 'failed'>('idle')
  const [resultMessage, setResultMessage] = useState('')
  const [errorDetails, setErrorDetails] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSimulatePayment = async (status: 'SUCCESS' | 'FAILED') => {
    setProcessing(true)
    setErrorDetails(null)
    setProcessingStage('Connecting to gateway...')

    try {
      await new Promise((resolve) => setTimeout(resolve, 600))
      setProcessingStage(
        status === 'SUCCESS' ? 'Authorizing payment token...' : 'Testing failure scenario...',
      )
      await new Promise((resolve) => setTimeout(resolve, 650))
      setProcessingStage('Verifying server signature & recording status...')

      const failureReason = isCustomReason && customReasonText.trim()
        ? customReasonText.trim()
        : selectedFailureReason

      const response = await verifyPaymentApi(
        {
          paymentId: currentPayment._id,
          providerOrderId: currentOrder.providerOrderId,
          simulateStatus: status,
          failureReason: status === 'FAILED' ? failureReason : undefined,
          mockToken: currentOrder.mockCheckoutToken,
        },
        token,
      )

      if (response.success && response.payment) {
        setCurrentPayment(response.payment)
        setResultState('success')
        setResultMessage(response.message || 'Payment confirmed and appointment scheduled!')
        onSuccess(response.payment, response.appointment)
      } else {
        if (response.payment) {
          setCurrentPayment(response.payment)
        }
        setResultState('failed')
        setResultMessage(response.message || 'Payment could not be completed.')
        setErrorDetails(response.message || 'Payment declined.')
        if (response.payment && onFailure) {
          onFailure(response.payment)
        }
      }
    } catch (err: any) {
      setResultState('failed')
      const msg = err.message || 'Network error during payment verification.'
      setResultMessage('Transaction Error')
      setErrorDetails(msg)
    } finally {
      setProcessing(false)
      setProcessingStage('')
    }
  }

  const handleRetryPayment = async () => {
    setProcessing(true)
    setProcessingStage('Creating new payment attempt order...')
    setErrorDetails(null)

    try {
      const response = await retryPaymentApi(currentPayment._id, token)
      setCurrentPayment(response.payment)
      setCurrentOrder(response.order)
      setResultState('idle')
      setResultMessage('')
    } catch (err: any) {
      setErrorDetails(err.message || 'Failed to initialize retry attempt.')
    } finally {
      setProcessing(false)
      setProcessingStage('')
    }
  }

  return (
    <div className="mpm-overlay" role="dialog" aria-modal="true">
      <div className="mpm-container">
        {/* Header */}
        <div className="mpm-header">
          <div className="mpm-header-title-wrap">
            <div className="mpm-gateway-badge">
              <span className="mpm-badge-dot"></span>
              {currentOrder.provider === 'RAZORPAY' ? 'Razorpay Secure' : 'HealthGate Mock Gateway'}
            </div>
            <h2 className="mpm-title">Complete Consultation Payment</h2>
          </div>
          <button
            type="button"
            className="mpm-close-btn"
            onClick={onClose}
            disabled={processing}
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="mpm-body">
          {/* Order & Appointment Summary Card */}
          <div className="mpm-summary-card">
            <div className="mpm-summary-row doctor-row">
              <div className="mpm-doc-avatar">
                {appointmentDetails.doctorName
                  ? appointmentDetails.doctorName.replace(/^Dr\.?\s*/i, '').charAt(0)
                  : 'D'}
              </div>
              <div className="mpm-doc-meta">
                <span className="mpm-doc-name">{appointmentDetails.doctorName || 'Specialist Doctor'}</span>
                <span className="mpm-doc-spec">
                  {appointmentDetails.specialization || 'Medical Consultation'} •{' '}
                  {appointmentDetails.hospitalName || 'HealthGate Health'}
                </span>
              </div>
            </div>

            <div className="mpm-summary-details">
              <div className="mpm-detail-pill">
                <CalendarIcon size={13} />
                <span>
                  {appointmentDetails.appointmentDate
                    ? new Date(appointmentDetails.appointmentDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Scheduled Date'}
                </span>
              </div>
              <div className="mpm-detail-pill">
                <ClockIcon size={13} />
                <span>{appointmentDetails.timeSlot || '10:00 AM'}</span>
              </div>
              <div className="mpm-detail-pill">
                <ShieldCheckIcon size={13} />
                <span>{appointmentDetails.consultationType || 'In-Person'}</span>
              </div>
            </div>

            <div className="mpm-cost-breakdown">
              <div className="mpm-cost-item">
                <span>Doctor Consultation Fee</span>
                <span className="mpm-cost-val">₹{currentPayment.amount}</span>
              </div>
              <div className="mpm-cost-item">
                <span>HealthGate Service & Booking Fee</span>
                <span className="mpm-cost-val free">₹0 (Waived)</span>
              </div>
              <div className="mpm-cost-total">
                <span>Total Amount Due</span>
                <span className="mpm-cost-total-val">₹{currentPayment.amount}</span>
              </div>
            </div>
          </div>

          {/* Processing Overlay State */}
          {processing && (
            <div className="mpm-processing-box">
              <div className="mpm-spinner"></div>
              <p className="mpm-processing-stage">{processingStage}</p>
              <p className="mpm-processing-sub">Please do not refresh or close this window.</p>
            </div>
          )}

          {/* SUCCESS State View */}
          {!processing && resultState === 'success' && (
            <div className="mpm-result-box success">
              <div className="mpm-result-icon success">
                <CheckCircleIcon size={38} />
              </div>
              <h3 className="mpm-result-title">Payment Successful!</h3>
              <p className="mpm-result-desc">{resultMessage}</p>
              <div className="mpm-tx-info">
                <div className="mpm-tx-row">
                  <span>Payment ID:</span>
                  <code>{currentPayment.providerPaymentId || 'pay_mock_verified'}</code>
                </div>
                <div className="mpm-tx-row">
                  <span>Order ID:</span>
                  <code>{currentPayment.providerOrderId}</code>
                </div>
                <div className="mpm-tx-row">
                  <span>Status:</span>
                  <span className="mpm-status-pill success">Confirmed</span>
                </div>
              </div>
              <div className="mpm-result-actions">
                <button
                  type="button"
                  className="mpm-primary-btn"
                  onClick={onClose}
                >
                  Done & View Appointments
                </button>
              </div>
            </div>
          )}

          {/* FAILED State View */}
          {!processing && resultState === 'failed' && (
            <div className="mpm-result-box failed">
              <div className="mpm-result-icon failed">
                <AlertCircleIcon size={38} />
              </div>
              <h3 className="mpm-result-title">Payment Failed</h3>
              <p className="mpm-result-desc">
                {errorDetails || resultMessage || 'Transaction could not be authorized.'}
              </p>
              <div className="mpm-tx-info">
                <div className="mpm-tx-row">
                  <span>Attempt Order:</span>
                  <code>{currentPayment.providerOrderId}</code>
                </div>
                <div className="mpm-tx-row">
                  <span>Failure Reason:</span>
                  <span className="mpm-reason-text">
                    {currentPayment.failureReason || errorDetails || 'Declined'}
                  </span>
                </div>
              </div>
              <p className="mpm-retry-hint">
                Your appointment is currently scheduled but remains unconfirmed until payment is completed.
                You can retry payment right now.
              </p>
              <div className="mpm-result-actions">
                <button
                  type="button"
                  className="mpm-primary-btn retry"
                  onClick={handleRetryPayment}
                >
                  Retry Payment Now
                </button>
                <button
                  type="button"
                  className="mpm-secondary-btn"
                  onClick={onClose}
                >
                  Close & Pay Later
                </button>
              </div>
            </div>
          )}

          {/* Checkout & Simulation View (Idle) */}
          {!processing && resultState === 'idle' && (
            <div className="mpm-checkout-flow">
              {/* Payment Method Selector */}
              <div className="mpm-methods-section">
                <label className="mpm-section-label">Select Payment Method</label>
                <div className="mpm-methods-grid">
                  <button
                    type="button"
                    className={`mpm-method-tab ${selectedMethod === 'upi' ? 'active' : ''}`}
                    onClick={() => setSelectedMethod('upi')}
                  >
                    <span className="mpm-method-icon">⚡</span>
                    <div className="mpm-method-text">
                      <span className="mpm-method-name">UPI / QR</span>
                      <span className="mpm-method-sub">GPay, PhonePe, Paytm</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`mpm-method-tab ${selectedMethod === 'card' ? 'active' : ''}`}
                    onClick={() => setSelectedMethod('card')}
                  >
                    <CreditCardIcon size={18} />
                    <div className="mpm-method-text">
                      <span className="mpm-method-name">Debit / Credit Card</span>
                      <span className="mpm-method-sub">Visa, Mastercard, RuPay</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`mpm-method-tab ${selectedMethod === 'netbanking' ? 'active' : ''}`}
                    onClick={() => setSelectedMethod('netbanking')}
                  >
                    <span className="mpm-method-icon">🏦</span>
                    <div className="mpm-method-text">
                      <span className="mpm-method-name">Net Banking</span>
                      <span className="mpm-method-sub">All Indian Banks</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Simulation Testing Panel */}
              <div className="mpm-simulation-panel">
                <div className="mpm-sim-header">
                  <span className="mpm-sim-badge">Mock Sandbox Simulation</span>
                  <span className="mpm-sim-sub">Test gateway scenarios safely</span>
                </div>

                <div className="mpm-sim-actions">
                  {/* Success Simulation Action */}
                  <button
                    type="button"
                    className="mpm-btn-simulate-success"
                    onClick={() => handleSimulatePayment('SUCCESS')}
                  >
                    <CheckCircleIcon size={16} /> Pay ₹{currentPayment.amount} (Simulate Success)
                  </button>

                  {/* Failure Simulation Section */}
                  <div className="mpm-failure-accordion">
                    <label className="mpm-sublabel">Or Test Failure Handling:</label>
                    <select
                      className="mpm-select-reason"
                      value={isCustomReason ? 'custom' : selectedFailureReason}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setIsCustomReason(true)
                        } else {
                          setIsCustomReason(false)
                          setSelectedFailureReason(e.target.value)
                        }
                      }}
                    >
                      {FAILURE_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                      <option value="custom">Custom Reason...</option>
                    </select>

                    {isCustomReason && (
                      <input
                        type="text"
                        className="mpm-custom-input"
                        placeholder="Enter simulated decline reason"
                        value={customReasonText}
                        onChange={(e) => setCustomReasonText(e.target.value)}
                      />
                    )}

                    <button
                      type="button"
                      className="mpm-btn-simulate-fail"
                      onClick={() => handleSimulatePayment('FAILED')}
                    >
                      <AlertCircleIcon size={16} /> Simulate Payment Failure
                    </button>
                  </div>
                </div>
              </div>

              {/* Security Trust Footer */}
              <div className="mpm-trust-footer">
                <ShieldCheckIcon size={14} />
                <span>256-Bit SSL Encrypted • Server-Verified Checkout • Safe Sandbox</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
