import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Image as ImageIcon,
  Search,
  Filter,
  ShoppingCart,
  Trash2,
  ExternalLink,
  Package,
  Minus,
  X,
  CheckCircle,
  Clock,
  XCircle,
  ZoomIn,
} from "lucide-react";

// Types
type StoreItem = {
  id: string;
  item_number: string;
  name: string;
  description: string | null;
  category: string | null;
  available_sizes: any;
  price: number;
  quantity_in_stock: number | null;
  low_stock_threshold: number | null;
  image_url: string | null;
  external_link: string | null;
  is_active: boolean;
  created_at: string;
};

type CartItem = {
  item_id: string;
  item_number: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
  image_url: string | null;
};

type StoreOrder = {
  id: string;
  order_number: string;
  parent_id: string;
  status: string;
  total_amount: number;
  ordered_at: string | null;
  delivered_at: string | null;
  invoice_created: boolean;
  created_at: string;
};

const AVAILABLE_SIZES = [
  "11/12",
  "13/14",
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
];

const CATEGORIES = ["Dresi", "Kopački", "Oprema", "Drugo"];

export default function Store() {
  const { user, userRole } = useAuth();
  const isParent = userRole !== "admin" && userRole !== "coach";
  const isAdminOrCoach = userRole === "admin" || userRole === "coach";

  // Admin/Coach State
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Parent State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [myOrders, setMyOrders] = useState<StoreOrder[]>([]);
  const [selectedSize, setSelectedSize] = useState<{ [key: string]: string }>({});
  const [parentSearchQuery, setParentSearchQuery] = useState("");
  const [parentCategoryFilter, setParentCategoryFilter] = useState<string>("all");

  // Form State
  const [formData, setFormData] = useState({
    item_number: "",
    name: "",
    description: "",
    category: "",
    available_sizes: [] as string[],
    price: "",
    quantity_in_stock: "0",
    low_stock_threshold: "5",
    external_link: "",
  });

  // Load data based on role
  useEffect(() => {
    if (user) {
      if (isAdminOrCoach) {
        loadItems();
      } else if (isParent) {
        loadActiveItems();
        loadMyOrders();
      }
    }
  }, [user, isAdminOrCoach, isParent]);

  // Admin/Coach: Load all items
  async function loadItems() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("store_items")
        .select("*")
        .order("created_at", { ascending: false });

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

  // Parent: Load only active items
  async function loadActiveItems() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("store_items")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

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

  // Parent: Load my orders
  async function loadMyOrders() {
    try {
      const { data, error } = await supabase
        .from("store_orders")
        .select("*")
        .eq("parent_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Ensure invoice_created field exists (default to false if null)
      const ordersWithDefaults = (data || []).map(order => ({
        ...order,
        invoice_created: order.invoice_created ?? false,
      }));
      
      setMyOrders(ordersWithDefaults);
    } catch (error: any) {
      console.error("Napaka pri nalaganju naročil:", error);
    }
  }

  // Parent: Add to cart
  function addToCart(item: StoreItem) {
    const size = selectedSize[item.id];
    if (!size) {
      toast({
        variant: "destructive",
        title: "Izberi velikost",
        description: "Prosim izberi velikost artikla",
      });
      return;
    }

    const existingIndex = cart.findIndex(
      (c) => c.item_id === item.id && c.size === size
    );

    if (existingIndex >= 0) {
      // Update quantity
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      // Add new item
      setCart([
        ...cart,
        {
          item_id: item.id,
          item_number: item.item_number,
          name: item.name,
          size,
          quantity: 1,
          price: item.price,
          image_url: item.image_url,
        },
      ]);
    }

    toast({
      title: "Dodano v košarico",
      description: `${item.name} (${size})`,
    });
  }

  // Parent: Update cart quantity
  function updateCartQuantity(index: number, delta: number) {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
  }

  // Parent: Remove from cart
  function removeFromCart(index: number) {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  }

  // Parent: Place order
  async function placeOrder() {
    if (cart.length === 0) {
      toast({
        variant: "destructive",
        title: "Prazna košarica",
        description: "Dodaj artikle v košarico",
      });
      return;
    }

    try {
      const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from("store_orders")
        .insert({
          parent_id: user?.id,
          total_amount: totalAmount,
          status: "open",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert order items
      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        item_id: item.item_id,
        item_number: item.item_number,
        item_name: item.name,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("store_order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Naročilo oddano",
        description: `Številka naročila: ${orderData.order_number}`,
      });

      // Clear cart and reload orders
      setCart([]);
      setIsCartOpen(false);
      loadMyOrders();
    } catch (error: any) {
      console.error("Napaka pri oddaji naročila:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče oddati naročila",
      });
    }
  }

  // Parent: Cancel order
  async function cancelOrder(orderId: string) {
    try {
      const { error } = await supabase
        .from("store_orders")
        .update({ status: "cancelled" })
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Naročilo preklicano",
      });

      loadMyOrders();
    } catch (error: any) {
      console.error("Napaka pri preklicu naročila:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče preklicati naročila",
      });
    }
  }

  // Admin/Coach: Handle form submission
  async function handleSubmit() {
    if (!formData.item_number || !formData.name || !formData.price) {
      toast({
        variant: "destructive",
        title: "Manjkajoči podatki",
        description: "Prosim izpolni vse obvezne podatke",
      });
      return;
    }

    try {
      let imageUrl = editingItem?.image_url || "";

      // Upload new image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError } = await supabase.storage
          .from("store-items")
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("store-items")
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
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

      // Reset form and reload
      resetForm();
      loadItems();
    } catch (error: any) {
      console.error("Napaka pri shranjevanju:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče shraniti artikla",
      });
    }
  }

  // Admin/Coach: Toggle active status
  async function toggleActive(item: StoreItem) {
    try {
      const { error } = await supabase
        .from("store_items")
        .update({
          is_active: !item.is_active,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq("id", item.id);

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: item.is_active ? "Artikel deaktiviran" : "Artikel aktiviran",
      });

      loadItems();
    } catch (error: any) {
      console.error("Napaka pri spreminjanju statusa:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče spremeniti statusa",
      });
    }
  }

  function handleEdit(item: StoreItem) {
    setEditingItem(item);

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
    setImagePreview("");
    setImageFile(null);
    setEditingItem(null);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  // Filter items (Admin/Coach)
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filter items (Parent)
  const filteredParentItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(parentSearchQuery.toLowerCase()) ||
      item.item_number.toLowerCase().includes(parentSearchQuery.toLowerCase());
    const matchesCategory = parentCategoryFilter === "all" || item.category === parentCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Cart total
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Status badge helper
  function getStatusBadge(status: string) {
    switch (status) {
      case "open":
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Odprto</Badge>;
      case "ordered":
        return <Badge className="bg-blue-500"><Package className="w-3 h-3 mr-1" />Naročeno</Badge>;
      case "delivered":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Predano</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Preklicano</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  }

  // Parent UI
  if (isParent) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Oprema</h1>
            <p className="text-muted-foreground mt-1">
              Naroči opremo za svojega otroka
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => setIsCartOpen(true)}
            className="relative"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Košarica
            {cartCount > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-red-500">
                {cartCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Iskanje po nazivu ali številki..."
              value={parentSearchQuery}
              onChange={(e) => setParentSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={parentCategoryFilter} onValueChange={setParentCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vse kategorije</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nalaganje...</p>
          </div>
        ) : filteredParentItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Ni artiklov</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredParentItems.map((item) => (
              <Card key={item.id} className="flex flex-col">
                <CardHeader className="p-0">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-48 object-cover rounded-t-lg cursor-pointer hover:opacity-90 transition"
                      onClick={() => setZoomImage(item.image_url)}
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center rounded-t-lg">
                      <ImageIcon className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex-1 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg leading-tight">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">Št. {item.item_number}</p>
                    </div>
                    {item.external_link && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a href={item.external_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {item.description}
                    </p>
                  )}
                  {item.category && (
                    <Badge variant="secondary" className="mb-3">{item.category}</Badge>
                  )}
                  <p className="text-2xl font-bold mb-3">{item.price.toFixed(2)} €</p>

                  {/* Size Selector */}
                  {Array.isArray(item.available_sizes) && item.available_sizes.length > 0 && (
                    <div className="mb-3">
                      <Label className="text-xs mb-2 block">Velikost:</Label>
                      <Select
                        value={selectedSize[item.id] || ""}
                        onValueChange={(value) =>
                          setSelectedSize({ ...selectedSize, [item.id]: value })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Izberi velikost" />
                        </SelectTrigger>
                        <SelectContent>
                          {(item.available_sizes as string[]).map((size) => (
                            <SelectItem key={size} value={size}>{size}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button
                    className="w-full"
                    onClick={() => addToCart(item)}
                    disabled={
                      Array.isArray(item.available_sizes) &&
                      item.available_sizes.length > 0 &&
                      !selectedSize[item.id]
                    }
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Dodaj v košarico
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* My Orders Section */}
        {myOrders.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Moja naročila</h2>
            <div className="grid gap-4">
              {myOrders.map((order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{order.order_number}</CardTitle>
                        <CardDescription>
                          {new Date(order.created_at).toLocaleDateString("sl-SI", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(order.status)}
                        <p className="text-2xl font-bold mt-2">
                          {order.total_amount.toFixed(2)} €
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  {order.status === "open" && (
                    <CardFooter>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => cancelOrder(order.id)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Prekliči naročilo
                      </Button>
                    </CardFooter>
                  )}
                  {order.delivered_at && (
                    <CardFooter className="text-sm text-muted-foreground">
                      Predano: {new Date(order.delivered_at).toLocaleDateString("sl-SI")}
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Cart Dialog */}
        <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Košarica</DialogTitle>
              <DialogDescription>
                {cart.length === 0 ? "Košarica je prazna" : `${cartCount} artikel(i) v košarici`}
              </DialogDescription>
            </DialogHeader>

            {cart.length > 0 && (
              <div className="space-y-4">
                {cart.map((item, index) => (
                  <div key={`${item.item_id}-${item.size}`} className="flex items-center gap-4 border-b pb-4">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Velikost: {item.size} • Št. {item.item_number}
                      </p>
                      <p className="text-sm font-medium mt-1">{item.price.toFixed(2)} €</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateCartQuantity(index, -1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateCartQuantity(index, 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(index)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="text-right font-semibold">
                      {(item.price * item.quantity).toFixed(2)} €
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-lg font-semibold">Skupaj:</span>
                  <span className="text-2xl font-bold">{cartTotal.toFixed(2)} €</span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCartOpen(false)}>
                Nadaljuj z nakupovanjem
              </Button>
              <Button onClick={placeOrder} disabled={cart.length === 0}>
                Oddaj naročilo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Image Zoom Dialog */}
        <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
          <DialogContent className="max-w-4xl">
            <img src={zoomImage || ""} alt="Povečana slika" className="w-full h-auto" />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Admin/Coach UI (existing code continues...)
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Trgovina - Oprema</h1>
          <p className="text-muted-foreground mt-1">
            Upravljanje artiklov in naročil
          </p>
        </div>
      </div>

      <Tabs defaultValue="artikli" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="artikli">Artikli</TabsTrigger>
          <TabsTrigger value="narocila">Naročila</TabsTrigger>
          <TabsTrigger value="zbirniki">Zbirniki</TabsTrigger>
        </TabsList>

        <TabsContent value="artikli">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Artikli</CardTitle>
                  <CardDescription>Upravljanje kataloga opreme</CardDescription>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Dodaj artikel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <Input
                    placeholder="Iskanje po nazivu ali številki..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Vse kategorije</SelectItem>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nalaganje...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Ni artiklov</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Št.</TableHead>
                      <TableHead>Slika</TableHead>
                      <TableHead>Naziv</TableHead>
                      <TableHead>Kategorija</TableHead>
                      <TableHead>Velikosti</TableHead>
                      <TableHead>Zaloga</TableHead>
                      <TableHead>Cena</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">
                          {item.item_number}
                        </TableCell>
                        <TableCell>
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-16 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition"
                              onClick={() => setZoomImage(item.image_url)}
                            />
                          ) : (
                            <div className="w-16 h-12 bg-muted rounded flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {!item.is_active && (
                              <Badge variant="secondary" className="mt-1">Neaktiven</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.category ? (
                            <Badge variant="outline">{item.category}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {Array.isArray(item.available_sizes) && item.available_sizes.length > 0
                            ? (item.available_sizes as string[]).join(", ")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.quantity_in_stock || 0}</p>
                            {item.quantity_in_stock !== null &&
                              item.low_stock_threshold !== null &&
                              item.quantity_in_stock <= item.low_stock_threshold && (
                                <Badge variant="destructive" className="text-xs mt-1">
                                  Nizka zaloga
                                </Badge>
                              )}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {item.price.toFixed(2)} €
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(item)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant={item.is_active ? "destructive" : "default"}
                              size="sm"
                              onClick={() => toggleActive(item)}
                            >
                              {item.is_active ? "Deaktiviraj" : "Aktiviraj"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="narocila">
          <Card>
            <CardHeader>
              <CardTitle>Naročila</CardTitle>
              <CardDescription>Pregled vseh naročil staršev</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-12">
                Pregled naročil bo implementiran v Fazi 4
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zbirniki">
          <Card>
            <CardHeader>
              <CardTitle>Zbirniki</CardTitle>
              <CardDescription>Pregled zbirnikov (1. in 15. dan v mesecu)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-12">
                Pregled zbirnikov bo implementiran v Fazi 5
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Item Dialog */}
      <Dialog
        open={isAddDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setIsEditDialogOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Uredi artikel" : "Dodaj artikel"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="item_number">Številka artikla *</Label>
                <Input
                  id="item_number"
                  value={formData.item_number}
                  onChange={(e) =>
                    setFormData({ ...formData, item_number: e.target.value })
                  }
                  placeholder="npr. ART-001"
                />
              </div>
              <div>
                <Label htmlFor="category">Kategorija</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izberi kategorijo" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="name">Naziv artikla *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="npr. Klubski dres"
              />
            </div>

            <div>
              <Label htmlFor="description">Opis</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Kratek opis artikla..."
                rows={3}
              />
            </div>

            <div>
              <Label className="mb-2 block">Razpoložljive velikosti</Label>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_SIZES.map((size) => (
                  <div key={size} className="flex items-center space-x-2">
                    <Checkbox
                      id={`size-${size}`}
                      checked={formData.available_sizes.includes(size)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            available_sizes: [...formData.available_sizes, size],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            available_sizes: formData.available_sizes.filter(
                              (s) => s !== size
                            ),
                          });
                        }
                      }}
                    />
                    <label
                      htmlFor={`size-${size}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {size}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="price">Cena (€) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="quantity">Zaloga</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity_in_stock}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity_in_stock: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="threshold">Prag opozorila</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={formData.low_stock_threshold}
                  onChange={(e) =>
                    setFormData({ ...formData, low_stock_threshold: e.target.value })
                  }
                  placeholder="5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="external_link">Zunanja povezava</Label>
              <Input
                id="external_link"
                type="url"
                value={formData.external_link}
                onChange={(e) =>
                  setFormData({ ...formData, external_link: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div>
              <Label htmlFor="image">Slika artikla</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="mt-2"
              />
              {imagePreview && (
                <div className="mt-4">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-32 h-24 object-cover rounded border"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setIsEditDialogOpen(false);
                resetForm();
              }}
            >
              Prekliči
            </Button>
            <Button onClick={handleSubmit}>
              {editingItem ? "Posodobi" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Zoom Dialog */}
      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-4xl">
          <img src={zoomImage || ""} alt="Povečana slika" className="w-full h-auto object-contain rounded" />
        </DialogContent>
      </Dialog>
    </div>
  );
}