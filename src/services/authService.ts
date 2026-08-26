import { supabase } from "@/integrations/supabase/client";

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getUserRole(userId: string): Promise<"admin" | "coach" | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching user role:", error);
    return null;
  }

  return data?.role as "admin" | "coach" | null;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "admin";
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
}

export async function updateProfile(userId: string, updates: {
  full_name?: string;
  phone?: string;
}) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function createProfile(userId: string, email: string, fullName: string) {
  const { data, error } = await supabase
    .from("profiles")
    .insert([
      {
        id: userId,
        email,
        full_name: fullName,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function assignUserRole(userId: string, role: "admin" | "coach" | "parent" | "pending") {
  const { data, error } = await supabase
    .from("user_roles")
    .insert([
      {
        user_id: userId,
        role,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserRole(userId: string, role: "admin" | "coach" | "parent" | "pending") {
  const { data, error } = await supabase
    .from("user_roles")
    .update({ role })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteUser(userId: string) {
  // This should be handled by admin via Supabase dashboard or RPC function
  // as deleting auth.users requires service_role permissions
  throw new Error("User deletion must be performed by administrator via Supabase dashboard");
}