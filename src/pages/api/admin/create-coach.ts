import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Admin API endpoint for creating coaches without logging in as them
 * Uses Supabase Admin API with service_role key (server-side only)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get Supabase service role client (admin privileges)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { email, password, full_name, phone, hourly_rate, km_rate } = req.body;

    // Validate required fields
    if (!email || !password || !full_name) {
      return res.status(400).json({ 
        error: 'Email, password, and full_name are required' 
      });
    }

    // Create user with Admin API (does NOT log them in)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name,
        phone: phone || null,
        hourly_rate: hourly_rate || null,
        km_rate: km_rate || null,
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      return res.status(500).json({ error: 'User creation failed' });
    }

    // Insert or update profile with additional data
    // Using upsert to handle both new profile creation and updates
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        full_name,
        email,
        phone: phone || null,
        hourly_rate: hourly_rate || null,
        km_rate: km_rate || null,
      }, {
        onConflict: 'id',
      });

    if (profileError) {
      console.error('Profile upsert error:', profileError);
      return res.status(500).json({ error: profileError.message });
    }

    // Insert coach role in user_roles table
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'coach',
      });

    if (roleError) {
      console.error('User role insert error:', roleError);
      return res.status(500).json({ error: roleError.message });
    }

    return res.status(200).json({ 
      success: true, 
      user_id: authData.user.id 
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}