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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import supabase from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { pathname } = router;
  const { user, userRole, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isAdmin = userRole.some(role => role.role === "admin");
  const isCoach = userRole.some(role => role.role === "coach");
  const isParent = userRole.some(role => role.role === "parent");
  const isAdminOrCoach = isAdmin || isCoach;

  const adminNavigation = [
    { name: "Nadzorna plošča", href: "/dashboard", icon: Home },
    { name: "Selekcije", href: "/teams", icon: Users },
    { name: "Igralci", href: "/players", icon: UserCircle },
    { name: "Trenerji", href: "/coaches", icon: UserCog },
    { name: "Aktivnosti", href: "/activities", icon: Calendar },
    { name: "Prisotnost", href: "/attendance", icon: ClipboardList },
    { name: "Urnik", href: "/schedules", icon: Clock },
    { name: "Dvorane", href: "/venues", icon: Building2 },
    { name: "Sezone", href: "/seasons", icon: Trophy },
    { name: "Obračun", href: "/billing", icon: DollarSign },
    { name: "Poročila", href: "/reports", icon: BarChart3 },
    { name: "Sporočila", href: "/messaging", icon: MessageSquare },
    { name: "Oprema", href: "/store", icon: Package },
    { name: "Nastavitve", href: "/settings", icon: Settings },
    { name: "SMTP Nastavitve", href: "/smtp-settings", icon: Mail },
  ];

  const coachNavigation = [
    { name: "Pregled", href: "/dashboard", icon: Home },
    { name: "Moje Selekcije", href: "/my-teams", icon: Users },
    { name: "Moji Igralci", href: "/my-players", icon: UserCircle },
    { name: "Aktivnosti", href: "/activities", icon: Calendar },
    { name: "Prisotnost", href: "/attendance", icon: ClipboardList },
    { name: "Moj Urnik", href: "/my-schedules", icon: Clock },
    { name: "Dvorane", href: "/my-venues", icon: Building2 },
    { name: "Obračun", href: "/billing", icon: DollarSign },
    { name: "Sporočila", href: "/messaging", icon: MessageSquare },
    { name: "Oprema", href: "/store", icon: Package },
  ];

  const parentNavigation = [
    { name: "Moji Otroci", href: "/my-children", icon: UserCircle },
    { name: "Urnik", href: "/my-schedules", icon: Clock },
    { name: "Prisotnost", href: "/attendance/monthly", icon: ClipboardList },
    { name: "Sporočila", href: "/messaging", icon: MessageSquare },
    { name: "Oprema", href: "/store", icon: Package },
  ];

  const navigation =
    userRole === "admin"
      ? adminNavigation
      : userRole === "coach"
      ? coachNavigation
      : parentNavigation;

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-4">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden mr-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">K</span>
              </div>
              <span className="font-bold text-xl hidden sm:inline-block">
                Klub
              </span>
            </Link>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user?.email ? getInitials(user.email) : "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {userRole === "admin"
                      ? "Administrator"
                      : userRole === "coach"
                      ? "Trener"
                      : "Starš"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Nastavitve</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Odjava</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:pt-16 border-r bg-background">
          <div className="flex flex-col gap-1 p-4 overflow-y-auto">
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
          </div>
        </aside>

        {/* Mobile Sidebar */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-background pt-16">
              <div className="flex flex-col gap-1 p-4 overflow-y-auto">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span className="flex-1">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 md:pl-64 pt-16">
          <div className="container mx-auto p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}