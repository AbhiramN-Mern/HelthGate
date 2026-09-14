import { useState, useEffect } from 'react'
import {
  getPrescriptionByAppointmentApi,
  type PrescriptionItem,
} from '../../api/auth.api'
import { CloseIcon, AlertTriangleIcon } from '../common/Icons'

type PatientPrescriptionModalProps = {
  isOpen: boolean
  onClose: () => void
  appointmentId?: string
  prescription?: PrescriptionItem | null
  token: string
  fallbackPatientName?: string
}

export function PatientPrescriptionModal({
  isOpen,
  onClose,
  appointmentId,
  prescription: initialPrescription,
  token,
  fallbackPatientName,
}: PatientPrescriptionModalProps) {
  const [viewingPrescription, setViewingPrescription] = useState<PrescriptionItem | null>(
    initialPrescription || null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    if (initialPrescription) {
      setViewingPrescription(initialPrescription)
      setError(null)
      return
    }

    if (!appointmentId) return

    let isMounted = true
    setLoading(true)
    setError(null)

    getPrescriptionByAppointmentApi(appointmentId, token)
      .then((res) => {
        if (!isMounted) return
        if (res.prescription) {
          setViewingPrescription(res.prescription)
        } else {
          setError('A prescription has not been issued yet for this consultation.')
          setViewingPrescription(null)
        }
      })
      .catch((err: any) => {
        if (!isMounted) return
        setError(err.message || 'Unable to load prescription.')
        setViewingPrescription(null)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, appointmentId, initialPrescription, token])

  if (!isOpen) return null

  return (
    <div
      className="php-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="php-modal-card"
        style={{
          maxWidth: '680px',
          padding: '28px 32px',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="php-btn-close"
          onClick={onClose}
          aria-label="Close prescription"
        >
          <CloseIcon size={16} />
        </button>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div className="php-loading-spinner" style={{ margin: '0 auto 16px auto' }} />
            <h3 style={{ fontSize: '1.1rem', color: '#0f172a', margin: '0 0 6px 0' }}>
              Loading Medical Prescription...
            </h3>
            <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
              Retrieving consultation notes and doctor's prescribed medicines safely.
            </p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <AlertTriangleIcon size={28} />
            </div>
            <h3 style={{ fontSize: '1.15rem', color: '#0f172a', margin: '0 0 8px 0' }}>
              Prescription Notice
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              {error}
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#0d5c63',
                color: '#ffffff',
                border: 'none',
                padding: '9px 24px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        ) : viewingPrescription ? (
          <div className="php-prescription-sheet">
            {/* Clinic Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '2px solid #0d5c63',
                paddingBottom: '16px',
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #0d5c63 0%, #0ea5a4 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '1.3rem',
                    fontFamily: 'serif',
                  }}
                >
                  Rx
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0d5c63', margin: 0 }}>
                    HealthGate Medical Center
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Official Consultation Prescription
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#64748b' }}>
                <div>
                  <strong>Date: </strong>
                  {viewingPrescription.createdAt
                    ? new Date(viewingPrescription.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Recent'}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                  ID: #{viewingPrescription._id?.slice(-8).toUpperCase()}
                </div>
              </div>
            </div>

            {/* Doctor & Patient Info Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                padding: '14px 16px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '20px',
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Attending Doctor
                </span>
                <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a', marginTop: '2px' }}>
                  {typeof viewingPrescription.doctor === 'object'
                    ? (viewingPrescription.doctor as any)?.user?.name || (viewingPrescription.doctor as any)?.name || 'Dr. Specialist'
                    : 'Doctor'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#0ea5a4', fontWeight: 600 }}>
                  {typeof viewingPrescription.doctor === 'object'
                    ? (viewingPrescription.doctor as any)?.specialization || 'General Practice'
                    : 'Specialist'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Patient Name
                </span>
                <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a', marginTop: '2px' }}>
                  {typeof viewingPrescription.patient === 'object'
                    ? (viewingPrescription.patient as any)?.name || fallbackPatientName || 'Patient'
                    : fallbackPatientName || 'Patient'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {typeof viewingPrescription.patient === 'object'
                    ? (viewingPrescription.patient as any)?.email || ''
                    : ''}
                </div>
              </div>
            </div>

            {/* Diagnosis / Clinical Notes */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: '#475569', fontWeight: 800, letterSpacing: '0.5px', margin: '0 0 6px 0' }}>
                Diagnosis & Clinical Findings
              </h4>
              <div
                style={{
                  padding: '12px 14px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  fontSize: '0.92rem',
                  color: '#166534',
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                {viewingPrescription.diagnosis}
              </div>
            </div>

            {/* Prescribed Medicines Table */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: '#475569', fontWeight: 800, letterSpacing: '0.5px', margin: '0 0 8px 0' }}>
                Prescribed Medicines ({viewingPrescription.medicines?.length || 0})
              </h4>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', color: '#334155', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px' }}>#</th>
                      <th style={{ padding: '10px 12px' }}>Medicine</th>
                      <th style={{ padding: '10px 12px' }}>Dosage</th>
                      <th style={{ padding: '10px 12px' }}>Frequency</th>
                      <th style={{ padding: '10px 12px' }}>Duration</th>
                      <th style={{ padding: '10px 12px' }}>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingPrescription.medicines?.map((med, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>{med.name}</td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>{med.dosage || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>{med.frequency || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>{med.duration || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#0d9488', fontWeight: 600 }}>{med.instructions || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Additional Advice & Follow-up */}
            {(viewingPrescription.additionalAdvice || viewingPrescription.followUpDate) && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: viewingPrescription.additionalAdvice && viewingPrescription.followUpDate ? '1fr 1fr' : '1fr',
                  gap: '14px',
                  marginBottom: '22px',
                }}
              >
                {viewingPrescription.additionalAdvice && (
                  <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                      Doctor's Advice
                    </span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: '#334155', lineHeight: 1.4 }}>
                      {viewingPrescription.additionalAdvice}
                    </p>
                  </div>
                )}

                {viewingPrescription.followUpDate && (
                  <div style={{ padding: '12px 14px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                    <span style={{ fontSize: '0.72rem', color: '#0284c7', textTransform: 'uppercase', fontWeight: 700 }}>
                      Recommended Follow-up
                    </span>
                    <div style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#0369a1', fontWeight: 700 }}>
                      {new Date(viewingPrescription.followUpDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                🖨️ Print Prescription
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#0d5c63',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 22px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(13, 92, 99, 0.25)',
                }}
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
