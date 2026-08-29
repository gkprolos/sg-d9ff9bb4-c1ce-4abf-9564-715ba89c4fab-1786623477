import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import crypto from "crypto";

// Initialize Supabase client with service role key (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SMTPSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_secure: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email je obvezen" });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Neveljaven email format" });
  }

  try {
    // Check if email exists in players table (guardian_1_email or guardian_2_email)
    const { data: players, error: playerError } = await supabase
      .from("players")
      .select("id, first_name, last_name, guardian_1_email, guardian_2_email")
      .or(`guardian_1_email.eq.${email},guardian_2_email.eq.${email}`)
      .limit(1);

    if (playerError) {
      console.error("Database error:", playerError);
      return res.status(500).json({ error: "Napaka pri preverjanju emaila" });
    }

    if (!players || players.length === 0) {
      return res.status(404).json({ 
        error: "Email ni najden. Preverite ali je vnesen kot kontakt starša pri igralcu." 
      });
    }

    // Check rate limiting (max 3 OTP requests per 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentCodes, error: rateLimitError } = await supabase
      .from("parent_auth_codes")
      .select("id")
      .eq("parent_email", email)
      .gte("created_at", fifteenMinutesAgo);

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
    }

    if (recentCodes && recentCodes.length >= 3) {
      return res.status(429).json({ 
        error: "Preveč poskusov. Poskusite ponovno čez 15 minut." 
      });
    }

    // Generate 4-digit OTP code
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    // Hash the code before storing
    const hashedCode = await bcrypt.hash(code, 10);

    // Store OTP code (expires in 3 minutes)
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from("parent_auth_codes")
      .insert([
        {
          parent_email: email,
          code: hashedCode,
          expires_at: expiresAt,
          used: false,
        },
      ]);

    if (insertError) {
      console.error("Insert error:", insertError);
      return res.status(500).json({ error: "Napaka pri generiranju kode" });
    }

    // Get SMTP settings from database
    const { data: smtpConfig, error: smtpError } = await supabase
      .from("smtp_settings")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (smtpError) {
      console.error("SMTP settings error:", smtpError);
      return res.status(500).json({ 
        error: "SMTP nastavitve niso konfigurirane. Kontaktirajte administratorja." 
      });
    }

    if (!smtpConfig) {
      console.error("No active SMTP settings found");
      return res.status(500).json({ 
        error: "SMTP nastavitve niso konfigurirane. Kontaktirajte administratorja." 
      });
    }

    // Send email with OTP code
    try {
      await sendOTPEmail(email, code, smtpConfig);
      console.log("OTP email sent successfully to:", email);
    } catch (emailError: any) {
      console.error("Email sending error:", emailError);
      // Delete the OTP code since email failed to send
      await supabase
        .from("parent_auth_codes")
        .delete()
        .eq("parent_email", email)
        .eq("code", hashedCode);
      
      return res.status(500).json({ 
        error: "Napaka pri pošiljanju emaila. Preverite SMTP nastavitve." 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Koda poslana na email" 
    });
  } catch (error: any) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ 
      error: error.message || "Napaka pri pošiljanju kode" 
    });
  }
}

async function sendOTPEmail(
  toEmail: string, 
  code: string,
  smtpSettings: any
) {
  const transporter = nodemailer.createTransport({
    host: smtpSettings.smtp_host,
    port: smtpSettings.smtp_port,
    secure: smtpSettings.smtp_secure,
    auth: {
      user: smtpSettings.smtp_username,
      pass: smtpSettings.smtp_password,
    },
  });

  const emailText = `
Pozdravljeni,

Vaša prijavna koda za dostop do podatkov o prisotnosti vašega otroka je:

${code}

Koda je veljavna 3 minute.

Če niste zahtevali te kode, ignorirajte to sporočilo.

Lep pozdrav,
${smtpSettings.smtp_from_name}
  `.trim();

  const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .code { 
      font-size: 32px; 
      font-weight: bold; 
      color: #2563eb; 
      text-align: center; 
      padding: 20px; 
      background: #f3f4f6; 
      border-radius: 8px; 
      margin: 20px 0;
      letter-spacing: 8px;
    }
    .footer { 
      margin-top: 30px; 
      padding-top: 20px; 
      border-top: 1px solid #e5e7eb; 
      font-size: 12px; 
      color: #6b7280; 
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>Prijavna Koda</h2>
    <p>Pozdravljeni,</p>
    <p>Vaša prijavna koda za dostop do podatkov o prisotnosti vašega otroka je:</p>
    
    <div class="code">${code}</div>
    
    <p><strong>Koda je veljavna 3 minute.</strong></p>
    
    <p>Če niste zahtevali te kode, ignorirajte to sporočilo.</p>
    
    <div class="footer">
      <p>Lep pozdrav,<br>${smtpSettings.smtp_from_name}</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: `"${smtpSettings.smtp_from_name}" <${smtpSettings.smtp_from_email}>`,
    to: toEmail,
    subject: "Vaša prijavna koda - OK Lubnik",
    text: emailText,
    html: emailHTML,
  });
}