import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
      const { data, error } = await supabase.
      from("venues").
      select("*").
      eq("is_active", true).
      order("name", { ascending: true });

      if (error) {
        console.error("Napaka pri nalaganju dvoran:", error);
        toast({
          variant: "destructive",
          title: "Napaka",
          description: error.message || "Ni mogoče naložiti dvoran"
        });
        throw error;
      }

      setVenues(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju dvoran:", error);
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
            <p className="text-muted-foreground">Pregled vseh aktivnih dvoran</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Seznam dvoran ({venues.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ?
              <p>Nalaganje...</p> :
              venues.length === 0 ?
              <p className="text-muted-foreground">Ni aktivnih dvoran.</p> :

              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naziv</TableHead>
                      <TableHead>Naslov</TableHead>
                      <TableHead>Kraj</TableHead>
                      <TableHead>Prostor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {venues.map((venue) =>
                  <TableRow key={venue.id}>
                        <TableCell className="font-medium">{venue.name}</TableCell>
                        <TableCell>{venue.address || "-"}</TableCell>
                        <TableCell>{venue.city || "-"}</TableCell>
                        <TableCell>{venue.room_designation || "-"}</TableCell>
                        <TableCell>
                          {venue.is_active ?
                      <Badge className="" style={{ backgroundColor: "#bababa", backgroundImage: "none" }}>Aktivna</Badge> :

                      <Badge variant="outline">Neaktivna</Badge>
                      }
                        </TableCell>
                      </TableRow>
                  )}
                  </TableBody>
                </Table>
              }
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>);

}