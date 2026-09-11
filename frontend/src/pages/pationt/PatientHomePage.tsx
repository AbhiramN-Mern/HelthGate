import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getMyPatientProfile,
  getSpecializations,
  getAvailableDoctors,
  getHospitals,
  getMyAppointments,
  getDoctorBookedSlotsApi,
  respondAppointmentRescheduleApi,
  getPatientNotificationsApi,
  markPatientNotificationReadApi,
  createPaymentOrderApi,
  type AuthUser,
  type PatientProfile,
  type DoctorProfile,
  type Hospital,
  type AppointmentItem,
  type NotificationItem,
  type PaymentRecord,
  type PaymentOrderResult,
} from '../../api/auth.api'
import {
  SearchIcon,
  CalendarIcon,
  ClockIcon,
  HospitalIcon,
  StethoscopeIcon,
  HeartPulseIcon,
  UserIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  BlockedIcon,
  CloseIcon,
  MedicalCrossIcon,
  ShieldCheckIcon,
  BellIcon,
  MenuIcon,
  CreditCardIcon,
} from '../../components/common/Icons'
import { MockPaymentModal } from '../../components/payment/MockPaymentModal'
import { launchPaymentCheckout } from '../../utils/checkoutLauncher'
import './PatientHomePage.css'

type PatientHomePageProps = {
  user?: AuthUser | null
  onLogout: () => void
  onRequireAuth: () => void
}

const getSpecIcon = (specName: string) => {
  const key = specName.toLowerCase().trim()
  if (key.includes('cardio')) return <HeartPulseIcon size={18} />
  if (key.includes('pediat') || key.includes('gynec')) return <HeartPulseIcon size={18} />
  if (key.includes('neuro') || key.includes('psych') || key.includes('ortho')) return <StethoscopeIcon size={18} />
  return <MedicalCrossIcon size={18} />
}

export const MAX_BOOKING_DAYS_AHEAD = Number(import.meta.env.VITE_MAX_BOOKING_DAYS_AHEAD) || 90

