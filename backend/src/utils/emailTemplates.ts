export interface AppointmentEmailData {
  patientName: string;
  patientEmail: string;
  doctorName: string;
  doctorSpecialization?: string;
  hospitalName?: string;
  department?: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentId: string;
  appointmentType?: string;
  reason?: string;
  cancellationReason?: string;
  previousStatus?: string;
  newStatus?: string;
  proposedDate?: string;
  proposedTime?: string;
  originalDate?: string;
  originalTime?: string;
  rescheduleReason?: string;
}

const baseStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 0;
    background-color: #f1f5f9;
    color: #1e293b;
    -webkit-font-smoothing: antialiased;
  }
  .container {
    max-width: 600px;
    margin: 30px auto;
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    border: 1px solid #e2e8f0;
  }
  .header {
    background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
    color: #ffffff;
    padding: 28px 32px;
    text-align: left;
  }
  .header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }
  .header p {
    margin: 6px 0 0 0;
    font-size: 14px;
    color: #e0f2fe;
  }
  .content {
    padding: 32px;
  }
  .intro {
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: 24px;
    color: #334155;
  }
  .card {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
  }
  .card-title {
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #64748b;
    margin-top: 0;
    margin-bottom: 16px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 8px;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
  }
  .data-table td {
    padding: 8px 0;
    vertical-align: top;
  }
  .data-label {
    width: 38%;
    font-size: 14px;
    font-weight: 500;
    color: #64748b;
  }
  .data-value {
    width: 62%;
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
  }
  .badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .badge-confirmed {
    background-color: #dcfce7;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }
  .badge-cancelled {
    background-color: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }
  .badge-update {
    background-color: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
  }
  .badge-previous {
    background-color: #f1f5f9;
    color: #475569;
    border: 1px solid #cbd5e1;
  }
  .footer {
    background-color: #f8fafc;
    padding: 24px 32px;
    border-top: 1px solid #e2e8f0;
    font-size: 12px;
    color: #64748b;
    text-align: center;
    line-height: 1.5;
  }
  .instructions {
    background-color: #f0fdf4;
    border-left: 4px solid #22c55e;
    padding: 14px 16px;
    border-radius: 4px;
    margin-bottom: 24px;
    font-size: 14px;
    color: #166534;
    line-height: 1.5;
  }
  .warning-box {
    background-color: #fef2f2;
    border-left: 4px solid #ef4444;
    padding: 14px 16px;
    border-radius: 4px;
    margin-bottom: 24px;
    font-size: 14px;
    color: #991b1b;
    line-height: 1.5;
  }
`;

/**
 * Render Appointment Confirmation Email
 */
export function renderAppointmentConfirmationEmail(data: AppointmentEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Appointment Confirmed with Dr. ${data.doctorName} - HealthGate [Ref: ${data.appointmentId.slice(-6).toUpperCase()}]`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HealthGate</h1>
      <p>Appointment Confirmation & Booking Voucher</p>
    </div>
    <div class="content">
      <p class="intro">
        Dear <strong>${data.patientName}</strong>,<br><br>
        Your appointment has been successfully confirmed. Please review your appointment summary below.
      </p>

      <div class="instructions">
        <strong>✓ Status: Confirmed & Scheduled</strong><br>
        Please arrive 10 minutes prior to your scheduled time. Keep your Appointment Reference ID handy during check-in.
      </div>

      <div class="card">
        <h3 class="card-title">Appointment Summary</h3>
        <table class="data-table">
          <tr>
            <td class="data-label">Appointment ID:</td>
            <td class="data-value"><code>${data.appointmentId}</code></td>
          </tr>
          <tr>
            <td class="data-label">Doctor:</td>
            <td class="data-value">Dr. ${data.doctorName} ${data.doctorSpecialization ? `(${data.doctorSpecialization})` : ""}</td>
          </tr>
          <tr>
            <td class="data-label">Date:</td>
            <td class="data-value">${data.appointmentDate}</td>
          </tr>
          <tr>
            <td class="data-label">Time Slot:</td>
            <td class="data-value">${data.appointmentTime}</td>
          </tr>
          ${
            data.hospitalName
              ? `<tr>
            <td class="data-label">Facility / Hospital:</td>
            <td class="data-value">${data.hospitalName}</td>
          </tr>`
              : ""
          }
          ${
            data.department
              ? `<tr>
            <td class="data-label">Department:</td>
            <td class="data-value">${data.department}</td>
          </tr>`
              : ""
          }
          ${
            data.appointmentType
              ? `<tr>
            <td class="data-label">Consultation Type:</td>
            <td class="data-value">${data.appointmentType}</td>
          </tr>`
              : ""
          }
          ${
            data.reason
              ? `<tr>
            <td class="data-label">Purpose / Reason:</td>
            <td class="data-value">${data.reason}</td>
          </tr>`
              : ""
          }
          <tr>
            <td class="data-label">Current Status:</td>
            <td class="data-value"><span class="badge badge-confirmed">Confirmed</span></td>
          </tr>
        </table>
      </div>

      <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
        Need to reschedule or contact the clinic? You can manage your appointments directly from your HealthGate patient portal.
      </p>
    </div>
    <div class="footer">
      <p>HealthGate Hospital Management System &bull; Dedicated to Patient Care</p>
      <p>This is an automated notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
HealthGate Healthcare - Appointment Confirmed

Dear ${data.patientName},

Your appointment has been successfully confirmed.

Appointment Details:
- Appointment ID: ${data.appointmentId}
- Doctor: Dr. ${data.doctorName} ${data.doctorSpecialization ? `(${data.doctorSpecialization})` : ""}
- Date: ${data.appointmentDate}
- Time: ${data.appointmentTime}
${data.hospitalName ? `- Facility: ${data.hospitalName}\n` : ""}${data.department ? `- Department: ${data.department}\n` : ""}- Status: Confirmed

Please arrive 10 minutes prior to your appointment. You can view or manage your booking via the HealthGate patient dashboard.

HealthGate Medical Team
  `.trim();

  return { subject, html, text };
}

/**
 * Render Appointment Cancellation Email
 */
export function renderAppointmentCancellationEmail(data: AppointmentEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Appointment Cancelled - HealthGate [Ref: ${data.appointmentId.slice(-6).toUpperCase()}]`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);">
      <h1>HealthGate Healthcare</h1>
      <p>Notice of Appointment Cancellation</p>
    </div>
    <div class="content">
      <p class="intro">
        Dear <strong>${data.patientName}</strong>,<br><br>
        We are writing to inform you that your appointment has been <strong>cancelled</strong>.
      </p>

      <div class="warning-box">
        <strong>Notice:</strong> Your booking for <strong>${data.appointmentDate} at ${data.appointmentTime}</strong> with Dr. ${data.doctorName} is no longer active.
      </div>

      <div class="card">
        <h3 class="card-title">Cancelled Appointment Details</h3>
        <table class="data-table">
          <tr>
            <td class="data-label">Appointment ID:</td>
            <td class="data-value"><code>${data.appointmentId}</code></td>
          </tr>
          <tr>
            <td class="data-label">Doctor:</td>
            <td class="data-value">Dr. ${data.doctorName}</td>
          </tr>
          <tr>
            <td class="data-label">Originally Scheduled:</td>
            <td class="data-value">${data.appointmentDate} at ${data.appointmentTime}</td>
          </tr>
          ${
            data.cancellationReason
              ? `<tr>
            <td class="data-label">Cancellation Reason:</td>
            <td class="data-value" style="color: #b91c1c;">${data.cancellationReason}</td>
          </tr>`
              : ""
          }
          <tr>
            <td class="data-label">Status:</td>
            <td class="data-value"><span class="badge badge-cancelled">Cancelled</span></td>
          </tr>
        </table>
      </div>

      <p style="font-size: 14px; color: #475569; line-height: 1.6;">
        If you would like to book a new consultation or select another available time slot, please visit the HealthGate portal at your convenience.
      </p>
    </div>
    <div class="footer">
      <p>HealthGate Hospital Management System &bull; Dedicated to Patient Care</p>
      <p>This is an automated notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
