#  HealthGate — Hospital Management & Teleconsultation Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.2-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%209-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Real--Time-333333?style=flat&logo=webrtc&logoColor=white)](https://webrtc.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?style=flat&logo=socket.io&logoColor=white)](https://socket.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

HealthGate is an enterprise-grade, full-stack hospital management and real-time teleconsultation platform. Designed to connect **Patients**, **Doctors**, and **Hospital Administrators**, HealthGate streamlines the entire healthcare journey — from doctor discovery, dynamic slot booking, and secure payments to peer-to-peer WebRTC video consultations and digital prescription issuance.

Built with **Clean Architecture** and **SOLID principles**, the system guarantees high maintainability, strict role-based separation of concerns, and rock-solid scalability.

---


##  Key Features

###  Patient Experience
- **Doctor Discovery & Filters:** Filter certified doctors by specialization, affiliated hospital, consultation fee, and real-time availability.
- **Dynamic Slot Booking:** Interactive date and time picker supporting scheduling up to 90 days in advance with automatic conflict resolution.
- **Dual Payment Gateways:** Seamless integration with **Razorpay** for online card/UPI/net-banking transactions, with an intelligent fallback to an interactive **Mock Payment Gateway** in non-production environments.
- **HD WebRTC Video Consultations:** In-browser, low-latency audio/video consultations with call countdown timers, mute/unmute, camera switching, and screen sharing.
- **Patient-Only Google OAuth 2.0:** Secure "Continue with Google" sign-in and sign-up with strict server-side validation using `google-auth-library` and role guards preventing unauthorized doctor/admin elevation.
- **Email OTP Verification:** Automated OTP dispatch via Nodemailer for account activation and secure password resets.
- **Digital Prescriptions & Invoices:** Instant access to doctor-issued digital prescriptions and downloadable payment receipts.

###  Doctor Experience
- **Doctor Onboarding & Verification:** Guided profile setup with document/credential upload (medical registration, degree certificates) for administrator approval.
- **Hospital Affiliation Management:** Link with verified hospitals, configure department roles, consultation fees, and working hours.
- **Slot & Availability Scheduling:** Granular control over daily appointment schedules, slot durations, and temporary leaves.
- **Appointment Queue & Triage:** Accept, decline, or reschedule incoming patient requests with automatic real-time notifications.
- **In-Call Clinical Workspace:** Conduct secure teleconsultations, review patient history, and generate digital prescriptions during or after the session.
- **Patient History & Records:** Centralized repository of past consultations, prescribed medications, and clinical notes.

###  Administrator Dashboard
- **Doctor Credential Verification:** Dedicated queue to inspect doctor credentials, medical council registration IDs, and uploaded certificates with one-click approve/reject actions.
- **Hospital & Department Management:** Add, edit, and organize partner hospitals, departments, and medical specializations.
- **Platform Analytics & Financials:** Live metrics on registered users, active consultations, appointment completion rates, and platform revenue.
- **System-Wide Auditing:** Comprehensive logs of appointment lifecycles, user statuses, and payment transactions.

---

##  Architecture & Design Principles

HealthGate’s backend strictly adheres to **Clean Architecture** and **SOLID principles**, isolating business logic from external frameworks, databases, and third-party APIs:

```
                      ┌────────────────────────────────────────┐
                      │          HTTP / Sockets Layer          │
                      │   (Controllers, Middlewares, Sockets)  │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │          Application Services          │
                      │     (Use Cases & Domain Orchestration) │
                      └───────────────────┬────────────────────┘
                                          │
                        ┌─────────────────┴─────────────────┐
                        ▼                                   ▼
          ┌───────────────────────────┐       ┌───────────────────────────┐
          │   Repository Interfaces   │       │ Infrastructure Services   │
          │   (Domain Contracts)      │       │ (Razorpay, Nodemailer,    │
          └─────────────┬─────────────┘       │  Google Auth, Cloudinary) │
                        │                     └─────────────┬─────────────┘
                        ▼                                   ▼
          ┌───────────────────────────┐       ┌───────────────────────────┐
          │   Mongoose Repositories   │       │ Concrete Implementations  │
          │   (MongoDB / Database)    │       │                           │
          └───────────────────────────┘       └───────────────────────────┘
```

