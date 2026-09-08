import SharedProfilePage from '../pationt/ProfilePage'

type ProfilePageProps = {
  user?: {
    name?: string
    email?: string
    role?: string
  } | null
  onLogout: () => void
  onRequireAuth: () => void
}

function DoctorProfilePage({ user, onLogout, onRequireAuth }: ProfilePageProps) {
  return (
    <SharedProfilePage
      user={{ ...user, role: 'doctor' }}
      onLogout={onLogout}
      onRequireAuth={onRequireAuth}
    />
  )
}

export default DoctorProfilePage
