import nodemailer from 'nodemailer';

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || 587),
    secure: parseInt(process.env.SMTP_PORT || 587) === 465,
    auth: { user, pass }
  });
};

export const sendActivationOtpEmail = async (email, otp) => {
  console.log(`\n\x1b[35m[LICENSE ACTIVATION OTP]: Activation OTP for ${email} is: ${otp}\x1b[0m\n`);
  const transporter = getTransporter();
  if (!transporter) return { success: true, loggedToConsole: true };
  try {
    await transporter.sendMail({
      from: `"Renic Soft Platform" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Renic Soft License Activation Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 450px;">
          <h2 style="color: #4f46e5; margin-bottom: 20px;">License Activation</h2>
          <p>Use the following 6-digit OTP code to verify your license activation:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1e1b4b;">${otp}</span>
          </div>
          <p style="font-size: 12px; color: #6b7280;">This OTP expires in 10 minutes.</p>
        </div>
      `
    });
    return { success: true };
  } catch (error) {
    console.error('[Mailer Error]: Failed to send activation OTP email:', error.message);
    return { success: false, error: error.message };
  }
};

export const sendLicenseEmail = async (email, details) => {
  console.log(`\n\x1b[35m[LICENSE GENERATION SYSTEM]: License details logged for (${email}):\nKey: ${details.licenseKey}\nShop: ${details.shopName}\nOwner: ${details.ownerName} / ${details.ownerMobile}\x1b[0m\n`);
  const transporter = getTransporter();
  if (!transporter) return { success: true, loggedToConsole: true };
  try {
    await transporter.sendMail({
      from: `"Renic Soft Platform" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `License Generated: ${details.shopName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 500px;">
          <h2 style="color: #4f46e5; margin-bottom: 20px;">License Generated Successfully</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding: 6px 0; font-weight: bold;">Shop Name:</td><td>${details.shopName}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">License Key:</td><td><code style="background-color: #f3f4f6; padding: 3px 6px; border-radius: 4px;">${details.licenseKey}</code></td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Expires:</td><td>${new Date(details.licenseEnd).toLocaleDateString()}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Owner Name:</td><td>${details.ownerName}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Owner Mobile:</td><td>${details.ownerMobile}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Owner Email:</td><td>${details.ownerEmail}</td></tr>
          </table>
          <p style="font-size: 12px; color: #6b7280;">Keep these credentials secure. The shop must paste the license key and complete OTP verification during activation.</p>
        </div>
      `
    });
    return { success: true };
  } catch (error) {
    console.error('[Mailer Error]: Failed to send license email:', error.message);
    return { success: false, error: error.message };
  }
};