import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, 
  Users, 
  MapPin, 
  Calendar,
  Clock,
  TrendingUp,
  Award,
  DollarSign,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  activePlayers: number;
  activeTeams: number;
  activeVenues: number;
  totalActivities: number;
  totalHours: number;
  totalKm: number;
  totalAmount: number;
  trainingType1: number;
  trainingType2: number;
  matchesType3: number;
}

export default function DashboardPage() {
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    activePlayers: 0,
    activeTeams: 0,
    activeVenues: 0,
    totalActivities: 0,
    totalHours: 0,
    totalKm: 0,
    totalAmount: 0,
    trainingType1: 0,
    trainingType2: 0,
    matchesType3: 0,
  });

  useEffect(() => {
    const checkRole = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      setIsAdmin(!!data);
    };
    checkRole();
  }, [user]);

  useEffect(() => {
    if (user) {
      loadDashboardStats();
    }
  }, [user, isAdmin]);

  async function loadDashboardStats() {
    try {
      setLoading(true);

      if (isAdmin) {
        // Admin stats
        const [playersRes, teamsRes, venuesRes, activitiesRes] = await Promise.all([
          supabase.from("players").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("teams").select("id", { count: "exact", head: true }).eq("is_archived", false),
          supabase.from("venues").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("activities").select("id", { count: "exact", head: true }),
        ]);

        setStats({
          activePlayers: playersRes.count || 0,
          activeTeams: teamsRes.count || 0,
          activeVenues: venuesRes.count || 0,
          totalActivities: activitiesRes.count || 0,
          totalHours: 0,
          totalKm: 0,
          totalAmount: 0,
          trainingType1: 0,
          trainingType2: 0,
          matchesType3: 0,
        });
      } else {
        // Coach stats - mesečni pregled
        const currentMonth = new Date().toISOString().slice(0, 7);
        const startDate = `${currentMonth}-01`;
        const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0)
          .toISOString()
          .split("T")[0];

        // Get activities where coach participated
        const { data: activityCoaches } = await supabase
          .from("activity_coaches")
          .select(`
            id,
            hours_worked,
            mileage_km,
            total_amount,
            activities!inner(id, activity_date, activity_type_id)
          `)
          .eq("coach_id", user!.id)
          .gte("activities.activity_date", startDate)
          .lte("activities.activity_date", endDate);

        const totalHours = activityCoaches?.reduce((sum, a) => sum + (a.hours_worked || 0), 0) || 0;
        const totalKm = activityCoaches?.reduce((sum, a) => sum + (a.mileage_km || 0), 0) || 0;
        const totalAmount = activityCoaches?.reduce((sum, a) => sum + (a.total_amount || 0), 0) || 0;

        const type1Count = activityCoaches?.filter((a: any) => a.activities?.activity_type_id === 1).length || 0;
        const type2Count = activityCoaches?.filter((a: any) => a.activities?.activity_type_id === 2).length || 0;
        const type3Count = activityCoaches?.filter((a: any) => a.activities?.activity_type_id === 3).length || 0;

        // Get assigned teams count
        const { count: teamsCount } = await supabase
          .from("team_coaches")
          .select("id", { count: "exact", head: true })
          .eq("coach_id", user!.id)
          .eq("is_active", true);

        setStats({
          activePlayers: 0,
          activeTeams: teamsCount || 0,
          activeVenues: 0,
          totalActivities: activityCoaches?.length || 0,
          totalHours,
          totalKm,
          totalAmount,
          trainingType1: type1Count,
          trainingType2: type2Count,
          matchesType3: type3Count,
        });
      }
    } catch (error: any) {
      console.error("Napaka pri nalaganju statistike:", error);
    } finally {
      setLoading(false);
    }
  }

  const currentMonthName = new Date().toLocaleDateString("sl-SI", { month: "long", year: "numeric" });

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {isAdmin 
                ? "Nadzorna plošča" 
                : `Tvoj mesečni pregled za ${currentMonthName}`
              }
            </h2>
            <p className="text-muted-foreground">
              {isAdmin 
                ? "Pregled statistike športnega kluba" 
                : `Pregled tvojih aktivnosti in obračuna`
              }
            </p>
          </div>

          {!isAdmin && (
            <Button size="lg" onClick={() => window.location.href = '/attendance'}>
              <ClipboardCheck className="h-5 w-5 mr-2" />
              Vnos prisotnosti
            </Button>
          )}
        </div>

          {isAdmin ? (
            // Admin Dashboard
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aktivni igralci</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activePlayers}</div>
                  <p className="text-xs text-muted-foreground">Trenutno aktivnih</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aktivne selekcije</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeTeams}</div>
                  <p className="text-xs text-muted-foreground">V tej sezoni</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Dvorane</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeVenues}</div>
                  <p className="text-xs text-muted-foreground">Aktivnih lokacij</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Skupaj aktivnosti</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalActivities}</div>
                  <p className="text-xs text-muted-foreground">Vse sezone</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            // Coach Dashboard
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Moje selekcije</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.activeTeams}</div>
                    <p className="text-xs text-muted-foreground">Dodeljeno</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Aktivnosti ({currentMonthName})</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalActivities}</div>
                    <p className="text-xs text-muted-foreground">Tega meseca</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Skupaj ur</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalHours.toFixed(1)}</div>
                    <p className="text-xs text-muted-foreground">Tega meseca</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Kilometri</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalKm.toFixed(0)}</div>
                    <p className="text-xs text-muted-foreground">km tega meseca</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Razdelitev aktivnosti</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span className="text-sm">Tip 1 - Trening v dvorani</span>
                        </div>
                        <span className="font-semibold">{stats.trainingType1}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span className="text-sm">Tip 2 - Trening izven dvorane</span>
                        </div>
                        <span className="font-semibold">{stats.trainingType2}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                          <span className="text-sm">Tip 3 - Uradna tekma</span>
                        </div>
                        <span className="font-semibold">{stats.matchesType3}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Mesečni obračun
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Skupaj za {currentMonthName}</p>
                        <p className="text-3xl font-bold">{stats.totalAmount.toFixed(2)} €</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                          <p className="text-sm text-muted-foreground">Aktivnosti</p>
                          <p className="text-lg font-semibold">{(stats.totalAmount - (stats.totalKm * 0.35)).toFixed(2)} €</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Kilometrina</p>
                          <p className="text-lg font-semibold">{(stats.totalKm * 0.35).toFixed(2)} €</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Dobrodošli!</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {isAdmin
                    ? "Uporabite navigacijo za upravljanje sezon, selekcij, igralcev in aktivnosti."
                    : "Uporabite navigacijo za vnos prisotnosti in pregled vaših aktivnosti."}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}