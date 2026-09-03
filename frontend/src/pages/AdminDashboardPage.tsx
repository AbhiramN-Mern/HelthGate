import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  getAllPatientsForAdmin,
  getPatientByIdForAdmin,
  togglePatientStatusForAdmin,
  type AdminPatient,
} from '../api/auth.api'

type AdminDashboardPageProps = {
  user?: {
    name?: string
    email?: string
    role?: string
  } | null
  onLogout: () => void
}

function AdminDashboardPage({ user, onLogout }: AdminDashboardPageProps) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [patients, setPatients] = useState<AdminPatient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<AdminPatient | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const token = localStorage.getItem('helthgate_token')

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

  useEffect(() => {
    void loadPatients()
  }, [])

  useEffect(() => {
    const fetchPatient = async () => {
      if (!id || !token) {
        setSelectedPatient(null)
        return
      }

      try {
        setLoading(true)
        const data = await getPatientByIdForAdmin(id, token)
        setSelectedPatient(data.patient || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load patient details.')
      } finally {
        setLoading(false)
      }
    }

    void fetchPatient()
  }, [id, token])

  const handleToggleStatus = async (patientId: string) => {
    if (!token) {
      navigate('/login')
      return
    }

    try {
      setSaving(true)
      const data = await togglePatientStatusForAdmin(patientId, token)
      setPatients((current) =>
        current.map((patient) =>
          patient._id === patientId ? { ...patient, active: data.patient?.active ?? !patient.active } : patient,
        ),
      )

      if (selectedPatient && selectedPatient._id === patientId) {
        setSelectedPatient((current) => ({ ...(current || {}), active: data.patient?.active ?? !Boolean(current?.active) }))
      }

      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update patient status.')
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
            <li><Link to="/admin/patients">Patients</Link></li>
          </div>

          <button type="button" className="secondary-button" onClick={onLogout}>
            Logout
          </button>
        </aside>

        <section className="profile-card">
          <div className="inline-actions">
            <div className="form-header" style={{ marginBottom: 0 }}>
              <p className="welcome-tag">Overview</p>
              <h2>Admin dashboard</h2>
            </div>
          </div>

          {error ? <p className="status-message">{error}</p> : null}

          {id && selectedPatient ? (
            <div className="login-form">
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
                  <span>Phone</span>
                  <input value={selectedPatient.phone || 'N/A'} readOnly />
                </div>

                <div className="input-group">
                  <span>Gender</span>
                  <input value={selectedPatient.gender || 'N/A'} readOnly />
                </div>

                <div className="input-group">
                  <span>Blood group</span>
                  <input value={selectedPatient.bloodGroup || 'N/A'} readOnly />
                </div>

                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <span>Address</span>
                  <textarea value={selectedPatient.address || 'N/A'} readOnly />
                </div>
              </div>

              <button
                type="button"
                className="signin-button"
                onClick={() => handleToggleStatus(selectedPatient._id || '')}
                disabled={saving}
              >
                {saving ? 'Updating...' : selectedPatient.active ? 'Deactivate patient' : 'Activate patient'}
              </button>
            </div>
          ) : (
            <div>
              {loading ? (
                <p className="loading-state">Loading patients...</p>
              ) : (
                <div>
                  <div className="inline-actions" style={{ marginBottom: '18px' }}>
                    <h3 style={{ margin: 0 }}>Patients</h3>
                  </div>

                  {patients.length === 0 ? (
                    <p className="empty-state">No patients found.</p>
                  ) : (
                    <div className="profile-list">
                      {patients.map((patient) => (
                        <div key={patient._id} className="profile-list" style={{ gap: '12px' }}>
                          <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <img
                                src={patient.profileImage || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(patient.user?.name || 'Patient') + '&background=0d5c63&color=ffffff'}
                                alt="Patient"
                                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
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
                              <button type="button" className="secondary-button" onClick={() => navigate(`/admin/patients/${patient._id}`)}>
                                View
                              </button>
                              <button type="button" className="secondary-button" onClick={() => handleToggleStatus(patient._id || '')}>
                                {patient.active ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </li>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default AdminDashboardPage