export const getTodayAndMaxDates = (maxDays: number = MAX_BOOKING_DAYS_AHEAD) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const maxDate = new Date(today.getTime() + maxDays * 24 * 60 * 60 * 1000)
  const maxDateStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`
  return { today, todayStr, maxDate, maxDateStr }
}

export type BookingSuccessDetails = {
  doctor: DoctorProfile
  appointmentDate: string
  timeSlot: string
  reason: string
  appointmentId?: string
  hospitalName?: string
  department?: string
  type?: string
  paymentDetails?: {
    paymentId?: string
    providerPaymentId?: string
    providerOrderId?: string
    amount?: number
    status?: string
    provider?: string
    paidAt?: string
  }
}

function PatientHomePage({ user, onLogout, onRequireAuth }: PatientHomePageProps) {
  const navigate = useNavigate()
  const token = localStorage.getItem('helthgate_token') || ''

  // Backend Profile State
  const [profile, setProfile] = useState<PatientProfile | null>(null)

  // Real Database Data States (NO fallback dummy arrays!)
  const [specializations, setSpecializations] = useState<string[]>([])
  const [doctors, setDoctors] = useState<DoctorProfile[]>([])
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])

  // Loading States
  const [loadingSpecs, setLoadingSpecs] = useState(true)
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [loadingHospitals, setLoadingHospitals] = useState(true)

  // Error States
  const [doctorsError, setDoctorsError] = useState<string | null>(null)

  // Search & Filter States
  const [searchInput, setSearchInput] = useState('')
  const [selectedSpec, setSelectedSpec] = useState('')
  const [selectedHospital, setSelectedHospital] = useState('')

  // Booking Modal State
  const [bookingDoctor, setBookingDoctor] = useState<DoctorProfile | null>(null)
  const [bookingDate, setBookingDate] = useState('')
  const [bookingTime, setBookingTime] = useState('10:00 AM')
  const [bookingReason, setBookingReason] = useState('')
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingFeedback, setBookingFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [calMonth, setCalMonth] = useState<Date>(new Date())
  const [bookedSlotsByDate, setBookedSlotsByDate] = useState<Record<string, string[]>>({})

  // Booking Success Message Modal State
  const [bookingSuccessModal, setBookingSuccessModal] = useState<BookingSuccessDetails | null>(null)

  // Patient Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Reschedule Response State
  const [respondingApptId, setRespondingApptId] = useState<string | null>(null)
  const [rescheduleFeedback, setRescheduleFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Payment Notice / Retry Banner State
  const [paymentNotice, setPaymentNotice] = useState<{ type: 'warning' | 'info' | 'success'; text: string } | null>(null)

  // Payment Checkout Modal State
  const [checkoutModal, setCheckoutModal] = useState<{
    paymentRecord: PaymentRecord
    orderInfo: PaymentOrderResult
    appointmentDetails: any
    bookingDetails?: BookingSuccessDetails
  } | null>(null)
  const [payingApptId, setPayingApptId] = useState<string | null>(null)

  // Appointment History Visibility State (hidden by default, only shown on click, can be hidden after)
  const [showHistory, setShowHistory] = useState(false)

  // Appointment History Filter State ('all' | 'completed' | 'cancelled')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'cancelled'>('all')

  // Helper to determine if an appointment is in the past
  const isAppointmentPast = (appt: AppointmentItem): boolean => {
    if (appt.status === 'completed' || appt.status === 'cancelled') {
      return true
    }
    if (!appt.appointmentDate) return false

    const dateParts = String(appt.appointmentDate).split('T')[0].split('-')
    if (dateParts.length !== 3) {
      const parsed = new Date(appt.appointmentDate)
      return isNaN(parsed.getTime()) ? false : parsed.getTime() < Date.now()
    }

    const year = parseInt(dateParts[0], 10)
    const month = parseInt(dateParts[1], 10) - 1
    const day = parseInt(dateParts[2], 10)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const apptDay = new Date(year, month, day)
    apptDay.setHours(0, 0, 0, 0)

    // If appointment day is strictly prior to today, it belongs to past history
    return apptDay.getTime() < today.getTime()
  }

  // Partition appointments into upcoming and past
  const upcomingAppointments = appointments
    .filter((a) => !isAppointmentPast(a))
    .sort((a, b) => {
      const da = a.appointmentDate ? new Date(a.appointmentDate).getTime() : 0
      const db = b.appointmentDate ? new Date(b.appointmentDate).getTime() : 0
      return da - db
    })

  const pastAppointments = appointments
    .filter((a) => isAppointmentPast(a))
    .sort((a, b) => {
      const da = a.appointmentDate ? new Date(a.appointmentDate).getTime() : 0
      const db = b.appointmentDate ? new Date(b.appointmentDate).getTime() : 0
      return db - da
    })

  const completedCount = pastAppointments.filter((a) => a.status === 'completed').length
  const cancelledCount = pastAppointments.filter((a) => a.status === 'cancelled').length

  const filteredPastAppointments = pastAppointments.filter((a) => {
    if (historyFilter === 'completed') return a.status === 'completed'
    if (historyFilter === 'cancelled') return a.status === 'cancelled'
    return true
  })

  // Fetch doctor's booked slots whenever bookingDoctor or calMonth changes
  useEffect(() => {
    if (!bookingDoctor?._id || !token) {
      setBookedSlotsByDate({})
      return
    }

    const year = calMonth.getFullYear()
    const month = String(calMonth.getMonth() + 1).padStart(2, '0')
    const monthStr = `${year}-${month}`

    let isMounted = true
    getDoctorBookedSlotsApi(bookingDoctor._id, { month: monthStr }, token)
      .then((data) => {
        if (isMounted && data.bookedSlotsByDate) {
          setBookedSlotsByDate(data.bookedSlotsByDate)
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch doctor booked slots:', err)
      })

    return () => {
      isMounted = false
    }
  }, [bookingDoctor, calMonth, token])

  // 1. Initial Load: Check Auth & Fetch Data
  useEffect(() => {
    if (!token) {
      onRequireAuth()
      return
    }

    // Fetch user profile from backend
    fetchProfile()

    // Fetch specializations from backend
    fetchSpecializations()

    // Fetch hospitals from backend
    fetchHospitals()

    // Fetch patient's actual appointments from backend
    fetchAppointments()

    // Fetch patient's notifications
    fetchNotifications()
  }, [token])

  // 2. Fetch Doctors on filter changes
  useEffect(() => {
    if (token) {
      fetchDoctors()
    }
  }, [token, selectedSpec, selectedHospital])

  // API Call Handlers
  const fetchProfile = async () => {
    try {
      const res = await getMyPatientProfile(token)
      if (res.patient) {
        setProfile(res.patient)
      }
    } catch (err) {
      console.warn('Unable to load backend profile:', err)
    }
  }

  const fetchSpecializations = async () => {
    setLoadingSpecs(true)
    try {
      const res = await getSpecializations()
      setSpecializations(res.specializations || [])
    } catch (err) {
      console.warn('Failed to load specializations:', err)
    } finally {
      setLoadingSpecs(false)
    }
  }

  const fetchHospitals = async () => {
    setLoadingHospitals(true)
    try {
      const res = await getHospitals(token)
      setHospitals(res.hospitals || [])
    } catch (err) {
      console.warn('Failed to load hospitals:', err)
    } finally {
      setLoadingHospitals(false)
    }
  }

  const fetchAppointments = async () => {
    try {
      const res = await getMyAppointments(token)
      setAppointments(res.appointments || [])
    } catch (err) {
      console.warn('Failed to load appointments:', err)
    }
  }

  const fetchNotifications = async () => {
    if (!token) return
    try {
      const res = await getPatientNotificationsApi(token)
      if (res.notifications) {
        setNotifications(res.notifications)
      }
    } catch (err) {
      console.warn('Failed to load patient notifications:', err)
    }
  }

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await markPatientNotificationReadApi(id, token)
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)))
    } catch (err) {
      console.warn('Failed to mark notification as read:', err)
    }
  }

  const handleRespondReschedule = async (appointmentId: string, action: 'accept' | 'decline') => {
    setRespondingApptId(appointmentId)
    setRescheduleFeedback(null)
    try {
      const res = await respondAppointmentRescheduleApi(appointmentId, action, token)
      if (res.appointment) {
        const updated = res.appointment
        setAppointments((prev) => prev.map((a) => (a._id === updated._id ? updated : a)))
      }
      setRescheduleFeedback({
        type: 'success',
        text:
          action === 'accept'
            ? 'Appointment rescheduled successfully! Your new appointment date and time are confirmed.'
            : 'Reschedule request declined. Your original appointment date and time remain unchanged.',
      })
      fetchNotifications()
    } catch (err) {
      setRescheduleFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to respond to reschedule request',
      })
    } finally {
      setRespondingApptId(null)
      setTimeout(() => {
        setRescheduleFeedback(null)
      }, 6000)
    }
  }

  const handleInitiatePayment = async (appointmentId: string, customApptDetails?: any) => {
    setPayingApptId(appointmentId)
    try {
      const res = await createPaymentOrderApi(appointmentId, token)
      if (res.success && res.order) {
        const appt = appointments.find((a) => a._id === appointmentId)
        const apptDetails = customApptDetails || {
          doctorName: appt?.doctor?.user?.name || 'Doctor',
          specialization: appt?.doctor?.specialization || 'Consultation',
          hospitalName: (appt?.hospital as any)?.name || 'HealthGate Medical Practice',
          appointmentDate: appt?.appointmentDate,
          timeSlot: appt?.timeSlot,
          consultationType: appt?.type || 'In-Person Consultation',
        }

        await launchPaymentCheckout({
          paymentRecord: res.payment,
          orderInfo: res.order,
          appointmentDetails: apptDetails,
          user,
          token,
          onSuccess: async (verifiedPayment) => {
            await fetchAppointments()
            await fetchNotifications()
            setPaymentNotice({
              type: 'success',
              text: `Payment of ₹${verifiedPayment.amount} confirmed! Your appointment is now confirmed.`,
            })
            if (appt?.doctor) {
              setBookingSuccessModal({
                doctor: appt.doctor,
                appointmentDate: appt.appointmentDate ? String(appt.appointmentDate) : '',
                timeSlot: appt.timeSlot || '10:00 AM',
                reason: appt.reason || 'General Consultation',
                appointmentId: appt._id,
                hospitalName: (appt.hospital as any)?.name || 'HealthGate Medical Practice',
                department: appt.department || '',
                type: appt.type || 'In-Person Consultation',
                paymentDetails: {
                  paymentId: verifiedPayment._id,
                  providerPaymentId: verifiedPayment.providerPaymentId,
                  providerOrderId: verifiedPayment.providerOrderId,
                  amount: verifiedPayment.amount,
                  status: verifiedPayment.status,
                  provider: verifiedPayment.provider,
                  paidAt: new Date().toISOString(),
                },
              })
            }
          },
          onFailure: async (_failedPayment, errorMsg) => {
            await fetchAppointments()
            setPaymentNotice({
              type: 'warning',
              text: `Payment could not be completed (${errorMsg || 'Transaction cancelled or declined'}). You can retry payment anytime.`,
            })
          },
          onDismiss: async () => {
            await fetchAppointments()
            setPaymentNotice({
              type: 'info',
              text: 'Payment checkout was closed. Your appointment remains Pending Payment.',
            })
          },
          onOpenMockModal: () => {
            setCheckoutModal({
              paymentRecord: res.payment,
              orderInfo: res.order,
              appointmentDetails: apptDetails,
              bookingDetails: appt?.doctor
                ? {
                    doctor: appt.doctor,
                    appointmentDate: appt.appointmentDate ? String(appt.appointmentDate) : '',
                    timeSlot: appt.timeSlot || '10:00 AM',
                    reason: appt.reason || 'General Consultation',
                    appointmentId: appt._id,
                    hospitalName: (appt.hospital as any)?.name || 'HealthGate Medical Practice',
                    department: appt.department || '',
                    type: appt.type || 'In-Person Consultation',
                  }
                : undefined,
            })
          },
        })
      }
    } catch (err: any) {
      alert(err.message || 'Failed to initialize payment gateway')
    } finally {
      setPayingApptId(null)
    }
  }

  const fetchDoctors = async (overrideSearch?: string) => {
    setLoadingDoctors(true)
    setDoctorsError(null)
    try {
      const searchVal = overrideSearch !== undefined ? overrideSearch : searchInput
      const res = await getAvailableDoctors(
        {
          search: searchVal.trim() || undefined,
          specialization: selectedSpec || undefined,
          hospital: selectedHospital || undefined,
        },
        token,
      )
      const verifiedOnly = (res.doctors || []).filter(
        (doc) => doc.verificationStatus === 'verified'
      )
      setDoctors(verifiedOnly)
    } catch (err) {
      setDoctorsError(err instanceof Error ? err.message : 'Unable to load doctors from server.')
    } finally {
      setLoadingDoctors(false)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchDoctors(searchInput)
  }

  const handleResetFilters = () => {
    setSearchInput('')
    setSelectedSpec('')
    setSelectedHospital('')
    fetchDoctors('')
  }

  // Calendar & Availability Helpers
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const isSlotPast = (slotTime: string, selectedDateStr: string): boolean => {
    if (!selectedDateStr) return false
    const now = new Date()
    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    if (selectedDateStr < todayDateStr) return true
    if (selectedDateStr > todayDateStr) return false

    const match = slotTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
    if (!match) return false
    let hours = parseInt(match[1], 10)
    const minutes = parseInt(match[2], 10)
    const meridian = match[3]?.toUpperCase()
    if (meridian === 'PM' && hours < 12) hours += 12
    else if (meridian === 'AM' && hours === 12) hours = 0

    const slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0)
    return slotDate.getTime() <= now.getTime()
  }

  const handleOpenBooking = (doc: DoctorProfile) => {
    setBookingDoctor(doc)
    setCalMonth(new Date())

    const blockedList = doc.availability?.blockedDates || []
    const workDays = doc.availability?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    const slots = doc.availability?.availableSlots || ['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM']

    const { todayStr, maxDateStr } = getTodayAndMaxDates()

    // Find first available date (today or future within MAX_BOOKING_DAYS_AHEAD) with at least one active future slot
    const candidate = new Date()
    let selectedDate = ''
    let selectedSlot = slots[0] || '10:00 AM'

    const searchDays = Math.min(30, MAX_BOOKING_DAYS_AHEAD)
    for (let i = 0; i < searchDays; i++) {
      const dStr = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`
      if (dStr > maxDateStr) break
      const dayName = WEEKDAYS[candidate.getDay()]
      if (!blockedList.includes(dStr) && workDays.includes(dayName)) {
        const freeSlot = slots.find((s) => !isSlotPast(s, dStr))
        if (freeSlot) {
          selectedDate = dStr
          selectedSlot = freeSlot
          break
        }
      }
      candidate.setDate(candidate.getDate() + 1)
    }

    if (!selectedDate) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
      selectedDate = tomStr <= maxDateStr ? tomStr : todayStr
    }

    setBookingDate(selectedDate)
    setBookingTime(selectedSlot)
    setBookingReason('')
    setBookingFeedback(null)
  }

  const handleCloseBooking = () => {
    setBookingDoctor(null)
    setBookingFeedback(null)
  }

  const handlePrevMonth = () => {
    const { today } = getTodayAndMaxDates()
    const isPrevDisabled =
      calMonth.getFullYear() < today.getFullYear() ||
      (calMonth.getFullYear() === today.getFullYear() && calMonth.getMonth() <= today.getMonth())
    if (!isPrevDisabled) {
      setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
    }
  }

  const handleNextMonth = () => {
    const { maxDate } = getTodayAndMaxDates()
    const isNextDisabled =
      calMonth.getFullYear() > maxDate.getFullYear() ||
      (calMonth.getFullYear() === maxDate.getFullYear() && calMonth.getMonth() >= maxDate.getMonth())
    if (!isNextDisabled) {
      setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
    }
  }

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookingDoctor?._id || !bookingDate) return

    const { todayStr, maxDateStr } = getTodayAndMaxDates()
    if (bookingDate < todayStr) {
      setBookingFeedback({
        type: 'error',
        text: 'Cannot book an appointment on a past date.',
      })
      return
    }

    if (bookingDate > maxDateStr) {
      setBookingFeedback({
        type: 'error',
        text: `Appointments can only be booked up to ${MAX_BOOKING_DAYS_AHEAD} days in advance.`,
      })
      return
    }

    setBookingSubmitting(true)
    setBookingFeedback(null)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctor: bookingDoctor._id,
          appointmentDate: bookingDate,
          timeSlot: bookingTime,
          reason: bookingReason.trim() || 'General Consultation',
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to book appointment')
      }

      // Re-fetch patient's appointments immediately so upcoming appointments section appears!
      await fetchAppointments()

      // Also refresh doctor's booked slots immediately
      if (bookingDoctor?._id && token) {
        const year = calMonth.getFullYear()
        const month = String(calMonth.getMonth() + 1).padStart(2, '0')
        getDoctorBookedSlotsApi(bookingDoctor._id, { month: `${year}-${month}` }, token).then((res) => {
          if (res.bookedSlotsByDate) setBookedSlotsByDate(res.bookedSlotsByDate)
        }).catch(() => { })
      }

      const confirmedDoctor = bookingDoctor
      const confirmedDate = bookingDate
      const confirmedTime = bookingTime
      const confirmedReason = bookingReason.trim() || 'General Consultation'
      const appt = data.appointment

      // 1. Create payment order immediately for this new pending_payment booking
      const paymentOrderRes = await createPaymentOrderApi(appt._id, token)
      if (!paymentOrderRes.success || !paymentOrderRes.order) {
        throw new Error(paymentOrderRes.message || 'Failed to initialize payment gateway order.')
      }

      // 2. Close the booking calendar modal
      handleCloseBooking()

      // 3. Prepare appointment details and booking summary structure
      const apptDetails = {
        doctorName: confirmedDoctor.user?.name || 'Doctor',
        specialization: confirmedDoctor.specialization || 'Consultation',
        hospitalName:
          appt?.hospital?.name ||
          (confirmedDoctor.affiliatedHospitals && confirmedDoctor.affiliatedHospitals[0]?.name) ||
          confirmedDoctor.hospital?.name ||
          'HealthGate Medical Practice',
        department:
          appt?.department ||
          (confirmedDoctor.affiliatedHospitals && confirmedDoctor.affiliatedHospitals[0]?.department) ||
          '',
        appointmentDate: confirmedDate,
        timeSlot: confirmedTime,
        consultationType: appt?.type || 'In-Person Consultation',
      }

      const bookingSuccessDetails: BookingSuccessDetails = {
        doctor: confirmedDoctor,
        appointmentDate: confirmedDate,
        timeSlot: confirmedTime,
        reason: confirmedReason,
        appointmentId: appt?._id || '',
        hospitalName: apptDetails.hospitalName,
        department: apptDetails.department,
        type: apptDetails.consultationType,
      }

      // 4. Immediately open Razorpay Checkout - DO NOT show "Booking Successful" yet!
      await launchPaymentCheckout({
        paymentRecord: paymentOrderRes.payment,
        orderInfo: paymentOrderRes.order,
        appointmentDetails: apptDetails,
        user,
        token,
        onSuccess: async (verifiedPayment) => {
          // ONLY after Razorpay payment is successfully completed & verified by backend:
          await fetchAppointments()
          await fetchNotifications()
          setPaymentNotice(null)
          setBookingSuccessModal({
            ...bookingSuccessDetails,
            paymentDetails: {
              paymentId: verifiedPayment._id,
              providerPaymentId: verifiedPayment.providerPaymentId,
              providerOrderId: verifiedPayment.providerOrderId,
              amount: verifiedPayment.amount,
              status: verifiedPayment.status,
              provider: verifiedPayment.provider,
              paidAt: new Date().toISOString(),
            },
          })
        },
        onFailure: async (_failedPayment, errorMsg) => {
          // If payment is cancelled or fails, do NOT show the success message. Allow payment retry.
          await fetchAppointments()
          setPaymentNotice({
            type: 'warning',
            text: `Payment was not completed (${errorMsg || 'Transaction cancelled or declined'}). Your appointment is saved as "Pending Payment". You can retry payment anytime below.`,
          })
          setTimeout(() => {
            const el = document.getElementById('appointments')
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 200)
        },
        onDismiss: async () => {
          // Razorpay checkout popup closed by user
          await fetchAppointments()
          setPaymentNotice({
            type: 'info',
            text: 'Payment checkout was closed. Your appointment is reserved as "Pending Payment". Please complete payment to confirm your booking.',
          })
          setTimeout(() => {
            const el = document.getElementById('appointments')
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 200)
        },
        onOpenMockModal: () => {
          setCheckoutModal({
            paymentRecord: paymentOrderRes.payment,
            orderInfo: paymentOrderRes.order,
            appointmentDetails: apptDetails,
            bookingDetails: bookingSuccessDetails,
          })
        },
      })
    } catch (err) {
      setBookingFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Booking failed. Please try again.',
      })

      // In case of conflict, refresh booked slots so patient sees latest blocked slots
      if (bookingDoctor?._id && token) {
        const year = calMonth.getFullYear()
        const month = String(calMonth.getMonth() + 1).padStart(2, '0')
        getDoctorBookedSlotsApi(bookingDoctor._id, { month: `${year}-${month}` }, token).then((res) => {
          if (res.bookedSlotsByDate) setBookedSlotsByDate(res.bookedSlotsByDate)
        }).catch(() => { })
      }
    } finally {
      setBookingSubmitting(false)
    }
  }

  // Patient Display Name from Backend Profile or Auth State
  const patientDisplayName = profile?.user?.name || user?.name || 'Patient'
  const patientInitials = patientDisplayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Active Filter Count
  const hasActiveFilters = Boolean(searchInput.trim() || selectedSpec || selectedHospital)

  return (
    <div className="php-root">
      {/* ========================================================
          1. NAVBAR (User Profile Data from Backend & Logout)
          ======================================================== */}
      <nav className="php-navbar" aria-label="Patient navigation">
        <div className="php-navbar-inner">
          {/* Brand */}
          <div className="php-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="php-brand-logo">HG</div>
            <div className="php-brand-text">
              <span className="php-brand-name">HealthGate</span>
              <span className="php-brand-tag">Patient Portal</span>
            </div>
          </div>

          {/* Quick Section Links */}
          <ul className={`php-nav-links ${mobileNavOpen ? 'mobile-open' : ''}`}>
            <li>
              <a href="#welcome" className="php-nav-link active" onClick={() => setMobileNavOpen(false)}>Home</a>
            </li>
            {upcomingAppointments.length > 0 && (
              <li>
                <a href="#appointments" className="php-nav-link" onClick={() => setMobileNavOpen(false)}>
                  Upcoming ({upcomingAppointments.length})
                </a>
              </li>
            )}
            {pastAppointments.length > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    const next = !showHistory
                    setShowHistory(next)
                    setMobileNavOpen(false)
                    if (next) {
                      setTimeout(() => {
                        document.getElementById('appointment-history')?.scrollIntoView({ behavior: 'smooth' })
                      }, 100)
                    }
                  }}
                  className={`php-nav-link ${showHistory ? 'active' : ''}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                >
                  {showHistory ? 'Hide History' : `Appointment History (${pastAppointments.length})`}
                </button>
              </li>
            )}
            <li>
              <a href="#specializations" className="php-nav-link" onClick={() => setMobileNavOpen(false)}>Specializations</a>
            </li>
            <li>
              <a href="#doctors" className="php-nav-link" onClick={() => setMobileNavOpen(false)}>Find Doctors</a>
            </li>
            <li>
              <a href="#hospitals" className="php-nav-link" onClick={() => setMobileNavOpen(false)}>Hospitals</a>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false)
                  navigate('/patient/payments')
                }}
                className="php-nav-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: '#0d9488', fontWeight: 700 }}
              >
                Payments & Billing
              </button>
            </li>
          </ul>

          {/* User Profile, Notifications & Logout */}
          <div className="php-nav-user">
            {/* Notification Bell */}
            <div className="php-notif-bell-wrap">
              <button
                type="button"
                className="php-notif-bell-btn"
                onClick={() => setShowNotifs((prev) => !prev)}
                title="Notifications"
                aria-label="Notifications"
              >
                <BellIcon size={18} />
                {notifications.filter((n) => !n.isRead).length > 0 && (
                  <span className="php-notif-badge">
                    {notifications.filter((n) => !n.isRead).length}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="php-notif-dropdown">
                  <div className="php-notif-header">
                    <h4 className="php-notif-title">Notifications</h4>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                      {notifications.filter((n) => !n.isRead).length} Unread
                    </span>
                  </div>

                  <div className="php-notif-list">
                    {notifications.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: '#64748b', textAlign: 'center', margin: '14px 0' }}>
                        No notifications yet
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          className={`php-notif-item ${!n.isRead ? 'unread' : ''}`}
                          onClick={() => {
                            if (!n.isRead) handleMarkNotificationRead(n._id)
                            if (n.appointment) {
                              const isPast = pastAppointments.some(
                                (p) =>
                                  p._id === n.appointment ||
                                  (typeof n.appointment === 'object' && (n.appointment as any)?._id === p._id),
                              )
                              if (isPast) {
                                setShowHistory(true)
                                setTimeout(() => {
                                  document.getElementById('appointment-history')?.scrollIntoView({ behavior: 'smooth' })
                                }, 100)
                              } else {
                                const el = document.getElementById('appointments')
                                if (el) el.scrollIntoView({ behavior: 'smooth' })
                              }
                              setShowNotifs(false)
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="php-notif-item-title">{n.title}</span>
                            {!n.isRead && (
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0ea5a4' }} />
                            )}
                          </div>
                          <p className="php-notif-item-msg">{n.message}</p>
                          <span className="php-notif-item-time">
                            {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div
              className="php-user-badge-wrap"
              onClick={() => navigate('/profile')}
              title="Click to view & edit profile"
            >
              {profile?.profileImage ? (
                <img
                  src={profile.profileImage}
                  alt={patientDisplayName}
                  className="php-user-avatar"
                />
              ) : (
                <div className="php-user-avatar">{patientInitials || 'P'}</div>
              )}
              <div className="php-user-info">
                <span className="php-user-name">{patientDisplayName}</span>
                <span className="php-user-role">
                  {profile?.bloodGroup ? `${profile.bloodGroup} • Patient` : 'Verified Patient'}
                </span>
              </div>
            </div>

            <button
              id="patient-nav-profile-btn"
              type="button"
              className="php-btn-profile"
              onClick={() => navigate('/profile')}
            >
              My Profile
            </button>

            <button
              id="patient-nav-logout-btn"
              type="button"
              className="php-btn-logout"
              onClick={onLogout}
            >
              Logout
            </button>

            {/* Mobile Hamburger Menu Toggle (<= 768px) */}
            <button
              type="button"
              className="php-mobile-nav-toggle"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileNavOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Backdrop Overlay */}
        {mobileNavOpen && (
          <div
            className="php-mobile-nav-backdrop"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}
      </nav>

      {/* ========================================================
          2. & 3. WELCOME SECTION & SEARCH
          ======================================================== */}
      <header id="welcome" className="php-hero">
        <div className="php-hero-inner">
          <div className="php-hero-top">
            <div>
              <div className="php-hero-pill">
                <span className="php-hero-pill-dot" />
                Live Health Network
              </div>

              <p className="php-hero-greeting">
                Welcome back, <strong>{patientDisplayName}</strong>
              </p>

              <h1 className="php-hero-title">
                Your Health,<br />
                <span>Our Gateway.</span>
              </h1>

              <p className="php-hero-sub">
                Connect with verified medical specialists, explore accredited hospitals,
                and manage your consultations through HealthGate's trusted gateway.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="php-hero-metrics">
              <div className="php-metric-card">
                <div className="php-metric-icon"><StethoscopeIcon size={22} /></div>
                <div className="php-metric-info">
                  <span className="php-metric-value">{doctors.length}</span>
                  <span className="php-metric-label">Doctors Ready</span>
                </div>
              </div>
              <div className="php-metric-card">
                <div className="php-metric-icon"><HospitalIcon size={22} /></div>
                <div className="php-metric-info">
                  <span className="php-metric-value">{hospitals.length}</span>
                  <span className="php-metric-label">Hospitals</span>
                </div>
              </div>
              <div className="php-metric-card">
                <div className="php-metric-icon"><HeartPulseIcon size={22} /></div>
                <div className="php-metric-info">
                  <span className="php-metric-value">{specializations.length}</span>
                  <span className="php-metric-label">Specialties</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. SEARCH BAR (Doctors / Specializations / Hospitals) */}
          <form className="php-search-box" onSubmit={handleSearchSubmit}>
            <div className="php-input-wrap">
              <span className="php-input-icon"><SearchIcon size={16} /></span>
              <input
                id="patient-search-input"
                type="text"
                className="php-search-input"
                placeholder="Search doctors, specializations, or hospitals..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            {/* Specialization Select */}
            <div className="php-select-wrap">
              <select
                id="patient-spec-select"
                value={selectedSpec}
                onChange={(e) => setSelectedSpec(e.target.value)}
                aria-label="Filter by specialization"
              >
                <option value="">All Specializations</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            {/* Hospital Select */}
            <div className="php-select-wrap">
              <select
                id="patient-hospital-select"
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
                aria-label="Filter by hospital"
              >
                <option value="">All Hospitals</option>
                {hospitals.map((hosp) => (
                  <option key={hosp._id || hosp.name} value={hosp._id || hosp.name}>
                    {hosp.name}
                  </option>
                ))}
              </select>
            </div>

            <button id="patient-search-submit-btn" type="submit" className="php-btn-search">
              Search Doctors
            </button>

            {hasActiveFilters && (
              <button
                id="patient-search-reset-btn"
                type="button"
                className="php-btn-reset"
                onClick={handleResetFilters}
              >
                Clear
              </button>
            )}
          </form>

          {/* Active Filter Pills */}
          {hasActiveFilters && (
            <div className="php-filter-pills">
              <span className="php-filter-pill-label">Active Filters:</span>
              {searchInput.trim() && (
                <span className="php-filter-pill">
                  "{searchInput}"
                  <button type="button" onClick={() => { setSearchInput(''); fetchDoctors(''); }} aria-label="Clear search">
                    <CloseIcon size={12} />
                  </button>
                </span>
              )}
              {selectedSpec && (
                <span className="php-filter-pill">
                  Specialty: {selectedSpec}
                  <button type="button" onClick={() => setSelectedSpec('')} aria-label="Clear specialty filter">
                    <CloseIcon size={12} />
                  </button>
                </span>
              )}
              {selectedHospital && (
                <span className="php-filter-pill">
                  Hospital: {hospitals.find((h) => h._id === selectedHospital)?.name || 'Filtered'}
                  <button type="button" onClick={() => setSelectedHospital('')} aria-label="Clear hospital filter">
                    <CloseIcon size={12} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ========================================================
          MAIN CONTENT
          ======================================================== */}
      <main className="php-main">
        {/* ========================================================
            7. UPCOMING APPOINTMENTS
            (Show upcoming appointments only)
            ======================================================== */}
        {upcomingAppointments.length > 0 ? (
          <section id="appointments" className="php-appointments-section" aria-label="Upcoming Appointments">
            <div className="php-section-header" style={{ marginBottom: '20px' }}>
              <div className="php-section-title-wrap">
                <span className="php-section-tag">Your Schedule</span>
                <h2 className="php-section-title">Upcoming Appointments</h2>
                <p className="php-section-desc">
                  Here are your scheduled appointments verified with your healthcare providers.
                </p>
              </div>
              <div className="php-section-header-actions">
                <span className="php-section-count">{upcomingAppointments.length} Upcoming</span>
                {pastAppointments.length > 0 && (
                  <button
                    type="button"
                    className="php-history-jump-btn"
                    onClick={() => {
                      const next = !showHistory
                      setShowHistory(next)
                      if (next) {
                        setTimeout(() => {
                          document.getElementById('appointment-history')?.scrollIntoView({ behavior: 'smooth' })
                        }, 100)
                      }
                    }}
                  >
                    <ClockIcon size={14} />{' '}
                    {showHistory ? 'Hide History ↑' : `View Appointment History (${pastAppointments.length}) ↓`}
                  </button>
                )}
              </div>
            </div>

            {/* Payment Notice / Failure Alert */}
            {paymentNotice && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  marginBottom: '16px',
                  background:
                    paymentNotice.type === 'warning'
                      ? '#fffbeb'
                      : paymentNotice.type === 'success'
                        ? '#dcfce7'
                        : '#f0f9ff',
                  border: `1.5px solid ${
                    paymentNotice.type === 'warning'
                      ? '#fde68a'
                      : paymentNotice.type === 'success'
                        ? '#86efac'
                        : '#bae6fd'
                  }`,
                  color:
                    paymentNotice.type === 'warning'
                      ? '#92400e'
                      : paymentNotice.type === 'success'
                        ? '#15803d'
                        : '#0369a1',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {paymentNotice.type === 'warning' ? (
                    <AlertTriangleIcon size={18} />
                  ) : paymentNotice.type === 'success' ? (
                    <CheckCircleIcon size={18} />
                  ) : (
                    <ClockIcon size={18} />
                  )}
                  <span>{paymentNotice.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentNotice(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'inherit',
                    padding: '2px 4px',
                  }}
                  aria-label="Close notification"
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            )}

            {/* Reschedule Response Feedback Alert */}
            {rescheduleFeedback && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  marginBottom: '16px',
                  background: rescheduleFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
                  border: `1.5px solid ${rescheduleFeedback.type === 'success' ? '#86efac' : '#fca5a5'}`,
                  color: rescheduleFeedback.type === 'success' ? '#15803d' : '#b91c1c',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {rescheduleFeedback.type === 'success' ? (
                  <CheckCircleIcon size={18} />
                ) : (
                  <AlertTriangleIcon size={18} />
                )}
                <span>{rescheduleFeedback.text}</span>
              </div>
            )}

            <div className="php-appointments-grid">
              {upcomingAppointments.map((appt) => {
                const docName = appt.doctor?.user?.name || 'Doctor'
                const docSpec = appt.doctor?.specialization || 'Specialist'
                const formattedDate = appt.appointmentDate
                  ? new Date(appt.appointmentDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                  : 'Upcoming'

                return (
                  <div key={appt._id} className="php-appointment-card upcoming">
                    <div className="php-appt-header">
                      <span className={`php-appt-status-badge ${appt.status === 'confirmed' ? 'confirmed' : 'pending_payment'}`}>
                        ● {appt.status === 'confirmed' ? 'Confirmed' : 'Pending Payment'}
                      </span>
                      <span className="php-appt-time-badge">
                        {appt.timeSlot || '10:00 AM'}
                      </span>
                    </div>

                    <div className="php-appt-doctor">
                      <div className="php-appt-avatar">
                        {docName.replace(/^Dr\.?\s*/i, '').charAt(0) || 'D'}
                      </div>
                      <div className="php-appt-doc-info">
                        <h3 className="php-appt-doc-name">{docName}</h3>
                        <span className="php-appt-doc-spec">{docSpec}</span>
                      </div>
                    </div>

                    <div className="php-appt-details">
                      <div className="php-appt-detail-row">
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}><CalendarIcon size={14} /></span>
                        <span>{formattedDate}</span>
                      </div>
                      <div className="php-appt-detail-row">
                        {appt.hospital ? (
                          <>
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}><HospitalIcon size={14} /></span>
                            <span>
                              {(appt.hospital as any)?.name || 'Hospital'}
                              {appt.department ? ` (${appt.department})` : ''}
                            </span>
                          </>
                        ) : (
                          <>
                            <span style={{ display: 'inline-flex', alignItems: 'center', color: '#0d5c63' }}>
                              <StethoscopeIcon size={14} />
                            </span>
                            <span style={{ color: '#0d5c63', fontWeight: 600 }}>Freelance / Independent</span>
                          </>
                        )}
                      </div>
                      {appt.type && (
                        <div className="php-appt-detail-row">
                          <span style={{ display: 'inline-flex', alignItems: 'center' }}><StethoscopeIcon size={14} /></span>
                          <span>{appt.type} Visit</span>
                        </div>
                      )}
                    </div>

                    {appt.reason && (
                      <p className="php-appt-reason">
                        "{appt.reason}"
                      </p>
                    )}

                    {/* Consultation Fee & Payment Action */}
                    <div className="php-card-payment-section" style={{
                      margin: '12px 0 6px',
                      padding: '12px',
                      background: appt.status === 'confirmed' ? '#f0fdf4' : '#fffbeb',
                      border: `1px solid ${appt.status === 'confirmed' ? '#bbf7d0' : '#fef3c7'}`,
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                          Consultation Fee
                        </span>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                          ₹{appt.doctor?.consultationFee ? appt.doctor.consultationFee : 500}
                        </span>
                      </div>

                      {appt.status === 'confirmed' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#dcfce7',
                            color: '#15803d',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '9999px',
                          }}>
                            <CheckCircleIcon size={13} /> Paid & Confirmed
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleInitiatePayment(appt._id!)}
                          disabled={payingApptId === appt._id}
                          style={{
                            background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
                            color: '#ffffff',
                            border: 'none',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 6px rgba(13, 148, 136, 0.3)',
                          }}
                        >
                          <CreditCardIcon size={14} />
                          {payingApptId === appt._id ? 'Connecting...' : 'Pay Now (Retry)'}
                        </button>
                      )}
                    </div>

                    {/* Pending Reschedule Proposal from Doctor */}
                    {appt.rescheduleRequest?.status === 'pending' && (
                      <div className="php-reschedule-action-box">
                        <div className="php-reschedule-header">
                          <span className="php-reschedule-badge">
                            <ClockIcon size={13} /> Doctor Requested Reschedule
                          </span>
                        </div>

                        <p className="php-reschedule-note">
                          {appt.rescheduleRequest.reason
                            ? `"${appt.rescheduleRequest.reason}"`
                            : 'The doctor has requested to adjust your appointment time.'}
                        </p>

                        <div className="php-reschedule-compare">
                          <div className="php-compare-col current">
                            <span className="php-compare-label">Current Confirmed</span>
                            <span className="php-compare-val">
                              {formattedDate} • {appt.timeSlot}
                            </span>
                          </div>
                          <div className="php-compare-arrow">➔</div>
                          <div className="php-compare-col proposed">
                            <span className="php-compare-label">Proposed New Time</span>
                            <span className="php-compare-val">
                              {appt.rescheduleRequest.proposedDate
                                ? new Date(appt.rescheduleRequest.proposedDate).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                                : 'Proposed Date'}{' '}
                              • {appt.rescheduleRequest.proposedTimeSlot}
                            </span>
                          </div>
                        </div>

                        <div className="php-reschedule-btns">
                          <button
                            type="button"
                            className="php-btn-accept-reschedule"
                            disabled={respondingApptId === appt._id}
                            onClick={() => handleRespondReschedule(appt._id!, 'accept')}
                          >
                            <CheckCircleIcon size={15} />{' '}
                            {respondingApptId === appt._id ? 'Confirming...' : 'Accept New Time'}
                          </button>
                          <button
                            type="button"
                            className="php-btn-decline-reschedule"
                            disabled={respondingApptId === appt._id}
                            onClick={() => handleRespondReschedule(appt._id!, 'decline')}
                          >
                            Keep Current Time
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ) : pastAppointments.length > 0 ? (
          <section id="appointments" className="php-appointments-section php-appointments-empty" aria-label="Upcoming Appointments">
            <div className="php-empty-card" style={{ padding: '24px' }}>
              <span className="php-empty-icon"><CalendarIcon size={32} /></span>
              <h3 className="php-empty-title">No Upcoming Appointments</h3>
              <p className="php-empty-desc">
                You have no upcoming consultations scheduled right now. You can check your past visits in Appointment History below or book a new appointment.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <a href="#doctors" className="php-quick-book-link">Find a Doctor</a>
                <button
                  type="button"
                  className="php-quick-history-link"
                  onClick={() => {
                    const next = !showHistory
                    setShowHistory(next)
                    if (next) {
                      setTimeout(() => {
                        document.getElementById('appointment-history')?.scrollIntoView({ behavior: 'smooth' })
                      }, 100)
                    }
                  }}
                  style={{ cursor: 'pointer', font: 'inherit' }}
                >
                  <ClockIcon size={14} style={{ marginRight: '6px' }} />
                  {showHistory ? 'Hide History ↑' : `View Appointment History (${pastAppointments.length}) ↓`}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* ========================================================
            8. APPOINTMENT HISTORY (Past, Completed, Cancelled)
            (Only shown when user clicks History, can be hidden after that)
            ======================================================== */}
        {pastAppointments.length > 0 && showHistory && (
          <section id="appointment-history" className="php-appointments-section php-history-section" aria-label="Appointment History">
            <div className="php-section-header" style={{ marginBottom: '20px' }}>
              <div className="php-section-title-wrap">
                <span className="php-section-tag history">Consultation Archive</span>
                <h2 className="php-section-title">Appointment History</h2>
                <p className="php-section-desc">
                  Review your completed visits, past consultations, and previous appointment records.
                </p>
              </div>
              <div className="php-section-header-actions">
                <span className="php-section-count history">{pastAppointments.length} Past Visits</span>
                <button
                  type="button"
                  className="php-hide-history-btn"
                  onClick={() => {
                    setShowHistory(false)
                    document.getElementById('appointments')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  title="Hide Appointment History"
                >
                  <CloseIcon size={14} /> Hide History
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="php-history-filters">
              <button
                type="button"
                className={`php-history-filter-pill ${historyFilter === 'all' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('all')}
              >
                All Past ({pastAppointments.length})
              </button>
              {completedCount > 0 && (
                <button
                  type="button"
                  className={`php-history-filter-pill completed ${historyFilter === 'completed' ? 'active' : ''}`}
                  onClick={() => setHistoryFilter('completed')}
                >
                  Completed ({completedCount})
                </button>
              )}
              {cancelledCount > 0 && (
                <button
                  type="button"
                  className={`php-history-filter-pill cancelled ${historyFilter === 'cancelled' ? 'active' : ''}`}
                  onClick={() => setHistoryFilter('cancelled')}
                >
                  Cancelled ({cancelledCount})
                </button>
              )}
            </div>

            {filteredPastAppointments.length === 0 ? (
              <div className="php-empty-card" style={{ padding: '24px' }}>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                  No appointments found matching "{historyFilter}".
                </p>
              </div>
            ) : (
              <div className="php-appointments-grid">
                {filteredPastAppointments.map((appt) => {
                  const docName = appt.doctor?.user?.name || 'Doctor'
                  const docSpec = appt.doctor?.specialization || 'Specialist'
                  const formattedDate = appt.appointmentDate
                    ? new Date(appt.appointmentDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                    : 'Past Date'

                  const isCompleted = appt.status === 'completed'
                  const isCancelled = appt.status === 'cancelled'

                  const cardClass = isCompleted
                    ? 'php-appointment-card history completed'
                    : isCancelled
                      ? 'php-appointment-card history cancelled'
                      : 'php-appointment-card history past'

                  const statusBadgeClass = isCompleted
                    ? 'php-appt-status-badge completed'
                    : isCancelled
                      ? 'php-appt-status-badge cancelled'
                      : 'php-appt-status-badge past'

                  const statusLabel = isCompleted
                    ? 'Completed'
                    : isCancelled
                      ? 'Cancelled'
                      : 'Past Visit'

                  return (
                    <div key={appt._id} className={cardClass}>
                      <div className="php-appt-header">
                        <span className={statusBadgeClass}>
                          ● {statusLabel}
                        </span>
                        <span className="php-appt-time-badge">
                          {appt.timeSlot || '10:00 AM'}
                        </span>
                      </div>

                      <div className="php-appt-doctor">
                        <div className="php-appt-avatar history">
                          {docName.replace(/^Dr\.?\s*/i, '').charAt(0) || 'D'}
                        </div>
                        <div className="php-appt-doc-info">
                          <h3 className="php-appt-doc-name">{docName}</h3>
                          <span className="php-appt-doc-spec">{docSpec}</span>
                        </div>
                      </div>

                      <div className="php-appt-details">
                        <div className="php-appt-detail-row">
                          <span style={{ display: 'inline-flex', alignItems: 'center' }}><CalendarIcon size={14} /></span>
                          <span>{formattedDate}</span>
                        </div>
                        <div className="php-appt-detail-row">
                          {appt.hospital ? (
                            <>
                              <span style={{ display: 'inline-flex', alignItems: 'center' }}><HospitalIcon size={14} /></span>
                              <span>
                                {(appt.hospital as any)?.name || 'Hospital'}
                                {appt.department ? ` (${appt.department})` : ''}
                              </span>
                            </>
                          ) : (
                            <>
                              <span style={{ display: 'inline-flex', alignItems: 'center', color: '#0d5c63' }}>
                                <StethoscopeIcon size={14} />
                              </span>
                              <span style={{ color: '#0d5c63', fontWeight: 600 }}>Freelance / Independent</span>
                            </>
                          )}
                        </div>
                        {appt.type && (
                          <div className="php-appt-detail-row">
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}><StethoscopeIcon size={14} /></span>
                            <span>{appt.type} Visit</span>
                          </div>
                        )}
                      </div>

                      {appt.reason && (
                        <p className="php-appt-reason">
                          "{appt.reason}"
                        </p>
                      )}

                      {/* History Status Footer Note */}
                      <div className="php-history-card-footer">
                        {isCompleted && (
                          <span className="php-history-card-tag completed">
                            <CheckCircleIcon size={13} /> Consultation Completed
                          </span>
                        )}
                        {isCancelled && (
                          <span className="php-history-card-tag cancelled">
                            <BlockedIcon size={13} /> Consultation Cancelled
                          </span>
                        )}
                        {!isCompleted && !isCancelled && (
                          <span className="php-history-card-tag past">
                            <ClockIcon size={13} /> Past Scheduled Visit
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ========================================================
            4. SPECIALIZATIONS (Only what exists from backend GET /api/specializations)
            ======================================================== */}
        <section id="specializations" className="php-section" aria-label="Medical Specializations">
          <div className="php-section-header">
            <div className="php-section-title-wrap">
              <span className="php-section-tag">Explore Specialties</span>
              <h2 className="php-section-title">Medical Specializations</h2>
              <p className="php-section-desc">
                Browse specializations currently available in the HealthGate network.
              </p>
            </div>
            {!loadingSpecs && specializations.length > 0 && (
              <span className="php-section-count">{specializations.length} Available</span>
            )}
          </div>

          {/* Loading Skeleton */}
          {loadingSpecs ? (
            <div className="php-specs-grid">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="php-skeleton-card" style={{ height: '86px' }}>
                  <div className="php-skeleton" style={{ width: '40px', height: '40px', borderRadius: '12px' }} />
                  <div className="php-skeleton" style={{ width: '70%', height: '18px' }} />
                </div>
              ))}
            </div>
          ) : specializations.length === 0 ? (
            <div className="php-empty-card">
              <span className="php-empty-icon"><MedicalCrossIcon size={36} /></span>
              <h3 className="php-empty-title">No specializations available</h3>
              <p className="php-empty-desc">
                No active doctor specializations found in the database. Registered specialties will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="php-specs-grid">
              {specializations.map((spec) => {
                const isActive = selectedSpec.toLowerCase() === spec.toLowerCase()
                return (
                  <div
                    key={spec}
                    className={`php-spec-card ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      // Toggle selection
                      setSelectedSpec(isActive ? '' : spec)
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedSpec(isActive ? '' : spec)}
                  >
                    <div className="php-spec-icon-box">
                      {getSpecIcon(spec)}
                    </div>
                    <div className="php-spec-info">
                      <h3 className="php-spec-name">{spec}</h3>
                      <span className="php-spec-sub">
                        {isActive ? 'Active Filter' : 'Click to filter'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ========================================================
            5. DOCTORS (Registered doctors from GET /api/doctors)
            ======================================================== */}
        <section id="doctors" className="php-section" aria-label="Available Doctors">
          <div className="php-section-header">
            <div className="php-section-title-wrap">
              <span className="php-section-tag">Medical Experts</span>
              <h2 className="php-section-title">Registered Doctors</h2>
              <p className="php-section-desc">
                Verified practitioners with credentials, specializations, and affiliated hospitals.
              </p>
            </div>
            {!loadingDoctors && doctors.length > 0 && (
              <span className="php-section-count">{doctors.length} Doctors</span>
            )}
          </div>

          {/* Error Banner */}
          {doctorsError && (
            <div className="php-error-banner">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangleIcon size={16} /> {doctorsError}
              </span>
              <button
                type="button"
                className="php-btn-retry"
                onClick={() => fetchDoctors()}
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {loadingDoctors ? (
            <div className="php-doctors-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="php-skeleton-card" style={{ height: '240px' }}>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div className="php-skeleton" style={{ width: '64px', height: '64px', borderRadius: '18px' }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="php-skeleton" style={{ width: '60%', height: '20px' }} />
                      <div className="php-skeleton" style={{ width: '40%', height: '16px' }} />
                    </div>
                  </div>
                  <div className="php-skeleton" style={{ width: '100%', height: '50px', borderRadius: '12px' }} />
                  <div className="php-skeleton" style={{ width: '100%', height: '38px', borderRadius: '12px', marginTop: 'auto' }} />
                </div>
              ))}
            </div>
          ) : doctors.length === 0 ? (
            <div className="php-empty-card">
              <span className="php-empty-icon"><UserIcon size={36} /></span>
              <h3 className="php-empty-title">No doctors available</h3>
              <p className="php-empty-desc">
                {hasActiveFilters
                  ? 'No doctors match your current search filters. Try clearing filters or searching for another term.'
                  : 'There are currently no registered doctors in the database. When doctors join HealthGate, they will appear here.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="php-btn-reset"
                  style={{ marginTop: '8px' }}
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="php-doctors-grid">
              {doctors.map((doc) => {
                const docName = doc.user?.name || 'Medical Doctor'
                const initials = docName
                  .replace(/^Dr\.?\s*/i, '')
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
                const spec = doc.specialization || 'General Practitioner'
                const fee = doc.consultationFee ? `₹${doc.consultationFee}` : 'Free / Inquire'
                const exp = doc.experienceYears ? `${doc.experienceYears} Years` : 'Experienced'

                return (
                  <div key={doc._id} className="php-doctor-card">
                    <div className="php-doc-top">
                      <div className="php-doc-avatar-wrap">
                        {doc.profileImage ? (
                          <img
                            src={doc.profileImage}
                            alt={docName}
                            className="php-doc-avatar"
                          />
                        ) : (
                          <div className="php-doc-avatar">{initials || 'DR'}</div>
                        )}
                        <span
                          className="php-doc-status-indicator"
                          title={doc.available ? 'Available' : 'Unavailable'}
                          style={{ background: doc.available ? '#10b981' : '#94a3b8' }}
                        />
                      </div>

                      <div className="php-doc-main-info">
                        <h3 className="php-doc-name">{docName}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className="php-doc-spec-badge">
                            {getSpecIcon(spec)} {spec}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#065f46',
                              background: '#d1fae5',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <ShieldCheckIcon size={12} /> Verified
                          </span>
                        </div>
                        <div className="php-doc-hospital-tag">
                          {doc.affiliatedHospitals && doc.affiliatedHospitals.length > 0 ? (
                            <>
                              <span style={{ display: 'inline-flex', alignItems: 'center' }}><HospitalIcon size={14} /></span>
                              <span>
                                {doc.affiliatedHospitals[0].name || 'Hospital'}
                                {doc.affiliatedHospitals[0].department ? ` (${doc.affiliatedHospitals[0].department})` : ''}
                                {doc.affiliatedHospitals.length > 1 ? ` +${doc.affiliatedHospitals.length - 1} more` : ''}
                              </span>
                            </>
                          ) : (
                            <>
                              <span style={{ display: 'inline-flex', alignItems: 'center', color: '#0d5c63' }}>
                                <StethoscopeIcon size={14} />
                              </span>
                              <span style={{ color: '#0d5c63', fontWeight: 600 }}>Freelance / Independent Practice</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="php-doc-meta-grid">
                      <div className="php-doc-meta-item">
                        <span className="php-doc-meta-label">Experience</span>
                        <span className="php-doc-meta-val">{exp}</span>
                      </div>
                      <div className="php-doc-meta-item">
                        <span className="php-doc-meta-label">Consultation</span>
                        <span className="php-doc-meta-val">{fee}</span>
                      </div>
                    </div>

                    <div className="php-doc-actions">
                      <button
                        type="button"
                        className="php-btn-book"
                        onClick={() => handleOpenBooking(doc)}
                      >
                        Book Appointment
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ========================================================
            6. HOSPITALS (Created by admins from GET /api/hospitals)
            ======================================================== */}
        <section id="hospitals" className="php-section" aria-label="Partner Hospitals">
          <div className="php-section-header">
            <div className="php-section-title-wrap">
              <span className="php-section-tag">Accredited Network</span>
              <h2 className="php-section-title">Hospitals & Centers</h2>
              <p className="php-section-desc">
                Healthcare institutions registered and approved by HealthGate administration.
              </p>
            </div>
            {!loadingHospitals && hospitals.length > 0 && (
              <span className="php-section-count">{hospitals.length} Hospitals</span>
            )}
          </div>

          {/* Loading Skeleton */}
          {loadingHospitals ? (
            <div className="php-hospitals-grid">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="php-skeleton-card" style={{ height: '130px' }}>
                  <div className="php-skeleton" style={{ width: '48px', height: '48px', borderRadius: '12px' }} />
                  <div className="php-skeleton" style={{ width: '80%', height: '20px' }} />
                </div>
              ))}
            </div>
          ) : hospitals.length === 0 ? (
            <div className="php-empty-card">
              <span className="php-empty-icon"><HospitalIcon size={36} /></span>
              <h3 className="php-empty-title">No hospitals available</h3>
              <p className="php-empty-desc">
                No hospitals have been registered in the system yet. Hospital partners created by administrators will be displayed here.
              </p>
            </div>
          ) : (
            <div className="php-hospitals-grid">
              {hospitals.map((hosp) => {
                const isActiveFilter = selectedHospital === hosp._id
                return (
                  <div
                    key={hosp._id || hosp.name}
                    className={`php-hospital-card ${isActiveFilter ? 'active' : ''}`}
                    onClick={() => {
                      // Toggle hospital filter
                      const newFilter = isActiveFilter ? '' : hosp._id || ''
                      setSelectedHospital(newFilter)
                      // Smooth scroll down to doctors section
                      document.getElementById('doctors')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setSelectedHospital(isActiveFilter ? '' : hosp._id || '')
                      }
                    }}
                  >
                    <div className="php-hosp-icon-wrap"><HospitalIcon size={22} /></div>
                    <div>
                      <h3 className="php-hosp-name">{hosp.name}</h3>
                      <span className={`php-hosp-badge ${hosp.isActive !== false ? 'active' : 'inactive'}`}>
                        ● {hosp.isActive !== false ? 'Active Network' : 'Affiliate'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {/* ========================================================
          BOOK APPOINTMENT MODAL
          ======================================================== */}
      {bookingDoctor && (
        <div className="php-modal-overlay" onClick={handleCloseBooking}>
          <div className="php-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="php-modal-header">
              <div>
                <span className="php-section-tag">Schedule Consultation</span>
                <h2 className="php-modal-title">Book with {bookingDoctor.user?.name || 'Doctor'}</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0' }}>
                  {bookingDoctor.specialization} • {bookingDoctor.hospital?.name || 'Clinic'}
                </p>
              </div>
              <button
                type="button"
                className="php-btn-close"
                onClick={handleCloseBooking}
                aria-label="Close modal"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            {bookingFeedback && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  background: bookingFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
                  color: bookingFeedback.type === 'success' ? '#065f46' : '#991b1b',
                  border: `1px solid ${bookingFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                }}
              >
                {bookingFeedback.text}
              </div>
            )}

            {/* Modal Body / Form */}
            {(() => {
              const year = calMonth.getFullYear()
              const month = calMonth.getMonth()
              const monthName = calMonth.toLocaleString('default', { month: 'long' })
              const firstDayIndex = new Date(year, month, 1).getDay()
              const totalDays = new Date(year, month + 1, 0).getDate()

              const { today, todayStr, maxDate, maxDateStr } = getTodayAndMaxDates()
              const isPrevMonthDisabled =
                calMonth.getFullYear() < today.getFullYear() ||
                (calMonth.getFullYear() === today.getFullYear() && calMonth.getMonth() <= today.getMonth())
              const isNextMonthDisabled =
                calMonth.getFullYear() > maxDate.getFullYear() ||
                (calMonth.getFullYear() === maxDate.getFullYear() && calMonth.getMonth() >= maxDate.getMonth())

              const blockedDates = bookingDoctor.availability?.blockedDates || []
              const workDays = bookingDoctor.availability?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
              const availableSlots = bookingDoctor.availability?.availableSlots?.length
                ? bookingDoctor.availability.availableSlots
                : ['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM']

              const currentDayBookedSlots = (bookingDate && bookedSlotsByDate[bookingDate]) || []
              const isSelectedSlotBooked = Boolean(bookingTime && currentDayBookedSlots.includes(bookingTime))
              const isSelectedSlotPast = Boolean(bookingTime && isSlotPast(bookingTime, bookingDate))

              const availableSlotsCount = availableSlots.filter(
                (s) => !currentDayBookedSlots.includes(s) && !isSlotPast(s, bookingDate)
              ).length
              const allSlotsUnavailableOnDate = availableSlotsCount === 0

              const isDateBlocked = (dateStr: string) => blockedDates.includes(dateStr)
              const isDateOffDuty = (dayIdx: number) => !workDays.includes(WEEKDAYS[dayIdx])

              const isSelectedDateBlocked = Boolean(bookingDate && isDateBlocked(bookingDate))
              const isSelectedDateOffDuty = Boolean(
                bookingDate && isDateOffDuty(new Date(bookingDate).getDay())
              )
              const isSelectedDatePast = Boolean(bookingDate && bookingDate < todayStr)
              const isSelectedDateBeyondLimit = Boolean(bookingDate && bookingDate > maxDateStr)
              const isBookingDisabled =
                bookingSubmitting ||
                !bookingDate ||
                !bookingTime ||
                isSelectedDateBlocked ||
                isSelectedDateOffDuty ||
                isSelectedDatePast ||
                isSelectedDateBeyondLimit ||
                allSlotsUnavailableOnDate ||
                isSelectedSlotBooked ||
                isSelectedSlotPast

              return (
                <form className="php-modal-form" onSubmit={handleConfirmBooking}>
                  {/* Practice Setting Info */}
                  {bookingDoctor.affiliatedHospitals && bookingDoctor.affiliatedHospitals.length > 0 ? (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        color: '#0369a1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '16px',
                      }}
                    >
                      <HospitalIcon size={16} />
                      <span>
                        Practicing at <strong>{bookingDoctor.affiliatedHospitals[0].name}</strong>
                        {bookingDoctor.affiliatedHospitals[0].department ? ` (${bookingDoctor.affiliatedHospitals[0].department})` : ''}
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: '#f0fdfa',
                        border: '1px solid #99f6e4',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        color: '#0d5c63',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '16px',
                      }}
                    >
                      <StethoscopeIcon size={16} />
                      <span>
                        Practicing as an <strong>Independent / Freelance Doctor</strong>
                      </span>
                    </div>
                  )}

                  {/* Visual Calendar */}
                  <div className="php-form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label className="php-form-label" style={{ margin: 0 }}>
                        Select Date (Doctor's Schedule)
                      </label>
                      <span className="php-limit-badge">
                        Max {MAX_BOOKING_DAYS_AHEAD} days advance
                      </span>
                    </div>

                    <div className="php-calendar-box">
                      {/* Month & Navigation Header */}
                      <div className="php-cal-header">
                        <button
                          type="button"
                          className="php-cal-nav-btn"
                          onClick={handlePrevMonth}
                          disabled={isPrevMonthDisabled}
                          title={isPrevMonthDisabled ? 'Cannot navigate to past months' : 'Previous Month'}
                        >
                          ‹
                        </button>
                        <span className="php-cal-month-title">
                          {monthName} {year}
                        </span>
                        <button
                          type="button"
                          className="php-cal-nav-btn"
                          onClick={handleNextMonth}
                          disabled={isNextMonthDisabled}
                          title={isNextMonthDisabled ? `Cannot book beyond ${MAX_BOOKING_DAYS_AHEAD} days` : 'Next Month'}
                        >
                          ›
                        </button>
                      </div>

                      {/* Day-of-week Headers */}
                      <div className="php-cal-weekdays">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
                          <span key={w}>{w}</span>
                        ))}
                      </div>

                      {/* Calendar Days Grid */}
                      <div className="php-cal-grid">
                        {/* Leading Empty Cells */}
                        {Array.from({ length: firstDayIndex }).map((_, i) => (
                          <div key={`empty-${i}`} className="php-cal-cell empty" />
                        ))}

                        {/* Month Days */}
                        {Array.from({ length: totalDays }).map((_, i) => {
                          const d = i + 1
                          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                          const dayDate = new Date(year, month, d)
                          const isPast = dateStr < todayStr
                          const isBeyondLimit = dateStr > maxDateStr
                          const isBlocked = isDateBlocked(dateStr)
                          const isOff = isDateOffDuty(dayDate.getDay())
                          const dayBookedSlots = bookedSlotsByDate[dateStr] || []
                          const dayOpenCount = availableSlots.filter(
                            (s) => !dayBookedSlots.includes(s) && !isSlotPast(s, dateStr)
                          ).length
                          const isDayNoSlots = dayOpenCount === 0
                          const isDayFull = isDayNoSlots && !isPast && !isBeyondLimit && !isBlocked && !isOff
                          const isSelected = bookingDate === dateStr
                          const isAvailable = !isPast && !isBeyondLimit && !isBlocked && !isOff && !isDayNoSlots

                          return (
                            <button
                              key={dateStr}
                              type="button"
                              className={`php-cal-cell ${isBeyondLimit
                                ? 'beyond-limit'
                                : isBlocked
                                  ? 'blocked'
                                  : isOff
                                    ? 'off-duty'
                                    : isPast
                                      ? 'past'
                                      : isDayFull
                                        ? 'full'
                                        : isSelected
                                          ? 'selected'
                                          : 'available'
                                }`}
                              disabled={!isAvailable}
                              onClick={() => {
                                setBookingDate(dateStr)
                                const dayTaken = bookedSlotsByDate[dateStr] || []
                                if (dayTaken.includes(bookingTime) || isSlotPast(bookingTime, dateStr)) {
                                  const nextFree = availableSlots.find(
                                    (s) => !dayTaken.includes(s) && !isSlotPast(s, dateStr)
                                  )
                                  if (nextFree) setBookingTime(nextFree)
                                }
                              }}
                              title={
                                isBeyondLimit
                                  ? `Booking limit: Cannot book more than ${MAX_BOOKING_DAYS_AHEAD} days in advance`
                                  : isBlocked
                                    ? 'Blocked: Doctor is unavailable / on leave'
                                    : isOff
                                      ? 'Off-duty day for doctor'
                                      : isPast
                                        ? 'Past date'
                                        : isDayFull
                                          ? 'No Available Slots: All slots on this date are taken or have passed'
                                          : `Available: ${dateStr}`
                              }
                            >
                              <span>{d}</span>
                              {isBeyondLimit && !isPast && (
                                <span style={{ fontSize: '0.55rem', color: '#94a3b8' }}>&gt;{MAX_BOOKING_DAYS_AHEAD}d</span>
                              )}
                              {isBlocked && (
                                <span className="php-cal-blocked-tag">Blocked</span>
                              )}
                              {isOff && !isPast && !isBeyondLimit && !isBlocked && (
                                <span style={{ fontSize: '0.55rem', color: '#94a3b8' }}>Off</span>
                              )}
                              {isDayFull && !isPast && !isBeyondLimit && !isBlocked && !isOff && (
                                <span className="php-cal-full-tag">Full</span>
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {/* Calendar Legend */}
                      <div className="php-cal-legend">
                        <span className="php-legend-item">
                          <span className="php-legend-dot avail" /> Available
                        </span>
                        <span className="php-legend-item">
                          <span className="php-legend-dot block" /> Blocked / Leave
                        </span>
                        <span className="php-legend-item">
                          <span className="php-legend-dot off" /> Off-duty
                        </span>
                        <span className="php-legend-item">
                          <span className="php-legend-dot full" /> Fully Booked
                        </span>
                        <span className="php-legend-item">
                          <span className="php-legend-dot sel" /> Selected
                        </span>
                        <span className="php-legend-item">
                          <span className="php-legend-dot beyond" /> &gt;{MAX_BOOKING_DAYS_AHEAD}d
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Doctor Blocked Dates List Banner (if any) */}
                  {blockedDates.length > 0 && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '10px',
                        fontSize: '0.78rem',
                        color: '#991b1b',
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <BlockedIcon size={14} /> Blocked Dates by Doctor:
                      </strong>
                      {blockedDates.map((bDate) => (
                        <span
                          key={bDate}
                          style={{
                            background: '#fee2e2',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 700,
                          }}
                        >
                          {bDate}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Selected Date Status Banner */}
                  {isSelectedDateBeyondLimit ? (
                    <div className="php-date-status-alert blocked">
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}><AlertTriangleIcon size={16} /></span>
                      <span>
                        Appointments can only be booked up to {MAX_BOOKING_DAYS_AHEAD} days in advance. Please select an earlier date.
                      </span>
                    </div>
                  ) : isSelectedDatePast ? (
                    <div className="php-date-status-alert blocked">
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}><AlertTriangleIcon size={16} /></span>
                      <span>Cannot book an appointment on a past date.</span>
                    </div>
                  ) : isSelectedDateBlocked ? (
                    <div className="php-date-status-alert blocked">
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}><BlockedIcon size={16} /></span>
                      <span>
                        Dr. {bookingDoctor.user?.name} is on leave / blocked on this date.
                        Appointment booking is disabled on this day. Please select an available green date.
                      </span>
                    </div>
                  ) : isSelectedDateOffDuty ? (
                    <div className="php-date-status-alert off">
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}><AlertTriangleIcon size={16} /></span>
                      <span>
                        Doctor is off-duty on {WEEKDAYS[new Date(bookingDate).getDay()]}s.
                        Please select an available green day.
                      </span>
                    </div>
                  ) : bookingDate ? (
                    <div className="php-date-status-alert available">
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}><CheckCircleIcon size={16} /></span>
                      <span>
                        Selected Date:{' '}
                        <strong>
                          {new Date(bookingDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </strong>{' '}
                        (Available)
                      </span>
                    </div>
                  ) : null}

                  {/* Preferred Time Slot */}
                  <div className="php-form-group">
                    <div className="php-slots-header-row">
                      <label className="php-form-label" style={{ margin: 0 }}>
                        Available Time Slots ({availableSlotsCount} open)
                      </label>
                      <div className="php-slots-legend">
                        <span className="php-slots-legend-item">
                          <span className="php-legend-dot avail" style={{ width: '7px', height: '7px' }} /> Open
                        </span>
                        <span className="php-slots-legend-item">
                          <span className="php-legend-dot block" style={{ width: '7px', height: '7px' }} /> Booked
                        </span>
                        <span className="php-slots-legend-item">
                          <span className="php-legend-dot off" style={{ width: '7px', height: '7px' }} /> Past
                        </span>
                      </div>
                    </div>

                    <div className="php-time-grid">
                      {availableSlots.map((time) => {
                        const isSlotBooked = currentDayBookedSlots.includes(time)
                        const isPast = isSlotPast(time, bookingDate)
                        const isUnavailable = isSlotBooked || isPast

                        return (
                          <button
                            key={time}
                            type="button"
                            className={`php-time-btn ${bookingTime === time && !isUnavailable ? 'active' : ''} ${isSlotBooked ? 'booked' : isPast ? 'past' : ''
                              }`}
                            onClick={() => {
                              if (!isUnavailable) setBookingTime(time)
                            }}
                            disabled={isBookingDisabled || isUnavailable}
                            title={
                              isPast
                                ? `Time slot ${time} has already passed`
                                : isSlotBooked
                                  ? `Time slot ${time} is already booked by another patient`
                                  : `Select ${time}`
                            }
                          >
                            <span>{time}</span>
                            {isSlotBooked && <span className="php-slot-booked-badge">Booked</span>}
                            {isPast && !isSlotBooked && <span className="php-slot-past-badge">Past</span>}
                          </button>
                        )
                      })}
                    </div>

                    {allSlotsUnavailableOnDate && (
                      <div className="php-date-status-alert blocked" style={{ marginTop: '10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}><BlockedIcon size={16} /></span>
                        <span>
                          {bookingDate === todayStr
                            ? 'All consultation slots for today have already passed or been booked. Please select an upcoming date.'
                            : 'All consultation slots on this date are fully booked. Please select another date from the calendar.'}
                        </span>
                      </div>
                    )}

                    {isSelectedSlotPast && !allSlotsUnavailableOnDate && (
                      <div className="php-date-status-alert off" style={{ marginTop: '10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}><ClockIcon size={16} /></span>
                        <span>The slot "{bookingTime}" has already passed today. Please choose an upcoming open slot above.</span>
                      </div>
                    )}

                    {isSelectedSlotBooked && !allSlotsUnavailableOnDate && !isSelectedSlotPast && (
                      <div className="php-date-status-alert blocked" style={{ marginTop: '10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}><AlertTriangleIcon size={16} /></span>
                        <span>The slot "{bookingTime}" has already been booked. Please pick an open slot above.</span>
                      </div>
                    )}
                  </div>

                  {/* Reason for Visit */}
                  <div className="php-form-group">
                    <label className="php-form-label">Reason for Visit (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="E.g., Routine checkup, consultation, symptoms..."
                      value={bookingReason}
                      onChange={(e) => setBookingReason(e.target.value)}
                      className="php-form-textarea"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="php-btn-submit"
                    disabled={isBookingDisabled}
                  >
                    {bookingSubmitting
                      ? 'Confirming...'
                      : isSelectedDateBlocked
                        ? 'Doctor Blocked on this Date'
                        : isSelectedDateOffDuty
                          ? 'Doctor Off-Duty'
                          : isSelectedDatePast
                            ? 'Date has passed'
                            : allSlotsUnavailableOnDate
                              ? 'No Available Slots'
                              : isSelectedSlotPast
                                ? 'Slot Has Passed'
                                : isSelectedSlotBooked
                                  ? 'Selected Slot Already Booked'
                                  : 'Confirm Appointment'}
                  </button>
                </form>
              )
            })()}
          </div>
        </div>
      )}

      {/* ========================================================
          BOOKING SUCCESS MESSAGE MODAL
          ======================================================== */}
      {bookingSuccessModal && (
        <div
          className="php-modal-overlay"
          onClick={() => setBookingSuccessModal(null)}
          role="presentation"
        >
          <div
            className="php-modal-card php-success-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-modal-heading"
          >
            <button
              type="button"
              className="php-btn-close php-success-close-btn"
              onClick={() => setBookingSuccessModal(null)}
              aria-label="Close success dialog"
            >
              <CloseIcon size={16} />
            </button>

            {/* Success Icon with glowing ring */}
            <div className="php-success-icon-area">
              <div className="php-success-icon-ring">
                <CheckCircleIcon size={38} />
              </div>
            </div>

            <div className="php-success-header">
              <span className="php-success-tag">Appointment Confirmed</span>
              <h2 id="success-modal-heading" className="php-success-title">
                Booking Successful!
              </h2>
              <p className="php-success-desc">
                Your consultation has been successfully scheduled. A confirmation has also been dispatched to your healthcare provider.
              </p>
            </div>

            {/* Structured Appointment Summary Card */}
            <div className="php-success-card">
              {/* Doctor Information */}
              <div className="php-success-doctor-row">
                <div className="php-success-doctor-avatar">
                  <UserIcon size={24} />
                </div>
                <div className="php-success-doctor-info">
                  <span className="php-success-doc-label">Consulting Practitioner</span>
                  <h3 className="php-success-doc-name">
                    Dr. {bookingSuccessModal.doctor.user?.name || 'Healthcare Practitioner'}
                  </h3>
                  <div className="php-success-doc-badges">
                    <span className="php-success-badge spec">
                      {getSpecIcon(bookingSuccessModal.doctor.specialization || '')}
                      {bookingSuccessModal.doctor.specialization || 'Specialist'}
                    </span>
                    {(bookingSuccessModal.doctor.experienceYears ?? bookingSuccessModal.doctor.experience) && (
                      <span className="php-success-badge exp">
                        {bookingSuccessModal.doctor.experienceYears ?? bookingSuccessModal.doctor.experience} yrs exp
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="php-success-divider" />

              {/* Schedule and Practice Details */}
              <div className="php-success-grid">
                <div className="php-success-grid-item">
                  <div className="php-success-grid-label">
                    <CalendarIcon size={14} /> Date
                  </div>
                  <div className="php-success-grid-value">
                    {new Date(bookingSuccessModal.appointmentDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>

                <div className="php-success-grid-item">
                  <div className="php-success-grid-label">
                    <ClockIcon size={14} /> Time Slot
                  </div>
                  <div className="php-success-grid-value time-highlight">
                    {bookingSuccessModal.timeSlot}
                  </div>
                </div>

                <div className="php-success-grid-item">
                  <div className="php-success-grid-label">
                    <HospitalIcon size={14} /> Healthcare Facility
                  </div>
                  <div className="php-success-grid-value">
                    {bookingSuccessModal.hospitalName || 'HealthGate Medical Network'}
                    {bookingSuccessModal.department ? ` (${bookingSuccessModal.department})` : ''}
                  </div>
                </div>

                <div className="php-success-grid-item">
                  <div className="php-success-grid-label">
                    <StethoscopeIcon size={14} /> Consultation Mode
                  </div>
                  <div className="php-success-grid-value">
                    {bookingSuccessModal.type || 'In-Person Consultation'}
                  </div>
                </div>

                {bookingSuccessModal.reason && (
                  <div className="php-success-grid-item full-width">
                    <div className="php-success-grid-label">Reason for Visit</div>
                    <div className="php-success-grid-value reason-text">
                      "{bookingSuccessModal.reason}"
                    </div>
                  </div>
                )}

                {bookingSuccessModal.appointmentId && (
                  <div className="php-success-grid-item full-width appt-ref-row">
                    <span className="php-success-grid-label">Reference Code</span>
                    <span className="php-success-ref-code">
                      #{bookingSuccessModal.appointmentId.slice(-8).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Helpful Notice */}
            <div className="php-success-notice">
              <span className="php-success-notice-icon">💡</span>
              <p className="php-success-notice-text">
                Please arrive at the facility <strong>10–15 minutes prior</strong> to your appointment. Keep any previous test results or medical records ready.
              </p>
            </div>

            {/* Verified Payment Details Card */}
            {bookingSuccessModal.paymentDetails && (
              <div className="php-success-payment-card">
                <div className="php-success-payment-top">
                  <div className="php-success-payment-tag">
                    <ShieldCheckIcon size={15} />
                    <span>Verified Payment Receipt</span>
                  </div>
                  <span className="php-success-paid-pill">
                    ● Paid & Confirmed
                  </span>
                </div>

                <div className="php-success-payment-grid">
                  <div className="php-success-pay-item">
                    <span className="php-pay-item-label">Amount Paid</span>
                    <span className="php-pay-item-val highlight">
                      ₹{bookingSuccessModal.paymentDetails.amount ?? (bookingSuccessModal.doctor?.consultationFee || 500)}
                    </span>
                  </div>

                  <div className="php-success-pay-item">
                    <span className="php-pay-item-label">Payment Gateway</span>
                    <span className="php-pay-item-val">
                      {bookingSuccessModal.paymentDetails.provider === 'RAZORPAY' || !bookingSuccessModal.paymentDetails.provider
                        ? 'Razorpay Secure Gateway'
                        : `${bookingSuccessModal.paymentDetails.provider} Gateway`}
                    </span>
                  </div>

                  {bookingSuccessModal.paymentDetails.providerPaymentId && (
                    <div className="php-success-pay-item">
                      <span className="php-pay-item-label">Payment ID</span>
                      <code className="php-pay-item-val code">
                        {bookingSuccessModal.paymentDetails.providerPaymentId}
                      </code>
                    </div>
                  )}

                  {bookingSuccessModal.paymentDetails.providerOrderId && (
                    <div className="php-success-pay-item">
                      <span className="php-pay-item-label">Order ID</span>
                      <code className="php-pay-item-val code">
                        {bookingSuccessModal.paymentDetails.providerOrderId}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="php-success-actions" style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                type="button"
                className="php-success-btn-primary"
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
                }}
                onClick={() => {
                  setBookingSuccessModal(null)
                  setTimeout(() => {
                    const el = document.getElementById('appointments')
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  }, 100)
                }}
              >
                <CalendarIcon size={16} /> View in My Appointments
              </button>
              <button
                type="button"
                className="php-success-btn-secondary"
                style={{ width: '100px' }}
                onClick={() => setBookingSuccessModal(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MOCK PAYMENT CHECKOUT MODAL
          ======================================================== */}
      {checkoutModal && (
        <MockPaymentModal
          isOpen={!!checkoutModal}
          onClose={() => {
            setCheckoutModal(null)
            fetchAppointments()
          }}
          onSuccess={(verifiedPayment) => {
            fetchAppointments()
            fetchNotifications()
            if (checkoutModal?.bookingDetails) {
              setBookingSuccessModal({
                ...checkoutModal.bookingDetails,
                paymentDetails: {
                  paymentId: verifiedPayment._id,
                  providerPaymentId: verifiedPayment.providerPaymentId,
                  providerOrderId: verifiedPayment.providerOrderId,
                  amount: verifiedPayment.amount,
                  status: verifiedPayment.status,
                  provider: verifiedPayment.provider,
                  paidAt: new Date().toISOString(),
                },
              })
            }
          }}
          onFailure={() => {
            fetchAppointments()
            setPaymentNotice({
              type: 'warning',
              text: 'Payment test failed or was cancelled. Your appointment remains Pending Payment and can be retried.',
            })
          }}
          paymentRecord={checkoutModal.paymentRecord}
          orderInfo={checkoutModal.orderInfo}
          appointmentDetails={checkoutModal.appointmentDetails}
          token={token}
        />
      )}

      {/* ========================================================
          FOOTER
          ======================================================== */}
      <footer className="php-footer">
        <div className="php-footer-inner">
          <div className="php-footer-brand">
            <div className="php-brand-logo" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>HG</div>
            <span>HealthGate Patient Gateway</span>
          </div>

          <div>
            <span>© 2026 HealthGate. Real-Time Connected Healthcare Portal.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default PatientHomePage
