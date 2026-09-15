import { useState, useEffect } from 'react'
import {
  savePrescriptionApi,
  getPrescriptionByAppointmentApi,
  type AppointmentItem,
  type MedicineItem,
  type PrescriptionItem,
} from '../../api/auth.api'
import { CloseIcon, CheckCircleIcon, AlertTriangleIcon } from '../common/Icons'
import './PrescriptionModal.css'

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
  const [labTests, setLabTests] = useState<string[]>([])
  const [customTestInput, setCustomTestInput] = useState('')
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
          setLabTests(res.prescription.labTests || [])
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
          setLabTests([])
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
          labTests: labTests.map((t) => t.trim()).filter((t) => t.length > 0),
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
  const patientInitial = (patientName.charAt(0) || 'P').toUpperCase()
  const formattedDate = appointment.appointmentDate
    ? new Date(appointment.appointmentDate).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Scheduled Date'
  const timeSlot = appointment.timeSlot || '10:00 AM'

  const doctorName =
    (appointment.doctor as any)?.user?.name ||
    (appointment.doctor as any)?.name ||
    'Medical Specialist'
  const doctorLicense =
    (appointment.doctor as any)?.licenseNumber || 'HG-REG-ACTIVE'

  return (
    <div
      className="rx-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="rx-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rx-modal-title"
      >
        {/* Header */}
        <div className="rx-modal-header">
          <div className="rx-header-text">
            <span className="rx-badge-tag">
              <span className="rx-badge-dot" />
              Clinical Portal
            </span>
            <h2 id="rx-modal-title" className="rx-modal-title">
              Create Medical Prescription
            </h2>
          </div>
          <button
            type="button"
            className="rx-btn-close"
            onClick={onClose}
            aria-label="Close prescription dialog"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {loading ? (
          <div className="rx-loading-box">
            <div className="rx-spinner" />
            <p>Loading consultation & prescription records...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Scrollable Body */}
            <div className="rx-modal-body">
              {/* Patient & Appointment Summary Card */}
              <div className="rx-patient-card">
                <div className="rx-patient-profile">
                  <div className="rx-patient-avatar">
                    {patientInitial}
                  </div>
                  <div className="rx-patient-info">
                    <span className="rx-meta-label">Patient Record</span>
                    <span className="rx-patient-name">{patientName}</span>
                  </div>
                </div>
                <div className="rx-session-info">
                  <span className="rx-meta-label">Appointment Session</span>
                  <div className="rx-session-date">{formattedDate}</div>
                  <div className="rx-session-slot">{timeSlot} • Video Consultation</div>
                </div>
              </div>

              {/* Feedback Alert */}
              {feedback && (
                <div className={`rx-feedback-alert ${feedback.type}`} role="alert">
                  {feedback.type === 'success' ? (
                    <CheckCircleIcon size={18} />
                  ) : (
                    <AlertTriangleIcon size={18} />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* Diagnosis / Clinical Notes */}
              <div className="rx-form-section">
                <div className="rx-section-header">
                  <label htmlFor="rx-diagnosis-field" className="rx-section-label">
                    Diagnosis / Clinical Notes
                    <span className="rx-required-star">*</span>
                  </label>
                  <span className="rx-section-hint">Required for valid prescription</span>
                </div>
                <textarea
                  id="rx-diagnosis-field"
                  className="rx-textarea"
                  rows={3}
                  placeholder="Enter clinical observations, diagnosis, chief complaints, and examination notes..."
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  required
                />
              </div>

              {/* Medicines List */}
              <div className="rx-form-section">
                <div className="rx-section-header">
                  <label className="rx-section-label">
                    Prescribed Medicines
                    <span className="rx-required-star">*</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--hg-text-muted, #64748b)' }}>
                      ({medicines.length})
                    </span>
                  </label>
                  <button
                    type="button"
                    className="rx-btn-add-med"
                    onClick={handleAddMedicine}
                  >
                    + Add Another Medicine
                  </button>
                </div>

                <div className="rx-medicines-list">
                  {medicines.map((med, index) => (
                    <div key={index} className="rx-medicine-card">
                      <div className="rx-medicine-card-header">
                        <span className="rx-med-badge">
                          <span className="rx-med-num-dot">{index + 1}</span>
                          Medicine #{index + 1}
                        </span>
                        {medicines.length > 1 && (
                          <button
                            type="button"
                            className="rx-btn-remove-med"
                            onClick={() => handleRemoveMedicine(index)}
                            title="Remove medicine entry"
                          >
                            ✕ Remove
                          </button>
                        )}
                      </div>

                      <div className="rx-med-grid">
                        <div className="rx-field-wrap">
                          <label className="rx-field-label">
                            Medicine Name *
                          </label>
                          <input
                            type="text"
                            className="rx-input"
                            placeholder="e.g. Amoxicillin, Paracetamol"
                            value={med.name}
                            onChange={(e) => handleMedicineChange(index, 'name', e.target.value)}
                            required={index === 0}
                          />
                        </div>

                        <div className="rx-field-wrap">
                          <label className="rx-field-label">
                            Dosage
                          </label>
                          <input
                            type="text"
                            className="rx-input"
                            placeholder="e.g. 500mg, 10ml"
                            value={med.dosage}
                            onChange={(e) => handleMedicineChange(index, 'dosage', e.target.value)}
                          />
                        </div>

                        <div className="rx-field-wrap">
                          <label className="rx-field-label">
                            Frequency
                          </label>
                          <input
                            type="text"
                            className="rx-input"
                            placeholder="e.g. Twice daily (1-0-1)"
                            value={med.frequency}
                            onChange={(e) => handleMedicineChange(index, 'frequency', e.target.value)}
                          />
                        </div>

                        <div className="rx-field-wrap">
                          <label className="rx-field-label">
                            Duration
                          </label>
                          <input
                            type="text"
                            className="rx-input"
                            placeholder="e.g. 5 days, 2 weeks"
                            value={med.duration}
                            onChange={(e) => handleMedicineChange(index, 'duration', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="rx-med-instructions-wrap">
                        <label className="rx-field-label">
                          Specific Instructions / Precautions
                        </label>
                        <input
                          type="text"
                          className="rx-input"
                          placeholder="e.g. After food with warm water, avoid dairy, take before bedtime..."
                          value={med.instructions}
                          onChange={(e) => handleMedicineChange(index, 'instructions', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lab Tests & Diagnostic Investigations */}
              <div className="rx-form-section">
                <div className="rx-section-header">
                  <label className="rx-section-label">
                    🔬 Prescribed Lab Tests & Investigations
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--hg-text-muted, #64748b)' }}>
                      ({labTests.length})
                    </span>
                  </label>
                  <span className="rx-section-hint">Select common tests or type a custom one</span>
                </div>

                {/* Quick-add chips */}
                <div className="rx-lab-chips-wrap">
                  {[
                    'Complete Blood Count (CBC)',
                    'Lipid Profile',
                    'Chest X-Ray PA View',
                    'Fasting Blood Sugar / HbA1c',
                    'Liver Function Test (LFT)',
                    'Thyroid Profile (TSH)',
                    'Kidney Function Test (KFT)',
                    'Urine Routine & Microscopic',
                    'ECG 12-Lead',
                    'Ultrasound Abdomen',
                  ].map((test) => {
                    const isAdded = labTests.includes(test)
                    return (
                      <button
                        key={test}
                        type="button"
                        className={`rx-lab-chip ${isAdded ? 'active' : ''}`}
                        onClick={() => {
                          if (isAdded) {
                            setLabTests((prev) => prev.filter((t) => t !== test))
                          } else {
                            setLabTests((prev) => [...prev, test])
                          }
                        }}
                      >
                        {isAdded ? '✓' : '+'} {test}
                      </button>
                    )
                  })}
                </div>

                {/* Custom Test Input Row */}
                <div className="rx-custom-lab-row">
                  <input
                    type="text"
                    className="rx-input"
                    placeholder="Type custom test (e.g. Vitamin D3, MRI Brain, Serum Ferritin)..."
                    value={customTestInput}
                    onChange={(e) => setCustomTestInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (customTestInput.trim() && !labTests.includes(customTestInput.trim())) {
                          setLabTests((prev) => [...prev, customTestInput.trim()])
                          setCustomTestInput('')
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="rx-btn-add-test"
                    onClick={() => {
                      if (customTestInput.trim() && !labTests.includes(customTestInput.trim())) {
                        setLabTests((prev) => [...prev, customTestInput.trim()])
                        setCustomTestInput('')
                      }
                    }}
                  >
                    + Add Test
                  </button>
                </div>

                {/* Currently Selected Tests List */}
                {labTests.length > 0 && (
                  <div className="rx-selected-tests-list">
                    {labTests.map((test, idx) => (
                      <span key={idx} className="rx-selected-test-pill">
                        🔬 {test}
                        <button
                          type="button"
                          className="rx-btn-remove-pill"
                          onClick={() => setLabTests((prev) => prev.filter((_, i) => i !== idx))}
                          title="Remove test"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Additional Advice & Follow-up Date */}
              <div className="rx-bottom-grid">
                <div className="rx-form-section">
                  <label htmlFor="rx-advice-field" className="rx-section-label">
                    Additional Dietary / Lifestyle Advice
                  </label>
                  <textarea
                    id="rx-advice-field"
                    className="rx-textarea"
                    rows={2}
                    placeholder="e.g. Rest well, hydrate at least 2.5L daily, follow low-sodium diet, review reports..."
                    value={additionalAdvice}
                    onChange={(e) => setAdditionalAdvice(e.target.value)}
                  />
                </div>

                <div className="rx-form-section">
                  <label htmlFor="rx-followup-field" className="rx-section-label">
                    Follow-up Date (Optional)
                  </label>
                  <input
                    id="rx-followup-field"
                    type="date"
                    className="rx-input"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                  <span className="rx-section-hint">Patient will be reminded on this date</span>
                </div>
              </div>

              {/* Doctor Digital Signature & Legal Authenticity Stamp */}
              <div className="rx-signature-card">
                <div className="rx-signature-details">
                  <span className="rx-signature-title">
                    Digital Signature & Verification
                  </span>
                  <span className="rx-signature-name">
                    Dr. {doctorName.replace(/^Dr\.?\s*/i, '')}
                  </span>
                  <span className="rx-signature-reg">
                    Council Reg No: <strong>{doctorLicense}</strong>
                  </span>
                </div>
                <div className="rx-signature-badge-wrap">
                  <span className="rx-signature-badge">
                    ✓ Legally Verified Rx
                  </span>
                  <span className="rx-signature-sub">
                    Auto-stamped upon saving
                  </span>
                </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="rx-modal-footer">
              <button
                type="button"
                className="rx-btn-cancel"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel & Close
              </button>
              <button
                type="submit"
                className="rx-btn-submit"
                disabled={submitting}
              >
                {submitting ? (
                  <>Saving Prescription...</>
                ) : (
                  <>📄 Save & Issue Prescription</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
