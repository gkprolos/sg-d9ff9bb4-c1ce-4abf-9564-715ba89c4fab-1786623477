import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("admin" | "coach" | "parent")[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const { user, userRole, loading } = useAuth();

  console.log("ProtectedRoute Debug:", { 
    pathname: router.pathname,
    user: user?.email,
    userRole, 
    loading,
    allowedRoles 
  }); // Debug log

  useEffect(() => {
    if (!loading) {
      console.log("ProtectedRoute Effect:", { user: !!user, userRole, pathname: router.pathname }); // Debug
      
      if (!user) {
        console.log("No user - redirecting to /login"); // Debug
        router.push("/login");
      } else if (allowedRoles && !allowedRoles.includes(userRole)) {
        console.log(`User role ${userRole} not in allowedRoles ${allowedRoles}`); // Debug
        
        // Redirect to role-specific default page
        const defaultPage = userRole === "parent" ? "/my-children" : "/dashboard";
        console.log(`Redirecting to ${defaultPage}`); // Debug
        router.push(defaultPage);
      }
    }
  }, [user, userRole, loading, router, allowedRoles]);

  if (loading) {
    console.log("ProtectedRoute: Loading state"); // Debug
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Nalaganje...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log("ProtectedRoute: No user, returning null"); // Debug
    return null;
  }

  console.log("ProtectedRoute: Rendering children"); // Debug
  return <>{children}</>;
}