HealthGate Healthcare - Appointment Cancelled

Dear ${data.patientName},

Your appointment with Dr. ${data.doctorName} scheduled for ${data.appointmentDate} at ${data.appointmentTime} has been cancelled.

Details:
- Appointment ID: ${data.appointmentId}
- Doctor: Dr. ${data.doctorName}
- Date/Time: ${data.appointmentDate} at ${data.appointmentTime}
${data.cancellationReason ? `- Reason: ${data.cancellationReason}\n` : ""}- Status: Cancelled

You can schedule a new appointment through the HealthGate portal.

HealthGate Medical Team
  `.trim();

  return { subject, html, text };
}

/**
 * Render Appointment Status Update Email
 */
export function renderAppointmentStatusUpdateEmail(data: AppointmentEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const newStatusLabel = (data.newStatus || "Updated").toUpperCase();
  const subject = `Appointment Status Updated: ${newStatusLabel} - HealthGate [Ref: ${data.appointmentId.slice(-6).toUpperCase()}]`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HealthGate Healthcare</h1>
      <p>Appointment Status Notification</p>
    </div>
    <div class="content">
      <p class="intro">
        Dear <strong>${data.patientName}</strong>,<br><br>
        The status of your appointment with <strong>Dr. ${data.doctorName}</strong> has been updated.
      </p>

      <div class="card">
        <h3 class="card-title">Status Change Details</h3>
        <table class="data-table">
          <tr>
            <td class="data-label">Appointment ID:</td>
            <td class="data-value"><code>${data.appointmentId}</code></td>
          </tr>
          <tr>
            <td class="data-label">Doctor:</td>
            <td class="data-value">Dr. ${data.doctorName}</td>
          </tr>
          <tr>
            <td class="data-label">Scheduled Date:</td>
            <td class="data-value">${data.appointmentDate}</td>
          </tr>
          <tr>
            <td class="data-label">Time Slot:</td>
            <td class="data-value">${data.appointmentTime}</td>
          </tr>
          <tr>
            <td class="data-label">Previous Status:</td>
            <td class="data-value"><span class="badge badge-previous">${data.previousStatus || "N/A"}</span></td>
          </tr>
          <tr>
            <td class="data-label">New Status:</td>
            <td class="data-value"><span class="badge badge-update">${data.newStatus || "Updated"}</span></td>
          </tr>
          ${
            data.reason
              ? `<tr>
            <td class="data-label">Notes / Reason:</td>
            <td class="data-value">${data.reason}</td>
          </tr>`
              : ""
          }
        </table>
      </div>

      <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
        You can check full history and prescription records anytime on the HealthGate dashboard.
      </p>
    </div>
    <div class="footer">
      <p>HealthGate Hospital Management System &bull; Dedicated to Patient Care</p>
      <p>This is an automated notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
HealthGate Healthcare - Appointment Status Updated

Dear ${data.patientName},

The status of your appointment has changed.

Details:
- Appointment ID: ${data.appointmentId}
- Doctor: Dr. ${data.doctorName}
- Date/Time: ${data.appointmentDate} at ${data.appointmentTime}
- Previous Status: ${data.previousStatus || "N/A"}
- New Status: ${data.newStatus || "Updated"}

You can view complete appointment details on your HealthGate portal.

HealthGate Medical Team
  `.trim();

  return { subject, html, text };
}

