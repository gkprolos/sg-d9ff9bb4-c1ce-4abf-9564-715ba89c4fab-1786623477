import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
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

  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email je obvezen" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Neveljaven email naslov" });
    }

    // Check if email exists in guardians table
    const { data: guardian, error: guardianError } = await supabase
      .from("guardians")
      .select("id, email, name")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (guardianError) {
      console.error("Guardian lookup error:", guardianError);
      return res.status(500).json({ error: "Napaka pri preverjanju emaila" });
    }

    if (!guardian) {
      return res.status(404).json({ 
        error: "Email naslov ni registriran v sistemu" 
      });
    }

    // Rate limiting: check recent OTP requests (max 3 per 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentCodes, error: rateLimitError } = await supabase
      .from("parent_auth_codes")
      .select("id")
      .eq("parent_email", email.toLowerCase().trim())
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
    const code = crypto.randomInt(1000, 9999).toString();

    // Hash the code for storage (security best practice)
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    // Store OTP code (expires in 3 minutes)
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from("parent_auth_codes")
      .insert({
        parent_email: email.toLowerCase().trim(),
        code: codeHash,
        expires_at: expiresAt,
        used: false,
      });

    if (insertError) {
      console.error("OTP insert error:", insertError);
      return res.status(500).json({ error: "Napaka pri shranjevanju kode" });
    }

    // Get SMTP settings
    const { data: smtpSettings, error: smtpError } = await supabase
      .from("smtp_settings")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (smtpError || !smtpSettings) {
      console.error("SMTP settings error:", smtpError);
      return res.status(500).json({ 
        error: "SMTP nastavitve niso konfigurirane. Kontaktirajte administratorja." 
      });
    }

    // Send email with OTP code
    await sendOTPEmail(smtpSettings as SMTPSettings, email, code, guardian.name);

    return res.status(200).json({ 
      success: true,
      message: "Koda je bila poslana na vaš email",
      expiresIn: 180, // 3 minutes in seconds
    });

  } catch (error: any) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ 
      error: error.message || "Napaka pri pošiljanju kode" 
    });
  }
}

async function sendOTPEmail(
  smtp: SMTPSettings,
  recipientEmail: string,
  code: string,
  recipientName: string
) {
  const transporter = nodemailer.createTransport({
    host: smtp.smtp_host,
    port: smtp.smtp_port,
    secure: smtp.smtp_secure, // true for 465, false for other ports
    auth: {
      user: smtp.smtp_username,
      pass: smtp.smtp_password,
    },
  });

  const emailHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .code { font-size: 32px; font-weight: bold; color: #1e40af; text-align: center; 
                letter-spacing: 8px; padding: 20px; background-color: white; 
                border: 2px dashed #1e40af; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        .warning { color: #dc2626; font-size: 14px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>OK Lubnik - Prijavna Koda</h1>
        </div>
        <div class="content">
          <p>Pozdravljeni${recipientName ? `, ${recipientName}` : ""},</p>
          
          <p>Vaša prijavna koda za dostop do športne aplikacije je:</p>
          
          <div class="code">${code}</div>
          
          <p><strong>Koda je veljavna 3 minute.</strong></p>
          
          <p>Če niste zahtevali te kode, ignorirajte to sporočilo.</p>
          
          <div class="warning">
            ⚠️ Ne delite te kode z nikomer. Osebje OK Lubnik vas nikoli ne bo prosilo za vašo kodo.
          </div>
        </div>
        <div class="footer">
          <p>OK Lubnik - Športni Klub</p>
          <p>To je avtomatsko generirano sporočilo. Ne odgovarjajte na ta email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailText = `
OK Lubnik - Prijavna Koda

Pozdravljeni${recipientName ? `, ${recipientName}` : ""},

Vaša prijavna koda za dostop do športne aplikacije je:

${code}

Koda je veljavna 3 minute.

Če niste zahtevali te kode, ignorirajte to sporočilo.

⚠️ Ne delite te kode z nikomer. Osebje OK Lubnik vas nikoli ne bo prosilo za vašo kodo.

---
OK Lubnik - Športni Klub
To je avtomatsko generirano sporočilo. Ne odgovarjajte na ta email.
  `;

  await transporter.sendMail({
    from: `"${smtp.smtp_from_name}" <${smtp.smtp_from_email}>`,
    to: recipientEmail,
    subject: "Vaša prijavna koda - OK Lubnik",
    text: emailText,
    html: emailHTML,
  });
}