import { useNavigate } from 'react-router-dom'
import './HomePage.css'

type HomePageProps = {
  isLoggedIn: boolean
}

const specializations = [
  { icon: '❤️', name: 'Cardiology', tagline: 'Heart & cardiovascular care' },
  { icon: '🧠', name: 'Neurology', tagline: 'Brain & nervous system care' },
  { icon: '👶', name: 'Pediatrics', tagline: 'Healthcare for children' },
  { icon: '🦴', name: 'Orthopedics', tagline: 'Bones, joints & muscles' },
]

const hospitalTiles = [
  { icon: '🏥', name: 'City Medical' },
  { icon: '🏨', name: 'Apollo Plus' },
  { icon: '🏦', name: 'MedCare Hub' },
  { icon: '⚕️', name: 'LifeLine Clinic' },
]

const whyItems = [
  {
    icon: '🔗',
    title: 'Everything Connected',
    desc: 'Hospitals, doctors, specializations, and appointments in one seamless platform.',
  },
  {
    icon: '🔍',
    title: 'Discover with Confidence',
    desc: 'Find doctors through their hospital and specialization with transparent profiles.',
  },
  {
    icon: '✅',
    title: 'Make Your Choice',
    desc: 'Explore your options and compare before choosing the right doctor for you.',
  },
  {
    icon: '📅',
    title: 'Book with Ease',
    desc: 'A simple, guided way to schedule your appointment in just a few clicks.',
  },
]

