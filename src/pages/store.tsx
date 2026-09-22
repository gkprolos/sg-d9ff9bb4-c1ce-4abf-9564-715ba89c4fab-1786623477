import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, Plus, Minus, Trash2, Package, AlertCircle, 
  ChevronDown, ChevronUp, Edit, Eye, Clock, CheckCircle, 
  XCircle, ArrowLeft, Search, ImageIcon, ExternalLink, 
  X, Pencil, Tag, FileText, TrendingUp 
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";

type StoreOrder = Database["public"]["Tables"]["store_orders"]["Row"];
type StoreOrderItem = Database["public"]["Tables"]["store_order_items"]["Row"];
type StoreItem = Database["public"]["Tables"]["store_items"]["Row"];
type StoreCollectionPeriod = Database["public"]["Tables"]["store_collection_periods"]["Row"];
type StoreCollection = Database["public"]["Tables"]["store_collections"]["Row"];
type StoreCollectionItem = Database["public"]["Tables"]["store_collection_items"]["Row"];
type StoreCategory = Database["public"]["Tables"]["store_categories"]["Row"];

// Extended type for collection items with supplier relation
type StoreCollectionItemWithSupplier = StoreCollectionItem & {
  store_items: {
    supplier_id: string | null;
    store_suppliers: {
      name: string;
    } | null;
  } | null;
};

interface Child {
  id: string;
  first_name: string;
  last_name: string;
}

interface CartItem {
  item_id: string;
  item_number: string;
  item_name: string;
  name: string;
  item_price: number;
  price: number;
  size: string;
  quantity: number;
  image_url: string;
}

interface Order extends StoreOrder {
  children?: { first_name: string; last_name: string };
  store_collection_periods?: { period_name: string };
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
}

interface CollectionWithStats {
  id: string;
  collection_number: string;
  collection_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  total_orders?: number;
  total_items?: number;
  total_amount?: number;
}

interface StoreStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  activeCollections: number;
  avgOrderValue: number;
}

interface TopItem {
  item_number: string;
  item_name: string;
  total_quantity: number;
  total_sold: number;
  total_revenue: number;
  collections_count?: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  orders_count: number;
  total_revenue: number;
  avg_order_value: number;
}

const ORDER_STATUSES = [
  { value: "open", label: "Odprto" },
  { value: "sprejeto", label: "Sprejeto" },
  { value: "naročeno", label: "Naročeno" },
  { value: "dobavljeno", label: "Dobavljeno" },
  { value: "račun", label: "Račun" },
];

const AVAILABLE_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"];

