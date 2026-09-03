import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  getMyDoctorProfile,
  getMyPatientProfile,
  type DoctorProfile,
  type PatientProfile,
  updateDoctorProfile,
  updatePatientProfile,
} from '../api/auth.api'

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
  const role = user?.role || 'patient'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null)
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null)
  const [patientForm, setPatientForm] = useState<PatientFormState>(defaultPatientForm)
  const [doctorForm, setDoctorForm] = useState<DoctorFormState>(defaultDoctorForm)

  useEffect(() => {
    const token = localStorage.getItem('helthgate_token')

    if (!token) {
      onRequireAuth()
      return
    }

    const fetchProfile = async () => {
      try {
        setLoading(true)

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
              available: Boolean(profile.available),
            })
          }
        } else {
          const data = await getMyPatientProfile(token)
          const profile = data.patient ?? null
          setPatientProfile(profile)

          if (profile) {
            setPatientForm({
              dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().slice(0, 10) : '',
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
        setMessage(
          error instanceof Error ? error.message : 'Unable to load your profile right now.',
        )
      } finally {
        setLoading(false)
      }
    }

    void fetchProfile()
  }, [onRequireAuth, role])

  const handleImageUpload = (
    event: ChangeEvent<HTMLInputElement>,
    fieldSetter: (value: string) => void,
  ) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      fieldSetter(String(reader.result || ''))
    }
    reader.readAsDataURL(file)
  }

  const handlePatientSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const token = localStorage.getItem('helthgate_token')

    if (!token) {
      onRequireAuth()
      return
    }

    try {
      setSaving(true)
      setMessage('')

      const payload: Record<string, unknown> = {
        dateOfBirth: patientForm.dateOfBirth || undefined,
        gender: patientForm.gender || undefined,
        phone: patientForm.phone || undefined,
        address: patientForm.address || undefined,
        bloodGroup: patientForm.bloodGroup || undefined,
        allergies: normalizeList(patientForm.allergies),
        medicalHistory: normalizeList(patientForm.medicalHistory),
      }

      const selectedFile = (document.getElementById('patient-profile-image') as HTMLInputElement | null)?.files?.[0]
      if (selectedFile) {
        payload.profileImage = selectedFile
      }

      const data = await updatePatientProfile(payload, token)
      setPatientProfile(data.patient ?? null)
      if (data.patient?.profileImage) {
        setPatientForm((current) => ({ ...current, profileImage: data.patient?.profileImage || current.profileImage }))
      }
      setMessage(data.message || 'Patient profile saved successfully.')
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to save your patient profile.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDoctorSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const token = localStorage.getItem('helthgate_token')

    if (!token) {
      onRequireAuth()
      return
    }

    try {
      setSaving(true)
      setMessage('')

      const payload: Record<string, unknown> = {
        specialization: doctorForm.specialization || undefined,
        qualification: doctorForm.qualification || undefined,
        experienceYears: Number(doctorForm.experienceYears) || 0,
        licenseNumber: doctorForm.licenseNumber || undefined,
        consultationFee: Number(doctorForm.consultationFee) || 0,
        available: doctorForm.available,
      }

      const selectedFile = (document.getElementById('doctor-profile-image') as HTMLInputElement | null)?.files?.[0]
      if (selectedFile) {
        payload.profileImage = selectedFile
      }

      const data = await updateDoctorProfile(payload, token)
      setDoctorProfile(data.doctor ?? null)
      if (data.doctor?.profileImage) {
        setDoctorForm((current) => ({ ...current, profileImage: data.doctor?.profileImage || current.profileImage }))
      }
      setMessage(data.message || 'Doctor profile saved successfully.')
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to save your doctor profile.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="login-page">
      <div className="profile-layout">
        <aside className="profile-summary">
          <img
            className="profile-avatar"
            src={
              role === 'doctor'
                ? (doctorForm.profileImage || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user?.name || 'User') + '&background=0d5c63&color=ffffff')
                : (patientForm.profileImage || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user?.name || 'User') + '&background=0d5c63&color=ffffff')
            }
            alt="Profile"
          />

          <div>
            <p className="welcome-tag">Profile</p>
            <h1 className="profile-name">{user?.name || 'User'}</h1>
          </div>

          <span className="profile-role-tag">{role}</span>

          <div className="profile-meta">
            <span>Email: {user?.email || 'N/A'}</span>
            <span>Role: {role}</span>
          </div>

          <button type="button" className="secondary-button" onClick={onLogout}>
            Logout
          </button>
        </aside>

        <section className="profile-card">
          <div className="inline-actions">
            <div className="form-header" style={{ marginBottom: 0 }}>
              <p className="welcome-tag">Dashboard</p>
              <h2>{role === 'doctor' ? 'Doctor profile' : 'Patient profile'}</h2>
            </div>
          </div>

          {message ? <p className="status-message">{message}</p> : null}

          {loading ? (
            <p className="loading-state">Loading your profile...</p>
          ) : role === 'doctor' ? (
            <form className="login-form" onSubmit={handleDoctorSave}>
              <div className="profile-grid">
                <label className="input-group">
                  <span>Profile image</span>
                  <input
                    id="doctor-profile-image"
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageUpload(event, (value) => setDoctorForm((current) => ({ ...current, profileImage: value })))}
                  />
                </label>

                <label className="input-group">
                  <span>Specialization</span>
                  <input
                    type="text"
                    value={doctorForm.specialization}
                    onChange={(event) => setDoctorForm((current) => ({ ...current, specialization: event.target.value }))}
                    placeholder="Cardiology"
                  />
                </label>

                <label className="input-group">
                  <span>Qualification</span>
                  <input
                    type="text"
                    value={doctorForm.qualification}
                    onChange={(event) => setDoctorForm((current) => ({ ...current, qualification: event.target.value }))}
                    placeholder="MBBS, MD"
                  />
                </label>

                <label className="input-group">
                  <span>License number</span>
                  <input
                    type="text"
                    value={doctorForm.licenseNumber}
                    onChange={(event) => setDoctorForm((current) => ({ ...current, licenseNumber: event.target.value }))}
                    placeholder="LIC-1001"
                  />
                </label>

                <label className="input-group">
                  <span>Experience years</span>
                  <input
                    type="number"
                    min="0"
                    value={doctorForm.experienceYears}
                    onChange={(event) => setDoctorForm((current) => ({ ...current, experienceYears: event.target.value }))}
                  />
                </label>

                <label className="input-group">
                  <span>Consultation fee</span>
                  <input
                    type="number"
                    min="0"
                    value={doctorForm.consultationFee}
                    onChange={(event) => setDoctorForm((current) => ({ ...current, consultationFee: event.target.value }))}
                  />
                </label>

                <label className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <span>Availability</span>
                  <label className="remember-me">
                    <input
                      type="checkbox"
                      checked={doctorForm.available}
                      onChange={() =>
                        setDoctorForm((current) => ({ ...current, available: !current.available }))
                      }
                    />
                    <span>Available for consultations</span>
                  </label>
                </label>
              </div>

              <button type="submit" className="signin-button" disabled={saving}>
                {saving ? 'Saving...' : 'Save doctor profile'}
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={handlePatientSave}>
              <div className="profile-grid">
                <label className="input-group">
                  <span>Profile image</span>
                  <input
                    id="patient-profile-image"
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageUpload(event, (value) => setPatientForm((current) => ({ ...current, profileImage: value })))}
                  />
                </label>

                <label className="input-group">
                  <span>Date of birth</span>
                  <input
                    type="date"
                    value={patientForm.dateOfBirth}
                    onChange={(event) => setPatientForm((current) => ({ ...current, dateOfBirth: event.target.value }))}
                  />
                </label>

                <label className="input-group">
                  <span>Gender</span>
                  <select
                    value={patientForm.gender}
                    onChange={(event) => setPatientForm((current) => ({ ...current, gender: event.target.value }))}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label className="input-group">
                  <span>Phone</span>
                  <input
                    type="tel"
                    value={patientForm.phone}
                    onChange={(event) => setPatientForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="+1 555 123 4567"
                  />
                </label>

                <label className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <span>Address</span>
                  <textarea
                    value={patientForm.address}
                    onChange={(event) => setPatientForm((current) => ({ ...current, address: event.target.value }))}
                    placeholder="Your home address"
                  />
                </label>

                <label className="input-group">
                  <span>Blood group</span>
                  <select
                    value={patientForm.bloodGroup}
                    onChange={(event) => setPatientForm((current) => ({ ...current, bloodGroup: event.target.value }))}
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </label>

                <label className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <span>Allergies</span>
                  <textarea
                    value={patientForm.allergies}
                    onChange={(event) => setPatientForm((current) => ({ ...current, allergies: event.target.value }))}
                    placeholder="Peanuts, penicillin"
                  />
                </label>

                <label className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <span>Medical history</span>
                  <textarea
                    value={patientForm.medicalHistory}
                    onChange={(event) => setPatientForm((current) => ({ ...current, medicalHistory: event.target.value }))}
                    placeholder="Asthma, previous surgery"
                  />
                </label>
              </div>

              <button type="submit" className="signin-button" disabled={saving}>
                {saving ? 'Saving...' : 'Save patient profile'}
              </button>
            </form>
          )}

          {role === 'doctor' && doctorProfile ? (
            <ul className="profile-list">
              <li>Specialization: {doctorProfile.specialization || 'Not set'}</li>
              <li>Qualification: {doctorProfile.qualification || 'Not set'}</li>
              <li>License: {doctorProfile.licenseNumber || 'Not set'}</li>
              <li>Availability: {doctorProfile.available ? 'Available' : 'Unavailable'}</li>
            </ul>
          ) : null}

          {role !== 'doctor' && patientProfile ? (
            <ul className="profile-list">
              <li>Blood group: {patientProfile.bloodGroup || 'Not set'}</li>
              <li>Phone: {patientProfile.phone || 'Not set'}</li>
              <li>Address: {patientProfile.address || 'Not set'}</li>
              <li>Allergies: {(patientProfile.allergies || []).join(', ') || 'None listed'}</li>
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  )
}

export default ProfilePage
