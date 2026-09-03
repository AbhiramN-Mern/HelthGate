import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAllDoctorsForAdmin,
  getAllPatientsForAdmin,
  getDoctorByIdForAdmin,
  getPatientByIdForAdmin,
  rejectDoctorForAdmin,
  togglePatientStatusForAdmin,
  updateDoctorByIdForAdmin,
  updatePatientByIdForAdmin,
  verifyDoctorForAdmin,
  type AdminDoctor,
  type AdminPatient,
} from '../api/auth.api'

type AdminDashboardPageProps = {
  user?: {
    name?: string
    email?: string
    role?: string
  } | null
  onLogout: () => void
  initialSection?: 'patients' | 'doctors'
}

type PatientFormState = {
  gender: string
  phone: string
  address: string
  bloodGroup: string
  allergies: string
  medicalHistory: string
  active: boolean
}

type DoctorFormState = {
  specialization: string
  qualification: string
  licenseNumber: string
  consultationFee: string
  experienceYears: string
  available: boolean
  verificationStatus: 'pending' | 'verified' | 'rejected'
}

const defaultPatientForm = (): PatientFormState => ({
  gender: 'male',
  phone: '',
  address: '',
  bloodGroup: 'A+',
  allergies: '',
  medicalHistory: '',
  active: true,
})

const defaultDoctorForm = (): DoctorFormState => ({
  specialization: '',
  qualification: '',
  licenseNumber: '',
  consultationFee: '0',
  experienceYears: '0',
  available: true,
  verificationStatus: 'pending',
})

const normalizeList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
}

