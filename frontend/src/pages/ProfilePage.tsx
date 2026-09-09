import { useEffect, useState, useId } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getMyDoctorProfile,
  getMyPatientProfile,
  type DoctorProfile,
  type PatientProfile,
  updateDoctorProfile,
  updatePatientProfile,
} from '../api/auth.api'
import {
  UserIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  CloseIcon,
  ShieldCheckIcon,
  HeartPulseIcon,
  StethoscopeIcon,
  HospitalIcon,
  CalendarIcon,
  CreditCardIcon,
  AwardIcon,
} from '../components/common/Icons'
import './ProfilePage.css'

type ProfilePageProps = {
  user?: {
    name?: string
    email?: string
    role?: string
  } | null
  onLogout: () => void
  onRequireAuth: () => void
}

type PatientFormState = {
  dateOfBirth: string
  gender: string
  phone: string
  address: string
  profileImage: string
  bloodGroup: string
  allergies: string
  medicalHistory: string
}

type DoctorFormState = {
  specialization: string
  qualification: string
  profileImage: string
  experienceYears: string
  licenseNumber: string
  consultationFee: string
  available: boolean
}

const defaultPatientForm: PatientFormState = {
  dateOfBirth: '',
  gender: 'male',
  phone: '',
  address: '',
  profileImage: '',
  bloodGroup: 'A+',
  allergies: '',
  medicalHistory: '',
}

const defaultDoctorForm: DoctorFormState = {
  specialization: '',
  qualification: '',
  profileImage: '',
  experienceYears: '0',
  licenseNumber: '',
  consultationFee: '0',
  available: true,
}

const normalizeList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

