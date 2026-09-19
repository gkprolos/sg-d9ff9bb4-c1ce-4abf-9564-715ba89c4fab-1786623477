import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  User,
  ClipboardCheck,
  FileText,
  MessageSquare,
  DollarSign,
  Package,
  ShoppingBag,
  MapPin,
  Trophy,
  Shield,
  Mail,
  Menu,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Home,
  UserCircle,
  UserCog,
  ClipboardList,
  Clock,
  Building2,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Inner component that uses useSidebar hook
function InnerLayout({ children, userRole }: { children: React.ReactNode; userRole: "admin" | "coach" | "parent" }) {
  const router = useRouter();
  const { pathname } = router;
  const { user } = useAuth();
  const { state } = useSidebar(); // Now this is inside SidebarProvider
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = userRole === "admin";
  const isCoach = userRole === "coach";
  const isParent = userRole === "parent";
  const isAdminOrCoach = isAdmin || isCoach;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const userInitials = user?.email
    ? user.email
        .split("@")[0]
        .split(".")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="flex h-screen w-full">
      <Sidebar>
        <SidebarHeader className="border-b p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Trophy className="h-5 w-5" />
            </div>
            {state === "expanded" && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Klub</span>
                <span className="text-xs text-muted-foreground">
                  {isAdmin ? "Administrator" : isCoach ? "Trener" : "Starš"}
                </span>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigacija</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isParent && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/my-children"}>
                        <Link href="/my-children">
                          <Users className="w-4 h-4" />
                          Moji otroci
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/messaging"}>
                        <Link href="/messaging">
                          <MessageSquare className="w-4 h-4" />
                          Sporočila
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/store"}>
                        <Link href="/store">
                          <ShoppingBag className="w-4 h-4" />
                          Oprema
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}

                {isCoach && !isParent && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/dashboard"}>
                        <Link href="/dashboard">
                          <LayoutDashboard className="w-4 h-4" />
                          Nadzorna plošča
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/my-teams"}>
                        <Link href="/my-teams">
                          <Users className="w-4 h-4" />
                          Moje ekipe
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/my-players"}>
                        <Link href="/my-players">
                          <User className="w-4 h-4" />
                          Moji igralci
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/attendance"}>
                        <Link href="/attendance">
                          <ClipboardCheck className="w-4 h-4" />
                          Prisotnost
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/my-schedules"}>
                        <Link href="/my-schedules">
                          <Calendar className="w-4 h-4" />
                          Urnik
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/messaging"}>
                        <Link href="/messaging">
                          <MessageSquare className="w-4 h-4" />
                          Sporočila
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/store"}>
                        <Link href="/store">
                          <ShoppingBag className="w-4 h-4" />
                          Oprema
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}

                {isAdmin && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/dashboard"}>
                        <Link href="/dashboard">
                          <Home className="w-4 h-4" />
                          Nadzorna plošča
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/activities"}>
                        <Link href="/activities">
                          <ClipboardList className="w-4 h-4" />
                          Aktivnosti
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/attendance"}>
                        <Link href="/attendance">
                          <ClipboardCheck className="w-4 h-4" />
                          Prisotnost
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/teams"}>
                        <Link href="/teams">
                          <Users className="w-4 h-4" />
                          Selekcije
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/players"}>
                        <Link href="/players">
                          <UserCircle className="w-4 h-4" />
                          Igralci
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/coaches"}>
                        <Link href="/coaches">
                          <UserCog className="w-4 h-4" />
                          Trenerji
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/schedules"}>
                        <Link href="/schedules">
                          <Clock className="w-4 h-4" />
                          Urnik
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/venues"}>
                        <Link href="/venues">
                          <Building2 className="w-4 h-4" />
                          Dvorane
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/seasons"}>
                        <Link href="/seasons">
                          <Calendar className="w-4 h-4" />
                          Sezone
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/reports"}>
                        <Link href="/reports">
                          <BarChart3 className="w-4 h-4" />
                          Poročila
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/billing"}>
                        <Link href="/billing">
                          <DollarSign className="w-4 h-4" />
                          Obračuni
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/store"}>
                        <Link href="/store">
                          <ShoppingBag className="w-4 h-4" />
                          Oprema
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/messaging"}>
                        <Link href="/messaging">
                          <MessageSquare className="w-4 h-4" />
                          Sporočila
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/smtp-settings"}>
                        <Link href="/smtp-settings">
                          <Mail className="w-4 h-4" />
                          SMTP nastavitve
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/settings"}>
                        <Link href="/settings">
                          <Settings className="w-4 h-4" />
                          Nastavitve
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                {state === "expanded" && (
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-medium">{user?.email?.split("@")[0]}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Moj račun</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="w-4 h-4 mr-2" />
                Nastavitve
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Odjava
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
          <SidebarTrigger />
          <div className="flex-1" />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// Main export - wraps InnerLayout with SidebarProvider
export function AppLayout({ children }: { children: React.ReactNode }) {
  const { userRole } = useAuth();

  return (
    <SidebarProvider>
      <InnerLayout userRole={userRole}>
        {children}
      </InnerLayout>
    </SidebarProvider>
  );
}