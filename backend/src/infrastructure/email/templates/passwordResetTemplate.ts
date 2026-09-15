export function generatePasswordResetEmailHtml(otp: string): { html: string; text: string; subject: string } {
  const subject = "Reset Your Password - HelthGate Hospital Management";

  const text = `HelthGate Hospital Management System

We received a request to reset the password for your patient account.

Your 6-digit password reset verification code is: ${otp}

This verification code will expire in 10 minutes.

Security Notice:
Do not share this code with anyone. HelthGate staff will never ask for your verification code.
If you did not request a password reset, please disregard this email or contact support immediately. Your account remains secure.

HelthGate Healthcare Security Team`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your HelthGate Password</title>
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
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #0f766e;
      margin-bottom: 8px;
    }
    .otp-digits {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #0d9488;
      margin: 0;
    }
    .timer-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #fef3c7;
      color: #92400e;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 20px;
      margin-top: 14px;
    }
    .security-notice {
      background-color: #f8fafc;
      border-left: 4px solid #0d9488;
      border-radius: 0 8px 8px 0;
      padding: 16px;
      text-align: left;
      margin-top: 28px;
      font-size: 13px;
      line-height: 1.5;
      color: #64748b;
    }
    .security-notice strong {
      color: #1e293b;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 30px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <div class="container">
            <div class="header">
              <div class="logo-badge">HEALTHGATE CARE</div>
              <h1>Password Reset Request</h1>
              <p>Secure Patient Authentication</p>
            </div>
            <div class="content">
              <h2>Reset Your Password</h2>
              <p>
                We received a request to reset the password for your patient account.
                Use the 6-digit verification code below to confirm your identity and choose a new password.
              </p>
              
              <div class="otp-card">
                <div class="otp-label">Password Reset Code</div>
                <div class="otp-digits">${otp}</div>
                <div class="timer-badge">
                  ⏱ Valid for 10 minutes
                </div>
              </div>

              <div class="security-notice">
                <strong>Important Security Note:</strong><br>
                Do not share this code with anyone. HelthGate personnel will never contact you asking for your verification code. If you did not request this password reset, your account is still secure and you can safely disregard this email.
              </div>
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} HelthGate Hospital Management System. All rights reserved.<br>
              This is an automated security transmission. Please do not reply to this email.
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
`;

  return { html, text, subject };
}
