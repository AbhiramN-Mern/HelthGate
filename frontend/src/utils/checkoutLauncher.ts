import {
  verifyPaymentApi,
  type PaymentRecord,
  type PaymentOrderResult,
} from '../api/auth.api'

declare global {
  interface Window {
    Razorpay?: any
  }
}

export type LaunchCheckoutParams = {
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
  user?: {
    name?: string
    email?: string
    phone?: string
  } | null
  token: string
  onSuccess: (payment: PaymentRecord, appointment?: any) => void
  onFailure?: (payment: PaymentRecord, errorMsg?: string) => void
  onDismiss?: () => void
  onOpenMockModal?: () => void
}

/**
 * Ensures Razorpay checkout.js script is loaded in document
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

/**
 * Launch payment checkout flow:
 * - If provider is RAZORPAY (or keyId exists): opens official Razorpay Checkout popup with UPI QR, Cards, and Net Banking.
 * - If provider is MOCK: opens the interactive MockPaymentModal simulation.
 */
export const launchPaymentCheckout = async ({
  paymentRecord,
  orderInfo,
  appointmentDetails,
  user,
  token,
  onSuccess,
  onFailure,
  onDismiss,
  onOpenMockModal,
}: LaunchCheckoutParams) => {
  // If provider is RAZORPAY or a valid Razorpay key is present
  if (orderInfo.provider === 'RAZORPAY' && orderInfo.keyId) {
    const isLoaded = await loadRazorpayScript()
    if (!isLoaded || !window.Razorpay) {
      alert('Failed to load Razorpay payment gateway SDK. Falling back to test checkout.')
      if (onOpenMockModal) onOpenMockModal()
      return
    }

    const docTitle = appointmentDetails.doctorName || 'Doctor Consultation'
    const cleanAmountInSubunits = Math.round((orderInfo.amount || paymentRecord.amount || 500) * 100)

    const rzpOptions = {
      key: orderInfo.keyId,
      amount: cleanAmountInSubunits,
      currency: orderInfo.currency || 'INR',
      name: 'HealthGate Healthcare',
      description: `${docTitle} • Fee ₹${orderInfo.amount}`,
      image: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png',
      order_id: orderInfo.providerOrderId,
      handler: async function (response: {
        razorpay_payment_id: string
        razorpay_order_id: string
        razorpay_signature: string
      }) {
        try {
          // Server-side cryptographic HMAC SHA256 signature verification
          const verifyResult = await verifyPaymentApi(
            {
              paymentId: paymentRecord._id,
              providerOrderId: response.razorpay_order_id || orderInfo.providerOrderId,
              providerPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            },
            token,
          )

          if (verifyResult.success && verifyResult.payment) {
            onSuccess(verifyResult.payment, verifyResult.appointment)
          } else {
            if (onFailure && verifyResult.payment) {
              onFailure(verifyResult.payment, verifyResult.message)
            } else {
              alert(verifyResult.message || 'Payment verification failed.')
            }
          }
        } catch (err: any) {
          alert(err.message || 'Error communicating with server during payment verification.')
        }
      },
      prefill: {
        name: user?.name || '',
        email: user?.email || '',
        contact: user?.phone || '',
      },
      notes: {
        bookingId: String(paymentRecord.bookingId),
        paymentId: String(paymentRecord._id),
      },
      theme: {
        color: '#0d9488', // HealthGate teal theme
      },
      modal: {
        ondismiss: function () {
          console.log('Razorpay checkout window closed by patient')
          if (onDismiss) onDismiss()
        },
      },
    }

    const razorpayInstance = new window.Razorpay(rzpOptions)

    razorpayInstance.on('payment.failed', async function (response: any) {
      console.warn('Razorpay payment failed:', response.error)
      const errorMsg =
        response.error?.description ||
        response.error?.reason ||
        'Payment was declined by your bank or payment method.'

      try {
        const failResult = await verifyPaymentApi(
          {
            paymentId: paymentRecord._id,
            providerOrderId: orderInfo.providerOrderId,
            providerPaymentId: response.error?.metadata?.payment_id,
            simulateStatus: 'FAILED',
            failureReason: errorMsg,
          },
          token,
        )

        if (onFailure && failResult.payment) {
          onFailure(failResult.payment, errorMsg)
        }
      } catch (err) {
        console.error('Failed to register payment failure:', err)
      }
    })

    razorpayInstance.open()
  } else {
    // Mock Gateway flow
    if (onOpenMockModal) {
      onOpenMockModal()
    }
  }
}
