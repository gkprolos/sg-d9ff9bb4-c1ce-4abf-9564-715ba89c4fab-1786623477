import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/router";

interface AuthContextType {
  user: User | null;
  userRole: "admin" | "coach" | null;
  parentEmail: string | null;
  effectiveRole: "admin" | "coach" | "parent" | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "coach" | null>(null);
  const [parentEmail, setParentEmail] = useState<string | null>(null);
  const [effectiveRole, setEffectiveRole] = useState<"admin" | "coach" | "parent" | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check parent session first
    if (typeof window !== "undefined") {
      const parentSession = sessionStorage.getItem("parentSession");
      if (parentSession) {
        try {
          const session = JSON.parse(parentSession);
          setParentEmail(session.email);
          setEffectiveRole("parent");
          setLoading(false);
          console.log("Parent session detected:", session.email);
          return; // Parent session found, skip Supabase auth check
        } catch (e) {
          console.error("Invalid parent session", e);
          sessionStorage.removeItem("parentSession");
        }
      }
    }

    // Check active Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setEffectiveRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserRole(userId: string) {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      const role = data.role as "admin" | "coach";
      setUserRole(role);
      setEffectiveRole(role);
    } catch (error) {
      console.error("Error fetching user role:", error);
      setUserRole(null);
      setEffectiveRole(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }

  async function signOut() {
    // Clear parent session
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("parentSession");
    }
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    setParentEmail(null);
    setEffectiveRole(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, userRole, parentEmail, effectiveRole, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}