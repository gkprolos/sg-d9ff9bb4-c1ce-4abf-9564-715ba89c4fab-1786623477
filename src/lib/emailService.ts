import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Load SMTP settings from database
    const { data: smtpSettings, error } = await supabase
      .from("smtp_settings")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (error || !smtpSettings) {
      console.error("SMTP settings not found:", error);
      return false;
    }

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: smtpSettings.smtp_host,
      port: smtpSettings.smtp_port,
      secure: smtpSettings.smtp_secure,
      auth: {
        user: smtpSettings.smtp_username,
        pass: smtpSettings.smtp_password
      }
    });

    // Send email
    await transporter.sendMail({
      from: `"${smtpSettings.smtp_from_name}" <${smtpSettings.smtp_from_email}>`,
      to: options.to,
      subject: options.subject,
      html: options.html
    });

    console.log("Email sent successfully to:", options.to);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
}

export function generateNewMessageEmailHTML(
  senderName: string,
  conversationSubject: string,
  messagePreview: string,
  conversationLink: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #65a30d 0%, #84cc16 100%);
      color: white;
      padding: 30px;
      border-radius: 8px 8px 0 0;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      background: #ffffff;
      padding: 30px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .message-box {
      background: #f9fafb;
      border-left: 4px solid #65a30d;
      padding: 15px;
      margin: 20px 0;
    }
    .message-preview {
      color: #6b7280;
      font-style: italic;
    }
    .button {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 500;
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      border-radius: 0 0 8px 8px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📨 Novo Sporočilo</h1>
  </div>
  
  <div class="content">
    <p><strong>${senderName}</strong> vam je poslal novo sporočilo v pogovoru:</p>
    
    <div class="message-box">
      <h3 style="margin-top: 0;">${conversationSubject}</h3>
      <p class="message-preview">"${messagePreview}"</p>
    </div>
    
    <p>Prijavite se v aplikacijo, da preberete celotno sporočilo in odgovorite:</p>
    
    <div style="text-align: center;">
      <a href="${conversationLink}" class="button">Preberi Sporočilo</a>
    </div>
    
    <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
      Če ne želite prejemati teh obvestil, nas kontaktirajte na <a href="mailto:info@oklubnik.si">info@oklubnik.si</a>
    </p>
  </div>
  
  <div class="footer">
    <p>OK Lubnik - Sistem za upravljanje klub aktivnosti</p>
    <p>© ${new Date().getFullYear()} OK Lubnik. Vse pravice pridržane.</p>
  </div>
</body>
</html>
  `;
}