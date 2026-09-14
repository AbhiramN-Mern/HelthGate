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
  onBookFollowUp?: (doctor: any, followUpDate: string, diagnosis?: string) => void
}

export function PatientPrescriptionModal({
  isOpen,
  onClose,
  appointmentId,
  prescription: initialPrescription,
  token,
  fallbackPatientName,
  onBookFollowUp,
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

            {/* Prescribed Lab Tests & Diagnostic Investigations */}
            {viewingPrescription.labTests && viewingPrescription.labTests.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: '#475569', fontWeight: 800, letterSpacing: '0.5px', margin: '0 0 8px 0' }}>
                  🔬 Prescribed Lab Tests & Investigations ({viewingPrescription.labTests.length})
                </h4>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    padding: '12px 16px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '12px',
                  }}
                >
                  {viewingPrescription.labTests.map((test, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        background: '#ffffff',
                        border: '1px solid #86efac',
                        borderRadius: '20px',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        color: '#166534',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <span style={{ fontSize: '0.9rem' }}>🧪</span> {test}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
                  <div style={{ padding: '14px 16px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                    <span style={{ fontSize: '0.72rem', color: '#0284c7', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
                      Recommended Follow-up
                    </span>
                    <div style={{ margin: '4px 0 8px 0', fontSize: '0.95rem', color: '#0369a1', fontWeight: 800 }}>
                      {new Date(viewingPrescription.followUpDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                    {onBookFollowUp && (
                      <button
                        type="button"
                        onClick={() => {
                          const dateStr = new Date(viewingPrescription.followUpDate!).toISOString().split('T')[0]
                          onBookFollowUp(
                            viewingPrescription.doctor,
                            dateStr,
                            `Follow-up consultation: ${viewingPrescription.diagnosis || 'Post-consultation review'}`,
                          )
                          onClose()
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                        }}
                      >
                        📅 Book Follow-up for {new Date(viewingPrescription.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Doctor's Digital Signature & Medical License Stamp */}
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1.5px dashed #cbd5e1',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, letterSpacing: '0.5px' }}>
                  Doctor's Digital Signature & Authenticity Seal
                </span>
                <div style={{ fontFamily: 'cursive', fontSize: '1.35rem', color: '#0d5c63', fontWeight: 800, margin: '2px 0' }}>
                  Dr. {typeof viewingPrescription.doctor === 'object'
                    ? (viewingPrescription.doctor as any)?.user?.name || (viewingPrescription.doctor as any)?.name || 'Specialist'
                    : 'Specialist'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                  Medical Council Reg. No:{' '}
                  <strong style={{ color: '#0d5c63' }}>
                    {typeof viewingPrescription.doctor === 'object'
                      ? (viewingPrescription.doctor as any)?.licenseNumber || 'HG-REG-ACTIVE'
                      : 'HG-REG-ACTIVE'}
                  </strong>{' '}
                  • HealthGate Verified Prescriber
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    background: '#dcfce7',
                    border: '1px solid #86efac',
                    color: '#15803d',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                  }}
                >
                  ✓ Digitally Signed & Authenticated
                </span>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '3px' }}>
                  Valid for all accredited pharmacies & laboratories
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  const docName = typeof viewingPrescription.doctor === 'object'
                    ? (viewingPrescription.doctor as any)?.user?.name || (viewingPrescription.doctor as any)?.name || 'Dr. Specialist'
                    : 'Doctor'
                  const docSpec = typeof viewingPrescription.doctor === 'object'
                    ? (viewingPrescription.doctor as any)?.specialization || 'General Practice'
                    : 'Specialist'
                  const docLicense = typeof viewingPrescription.doctor === 'object'
                    ? (viewingPrescription.doctor as any)?.licenseNumber || 'HG-REG-ACTIVE'
                    : 'HG-REG-ACTIVE'
                  const patName = typeof viewingPrescription.patient === 'object'
                    ? (viewingPrescription.patient as any)?.name || fallbackPatientName || 'Patient'
                    : fallbackPatientName || 'Patient'
                  const rxDate = viewingPrescription.createdAt
                    ? new Date(viewingPrescription.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric'
                      })
                    : new Date().toLocaleDateString('en-US')
                  const followUpStr = viewingPrescription.followUpDate
                    ? new Date(viewingPrescription.followUpDate).toLocaleDateString('en-US', {
                        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                      })
                    : ''

                  const printWindow = window.open('', '_blank')
                  if (!printWindow) {
                    window.print()
                    return
                  }

                  const medsHtml = (viewingPrescription.medicines || [])
                    .map((m, idx) => `
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 12px; font-weight: 700; color: #64748b;">${idx + 1}</td>
                        <td style="padding: 10px 12px; font-weight: 800; color: #0f172a;">${m.name}</td>
                        <td style="padding: 10px 12px; color: #334155;">${m.dosage || '—'}</td>
                        <td style="padding: 10px 12px; color: #334155;">${m.frequency || '—'}</td>
                        <td style="padding: 10px 12px; color: #334155;">${m.duration || '—'}</td>
                        <td style="padding: 10px 12px; color: #0d9488; font-weight: 600;">${m.instructions || '—'}</td>
                      </tr>
                    `).join('')

                  const testsHtml = viewingPrescription.labTests && viewingPrescription.labTests.length > 0
                    ? `
                      <div style="margin-top: 20px; padding: 14px 18px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; color: #166534; font-weight: 800;">
                          🔬 Prescribed Lab Tests & Diagnostic Investigations
                        </h4>
                        <ul style="margin: 0; padding-left: 20px; color: #14532d; font-size: 13px; line-height: 1.6;">
                          ${viewingPrescription.labTests.map(t => `<li><strong>${t}</strong></li>`).join('')}
                        </ul>
                      </div>
                    `
                    : ''

                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <title>HealthGate_Prescription_${(viewingPrescription._id || '').slice(-8).toUpperCase()}</title>
                      <style>
                        @page { size: A4 portrait; margin: 15mm; }
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 20px; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0d5c63; padding-bottom: 16px; margin-bottom: 20px; }
                        .rx-badge { width: 44px; height: 44px; background: #0d5c63; color: white; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; font-family: serif; border-radius: 8px; }
                        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 16px; border-radius: 10px; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 12px; text-transform: uppercase; color: #475569; }
                        .signature-box { margin-top: 30px; display: flex; justify-content: space-between; align-items: center; border-top: 2px dashed #cbd5e1; padding-top: 16px; }
                      </style>
                    </head>
                    <body>
                      <div class="header">
                        <div style="display: flex; align-items: center; gap: 12px;">
                          <div class="rx-badge">Rx</div>
                          <div>
                            <h1 style="margin: 0; font-size: 20px; color: #0d5c63; font-weight: 900;">HEALTHGATE MEDICAL CENTER</h1>
                            <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Official Consultation Prescription</span>
                          </div>
                        </div>
                        <div style="text-align: right; font-size: 13px; color: #475569;">
                          <div><strong>Date:</strong> ${rxDate}</div>
                          <div style="font-size: 11px; color: #94a3b8;">Ref: #${(viewingPrescription._id || '').slice(-8).toUpperCase()}</div>
                        </div>
                      </div>

                      <div class="meta-grid">
                        <div>
                          <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Attending Doctor</span>
                          <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">Dr. ${docName}</div>
                          <div style="font-size: 12px; color: #0d9488; font-weight: 600;">${docSpec} • Reg No: ${docLicense}</div>
                        </div>
                        <div>
                          <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Patient Name</span>
                          <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">${patName}</div>
                          <div style="font-size: 12px; color: #64748b;">Consultation ID: ${(viewingPrescription.appointment as any)?._id || viewingPrescription.appointment || ''}</div>
                        </div>
                      </div>

                      <div style="margin-bottom: 20px; padding: 12px 16px; background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
                        <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #15803d;">Clinical Diagnosis & Notes</span>
                        <div style="font-size: 14px; font-weight: 700; color: #166534; margin-top: 4px;">${viewingPrescription.diagnosis}</div>
                      </div>

                      <h4 style="margin: 0 0 6px 0; font-size: 13px; text-transform: uppercase; color: #475569; font-weight: 800;">Prescribed Medicines</h4>
                      <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
                        <table>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Medicine</th>
                              <th>Dosage</th>
                              <th>Frequency</th>
                              <th>Duration</th>
                              <th>Instructions</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${medsHtml}
                          </tbody>
                        </table>
                      </div>

                      ${testsHtml}

                      ${viewingPrescription.additionalAdvice ? `
                        <div style="margin-top: 16px; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                          <strong style="font-size: 12px; text-transform: uppercase; color: #475569;">Clinical Advice:</strong>
                          <p style="margin: 4px 0 0 0; font-size: 13px; color: #334155;">${viewingPrescription.additionalAdvice}</p>
                        </div>
                      ` : ''}

                      ${followUpStr ? `
                        <div style="margin-top: 12px; padding: 10px 14px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;">
                          <strong style="font-size: 12px; text-transform: uppercase; color: #0284c7;">Recommended Follow-Up Date:</strong>
                          <span style="font-size: 13px; font-weight: 700; color: #0369a1; margin-left: 8px;">${followUpStr}</span>
                        </div>
                      ` : ''}

                      <div class="signature-box">
                        <div>
                          <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b;">Medical Authority Seal</div>
                          <div style="font-size: 14px; font-weight: 800; color: #0d5c63; margin-top: 4px;">HealthGate Clinical Care</div>
                          <div style="font-size: 11px; color: #94a3b8;">Authentic Electronically Certified Document</div>
                        </div>
                        <div style="text-align: right;">
                          <div style="font-family: cursive; font-size: 18px; color: #0d5c63; font-weight: bold;">Dr. ${docName}</div>
                          <div style="font-size: 12px; color: #15803d; font-weight: 700;">✓ Digitally Signed & Authenticated</div>
                          <div style="font-size: 11px; color: #64748b;">Reg No: ${docLicense}</div>
                        </div>
                      </div>
                      <script>
                        window.onload = function() { window.print(); }
                      </script>
                    </body>
                    </html>
                  `)
                  printWindow.document.close()
                }}
                style={{
                  background: 'linear-gradient(135deg, #0d5c63 0%, #0ea5a4 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(13, 92, 99, 0.25)',
                }}
              >
                📄 Download PDF
              </button>
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
                  background: '#334155',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 22px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
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
