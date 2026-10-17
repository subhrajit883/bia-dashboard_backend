import nodemailer from "nodemailer";

const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email service is not configured. Set EMAIL_HOST, EMAIL_USER and EMAIL_PASS.");
  }

  const host = process.env.EMAIL_HOST?.trim();
  const port = Number(process.env.EMAIL_PORT || 587);
  const secure = String(process.env.EMAIL_SECURE) === "true" || port === 465;

  let transportConfig;
  if (host) {
    transportConfig = {
      host,
      port,
      secure,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    };
  } else if (process.env.EMAIL_USER?.includes("@gmail.com")) {
    transportConfig = {
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    };
  } else {
    transportConfig = {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    };
  }

  const transporter = nodemailer.createTransport(transportConfig);

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text,
    html
  });
};

export default sendEmail;