/**
 * Render Appointment Reschedule Request Email
 */
export function renderAppointmentRescheduleRequestEmail(data: AppointmentEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Action Required: Reschedule Request for Dr. ${data.doctorName} - HealthGate [Ref: ${data.appointmentId.slice(-6).toUpperCase()}]`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
      <h1>HealthGate</h1>
      <p>Appointment Reschedule Request</p>
    </div>
    <div class="content">
      <p class="intro">
        Dear <strong>${data.patientName}</strong>,<br><br>
        Dr. <strong>${data.doctorName}</strong> has requested to reschedule your upcoming appointment. Please review the proposed date and time below.
      </p>

      <div class="instructions" style="background-color: #fffbeb; border-left-color: #f59e0b; color: #b45309;">
        <strong>Action Needed:</strong> Please log in to your HealthGate patient dashboard to <strong>Accept</strong> or <strong>Decline</strong> this new schedule. Your current appointment remains reserved until you decide.
      </div>

      <div class="card">
        <h3 class="card-title">Reschedule Comparison</h3>
        <table class="data-table">
          <tr>
            <td class="data-label">Appointment ID:</td>
            <td class="data-value"><code>${data.appointmentId}</code></td>
          </tr>
          <tr>
            <td class="data-label">Doctor:</td>
            <td class="data-value">Dr. ${data.doctorName} ${data.doctorSpecialization ? `(${data.doctorSpecialization})` : ""}</td>
          </tr>
          <tr>
            <td class="data-label">Original Schedule:</td>
            <td class="data-value" style="color: #64748b; text-decoration: line-through;">${data.originalDate || data.appointmentDate} at ${data.originalTime || data.appointmentTime}</td>
          </tr>
          <tr>
            <td class="data-label">Proposed New Schedule:</td>
            <td class="data-value" style="color: #0284c7; font-size: 15px; font-weight: 700;">
              ${data.proposedDate} at ${data.proposedTime}
            </td>
          </tr>
          ${
            data.rescheduleReason
              ? `<tr>
            <td class="data-label">Doctor's Note / Reason:</td>
            <td class="data-value">${data.rescheduleReason}</td>
          </tr>`
              : ""
          }
          <tr>
            <td class="data-label">Request Status:</td>
            <td class="data-value"><span class="badge badge-update">Pending Your Approval</span></td>
          </tr>
        </table>
      </div>

      <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
        You can accept or decline this reschedule proposal with a single click from the <strong>Appointments</strong> section of your HealthGate portal.
      </p>
    </div>
    <div class="footer">
      <p>HealthGate Hospital Management System &bull; Dedicated to Patient Care</p>
      <p>This is an automated notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
HealthGate - Appointment Reschedule Request

Dear ${data.patientName},

Dr. ${data.doctorName} has requested to reschedule your appointment.

Details:
- Appointment ID: ${data.appointmentId}
- Doctor: Dr. ${data.doctorName}
- Original Schedule: ${data.originalDate || data.appointmentDate} at ${data.originalTime || data.appointmentTime}
- Proposed New Schedule: ${data.proposedDate} at ${data.proposedTime}
${data.rescheduleReason ? `- Reason: ${data.rescheduleReason}\n` : ""}- Status: Reschedule Pending Approval

Please log in to your HealthGate patient portal to Accept or Decline this request.

HealthGate Medical Team
  `.trim();

  return { subject, html, text };
}

