import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getActiveVenues, formatVenueName } from "@/services/venuesService";
import { MapPin } from "lucide-react";

export default function MyVenuesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [venues, setVenues] = useState<any[]>([]);

  useEffect(() => {
    loadVenues();
  }, []);

  async function loadVenues() {
    try {
      setLoading(true);
      const data = await getActiveVenues();
      setVenues(data);
    } catch (error: any) {
      console.error("Napaka pri nalaganju dvoran:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti dvoran",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute allowedRoles={["coach"]}>
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dvorane</h2>
            <p className="text-muted-foreground">
              Pregled vseh aktivnih dvoran
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Seznam dvoran ({venues.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Nalagam...</div>
              ) : venues.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Ni dvoran</p>
                  <p className="text-sm mt-2">
                    Kontaktirajte administratorja za dodajanje dvoran
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naziv</TableHead>
                        <TableHead>Naslov</TableHead>
                        <TableHead>Kraj</TableHead>
                        <TableHead>Oznaka prostora</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {venues.map((venue) => (
                        <TableRow key={venue.id}>
                          <TableCell className="font-medium">{venue.name}</TableCell>
                          <TableCell>{venue.address || "N/A"}</TableCell>
                          <TableCell>{venue.city || "N/A"}</TableCell>
                          <TableCell>{venue.room_designation || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant={venue.is_active ? "default" : "secondary"}>
                              {venue.is_active ? "Aktivna" : "Neaktivna"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}