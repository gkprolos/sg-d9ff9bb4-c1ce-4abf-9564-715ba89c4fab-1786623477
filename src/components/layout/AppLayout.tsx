import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, userRole, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const isAdmin = userRole === "admin";
  const isCoach = userRole === "coach";

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
    { name: "Nastavitve", href: "/settings", icon: Settings },
  ];

  // Coach Navigation
  const coachNavigation = [
    { name: "Moj pregled", href: "/dashboard", icon: LayoutDashboard },
    { name: "Dodaj prisotnost", href: "/attendance", icon: ClipboardCheck },
    { name: "Aktivnosti", href: "/activities", icon: Activity },
    { name: "Moje selekcije", href: "/my-teams", icon: Users },
    { name: "Moji igralci", href: "/my-players", icon: UserCircle },
    { name: "Dvorane", href: "/my-venues", icon: MapPin },
    { name: "Urniki", href: "/my-schedules", icon: Clock },
    { name: "Nastavitve", href: "/settings", icon: Settings },
  ];

  const navigation = isAdmin ? adminNavigation : coachNavigation;

  const NavContent = () => (
    <>
      <div className="px-6 py-4">
        <div className="flex items-center gap-3">
          <img 
            src="/LOGO-2015-C_B.gif" 
            alt="OK Lubnik" 
            className="h-12 w-auto"
          />
          <div>
            <h2 className="font-semibold text-base leading-tight">OK Lubnik</h2>
            <p className="text-xs text-muted-foreground">Sezona 2026/2027</p>
          </div>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = router.pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.name}
                {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator />

      <div className="p-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {user?.email
                ?.split("@")[0]
                .substring(0, 2)
                .toUpperCase() || "??"}
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
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col border-r bg-card">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <NavContent />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <img 
                src="/LOGO-2015-C_B.gif" 
                alt="OK Lubnik" 
                className="h-8 w-auto"
              />
              <span className="font-semibold">OK Lubnik</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {user?.email
                      ?.split("@")[0]
                      .substring(0, 2)
                      .toUpperCase() || "??"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user?.email}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {isAdmin ? "Administrator" : "Trener"}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Odjava
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block lg:pl-72">
        <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-card px-6">
          <div>
            <h1 className="text-xl font-semibold">
              {navigation.find((item) => item.href === router.pathname)?.name || "Nadzorna plošča"}
            </h1>
            <p className="text-sm text-muted-foreground">Sezona 2026/2027</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user?.email
                      ?.split("@")[0]
                      .substring(0, 2)
                      .toUpperCase() || "??"}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-medium">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {isAdmin ? "Administrator" : "Trener"}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Moj račun</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Nastavitve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Odjava
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:pl-72 pt-16 lg:pt-0">
        <div className="px-4 sm:px-6 lg:px-8 py-8">{children}</div>
      </main>
    </div>
  );
}