export default function Store() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, StoreOrderItem[]>>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false);
  const [selectedOrderItems, setSelectedOrderItems] = useState<StoreOrderItem[]>([]);
  const [isEditStatusDialogOpen, setIsEditStatusDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");

  // Order Status Form Data
  const [orderStatusFormData, setOrderStatusFormData] = useState({
    status: "",
    ordered_at: "",
    delivered_at: "",
    invoiced_at: "",
  });

  // Collections State
  const [collections, setCollections] = useState<CollectionWithStats[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<CollectionWithStats | null>(null);
  const [collectionFormData, setCollectionFormData] = useState({
    collection_number: "",
    collection_date: new Date().toISOString().split("T")[0],
    status: "draft" as string,
    notes: "",
  });
  const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<StoreCollection | null>(null);

  // Collection Items State
  const [selectedCollectionItems, setSelectedCollectionItems] = useState<string[]>([]);

  // Items State
  const [items, setItems] = useState<StoreItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<StoreItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [itemFormData, setItemFormData] = useState({
    item_number: "",
    name: "",
    description: "",
    price: 0,
    category_id: "",
    available_sizes: [] as string[],
    image_url: "",
  });

  // Shopping Cart State (for parents)
  const [isCartDialogOpen, setIsCartDialogOpen] = useState(false);
  const [selectedItemForCart, setSelectedItemForCart] = useState<StoreItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");

  // Articles Management State
  const [isArticleDialogOpen, setIsArticleDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<StoreItem | null>(null);
  const [articleFormData, setArticleFormData] = useState({
    item_number: "",
    name: "",
    description: "",
    price: 0,
    category: "",
    available_sizes: [] as any[],
    image_url: "",
    external_link: "",
    supplier_id: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  // Categories Management State
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
  });
  const [categories, setCategories] = useState<StoreCategory[]>([]);

  // Suppliers Management State
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [supplierFormData, setSupplierFormData] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    notes: "",
  });

  // Collection View/Edit State
  const [viewingCollection, setViewingCollection] = useState<CollectionWithStats | null>(null);
  const [isCollectionViewDialogOpen, setIsCollectionViewDialogOpen] = useState(false);
  const [editingCollectionStatus, setEditingCollectionStatus] = useState<string>("");
  const [collectionItems, setCollectionItems] = useState<StoreCollectionItemWithSupplier[]>([]);

  // Collections Management State (for creating collections from orders)
  const [selectedOrdersForCollection, setSelectedOrdersForCollection] = useState<Set<string>>(new Set());

  // Children State
  const [children, setChildren] = useState<Child[]>([]);
  const [periods, setPeriods] = useState<StoreCollectionPeriod[]>([]);

  // Stats State
  const [stats, setStats] = useState<StoreStats>({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    activeCollections: 0,
    avgOrderValue: 0,
  });
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);

  // Active Tab State
  const [activeTab, setActiveTab] = useState("orders");

  useEffect(() => {
    if (user) {
      loadItems();
      loadCategories();
      loadSuppliers();
      loadPeriods();
      loadTopItems();
      fetchOrders();
      loadCollections();
    }
  }, [user]);

  useEffect(() => {
    filterItems();
  }, [items, searchQuery, selectedCategory]);

  const filterItems = () => {
    let filtered = [...items];

    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.item_number.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory && selectedCategory !== "all") {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    setFilteredItems(filtered);
  };

  const loadStats = async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("store_orders")
        .select("total_amount");

      if (ordersError) throw ordersError;

      const totalOrders = ordersData?.length || 0;
      const totalRevenue = ordersData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      setStats({
        totalOrders: totalOrders,
        totalRevenue: totalRevenue,
        pendingOrders: 0,
        activeCollections: 0,
        avgOrderValue: avgOrderValue,
      });
    } catch (error: any) {
      console.error("Error loading stats:", error);
    }
  };

  const loadTopItems = async () => {
    try {
      const { data, error } = await supabase
        .from("store_order_items")
        .select("item_id, item_number, item_name, quantity, unit_price");

      if (error) throw error;

      const aggregated: Record<string, any> = {};
      
      data?.forEach((item: any) => {
        const itemId = item.item_id || item.item_number;
        if (!aggregated[itemId]) {
          aggregated[itemId] = {
            item_number: item.item_number || "N/A",
            item_name: item.item_name || "Unknown",
            total_sold: 0,
            total_revenue: 0,
          };
        }
        aggregated[itemId].total_sold += item.quantity || 0;
        aggregated[itemId].total_revenue += (item.quantity || 0) * (item.unit_price || 0);
      });

      const topItemsArray = Object.values(aggregated)
        .map((item: any) => ({
          item_number: item.item_number,
          item_name: item.item_name,
          total_quantity: item.total_sold,
          total_sold: item.total_sold,
          total_revenue: item.total_revenue,
        }))
        .sort((a: any, b: any) => b.total_sold - a.total_sold)
        .slice(0, 10) as TopItem[];

      setTopItems(topItemsArray);
    } catch (error: any) {
      console.error("Error loading top items:", error);
    }
  };

  const loadMonthlyRevenue = async () => {
    try {
      const { data, error } = await supabase
        .from("store_orders")
        .select("created_at, total_amount");

      if (error) throw error;

      const monthlyData: Record<string, { total: number; count: number }> = {};
      
      data?.forEach((order) => {
        const date = new Date(order.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { total: 0, count: 0 };
        }
        
        monthlyData[monthKey].total += order.total_amount || 0;
        monthlyData[monthKey].count += 1;
      });

      const monthlyArray = Object.entries(monthlyData)
        .map(([month, data]) => {
          const [year, monthNum] = month.split("-");
          const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString("sl-SI", { month: "short", year: "numeric" });
          const total_revenue = data.total;
          const orders_count = data.count;
          const avg_order_value = orders_count > 0 ? total_revenue / orders_count : 0;
          
          return {
            month: monthName,
            revenue: total_revenue,
            orders_count: orders_count,
            total_revenue: total_revenue,
            avg_order_value: avg_order_value,
          };
        })
        .sort((a, b) => a.month.localeCompare(b.month));

      setMonthlyRevenue(monthlyArray.slice(-12));
    } catch (error: any) {
      console.error("Error loading monthly revenue:", error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("store_categories")
        .select("*")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error("Error loading categories:", error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from("store_suppliers")
        .select("*")
        .order("name");

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error: any) {
      console.error("Error loading suppliers:", error);
    }
  };

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from("store_items")
        .select("*")
        .order("item_number");

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri nalaganju artiklov: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const loadChildren = async () => {
    try {
      // Children data is fetched through parent API endpoints
      // Not directly from database for security
      setChildren([]);
    } catch (error: any) {
      console.error("Error loading children:", error);
    }
  };

  const loadPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from("store_collection_periods")
        .select("*")
        .order("period_date", { ascending: false });

      if (error) throw error;
      setPeriods(data || []);
    } catch (error: any) {
      console.error("Error loading periods:", error);
    }
  };

  const loadCollections = async () => {
    try {
      const { data, error } = await supabase
        .from("store_collections")
        .select(`
          *,
          store_orders(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const collectionsWithCounts = (data || []).map((collection: any) => ({
        ...collection,
        total_orders: collection.store_orders?.[0]?.count || 0,
      }));
      
      setCollections(collectionsWithCounts);
    } catch (error: any) {
      console.error("Error loading collections:", error);
    }
  };

  const loadCollectionDetails = async (collectionId: string) => {
    try {
      const { data: collectionData, error: collectionError } = await supabase
        .from("store_collections")
        .select("*")
        .eq("id", collectionId)
        .single();

      if (collectionError) throw collectionError;

      const { data: collectionItemsData, error: itemsError } = await supabase
        .from("store_collection_items")
        .select("*, store_items!inner(supplier_id, store_suppliers(name))")
        .eq("collection_id", collectionId);

      if (itemsError) throw itemsError;

      setSelectedCollection(collectionData as CollectionWithStats);
      setCollectionItems((collectionItemsData || []) as StoreCollectionItemWithSupplier[]);
    } catch (error: any) {
      console.error("Error loading collection details:", error);
      toast({
        title: "Napaka",
        description: `Napaka pri nalaganju podrobnosti zbirnika: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const fetchOrders = async () => {
    try {
      let query = supabase
        .from("store_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (userRole === "parent") {
        query = query.eq("parent_id", user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        setMyOrders([]);
        setOrderItems({});
        return;
      }

      // Get unique parent IDs
      const uniqueParentIds = [...new Set(data.map(order => order.parent_id))];

      // Fetch profiles for all parents
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", uniqueParentIds);

      if (profilesError) throw profilesError;

      // Create a map of parent_id -> profile
      const profilesMap = new Map(
        (profilesData || []).map(profile => [
          profile.id,
          {
            name: profile.full_name?.trim() || 'N/A',
            email: profile.email?.trim() || '',
          }
        ])
      );

      // Map the data to include parent_name and parent_email
      const ordersWithParentInfo = data.map((order: any) => {
        const profile = profilesMap.get(order.parent_id);
        return {
          ...order,
          parent_name: profile?.name || 'N/A',
          parent_email: profile?.email || '',
        };
      });

      setMyOrders(ordersWithParentInfo);

      // Load items for each order
      const itemsPromises = ordersWithParentInfo.map((order: Order) =>
        supabase
          .from("store_order_items")
          .select("*")
          .eq("order_id", order.id)
      );

      const itemsResults = await Promise.all(itemsPromises);
      const itemsMap: Record<string, StoreOrderItem[]> = {};
      ordersWithParentInfo.forEach((order: Order, index: number) => {
        itemsMap[order.id] = itemsResults[index].data || [];
      });

      setOrderItems(itemsMap);
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri nalaganju naročil: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const updateOrderStatus = async () => {
    if (!editingOrder || !newStatus) return;

    try {
      // Update order status
      const { error: orderError } = await supabase
        .from("store_orders")
        .update({ status: newStatus })
        .eq("id", editingOrder.id);

      if (orderError) throw orderError;

      toast({
        title: "Status posodobljen",
        description: `Status naročila ${editingOrder.order_number} je bil spremenjen v "${ORDER_STATUSES.find(s => s.value === newStatus)?.label}".`,
      });

      setIsEditStatusDialogOpen(false);
      setEditingOrder(null);
      setNewStatus("");
      fetchOrders(); // Refresh orders
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri posodabljanju statusa: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const toggleOrderExpand = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const openItemsDialog = (orderId: string) => {
    setSelectedOrderItems(orderItems[orderId] || []);
    setIsItemsDialogOpen(true);
  };

  const openEditStatusDialog = (order: Order) => {
    setEditingOrder(order);
    setNewStatus(order.status);
    setIsEditStatusDialogOpen(true);
  };

  // Articles CRUD Functions
  const openArticleDialog = (article?: StoreItem) => {
    if (article) {
      setEditingArticle(article);
      setArticleFormData({
        item_number: article.item_number,
        name: article.name,
        description: article.description || "",
        price: article.price,
        category: article.category,
        available_sizes: Array.isArray(article.available_sizes) ? article.available_sizes : [],
        image_url: article.image_url || "",
        external_link: article.external_link || "",
        supplier_id: (article as any).supplier_id || "",
      });
    } else {
      setEditingArticle(null);
      setArticleFormData({
        item_number: "",
        name: "",
        description: "",
        price: 0,
        category: "",
        available_sizes: [],
        image_url: "",
        external_link: "",
        supplier_id: "",
      });
    }
    setIsArticleDialogOpen(true);
  };

  const saveArticle = async () => {
    try {
      const sizesArray = Array.isArray(articleFormData.available_sizes) 
        ? articleFormData.available_sizes.filter((s): s is string => typeof s === 'string')
        : [];

      if (editingArticle) {
        // Update existing article
        const { error } = await supabase
          .from("store_items")
          .update({
            item_number: articleFormData.item_number,
            name: articleFormData.name,
            description: articleFormData.description,
            price: articleFormData.price,
            category: articleFormData.category,
            available_sizes: sizesArray as any,
            image_url: articleFormData.image_url,
            external_link: articleFormData.external_link,
            supplier_id: articleFormData.supplier_id || null,
          })
          .eq("id", editingArticle.id);

        if (error) throw error;

        toast({
          title: "Artikel posodobljen",
          description: `Artikel ${articleFormData.name} je bil uspešno posodobljen.`,
        });
      } else {
        // Create new article
        const { error } = await supabase
          .from("store_items")
          .insert({
            item_number: articleFormData.item_number,
            name: articleFormData.name,
            description: articleFormData.description,
            price: articleFormData.price,
            category: articleFormData.category,
            available_sizes: sizesArray as any,
            image_url: articleFormData.image_url,
            external_link: articleFormData.external_link,
            supplier_id: articleFormData.supplier_id || null,
          });

        if (error) throw error;

        toast({
          title: "Artikel ustvarjen",
          description: `Artikel ${articleFormData.name} je bil uspešno ustvarjen.`,
        });
      }

      setIsArticleDialogOpen(false);
      loadItems();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri shranjevanju artikla: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Napaka",
        description: "Naložite lahko samo slike (PNG, JPG, WebP, GIF)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Napaka",
        description: "Slika je prevelika. Maksimalna velikost je 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `store-items/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("public-assets")
        .getPublicUrl(filePath);

      setArticleFormData({
        ...articleFormData,
        image_url: urlData.publicUrl,
      });

      toast({
        title: "Slika naložena",
        description: "Slika je bila uspešno naložena.",
      });
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri nalaganju slike: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteArticleImage = async () => {
    if (!articleFormData.image_url) return;

    try {
      // Extract file path from URL
      const url = new URL(articleFormData.image_url);
      const pathParts = url.pathname.split("/");
      const filePath = pathParts.slice(pathParts.indexOf("store-items")).join("/");

      // Delete from storage
      const { error } = await supabase.storage
        .from("public-assets")
        .remove([filePath]);

      if (error) throw error;

      setArticleFormData({
        ...articleFormData,
        image_url: "",
      });

      toast({
        title: "Slika izbrisana",
        description: "Slika je bila uspešno izbrisana.",
      });
    } catch (error: any) {
      // If delete fails, just clear the URL (file might not exist)
      setArticleFormData({
        ...articleFormData,
        image_url: "",
      });
      
      toast({
        title: "Slika odstranjena",
        description: "Povezava do slike je bila odstranjena.",
      });
    }
  };

  const deleteArticle = async (articleId: string) => {
    if (!confirm("Ali ste prepričani, da želite izbrisati ta artikel?")) return;

    try {
      const { error } = await supabase
        .from("store_items")
        .delete()
        .eq("id", articleId);

      if (error) throw error;

      toast({
        title: "Artikel izbrisan",
        description: "Artikel je bil uspešno izbrisan.",
      });

      loadItems();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri brisanju artikla: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Categories CRUD Functions
  const openCategoryDialog = (category?: StoreCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryFormData({
        name: category.name,
        description: category.description || "",
      });
    } else {
      setEditingCategory(null);
      setCategoryFormData({
        name: "",
        description: "",
      });
    }
    setIsCategoryDialogOpen(true);
  };

  const saveCategory = async () => {
    try {
      if (editingCategory) {
        // Update existing category
        const { error } = await supabase
          .from("store_categories")
          .update({
            name: categoryFormData.name,
            description: categoryFormData.description,
          })
          .eq("id", editingCategory.id);

        if (error) throw error;

        toast({
          title: "Kategorija posodobljena",
          description: `Kategorija ${categoryFormData.name} je bila uspešno posodobljena.`,
        });
      } else {
        // Create new category
        const { error } = await supabase
          .from("store_categories")
          .insert({
            name: categoryFormData.name,
            description: categoryFormData.description,
          });

        if (error) throw error;

        toast({
          title: "Kategorija ustvarjena",
          description: `Kategorija ${categoryFormData.name} je bila uspešno ustvarjena.`,
        });
      }

      setIsCategoryDialogOpen(false);
      loadCategories();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri shranjevanju kategorije: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!confirm("Ali ste prepričani, da želite izbrisati to kategorijo?")) return;

    try {
      const { error } = await supabase
        .from("store_categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;

      toast({
        title: "Kategorija izbrisana",
        description: "Kategorija je bila uspešno izbrisana.",
      });

      loadCategories();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri brisanju kategorije: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Suppliers CRUD Functions
  const openSupplierDialog = (supplier?: any) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setSupplierFormData({
        name: supplier.name,
        contact_person: supplier.contact_person || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        notes: supplier.notes || "",
      });
    } else {
      setEditingSupplier(null);
      setSupplierFormData({
        name: "",
        contact_person: "",
        email: "",
        phone: "",
        notes: "",
      });
    }
    setIsSupplierDialogOpen(true);
  };

  const saveSupplier = async () => {
    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from("store_suppliers")
          .update({
            name: supplierFormData.name,
            contact_person: supplierFormData.contact_person,
            email: supplierFormData.email,
            phone: supplierFormData.phone,
            notes: supplierFormData.notes,
          })
          .eq("id", editingSupplier.id);

        if (error) throw error;

        toast({
          title: "Dobavitelj posodobljen",
          description: `Dobavitelj ${supplierFormData.name} je bil uspešno posodobljen.`,
        });
      } else {
        const { error } = await supabase
          .from("store_suppliers")
          .insert({
            name: supplierFormData.name,
            contact_person: supplierFormData.contact_person,
            email: supplierFormData.email,
            phone: supplierFormData.phone,
            notes: supplierFormData.notes,
          });

        if (error) throw error;

        toast({
          title: "Dobavitelj ustvarjen",
          description: `Dobavitelj ${supplierFormData.name} je bil uspešno ustvarjen.`,
        });
      }

      setIsSupplierDialogOpen(false);
      loadSuppliers();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri shranjevanju dobavitelja: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const deleteSupplier = async (supplierId: string) => {
    if (!confirm("Ali ste prepričani, da želite izbrisati tega dobavitelja?")) return;

    try {
      const { error } = await supabase
        .from("store_suppliers")
        .delete()
        .eq("id", supplierId);

      if (error) throw error;

      toast({
        title: "Dobavitelj izbrisan",
        description: "Dobavitelj je bil uspešno izbrisan.",
      });

      loadSuppliers();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri brisanju dobavitelja: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const editCollection = (collection: StoreCollection) => {
    setEditingCollection(collection);
    setCollectionFormData({
      collection_number: collection.collection_number,
      collection_date: collection.collection_date || new Date().toISOString().split("T")[0],
      status: collection.status,
      notes: collection.notes || "",
    });
    setIsCollectionDialogOpen(true);
  };

  const deleteCollection = async (collectionId: string) => {
    if (!confirm("Ali ste prepričani, da želite izbrisati ta zbirnik? Naročila bodo ostala, vendar ne bodo več povezana z zbirnikom.")) return;

    try {
      // First, disconnect orders from this collection
      const { error: ordersError } = await supabase
        .from("store_orders")
        .update({ collection_id: null, status: "open" })
        .eq("collection_id", collectionId);

      if (ordersError) throw ordersError;

      // Delete collection items
      const { error: itemsError } = await supabase
        .from("store_collection_items")
        .delete()
        .eq("collection_id", collectionId);

      if (itemsError) throw itemsError;

      // Delete collection
      const { error: collectionError } = await supabase
        .from("store_collections")
        .delete()
        .eq("id", collectionId);

      if (collectionError) throw collectionError;

      toast({
        title: "Zbirnik izbrisan",
        description: "Zbirnik je bil uspešno izbrisan. Naročila so bila vrnjena v stanje 'Odprto'.",
      });

      loadCollections();
      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri brisanju zbirnika: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Shopping Cart Functions
  const openAddToCartDialog = (item: StoreItem) => {
    setSelectedItemForCart(item);
    setSelectedSize("");
    setQuantity(1);
    setIsCartDialogOpen(true);
  };

  const addToCart = () => {
    if (!selectedItemForCart) return;
    
    const sizes = Array.isArray(selectedItemForCart.available_sizes) ? selectedItemForCart.available_sizes : [];
    if (sizes.length > 0 && !selectedSize) {
      toast({
        title: "Izberite velikost",
        description: "Prosimo, izberite velikost pred dodajanjem v košarico.",
        variant: "destructive",
      });
      return;
    }

    const existingItemIndex = cart.findIndex(
      item => item.item_id === selectedItemForCart.id && item.size === (selectedSize || "N/A")
    );

    if (existingItemIndex >= 0) {
      const updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity += quantity;
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          item_id: selectedItemForCart.id,
          item_number: selectedItemForCart.item_number,
          item_name: selectedItemForCart.name,
          name: selectedItemForCart.name,
          size: selectedSize || "N/A",
          quantity: quantity,
          item_price: selectedItemForCart.price,
          price: selectedItemForCart.price,
          image_url: selectedItemForCart.image_url || "",
        },
      ]);
    }

    toast({
      title: "Dodano v košarico",
      description: `${selectedItemForCart.name} (${quantity}x) je bilo dodano v košarico.`,
    });

    setIsCartDialogOpen(false);
  };

  const removeFromCart = (itemId: string, size: string) => {
    setCart(cart.filter(item => !(item.item_id === itemId && item.size === size)));
  };

  const updateCartQuantity = (itemId: string, size: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(itemId, size);
      return;
    }
    setCart(cart.map(item =>
      item.item_id === itemId && item.size === size
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const clearCart = () => {
    setCart([]);
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      toast({
        title: "Košarica je prazna",
        description: "Dodajte izdelke v košarico pred oddajo naročila.",
        variant: "destructive",
      });
      return;
    }

    if (!deliveryAddress.trim()) {
      toast({
        title: "Manjka naslov",
        description: "Prosimo, vnesite naslov dostave.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate order number
      const orderNumber = `ORD-${Date.now()}`;
      const totalAmount = cart.reduce((sum, item) => sum + item.quantity * item.item_price, 0);

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("store_orders")
        .insert({
          order_number: orderNumber,
          parent_id: user?.id,
          status: "open",
          total_amount: totalAmount,
          delivery_address: deliveryAddress,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items with subtotal
      const orderItems = cart.map(item => ({
        order_id: order.id,
        item_id: item.item_id,
        item_number: item.item_number,
        item_name: item.item_name,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.item_price,
        subtotal: item.quantity * item.item_price,
      }));

      const { error: itemsError } = await supabase
        .from("store_order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Naročilo oddano",
        description: `Vaše naročilo ${orderNumber} je bilo uspešno oddano.`,
      });

      clearCart();
      setDeliveryAddress("");
      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri oddaji naročila: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Collection View/Edit Functions
  const openCollectionView = async (collection: any) => {
    setViewingCollection(collection);
    setEditingCollectionStatus(collection.status);

    try {
      const { data, error } = await supabase
        .from("store_collection_items")
        .select("*, store_items!inner(supplier_id, store_suppliers(name))")
        .eq("collection_id", collection.id)
        .order("item_number");

      if (error) throw error;
      
      // Type cast to ensure proper typing
      const typedData = (data || []) as StoreCollectionItemWithSupplier[];
      setCollectionItems(typedData);
      setIsCollectionViewDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri nalaganju postavk: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const updateCollectionStatus = async () => {
    if (!viewingCollection) return;

    try {
      // Update collection status
      const { error: collectionError } = await supabase
        .from("store_collections")
        .update({ status: editingCollectionStatus })
        .eq("id", viewingCollection.id);

      if (collectionError) throw collectionError;

      // Get all orders in this collection
      const { data: orders, error: ordersError } = await supabase
        .from("store_orders")
        .select("id")
        .eq("collection_id", viewingCollection.id);

      if (ordersError) throw ordersError;

      // Update order statuses based on collection status
      const orderStatus = editingCollectionStatus === "draft" ? "open" : editingCollectionStatus === "ordered" ? "ordered" : "delivered";
      
      if (orders && orders.length > 0) {
        const { error: updateError } = await supabase
          .from("store_orders")
          .update({ status: orderStatus })
          .in("id", orders.map(o => o.id));

        if (updateError) throw updateError;
      }

      toast({
        title: "Status posodobljen",
        description: `Status zbirnika in ${orders?.length || 0} naročil je bil posodobljen.`,
      });

      setIsCollectionViewDialogOpen(false);
      loadCollections();
      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri posodobitvi statusa: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const copyCollectionItems = () => {
    if (collectionItems.length === 0) return;

    const text = collectionItems
      .map(item => `${item.item_number}\t${item.item_name}\t${item.size}\t${item.total_quantity}\t${item.unit_price.toFixed(2)}`)
      .join("\n");

    navigator.clipboard.writeText(text);

    toast({
      title: "Kopirano",
      description: "Postavke so bile kopirane v odložišče.",
    });
  };

  const exportCollectionToExcel = () => {
    if (!viewingCollection || collectionItems.length === 0) return;

    const data = collectionItems.map((item, index) => ({
      "Zap. št.": index + 1,
      "Šifra artikla": item.item_number,
      "Naziv": item.item_name,
      "Velikost": item.size,
      "Količina": item.total_quantity,
      "Cena/kos (€)": item.unit_price.toFixed(2),
      "Skupaj (€)": (item.total_quantity * item.unit_price).toFixed(2),
      "Dobavitelj": "N/A",
    }));

    // Use excelUtils to export
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Zbirnik");

    // Add totals row
    const totalQuantity = collectionItems.reduce((sum, item) => sum + item.total_quantity, 0);
    const totalAmount = collectionItems.reduce((sum, item) => sum + (item.total_quantity * item.unit_price), 0);

    XLSX.utils.sheet_add_json(ws, [
      {
        "Zap. št.": "",
        "Šifra artikla": "",
        "Naziv": "",
        "Velikost": "SKUPAJ:",
        "Količina": totalQuantity,
        "Cena/kos (€)": "",
        "Skupaj (€)": totalAmount.toFixed(2),
        "Dobavitelj": "",
      },
    ], { skipHeader: true, origin: -1 });

    XLSX.writeFile(wb, `Zbirnik_${viewingCollection.collection_number}_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "Excel izvožen",
      description: "Zbirnik je bil izvožen v Excel datoteko.",
    });
  };

  // Collections Management Functions
  const toggleOrderSelection = (orderId: string) => {
    const newSelection = new Set(selectedOrdersForCollection);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrdersForCollection(newSelection);
  };

  const createCollection = async () => {
    if (selectedOrdersForCollection.size === 0) {
      toast({
        title: "Napaka",
        description: "Izberite vsaj eno naročilo za zbirnik.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create collection with all properties
      const { data: collection, error: collectionError } = await supabase
        .from("store_collections")
        .insert({
          collection_number: collectionFormData.collection_number,
          collection_date: collectionFormData.collection_date,
          status: collectionFormData.status,
          notes: collectionFormData.notes || "",
        })
        .select()
        .single();

      if (collectionError) {
        console.error("Collection creation error:", collectionError);
        throw collectionError;
      }

      // Update selected orders to reference this collection and change status to 'ordered'
      const { error: ordersError } = await supabase
        .from("store_orders")
        .update({
          collection_id: collection.id,
          status: "ordered",
        })
        .in("id", Array.from(selectedOrdersForCollection));

      if (ordersError) {
        console.error("Orders update error:", ordersError);
        throw ordersError;
      }

      // Get all order items from selected orders
      const { data: orderItems, error: itemsError } = await supabase
        .from("store_order_items")
        .select("*")
        .in("order_id", Array.from(selectedOrdersForCollection));

      if (itemsError) throw itemsError;

      // Create collection items (aggregate by item_number + size)
      const itemsMap = new Map<string, any>();
      orderItems?.forEach(item => {
        const key = `${item.item_number}-${item.size}`;
        if (itemsMap.has(key)) {
          const existing = itemsMap.get(key);
          existing.total_quantity += item.quantity;
        } else {
          itemsMap.set(key, {
            collection_id: collection.id,
            item_id: item.item_id,
            item_number: item.item_number,
            item_name: item.item_name,
            size: item.size,
            total_quantity: item.quantity,
            unit_price: item.unit_price,
          });
        }
      });

      const collectionItems = Array.from(itemsMap.values());
      const { error: itemsInsertError } = await supabase
        .from("store_collection_items")
        .insert(collectionItems);

      if (itemsInsertError) throw itemsInsertError;

      toast({
        title: "Zbirnik ustvarjen",
        description: `Zbirnik ${collectionFormData.collection_number} je bil uspešno ustvarjen iz ${selectedOrdersForCollection.size} naročil.`,
      });

      setIsCollectionDialogOpen(false);
      setSelectedOrdersForCollection(new Set());
      setCollectionFormData({
        collection_number: "",
        collection_date: new Date().toISOString().split("T")[0],
        status: "draft",
        notes: "",
      });
      fetchOrders();
      loadCollections();
    } catch (error: any) {
      console.error("Full error:", error);
      toast({
        title: "Napaka",
        description: `Napaka pri ustvarjanju zbirnika: ${error.message || JSON.stringify(error)}`,
        variant: "destructive",
      });
    }
  };

  const toggleSelectAllOrders = () => {
    const openOrders = myOrders.filter(o => o.status === "open");
    if (selectedOrdersForCollection.size === openOrders.length) {
      // Deselect all
      setSelectedOrdersForCollection(new Set());
    } else {
      // Select all open orders
      setSelectedOrdersForCollection(new Set(openOrders.map(o => o.id)));
    }
  };

  // Parent cancel order function
  const deleteOrder = async (orderId: string) => {
    // Check if order can be deleted
    const order = myOrders.find(o => o.id === orderId);
    if (!order) return;

    if (order.status !== "open") {
      toast({
        title: "Ni mogoče izbrisati",
        description: "Naročilo lahko izbrišete samo, dokler je v statusu 'Odprto'.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Ali ste prepričani, da želite izbrisati to naročilo?")) return;

    try {
      // Delete order items first
      const { error: itemsError } = await supabase
        .from("store_order_items")
        .delete()
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      // Delete order
      const { error: orderError } = await supabase
        .from("store_orders")
        .delete()
        .eq("id", orderId);

      if (orderError) throw orderError;

      toast({
        title: "Naročilo izbrisano",
        description: "Naročilo je bilo uspešno izbrisano.",
      });

      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri brisanju naročila: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Nazaj
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Oprema</h1>
              <p className="text-muted-foreground">
                Naročanje klubske opreme
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="grid w-full grid-cols-7">
            {(userRole === "parent" || userRole === "coach" || userRole === "admin") && (
              <TabsTrigger value="store">Trgovina</TabsTrigger>
            )}
            {userRole === "parent" && (
              <TabsTrigger value="my-orders">Moja naročila</TabsTrigger>
            )}
            {(userRole === "coach" || userRole === "admin") && (
              <TabsTrigger value="orders">Naročila</TabsTrigger>
            )}
            {userRole === "admin" && (
              <>
                <TabsTrigger value="collections">Zbirniki</TabsTrigger>
                <TabsTrigger value="reports">Poročila</TabsTrigger>
                <TabsTrigger value="items">Artikli</TabsTrigger>
                <TabsTrigger value="suppliers">Dobavitelji</TabsTrigger>
                <TabsTrigger value="categories">Kategorije</TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Store Tab (Shopping) */}
          {(userRole === "parent" || userRole === "coach" || userRole === "admin") && (
            <TabsContent value="store" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Klubska oprema</CardTitle>
                      <CardDescription>
                        Naročite klubsko opremo za svoje otroke
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setIsCartDialogOpen(true)}
                      className="relative"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Košarica
                      {cart.length > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {cart.reduce((sum, item) => sum + item.quantity, 0)}
                        </Badge>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {items
                      .filter(item => !item.deleted_at)
                      .map((item) => (
                        <Card key={item.id} className="overflow-hidden">
                          {item.image_url && (
                            <div className="aspect-square overflow-hidden bg-muted">
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-lg">{item.name}</CardTitle>
                                <CardDescription className="mt-1">
                                  {item.item_number}
                                </CardDescription>
                              </div>
                              <Badge variant="outline">{item.category}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {item.description && (
                              <p className="text-sm text-muted-foreground mb-3">
                                {item.description}
                              </p>
                            )}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Cena:</span>
                                <span className="text-xl font-bold">{item.price.toFixed(2)} €</span>
                              </div>
                              {Array.isArray(item.available_sizes) && item.available_sizes.length > 0 && (
                                <div>
                                  <span className="text-sm text-muted-foreground">Velikosti:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.available_sizes.map((size: string) => (
                                      <Badge key={size} variant="secondary" className="text-xs">
                                        {size}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 mt-4">
                              <Button
                                className="flex-1"
                                onClick={() => openAddToCartDialog(item)}
                              >
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Dodaj v košarico
                              </Button>
                              {item.external_link && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => window.open(item.external_link, "_blank")}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                  {items.filter(item => !item.deleted_at).length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      Trenutno ni na voljo nobene opreme
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* CATALOG TAB */}
          <TabsContent value="catalog" className="space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Išči po imenu ali šifri..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Vse kategorije" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vse kategorije</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Vse velikosti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vse velikosti</SelectItem>
                  {AVAILABLE_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-48 object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-full h-48 bg-muted flex items-center justify-center rounded-md">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <CardTitle>{item.name}</CardTitle>
                    <CardDescription>
                      Šifra: {item.item_number}
                      <br />
                      Cena: {item.price.toFixed(2)} €
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mb-4">
                        {item.description}
                      </p>
                    )}
                    {userRole === "parent" && (
                      <div className="space-y-2">
                        <Label>Velikost</Label>
                        <div className="flex flex-wrap gap-2">
                          {item.available_sizes?.map((size) => (
                            <Button
                              key={size}
                              variant="outline"
                              size="sm"
                              onClick={() => addToCart(item, size)}
                            >
                              {size}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Ni najdenih artiklov
              </div>
            )}
          </TabsContent>

          {/* MY ORDERS TAB (Parent) */}
          {userRole === "parent" && (
            <TabsContent value="my-orders" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Moja naročila</CardTitle>
                  <CardDescription>
                    Pregled vaših oddanih naročil
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Številka</TableHead>
                        <TableHead>Otrok</TableHead>
                        <TableHead>Obdobje</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Znesek</TableHead>
                        <TableHead>Datum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            Ni naročil
                          </TableCell>
                        </TableRow>
                      ) : (
                        myOrders.map((order) => {
                          const items = orderItems[order.id] || [];
                          const isExpanded = expandedOrders.has(order.id);
                          
                          return (
                            <>
                              <TableRow key={order.id}>
                                <TableCell>
                                  {items.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleOrderExpand(order.id)}
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">{order.order_number}</TableCell>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{order.parent_name || "N/A"}</div>
                                    <div className="text-sm text-muted-foreground">{order.parent_email || ""}</div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {order.collection_id || "N/A"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    order.status === "račun" ? "default" :
                                    order.status === "dobavljeno" ? "secondary" :
                                    order.status === "naročeno" ? "outline" :
                                    "destructive"
                                  }>
                                    {ORDER_STATUSES.find(s => s.value === order.status)?.label || order.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>{order.total_amount.toFixed(2)} €</TableCell>
                                <TableCell>{new Date(order.created_at).toLocaleDateString("sl-SI")}</TableCell>
                              </TableRow>
                              {isExpanded && items.length > 0 && (
                                <TableRow key={`${order.id}-items`}>
                                  <TableCell colSpan={7} className="bg-muted/50 p-4">
                                    <div className="space-y-2">
                                      {items.map((orderItem) => (
                                        <div key={orderItem.id} className="flex justify-between text-sm">
                                          <span>
                                            {orderItem.item_number} - {orderItem.item_name} ({orderItem.size})
                                          </span>
                                          <span>
                                            {orderItem.quantity}x {orderItem.unit_price.toFixed(2)} € = {(orderItem.quantity * orderItem.unit_price).toFixed(2)} €
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Moja naročila</CardTitle>
                    <CardDescription>
                      Pregled vseh naročil
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Številka naročila</TableHead>
                      <TableHead>Naročnik</TableHead>
                      <TableHead>Naslov</TableHead>
                      <TableHead>Zadnja sprememba</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Skupni znesek</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myOrders.map((order) => {
                      const statusBadgeVariant = 
                        order.status === "delivered" ? "default" :
                        order.status === "ordered" ? "secondary" :
                        order.status === "cancelled" ? "destructive" :
                        order.status === "invoiced" ? "outline" : "secondary";

                      // Get the most recent status change timestamp
                      const lastStatusChange = order.delivered_at || order.invoiced_at || order.cancelled_at || order.updated_at || order.created_at;

                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{order.parent_name || "N/A"}</div>
                              <div className="text-sm text-muted-foreground">{order.parent_email || ""}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{order.delivery_address || "-"}</TableCell>
                          <TableCell>
                            <div>
                              <div>{new Date(lastStatusChange).toLocaleDateString("sl-SI")}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(lastStatusChange).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant}>
                              {order.status === "open" ? "Odprto" :
                               order.status === "ordered" ? "Naročeno" :
                               order.status === "delivered" ? "Dostavljeno" :
                               order.status === "invoiced" ? "Fakturirano" :
                               order.status === "cancelled" ? "Preklicano" : order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">{order.total_amount?.toFixed(2) || "0.00"} €</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {items.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openItemsDialog(order.id)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Poglej
                                </Button>
                              )}
                              {userRole === "parent" && order.status === "open" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteOrder(order.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Izbriši
                                </Button>
                              )}
                              {userRole === "admin" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditStatusDialog(order)}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Uredi status
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Items Management Tab */}
          {userRole === "admin" && (
            <TabsContent value="items" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Artikli</CardTitle>
                      <CardDescription>
                        Upravljajte z artikli klubske opreme
                      </CardDescription>
                    </div>
                    {userRole === "admin" && (
                      <Button onClick={() => {
                        setEditingArticle(null);
                        setIsArticleDialogOpen(true);
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nov artikel
                      </Button>
                    )}
                  </div>
                </CardHeader>
              </Card>
            </TabsContent>
          )}

          {/* Articles Tab */}
          {(userRole === "coach" || userRole === "admin") && (
            <TabsContent value="articles" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Artikli</CardTitle>
                      <CardDescription>
                        Upravljanje artiklov v trgovini
                      </CardDescription>
                    </div>
                    <Button onClick={() => openArticleDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nov artikel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Slika</TableHead>
                        <TableHead>Šifra</TableHead>
                        <TableHead>Naziv</TableHead>
                        <TableHead>Kategorija</TableHead>
                        <TableHead>Cena</TableHead>
                        <TableHead>Velikosti</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.image_url ? (
                              <img 
                                src={item.image_url} 
                                alt={item.name}
                                className="w-16 h-16 object-cover rounded-md border"
                                onError={(e) => {
                                  e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='M21 15l-5-5L5 21'/%3E%3C/svg%3E";
                                }}
                              />
                            ) : (
                              <div className="w-16 h-16 bg-muted rounded-md border flex items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono">{item.item_number}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell>{item.price.toFixed(2)} €</TableCell>
                          <TableCell className="text-sm">
                            {Array.isArray(item.available_sizes) 
                              ? item.available_sizes.join(", ") 
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {userRole === "admin" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingArticle(item);
                                      setIsArticleDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Uredi
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteArticle(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Izbriši
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Categories Management Tab */}
          {userRole === "admin" && (
            <TabsContent value="categories" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Kategorije</CardTitle>
                      <CardDescription>
                        Upravljajte s kategorijami artiklov
                      </CardDescription>
                    </div>
                    {userRole === "admin" && (
                      <Button onClick={() => setIsCategoryDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nova kategorija
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naziv</TableHead>
                        <TableHead>Opis</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">{category.name}</TableCell>
                          <TableCell>{category.description || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {userRole === "admin" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingCategory(category);
                                      setIsCategoryDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Uredi
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteCategory(category.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Izbriši
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Suppliers Management Tab */}
          {userRole === "admin" && (
            <TabsContent value="suppliers" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Dobavitelji</CardTitle>
                      <CardDescription>
                        Upravljajte z dobavitelji klubske opreme
                      </CardDescription>
                    </div>
                    {userRole === "admin" && (
                      <Button onClick={() => setIsSupplierDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nov dobavitelj
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naziv</TableHead>
                        <TableHead>Kontaktna oseba</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppliers.map((supplier) => (
                        <TableRow key={supplier.id}>
                          <TableCell className="font-medium">{supplier.name}</TableCell>
                          <TableCell>{supplier.contact_person || "-"}</TableCell>
                          <TableCell>{supplier.email || "-"}</TableCell>
                          <TableCell>{supplier.phone || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {userRole === "admin" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingSupplier(supplier);
                                      setIsSupplierDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Uredi
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteSupplier(supplier.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Izbriši
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Collections Management Tab */}
          {userRole === "admin" && (
            <TabsContent value="collections" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Zbirniki naročil</CardTitle>
                      <CardDescription>
                        Ustvarjajte in upravljajte zbirnike naročil
                      </CardDescription>
                    </div>
                    {userRole === "admin" && (
                      <Button onClick={() => setIsCollectionDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nov zbirnik
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-4">
                    Odprtih naročil: {myOrders.filter(o => o.status === "open").length}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Številka</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Število naročil</TableHead>
                        <TableHead>Opombe</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collections.map((collection) => (
                        <TableRow key={collection.id}>
                          <TableCell className="font-medium">{collection.collection_number}</TableCell>
                          <TableCell>
                            <Badge>{collection.status}</Badge>
                          </TableCell>
                          <TableCell>{collection.total_orders || 0}</TableCell>
                          <TableCell>{collection.notes || "-"}</TableCell>
                          <TableCell>
                            {new Date(collection.created_at).toLocaleDateString("sl-SI")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openCollectionView(collection)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Poglej
                              </Button>
                              {userRole === "admin" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingCollection(collection as StoreCollection);
                                      setCollectionFormData({
                                        collection_number: collection.collection_number,
                                        collection_date: collection.collection_date || new Date().toISOString().split("T")[0],
                                        status: collection.status,
                                        notes: collection.notes || "",
                                      });
                                      setIsCollectionDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Uredi
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteCollection(collection.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Izbriši
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Reports Tab */}
          {userRole === "admin" && (
            <TabsContent value="reports" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Poročila</CardTitle>
                  <CardDescription>Statistika in poročila</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">Skupaj naročil</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{stats.totalOrders}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">Skupni prihodek</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">
                            {stats.totalRevenue.toFixed(2)} €
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">Povprečno naročilo</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">
                            {stats.avgOrderValue.toFixed(2)} €
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Cart Dialog */}
      {(userRole === "parent" || userRole === "coach") && (
        <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Košarica</DialogTitle>
              <DialogDescription>
                Pregled artiklov v košarici
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Košarica je prazna
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={`${item.item_id}-${item.size}`}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{item.item_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Velikost: {item.size} | Cena: {item.item_price.toFixed(2)} €
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateCartQuantity(item.item_id, item.size, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateCartQuantity(item.item_id, item.size, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(item.item_id, item.size)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Izberite otroka</Label>
                      <Select value={selectedChild} onValueChange={setSelectedChild}>
                        <SelectTrigger>
                          <SelectValue placeholder="Izberite otroka" />
                        </SelectTrigger>
                        <SelectContent>
                          {children.map((child) => (
                            <SelectItem key={child.id} value={child.id}>
                              {child.first_name} {child.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Obdobje prevzema</Label>
                      <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger>
                          <SelectValue placeholder="Izberite obdobje" />
                        </SelectTrigger>
                        <SelectContent>
                          {periods.map((period) => (
                            <SelectItem key={period.id} value={period.id}>
                              {new Date(period.period_date).toLocaleDateString("sl-SI")}
                              {period.notes && ` - ${period.notes}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="font-semibold">Skupaj:</span>
                      <span className="text-2xl font-bold">
                        {cart
                          .reduce((sum, item) => sum + item.item_price * item.quantity, 0)
                          .toFixed(2)}{" "}
                        €
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCartOpen(false)}>
                Zapri
              </Button>
              {cart.length > 0 && (
                <Button onClick={submitOrder}>Oddaj naročilo</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Items Detail Dialog */}
      <Dialog open={isItemsDialogOpen} onOpenChange={setIsItemsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Postavke naročila</DialogTitle>
            <DialogDescription>
              Pregled vseh artiklov v naročilu
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Šifra</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead>Velikost</TableHead>
                  <TableHead>Količina</TableHead>
                  <TableHead>Cena/kos</TableHead>
                  <TableHead>Skupaj</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedOrderItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.item_number}</TableCell>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell>N/A</TableCell>
                    <TableCell>{item.size}</TableCell>
                    <TableCell>{item.unit_price.toFixed(2)} €</TableCell>
                    <TableCell className="font-semibold">
                      {(item.unit_price * item.quantity).toFixed(2)} €
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsItemsDialogOpen(false)}>Zapri</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Status Dialog */}
      <Dialog open={isEditStatusDialogOpen} onOpenChange={setIsEditStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uredi status naročila</DialogTitle>
            <DialogDescription>
              Spremeni status naročila {editingOrder?.order_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Trenutni status</Label>
              <div>
                <Badge variant="outline">
                  {ORDER_STATUSES.find(s => s.value === editingOrder?.status)?.label || editingOrder?.status}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Nov status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Izberi status" />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newStatus === "naročeno" && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-900">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                Status "naročeno" pomeni, da je bil zbirnik poslan dobavitelju.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditStatusDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={updateOrderStatus} disabled={!newStatus || newStatus === editingOrder?.status}>
              Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Article Dialog */}
      <Dialog open={isArticleDialogOpen} onOpenChange={setIsArticleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingArticle ? "Uredi artikel" : "Nov artikel"}
            </DialogTitle>
            <DialogDescription>
              {editingArticle 
                ? "Posodobite podatke o artiklu" 
                : "Ustvarite nov artikel v trgovini"}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-1">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="item_number">Šifra artikla</Label>
                  <Input
                    id="item_number"
                    value={articleFormData.item_number}
                    onChange={(e) => setArticleFormData({ ...articleFormData, item_number: e.target.value })}
                    placeholder="npr. TS-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Cena (€)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={articleFormData.price}
                    onChange={(e) => setArticleFormData({ ...articleFormData, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Naziv</Label>
                <Input
                  id="name"
                  value={articleFormData.name}
                  onChange={(e) => setArticleFormData({ ...articleFormData, name: e.target.value })}
                  placeholder="npr. Klubska majica"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Opis</Label>
                <Textarea
                  id="description"
                  value={articleFormData.description}
                  onChange={(e) => setArticleFormData({ ...articleFormData, description: e.target.value })}
                  placeholder="Podrobnejši opis artikla..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Kategorija</Label>
                <Select
                  value={articleFormData.category}
                  onValueChange={(value) => setArticleFormData({ ...articleFormData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izberi kategorijo" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier">Dobavitelj</Label>
                <Select
                  value={articleFormData.supplier_id || "none"}
                  onValueChange={(value) => setArticleFormData({ ...articleFormData, supplier_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izberi dobavitelja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brez dobavitelja</SelectItem>
                    {suppliers.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Razpoložljive velikosti</Label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_SIZES.map((size) => (
                    <div key={size} className="flex items-center space-x-2">
                      <Checkbox
                        id={`size-${size}`}
                        checked={articleFormData.available_sizes.includes(size)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setArticleFormData({
                              ...articleFormData,
                              available_sizes: [...articleFormData.available_sizes, size],
                            });
                          } else {
                            setArticleFormData({
                              ...articleFormData,
                              available_sizes: articleFormData.available_sizes.filter((s) => s !== size),
                            });
                          }
                        }}
                      />
                      <Label htmlFor={`size-${size}`} className="text-sm font-normal">
                        {size}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Slika artikla</Label>
                {articleFormData.image_url ? (
                  <div className="space-y-2">
                    <img 
                      src={articleFormData.image_url} 
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-md border"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={deleteArticleImage}
                        className="flex-1"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Izbriši sliko
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("image-upload")?.click()}
                        disabled={uploadingImage}
                        className="flex-1"
                      >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Zamenjaj sliko
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-md p-6 text-center">
                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Naložite sliko artikla (PNG, JPG, WebP, GIF)
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("image-upload")?.click()}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? "Nalaganje..." : "Izberi sliko"}
                    </Button>
                  </div>
                )}
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="external_link">Zunanja povezava</Label>
                <Input
                  id="external_link"
                  value={articleFormData.external_link}
                  onChange={(e) => setArticleFormData({ ...articleFormData, external_link: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsArticleDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={saveArticle}>
              {editingArticle ? "Posodobi" : "Ustvari"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Uredi kategorijo" : "Nova kategorija"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory 
                ? "Posodobite podatke o kategoriji" 
                : "Ustvarite novo kategorijo"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cat_name">Naziv</Label>
              <Input
                id="cat_name"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                placeholder="npr. Majice"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat_description">Opis</Label>
              <Textarea
                id="cat_description"
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                placeholder="Opis kategorije..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={saveCategory}>
              {editingCategory ? "Posodobi" : "Ustvari"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collection Dialog */}
      <Dialog open={isCollectionDialogOpen} onOpenChange={setIsCollectionDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nov zbirnik</DialogTitle>
            <DialogDescription>
              Izberite odprta naročila za zbirnik
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-1">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="collection_number">Številka zbirnika</Label>
                  <Input
                    id="collection_number"
                    value={collectionFormData.collection_number}
                    onChange={(e) => setCollectionFormData({ ...collectionFormData, collection_number: e.target.value })}
                    placeholder="npr. ZBR-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collection_notes">Opombe</Label>
                  <Input
                    id="collection_notes"
                    value={collectionFormData.notes}
                    onChange={(e) => setCollectionFormData({ ...collectionFormData, notes: e.target.value })}
                    placeholder="Dodatne opombe..."
                  />
                </div>
              </div>
              <div className="border rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium">
                    Odprta naročila ({myOrders.filter(o => o.status === "open").length})
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={
                        myOrders.filter(o => o.status === "open").length > 0 &&
                        selectedOrdersForCollection.size === myOrders.filter(o => o.status === "open").length
                      }
                      onCheckedChange={toggleSelectAllOrders}
                    />
                    <Label htmlFor="select-all" className="text-sm font-normal cursor-pointer">
                      Izberi vse
                    </Label>
                  </div>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {myOrders
                    .filter(o => o.status === "open")
                    .map((order) => {
                      const items = orderItems[order.id] || [];
                      return (
                        <div
                          key={order.id}
                          className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleOrderSelection(order.id)}
                        >
                          <Checkbox
                            checked={selectedOrdersForCollection.has(order.id)}
                            onCheckedChange={() => toggleOrderSelection(order.id)}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{order.order_number}</div>
                            <div className="text-sm text-muted-foreground">
                              {items.length} postavk • {order.total_amount.toFixed(2)} €
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Izbrano: {selectedOrdersForCollection.size} naročil
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsCollectionDialogOpen(false)}>
              Prekliči
            </Button>
            <Button 
              onClick={createCollection}
              disabled={selectedOrdersForCollection.size === 0}
            >
              Ustvari zbirnik
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Dialog */}
      <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Uredi dobavitelja" : "Nov dobavitelj"}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier 
                ? "Posodobite podatke o dobavitelju" 
                : "Ustvarite novega dobavitelja"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_name">Naziv</Label>
              <Input
                id="supplier_name"
                value={supplierFormData.name}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                placeholder="npr. Športna Oprema d.o.o."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_person">Kontaktna oseba</Label>
              <Input
                id="contact_person"
                value={supplierFormData.contact_person}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, contact_person: e.target.value })}
                placeholder="Ime in priimek"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier_email">Email</Label>
                <Input
                  id="supplier_email"
                  type="email"
                  value={supplierFormData.email}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                  placeholder="info@dobavitelj.si"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier_phone">Telefon</Label>
                <Input
                  id="supplier_phone"
                  value={supplierFormData.phone}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                  placeholder="+386 XX XXX XXX"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier_notes">Opombe</Label>
              <Textarea
                id="supplier_notes"
                value={supplierFormData.notes}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, notes: e.target.value })}
                placeholder="Dodatne informacije..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSupplierDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={saveSupplier}>
              {editingSupplier ? "Posodobi" : "Ustvari"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collection View Dialog */}
      <Dialog open={isCollectionViewDialogOpen} onOpenChange={setIsCollectionViewDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Zbirnik {viewingCollection?.collection_number}</DialogTitle>
            <DialogDescription>
              Pregled in urejanje zbirnika
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select value={editingCollectionStatus} onValueChange={setEditingCollectionStatus}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Osnutek</SelectItem>
                        <SelectItem value="ordered">Naročeno</SelectItem>
                        <SelectItem value="received">Prejeto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editingCollectionStatus !== viewingCollection?.status && (
                    <Button onClick={updateCollectionStatus} className="mt-6">
                      Posodobi status
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={copyCollectionItems}>
                    Kopiraj
                  </Button>
                  <Button variant="outline" onClick={exportCollectionToExcel}>
                    Excel izvoz
                  </Button>
                </div>
              </div>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Šifra</TableHead>
                      <TableHead>Naziv</TableHead>
                      <TableHead>Dobavitelj</TableHead>
                      <TableHead>Velikost</TableHead>
                      <TableHead>Količina</TableHead>
                      <TableHead>Cena/kos</TableHead>
                      <TableHead>Skupaj</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collectionItems.length > 0 ? (
                      <>
                        {collectionItems
                          .slice()
                          .sort((a, b) => a.item_number.localeCompare(b.item_number))
                          .map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono">{item.item_number}</TableCell>
                              <TableCell>{item.item_name}</TableCell>
                              <TableCell>{item.store_items?.store_suppliers?.name || "N/A"}</TableCell>
                              <TableCell>{item.size}</TableCell>
                              <TableCell>{item.total_quantity}</TableCell>
                              <TableCell>{item.unit_price.toFixed(2)} €</TableCell>
                              <TableCell className="font-semibold">
                                {(item.total_quantity * item.unit_price).toFixed(2)} €
                              </TableCell>
                            </TableRow>
                          ))}
                        <TableRow className="font-semibold bg-muted/50">
                          <TableCell colSpan={4}>SKUPAJ</TableCell>
                          <TableCell>
                            {collectionItems.reduce((sum, item) => sum + item.total_quantity, 0)}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            {collectionItems
                              .reduce((sum, item) => sum + item.total_quantity * item.unit_price, 0)
                              .toFixed(2)}{" "}
                            €
                          </TableCell>
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Ni postavk v zbirniku
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button onClick={() => setIsCollectionViewDialogOpen(false)}>
              Zapri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Cart Dialog */}
      <Dialog open={isCartDialogOpen && selectedItemForCart !== null} onOpenChange={(open) => {
        if (!open) setSelectedItemForCart(null);
        setIsCartDialogOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj v košarico</DialogTitle>
            <DialogDescription>
              {selectedItemForCart?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cena:</span>
              <span className="text-lg font-bold">{selectedItemForCart?.price.toFixed(2)} €</span>
            </div>
            {selectedItemForCart && Array.isArray(selectedItemForCart.available_sizes) && selectedItemForCart.available_sizes.length > 0 && (
              <div className="space-y-2">
                <Label>Velikost *</Label>
                <Select value={selectedSize} onValueChange={setSelectedSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izberite velikost" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedItemForCart.available_sizes.map((size: string) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Količina</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  -
                </Button>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  +
                </Button>
              </div>
            </div>
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Skupaj:</span>
                <span>{((selectedItemForCart?.price || 0) * quantity).toFixed(2)} €</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCartDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={addToCart}>
              Dodaj v košarico
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shopping Cart Dialog */}
      <Dialog open={isCartDialogOpen && selectedItemForCart === null} onOpenChange={setIsCartDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Košarica</DialogTitle>
            <DialogDescription>
              Preglejte in oddajte naročilo
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-1">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Košarica je prazna
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  {cart.map((item, index) => (
                    <div key={`${item.item_id}-${item.size}`} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{item.item_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.item_number} • Velikost: {item.size}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateCartQuantity(item.item_id, item.size, item.quantity - 1)}
                        >
                          -
                        </Button>
                        <span className="w-12 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateCartQuantity(item.item_id, item.size, item.quantity + 1)}
                        >
                          +
                        </Button>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <div className="text-sm text-muted-foreground">{item.item_price.toFixed(2)} € / kos</div>
                        <div className="font-semibold">{(item.quantity * item.item_price).toFixed(2)} €</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.item_id, item.size)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="delivery_address">Naslov dostave *</Label>
                    <Textarea
                      id="delivery_address"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Vnesite popoln naslov dostave..."
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xl font-bold pt-2">
                    <span>Skupaj:</span>
                    <span>
                      {cart.reduce((sum, item) => sum + item.quantity * item.item_price, 0).toFixed(2)} €
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsCartDialogOpen(false)}>
              Nadaljuj z nakupovanjem
            </Button>
            <Button 
              onClick={submitOrder}
              disabled={cart.length === 0 || !deliveryAddress.trim()}
            >
              Oddaj naročilo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}