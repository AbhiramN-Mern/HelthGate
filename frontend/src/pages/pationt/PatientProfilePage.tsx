import SharedProfilePage from './ProfilePage'

type ProfilePageProps = {
  user?: {
    name?: string
    email?: string
    role?: string
  } | null
  onLogout: () => void
  onRequireAuth: () => void
}

function PatientProfilePage({ user, onLogout, onRequireAuth }: ProfilePageProps) {
  return (
    <SharedProfilePage
      user={{ ...user, role: 'patient' }}
      onLogout={onLogout}
      onRequireAuth={onRequireAuth}
    />
  )
}

export default PatientProfilePage
