# HealthGate — Hospital Management System

> **Notice: Major Work in Progress**  
> This project is currently under active development. Core architectural restructuring and features are continuously being implemented and refined.

---

## Description
HealthGate is a full-stack hospital management and healthcare consultation platform designed for Patients, Doctors, and Administrators. It streamlines doctor discovery, appointment booking, doctor-hospital affiliations, availability scheduling, and administrative verification.

---

## Tech Stack
* **Frontend:** React 19, TypeScript, Vite, React Router
* **Backend:** Node.js, Express 5, TypeScript
* **Real-time & Video:** Socket.io, WebRTC
* **Database:** MongoDB & Mongoose
* **Architecture:** Clean Architecture & SOLID Principles

---

## Recent Updates
* **Clean Architecture Migration:** Decoupled backend into distinct layers: Controllers, Services (Use Cases), Repository Interfaces, and Infrastructure Implementations.
* **SOLID Principles Implementation:**
  * **SRP:** Dedicated services for password hashing, JWT tokens, and standardized domain errors.
  * **OCP:** Role handler strategy pattern for extensible role management.
  * **LSP:** Pure repository abstraction contracts with zero leaked ORM calls.
  * **ISP & DIP:** Centralized Composition Root (`src/container.ts`) for dependency injection.

---

## Work in Progress
- [ ] Real-time video call consultation with Socket.io & WebRTC
- [ ] Real-time chat messaging between doctor and patient
- [ ] Payment gateway integration for appointment consultation fees
- [ ] Advanced analytics and report exports for hospital administrators
- [ ] Automated testing suite (Unit & Integration tests)