function HomePage({ isLoggedIn }: HomePageProps) {
  const navigate = useNavigate()

  const goToLogin = () => navigate('/login')
  const goToDashboard = () => {
    const role = JSON.parse(localStorage.getItem('helthgate_user') || '{}')?.role
    if (role === 'admin') navigate('/admin')
    else if (role === 'doctor') navigate('/doctor/dashboard')
    else navigate('/patient/home')
  }

  return (
    <div className="hp-root">
      {/* ===== NAVBAR ===== */}
      <nav className="hp-nav" aria-label="Main navigation">
        <div className="hp-nav-inner">
          {/* Brand */}
          <a href="/" className="hp-nav-brand">
            <div className="hp-nav-logo">HG</div>
            <span className="hp-nav-wordmark">HealthGate</span>
          </a>

          {/* Nav links */}
          <ul className="hp-nav-links">
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#specializations">Specializations</a></li>
            <li><a href="#hospitals">Hospitals</a></li>
            <li><a href="#why">Why Us</a></li>
          </ul>

          {/* CTA actions */}
          <div className="hp-nav-actions">
            {isLoggedIn ? (
              <button id="nav-dashboard-btn" className="hp-btn-primary" onClick={goToDashboard}>
                Go to Dashboard
              </button>
            ) : (
              <>
                <button id="nav-login-btn" className="hp-btn-ghost" onClick={goToLogin}>
                  Sign In
                </button>
                <button id="nav-register-btn" className="hp-btn-primary" onClick={() => navigate('/register')}>
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="hp-hero" aria-label="Hero">
        <div className="hp-hero-inner">
          {/* Left: copy */}
          <div className="hp-hero-content">
            <div className="hp-hero-badge">
              <span className="hp-hero-badge-dot" />
              Trusted Healthcare Platform
            </div>

            <h1 className="hp-hero-title">
              Your Health,<br />
              <span>Our Gateway.</span>
            </h1>

            <p className="hp-hero-sub">
              Discover hospitals, find the right doctors and specialists, and book
              appointments — all through <strong style={{ color: '#9cf0d7' }}>HealthGate</strong>.
            </p>

            <div className="hp-hero-ctas">
              <button id="hero-find-doctors-btn" className="hp-cta-main" onClick={isLoggedIn ? goToDashboard : goToLogin}>
                Find Doctors
              </button>
              <button id="hero-explore-hospitals-btn" className="hp-cta-outline" onClick={isLoggedIn ? goToDashboard : goToLogin}>
                Explore Hospitals
              </button>
            </div>

            <div className="hp-hero-trust">
              {['Trusted Healthcare', 'Qualified Doctors', 'Easy Appointment Booking'].map((item) => (
                <div className="hp-trust-item" key={item}>
                  <span className="hp-trust-check">✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Right: stat cards */}
          <div className="hp-hero-visual" aria-hidden="true">
            <div className="hp-stat-card float1">
              <div className="hp-stat-icon">🏥</div>
              <div className="hp-stat-info">
                <span className="hp-stat-value">200+</span>
                <span className="hp-stat-label">Partner Hospitals</span>
              </div>
            </div>
            <div className="hp-stat-card float2">
              <div className="hp-stat-icon">🩺</div>
              <div className="hp-stat-info">
                <span className="hp-stat-value">1,500+</span>
                <span className="hp-stat-label">Verified Doctors</span>
              </div>
            </div>
            <div className="hp-stat-card float3">
              <div className="hp-stat-icon">📅</div>
              <div className="hp-stat-info">
                <span className="hp-stat-value">10K+</span>
                <span className="hp-stat-label">Appointments Booked</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how-it-works" className="hp-section hp-steps" aria-label="How HealthGate works">
        <div className="hp-section-inner">
          <span className="hp-section-label">Simple Process</span>
          <h2 className="hp-section-title">
            HealthGate — Connecting You to Better Healthcare
          </h2>
          <p className="hp-section-sub">
            Finding the right healthcare shouldn't be complicated. HealthGate connects
            hospitals, doctors, specializations, and patients in one simple platform.
          </p>

          <div className="hp-steps-grid">
            {[
              { num: '01', emoji: '🏥', title: 'Discover Hospitals', desc: 'Explore hospitals and discover the doctors and specializations available there.' },
              { num: '02', emoji: '🩺', title: 'Find Specialists', desc: 'Browse doctors by their medical specialization and area of expertise.' },
              { num: '03', emoji: '👨‍⚕️', title: 'Choose Your Doctor', desc: 'Compare your options and choose the doctor that fits your healthcare needs.' },
              { num: '04', emoji: '📅', title: 'Book an Appointment', desc: 'Book an appointment with your chosen doctor quickly and easily.' },
            ].map((step) => (
              <div className="hp-step-card" key={step.num}>
                <span className="hp-step-num">{step.num}</span>
                <span className="hp-step-emoji">{step.emoji}</span>
                <h3 className="hp-step-title">{step.title}</h3>
                <p className="hp-step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SPECIALIZATIONS ===== */}
      <section id="specializations" className="hp-section hp-specs" aria-label="Medical specializations">
        <div className="hp-section-inner">
          <div className="hp-specs-header">
            <div>
              <span className="hp-section-label">Specializations</span>
              <h2 className="hp-section-title">
                Find the Right Doctor
              </h2>
              <p className="hp-section-sub">
                Start your healthcare journey by choosing a specialization.
              </p>
            </div>
            <button id="view-all-specs-btn" className="hp-link-btn" onClick={isLoggedIn ? goToDashboard : goToLogin}>
              View All Specializations →
            </button>
          </div>

          <div className="hp-specs-grid">
            {specializations.map((s) => (
              <div
                className="hp-spec-card"
                key={s.name}
                role="button"
                tabIndex={0}
                onClick={isLoggedIn ? goToDashboard : goToLogin}
                onKeyDown={(e) => e.key === 'Enter' && (isLoggedIn ? goToDashboard() : goToLogin())}
                aria-label={`Browse ${s.name}`}
              >
                <span className="hp-spec-icon">{s.icon}</span>
                <p className="hp-spec-name">{s.name}</p>
                <p className="hp-spec-tagline">{s.tagline}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOSPITALS BANNER ===== */}
      <section id="hospitals" className="hp-hospitals" aria-label="Discover hospitals">
        <div className="hp-hospitals-inner">
          <div>
            <span className="hp-hospitals-label">Hospitals</span>
            <h2 className="hp-hospitals-title">
              Discover Hospitals with HealthGate
            </h2>
            <p className="hp-hospitals-sub">
              Explore hospitals, their available specializations, and the doctors working
              there. Your gateway to hospitals and doctors.
            </p>
            <button id="explore-hospitals-btn" className="hp-hospitals-cta" onClick={isLoggedIn ? goToDashboard : goToLogin}>
              Explore Hospitals →
            </button>
          </div>

          <div className="hp-hospitals-visual">
            {hospitalTiles.map((h) => (
              <div className="hp-hosp-tile" key={h.name}>
                <span className="hp-hosp-tile-icon">{h.icon}</span>
                <p className="hp-hosp-tile-name">{h.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY HEALTHGATE ===== */}
      <section id="why" className="hp-section hp-why" aria-label="Why HealthGate">
        <div className="hp-section-inner">
          <span className="hp-section-label">Why HealthGate?</span>
          <h2 className="hp-section-title">Built Around Your Healthcare Needs</h2>
          <p className="hp-section-sub">
            We built HealthGate to make healthcare discovery and booking simple,
            transparent, and patient-first.
          </p>

          <div className="hp-why-grid">
            {whyItems.map((w) => (
              <div className="hp-why-card" key={w.title}>
                <div className="hp-why-icon-wrap">{w.icon}</div>
                <div className="hp-why-text">
                  <h3>{w.title}</h3>
                  <p>{w.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="hp-cta-section" aria-label="Get started with HealthGate">
        <div className="hp-cta-inner">
          <h2>Your Health, Our Gateway.</h2>
          <p>
            Start with HealthGate. Find your hospital. Discover your doctor.
            Book your appointment.
          </p>
          <div className="hp-cta-btns">
            <button id="cta-find-doctor-btn" className="hp-cta-main" onClick={isLoggedIn ? goToDashboard : goToLogin}>
              {isLoggedIn ? 'Go to Dashboard' : 'Find a Doctor'}
            </button>
            <button id="cta-explore-btn" className="hp-cta-outline" onClick={isLoggedIn ? goToDashboard : goToLogin}>
              Explore Hospitals
            </button>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div className="hp-footer-top">
            {/* Brand col */}
            <div>
              <div className="hp-footer-brand">
                <div className="hp-footer-logo">HG</div>
                <span className="hp-footer-wordmark">HealthGate</span>
              </div>
              <p className="hp-footer-tagline">
                Connecting patients with hospitals and doctors through one simple
                healthcare platform.
              </p>
            </div>

            {/* Explore col */}
            <div className="hp-footer-col">
              <h4>Explore</h4>
              <ul>
                {['Home', 'Hospitals', 'Doctors', 'Specializations', 'About Us', 'Contact'].map((l) => (
                  <li key={l}><a href="#">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Patients col */}
            <div className="hp-footer-col">
              <h4>For Patients</h4>
              <ul>
                {['Find Doctors', 'Explore Hospitals', 'Browse Specializations', 'Book Appointments'].map((l) => (
                  <li key={l}><a href="#" onClick={isLoggedIn ? goToDashboard : goToLogin}>{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Account col */}
            <div className="hp-footer-col">
              <h4>Account</h4>
              <ul>
                {isLoggedIn ? (
                  <li><a href="#" onClick={goToDashboard}>Dashboard</a></li>
                ) : (
                  <>
                    <li><a href="#" onClick={goToLogin}>Sign In</a></li>
                    <li><a href="#" onClick={() => navigate('/register')}>Register</a></li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <div className="hp-footer-bottom">
            <span>© 2026 HealthGate. All rights reserved.</span>
            <div className="hp-footer-legal">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default HomePage