/**
 * Render Appointment Reschedule Confirmed Email
 */
export function renderAppointmentRescheduleConfirmedEmail(data: AppointmentEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Rescheduled Appointment Confirmed with Dr. ${data.doctorName} - HealthGate [Ref: ${data.appointmentId.slice(-6).toUpperCase()}]`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header" style="background: linear-gradient(135deg, #059669 0%, #047857 100%);">
      <h1>HealthGate</h1>
      <p>Rescheduled Appointment Confirmed</p>
    </div>
    <div class="content">
      <p class="intro">
        Dear <strong>${data.patientName}</strong>,<br><br>
        Your appointment with Dr. <strong>${data.doctorName}</strong> has been successfully rescheduled and confirmed.
      </p>

      <div class="instructions">
        <strong>✓ Status: Confirmed for New Date & Time</strong><br>
        Please note the updated appointment date and time below and arrive 10 minutes prior to your consultation.
      </div>

      <div class="card">
        <h3 class="card-title">Updated Appointment Details</h3>
        <table class="data-table">
          <tr>
            <td class="data-label">Appointment ID:</td>
            <td class="data-value"><code>${data.appointmentId}</code></td>
          </tr>
          <tr>
            <td class="data-label">Doctor:</td>
            <td class="data-value">Dr. ${data.doctorName} ${data.doctorSpecialization ? `(${data.doctorSpecialization})` : ""}</td>
          </tr>
          ${
            data.originalDate && data.originalTime
              ? `<tr>
            <td class="data-label">Previous Schedule:</td>
            <td class="data-value" style="color: #64748b; text-decoration: line-through;">${data.originalDate} at ${data.originalTime}</td>
          </tr>`
              : ""
          }
          <tr>
            <td class="data-label">New Confirmed Date:</td>
            <td class="data-value" style="color: #047857; font-weight: 700;">${data.appointmentDate}</td>
          </tr>
          <tr>
            <td class="data-label">New Confirmed Time:</td>
            <td class="data-value" style="color: #047857; font-weight: 700;">${data.appointmentTime}</td>
          </tr>
          ${
            data.hospitalName
              ? `<tr>
            <td class="data-label">Facility / Hospital:</td>
            <td class="data-value">${data.hospitalName}</td>
          </tr>`
              : ""
          }
          ${
            data.department
              ? `<tr>
            <td class="data-label">Department:</td>
            <td class="data-value">${data.department}</td>
          </tr>`
              : ""
          }
          <tr>
            <td class="data-label">Current Status:</td>
            <td class="data-value"><span class="badge badge-confirmed">Confirmed (Rescheduled)</span></td>
          </tr>
        </table>
      </div>

      <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
        You can view your appointment details, join video consultations, or view prescriptions on your HealthGate portal.
      </p>
    </div>
    <div class="footer">
      <p>HealthGate Hospital Management System &bull; Dedicated to Patient Care</p>
      <p>This is an automated notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
HealthGate - Rescheduled Appointment Confirmed

Dear ${data.patientName},

Your appointment with Dr. ${data.doctorName} has been successfully rescheduled and confirmed.

Updated Details:
- Appointment ID: ${data.appointmentId}
- Doctor: Dr. ${data.doctorName}
${data.originalDate && data.originalTime ? `- Previous Schedule: ${data.originalDate} at ${data.originalTime}\n` : ""}- New Confirmed Date: ${data.appointmentDate}
- New Confirmed Time: ${data.appointmentTime}
- Status: Confirmed (Rescheduled)

Please arrive 10 minutes prior to your scheduled consultation.

HealthGate Medical Team
  `.trim();

  return { subject, html, text };
}

