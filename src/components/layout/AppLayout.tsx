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
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { pathname } = router;
  const { user, userRole } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = userRole === "admin";
  const isCoach = userRole === "coach";
  const isParent = userRole === "parent" || (!isAdmin && !isCoach);
  const isAdminOrCoach = isAdmin || isCoach;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">Klub Manager</span>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigacija</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Parent Navigation */}
                  {isParent && (
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
                        <SidebarMenuButton asChild isActive={pathname === "/my-children"}>
                          <Link href="/my-children">
                            <Users className="w-4 h-4" />
                            Moji otroci
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

                  {/* Coach Navigation */}
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

                  {/* Admin Navigation */}
                  {isAdmin && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === "/dashboard"}>
                          <Link href="/dashboard">
                            <Home className="w-4 h-4" />
                            Domov
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === "/activities"}>
                          <Link href="/activities">
                            <Trophy className="w-4 h-4" />
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
                            <User className="w-4 h-4" />
                            Igralci
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === "/coaches"}>
                          <Link href="/coaches">
                            <UserCircle className="w-4 h-4" />
                            Trenerji
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === "/schedules"}>
                          <Link href="/schedules">
                            <Calendar className="w-4 h-4" />
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
                            <Clock className="w-4 h-4" />
                            Sezone
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === "/billing"}>
                          <Link href="/billing">
                            <DollarSign className="w-4 h-4" />
                            Obračun
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
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === "/smtp-settings"}>
                          <Link href="/smtp-settings">
                            <Mail className="w-4 h-4" />
                            SMTP
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
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {user?.email?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm">
                    <span className="font-medium truncate max-w-[150px]">
                      {user?.email}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {userRole}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Moj račun</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Odjava
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6">
            <SidebarTrigger />
            <div className="flex-1" />
          </div>
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}