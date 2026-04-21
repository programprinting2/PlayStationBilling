import React, { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Package,
  Edit,
  Trash2,
  RefreshCw,
  ChevronRight,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Copy,
  XCircle,
  X,
  Minus,
} from "lucide-react";
import { db, supabase } from "../lib/supabase";
import Swal from "sweetalert2";
import PurchaseFilters from "./PurchaseFilters";

const Pembelian: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"purchases" | "purchaseList" | "stock">("purchases");
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const [editingPoId, setEditingPoId] = useState<string | null>(null);
  
  const [newPurchase, setNewPurchase] = useState({
    supplierId: "",
    items: [] as Array<{
      id?: string;
      productId: string;
      productName: string;
      quantity: number;
      unitCost: number;
      total: number;
    }>,
    notes: "",
    expectedDate: new Date().toISOString().split("T")[0],
    orderDate: new Date().toISOString(),
  });

  const [purchaseTotal, setPurchaseTotal] = useState(0);
  const [purchaseSubtotal, setPurchaseSubtotal] = useState(0);

  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 10;

  const [poDetail, setPoDetail] = useState<any | null>(null);
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);
  const [expandedRekapDate, setExpandedRekapDate] = useState<string | null>(null);
  const [expandedRekapPerBarang, setExpandedRekapPerBarang] = useState<string | null>(null);

  const [purchaseTabView, setPurchaseTabView] = useState<"daftar" | "rekapTanggalBarang" | "rekapPerBarang">("daftar");
  const [daftarSearch, setDaftarSearch] = useState("");
  const [daftarPeriod, setDaftarPeriod] = useState<string>("week");
  const [daftarDateRange, setDaftarDateRange] = useState({ start: "", end: "" });

  const [rekapTanggalSearch, setRekapTanggalSearch] = useState("");
  const [rekapTanggalPeriod, setRekapTanggalPeriod] = useState<string>("week");
  const [rekapTanggalDateRange, setRekapTanggalDateRange] = useState({ start: "", end: "" });

  const [rekapPerBarangSearch, setRekapPerBarangSearch] = useState("");
  const [rekapPerBarangPeriod, setRekapPerBarangPeriod] = useState<string>("week");
  const [rekapPerBarangDateRange, setRekapPerBarangDateRange] = useState({ start: "", end: "" });

  const [rekapTanggalData, setRekapTanggalData] = useState<Record<string, any>>({});
  const [rekapTanggalLoading, setRekapTanggalLoading] = useState(false);
  const [rekapTanggalError, setRekapTanggalError] = useState<string | null>(null);

  const [rekapPerBarangData, setRekapPerBarangData] = useState<Record<string, any>>({});
  const [rekapPerBarangLoading, setRekapPerBarangLoading] = useState(false);
  const [rekapPerBarangError, setRekapPerBarangError] = useState<string | null>(null);

  const [showSupplierSelectModal, setShowSupplierSelectModal] = useState(false);
  const [showProductSelectModal, setShowProductSelectModal] = useState<{ open: boolean; index: number | null }>({ open: false, index: null });
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  
  const [stockLoacingData, setStockLoadingData] = useState(false);
  const [stockSortBy, setStockSortBy] = useState<string | null>(null);
  const [stockSortOrder, setStockSortOrder] = useState<"asc" | "desc">("asc");
  const [stockGroupBy, setStockGroupBy] = useState<"none" | "category" | "product_type">("none");
  const [expandedStockGroups, setExpandedStockGroups] = useState<Record<string, boolean>>({});
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategoryFilter, setStockCategoryFilter] = useState("");
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
  const [showSelectedStockModal, setShowSelectedStockModal] = useState(false);
  const [showStockReductionForm, setShowStockReductionForm] = useState(false);
  const [showProductSelectForStockReduction, setShowProductSelectForStockReduction] = useState(false);
  const [stockReductionProductSearchTerm, setStockReductionProductSearchTerm] = useState("");
  const [stockReductionForm, setStockReductionForm] = useState({
    product_id: "",
    quantity: 1,
    notes: "",
  });
  const [showStockCard, setShowStockCard] = useState(false);
  const [stockCardProduct, setStockCardProduct] = useState<any | null>(null);
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [stockHistoryLoading, setStockHistoryLoading] = useState(false);
  const [stockHistoryError, setStockHistoryError] = useState<string | null>(null);
  const [stockHistoryPage, setStockHistoryPage] = useState(0);
  const STOCK_HISTORY_PAGE_SIZE = 10;

  // Fetch Data
  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    fetchPurchaseOrders();
  }, []);

  const fetchProducts = async () => {
    const data = await db.products.getAll();
    setProducts(data || []);
  };

  const fetchSuppliers = async () => {
    const data = await db.suppliers.getAll();
    setSuppliers(data || []);
  };

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('order_date', { ascending: false });
      
      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (error: any) {
      console.error("Gagal memuat PO:", error.message);
    }
  };

  useEffect(() => {
    if ((window as any)) {
      (window as any).refreshPurchases = fetchPurchaseOrders;
    }
  }, []);

  // Update totals when items change
  useEffect(() => {
    const subtotal = newPurchase.items.reduce((sum, item) => sum + item.total, 0);
    setPurchaseSubtotal(subtotal);
    setPurchaseTotal(subtotal);
  }, [newPurchase.items]);

  // Load Rekap data
  useEffect(() => {
    const loadRekapTanggal = async () => {
      if (purchaseTabView !== "rekapTanggalBarang") return;
      setRekapTanggalLoading(true);
      setRekapTanggalError(null);
      try {
        let start: string | null = null;
        let end: string | null = null;
        const now = new Date();
        switch (rekapTanggalPeriod) {
          case "today":
            start = now.toISOString().slice(0, 10);
            end = now.toISOString().slice(0, 10);
            break;
          case "yesterday":
            const yest = new Date();
            yest.setDate(yest.getDate() - 1);
            start = yest.toISOString().slice(0, 10);
            end = yest.toISOString().slice(0, 10);
            break;
          case "week":
            const d = now.getDay();
            const diff = (d === 0 ? -6 : 1) - d;
            const s = new Date(now);
            s.setDate(s.getDate() + diff);
            start = s.toISOString().slice(0, 10);
            end = now.toISOString().slice(0, 10);
            break;
          case "month":
            start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
            break;
          case "range":
            if (rekapTanggalDateRange.start) start = rekapTanggalDateRange.start;
            if (rekapTanggalDateRange.end) end = rekapTanggalDateRange.end;
            break;
        }

        let query = supabase.from("purchase_orders").select("*");
        if (start) query = query.gte("order_date", start);
        if (end) query = query.lte("order_date", end);
        const { data: pos, error } = await query.order("order_date", { ascending: false });
        if (error) throw error;

        let filteredPos = pos || [];
        if (rekapTanggalSearch) {
          const st = rekapTanggalSearch.toLowerCase();
          const { data: supMatches } = await supabase.from("suppliers").select("id").ilike("name", `%${st}%`);
          const supplierIds = (supMatches || []).map((s: any) => s.id);
          filteredPos = filteredPos.filter((p: any) => p.po_number?.toLowerCase().includes(st) || supplierIds.includes(p.supplier_id));
        }

        const poIds = filteredPos.map((p: any) => p.id);
        let items: any[] = [];
        if (poIds.length > 0) {
          const { data, error: err2 } = await supabase.from("purchase_order_items").select("*").in("po_id", poIds);
          if (err2) throw err2;
          items = data || [];
        }

        const map: Record<string, any> = {};
        for (const item of items) {
          const po = filteredPos.find((p: any) => p.id === item.po_id);
          const date = po.order_date ? po.order_date.slice(0, 10) : "unknown";
          if (!map[date]) map[date] = { products: {}, dateTotal: 0 };
          
          const productId = item.product_id;
          const productName = item.product_name || products.find(p => p.id === productId)?.name || "Unknown";
          const qty = Number(item.quantity) || 0;
          const total = Number(item.total) || 0;

          if (!map[date].products[productId || productName]) {
            map[date].products[productId || productName] = { name: productName, qty: 0, total: 0, lines: [] };
          }
          const pEntry = map[date].products[productId || productName];
          pEntry.qty += qty;
          pEntry.total += total;
          pEntry.lines.push({ poId: item.po_id, qty, total, supplierName: suppliers.find(s => s.id === po.supplier_id)?.name || "" });
          map[date].dateTotal += total;
        }
        setRekapTanggalData(map);
      } catch (err: any) {
        setRekapTanggalError(err.message);
      } finally {
        setRekapTanggalLoading(false);
      }
    };
    loadRekapTanggal();
  }, [purchaseTabView, rekapTanggalPeriod, rekapTanggalDateRange, rekapTanggalSearch]);

  useEffect(() => {
    const loadRekapPerBarang = async () => {
      if (purchaseTabView !== "rekapPerBarang") return;
      setRekapPerBarangLoading(true);
      setRekapPerBarangError(null);
      try {
        let start: string | null = null;
        let end: string | null = null;
        const now = new Date();
        switch (rekapPerBarangPeriod) {
          case "today":
            start = now.toISOString().slice(0, 10);
            end = now.toISOString().slice(0, 10);
            break;
          case "yesterday":
            const yest = new Date();
            yest.setDate(yest.getDate() - 1);
            start = yest.toISOString().slice(0, 10);
            end = yest.toISOString().slice(0, 10);
            break;
          case "week":
            const d = now.getDay();
            const diff = (d === 0 ? -6 : 1) - d;
            const s = new Date(now);
            s.setDate(s.getDate() + diff);
            start = s.toISOString().slice(0, 10);
            end = now.toISOString().slice(0, 10);
            break;
          case "month":
            start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
            break;
          case "range":
            if (rekapPerBarangDateRange.start) start = rekapPerBarangDateRange.start;
            if (rekapPerBarangDateRange.end) end = rekapPerBarangDateRange.end;
            break;
        }

        let query = supabase.from("purchase_orders").select("*");
        if (start) query = query.gte("order_date", start);
        if (end) query = query.lte("order_date", end);
        const { data: pos, error } = await query.order("order_date", { ascending: false });
        if (error) throw error;

        let filteredPos = pos || [];
        if (rekapPerBarangSearch) {
          const st = rekapPerBarangSearch.toLowerCase();
          const { data: supMatches } = await supabase.from("suppliers").select("id").ilike("name", `%${st}%`);
          const supplierIds = (supMatches || []).map((s: any) => s.id);
          filteredPos = filteredPos.filter((p: any) => p.po_number?.toLowerCase().includes(st) || supplierIds.includes(p.supplier_id));
        }

        const poIds = filteredPos.map((p: any) => p.id);
        let items: any[] = [];
        if (poIds.length > 0) {
          const { data, error: err2 } = await supabase.from("purchase_order_items").select("*").in("po_id", poIds);
          if (err2) throw err2;
          items = data || [];
        }

        const map: Record<string, any> = {};
        for (const item of items) {
          const po = filteredPos.find((p: any) => p.id === item.po_id);
          const productId = item.product_id;
          const productName = item.product_name || products.find(p => p.id === productId)?.name || "Unknown";
          const qty = Number(item.quantity) || 0;
          const total = Number(item.total) || 0;

          if (!map[productId || productName]) {
            map[productId || productName] = { name: productName, qty: 0, total: 0, dates: {} };
          }
          const pEntry = map[productId || productName];
          pEntry.qty += qty;
          pEntry.total += total;
          
          const date = po.order_date ? po.order_date.slice(0, 10) : "unknown";
          if (!pEntry.dates[date]) pEntry.dates[date] = { qty: 0, total: 0, pos: [] };
          pEntry.dates[date].qty += qty;
          pEntry.dates[date].total += total;
          pEntry.dates[date].pos.push({
            poId: item.po_id,
            poNumber: po.po_number,
            supplierName: suppliers.find(s => s.id === po.supplier_id)?.name || "",
            qty,
            total,
            date,
          });
        }
        setRekapPerBarangData(map);
      } catch (err: any) {
        setRekapPerBarangError(err.message);
      } finally {
        setRekapPerBarangLoading(false);
      }
    };
    loadRekapPerBarang();
  }, [purchaseTabView, rekapPerBarangPeriod, rekapPerBarangDateRange, rekapPerBarangSearch]);

  const addItemToPurchase = () => {
    setNewPurchase(prev => ({
      ...prev,
      items: [...prev.items, { productId: "", productName: "", quantity: 1, unitCost: 0, total: 0 }]
    }));
  };

  const updatePurchaseItem = (index: number, field: string, value: any) => {
    setNewPurchase(prev => {
      const items = [...prev.items];
      const item = { ...items[index] };
      (item as any)[field] = value;
      if (field === "productId") {
        const p = products.find(prod => prod.id === value);
        if (p) {
          item.productName = p.name;
          item.unitCost = p.cost;
          item.total = item.quantity * p.cost;
        }
      }
      if (field === "quantity" || field === "unitCost") {
        item.total = item.quantity * item.unitCost;
      }
      items[index] = item;
      return { ...prev, items };
    });
  };

  const removePurchaseItem = (index: number) => {
    setNewPurchase(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSavePurchase = async () => {
    if (!newPurchase.supplierId) {
      Swal.fire("Error", "Pilih supplier terlebih dahulu", "error");
      return;
    }
    if (newPurchase.items.length === 0) {
      Swal.fire("Error", "Tambah minimal satu item", "error");
      return;
    }

    setIsSavingPurchase(true);
    try {
      let poId: string;
      let poData: any;

      if (editingPoId) {
        poData = await db.purchases.update(editingPoId, {
          supplier_id: newPurchase.supplierId,
          items: newPurchase.items,
          notes: newPurchase.notes,
          expected_date: newPurchase.expectedDate,
          order_date: newPurchase.orderDate,
          subtotal: purchaseSubtotal,
          total_amount: purchaseTotal,
        });
        poId = editingPoId;
      } else {
        poData = await db.purchases.create({
          supplier_id: newPurchase.supplierId,
          items: newPurchase.items,
          notes: newPurchase.notes,
          expected_date: newPurchase.expectedDate,
          order_date: newPurchase.orderDate,
          subtotal: purchaseSubtotal,
          total_amount: purchaseTotal,
        });
        poId = poData.id;
      }

      // Sync with bookkeeping
      const reference = `PO-${poId}`;
      const supplier = suppliers.find(s => s.id === newPurchase.supplierId);
      const { data: existing } = await supabase.from("bookkeeping_entries").select("id").eq("reference", reference).single();
      
      const bookkeepingData = {
        entry_date: newPurchase.orderDate.split("T")[0],
        type: "expense",
        category: "inventory",
        description: `Purchase Order - ${supplier?.name || "Unknown"}`,
        amount: purchaseTotal,
        reference: reference,
        notes: `${poData.po_number || poId}${newPurchase.notes ? ` - ${newPurchase.notes}` : ""}`,
      };

      if (existing) {
        await supabase.from("bookkeeping_entries").update(bookkeepingData).eq("id", existing.id);
      } else {
        await supabase.from("bookkeeping_entries").insert([bookkeepingData]);
      }

      Swal.fire("Berhasil", "Purchase Order berhasil disimpan", "success");
      setShowPurchaseForm(false);
      setEditingPoId(null);
      setNewPurchase({
        supplierId: "",
        items: [],
        notes: "",
        expectedDate: new Date().toISOString().split("T")[0],
        orderDate: new Date().toISOString(),
      });
      fetchPurchaseOrders();
    } catch (err: any) {
      Swal.fire("Gagal", err.message, "error");
    } finally {
      setIsSavingPurchase(false);
    }
  };

  const openPoDetail = async (po: any) => {
    try {
      const { data: items } = await supabase.from("purchase_order_items").select("*").eq("po_id", po.id);
      setPoDetail({ ...po, items: items || [] });
      setExpandedPoId(expandedPoId === po.id ? null : po.id);
    } catch (err: any) {
      Swal.fire("Error", "Gagal memuat detail", "error");
    }
  };

  const handleDeletePo = async (po: any) => {
    const res = await Swal.fire({
      title: "Hapus Purchase Order?",
      text: "Data PO dan item-itemnya akan dihapus permanen. Stok akan dikembalikan ke sistem.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal"
    });

    if (res.isConfirmed) {
      try {
        await db.purchases.delete(po.id);
        fetchPurchaseOrders();
        Swal.fire("Dihapus", "Purchase Order berhasil dihapus", "success");
      } catch (err: any) {
        Swal.fire("Gagal", err.message, "error");
      }
    }
  };

  const filteredSuppliersForModal = suppliers.filter(s => s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase()));
  const filteredProductsForModal = products.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()));
  const filteredProductsForStockReduction = products.filter((p) => {
    const term = stockReductionProductSearchTerm.trim().toLowerCase();
    if (!term) return true;
    const byName = (p.name || "").toLowerCase().includes(term);
    const byCat = (p.category || "").toLowerCase().includes(term);
    const byBarcode = (p.barcode || "").toLowerCase().includes(term);
    return byName || byCat || byBarcode;
  });

  const handleStockSort = (columnKey: string) => {
    if (stockSortBy === columnKey) {
      setStockSortOrder(stockSortOrder === "asc" ? "desc" : "asc");
    } else {
      setStockSortBy(columnKey);
      setStockSortOrder("asc");
    }
  };

  const getSortedProducts = () => {
    let filtered = products;

    // Filter by search term
    if (stockSearch) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(stockSearch.toLowerCase())
      );
    }

    // Filter by category
    if (stockCategoryFilter) {
      filtered = filtered.filter(p => p.category === stockCategoryFilter);
    }

    if (!stockSortBy) return filtered;
    
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any = a[stockSortBy as keyof typeof a];
      let bValue: any = b[stockSortBy as keyof typeof b];

      if (aValue === null || aValue === undefined) aValue = "";
      if (bValue === null || bValue === undefined) bValue = "";

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return stockSortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return stockSortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: string }) => (
    <button
      onClick={() => handleStockSort(sortKey)}
      className="flex items-center gap-2 hover:text-gray-900 transition-colors"
    >
      {label}
      {stockSortBy === sortKey && (
        stockSortOrder === "asc" ? <ArrowUp className="h-4 w-4 flex-shrink-0" /> : <ArrowDown className="h-4 w-4 flex-shrink-0" />
      )}
    </button>
  );

  const getStockProductId = (product: any) => String(product.id ?? "");
  const getVisibleStockProducts = () => getSortedProducts();
  const visibleStockProducts = getVisibleStockProducts();
  const groupedVisibleStockProducts: Record<string, any[]> =
    stockGroupBy === "none"
      ? {}
      : visibleStockProducts.reduce<Record<string, any[]>>((groups, product) => {
          const rawGroupValue =
            stockGroupBy === "category"
              ? product.category
              : product.product_type === "raw_material"
                ? "Bahan Baku"
                : product.product_type === "finished_good"
                  ? "Produk Jadi"
                  : product.product_type || "Tanpa Tipe";
          const groupKey = rawGroupValue || "Tanpa Kategori";

          if (!groups[groupKey]) groups[groupKey] = [];
          groups[groupKey].push(product);
          return groups;
        }, {});
  const groupedVisibleStockEntries: Array<[string, any[]]> = Object.entries(groupedVisibleStockProducts);
  const areAllStockSelected = visibleStockProducts.length > 0 && visibleStockProducts.every(p => selectedStockIds.includes(getStockProductId(p)));
  const selectedStockProducts = visibleStockProducts.filter(p => selectedStockIds.includes(getStockProductId(p)));
  const selectedStockProductsText = [
    "Daftar Barang Belanja",
    "===============",
    ...selectedStockProducts.map((product, index) => `${index + 1}. ${product.name}`),
  ].join("\n");

  const toggleSelectStock = (productId: string) => {
    setSelectedStockIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const toggleSelectAllStock = () => {
    const visibleIds = visibleStockProducts.map(getStockProductId);
    if (visibleIds.every(id => selectedStockIds.includes(id))) {
      setSelectedStockIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedStockIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleStockGroup = (groupName: string) => {
    setExpandedStockGroups((prev) => ({
      ...prev,
      [groupName]: prev[groupName] === false,
    }));
  };

  useEffect(() => {
    if (stockGroupBy === "none") {
      setExpandedStockGroups({});
      return;
    }

    setExpandedStockGroups((prev) => {
      const nextState: Record<string, boolean> = {};
      for (const [groupName] of groupedVisibleStockEntries) {
        nextState[groupName] = prev[groupName] ?? false;
      }
      return nextState;
    });
  }, [stockGroupBy, groupedVisibleStockEntries.length, stockSearch, stockCategoryFilter, stockSortBy, stockSortOrder]);

  const copySelectedStockToClipboard = async () => {
    const text = [
      "Daftar Barang Belanja",
      "===============",
      ...selectedStockProducts.map((product, index) => `${index + 1}. ${product.name}`),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      Swal.fire({
        icon: "success",
        title: "Tersalin",
        text: "Daftar barang telah disalin ke clipboard.",
        timer: 1300,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error(error);
      Swal.fire("Gagal", "Tidak dapat menyalin ke clipboard.", "error");
    }
  };

  const handleOpenStockCard = (product: any) => {
    setStockCardProduct(product);
    setShowStockCard(true);
    setStockHistoryPage(0);
    fetchStockHistory(product.id, product.stock).catch((e) => {
      console.error("fetchStockHistory error", e);
    });
  };

  const fetchStockHistory = async (productId: string, currentStock: number) => {
    setStockHistoryLoading(true);
    setStockHistoryError(null);
    setStockHistory([]);

    try {
      const rows: any[] = [];

      // 1) incoming: purchase_order_items
      try {
        const poItems = (await db.select("purchase_order_items", "*", {
          product_id: productId,
        })) as any[];
        if (Array.isArray(poItems) && poItems.length > 0) {
          for (const r of poItems as any[]) {
            const qty = Number(r.quantity ?? r.qty ?? r.qty_received ?? 0);
            rows.push({
              id: (r as any).id,
              product_id: productId,
              quantity: qty,
              note:
                (r as any).note ||
                (r as any).notes ||
                `PO:${(r as any).po_id || (r as any).po_number || ""}`,
              created_at:
                (r as any).created_at ||
                (r as any).inserted_at ||
                (r as any).timestamp ||
                new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        // ignore if table missing or error
      }

      // 2) outgoing: cashier_transactions
      try {
        const { data: txs, error } = await supabase
          .from("cashier_transactions")
          .select("*")
          .in("type", ["sale", "stock_reduction"]);

        if (error) throw error;
        if (Array.isArray(txs) && txs.length > 0) {
          for (const tx of txs as any[]) {
            let parsed: any = tx.details;
            if (!parsed && tx.details && typeof tx.details === "string") {
              try {
                parsed = JSON.parse(tx.details);
              } catch (e) {
                parsed = null;
              }
            }

            const candidates: any[] = [];
            if (Array.isArray(parsed)) candidates.push(...parsed);
            if (parsed && Array.isArray(parsed.items)) candidates.push(...parsed.items);
            if (parsed && Array.isArray(parsed.products)) candidates.push(...parsed.products);
            if (parsed && Array.isArray(parsed.cart)) candidates.push(...parsed.cart);
            if (candidates.length === 0 && parsed && typeof parsed === "object") {
              for (const v of Object.values(parsed)) {
                if (Array.isArray(v)) candidates.push(...v);
              }
            }

            for (const it of candidates) {
              const pid =
                (it as any).product_id ??
                (it as any).productId ??
                (it as any).id ??
                (it as any).item_id;
              if (!pid) continue;
              if (String(pid) === String(productId)) {
                const qty = Number(
                  (it as any).quantity ?? (it as any).qty ?? (it as any).q ?? 0
                );
                if (qty === 0) continue;
                rows.push({
                  id: (tx as any).id,
                  product_id: productId,
                  quantity: -Math.abs(qty),
                  note:
                    (tx as any).description ||
                    (tx as any).note ||
                    (tx as any).reference_id ||
                    (tx as any).details?.note ||
                    null,
                  created_at:
                    (tx as any).timestamp ||
                    (tx as any).created_at ||
                    (tx as any).inserted_at ||
                    new Date().toISOString(),
                });
              }
            }
          }
        }
      } catch (err) {
        // ignore if table missing or error
      }

      // 3) outgoing: assembly_logs
      try {
        const { data: assemblyLogs } = await supabase
          .from("assembly_logs")
          .select(`
          *,
          recipe:assembly_recipes(product_name)
        `);
        if (Array.isArray(assemblyLogs) && assemblyLogs.length > 0) {
          for (const log of assemblyLogs as any[]) {
            const ingredientsUsed = log.ingredients_used;
            if (Array.isArray(ingredientsUsed)) {
              for (const ingredient of ingredientsUsed) {
                const ingredientProductId =
                  ingredient.product_id || ingredient.productId;
                if (String(ingredientProductId) === String(productId)) {
                  const qty = Number(
                    ingredient.quantity_used || ingredient.quantityUsed || 0
                  );
                  if (qty === 0) continue;

                  rows.push({
                    id: `assembly_${log.id}_${ingredientProductId}`,
                    product_id: productId,
                    quantity: -Math.abs(qty),
                    note: `Assembly: ${
                      log.recipe?.product_name || `Recipe ID: ${log.recipe_id}`
                    }`,
                    created_at:
                      log.created_at ||
                      log.timestamp ||
                      new Date().toISOString(),
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        // ignore if table missing or error
      }

      // 4) stock opname adjustments
      try {
        const { data: opnameSessions } = await supabase
          .from("stock_opname_sessions")
          .select(`
            id,
            nomor,
            opname_date,
            created_at,
            stock_opname_items!inner(
              product_id,
              product_name,
              system_stock,
              physical_stock,
              unit_cost
            )
          `)
          .eq("stock_opname_items.product_id", productId);

        if (Array.isArray(opnameSessions) && opnameSessions.length > 0) {
          for (const session of opnameSessions as any[]) {
            const sessionItems = session.stock_opname_items || [];
            for (const item of sessionItems) {
              if (String(item.product_id) === String(productId)) {
                const adjustment =
                  Number(item.physical_stock || 0) -
                  Number(item.system_stock || 0);

                if (adjustment !== 0) {
                  rows.push({
                    id: `opname_${session.id}_${item.product_id}`,
                    product_id: productId,
                    quantity: adjustment,
                    note: `Opname: ${session.nomor || session.id} (${Number(
                      item.system_stock || 0
                    )} → ${Number(item.physical_stock || 0)})`,
                    created_at: session.created_at,
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        // ignore if table missing or error
      }

      if (rows.length === 0) {
        setStockHistory([]);
        setStockHistoryLoading(false);
        return;
      }

      rows.sort((a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const totalDelta = rows.reduce(
        (s: number, r: any) => s + Number(r.quantity || 0),
        0
      );
      const baseline = Number(currentStock || 0) - totalDelta;
      let running = baseline;
      const withBalance = rows.map((r: any) => {
        const qty = Number(r.quantity || 0);
        running = running + qty;
        return {
          ...r,
          _qty: qty,
          _balance: running,
        };
      });

      setStockHistory(withBalance);
    } catch (error: any) {
      setStockHistoryError(error?.message || String(error));
    } finally {
      setStockHistoryLoading(false);
    }
  };

  const filteredPurchaseOrdersForDaftar = purchaseOrders.filter(po => {
    // Hitung periode tanggal 
    let start: Date | null = null;
    let end: Date | null = null;
    const now = new Date();
    switch (daftarPeriod) {
      case "today": {
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "yesterday": {
        start = new Date();
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "week": {
        start = new Date();
        const day = start.getDay();
        const diff = (day === 0 ? -6 : 1) - day; 
        start.setDate(start.getDate() + diff);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "month": {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "range": {
        if (daftarDateRange.start) {
          start = new Date(daftarDateRange.start);
          start.setHours(0, 0, 0, 0);
        }
        if (daftarDateRange.end) {
          end = new Date(daftarDateRange.end);
          end.setHours(23, 59, 59, 999);
        }
        break;
      }
    }

    // Filter tanggal order
    let dateMatch = true;
    const orderDate = po.order_date ? new Date(po.order_date) : null;
    if (orderDate) {
      if (start && orderDate < start) dateMatch = false;
      if (end && orderDate > end) dateMatch = false;
    }

    // Filter search
    let searchMatch = true;
    if (daftarSearch) {
      const sup = suppliers.find(s => s.id === po.supplier_id);
      searchMatch = po.po_number?.toLowerCase().includes(daftarSearch.toLowerCase()) || 
                    sup?.name.toLowerCase().includes(daftarSearch.toLowerCase());
    }

    return dateMatch && searchMatch;
  });

  const daftarGrandTotal = filteredPurchaseOrdersForDaftar.reduce(
    (sum, po) => sum + Number(po.total_amount || 0),
    0,
  );
  const rekapTanggalGrandTotal = Object.values(rekapTanggalData).reduce(
    (sum, day: any) => sum + Number(day?.dateTotal || 0),
    0,
  );
  const rekapPerBarangGrandTotal = Object.values(rekapPerBarangData).reduce(
    (sum, product: any) => sum + Number(product?.total || 0),
    0,
  );

  const purchaseListSummary =
    purchaseTabView === "daftar"
      ? {
          countLabel: "Total Orders",
          countValue: filteredPurchaseOrdersForDaftar.length,
          grandTotal: daftarGrandTotal,
        }
      : purchaseTabView === "rekapTanggalBarang"
        ? {
            countLabel: "Total Tanggal",
            countValue: Object.keys(rekapTanggalData).length,
            grandTotal: rekapTanggalGrandTotal,
          }
        : {
            countLabel: "Total Barang",
            countValue: Object.keys(rekapPerBarangData).length,
            grandTotal: rekapPerBarangGrandTotal,
          };

  useEffect(() => {
    setHistoryPage(1);
  }, [daftarSearch, daftarPeriod, daftarDateRange.start, daftarDateRange.end]);

  const renderPurchasesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Purchase Orders</h2>
          <p className="text-gray-600">Buat dan kelola pesanan pembelian stok</p>
        </div>
        <button
          onClick={() => {
            setEditingPoId(null);
            setNewPurchase({
              supplierId: "",
              items: [],
              notes: "",
              expectedDate: new Date().toISOString().split("T")[0],
              orderDate: new Date().toISOString(),
            });
            setShowPurchaseForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Buat Purchase Order
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Orders</p>
            <h3 className="text-2xl font-bold text-gray-900">{filteredPurchaseOrdersForDaftar.length}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg text-green-600">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Grand Total Laporan</p>
            <h3 className="text-2xl font-bold text-gray-900">
              Rp {filteredPurchaseOrdersForDaftar
                .reduce((sum, po) => sum + Number(po.total_amount || 0), 0)
                .toLocaleString("id-ID")}
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Purchase History</h3>
            <button onClick={fetchPurchaseOrders} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
          <PurchaseFilters
            search={daftarSearch}
            onSearch={setDaftarSearch}
            period={daftarPeriod}
            onPeriodChange={setDaftarPeriod}
            dateRange={daftarDateRange}
            onDateRangeChange={setDaftarDateRange}
          />
        </div>
        <div className="overflow-x-auto">
           <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Rp.</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
                  const totalPages = Math.ceil(filteredPurchaseOrdersForDaftar.length / itemsPerPage);
                  const startIndex = (historyPage - 1) * itemsPerPage;
                  const currentOrders = filteredPurchaseOrdersForDaftar.slice(startIndex, startIndex + itemsPerPage);
                  
                  return currentOrders.map((po) => (
                    <React.Fragment key={po.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <button
                            onClick={() => openPoDetail(po)}
                            className="font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-2"
                          >
                            {po.po_number || po.id}
                            <ChevronRight className={`h-4 w-4 transform transition-transform ${expandedPoId === po.id ? 'rotate-90' : ''}`} />
                          </button>
                        </td>
                        <td className="px-6 py-4">{suppliers.find(s => s.id === po.supplier_id)?.name || "-"}</td>
                        <td className="px-6 py-4 text-gray-500">{new Date(po.order_date).toLocaleDateString("id-ID")}</td>
                        <td className="px-6 py-4 text-right font-semibold">Rp {Number(po.total_amount).toLocaleString("id-ID")}</td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => handleEditClick(po)} className="text-gray-400 hover:text-blue-600 p-1 mr-2">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeletePo(po)} className="text-gray-400 hover:text-red-600 p-1">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      {expandedPoId === po.id && poDetail && (
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                 <Package className="h-4 w-4 text-blue-500" /> Detail Barang
                              </h4>
                              <table className="min-w-full text-sm">
                                <thead className="text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                                  <tr className="border-b">
                                    <th className="text-left py-2">Produk</th>
                                    <th className="text-right py-2">Qty</th>
                                    <th className="text-right py-2">Harga</th>
                                    <th className="text-right py-2">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {poDetail.items.map((it: any) => (
                                    <tr key={it.id}>
                                      <td className="py-2">{it.product_name}</td>
                                      <td className="text-right py-2">{it.quantity}</td>
                                      <td className="text-right py-2">Rp {Number(it.unit_cost).toLocaleString()}</td>
                                      <td className="text-right py-2 font-medium">Rp {Number(it.total).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {poDetail.notes && (
                                <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                                   <span className="font-bold">Catatan:</span> {poDetail.notes}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ));
                })()}
              </tbody>
           </table>
        </div>
        
        {/* Pagination Controls */}
        {filteredPurchaseOrdersForDaftar.length > itemsPerPage && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{(historyPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(historyPage * itemsPerPage, filteredPurchaseOrdersForDaftar.length)}</span> of <span className="font-medium">{filteredPurchaseOrdersForDaftar.length}</span> results
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                disabled={historyPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-white"
              >
                Previous
              </button>
              <button
                onClick={() => setHistoryPage(prev => Math.min(Math.ceil(filteredPurchaseOrdersForDaftar.length / itemsPerPage), prev + 1))}
                disabled={historyPage >= Math.ceil(filteredPurchaseOrdersForDaftar.length / itemsPerPage)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-white"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderPurchaseListTab = () => (
    <div className="space-y-6">
      <div className="flex bg-white rounded-lg p-1 border shadow-sm w-fit">
        <button
          onClick={() => setPurchaseTabView("daftar")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${purchaseTabView === "daftar" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}
        >
          Daftar Pembelian
        </button>
        <button
          onClick={() => setPurchaseTabView("rekapTanggalBarang")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${purchaseTabView === "rekapTanggalBarang" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}
        >
          Rekap Per Tanggal
        </button>
        <button
          onClick={() => setPurchaseTabView("rekapPerBarang")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${purchaseTabView === "rekapPerBarang" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}
        >
          Rekap Per Barang
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">{purchaseListSummary.countLabel}</p>
            <h3 className="text-2xl font-bold text-gray-900">{purchaseListSummary.countValue}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg text-green-600">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Grand Total</p>
            <h3 className="text-2xl font-bold text-gray-900">
              Rp {purchaseListSummary.grandTotal.toLocaleString("id-ID")}
            </h3>
          </div>
        </div>
      </div>

      {purchaseTabView === "daftar" && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <PurchaseFilters search={daftarSearch} onSearch={setDaftarSearch} period={daftarPeriod} onPeriodChange={setDaftarPeriod} dateRange={daftarDateRange} onDateRangeChange={setDaftarDateRange} />
          <div className="mt-4 overflow-x-auto">
             <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">PO #</th>
                    <th className="px-4 py-2 text-left">Tanggal</th>
                    <th className="px-4 py-2 text-left">Supplier</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchaseOrdersForDaftar.map((po) => (
                    <React.Fragment key={po.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2">
                          <button
                            onClick={() => openPoDetail(po)}
                            className="font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-2"
                          >
                            {po.po_number || po.id}
                            <ChevronRight
                              className={`h-4 w-4 transform transition-transform ${expandedPoId === po.id ? "rotate-90" : ""}`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-2">{new Date(po.order_date).toLocaleDateString("id-ID")}</td>
                        <td className="px-4 py-2">{suppliers.find((s) => s.id === po.supplier_id)?.name || "-"}</td>
                        <td className="px-4 py-2 text-right font-medium">Rp {Number(po.total_amount).toLocaleString("id-ID")}</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleEditClick(po)}
                              className="text-blue-600 hover:bg-blue-50 p-1 rounded"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={async () => {
                                const res = await Swal.fire({
                                  title: "Hapus?",
                                  text: "Stok akan dikurangi!",
                                  icon: "warning",
                                  showCancelButton: true,
                                });
                                if (res.isConfirmed) {
                                  await db.purchases.delete(po.id);
                                  fetchPurchaseOrders();
                                  Swal.fire("Dihapus", "PO berhasil dihapus", "success");
                                }
                              }}
                              className="text-red-600 hover:bg-red-50 p-1 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedPoId === po.id && poDetail && (
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <Package className="h-4 w-4 text-blue-500" /> Detail Barang
                              </h4>
                              <table className="min-w-full text-sm">
                                <thead className="text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                                  <tr className="border-b">
                                    <th className="text-left py-2">Produk</th>
                                    <th className="text-right py-2">Qty</th>
                                    <th className="text-right py-2">Harga</th>
                                    <th className="text-right py-2">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {poDetail.items.map((it: any) => (
                                    <tr key={it.id}>
                                      <td className="py-2">{it.product_name}</td>
                                      <td className="text-right py-2">{it.quantity}</td>
                                      <td className="text-right py-2">Rp {Number(it.unit_cost).toLocaleString("id-ID")}</td>
                                      <td className="text-right py-2 font-medium">Rp {Number(it.total).toLocaleString("id-ID")}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {poDetail.notes && (
                                <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                                  <span className="font-bold">Catatan:</span> {poDetail.notes}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {purchaseTabView === "rekapTanggalBarang" && (
        <div className="space-y-4">
          <PurchaseFilters search={rekapTanggalSearch} onSearch={setRekapTanggalSearch} period={rekapTanggalPeriod} onPeriodChange={setRekapTanggalPeriod} dateRange={rekapTanggalDateRange} onDateRangeChange={setRekapTanggalDateRange} />
          <div className="bg-white rounded-xl shadow-sm border p-4">
             {rekapTanggalLoading ? <div className="text-center py-10">Memuat...</div> : 
              Object.keys(rekapTanggalData).length === 0 ? <div className="text-center py-10 text-gray-400">Tidak ada data</div> :
              Object.entries(rekapTanggalData).map(([date, data]: [string, any]) => {
                const isOpen = expandedRekapDate === date;
                return (
                  <div key={date} className="mb-4 border rounded-xl overflow-hidden bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setExpandedRekapDate(isOpen ? null : date)}
                      className="w-full flex items-center justify-between gap-4 p-4 bg-slate-50 hover:bg-slate-100 transition"
                    >
                      <div>
                        <h4 className="font-bold text-gray-900">{new Date(date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h4>
                        <p className="text-sm text-gray-500">{Object.keys(data.products).length} produk</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-blue-700">Rp {data.dateTotal.toLocaleString()}</span>
                        <ChevronRight className={`h-4 w-4 text-gray-500 transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-2">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-gray-500 border-b">
                              <th className="text-left py-1">Produk</th>
                              <th className="text-right py-1">Qty</th>
                              <th className="text-right py-1">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(data.products).map(([id, p]: [string, any]) => (
                              <tr key={id} className="border-b border-gray-100">
                                <td className="py-2">{p.name}</td>
                                <td className="text-right py-2">{p.qty}</td>
                                <td className="text-right py-2 font-medium">Rp {p.total.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {purchaseTabView === "rekapPerBarang" && (
         <div className="space-y-4">
            <PurchaseFilters search={rekapPerBarangSearch} onSearch={setRekapPerBarangSearch} period={rekapPerBarangPeriod} onPeriodChange={setRekapPerBarangPeriod} dateRange={rekapPerBarangDateRange} onDateRangeChange={setRekapPerBarangDateRange} />
            <div className="space-y-4">
              {rekapPerBarangLoading ? (
                <div className="bg-white rounded-xl shadow-sm border p-4 text-center py-10">Memuat...</div>
              ) : Object.keys(rekapPerBarangData).length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border p-4 text-center py-10 text-gray-400">Tidak ada data</div>
              ) : (
                Object.entries(rekapPerBarangData).map(([id, p]: [string, any]) => {
                  const isOpen = expandedRekapPerBarang === id;
                  const rekapProduct =
                    products.find((prod) => String(prod.id) === String(id)) ||
                    products.find((prod) => (prod.name || "") === (p.name || ""));
                  const rows = Object.entries(p.dates).flatMap(([date, dateGroup]: [string, any]) =>
                    (dateGroup.pos || []).map((row: any, index: number) => ({ ...row, date, index }))
                  );

                  return (
                    <div key={id} className="border rounded-xl overflow-hidden bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => setExpandedRekapPerBarang(isOpen ? null : id)}
                        className="w-full flex items-center justify-between gap-4 p-4 bg-slate-50 hover:bg-slate-100 transition"
                      >
                        <div>
                          <h4 className="font-bold text-gray-900">{p.name}</h4>
                          <p className="text-sm text-gray-500">{rows.length} baris pembelian • {p.qty} qty</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {rekapProduct && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenStockCard(rekapProduct);
                              }}
                              title="Kartu Stok"
                              className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                <path d="M3 3h18v2H3V3zm2 6h14v2H5V9zm0 6h8v2H5v-2z" />
                              </svg>
                            </button>
                          )}
                          <span className="font-bold text-blue-700">Rp {Number(p.total).toLocaleString()}</span>
                          <ChevronRight className={`h-4 w-4 text-gray-500 transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-2">
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="text-gray-500 border-b">
                                  <th className="text-left px-3 py-2">PO</th>
                                  <th className="text-left px-3 py-2">Tanggal</th>
                                  <th className="text-left px-3 py-2">Supplier</th>
                                  <th className="text-right px-3 py-2">Jumlah</th>
                                  <th className="text-right px-3 py-2">Harga</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((row: any) => (
                                  <tr key={`${row.poId}-${row.index}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                    <td className="px-3 py-2">{row.poNumber || row.poId}</td>
                                    <td className="px-3 py-2">{row.date !== "unknown" ? new Date(row.date).toLocaleDateString('id-ID') : 'Unknown'}</td>
                                    <td className="px-3 py-2">{row.supplierName || '-'}</td>
                                    <td className="px-3 py-2 text-right">{row.qty}</td>
                                    <td className="px-3 py-2 text-right font-medium">Rp {Number(row.total).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
         </div>
      )}
    </div>
  );

  const renderStockTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Stock Barang</h2>
        <p className="text-gray-600">Kelola dan pantau stok barang saat ini</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Cari Nama Barang</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Cari produk atau barcode..."
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-52">
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Filter Kategori</label>
              <select
                value={stockCategoryFilter}
                onChange={(e) => setStockCategoryFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Semua Kategori</option>
                {uniqueCategories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-52">
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Group Data Stok</label>
              <select
                value={stockGroupBy}
                onChange={(e) => setStockGroupBy(e.target.value as "none" | "category" | "product_type")}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="none">Tanpa Grouping</option>
                <option value="category">Grouping: Kategori</option>
                <option value="product_type">Grouping: Tipe Produk</option>
              </select>
            </div>
            <button
              type="button"
              disabled={selectedStockProducts.length === 0}
              onClick={() => setShowSelectedStockModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="h-4 w-4" />
              Keranjang
            </button>
            <button
              type="button"
              onClick={() => setShowStockReductionForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold transition hover:bg-red-700"
            >
              <Minus className="h-4 w-4" />
              Gunakan Stok
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <input
                    type="checkbox"
                    checked={areAllStockSelected}
                    onChange={toggleSelectAllStock}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader label="Nama" sortKey="name" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortHeader label="Kategori" sortKey="category" />
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Kartu Stok
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <div className="flex items-center justify-end">
                    <SortHeader label="Min. Stok" sortKey="min_stock" />
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <div className="flex items-center justify-end">
                    <SortHeader label="Stok" sortKey="stock" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {visibleStockProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada data produk
                  </td>
                </tr>
              ) : stockGroupBy !== "none" ? (
                groupedVisibleStockEntries.map(([groupName, groupProducts]) => (
                  <React.Fragment key={groupName}>
                    <tr className="bg-slate-100/80">
                      <td colSpan={6} className="px-6 py-3">
                        <button
                          type="button"
                          onClick={() => toggleStockGroup(groupName)}
                          className="w-full flex items-center justify-between gap-4 text-left"
                        >
                          <div className="flex items-center gap-3">
                            <ChevronRight className={`h-4 w-4 text-slate-500 transform transition-transform ${expandedStockGroups[groupName] === false ? "rotate-0" : "rotate-90"}`} />
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                {stockGroupBy === "category" ? "Kategori" : "Tipe Produk"}
                              </p>
                              <h4 className="text-sm font-bold text-slate-900">{groupName}</h4>
                            </div>
                          </div>
                          <div className="text-sm text-slate-600">
                            {groupProducts.length} produk
                          </div>
                        </button>
                      </td>
                    </tr>
                    {expandedStockGroups[groupName] !== false && groupProducts.map((product) => {
                      const productId = getStockProductId(product);
                      return (
                        <tr key={productId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedStockIds.includes(productId)}
                              onChange={() => toggleSelectStock(productId)}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                          <td className="px-6 py-4 text-gray-600">{product.category || "-"}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleOpenStockCard(product)}
                              title="Kartu Stok"
                              className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                <path d="M3 3h18v2H3V3zm2 6h14v2H5V9zm0 6h8v2H5v-2z" />
                              </svg>
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right text-gray-600">{product.min_stock || 0}</td>
                          <td className="px-6 py-4 text-right">
                            <span className={`font-bold ${
                              product.stock === 0 ? "text-red-600" :
                              product.stock <= (product.min_stock || 0) ? "text-orange-600" :
                              "text-blue-600"
                            }`}>
                              {product.stock || 0} {product.unit || "pcs"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              ) : (
                visibleStockProducts.map((product) => {
                  const productId = getStockProductId(product);
                  return (
                    <tr key={productId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedStockIds.includes(productId)}
                          onChange={() => toggleSelectStock(productId)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                      <td className="px-6 py-4 text-gray-600">{product.category || "-"}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleOpenStockCard(product)}
                          title="Kartu Stok"
                          className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                            <path d="M3 3h18v2H3V3zm2 6h14v2H5V9zm0 6h8v2H5v-2z" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">{product.min_stock || 0}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-bold ${
                          product.stock === 0 ? "text-red-600" :
                          product.stock <= (product.min_stock || 0) ? "text-orange-600" :
                          "text-blue-600"
                        }`}>
                          {product.stock || 0} {product.unit || "pcs"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSelectedStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[80vh] bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Daftar Barang Belanja</h3>
                <p className="text-sm text-gray-500">Berisi nama produk yang dipilih.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copySelectedStockToClipboard}
                  disabled={selectedStockProducts.length === 0}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Copy daftar ke clipboard"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowSelectedStockModal(false)}
                  className="text-gray-500 hover:text-gray-700 rounded-full p-2"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800 bg-slate-50 rounded-2xl p-4 border border-gray-200">
{selectedStockProductsText}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowSelectedStockModal(false)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {showStockReductionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Kurangi Stok Produk</h2>
                  <p className="text-xs text-gray-500">(bahan baku)</p>
                </div>
    
                <button
                  onClick={() => setShowStockReductionForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!stockReductionForm.product_id || stockReductionForm.quantity <= 0) {
                    Swal.fire("Error", "Pilih produk dan jumlah yang valid", "error");
                    return;
                  }

                  try {
                    await db.products.decreaseStock(
                      stockReductionForm.product_id,
                      stockReductionForm.quantity
                    );

                    const product = products.find((p) => p.id === stockReductionForm.product_id);
                    await supabase.from("cashier_transactions").insert({
                      session_id: null,
                      type: "stock_reduction",
                      amount: 0,
                      payment_method: "cash",
                      details: [
                        {
                          product_id: stockReductionForm.product_id,
                          product_name: product?.name || "Unknown Product",
                          quantity: stockReductionForm.quantity,
                        },
                      ],
                      description: `${stockReductionForm.notes || "Stok dikurangi manual"}`,
                      reference_id: `STOCK_REDUCTION-${Date.now()}`,
                      timestamp: new Date().toISOString(),
                    });

                    Swal.fire("Berhasil", "Stok berhasil dikurangi", "success");
                    setShowStockReductionForm(false);
                    setStockReductionForm({
                      product_id: "",
                      quantity: 1,
                      notes: "",
                    });
                    await fetchProducts();
                  } catch (error) {
                    console.error("Error reducing stock:", error);
                    Swal.fire("Error", "Gagal mengurangi stok", "error");
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Produk</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowProductSelectForStockReduction(true)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-left focus:ring-2 focus:ring-red-500 focus:border-transparent hover:bg-gray-50"
                    >
                      {stockReductionForm.product_id ? (
                        (() => {
                          const selectedProduct = products.find(
                            (p) => p.id === stockReductionForm.product_id
                          );
                          return (
                            <div>
                              <div className="font-medium text-gray-900">
                                {selectedProduct?.name || "Produk tidak ditemukan"}
                              </div>
                              <div className="text-xs text-gray-500">Stok: {selectedProduct?.stock || 0}</div>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-gray-500">Klik untuk pilih produk...</span>
                      )}
                    </button>
                    {stockReductionForm.product_id && (
                      <button
                        type="button"
                        onClick={() =>
                          setStockReductionForm({
                            ...stockReductionForm,
                            product_id: "",
                          })
                        }
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        title="Hapus pilihan"
                      >
                        <X className="h-4 w-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah</label>
                  <input
                    type="number"
                    min="1"
                    value={stockReductionForm.quantity}
                    onChange={(e) =>
                      setStockReductionForm({
                        ...stockReductionForm,
                        quantity: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catatan (Opsional)</label>
                  <textarea
                    value={stockReductionForm.notes}
                    onChange={(e) =>
                      setStockReductionForm({
                        ...stockReductionForm,
                        notes: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    rows={3}
                    placeholder="Tambahkan catatan jika diperlukan..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowStockReductionForm(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Kurangi Stok
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showProductSelectForStockReduction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex">
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Pilih Produk untuk Pengurangan Stok</h3>
                  <p className="text-xs text-gray-500">(bahan baku)</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchProducts}
                    className="text-blue-600 hover:text-blue-800 p-1 rounded"
                    title="Refresh data produk"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShowProductSelectForStockReduction(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Cari produk berdasarkan nama, kategori, atau barcode..."
                  value={stockReductionProductSearchTerm}
                  onChange={(e) => setStockReductionProductSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                {filteredProductsForStockReduction.filter((p) => p.product_type === "raw_material").length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    {stockReductionProductSearchTerm
                      ? "Tidak ada produk bahan baku yang cocok"
                      : "Belum ada produk bahan baku"}
                  </div>
                ) : (
                  filteredProductsForStockReduction
                    .filter((p) => p.product_type === "raw_material")
                    .map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setStockReductionForm({
                            ...stockReductionForm,
                            product_id: p.id,
                          });
                          setShowProductSelectForStockReduction(false);
                          setStockReductionProductSearchTerm("");
                        }}
                        className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{p.name}</div>
                            <div className="text-xs text-gray-500">
                              Kategori: {p.category || "-"}
                              {p.barcode ? ` • Barcode: ${p.barcode}` : ""}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-700">Stok: {p.stock}</div>
                            <div className="text-xs text-gray-500">
                              Modal: Rp {Number(p.cost || 0).toLocaleString("id-ID")}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                )}
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowProductSelectForStockReduction(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Manajemen Pembelian</h1>
        <p className="text-gray-600">Kelola stok masuk, purchase order, dan riwayat pembelian</p>
      </div>

      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("purchases")}
          className={`pb-4 px-2 font-medium transition-colors relative ${activeTab === "purchases" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
        >
          Input PO
          {activeTab === "purchases" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
        </button>
        <button
          onClick={() => setActiveTab("purchaseList")}
          className={`pb-4 px-2 font-medium transition-colors relative ${activeTab === "purchaseList" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
        >
          Riwayat & Rekap
          {activeTab === "purchaseList" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
        </button>
        <button
          onClick={() => setActiveTab("stock")}
          className={`pb-4 px-2 font-medium transition-colors relative ${activeTab === "stock" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
        >
          Stock
          {activeTab === "stock" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
        </button>
      </div>

      <div className="mt-6">
        {activeTab === "purchases" && renderPurchasesTab()}
        {activeTab === "purchaseList" && renderPurchaseListTab()}
        {activeTab === "stock" && renderStockTab()}
      </div>

      {/* Form Purchase Order Modal */}
      {showPurchaseForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">{editingPoId ? "Edit Purchase Order" : "Buat Purchase Order Baru"}</h2>
              <button 
                onClick={() => setShowPurchaseForm(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <Plus className="h-6 w-6 transform rotate-45 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Supplier *</label>
                  <button
                    onClick={() => setShowSupplierSelectModal(true)}
                    className="w-full flex justify-between items-center px-4 py-3 border border-gray-300 rounded-xl hover:border-blue-400 transition-colors bg-white text-left"
                  >
                    <span className={newPurchase.supplierId ? "text-gray-900 font-medium" : "text-gray-400"}>
                      {newPurchase.supplierId ? suppliers.find(s => s.id === newPurchase.supplierId)?.name : "Pilih Supplier..."}
                    </span>
                    <Search className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Order</label>
                  <input
                    type="date"
                    value={newPurchase.orderDate.split('T')[0]}
                    onChange={(e) => setNewPurchase({ ...newPurchase, orderDate: new Date(e.target.value).toISOString() })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-800">Daftar Barang</h3>
                  <button
                    onClick={addItemToPurchase}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95"
                  >
                    <Plus className="h-4 w-4" /> Tambah Barang
                  </button>
                </div>

                <div className="space-y-4">
                  {newPurchase.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-4 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="col-span-12 md:col-span-5">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Produk</label>
                        <button
                          onClick={() => setShowProductSelectModal({ open: true, index })}
                          className="w-full text-left px-4 py-2.5 border border-slate-200 rounded-lg hover:border-blue-400 transition-colors flex justify-between items-center h-11"
                        >
                          <span className={item.productId ? "text-slate-900 font-medium truncate" : "text-slate-400"}>
                            {item.productId ? item.productName : "Pilih Produk..."}
                          </span>
                          <Search className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                        </button>
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Jumlah</label>
                        <input
                          type="number"
                          value={item.quantity}
                          min="1"
                          onChange={(e) => updatePurchaseItem(index, "quantity", Number(e.target.value))}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-11"
                        />
                      </div>
                      <div className="col-span-8 md:col-span-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Harga Beli</label>
                        <input
                          type="number"
                          value={item.unitCost}
                          onChange={(e) => updatePurchaseItem(index, "unitCost", Number(e.target.value))}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-11"
                        />
                      </div>
                      <div className="col-span-12 md:col-span-2 flex items-center gap-2">
                        <div className="flex-1">
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Subtotal</label>
                           <div className="h-11 flex items-center font-bold text-slate-900">Rp {item.total.toLocaleString()}</div>
                        </div>
                        <button 
                          onClick={() => removePurchaseItem(index)}
                          className="h-11 w-11 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {newPurchase.items.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col items-end">
                    <div className="text-slate-500 font-medium uppercase text-xs mb-1">Total Biaya</div>
                    <div className="text-4xl font-black text-slate-900">Rp {purchaseTotal.toLocaleString()}</div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Catatan Tambahan</label>
                <textarea
                  value={newPurchase.notes}
                  onChange={(e) => setNewPurchase({ ...newPurchase, notes: e.target.value })}
                  placeholder="Opsional: Keterangan PO..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="px-6 py-6 border-t flex gap-4 bg-gray-50">
              <button
                onClick={() => setShowPurchaseForm(false)}
                className="flex-1 py-4 border border-gray-300 rounded-2xl font-bold text-gray-700 hover:bg-white transition-all shadow-sm active:scale-95"
              >
                Batal
              </button>
              <button
                onClick={handleSavePurchase}
                disabled={isSavingPurchase}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
              >
                {isSavingPurchase ? <RefreshCw className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                {editingPoId ? "Simpan Perubahan" : "Konfirmasi Pesanan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Selection Modal */}
      {showSupplierSelectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
             <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-bold text-slate-900">Pilih Supplier</h3>
                   <button onClick={() => setShowSupplierSelectModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                      <Plus className="h-6 w-6 transform rotate-45 text-slate-400" />
                   </button>
                </div>
                <div className="relative mb-6">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                   <input
                      autoFocus
                      type="text"
                      placeholder="Cari supplier..."
                      value={supplierSearchTerm}
                      onChange={(e) => setSupplierSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                   />
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                   {filteredSuppliersForModal.map(s => (
                      <button
                         key={s.id}
                         onClick={() => {
                            setNewPurchase({ ...newPurchase, supplierId: s.id });
                            setShowSupplierSelectModal(false);
                            setSupplierSearchTerm("");
                         }}
                         className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all text-left"
                      >
                         <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shrink-0 uppercase font-bold">
                            {s.name.charAt(0)}
                         </div>
                         <div className="flex-1">
                            <div className="font-bold text-slate-900">{s.name}</div>
                            <div className="text-xs text-slate-500">{s.contact_person || 'Tanpa Kontak'}</div>
                         </div>
                         <ChevronRight className="h-4 w-4 text-slate-300" />
                      </button>
                   ))}
                   {filteredSuppliersForModal.length === 0 && (
                      <div className="py-10 text-center">
                         <AlertCircle className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                         <p className="text-slate-400 text-sm">Supplier tidak ditemukan</p>
                      </div>
                   )}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Product Selection Modal */}
      {showProductSelectModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200">
             <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-bold text-slate-900">Pilih Produk</h3>
                   <button onClick={() => setShowProductSelectModal({ open: false, index: null })} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                      <Plus className="h-6 w-6 transform rotate-45 text-slate-400" />
                   </button>
                </div>
                <div className="relative mb-6">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                   <input
                      autoFocus
                      type="text"
                      placeholder="Cari nama produk atau barcode..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                   />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                   {filteredProductsForModal.map(p => (
                      <button
                         key={p.id}
                         onClick={() => {
                            if (showProductSelectModal.index !== null) {
                               updatePurchaseItem(showProductSelectModal.index, "productId", p.id);
                            }
                            setShowProductSelectModal({ open: false, index: null });
                            setProductSearchTerm("");
                         }}
                         className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 border border-slate-100 hover:border-blue-100 transition-all text-left group"
                      >
                         <div className="h-12 w-12 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-white transition-colors">
                            <Package className="h-6 w-6" />
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-900 truncate text-sm">{p.name}</div>
                            <div className="text-xs text-slate-500 font-medium">Stok: {p.stock} {p.unit}</div>
                            <div className="text-blue-600 font-bold text-xs mt-0.5">Rp {p.cost.toLocaleString()}</div>
                         </div>
                         <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400" />
                      </button>
                   ))}
                </div>
                {filteredProductsForModal.length === 0 && (
                   <div className="py-12 text-center bg-slate-50 rounded-2xl mt-4">
                      <Package className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm">Produk tidak ditemukan</p>
                   </div>
                )}
             </div>
          </div>
        </div>
      )}

      {showStockCard && stockCardProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Kartu Stok - {stockCardProduct.name}</h3>
                <button
                  onClick={() => setShowStockCard(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-600">Stok Saat Ini</label>
                  <div className="mt-1 font-semibold text-gray-900">
                    {stockCardProduct.stock} {stockCardProduct.unit}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Min. Stok</label>
                  <div className="mt-1 text-gray-900">
                    {stockCardProduct.min_stock} {stockCardProduct.unit}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-white">
              <h4 className="font-semibold text-gray-900 mb-3">Riwayat Stok</h4>
              {stockHistoryLoading ? (
                <div className="text-sm text-gray-500">Memuat riwayat...</div>
              ) : stockHistoryError ? (
                <div className="text-sm text-red-500">{stockHistoryError}</div>
              ) : stockHistory.length === 0 ? (
                <div className="text-sm text-gray-500">Belum ada riwayat stok.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-2 py-2">Tanggal</th>
                        <th className="px-2 py-2">Keluar</th>
                        <th className="px-2 py-2">Masuk</th>
                        <th className="px-2 py-2">Saldo</th>
                        <th className="px-2 py-2">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700">
                      {(() => {
                        const rev = [...stockHistory].reverse();
                        const totalPages = Math.max(1, Math.ceil(rev.length / STOCK_HISTORY_PAGE_SIZE));
                        const page = Math.max(0, Math.min(stockHistoryPage, totalPages - 1));
                        const start = page * STOCK_HISTORY_PAGE_SIZE;
                        const paged = rev.slice(start, start + STOCK_HISTORY_PAGE_SIZE);
                        const startBalance =
                          rev.length > 0 ? rev[0]._balance - (rev[0]._qty || 0) : stockCardProduct.stock || 0;

                        return (
                          <>
                            <tr className="border-t">
                              <td className="px-2 py-2">-</td>
                              <td className="px-2 py-2">-</td>
                              <td className="px-2 py-2">-</td>
                              <td className="px-2 py-2 font-semibold">{startBalance}</td>
                              <td className="px-2 py-2">Saldo Awal</td>
                            </tr>
                            {paged.map((r) => (
                              <tr
                                key={r.id || `${r.created_at}-${r._qty}`}
                                className="border-t"
                              >
                                <td className="px-2 py-2">
                                  {new Date(r.created_at).toLocaleString("id-ID", {
                                    timeZone: "Asia/Jakarta",
                                  })}
                                </td>
                                <td className="px-2 py-2">{r._qty < 0 ? Math.abs(r._qty) : "-"}</td>
                                <td className="px-2 py-2">{r._qty > 0 ? r._qty : "-"}</td>
                                <td className="px-2 py-2">{r._balance}</td>
                                <td className="px-2 py-2">{r.note || r.notes || "-"}</td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={5} className="px-2 py-3">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-gray-500">
                                    Menampilkan {start + 1} - {Math.min(start + STOCK_HISTORY_PAGE_SIZE, rev.length)} dari {rev.length} entri
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setStockHistoryPage((p) => Math.max(0, p - 1))}
                                      disabled={page === 0}
                                      className={`px-3 py-1 rounded-lg border ${
                                        page === 0
                                          ? "text-gray-400 border-gray-200"
                                          : "text-gray-700 border-gray-300 hover:bg-gray-50"
                                      }`}
                                    >
                                      Prev
                                    </button>
                                    <button
                                      onClick={() => setStockHistoryPage((p) => Math.min(totalPages - 1, p + 1))}
                                      disabled={page >= totalPages - 1}
                                      className={`px-3 py-1 rounded-lg border ${
                                        page >= totalPages - 1
                                          ? "text-gray-400 border-gray-200"
                                          : "text-gray-700 border-gray-300 hover:bg-gray-50"
                                      }`}
                                    >
                                      Next
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowStockCard(false)}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};

export default Pembelian;