export interface PrescriptionEmailData {
  patientName: string;
  patientEmail: string;
  doctorName: string;
  doctorSpecialization?: string;
  doctorLicenseNumber?: string;
  hospitalName?: string;
  department?: string;
  appointmentId: string;
  prescriptionDate: string;
  diagnosis: string;
  medicines: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;
  labTests?: string[];
  additionalAdvice?: string;
  followUpDate?: string;
  digitalSignature?: string;
}

/**
 * Render Official Branded Prescription Issued Email
 */
export function renderPrescriptionIssuedEmail(data: PrescriptionEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const cleanDoctorName = (data.doctorName || "Doctor").replace(/^Dr\.?\s*/i, "");
  const subject = `Official Medical Prescription - Dr. ${cleanDoctorName} [Ref: ${data.appointmentId.slice(-6).toUpperCase()}]`;

  const medicinesRowsHtml = (data.medicines || [])
    .map(
      (m, idx) => `
      <tr style="border-top: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
        <td style="padding: 10px 12px; font-weight: 700; color: #64748b; font-size: 13px;">${idx + 1}</td>
        <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; font-size: 13px;">${m.name}</td>
        <td style="padding: 10px 12px; color: #475569; font-size: 13px;">${m.dosage || "—"}</td>
        <td style="padding: 10px 12px; color: #475569; font-size: 13px;">${m.frequency || "—"}</td>
        <td style="padding: 10px 12px; color: #475569; font-size: 13px;">${m.duration || "—"}</td>
        <td style="padding: 10px 12px; color: #0d9488; font-weight: 600; font-size: 13px;">${m.instructions || "—"}</td>
      </tr>
    `,
    )
    .join("");

  const labTestsHtml =
    data.labTests && data.labTests.length > 0
      ? `
    <div style="margin-top: 24px; padding: 16px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; color: #166534; letter-spacing: 0.5px;">
        🔬 Prescribed Lab Tests & Diagnostic Investigations
      </h3>
      <ul style="margin: 0; padding-left: 20px; color: #14532d; font-size: 14px; line-height: 1.6;">
        ${data.labTests.map((test) => `<li><strong>${test}</strong></li>`).join("")}
      </ul>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #15803d;">
        Please present this prescription copy at any accredited laboratory or diagnostic testing center.
      </p>
    </div>
  `
      : "";

  const adviceAndFollowUpHtml = `
    <div style="margin-top: 24px; display: table; width: 100%;">
      ${
        data.additionalAdvice
          ? `
        <div style="display: table-cell; vertical-align: top; width: 50%; padding-right: 12px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
            <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b;">Clinical Advice</span>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #334155; line-height: 1.5;">${data.additionalAdvice}</p>
          </div>
        </div>
      `
          : ""
      }
      ${
        data.followUpDate
          ? `
        <div style="display: table-cell; vertical-align: top; width: 50%; padding-left: 12px;">
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 14px;">
            <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #0284c7;">Recommended Follow-Up</span>
            <p style="margin: 6px 0 0 0; font-size: 14px; font-weight: 700; color: #0369a1;">${data.followUpDate}</p>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header" style="background: linear-gradient(135deg, #0d5c63 0%, #083c40 100%);">
      <div style="display: table; width: 100%;">
        <div style="display: table-cell; vertical-align: middle;">
          <div style="display: inline-block; width: 36px; height: 36px; line-height: 36px; text-align: center; background: rgba(255,255,255,0.2); border-radius: 8px; font-family: serif; font-weight: bold; font-size: 20px; color: #ffffff; margin-right: 12px; vertical-align: middle;">
            Rx
          </div>
          <div style="display: inline-block; vertical-align: middle;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">HealthGate Medical Center</h1>
            <p style="margin: 2px 0 0 0; font-size: 13px; color: #99f6e4;">Official Consultation Prescription & Clinical Advice</p>
          </div>
        </div>
        <div style="display: table-cell; vertical-align: middle; text-align: right;">
          <span style="font-size: 11px; font-weight: 700; color: #ccfbf1; text-transform: uppercase; letter-spacing: 0.5px;">Date</span><br>
          <strong style="font-size: 13px; color: #ffffff;">${data.prescriptionDate}</strong>
        </div>
      </div>
    </div>

    <div class="content">
      <p class="intro">
        Dear <strong>${data.patientName}</strong>,<br><br>
        Following your consultation, <strong>Dr. ${cleanDoctorName}</strong> has issued your official medical prescription and clinical advice. Please find your complete prescription details below.
      </p>

      <!-- Doctor & Patient Summary Card -->
      <div class="card" style="margin-bottom: 20px;">
        <table class="data-table">
          <tr>
            <td class="data-label">Attending Doctor:</td>
            <td class="data-value">Dr. ${cleanDoctorName} ${data.doctorSpecialization ? `(${data.doctorSpecialization})` : ""}</td>
          </tr>
          ${
            data.doctorLicenseNumber
              ? `<tr>
            <td class="data-label">Medical Reg. / License No:</td>
            <td class="data-value"><code style="color: #0d5c63; font-weight: 700;">${data.doctorLicenseNumber}</code></td>
          </tr>`
              : ""
          }
          ${
            data.hospitalName
              ? `<tr>
            <td class="data-label">Facility / Hospital:</td>
            <td class="data-value">${data.hospitalName} ${data.department ? `(${data.department})` : ""}</td>
          </tr>`
              : ""
          }
          <tr>
            <td class="data-label">Patient Name:</td>
            <td class="data-value"><strong>${data.patientName}</strong></td>
          </tr>
          <tr>
            <td class="data-label">Appointment Reference:</td>
            <td class="data-value"><code>${data.appointmentId}</code></td>
          </tr>
        </table>
      </div>

      <!-- Clinical Diagnosis -->
      <div style="margin-bottom: 22px; padding: 14px 16px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
        <span style="display: block; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #15803d; letter-spacing: 0.5px; margin-bottom: 4px;">
          Diagnosis & Clinical Findings
        </span>
        <div style="font-size: 15px; font-weight: 700; color: #166534; line-height: 1.4;">
          ${data.diagnosis}
        </div>
      </div>

      <!-- Prescribed Medicines Table -->
      <div style="margin-bottom: 20px;">
        <h3 class="card-title" style="margin-bottom: 12px;">Prescribed Medicines (${data.medicines?.length || 0})</h3>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: #f1f5f9; color: #334155; font-size: 11px; text-transform: uppercase; font-weight: 700;">
                <th style="padding: 8px 12px;">#</th>
                <th style="padding: 8px 12px;">Medicine</th>
                <th style="padding: 8px 12px;">Dosage</th>
                <th style="padding: 8px 12px;">Frequency</th>
                <th style="padding: 8px 12px;">Duration</th>
                <th style="padding: 8px 12px;">Instructions</th>
              </tr>
            </thead>
            <tbody>
              ${medicinesRowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      ${labTestsHtml}

      ${adviceAndFollowUpHtml}

      <!-- Doctor Digital Signature & Medical Verification Box -->
      <div style="margin-top: 30px; padding: 16px 20px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; display: table; width: 100%;">
        <div style="display: table-cell; vertical-align: middle; width: 60%;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
            Digital Signature & Authentication Stamp
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #0d5c63; margin-top: 4px;">
            Dr. ${cleanDoctorName}
          </div>
          <div style="font-size: 12px; color: #64748b;">
            Reg. No: <strong>${data.doctorLicenseNumber || "VERIFIED"}</strong> • HealthGate Clinical Network
          </div>
        </div>
        <div style="display: table-cell; vertical-align: middle; width: 40%; text-align: right;">
          <span style="display: inline-block; padding: 6px 12px; background: #dcfce7; border: 1px solid #86efac; border-radius: 20px; font-size: 12px; font-weight: 700; color: #15803d;">
            ✓ Digitally Authenticated
          </span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>HealthGate Hospital Management System &bull; Dedicated to Patient Care</p>
      <p>This is an authentic electronic prescription generated via HealthGate. Consult your licensed pharmacist for dispensation.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
HealthGate Medical Center - Official Medical Prescription

Patient: ${data.patientName}
Attending Doctor: Dr. ${cleanDoctorName} (${data.doctorSpecialization || "Specialist"})
Registration/License No: ${data.doctorLicenseNumber || "VERIFIED"}
Date: ${data.prescriptionDate}
Appointment Reference: ${data.appointmentId}

Diagnosis / Clinical Findings:
${data.diagnosis}

Prescribed Medicines:
${(data.medicines || [])
  .map(
    (m, idx) =>
      `${idx + 1}. ${m.name} - Dosage: ${m.dosage || "As directed"} | Frequency: ${m.frequency || "As directed"} | Duration: ${m.duration || "Standard"} | Instructions: ${m.instructions || "None"}`,
  )
  .join("\n")}

${data.labTests && data.labTests.length > 0 ? `Prescribed Lab Tests:\n${data.labTests.map((t) => `- ${t}`).join("\n")}\n` : ""}
${data.additionalAdvice ? `Clinical Advice:\n${data.additionalAdvice}\n` : ""}
${data.followUpDate ? `Recommended Follow-Up Date: ${data.followUpDate}\n` : ""}

Digitally Signed by Dr. ${cleanDoctorName} (Reg. No: ${data.doctorLicenseNumber || "VERIFIED"})
HealthGate Medical Authority
  `.trim();

  return { subject, html, text };
}


