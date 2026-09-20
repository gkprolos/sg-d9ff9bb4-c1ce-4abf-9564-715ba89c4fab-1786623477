import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/router";

interface AuthContextType {
  user: User | null;
  userRole: "admin" | "coach" | "parent";
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "coach" | "parent" | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event, session?.user?.email);
      
      setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          const { data, error } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (error) {
            console.error("Error fetching user role:", error);
            setUserRole("parent");
          } else {
            const role = data?.role || "parent";
            setUserRole(getUserRole([{ role }]));
            
            // For parent users (magic link), store email in localStorage
            if (role === "parent") {
              localStorage.setItem("parent_email", session.user.email || "");
              
              // Fetch and store parent's children
              const { data: children } = await supabase
                .from("players")
                .select("id, first_name, last_name")
                .or(`guardian1_email.eq.${session.user.email},guardian2_email.eq.${session.user.email}`);
              
              if (children) {
                localStorage.setItem("parent_children", JSON.stringify(children));
              }
            }
          }
        } catch (err) {
          console.error("Error fetching user role:", err);
          setUserRole("parent");
        }
      } else {
        // Clear parent data on logout
        localStorage.removeItem("parent_email");
        localStorage.removeItem("parent_children");
      }
      
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle()
          .then(async ({ data, error }) => {
            if (error) {
              console.error("Error fetching user role:", error);
              setUserRole("parent");
            } else {
              const role = data?.role || "parent";
              setUserRole(getUserRole([{ role }]));
              
              // For parent users, store email and children
              if (role === "parent" && session.user.email) {
                localStorage.setItem("parent_email", session.user.email);
                
                const { data: children } = await supabase
                  .from("players")
                  .select("id, first_name, last_name")
                  .or(`guardian1_email.eq.${session.user.email},guardian2_email.eq.${session.user.email}`);
                
                if (children) {
                  localStorage.setItem("parent_children", JSON.stringify(children));
                }
              }
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
  }, []);

  async function fetchUserRole(userId: string) {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setUserRole(data.role as "admin" | "coach" | "parent");
    } catch (error) {
      console.error("Error fetching user role:", error);
      setUserRole(null);
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, userRole, loading, signIn, signOut }}>
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

function getUserRole(roles: any[]): "admin" | "coach" | "parent" {
  if (!roles || roles.length === 0) return "parent"; // Default to parent if no roles
  
  // Priority: admin > coach > parent
  if (roles.some((r) => r.role === "admin")) return "admin";
  if (roles.some((r) => r.role === "coach")) return "coach";
  if (roles.some((r) => r.role === "parent")) return "parent";
  
  return "parent"; // Default fallback
}