function ProfilePage({ user, onLogout, onRequireAuth }: ProfilePageProps) {
  const navigate = useNavigate()
  const role = user?.role || 'patient'
  const fileInputId = useId()

  const [activeTab, setActiveTab] = useState<'personal' | 'clinical' | 'security'>('personal')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null)
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null)
  const [patientForm, setPatientForm] = useState<PatientFormState>(defaultPatientForm)
  const [doctorForm, setDoctorForm] = useState<DoctorFormState>(defaultDoctorForm)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const todayDateString = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    const token = localStorage.getItem('helthgate_token')
    if (!token) {
      onRequireAuth()
      return
    }

    const fetchProfile = async () => {
      try {
        setLoading(true)
        setErrorMessage('')

        if (role === 'doctor') {
          const data = await getMyDoctorProfile(token)
          const profile = data.doctor ?? null
          setDoctorProfile(profile)

          if (profile) {
            setDoctorForm({
              specialization: profile.specialization || '',
              qualification: profile.qualification || '',
              profileImage: profile.profileImage || '',
              experienceYears: String(profile.experienceYears ?? 0),
              licenseNumber: profile.licenseNumber || '',
              consultationFee: String(profile.consultationFee ?? 0),
              available: profile.available !== false,
            })
          }
        } else if (role === 'patient') {
          const data = await getMyPatientProfile(token)
          const profile = data.patient ?? null
          setPatientProfile(profile)

          if (profile) {
            setPatientForm({
              dateOfBirth: profile.dateOfBirth
                ? new Date(profile.dateOfBirth).toISOString().slice(0, 10)
                : '',
              gender: profile.gender || 'male',
              phone: profile.phone || '',
              address: profile.address || '',
              profileImage: profile.profileImage || '',
              bloodGroup: profile.bloodGroup || 'A+',
              allergies: (profile.allergies || []).join(', '),
              medicalHistory: (profile.medicalHistory || []).join(', '),
            })
          }
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load profile data.',
        )
      } finally {
        setLoading(false)
      }
    }

    void fetchProfile()
  }, [onRequireAuth, role])

  // Compute profile completeness percentage
  const computeCompleteness = () => {
    if (role === 'doctor') {
      let filled = 2 // name + email
      if (doctorForm.specialization) filled++
      if (doctorForm.qualification) filled++
      if (doctorForm.licenseNumber) filled++
      if (Number(doctorForm.experienceYears) > 0) filled++
      if (Number(doctorForm.consultationFee) > 0) filled++
      if (doctorForm.profileImage) filled++
      return Math.round((filled / 8) * 100)
    }
    if (role === 'patient') {
      let filled = 2 // name + email
      if (patientForm.phone) filled++
      if (patientForm.address) filled++
      if (patientForm.dateOfBirth) filled++
      if (patientForm.bloodGroup) filled++
      if (patientForm.allergies) filled++
      if (patientForm.profileImage) filled++
      return Math.round((filled / 8) * 100)
    }
    return 100 // Admin
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedImageFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      if (role === 'doctor') {
        setDoctorForm((prev) => ({ ...prev, profileImage: dataUrl }))
      } else {
        setPatientForm((prev) => ({ ...prev, profileImage: dataUrl }))
      }
    }
    reader.readAsDataURL(file)
  }

  const handlePatientSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const token = localStorage.getItem('helthgate_token')
    if (!token) {
      onRequireAuth()
      return
    }

    try {
      if (patientForm.dateOfBirth && patientForm.dateOfBirth > todayDateString) {
        setErrorMessage('Date of birth cannot be in the future.')
        return
      }

      setSaving(true)
      setErrorMessage('')
      setSuccessMessage('')

      const payload: Record<string, unknown> = {
        dateOfBirth: patientForm.dateOfBirth || undefined,
        gender: patientForm.gender || undefined,
        phone: patientForm.phone || undefined,
        address: patientForm.address || undefined,
        bloodGroup: patientForm.bloodGroup || undefined,
        allergies: normalizeList(patientForm.allergies),
        medicalHistory: normalizeList(patientForm.medicalHistory),
      }

      if (selectedImageFile) {
        payload.profileImage = selectedImageFile
      }

      const data = await updatePatientProfile(payload, token)
      setPatientProfile(data.patient ?? null)
      if (data.patient?.profileImage) {
        setPatientForm((cur) => ({ ...cur, profileImage: data.patient?.profileImage || cur.profileImage }))
      }
      setSuccessMessage(data.message || 'Profile changes saved successfully!')
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to update patient profile.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDoctorSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const token = localStorage.getItem('helthgate_token')
    if (!token) {
      onRequireAuth()
      return
    }

    try {
      setSaving(true)
      setErrorMessage('')
      setSuccessMessage('')

      const payload: Record<string, unknown> = {
        specialization: doctorForm.specialization || undefined,
        qualification: doctorForm.qualification || undefined,
        experienceYears: Number(doctorForm.experienceYears) || 0,
        licenseNumber: doctorForm.licenseNumber || undefined,
        consultationFee: Number(doctorForm.consultationFee) || 0,
        available: doctorForm.available,
      }

      if (selectedImageFile) {
        payload.profileImage = selectedImageFile
      }

      const data = await updateDoctorProfile(payload, token)
      setDoctorProfile(data.doctor ?? null)
      if (data.doctor?.profileImage) {
        setDoctorForm((cur) => ({ ...cur, profileImage: data.doctor?.profileImage || cur.profileImage }))
      }
      setSuccessMessage(data.message || 'Doctor credentials saved successfully!')
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to update doctor profile.',
      )
    } finally {
      setSaving(false)
    }
  }

  const getDashboardPath = () => {
    if (role === 'admin') return '/admin'
    if (role === 'doctor') return '/doctor/dashboard'
    return '/patient/home'
  }

  const activeAvatar =
    role === 'doctor'
      ? doctorForm.profileImage ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Doctor')}&background=0d5c63&color=ffffff`
      : role === 'patient'
      ? patientForm.profileImage ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Patient')}&background=0d5c63&color=ffffff`
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Admin')}&background=0d5c63&color=ffffff`

  const completeness = computeCompleteness()

  return (
    <div className="pf-page">
      {/* ========================================================
          1. TOP NAVIGATION HEADER
          ======================================================== */}
      <header className="pf-header">
        <div className="pf-header-inner">
          <div className="pf-header-brand" onClick={() => navigate(getDashboardPath())}>
            <div className="pf-logo-badge">HG</div>
            <div className="pf-brand-info">
              <span className="pf-brand-title">HealthGate</span>
              <span className="pf-brand-sub">Account & Profile Settings</span>
            </div>
          </div>

          <div className="pf-header-actions">
            <button
              type="button"
              className="pf-back-btn"
              onClick={() => navigate(getDashboardPath())}
              title="Return to your primary dashboard"
            >
              ← Back to {role === 'admin' ? 'Admin Console' : role === 'doctor' ? 'Doctor Portal' : 'Patient Home'}
            </button>
            <button type="button" className="pf-logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          2. MAIN CONTENT BODY
          ======================================================== */}
      <main className="pf-container">
        {/* HERO BANNER CARD */}
        <div className="pf-hero-card">
          <div className="pf-hero-cover" />
          <div className="pf-hero-body">
            <div className="pf-avatar-wrapper">
              <div className="pf-avatar-box">
                <img className="pf-avatar-img" src={activeAvatar} alt={user?.name || 'Profile'} />
                {role !== 'admin' && (
                  <label htmlFor={fileInputId} className="pf-avatar-upload-trigger" title="Upload new profile picture">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <input
                      id={fileInputId}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageChange}
                    />
                  </label>
                )}
              </div>

              <div className="pf-hero-identity">
                <div className="pf-hero-name-row">
                  <h1 className="pf-hero-name">{user?.name || 'Healthcare User'}</h1>
                  <span className="pf-verified-badge">
                    <ShieldCheckIcon size={14} /> Verified {role === 'doctor' ? 'Practitioner' : role === 'admin' ? 'Administrator' : 'Patient'}
                  </span>
                </div>
                <div className="pf-hero-meta">
                  <span className="pf-meta-pill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    {user?.email || 'N/A'}
                  </span>
                  <span className="pf-meta-pill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 14 14" />
                    </svg>
                    Member since {new Date().getFullYear()}
                  </span>
                </div>
              </div>
            </div>

            <div className="pf-hero-badges">
              {role === 'patient' && (
                <div className="pf-stat-card">
                  <span className="pf-stat-val" style={{ color: '#b91c1c' }}>
                    {patientForm.bloodGroup || 'A+'}
                  </span>
                  <span className="pf-stat-label">Blood Type</span>
                </div>
              )}

              {role === 'doctor' && (
                <>
                  <div className="pf-stat-card">
                    <span className="pf-stat-val">
                      {doctorForm.experienceYears || '0'} yrs
                    </span>
                    <span className="pf-stat-label">Experience</span>
                  </div>
                  <div className="pf-stat-card">
                    <span className="pf-stat-val" style={{ color: '#047857' }}>
                      ${doctorForm.consultationFee || '0'}
                    </span>
                    <span className="pf-stat-label">Fee / Slot</span>
                  </div>
                </>
              )}

              <div className="pf-stat-card">
                <span className="pf-stat-val">{completeness}%</span>
                <span className="pf-stat-label">Profile Score</span>
              </div>
            </div>
          </div>
        </div>

        {/* FEEDBACK BANNERS */}
        {successMessage && (
          <div className="pf-alert success">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircleIcon size={18} />
              <span>{successMessage}</span>
            </div>
            <button type="button" className="pf-alert-close" onClick={() => setSuccessMessage('')}>
              <CloseIcon size={16} />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="pf-alert error">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircleIcon size={18} />
              <span>{errorMessage}</span>
            </div>
            <button type="button" className="pf-alert-close" onClick={() => setErrorMessage('')}>
              <CloseIcon size={16} />
            </button>
          </div>
        )}

        {/* TWO-COLUMN WORKSPACE */}
        <div className="pf-grid">
          {/* LEFT: TABS & INTERACTIVE FORM */}
          <div className="pf-main-card">
            <div className="pf-tabs-bar">
              <button
                type="button"
                className={`pf-tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
                onClick={() => setActiveTab('personal')}
              >
                <UserIcon size={16} />
                <span>Personal Information</span>
              </button>

              <button
                type="button"
                className={`pf-tab-btn ${activeTab === 'clinical' ? 'active' : ''}`}
                onClick={() => setActiveTab('clinical')}
              >
                {role === 'doctor' ? <StethoscopeIcon size={16} /> : role === 'admin' ? <ShieldCheckIcon size={16} /> : <HeartPulseIcon size={16} />}
                <span>{role === 'doctor' ? 'Clinical Credentials' : role === 'admin' ? 'Admin Privileges' : 'Medical Details'}</span>
              </button>

              <button
                type="button"
                className={`pf-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => setActiveTab('security')}
              >
                <ShieldCheckIcon size={16} />
                <span>Account & Security</span>
              </button>
            </div>

            <div className="pf-form-body">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
                  <div className="pf-spinner" style={{ margin: '0 auto 12px', borderColor: '#0d5c63', borderTopColor: 'transparent' }} />
                  <p>Loading your healthcare profile credentials...</p>
                </div>
              ) : role === 'admin' ? (
                /* ADMIN VIEW */
                <div>
                  <div className="pf-section-header">
                    <h2 className="pf-section-title">Administrator System Authority</h2>
                    <p className="pf-section-desc">
                      Master governance credentials and operational permissions for the HealthGate network.
                    </p>
                  </div>

                  <div className="pf-form-grid">
                    <div className="pf-field-group">
                      <label className="pf-label">Official Name</label>
                      <input className="pf-input" type="text" value={user?.name || 'Administrator'} disabled />
                    </div>

                    <div className="pf-field-group">
                      <label className="pf-label">System Email</label>
                      <input className="pf-input" type="email" value={user?.email || 'admin@healthgate.com'} disabled />
                    </div>

                    <div className="pf-field-group">
                      <label className="pf-label">Administrative Role</label>
                      <input className="pf-input" type="text" value="Super Administrator" disabled />
                    </div>

                    <div className="pf-field-group">
                      <label className="pf-label">Access Status</label>
                      <input className="pf-input" type="text" value="Active • Full Master Governance" disabled />
                    </div>

                    <div className="pf-field-full" style={{ marginTop: '12px' }}>
                      <div className="pf-switch-card">
                        <div className="pf-switch-info">
                          <span className="pf-switch-title">Administrative Audit Logging</span>
                          <span className="pf-switch-sub">
                            All user moderation, practitioner approvals, and financial overrides are cryptographically logged.
                          </span>
                        </div>
                        <span className="pf-pill green">Active</span>
                      </div>
                    </div>
                  </div>

                  <div className="pf-form-footer">
                    <button
                      type="button"
                      className="pf-btn-primary"
                      onClick={() => navigate('/admin')}
                    >
                      Open Executive Dashboard →
                    </button>
                  </div>
                </div>
              ) : role === 'doctor' ? (
                /* DOCTOR FORM */
                <form onSubmit={handleDoctorSubmit}>
                  {activeTab === 'personal' && (
                    <div>
                      <div className="pf-section-header">
                        <h2 className="pf-section-title">Practitioner Profile</h2>
                        <p className="pf-section-desc">
                          Manage personal contact information and public practitioner details.
                        </p>
                      </div>

                      <div className="pf-form-grid">
                        <div className="pf-field-group">
                          <label className="pf-label">Full Name</label>
                          <input className="pf-input" type="text" value={user?.name || ''} disabled title="Managed by user account" />
                        </div>

                        <div className="pf-field-group">
                          <label className="pf-label">Email Address</label>
                          <input className="pf-input" type="email" value={user?.email || ''} disabled title="Managed by user account" />
                        </div>

                        <div className="pf-field-group">
                          <label className="pf-label">Primary Specialization</label>
                          <div className="pf-input-wrap">
                            <span className="pf-input-icon"><StethoscopeIcon size={16} /></span>
                            <input
                              className="pf-input"
                              type="text"
                              placeholder="e.g. Cardiology, Pediatrics"
                              value={doctorForm.specialization}
                              onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="pf-field-group">
                          <label className="pf-label">Medical Degree / Qualifications</label>
                          <div className="pf-input-wrap">
                            <span className="pf-input-icon"><AwardIcon size={16} /></span>
                            <input
                              className="pf-input"
                              type="text"
                              placeholder="e.g. MBBS, MD, FACS"
                              value={doctorForm.qualification}
                              onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'clinical' && (
                    <div>
                      <div className="pf-section-header">
                        <h2 className="pf-section-title">Clinical Practice & Licensing</h2>
                        <p className="pf-section-desc">
                          Verified credentials, consultation scheduling tariffs, and availability settings.
                        </p>
                      </div>

                      <div className="pf-form-grid">
                        <div className="pf-field-group">
                          <label className="pf-label">Medical License Number</label>
                          <div className="pf-input-wrap">
                            <span className="pf-input-icon"><ShieldCheckIcon size={16} /></span>
                            <input
                              className="pf-input"
                              type="text"
                              placeholder="e.g. LIC-2026-9874"
                              value={doctorForm.licenseNumber}
                              onChange={(e) => setDoctorForm({ ...doctorForm, licenseNumber: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="pf-field-group">
                          <label className="pf-label">Years in Clinical Practice</label>
                          <div className="pf-input-wrap">
                            <span className="pf-input-icon"><CalendarIcon size={16} /></span>
                            <input
                              className="pf-input"
                              type="number"
                              min="0"
                              max="60"
                              value={doctorForm.experienceYears}
                              onChange={(e) => setDoctorForm({ ...doctorForm, experienceYears: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="pf-field-group">
                          <label className="pf-label">Consultation Slot Fee (USD $)</label>
                          <div className="pf-input-wrap">
                            <span className="pf-input-icon"><CreditCardIcon size={16} /></span>
                            <input
                              className="pf-input"
                              type="number"
                              min="0"
                              step="5"
                              value={doctorForm.consultationFee}
                              onChange={(e) => setDoctorForm({ ...doctorForm, consultationFee: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="pf-field-group">
                          <label className="pf-label">Affiliated Hospital</label>
                          <div className="pf-input-wrap">
                            <span className="pf-input-icon"><HospitalIcon size={16} /></span>
                            <input
                              className="pf-input"
                              type="text"
                              value={doctorProfile?.hospital?.name || 'Independent Practice'}
                              disabled
                            />
                          </div>
                        </div>

                        <div className="pf-field-full">
                          <div className="pf-switch-card">
                            <div className="pf-switch-info">
                              <span className="pf-switch-title">Appointment Availability</span>
                              <span className="pf-switch-sub">
                                When enabled, registered patients can discover and reserve consultation slots.
                              </span>
                            </div>
                            <label className="pf-toggle-switch">
                              <input
                                type="checkbox"
                                checked={doctorForm.available}
                                onChange={(e) => setDoctorForm({ ...doctorForm, available: e.target.checked })}
                              />
                              <span className="pf-toggle-slider" />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'security' && (
                    <div>
                      <div className="pf-section-header">
                        <h2 className="pf-section-title">Security & Practitioner Verification</h2>
                        <p className="pf-section-desc">
                          Manage access authentication and clinical credentials compliance.
                        </p>
                      </div>

                      <div className="pf-form-grid">
                        <div className="pf-field-group">
                          <label className="pf-label">Verification Status</label>
                          <span
                            className={`pf-pill ${
                              doctorProfile?.verificationStatus === 'verified'
                                ? 'green'
                                : doctorProfile?.verificationStatus === 'rejected'
                                ? 'red'
                                : 'amber'
                            }`}
                            style={{ width: 'fit-content', padding: '6px 14px' }}
                          >
                            {doctorProfile?.verificationStatus
                              ? doctorProfile.verificationStatus.toUpperCase()
                              : 'PENDING VERIFICATION'}
                          </span>
                        </div>

                        <div className="pf-field-group">
                          <label className="pf-label">HIPAA / Data Compliance</label>
                          <span className="pf-pill green" style={{ width: 'fit-content', padding: '6px 14px' }}>
                            ENCRYPTED & PROTECTED
                          </span>
                        </div>

                        <div className="pf-field-full" style={{ marginTop: '10px' }}>
                          <p style={{ fontSize: '0.84rem', color: '#64748b', lineHeight: 1.6 }}>
                            Your practitioner session token is securely stored and authenticated with HealthGate API gateways.
                            To reset your login password, please proceed via authentication security.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pf-form-footer">
                    <button
                      type="button"
                      className="pf-btn-secondary"
                      onClick={() => {
                        if (doctorProfile) {
                          setDoctorForm({
                            specialization: doctorProfile.specialization || '',
                            qualification: doctorProfile.qualification || '',
                            profileImage: doctorProfile.profileImage || '',
                            experienceYears: String(doctorProfile.experienceYears ?? 0),
                            licenseNumber: doctorProfile.licenseNumber || '',
                            consultationFee: String(doctorProfile.consultationFee ?? 0),
                            available: doctorProfile.available !== false,
                          })
                        }
                      }}
                    >
                      Reset Changes
                    </button>
                    <button type="submit" className="pf-btn-primary" disabled={saving}>
                      {saving ? (
                        <>
                          <div className="pf-spinner" /> Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon size={16} /> Save Doctor Profile
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* PATIENT FORM */
                <form onSubmit={handlePatientSubmit}>
                  {activeTab === 'personal' && (
                    <div>
                      <div className="pf-section-header">
                        <h2 className="pf-section-title">Patient Identification</h2>
                        <p className="pf-section-desc">
                          Basic personal demographic information and communication lines.
                        </p>
                      </div>

                      <div className="pf-form-grid">
                        <div className="pf-field-group">
                          <label className="pf-label">Full Name</label>
                          <input className="pf-input" type="text" value={user?.name || ''} disabled title="Managed by user account" />
                        </div>

                        <div className="pf-field-group">
                          <label className="pf-label">Email Address</label>
                          <input className="pf-input" type="email" value={user?.email || ''} disabled title="Managed by user account" />
                        </div>

                        <div className="pf-field-group">
                          <label className="pf-label">Phone Contact</label>
                          <div className="pf-input-wrap">
                            <span className="pf-input-icon">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                              </svg>
                            </span>
                            <input
                              className="pf-input"
                              type="tel"
                              placeholder="+1 (555) 000-0000"
                              value={patientForm.phone}
                              onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="pf-field-group">
                          <label className="pf-label">Date of Birth</label>
                          <div className="pf-input-wrap">
                            <span className="pf-input-icon"><CalendarIcon size={16} /></span>
                            <input
                              className="pf-input"
                              type="date"
                              max={todayDateString}
                              value={patientForm.dateOfBirth}
                              onChange={(e) => {
                                const selected = e.target.value
                                if (selected && selected > todayDateString) {
                                  setErrorMessage('Date of birth cannot be in the future.')
                                  return
                                }
                                setErrorMessage('')
                                setPatientForm({ ...patientForm, dateOfBirth: selected })
                              }}
                            />
                          </div>
                        </div>

                        <div className="pf-field-group">
                          <label className="pf-label">Gender</label>
                          <div className="pf-input-wrap">
                            <span className="pf-input-icon"><UserIcon size={16} /></span>
                            <select
                              className="pf-select"
                              value={patientForm.gender}
                              onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })}
                            >
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>

                        <div className="pf-field-group">
                          <label className="pf-label">Blood Group</label>
                          <div className="pf-input-wrap">
                            <span className="pf-input-icon"><HeartPulseIcon size={16} /></span>
                            <select
                              className="pf-select"
                              value={patientForm.bloodGroup}
                              onChange={(e) => setPatientForm({ ...patientForm, bloodGroup: e.target.value })}
                            >
                              <option value="A+">A+ (Positive)</option>
                              <option value="A-">A- (Negative)</option>
                              <option value="B+">B+ (Positive)</option>
                              <option value="B-">B- (Negative)</option>
                              <option value="AB+">AB+ (Positive)</option>
                              <option value="AB-">AB- (Negative)</option>
                              <option value="O+">O+ (Positive)</option>
                              <option value="O-">O- (Negative)</option>
                            </select>
                          </div>
                        </div>

                        <div className="pf-field-full">
                          <label className="pf-label">Residential Address</label>
                          <textarea
                            className="pf-textarea"
                            placeholder="Street, Apartment / Suite, City, State, ZIP code"
                            value={patientForm.address}
                            onChange={(e) => setPatientForm({ ...patientForm, address: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'clinical' && (
                    <div>
                      <div className="pf-section-header">
                        <h2 className="pf-section-title">Medical Profile & Health History</h2>
                        <p className="pf-section-desc">
                          Crucial clinical data shared with your attending physicians during consultations.
                        </p>
                      </div>

                      <div className="pf-form-grid">
                        <div className="pf-field-full">
                          <label className="pf-label">
                            Known Allergies (Comma separated)
                          </label>
                          <textarea
                            className="pf-textarea"
                            placeholder="e.g. Penicillin, Peanuts, Sulfa drugs, Latex"
                            value={patientForm.allergies}
                            onChange={(e) => setPatientForm({ ...patientForm, allergies: e.target.value })}
                          />
                          {patientForm.allergies && (
                            <div className="pf-tags-wrap">
                              {normalizeList(patientForm.allergies).map((item, idx) => (
                                <span key={idx} className="pf-tag-chip" style={{ background: '#fef2f2', color: '#991b1b', borderColor: '#fecaca' }}>
                                  ⚠️ {item}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pf-field-full">
                          <label className="pf-label">
                            Medical History & Chronic Conditions (Comma separated)
                          </label>
                          <textarea
                            className="pf-textarea"
                            placeholder="e.g. Hypertension, Type-2 Diabetes, Asthma, Knee Arthroscopy 2024"
                            value={patientForm.medicalHistory}
                            onChange={(e) => setPatientForm({ ...patientForm, medicalHistory: e.target.value })}
                          />
                          {patientForm.medicalHistory && (
                            <div className="pf-tags-wrap">
                              {normalizeList(patientForm.medicalHistory).map((item, idx) => (
                                <span key={idx} className="pf-tag-chip" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
                                  🩺 {item}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'security' && (
                    <div>
                      <div className="pf-section-header">
                        <h2 className="pf-section-title">Patient Account & Medical Privacy</h2>
                        <p className="pf-section-desc">
                          Manage confidential patient record consent and data protection preferences.
                        </p>
                      </div>

                      <div className="pf-form-grid">
                        <div className="pf-field-group">
                          <label className="pf-label">Medical Records Encryption</label>
                          <span className="pf-pill green" style={{ width: 'fit-content', padding: '6px 14px' }}>
                            256-BIT ENCRYPTION ACTIVE
                          </span>
                        </div>

                        <div className="pf-field-group">
                          <label className="pf-label">Patient Portal Status</label>
                          <span className="pf-pill blue" style={{ width: 'fit-content', padding: '6px 14px' }}>
                            ACTIVE • HEALTHGATE VERIFIED
                          </span>
                        </div>

                        <div className="pf-field-full">
                          <div className="pf-switch-card">
                            <div className="pf-switch-info">
                              <span className="pf-switch-title">Emergency Record Sharing</span>
                              <span className="pf-switch-sub">
                                Permits verified emergency hospital staff to review your blood type and known allergies.
                              </span>
                            </div>
                            <span className="pf-pill green">Consented</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pf-form-footer">
                    <button
                      type="button"
                      className="pf-btn-secondary"
                      onClick={() => {
                        if (patientProfile) {
                          setPatientForm({
                            dateOfBirth: patientProfile.dateOfBirth
                              ? new Date(patientProfile.dateOfBirth).toISOString().slice(0, 10)
                              : '',
                            gender: patientProfile.gender || 'male',
                            phone: patientProfile.phone || '',
                            address: patientProfile.address || '',
                            profileImage: patientProfile.profileImage || '',
                            bloodGroup: patientProfile.bloodGroup || 'A+',
                            allergies: (patientProfile.allergies || []).join(', '),
                            medicalHistory: (patientProfile.medicalHistory || []).join(', '),
                          })
                        }
                      }}
                    >
                      Reset Changes
                    </button>
                    <button type="submit" className="pf-btn-primary" disabled={saving}>
                      {saving ? (
                        <>
                          <div className="pf-spinner" /> Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon size={16} /> Save Patient Profile
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* RIGHT: LIVE OVERVIEW & HEALTH CARD SIDEBAR */}
          <aside className="pf-sidebar-stack">
            {/* Quick Summary Card */}
            <div className="pf-side-card">
              <div className="pf-side-header">
                <div className="pf-side-icon primary">
                  <ShieldCheckIcon size={18} />
                </div>
                <h3 className="pf-side-title">
                  {role === 'doctor' ? 'Practitioner Badge' : role === 'admin' ? 'Master Authority' : 'Digital Health Card'}
                </h3>
              </div>

              <div className="pf-side-list">
                <div className="pf-side-row">
                  <span className="pf-side-label">Account Name</span>
                  <span className="pf-side-val">{user?.name || 'User'}</span>
                </div>

                <div className="pf-side-row">
                  <span className="pf-side-label">Primary Role</span>
                  <span className="pf-pill blue">{role.toUpperCase()}</span>
                </div>

                {role === 'doctor' && (
                  <>
                    <div className="pf-side-row">
                      <span className="pf-side-label">Specialty</span>
                      <span className="pf-side-val" style={{ color: '#0d5c63' }}>
                        {doctorForm.specialization || 'Not specified'}
                      </span>
                    </div>
                    <div className="pf-side-row">
                      <span className="pf-side-label">License</span>
                      <span className="pf-side-val">
                        <code>{doctorForm.licenseNumber || 'Under Review'}</code>
                      </span>
                    </div>
                    <div className="pf-side-row">
                      <span className="pf-side-label">Booking Status</span>
                      <span className={`pf-pill ${doctorForm.available ? 'green' : 'amber'}`}>
                        {doctorForm.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  </>
                )}

                {role === 'patient' && (
                  <>
                    <div className="pf-side-row">
                      <span className="pf-side-label">Blood Type</span>
                      <span className="pf-pill red">{patientForm.bloodGroup || 'A+'}</span>
                    </div>
                    <div className="pf-side-row">
                      <span className="pf-side-label">Gender</span>
                      <span className="pf-side-val" style={{ textTransform: 'capitalize' }}>
                        {patientForm.gender || 'Not specified'}
                      </span>
                    </div>
                    <div className="pf-side-row">
                      <span className="pf-side-label">Emergency Contact</span>
                      <span className="pf-side-val">{patientForm.phone || 'None listed'}</span>
                    </div>
                  </>
                )}

                <div className="pf-side-row">
                  <span className="pf-side-label">Security State</span>
                  <span className="pf-pill green">Verified</span>
                </div>
              </div>

              {role === 'patient' && patientForm.allergies && (
                <div className="pf-emergency-notice">
                  <strong>⚠️ Critical Alert for Attending Medical Staff:</strong>
                  <br />
                  Patient exhibits adverse reactions to: {patientForm.allergies}.
                </div>
              )}
            </div>

            {/* Helpline & Quick Navigation */}
            <div className="pf-side-card" style={{ background: '#fcfdfe' }}>
              <div className="pf-side-header">
                <div className="pf-side-icon accent">
                  <HospitalIcon size={18} />
                </div>
                <h3 className="pf-side-title">HealthGate Support</h3>
              </div>

              <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px' }}>
                Need updates to official legal names, hospital credential transfers, or emergency records?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <a
                  href="mailto:support@healthgate.com"
                  className="pf-btn-secondary"
                  style={{ textAlign: 'center', textDecoration: 'none', display: 'block', fontSize: '0.84rem' }}
                >
                  Contact Medical Helpdesk
                </a>
                <button
                  type="button"
                  className="pf-btn-secondary"
                  style={{ fontSize: '0.84rem' }}
                  onClick={() => navigate(getDashboardPath())}
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default ProfilePage