- **Single Responsibility Principle (SRP):** Dedicated services for hashing (`BcryptService`), tokens (`JwtTokenService`), OAuth (`GoogleAuthService`), and payments (`RazorpayGateway`).
- **Open/Closed Principle (OCP):** Strategy patterns for authentication providers and payment gateways allow adding new services without altering core domain logic.
- **Liskov Substitution Principle (LSP):** Repositories adhere to clean interface contracts; implementations can be swapped without touching service consumers.
- **Interface Segregation Principle (ISP):** Clients depend solely on fine-grained contracts tailored to their specific needs.
- **Dependency Inversion Principle (DIP):** Dependencies are injected at the application boundary via the centralized **Composition Root** (`backend/src/container.ts`).

---

##  Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, React Router 7, Socket.io Client, Modern Vanilla CSS Design System |
| **Backend** | Node.js 20+, Express 5.2, TypeScript 5, tsx (development engine) |
| **Database & ORM** | MongoDB, Mongoose 9 |
| **Real-Time & Teleconsult** | WebRTC (STUN / TURN / Metered.live relay), Socket.io 4.8 |
| **Authentication & Security** | JWT (JSON Web Tokens), `google-auth-library` (OAuth 2.0), bcryptjs |
| **Payments** | Razorpay Node SDK & Custom Sandbox/Mock Payment Provider |
| **Storage & Media** | Cloudinary & Multer for medical certificates and documents |
| **Email & Messaging** | Nodemailer (SMTP / Gmail relay for OTP verification) |
| **DevOps & Containers** | Docker, Docker Compose, Nginx |

---

##  System Architecture & Folder Structure

```
HelthGate/
├── docker-compose.yml              # Multi-container orchestration (Frontend + Backend)
├── backend/
│   ├── src/
│   │   ├── config/                 # Database connection & runtime configuration
│   │   ├── container.ts            # Composition root (Dependency Injection container)
│   │   ├── controllers/            # HTTP request handlers (thin presentation layer)
│   │   ├── core/                   # Domain entities, value objects, and base errors
│   │   ├── infrastructure/         # External service adapters:
│   │   │   ├── email/              # Nodemailer & Mock email services
│   │   │   ├── payment/            # Razorpay & Mock payment gateway implementations
│   │   │   └── security/           # GoogleAuthService, JwtTokenService, BcryptService
│   │   ├── middleware/             # Auth, role authorization, upload, & error handlers
│   │   ├── models/                 # Mongoose schemas & data models
│   │   ├── repositories/           # Repository interfaces & Mongoose implementations
│   │   ├── routes/                 # Express API route declarations
│   │   ├── services/               # Application business logic (Use Cases)
│   │   ├── sockets/                # WebRTC video call signaling handler
│   │   └── tests/                  # Integration & unit test suites
│   ├── Dockerfile                  # Production multi-stage Docker build
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/                    # Centralized Axios/fetch API clients
│   │   ├── components/             # Reusable UI components (Modals, Nav, VideoCall, etc.)
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── pages/
│   │   │   ├── admin/              # Admin dashboard, verification & hospital management
│   │   │   ├── consultation/       # Real-time WebRTC video consultation room
│   │   │   ├── doctor/             # Doctor portal, dashboard, slots, & patient lists
│   │   │   ├── pationt/            # Patient home, doctor search, booking, & payments
│   │   │   └── LoginPage.tsx       # Unified authentication & Google OAuth flow
│   │   ├── services/               # Socket.io client & WebRTC peer connection manager
│   │   ├── App.tsx                 # Application routes & role-based guards
│   │   └── index.css               # Global theme tokens, typography, & responsive resets
│   ├── Dockerfile                  # Frontend build & Nginx production server
│   ├── nginx.conf                  # Nginx proxy & SPA router configuration
│   └── package.json
```