function AdminDashboardPage({ user, onLogout, initialSection = 'patients' }: AdminDashboardPageProps) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [section, setSection] = useState<'patients' | 'doctors'>(initialSection)
  const [patients, setPatients] = useState<AdminPatient[]>([])
  const [doctors, setDoctors] = useState<AdminDoctor[]>([])
  const [selectedPatient, setSelectedPatient] = useState<AdminPatient | null>(null)
  const [selectedDoctor, setSelectedDoctor] = useState<AdminDoctor | null>(null)
  const [patientForm, setPatientForm] = useState<PatientFormState>(defaultPatientForm())
  const [doctorForm, setDoctorForm] = useState<DoctorFormState>(defaultDoctorForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const token = localStorage.getItem('helthgate_token')

  useEffect(() => {
    setSection(initialSection)
  }, [initialSection])

  useEffect(() => {
    const loadPatients = async () => {
      if (!token) {
        navigate('/login')
        return
      }

      try {
        setLoading(true)
        setError('')
        const data = await getAllPatientsForAdmin(token)
        setPatients(data.patients || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load patients.')
      } finally {
        setLoading(false)
      }
    }

    const loadDoctors = async () => {
      if (!token) {
        navigate('/login')
        return
      }

      try {
        setLoading(true)
        setError('')
        const data = await getAllDoctorsForAdmin(token)
        setDoctors(data.doctors || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load doctors.')
      } finally {
        setLoading(false)
      }
    }

    void loadPatients()
    void loadDoctors()
  }, [navigate, token])

  useEffect(() => {
    const fetchPatient = async () => {
      if (!id || !token || section !== 'patients') {
        setSelectedPatient(null)
        return
      }

      try {
        setLoading(true)
        const data = await getPatientByIdForAdmin(id, token)
        const patient = data.patient || null
        setSelectedPatient(patient)

        if (patient) {
          setPatientForm({
            gender: patient.gender || 'male',
            phone: patient.phone || '',
            address: patient.address || '',
            bloodGroup: patient.bloodGroup || 'A+',
            allergies: (patient.allergies || []).join(', '),
            medicalHistory: (patient.medicalHistory || []).join(', '),
            active: Boolean(patient.active),
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load patient details.')
      } finally {
        setLoading(false)
      }
    }

    const fetchDoctor = async () => {
      if (!id || !token || section !== 'doctors') {
        setSelectedDoctor(null)
        return
      }

      try {
        setLoading(true)
        const data = await getDoctorByIdForAdmin(id, token)
        const doctor = data.doctor || null
        setSelectedDoctor(doctor)

        if (doctor) {
          setDoctorForm({
            specialization: doctor.specialization || '',
            qualification: doctor.qualification || '',
            licenseNumber: doctor.licenseNumber || '',
            consultationFee: String(doctor.consultationFee ?? 0),
            experienceYears: String(doctor.experienceYears ?? 0),
            available: Boolean(doctor.available),
            verificationStatus: doctor.verificationStatus || 'pending',
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load doctor details.')
      } finally {
        setLoading(false)
      }
    }

    void fetchPatient()
    void fetchDoctor()
  }, [id, section, token, navigate])

  const handlePatientSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedPatient?._id || !token) return

    try {
      setSaving(true)
      setError('')
      const payload = {
        gender: patientForm.gender,
        phone: patientForm.phone,
        address: patientForm.address,
        bloodGroup: patientForm.bloodGroup,
        allergies: normalizeList(patientForm.allergies),
        medicalHistory: normalizeList(patientForm.medicalHistory),
        active: patientForm.active,
      }

      const data = await updatePatientByIdForAdmin(selectedPatient._id, payload, token)
      setSelectedPatient(data.patient ?? selectedPatient)
      setPatients((current) =>
        current.map((patient) =>
          patient._id === selectedPatient._id ? { ...patient, ...(data.patient || {}) } : patient,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update patient.')
    } finally {
      setSaving(false)
    }
  }

  const handleDoctorSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDoctor?._id || !token) return

    try {
      setSaving(true)
      setError('')
      const payload = {
        specialization: doctorForm.specialization,
        qualification: doctorForm.qualification,
        licenseNumber: doctorForm.licenseNumber,
        consultationFee: Number(doctorForm.consultationFee) || 0,
        experienceYears: Number(doctorForm.experienceYears) || 0,
        available: doctorForm.available,
        verificationStatus: doctorForm.verificationStatus,
      }

      const data = await updateDoctorByIdForAdmin(selectedDoctor._id, payload, token)
      setSelectedDoctor(data.doctor ?? selectedDoctor)
      setDoctors((current) =>
        current.map((doctor) =>
          doctor._id === selectedDoctor._id ? { ...doctor, ...(data.doctor || {}) } : doctor,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update doctor.')
    } finally {
      setSaving(false)
    }
  }

  const handlePatientToggle = async (patientId: string) => {
    if (!token) return

    try {
      setSaving(true)
      setError('')
      const data = await togglePatientStatusForAdmin(patientId, token)
      setPatients((current) =>
        current.map((patient) =>
          patient._id === patientId ? { ...patient, active: data.patient?.active ?? !patient.active } : patient,
        ),
      )
      if (selectedPatient && selectedPatient._id === patientId) {
        setSelectedPatient((current) => ({ ...(current || {}), active: data.patient?.active ?? !Boolean(current?.active) }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update patient status.')
    } finally {
      setSaving(false)
    }
  }

  const handleDoctorVerify = async (doctorId: string) => {
    if (!token) return

    try {
      setSaving(true)
      setError('')
      const data = await verifyDoctorForAdmin(doctorId, token)
      setDoctors((current) =>
        current.map((doctor) =>
          doctor._id === doctorId
            ? { ...doctor, verificationStatus: data.doctor?.verificationStatus || 'verified', available: data.doctor?.available ?? true }
            : doctor,
        ),
      )
      if (selectedDoctor && selectedDoctor._id === doctorId) {
        setSelectedDoctor((current) => ({
          ...(current || {}),
          verificationStatus: data.doctor?.verificationStatus || 'verified',
          available: data.doctor?.available ?? true,
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify doctor.')
    } finally {
      setSaving(false)
    }
  }

  const handleDoctorReject = async (doctorId: string) => {
    if (!token) return

    try {
      setSaving(true)
      setError('')
      const data = await rejectDoctorForAdmin(doctorId, token)
      setDoctors((current) =>
        current.map((doctor) =>
          doctor._id === doctorId
            ? { ...doctor, verificationStatus: data.doctor?.verificationStatus || 'rejected', available: data.doctor?.available ?? false }
            : doctor,
        ),
      )
      if (selectedDoctor && selectedDoctor._id === doctorId) {
        setSelectedDoctor((current) => ({
          ...(current || {}),
          verificationStatus: data.doctor?.verificationStatus || 'rejected',
          available: data.doctor?.available ?? false,
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reject doctor.')
    } finally {
      setSaving(false)
    }
  }

  if (!user || user.role !== 'admin') {
    return (
      <main className="login-page">
        <div className="form-panel">
          <p className="status-message">Admin access required.</p>
        </div>
      </main>
    )
  }

  const renderPatients = () => {
    if (id && selectedPatient) {
      return (
        <form className="login-form" onSubmit={handlePatientSave}>
          <div className="profile-grid">
            <div className="input-group">
              <span>Profile image</span>
              <img
                className="profile-avatar"
                src={selectedPatient.profileImage || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedPatient.user?.name || 'Patient') + '&background=0d5c63&color=ffffff'}
                alt="Patient"
                style={{ width: '100px', height: '100px' }}
              />
            </div>

            <div className="input-group">
              <span>Name</span>
              <input value={selectedPatient.user?.name || ''} readOnly />
            </div>

            <div className="input-group">
              <span>Email</span>
              <input value={selectedPatient.user?.email || ''} readOnly />
            </div>

            <div className="input-group">
              <span>Gender</span>
              <select value={patientForm.gender} onChange={(event) => setPatientForm((current) => ({ ...current, gender: event.target.value }))}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="input-group">
              <span>Phone</span>
              <input value={patientForm.phone} onChange={(event) => setPatientForm((current) => ({ ...current, phone: event.target.value }))} />
            </div>

            <div className="input-group">
              <span>Blood group</span>
              <select value={patientForm.bloodGroup} onChange={(event) => setPatientForm((current) => ({ ...current, bloodGroup: event.target.value }))}>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>

            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <span>Address</span>
              <textarea value={patientForm.address} onChange={(event) => setPatientForm((current) => ({ ...current, address: event.target.value }))} />
            </div>

            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <span>Allergies</span>
              <textarea value={patientForm.allergies} onChange={(event) => setPatientForm((current) => ({ ...current, allergies: event.target.value }))} />
            </div>

            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <span>Medical history</span>
              <textarea value={patientForm.medicalHistory} onChange={(event) => setPatientForm((current) => ({ ...current, medicalHistory: event.target.value }))} />
            </div>

            <label className="input-group" style={{ gridColumn: '1 / -1' }}>
              <span>Account status</span>
              <label className="remember-me">
                <input type="checkbox" checked={patientForm.active} onChange={() => setPatientForm((current) => ({ ...current, active: !current.active }))} />
                <span>{patientForm.active ? 'Active' : 'Inactive'}</span>
              </label>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button type="submit" className="signin-button" disabled={saving}>
              {saving ? 'Saving...' : 'Save patient'}
            </button>
            <button type="button" className="secondary-button" onClick={() => handlePatientToggle(selectedPatient._id || '')} disabled={saving}>
              {selectedPatient.active ? 'Deactivate patient' : 'Activate patient'}
            </button>
          </div>
        </form>
      )
    }

    return (
      <div>
        {loading ? (
          <p className="loading-state">Loading patients...</p>
        ) : (
          <div className="profile-list">
            {patients.length === 0 ? (
              <p className="empty-state">No patients found.</p>
            ) : (
              patients.map((patient) => (
                <li key={patient._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={patient.profileImage || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(patient.user?.name || 'Patient') + '&background=0d5c63&color=ffffff'}
                      alt="Patient"
                      style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                    />
                    <div>
                      <div>{patient.user?.name || 'Patient'}</div>
                      <small>{patient.user?.email || 'N/A'}</small>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="profile-role-tag" style={{ fontSize: '0.7rem', padding: '6px 10px' }}>
                      {patient.active ? 'Active' : 'Inactive'}
                    </span>
                    <button type="button" className="secondary-button" onClick={() => navigate(`/admin/patients/${patient._id}`)}>View</button>
                    <button type="button" className="secondary-button" onClick={() => navigate(`/admin/patients/${patient._id}`)}>Edit</button>
                    <button type="button" className="secondary-button" onClick={() => handlePatientToggle(patient._id || '')}>
                      {patient.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </li>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  const renderDoctors = () => {
    if (id && selectedDoctor) {
      return (
        <form className="login-form" onSubmit={handleDoctorSave}>
          <div className="profile-grid">
            <div className="input-group">
              <span>Profile image</span>
              <img
                className="profile-avatar"
                src={selectedDoctor.profileImage || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedDoctor.user?.name || 'Doctor') + '&background=0d5c63&color=ffffff'}
                alt="Doctor"
                style={{ width: '100px', height: '100px' }}
              />
            </div>

            <div className="input-group">
              <span>Name</span>
              <input value={selectedDoctor.user?.name || ''} readOnly />
            </div>

            <div className="input-group">
              <span>Email</span>
              <input value={selectedDoctor.user?.email || ''} readOnly />
            </div>

            <div className="input-group">
              <span>Specialization</span>
              <input value={doctorForm.specialization} onChange={(event) => setDoctorForm((current) => ({ ...current, specialization: event.target.value }))} />
            </div>

            <div className="input-group">
              <span>Qualification</span>
              <input value={doctorForm.qualification} onChange={(event) => setDoctorForm((current) => ({ ...current, qualification: event.target.value }))} />
            </div>

            <div className="input-group">
              <span>License number</span>
              <input value={doctorForm.licenseNumber} onChange={(event) => setDoctorForm((current) => ({ ...current, licenseNumber: event.target.value }))} />
            </div>

            <div className="input-group">
              <span>Consultation fee</span>
              <input type="number" value={doctorForm.consultationFee} onChange={(event) => setDoctorForm((current) => ({ ...current, consultationFee: event.target.value }))} />
            </div>

            <div className="input-group">
              <span>Experience years</span>
              <input type="number" value={doctorForm.experienceYears} onChange={(event) => setDoctorForm((current) => ({ ...current, experienceYears: event.target.value }))} />
            </div>

            <div className="input-group">
              <span>Verification status</span>
              <select value={doctorForm.verificationStatus} onChange={(event) => setDoctorForm((current) => ({ ...current, verificationStatus: event.target.value as 'pending' | 'verified' | 'rejected' }))}>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <label className="input-group" style={{ gridColumn: '1 / -1' }}>
              <span>Availability</span>
              <label className="remember-me">
                <input type="checkbox" checked={doctorForm.available} onChange={() => setDoctorForm((current) => ({ ...current, available: !current.available }))} />
                <span>{doctorForm.available ? 'Available' : 'Unavailable'}</span>
              </label>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button type="submit" className="signin-button" disabled={saving}>
              {saving ? 'Saving...' : 'Save doctor'}
            </button>
            <button type="button" className="secondary-button" onClick={() => handleDoctorVerify(selectedDoctor._id || '')} disabled={saving || doctorForm.verificationStatus === 'verified'}>
              Verify
            </button>
            <button type="button" className="secondary-button" onClick={() => handleDoctorReject(selectedDoctor._id || '')} disabled={saving || doctorForm.verificationStatus === 'rejected'}>
              Reject
            </button>
          </div>
        </form>
      )
    }

    return (
      <div>
        {loading ? (
          <p className="loading-state">Loading doctors...</p>
        ) : (
          <div className="profile-list">
            {doctors.length === 0 ? (
              <p className="empty-state">No doctors found.</p>
            ) : (
              doctors.map((doctor) => (
                <li key={doctor._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={doctor.profileImage || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(doctor.user?.name || 'Doctor') + '&background=0d5c63&color=ffffff'}
                      alt="Doctor"
                      style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                    />
                    <div>
                      <div>{doctor.user?.name || 'Doctor'}</div>
                      <small>{doctor.user?.email || 'N/A'}</small>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="profile-role-tag" style={{ fontSize: '0.7rem', padding: '6px 10px' }}>
                      {statusLabel[doctor.verificationStatus || 'pending']}
                    </span>
                    <button type="button" className="secondary-button" onClick={() => navigate(`/admin/doctors/${doctor._id}`)}>View</button>
                    <button type="button" className="secondary-button" onClick={() => navigate(`/admin/doctors/${doctor._id}`)}>Edit</button>
                    <button type="button" className="secondary-button" onClick={() => handleDoctorVerify(doctor._id || '')} disabled={doctor.verificationStatus === 'verified'}>
                      Verify
                    </button>
                    <button type="button" className="secondary-button" onClick={() => handleDoctorReject(doctor._id || '')} disabled={doctor.verificationStatus === 'rejected'}>
                      Reject
                    </button>
                  </div>
                </li>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <main className="login-page">
      <div className="profile-layout">
        <aside className="profile-summary">
          <div>
            <p className="welcome-tag">Admin</p>
            <h1 className="profile-name">{user.name || 'Administrator'}</h1>
          </div>

          <span className="profile-role-tag">admin</span>
          <div className="profile-meta">
            <span>Email: {user.email || 'N/A'}</span>
            <span>Role: admin</span>
          </div>

          <div className="feature-list" style={{ marginTop: '0' }}>
            <li>
              <button type="button" className="secondary-button" onClick={() => { setSection('patients'); navigate('/admin/patients'); }}>
                Patients
              </button>
            </li>
            <li>
              <button type="button" className="secondary-button" onClick={() => { setSection('doctors'); navigate('/admin/doctors'); }}>
                Doctors
              </button>
            </li>
          </div>

          <button type="button" className="secondary-button" onClick={onLogout}>
            Logout
          </button>
        </aside>

        <section className="profile-card">
          <div className="inline-actions">
            <div className="form-header" style={{ marginBottom: 0 }}>
              <p className="welcome-tag">Overview</p>
              <h2>{section === 'patients' ? 'Patients management' : 'Doctors management'}</h2>
            </div>
          </div>

          {error ? <p className="status-message">{error}</p> : null}

          {section === 'patients' ? renderPatients() : renderDoctors()}
        </section>
      </div>
    </main>
  )
}

export default AdminDashboardPage
