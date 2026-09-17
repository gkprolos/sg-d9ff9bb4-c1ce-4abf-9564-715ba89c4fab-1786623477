import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit2, Trash2, ExternalLink, Image as ImageIcon, ZoomIn } from "lucide-react";
import type { Database } from "@/integrations/supabase/database.types";

type StoreItem = Database["public"]["Tables"]["store_items"]["Row"];
type StoreItemInsert = Database["public"]["Tables"]["store_items"]["Insert"];
type StoreItemUpdate = Database["public"]["Tables"]["store_items"]["Update"];

const AVAILABLE_SIZES = ["11/12", "13/14", "XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"];
const CATEGORIES = ["Dresi", "Kopački", "Oprema", "Drugo"];

export default function StorePage() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    item_number: string;
    name: string;
    description: string;
    category: string;
    available_sizes: string[];
    price: string;
    quantity_in_stock: string;
    low_stock_threshold: string;
    external_link: string;
  }>({
    item_number: "",
    name: "",
    description: "",
    category: "",
    available_sizes: [],
    price: "",
    quantity_in_stock: "0",
    low_stock_threshold: "5",
    external_link: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  useEffect(() => {
    if (user && (userRole === "admin" || userRole === "coach")) {
      loadItems();
    }
  }, [user, userRole]);

  useEffect(() => {
    filterItems();
  }, [items, searchQuery, categoryFilter]);

  async function loadItems() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("store_items")
        .select("*")
        .order("item_number", { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju artiklov:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče naložiti artiklov",
      });
    } finally {
      setLoading(false);
    }
  }

  function filterItems() {
    let filtered = items;

    // Search by name or item_number
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.item_number.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (categoryFilter !== "all") {
      filtered = filtered.filter((item) => item.category === categoryFilter);
    }

    setFilteredItems(filtered);
  }

  function resetForm() {
    setFormData({
      item_number: "",
      name: "",
      description: "",
      category: "",
      available_sizes: [],
      price: "",
      quantity_in_stock: "0",
      low_stock_threshold: "5",
      external_link: "",
    });
    setImageFile(null);
    setImagePreview("");
    setEditingItem(null);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Naložite lahko samo slike (JPG, PNG, WebP)",
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Slika je prevelika (max 5 MB)",
      });
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadImage(file: File): Promise<string | null> {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("store-items")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("store-items")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Napaka pri nalaganju slike:", error);
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!formData.item_number.trim()) {
      toast({ variant: "destructive", title: "Napaka", description: "Številka artikla je obvezna" });
      return;
    }
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Napaka", description: "Naziv artikla je obvezen" });
      return;
    }
    if (!formData.category) {
      toast({ variant: "destructive", title: "Napaka", description: "Kategorija je obvezna" });
      return;
    }
    if (formData.available_sizes.length === 0) {
      toast({ variant: "destructive", title: "Napaka", description: "Izberite vsaj eno velikost" });
      return;
    }
    if (!formData.price || parseFloat(formData.price) < 0) {
      toast({ variant: "destructive", title: "Napaka", description: "Cena mora biti pozitivna" });
      return;
    }

    try {
      setLoading(true);

      let imageUrl = editingItem?.image_url || null;

      // Upload image if new file selected
      if (imageFile) {
        const uploadedUrl = await uploadImage(imageFile);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          toast({
            variant: "destructive",
            title: "Napaka",
            description: "Ni mogoče naložiti slike",
          });
          return;
        }
      }

      const itemData = {
        item_number: formData.item_number.trim(),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: formData.category,
        available_sizes: formData.available_sizes,
        price: parseFloat(formData.price),
        quantity_in_stock: parseInt(formData.quantity_in_stock) || 0,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 5,
        image_url: imageUrl,
        external_link: formData.external_link.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      };

      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from("store_items")
          .update(itemData)
          .eq("id", editingItem.id);

        if (error) throw error;

        toast({
          title: "Uspešno",
          description: "Artikel je bil posodobljen",
        });
        setIsEditDialogOpen(false);
      } else {
        // Create new item
        const { error } = await supabase
          .from("store_items")
          .insert({
            ...itemData,
            created_by: user?.id,
          });

        if (error) throw error;

        toast({
          title: "Uspešno",
          description: "Artikel je bil dodan",
        });
        setIsAddDialogOpen(false);
      }

      resetForm();
      loadItems();
    } catch (error: any) {
      console.error("Napaka pri shranjevanju:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče shraniti artikla",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(item: StoreItem) {
    setEditingItem(item);
    
    // Type assertion: Json[] to string[]
    const sizes = Array.isArray(item.available_sizes) 
      ? (item.available_sizes as string[])
      : [];
    
    setFormData({
      item_number: item.item_number,
      name: item.name,
      description: item.description || "",
      category: item.category || "",
      available_sizes: sizes,
      price: item.price.toString(),
      quantity_in_stock: item.quantity_in_stock?.toString() || "0",
      low_stock_threshold: item.low_stock_threshold?.toString() || "5",
      external_link: item.external_link || "",
    });
    setImagePreview(item.image_url || "");
    setImageFile(null);
    setIsEditDialogOpen(true);
  }

  async function handleToggleActive(item: StoreItem) {
    try {
      const { error } = await supabase
        .from("store_items")
        .update({ is_active: !item.is_active, updated_by: user?.id })
        .eq("id", item.id);

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: item.is_active ? "Artikel je bil deaktiviran" : "Artikel je bil aktiviran",
      });

      loadItems();
    } catch (error: any) {
      console.error("Napaka:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče spremeniti statusa",
      });
    }
  }

  function openImagePreview(imageUrl: string) {
    setPreviewImageUrl(imageUrl);
    setIsImagePreviewOpen(true);
  }

  function handleSizeToggle(size: string) {
    const newSizes = formData.available_sizes.includes(size)
      ? formData.available_sizes.filter((s) => s !== size)
      : [...formData.available_sizes, size];
    setFormData({ ...formData, available_sizes: newSizes });
  }

  if (!user || (userRole !== "admin" && userRole !== "coach")) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Nimate dostopa do te strani</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Oprema</h1>
        <p className="text-muted-foreground">Upravljanje artiklov, naročil in zbirnikov</p>
      </div>

      <Tabs defaultValue="items" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="items">Artikli</TabsTrigger>
          <TabsTrigger value="orders">Naročila</TabsTrigger>
          <TabsTrigger value="collections">Zbirniki</TabsTrigger>
        </TabsList>

        {/* TAB: ARTIKLI */}
        <TabsContent value="items" className="space-y-4">
          {/* Filters and Actions */}
          <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Išči po nazivu ali številki..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Kategorija" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vse kategorije</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj Artikel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Dodaj Nov Artikel</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="item_number">Številka Artikla *</Label>
                      <Input
                        id="item_number"
                        value={formData.item_number}
                        onChange={(e) => setFormData({ ...formData, item_number: e.target.value })}
                        placeholder="npr. A001"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Kategorija *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Izberi kategorijo" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="name">Naziv *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="npr. Dres domači"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Opis</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Opis artikla..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Možne Velikosti *</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {AVAILABLE_SIZES.map((size) => (
                        <div key={size} className="flex items-center space-x-2">
                          <Checkbox
                            id={`size-${size}`}
                            checked={formData.available_sizes.includes(size)}
                            onCheckedChange={() => handleSizeToggle(size)}
                          />
                          <Label htmlFor={`size-${size}`} className="text-sm cursor-pointer">
                            {size}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="price">Cena (EUR) *</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="45.00"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="quantity_in_stock">Zaloga</Label>
                      <Input
                        id="quantity_in_stock"
                        type="number"
                        min="0"
                        value={formData.quantity_in_stock}
                        onChange={(e) => setFormData({ ...formData, quantity_in_stock: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="low_stock_threshold">Opozorilo Zaloga</Label>
                      <Input
                        id="low_stock_threshold"
                        type="number"
                        min="0"
                        value={formData.low_stock_threshold}
                        onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="external_link">Povezava</Label>
                    <Input
                      id="external_link"
                      type="url"
                      value={formData.external_link}
                      onChange={(e) => setFormData({ ...formData, external_link: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="image">Slika (max 5 MB)</Label>
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="mt-1"
                    />
                    {imagePreview && (
                      <div className="mt-2">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-32 h-48 object-cover rounded border"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Prekliči
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Shranjujem..." : "Shrani"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Items Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Št.</TableHead>
                  <TableHead className="w-[100px]">Slika</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead>Kategorija</TableHead>
                  <TableHead>Velikosti</TableHead>
                  <TableHead>Zaloga</TableHead>
                  <TableHead className="text-right">Cena</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Nalaganje...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {searchQuery || categoryFilter !== "all"
                        ? "Ni rezultatov"
                        : "Ni še artiklov. Dodajte prvega!"}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.item_number}</TableCell>
                      <TableCell>
                        {item.image_url ? (
                          <button
                            onClick={() => openImagePreview(item.image_url!)}
                            className="relative group"
                          >
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-16 h-24 object-cover rounded border hover:opacity-80 transition"
                            />
                            <ZoomIn className="absolute inset-0 m-auto h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition" />
                          </button>
                        ) : (
                          <div className="w-16 h-24 bg-muted rounded border flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category || "-"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {Array.isArray(item.available_sizes) && item.available_sizes.length > 0
                          ? (item.available_sizes as string[]).join(", ")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            item.quantity_in_stock &&
                            item.low_stock_threshold &&
                            item.quantity_in_stock <= item.low_stock_threshold
                              ? "text-orange-600 font-semibold"
                              : ""
                          }
                        >
                          {item.quantity_in_stock || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {item.price.toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.is_active ? "default" : "secondary"}>
                          {item.is_active ? "Aktiven" : "Neaktiven"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {item.external_link && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(item.external_link!, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(item)}
                          >
                            <Trash2
                              className={`h-4 w-4 ${item.is_active ? "text-destructive" : "text-green-600"}`}
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB: NAROČILA - Placeholder */}
        <TabsContent value="orders">
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Pregled naročil bo dodan v Fazi 4</p>
          </Card>
        </TabsContent>

        {/* TAB: ZBIRNIKI - Placeholder */}
        <TabsContent value="collections">
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Pregled zbirnikov bo dodan v Fazi 5</p>
          </Card>
        </TabsContent>
      </Tabs>

      {/* EDIT DIALOG */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Uredi Artikel</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_item_number">Številka Artikla *</Label>
                <Input
                  id="edit_item_number"
                  value={formData.item_number}
                  onChange={(e) => setFormData({ ...formData, item_number: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_category">Kategorija *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_name">Naziv *</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit_description">Opis</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label>Možne Velikosti *</Label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {AVAILABLE_SIZES.map((size) => (
                  <div key={size} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-size-${size}`}
                      checked={formData.available_sizes.includes(size)}
                      onCheckedChange={() => handleSizeToggle(size)}
                    />
                    <Label htmlFor={`edit-size-${size}`} className="text-sm cursor-pointer">
                      {size}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit_price">Cena (EUR) *</Label>
                <Input
                  id="edit_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_quantity_in_stock">Zaloga</Label>
                <Input
                  id="edit_quantity_in_stock"
                  type="number"
                  min="0"
                  value={formData.quantity_in_stock}
                  onChange={(e) => setFormData({ ...formData, quantity_in_stock: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_low_stock_threshold">Opozorilo Zaloga</Label>
                <Input
                  id="edit_low_stock_threshold"
                  type="number"
                  min="0"
                  value={formData.low_stock_threshold}
                  onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit_external_link">Povezava</Label>
              <Input
                id="edit_external_link"
                type="url"
                value={formData.external_link}
                onChange={(e) => setFormData({ ...formData, external_link: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit_image">Slika (max 5 MB)</Label>
              <Input
                id="edit_image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="mt-1"
              />
              {imagePreview && (
                <div className="mt-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-32 h-48 object-cover rounded border"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Prekliči
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Shranjujem..." : "Shrani"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* IMAGE PREVIEW DIALOG */}
      <Dialog open={isImagePreviewOpen} onOpenChange={setIsImagePreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Povečana Slika</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <img src={previewImageUrl} alt="Povečana slika" className="max-w-full max-h-[70vh] object-contain rounded" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}