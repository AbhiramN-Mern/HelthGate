import { useState, useEffect } from 'react'
import {
  savePrescriptionApi,
  getPrescriptionByAppointmentApi,
  type AppointmentItem,
  type MedicineItem,
  type PrescriptionItem,
} from '../../api/auth.api'
import { CloseIcon, CheckCircleIcon, AlertTriangleIcon } from '../common/Icons'

type PrescriptionModalProps = {
  isOpen: boolean
  onClose: () => void
  appointment: AppointmentItem | null
  token: string
  onSaved?: (prescription: PrescriptionItem) => void
}

export function PrescriptionModal({
  isOpen,
  onClose,
  appointment,
  token,
  onSaved,
}: PrescriptionModalProps) {
  const [diagnosis, setDiagnosis] = useState('')
  const [medicines, setMedicines] = useState<MedicineItem[]>([
    { name: '', dosage: '', frequency: '', duration: '', instructions: '' },
  ])
  const [additionalAdvice, setAdditionalAdvice] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Fetch existing prescription if already created for this appointment
  useEffect(() => {
    if (!isOpen || !appointment?._id) return

    let isMounted = true
    setLoading(true)
    setFeedback(null)

    getPrescriptionByAppointmentApi(appointment._id, token)
      .then((res) => {
        if (!isMounted) return
        if (res.prescription) {
          setDiagnosis(res.prescription.diagnosis || '')
          setMedicines(
            res.prescription.medicines && res.prescription.medicines.length > 0
              ? res.prescription.medicines
              : [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
          )
          setAdditionalAdvice(res.prescription.additionalAdvice || '')
          if (res.prescription.followUpDate) {
            setFollowUpDate(new Date(res.prescription.followUpDate).toISOString().split('T')[0])
          } else {
            setFollowUpDate('')
          }
        } else {
          // Reset form to blank
          setDiagnosis('')
          setMedicines([{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }])
          setAdditionalAdvice('')
          setFollowUpDate('')
        }
      })
      .catch(() => {
        // No existing prescription or load error, keep clean form
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, appointment?._id, token])

  if (!isOpen || !appointment) return null

  const handleAddMedicine = () => {
    setMedicines((prev) => [
      ...prev,
      { name: '', dosage: '', frequency: '', duration: '', instructions: '' },
    ])
  }

  const handleRemoveMedicine = (index: number) => {
    if (medicines.length <= 1) {
      setMedicines([{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }])
      return
    }
    setMedicines((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleMedicineChange = (
    index: number,
    field: keyof MedicineItem,
    value: string,
  ) => {
    setMedicines((prev) =>
      prev.map((med, idx) => (idx === index ? { ...med, [field]: value } : med)),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!appointment._id) return

    if (!diagnosis.trim()) {
      setFeedback({
        type: 'error',
        message: 'Please enter clinical notes / diagnosis before saving the prescription.',
      })
      return
    }

    const filteredMedicines = medicines.filter((m) => m.name.trim().length > 0)
    if (filteredMedicines.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Please specify at least one medicine with a valid name.',
      })
      return
    }

    setSubmitting(true)
    setFeedback(null)

    try {
      const res = await savePrescriptionApi(
        appointment._id,
        {
          diagnosis: diagnosis.trim(),
          medicines: filteredMedicines,
          additionalAdvice: additionalAdvice.trim(),
          followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null,
        },
        token,
      )

      if (res.success && res.prescription) {
        setFeedback({
          type: 'success',
          message: 'Prescription saved successfully! Patient medical records have been updated.',
        })
        if (onSaved) onSaved(res.prescription)
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        throw new Error(res.message || 'Failed to save prescription.')
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to save prescription. Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const patientName = appointment.patient?.name || 'Patient'
  const formattedDate = appointment.appointmentDate
    ? new Date(appointment.appointmentDate).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Recent Date'
  const timeSlot = appointment.timeSlot || '10:00 AM'

  return (
    <div
      className="dd-modal-overlay"
      onClick={onClose}
      role="presentation"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="dd-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          maxWidth: '740px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '28px 32px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '16px',
            marginBottom: '20px',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                color: '#0ea5a4',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Consultation Concluded
            </span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>
              Create Medical Prescription
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
            }}
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Patient & Appointment Summary Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderRadius: '12px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            marginBottom: '22px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#15803d', fontWeight: 700 }}>
              Patient
            </span>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#14532d' }}>
              {patientName}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#15803d', fontWeight: 700 }}>
              Appointment Session
            </span>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#166534' }}>
              {formattedDate} • {timeSlot}
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: feedback.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
              border: `1px solid ${feedback.type === 'success' ? '#86efac' : '#fca5a5'}`,
              fontSize: '0.88rem',
              fontWeight: 600,
            }}
          >
            {feedback.type === 'success' ? <CheckCircleIcon size={18} /> : <AlertTriangleIcon size={18} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: '#64748b' }}>Loading consultation records...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Diagnosis / Clinical Notes */}
            <div style={{ marginBottom: '22px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Diagnosis / Clinical Notes <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Enter diagnosis, symptoms, clinical observations..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Medicines List */}
            <div style={{ marginBottom: '22px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <label style={{ fontSize: '0.86rem', fontWeight: 700, color: '#334155' }}>
                  Medicines <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddMedicine}
                  style={{
                    background: '#f0fdfa',
                    color: '#0d9488',
                    border: '1px solid #99f6e4',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  + Add Medicine
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {medicines.map((med, index) => (
                  <div
                    key={index}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          color: '#0d5c63',
                          textTransform: 'uppercase',
                        }}
                      >
                        Medicine #{index + 1}
                      </span>
                      {medicines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicine(index)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                          Medicine Name *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Paracetamol"
                          value={med.name}
                          onChange={(e) => handleMedicineChange(index, 'name', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box',
                            marginTop: '3px',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                          Dosage
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 500 mg"
                          value={med.dosage}
                          onChange={(e) => handleMedicineChange(index, 'dosage', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box',
                            marginTop: '3px',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                          Frequency
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 2 times daily"
                          value={med.frequency}
                          onChange={(e) => handleMedicineChange(index, 'frequency', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box',
                            marginTop: '3px',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                          Duration
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 5 days"
                          value={med.duration}
                          onChange={(e) => handleMedicineChange(index, 'duration', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box',
                            marginTop: '3px',
                          }}
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                          Instructions
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. After food, avoid dairy, with warm water..."
                          value={med.instructions}
                          onChange={(e) => handleMedicineChange(index, 'instructions', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box',
                            marginTop: '3px',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Advice & Follow-up Date */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Additional Advice
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Rest well, hydrate, review reports..."
                  value={additionalAdvice}
                  onChange={(e) => setAdditionalAdvice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Follow-up Date (Optional)
                </label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  padding: '11px 20px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Skip for Now
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: 'linear-gradient(135deg, #0d5c63 0%, #0ea5a4 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '11px 26px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(13, 92, 99, 0.25)',
                }}
              >
                {submitting ? 'Saving Prescription...' : 'Save Prescription'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
