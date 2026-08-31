import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider } from
"@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  Users,
  UserCog,
  UserCircle,
  MapPin,
  Clock,
  Settings,
  Menu,
  LogOut,
  ChevronRight,
  Activity,
  ClipboardCheck,
  Building,
  DollarSign,
  Calculator,
  FileText,
  Shield,
  Mail,
  Archive,
  MessageSquare } from
"lucide-react";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: {children: React.ReactNode;}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userRole, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  // Check for parent session (localStorage-based, not Supabase Auth)
  const [isParent, setIsParent] = useState(false);
  const [parentEmail, setParentEmail] = useState<string>("");

  useEffect(() => {
    const parentSession = sessionStorage.getItem("parentSession");
    if (parentSession) {
      try {
        const session = JSON.parse(parentSession);
        setIsParent(true);
        setParentEmail(session.email || "");
      } catch (e) {
        setIsParent(false);
      }
    }
  }, []);

  const handleLogout = async () => {
    try {
      if (isParent) {
        // Parent logout
        sessionStorage.removeItem("parentSession");
        router.push("/login/parent");
      } else {
        // Coach/Admin logout
        await signOut();
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const isAdmin = userRole === "admin";
  const isCoach = userRole === "coach";

  // Parent Navigation (only My Children)
  const parentNavigation = [
  { name: "Moji Otroci", href: "/my-children", icon: UserCircle }];


  // Admin Navigation
  const adminNavigation = [
  { name: "Nadzorna plošča", href: "/dashboard", icon: LayoutDashboard },
  { name: "Vnos prisotnosti", href: "/attendance", icon: ClipboardList },
  { name: "Aktivnosti", href: "/activities", icon: Activity },
  { name: "Selekcije", href: "/teams", icon: Users },
  { name: "Igralci", href: "/players", icon: UserCircle },
  { name: "Trenerji", href: "/coaches", icon: UserCog },
  { name: "Dvorane", href: "/venues", icon: MapPin },
  { name: "Urniki", href: "/schedules", icon: Clock },
  { name: "Sezone", href: "/seasons", icon: Calendar },
  { name: "Nastavitve", href: "/settings", icon: Settings }];


  // Coach Navigation
  const coachNavigation = [
  { name: "Moj pregled", href: "/dashboard", icon: LayoutDashboard },
  { name: "Dodaj prisotnost", href: "/attendance", icon: ClipboardCheck },
  { name: "Aktivnosti", href: "/activities", icon: Activity },
  { name: "Moje selekcije", href: "/my-teams", icon: Users },
  { name: "Moji igralci", href: "/my-players", icon: UserCircle },
  { name: "Dvorane", href: "/my-venues", icon: MapPin },
  { name: "Urniki", href: "/my-schedules", icon: Clock },
  { name: "Nastavitve", href: "/settings", icon: Settings }];


  const navigation = isAdmin ?
  [
  { name: "Nadzorna plošča", href: "/dashboard", icon: LayoutDashboard },
  { name: "Aktivnosti", href: "/activities", icon: Activity },
  { name: "Prisotnost", href: "/attendance", icon: ClipboardCheck },
  { name: "Selekcije", href: "/teams", icon: Users },
  { name: "Igralci", href: "/players", icon: UserCog },
  { name: "Trenerji", href: "/coaches", icon: ClipboardList },
  { name: "Dvorane", href: "/venues", icon: Building },
  { name: "Urniki", href: "/schedules", icon: Clock },
  { name: "Sezone", href: "/seasons", icon: Calendar },
  { name: "Nastavitve", href: "/settings", icon: Settings }] :

  [
  { name: "Moj pregled", href: "/dashboard", icon: LayoutDashboard },
  { name: "Vnos prisotnosti", href: "/attendance", icon: ClipboardCheck },
  { name: "Moje aktivnosti", href: "/activities", icon: Activity },
  { name: "Igralci", href: "/my-players", icon: UserCog },
  { name: "Selekcije", href: "/my-teams", icon: Users },
  { name: "Dvorane", href: "/my-venues", icon: Building },
  { name: "Urniki", href: "/my-schedules", icon: Clock }];


  const NavContent = () =>
  <>
      <div className="px-6 py-4">
        <div className="flex items-center gap-3">
          <img
          src="/LOGO-2015-C_B.gif"
          alt="OK Lubnik"
          className="h-12 w-auto" />
        
          <div>
            <h2 className="font-semibold text-base leading-tight">OK Lubnik</h2>
            <p className="text-xs text-muted-foreground">Sezona 2026/2027</p>
          </div>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>{isAdmin ? "Nadzorna plošča" : "Moj pregled"}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {isAdmin &&
          <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/activities">
                      <Activity className="h-4 w-4" />
                      <span>Aktivnosti</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/seasons">
                      <Calendar className="h-4 w-4" />
                      <span>Sezone</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
          }

            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/attendance">
                  <ClipboardCheck className="h-4 w-4" />
                  <span>{isAdmin ? "Prisotnost" : "Vnos prisotnosti"}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/billing">
                  <DollarSign className="h-4 w-4" />
                  <span>Mesečni obračun</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/activities">
                  <Activity className="h-4 w-4" />
                  <span>Moje aktivnosti</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
              asChild
              isActive={pathname === "/billing"}
              className="cursor-pointer">
              
                <Link href="/billing">
                  <Calculator className="h-4 w-4" />
                  <span>Obračun</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
              asChild
              isActive={pathname === "/reports"}
              className="cursor-pointer">
              
                <Link href="/reports">
                  <FileText className="h-4 w-4" />
                  <span>Poročila</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
              asChild
              isActive={pathname === "/audit"}
              className="cursor-pointer">
              
                <Link href="/audit">
                  <Shield className="h-4 w-4" />
                  <span>Revizijska sled</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {isAdmin ?
          <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/teams">
                      <Users className="h-4 w-4" />
                      <span>Selekcije</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/players">
                      <UserCog className="h-4 w-4" />
                      <span>Igralci</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/coaches">
                      <ClipboardList className="h-4 w-4" />
                      <span>Trenerji</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/venues">
                      <Building className="h-4 w-4" />
                      <span>Dvorane</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/schedules">
                      <Clock className="h-4 w-4" />
                      <span>Urniki</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/smtp-settings">
                      <Mail className="h-4 w-4" />
                      <span>SMTP Nastavitve</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </> :

          <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/activities">
                      <Activity className="h-4 w-4" />
                      <span>Moje aktivnosti</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/my-players">
                      <UserCog className="h-4 w-4" />
                      <span>Igralci</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/my-teams">
                      <Users className="h-4 w-4" />
                      <span>Selekcije</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/my-venues">
                      <Building className="h-4 w-4" />
                      <span>Dvorane</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/my-schedules">
                      <Clock className="h-4 w-4" />
                      <span>Urniki</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
          }
          </SidebarMenu>
        </nav>
      </ScrollArea>

      <Separator />

      <div className="p-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {user?.email?.
            split("@")[0].
            substring(0, 2).
            toUpperCase() || "??"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Administrator" : "Trener"}
            </p>
          </div>
        </div>
      </div>
    </>;


  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 border-r bg-background">
          <div className="flex h-16 items-center border-b px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-lg font-bold">OK</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-tight">OK Lubnik</span>
                <span className="text-xs text-muted-foreground leading-tight">Športni klub</span>
              </div>
            </Link>
          </div>

          <ScrollArea className="flex-1 px-3 py-4">
            <Sidebar>
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {isParent ?
                      // Parent Menu
                      <>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/my-children">
                                <UserCircle className="h-4 w-4" />
                                <span>Moji Otroci</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/messaging">
                                <MessageSquare className="h-4 w-4" />
                                <span>Sporočila</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </> :
                      userRole === "admin" ?
                      // Admin Menu (unchanged)
                      <>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/dashboard">
                                <LayoutDashboard className="h-4 w-4" />
                                <span>Pregled</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarGroupLabel className="mt-4">Upravljanje</SidebarGroupLabel>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/players">
                                <UserCog className="h-4 w-4" />
                                <span>Igralci</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/coaches">
                                <Users className="h-4 w-4" />
                                <span>Trenerji</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/teams">
                                <Shield className="h-4 w-4" />
                                <span>Selekcije</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/activities">
                                <Activity className="h-4 w-4" />
                                <span>Aktivnosti</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/venues">
                                <Building className="h-4 w-4" />
                                <span>Dvorane</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/schedules">
                                <Clock className="h-4 w-4" />
                                <span>Urniki</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/seasons">
                                <Calendar className="h-4 w-4" />
                                <span>Sezone</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/attendance">
                                <ClipboardCheck className="h-4 w-4" />
                                <span>Prisotnost</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/billing">
                                <DollarSign className="h-4 w-4" />
                                <span>Obračun</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/reports">
                                <FileText className="h-4 w-4" />
                                <span>Poročila</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/messaging">
                                <MessageSquare className="h-4 w-4" />
                                <span>Sporočila</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          
                          <SidebarGroupLabel className="mt-4">Nastavitve</SidebarGroupLabel>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/smtp-settings">
                                <Mail className="h-4 w-4" />
                                <span>SMTP nastavitve</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                              <Link href="/settings">
                                <Settings className="h-4 w-4" />
                                <span>Nastavitve</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </> :

                      <>
                          <Link
                          href="/dashboard"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/dashboard" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <LayoutDashboard className="h-4 w-4" />
                            Pregled
                          </Link>
                          <Link
                          href="/attendance"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/attendance" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <ClipboardCheck className="h-4 w-4" />
                            Prisotnost
                          </Link>
                          <Link
                          href="/billing"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/billing" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <DollarSign className="h-4 w-4" />
                            Mesečni obračun
                          </Link>
                          <Link
                          href="/activities"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/activities" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Activity className="h-4 w-4" />
                            Moje aktivnosti
                          </Link>
                          <Link
                          href="/my-players"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/my-players" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <UserCog className="h-4 w-4" />
                            Igralci
                          </Link>
                          <Link
                          href="/my-teams"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/my-teams" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Users className="h-4 w-4" />
                            Selekcije
                          </Link>
                          <Link
                          href="/my-venues"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/my-venues" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Building className="h-4 w-4" />
                            Dvorane
                          </Link>
                          <Link
                          href="/my-schedules"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/my-schedules" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Clock className="h-4 w-4" />
                            Urniki
                          </Link>
                          <Link
                          href="/messaging"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/messaging" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <MessageSquare className="h-4 w-4" />
                            Moja Sporočila
                          </Link>
                        </>
                      }
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>
          </ScrollArea>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="flex h-16 items-center border-b px-6">
                  <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground" style={{ backgroundColor: "transparent", backgroundImage: "url(\"/LOGO-2015-C_B.gif\")", backgroundSize: "cover" }}>
                      <span className="text-lg font-bold" style={{ backgroundImage: "url(\"/LOGO-2015-C_B.gif\")", backgroundColor: "transparent", backgroundSize: "contain", color: "#00000000", lineHeight: "", backgroundRepeat: "no-repeat", fontWeight: "100" }}>.</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold leading-tight">OK Lubnik</span>
                      <span className="text-xs text-muted-foreground leading-tight">Odbojarski klub</span>
                    </div>
                  </Link>
                </div>
                <ScrollArea className="flex-1 px-3 py-4">
                  <nav className="space-y-1">
                    <>
                      {isParent ?
                      // Parent Mobile Menu
                      <>
                          <Link
                          href="/my-children"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/my-children" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <UserCircle className="h-4 w-4" />
                            Moji Otroci
                          </Link>
                          <Link
                          href="/messaging"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/messaging" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <MessageSquare className="h-4 w-4" />
                            Sporočila
                          </Link>
                        </> :
                      userRole === "admin" ?
                      // Admin Mobile Menu (unchanged)
                      <>
                          <Link
                          href="/dashboard"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/dashboard" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <LayoutDashboard className="h-4 w-4" />
                            Pregled
                          </Link>
                          
                          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                            Upravljanje
                          </div>
                          <Link
                          href="/players"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/players" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <UserCog className="h-4 w-4" />
                            Igralci
                          </Link>
                          <Link
                          href="/coaches"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/coaches" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Users className="h-4 w-4" />
                            Trenerji
                          </Link>
                          <Link
                          href="/teams"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/teams" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Shield className="h-4 w-4" />
                            Selekcije
                          </Link>
                          <Link
                          href="/activities"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/activities" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Activity className="h-4 w-4" />
                            Aktivnosti
                          </Link>
                          <Link
                          href="/venues"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/venues" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Building className="h-4 w-4" />
                            Dvorane
                          </Link>
                          <Link
                          href="/schedules"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/schedules" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Clock className="h-4 w-4" />
                            Urniki
                          </Link>
                          <Link
                          href="/seasons"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/seasons" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Calendar className="h-4 w-4" />
                            Sezone
                          </Link>
                          <Link
                          href="/attendance"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/attendance" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <ClipboardCheck className="h-4 w-4" />
                            Prisotnost
                          </Link>
                          <Link
                          href="/billing"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/billing" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <DollarSign className="h-4 w-4" />
                            Obračun
                          </Link>
                          <Link
                          href="/reports"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/reports" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <FileText className="h-4 w-4" />
                            Poročila
                          </Link>
                          <Link
                          href="/messaging"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/messaging" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <MessageSquare className="h-4 w-4" />
                            Sporočila
                          </Link>
                          
                          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground mt-4">
                            Nastavitve
                          </div>
                          <Link
                          href="/smtp-settings"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/smtp-settings" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Mail className="h-4 w-4" />
                            SMTP nastavitve
                          </Link>
                          <Link
                          href="/settings"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/settings" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Settings className="h-4 w-4" />
                            Nastavitve
                          </Link>
                        </> :

                      <>
                          <Link
                          href="/dashboard"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/dashboard" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <LayoutDashboard className="h-4 w-4" />
                            Pregled
                          </Link>
                          <Link
                          href="/attendance"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/attendance" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <ClipboardCheck className="h-4 w-4" />
                            Prisotnost
                          </Link>
                          <Link
                          href="/billing"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/billing" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <DollarSign className="h-4 w-4" />
                            Mesečni obračun
                          </Link>
                          <Link
                          href="/activities"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/activities" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Activity className="h-4 w-4" />
                            Moje aktivnosti
                          </Link>
                          <Link
                          href="/my-players"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/my-players" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <UserCog className="h-4 w-4" />
                            Igralci
                          </Link>
                          <Link
                          href="/my-teams"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/my-teams" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Users className="h-4 w-4" />
                            Selekcije
                          </Link>
                          <Link
                          href="/my-venues"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/my-venues" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Building className="h-4 w-4" />
                            Dvorane
                          </Link>
                          <Link
                          href="/my-schedules"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/my-schedules" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <Clock className="h-4 w-4" />
                            Urniki
                          </Link>
                          <Link
                          href="/messaging"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            router.pathname === "/messaging" ?
                            "bg-primary text-primary-foreground" :
                            "hover:bg-muted"
                          )}>
                          
                            <MessageSquare className="h-4 w-4" />
                            Moja Sporočila
                          </Link>
                        </>
                      }
                    </>
                  </nav>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <div className="flex-1" />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar>
                    <AvatarFallback>
                      {user?.user_metadata?.full_name?.
                      split(" ").
                      map((n: string) => n[0]).
                      join("").
                      toUpperCase() || <UserCircle className="h-5 w-5" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {isParent ?
                      parentEmail :
                      user?.user_metadata?.full_name || user?.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {isParent ? "Starš" : isAdmin ? "Administrator" : "Trener"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!isParent &&
                <>
                    <DropdownMenuItem onClick={() => router.push("/settings")}>
                      <Settings className="mr-2 h-4 w-4" />
                      Nastavitve
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                }
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Odjava
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>);

}