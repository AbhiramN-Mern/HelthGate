export function generateOtpEmailHtml(otp: string): { html: string; text: string; subject: string } {
  const subject = "Verify Your Email - HelthGate Hospital Management";
  
  const text = `Welcome to HelthGate Hospital Management System!

Your verification code is: ${otp}

This code will expire in 10 minutes.

Security Notice:
Do not share this code with anyone. HelthGate staff will never ask for your verification code. If you did not request this code, you can safely ignore this email.

HealthGate Healthcare Team`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HelthGate Verification Code</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f1f5f9;
      padding: 40px 0;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      padding: 32px 30px;
      text-align: center;
    }
    .logo-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 12px;
      padding: 6px 14px;
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .header p {
      margin: 6px 0 0 0;
      color: #ccfbf1;
      font-size: 14px;
    }
    .content {
      padding: 36px 32px;
      text-align: center;
    }
    .content h2 {
      margin: 0 0 12px 0;
      font-size: 20px;
      color: #0f172a;
      font-weight: 600;
    }
    .content p {
      margin: 0 0 24px 0;
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
    }
    .otp-card {
      background: #f8fafc;
      border: 2px dashed #0d9488;
      border-radius: 14px;
      padding: 24px 16px;
      margin: 24px 0;
      text-align: center;
    }
    .otp-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .otp-code {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #0f766e;
      font-family: 'Courier New', Courier, monospace;
      margin: 0;
      padding-left: 8px;
    }
    .expiry-badge {
      display: inline-block;
      margin-top: 10px;
      padding: 4px 12px;
      background-color: #fef3c7;
      color: #92400e;
      font-size: 13px;
      font-weight: 600;
      border-radius: 9999px;
    }
    .warning-box {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      border-radius: 6px;
      padding: 14px 16px;
      text-align: left;
      margin-top: 24px;
    }
    .warning-box p {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: #1e40af;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 32px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="container" role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td class="header">
          <div class="logo-badge">HEALTHGATE</div>
          <h1>Verify Your Email</h1>
          <p>Hospital & Telehealth Management System</p>
        </td>
      </tr>
      <tr>
        <td class="content">
          <h2>One-Time Verification Code</h2>
          <p>
            Thank you for registering with HelthGate. Use the 6-digit verification code below to confirm your email address and activate your patient account:
          </p>

          <div class="otp-card">
            <div class="otp-label">Your Security Code</div>
            <div class="otp-code">${otp}</div>
            <div class="expiry-badge">⏱ Expires in 10 minutes</div>
          </div>

          <div class="warning-box">
            <p>
              <strong>Security Warning:</strong> Never share this OTP with anyone. HelthGate staff will never ask you for your verification code. If you did not attempt to register, please ignore this email.
            </p>
          </div>
        </td>
      </tr>
      <tr>
        <td class="footer">
          &copy; ${new Date().getFullYear()} HelthGate Hospital Management System. All rights reserved.<br>
          This is an automated system email. Please do not reply directly to this message.
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();

  return { html, text, subject };
}