---

##  Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or v20+ recommended
- **npm**: v9.0.0+
- **MongoDB**: A running local MongoDB instance or a [MongoDB Atlas](https://www.mongodb.com/atlas) connection URI
- **Docker & Docker Compose** *(Optional, for containerized execution)*

---

### Local Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/AbhiramN-Mern/HelthGate.git
cd HelthGate
```

#### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, and credentials

# Start development server (with tsx hot-reload)
npm run dev
```
The backend will boot up at `http://localhost:5000`.

#### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Verify VITE_API_URL points to your backend (default: http://localhost:5000)

# Start Vite development server
npm run dev
```
The frontend will be accessible at `http://localhost:5173`.

---

### Running with Docker Compose

To launch both backend and frontend in production-ready containers with a single command:

```bash
# Ensure backend/.env is created and configured
docker compose up --build -d
```

- **Frontend:** `http://localhost:80`
- **Backend API:** `http://localhost:5000`

To stop containers:
```bash
docker compose down
```

---

##  Environment Variables

### Backend Configuration (`backend/.env`)

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `5000` | Port on which Express server listens |
| `MONGO_URI` | **Yes** | — | MongoDB connection string (local or Atlas) |
| `JWT_SECRET` | **Yes** | — | Secret string for signing JWT session tokens |
| `JWT_EXPIRES_IN` | No | `7d` | Token validity duration |
| `FRONTEND_URL` | No | `http://localhost:5173` | CORS allowed origin and redirect base |
| `MAX_BOOKING_DAYS_AHEAD` | No | `90` | Maximum booking horizon in days |
| `GOOGLE_CLIENT_ID` | Optional | — | Google Cloud OAuth Client ID (for patient sign-in) |
| `GOOGLE_CLIENT_SECRET` | Optional | — | Google Cloud OAuth Client Secret |
| `PAYMENT_GATEWAY` | No | `MOCK` | Choose `RAZORPAY` or `MOCK` for local development |
| `RAZORPAY_KEY_ID` | If Razorpay | — | Razorpay API key identifier |
| `RAZORPAY_KEY_SECRET`| If Razorpay | — | Razorpay API key secret |
| `SMTP_HOST` / `EMAIL_HOST` | Optional | `smtp.gmail.com` | SMTP server host for sending OTP emails |
| `SMTP_PORT` / `EMAIL_PORT` | Optional | `587` | SMTP server port |
| `SMTP_USER` / `EMAIL_USER` | Optional | — | SMTP account username/email |
| `SMTP_PASSWORD` / `EMAIL_PASSWORD` | Optional | — | SMTP account app password |
| `CLOUDINARY_CLOUD_NAME` | Optional | — | Cloudinary cloud name for media uploads |
| `CLOUDINARY_API_KEY` | Optional | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Optional | — | Cloudinary API secret |
| `METERED_DOMAIN` | Optional | `helthgate.metered.live` | Metered.live domain for TURN credentials |
| `METERED_API_KEY` | Optional | — | Metered.live API key |
| `STUN_SERVER_URL` | No | `stun:stun.l.google.com:19302` | STUN server for WebRTC ICE candidate discovery |
| `TURN_SERVER_URL` | Optional | — | Custom TURN server URL for NAT traversal |

### Frontend Configuration (`frontend/.env`)

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | `http://localhost:5000` | Backend API base URL |
| `VITE_MAX_BOOKING_DAYS_AHEAD` | No | `90` | Maximum days allowed for appointment booking |
| `VITE_GOOGLE_CLIENT_ID` | Optional | — | Google Client ID for rendering "Continue with Google" |
| `VITE_STUN_SERVER_URL` | No | `stun:stun.relay.metered.ca:80` | STUN server used for client WebRTC peer connections |

---

##  API & Socket Overview

### REST API Endpoints

```
Authentication & Accounts
  POST   /api/auth/register           # Register new user (Patient / Doctor)
  POST   /api/auth/verify-otp         # Verify email OTP
  POST   /api/auth/login              # Standard email & password login
  POST   /api/auth/google             # Patient Google OAuth sign-in / sign-up
  POST   /api/auth/forgot-password    # Trigger password reset OTP
  POST   /api/auth/reset-password     # Reset password with OTP

Appointments & Consultations
  GET    /api/appointments            # List appointments (filtered by user role)
  POST   /api/appointments/book       # Book an appointment slot
  PUT    /api/appointments/:id/status # Update status (Approved, Rejected, Completed)
  GET    /api/appointments/:id        # Retrieve appointment details

Doctors & Availability
  GET    /api/doctors                 # List all verified doctors
  GET    /api/doctors/:id             # Doctor profile and available slots
  PUT    /api/doctors/profile         # Update doctor profile & qualifications
  POST   /api/doctors/slots           # Configure schedule and availability slots

Hospitals & Specializations
  GET    /api/hospitals               # List registered hospitals
  GET    /api/specializations         # List available medical specializations

Payments
  POST   /api/payments/create-order   # Create Razorpay or Mock payment order
  POST   /api/payments/verify         # Verify transaction signature & confirm appointment

Prescriptions
  POST   /api/prescriptions           # Create digital prescription (Doctors)
  GET    /api/prescriptions/:id       # Fetch prescription details (Patient / Doctor)

Admin Operations
  GET    /api/admin/doctors/pending   # List doctors pending document verification
  PUT    /api/admin/doctors/:id/verify# Approve or reject doctor credentials
  GET    /api/admin/analytics         # Platform statistics & analytics
```

### WebRTC Signaling Events

The backend WebSocket gateway (`backend/src/sockets/videoCall.socket.ts`) handles low-latency signaling between peer connections:

| Event | Direction | Payload / Purpose |
| :--- | :--- | :--- |
| `join-room` | Client ➔ Server | `{ appointmentId, userId, role }` — Joins consultation room |
| `user-connected` | Server ➔ Room | Broadcasts new participant joining the room |
| `offer` | Peer ➔ Peer | Relays WebRTC SDP offer |
| `answer` | Peer ➔ Peer | Relays WebRTC SDP answer |
| `ice-candidate` | Peer ➔ Peer | Relays ICE candidate for NAT traversal |
| `toggle-audio` | Client ➔ Room | Syncs mute / unmute state |
| `toggle-video` | Client ➔ Room | Syncs video stream enabled / disabled state |
| `end-call` | Client ➔ Server | Terminates teleconsultation session for both participants |

---

## Testing

HealthGate features an automated test suite verifying core application domains, security boundaries, and authorization rules:

```bash
cd backend

# Execute all automated tests
npm test
```

Test coverage includes:
- **Appointment Permissions (`appointmentPermissions.test.ts`)**: Access boundary enforcement across roles.
- **Consultation Flow (`consultationFlow.test.ts`)**: End-to-end appointment completion and prescription workflow.
- **Doctor Verification (`doctorVerification.test.ts`)**: Admin approval, rejection, and pending status transitions.
- **Google OAuth (`googleAuth.test.ts`)**: Role restrictions ensuring only patients authenticate via Google.
- **Payment Lifecycle (`payment.test.ts`)**: Razorpay signature verification and Mock gateway flow.
- **OTP Verification & Password Recovery (`otpVerification.test.ts`, `forgotPassword.test.ts`)**: Expiry, retry limits, and security token invalidation.
- **WebRTC Sessions (`videoCall.test.ts`)**: Session persistence and token authentication.

---

## 📄 Contributing & License

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/AbhiramN-Mern/HelthGate/issues).

This project is licensed under the [ISC License](LICENSE).