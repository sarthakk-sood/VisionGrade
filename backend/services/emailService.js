const nodemailer = require('nodemailer');

/**
 * Sends a 6-digit OTP verification email to the user.
 * @param {string} email - Destination email address
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<void>} Resolves on success, throws on error.
 */
async function sendOTPEmail(email, otp) {
  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error('SMTP configuration variables (EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS) are missing in environment configuration.');
  }

  try {
    const transporter = nodemailer.createTransport({
      host: host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465, // Secure flag set to true if SSL/TLS port 465 is used
      auth: {
        user: user,
        pass: pass,
      },
    });

    const mailOptions = {
      from: `"VisionGrade" <${user}>`,
      to: email,
      subject: 'VisionGrade - Your Verification Code',
      text: `Your VisionGrade verification code is: ${otp}\n\nNote: This code is valid for 10 minutes. Please enter it to verify your account.`,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('[EMAIL SERVICE ERROR]:', error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}

module.exports = { sendOTPEmail };
