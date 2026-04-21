/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-case-declarations */
import React, { useState, useEffect } from "react";
import {
  Plus,
  X,
  Copy,
  Minus,
  ArrowUp,
  ArrowDown,
  Search,
  Package,
  Edit,
  Trash2,
  AlertTriangle,
  ShoppingBag,
  TrendingUp,
  Calendar,
  FileText,
  Truck,
  XCircle,
  Printer,
  DollarSign,
  List as ListIcon,
  LayoutGrid,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { db, storage, supabase } from "../lib/supabase"; // Hanya import db
import { printPriceList, ProductPriceList } from "../utils/receipt";
import Swal from "sweetalert2";
import PurchaseFilters from "./PurchaseFilters";
import StokOpname from "./StokOpname";

const Products: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    | "products"
    | "purchases"
    | "suppliers"
    | "purchaseList"
    | "sales"
    | "salesSummary"
    | "reports"
    | "stokOpname"
  >("products");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProductType, setSelectedProductType] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState<string | null>(null);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [
    showProductSelectForStockReduction,
    setShowProductSelectForStockReduction,
  ] = useState(false);
  // stok opname modal moved into StokOpname component
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "beverage" as "beverage" | "food" | "snack" | "other",
    product_type: "finished_good",
    unit: "pcs" as "gram" | "liter" | "pcs",
    price: 0,
    cost: 0,
    stock: 0,
    min_stock: 0,
    barcode: "",
    image_url: "",
    description: "",
    is_active: true,
  });

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
    // orderDate will be stored in purchase_orders.order_date (ISO string)
    orderDate: new Date().toISOString(),
  });

  const [editingPoId, setEditingPoId] = useState<string | null>(null);
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);

  // Read-only PO detail state (expanded row)
  const [poDetail, setPoDetail] = useState<any | null>(null);
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);

  const [newSupplier, setNewSupplier] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    category: "beverage" as "beverage" | "food" | "snack" | "other",
  });
  const [showStockReductionForm, setShowStockReductionForm] = useState(false);
  const [stockReductionForm, setStockReductionForm] = useState({
    product_id: "",
    quantity: 1,
    // reason: "",
    notes: "",
  });

  // State untuk produk dari database
  const [products, setProducts] = useState<any[]>([]);
  // State untuk supplier dari database
  const [suppliers, setSuppliers] = useState<any[]>([]);
  // const [supplierView, setSupplierView] = useState<'card' | 'list'>('card');
  const [showEditSupplierForm, setShowEditSupplierForm] = useState<
    string | null
  >(null);
  const [editSupplier, setEditSupplier] = useState<any | null>(null);

  // Tambah state untuk daftar PO, filter tanggal, dan status
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  // purchaseDateRange removed - use daftarDateRange instead
  // keep purchaseStatus available for filtering but we don't need the setter here
  const [purchaseStatus] = useState<string>("all");
  // State untuk periode filter pada laporan penjualan
  const [salesPeriod, setSalesPeriod] = useState<string>("week");
  const [salesDateRange, setSalesDateRange] = useState<{
    start: string;
    end: string;
  }>({ start: "", end: "" });
  // Filters for Sales Summary (Laporan Rekap Per Barang)
  const [salesSummarySearch, setSalesSummarySearch] = useState<string>("");
  const [salesSummaryPeriod, setSalesSummaryPeriod] = useState<string>("week");
  const [salesSummaryDateRange, setSalesSummaryDateRange] = useState<{
    start: string;
    end: string;
  }>({ start: "", end: "" });
  // Local search state for sales tab to avoid clashing with global searchTerm
  const [salesSearch, setSalesSearch] = useState<string>("");
  // Which report sub-tab is active under Laporan Penjualan
  const [reportTab, setReportTab] = useState<"sales" | "salesSummary">("sales");
  // expandedProducts removed - not currently used

  // State untuk item PO detail
  const [purchaseOrderItems, setPurchaseOrderItems] = useState<any[]>([]);
  const [loadingPurchaseItems, setLoadingPurchaseItems] = useState(false);
  const [purchaseItemsError, setPurchaseItemsError] = useState<string | null>(
    null
  );
  // purchasePeriod removed - use daftarPeriod instead
  // subtab inside Daftar Pembelian: 'daftar' (existing list), 'rekapTanggalBarang', 'rekapPerBarang'
  const [purchaseTabView, setPurchaseTabView] = useState<
    "daftar" | "rekapTanggalBarang" | "rekapPerBarang"
  >("daftar");
  // Independent filters for the 'Daftar Pembelian' subtab (do not share with other tabs)
  const [daftarSearch, setDaftarSearch] = useState("");
  const [daftarPeriod, setDaftarPeriod] = useState<string>("week");
  const [daftarDateRange, setDaftarDateRange] = useState<{
    start: string;
    end: string;
  }>({ start: "", end: "" });
  // Filters for Rekap Pembelian (Per tanggal - Per Barang)
  const [rekapTanggalSearch, setRekapTanggalSearch] = useState("");
  const [rekapTanggalPeriod, setRekapTanggalPeriod] = useState<string>("week");
  const [rekapTanggalDateRange, setRekapTanggalDateRange] = useState<{
    start: string;
    end: string;
  }>({ start: "", end: "" });

  // Filters for Rekap Per Barang
  const [rekapPerBarangSearch, setRekapPerBarangSearch] = useState("");
  const [rekapPerBarangPeriod, setRekapPerBarangPeriod] =
    useState<string>("week");
  const [rekapPerBarangDateRange, setRekapPerBarangDateRange] = useState<{
    start: string;
    end: string;
  }>({ start: "", end: "" });

  // Data + loading states for Rekap views
  const [rekapTanggalData, setRekapTanggalData] = useState<Record<string, any>>(
    {}
  );
  const [rekapTanggalLoading, setRekapTanggalLoading] = useState(false);
  const [rekapTanggalError, setRekapTanggalError] = useState<string | null>(
    null
  );

  const [rekapPerBarangData, setRekapPerBarangData] = useState<
    Record<string, any>
  >({});
  const [rekapPerBarangLoading, setRekapPerBarangLoading] = useState(false);
  const [rekapPerBarangError, setRekapPerBarangError] = useState<string | null>(
    null
  );

  // Load purchase order items and purchases for rekap computations when needed
  useEffect(() => {
    const loadRekapTanggal = async () => {
      if (purchaseTabView !== "rekapTanggalBarang") return;
      setRekapTanggalLoading(true);
      setRekapTanggalError(null);
      try {
        // build date range from period/dateRange
        let start: string | null = null;
        let end: string | null = null;
        const now = new Date();
        switch (rekapTanggalPeriod) {
          case "today": {
            const s = new Date();
            s.setHours(0, 0, 0, 0);
            start = s.toISOString().slice(0, 10);
            const e = new Date();
            e.setHours(23, 59, 59, 999);
            end = e.toISOString().slice(0, 10);
            break;
          }
          case "yesterday": {
            const s = new Date();
            s.setDate(s.getDate() - 1);
            s.setHours(0, 0, 0, 0);
            start = s.toISOString().slice(0, 10);
            const e = new Date(s);
            e.setHours(23, 59, 59, 999);
            end = e.toISOString().slice(0, 10);
            break;
          }
          case "week": {
            const s = new Date();
            const d = s.getDay();
            const diff = (d === 0 ? -6 : 1) - d;
            s.setDate(s.getDate() + diff);
            s.setHours(0, 0, 0, 0);
            start = s.toISOString().slice(0, 10);
            const e = new Date();
            e.setHours(23, 59, 59, 999);
            end = e.toISOString().slice(0, 10);
            break;
          }
          case "month": {
            const s = new Date(now.getFullYear(), now.getMonth(), 1);
            start = s.toISOString().slice(0, 10);
            const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            e.setHours(23, 59, 59, 999);
            end = e.toISOString().slice(0, 10);
            break;
          }
          case "range":
            if (rekapTanggalDateRange.start)
              start = new Date(rekapTanggalDateRange.start)
                .toISOString()
                .slice(0, 10);
            if (rekapTanggalDateRange.end)
              end = new Date(rekapTanggalDateRange.end)
                .toISOString()
                .slice(0, 10);
            break;
        }

        // Build purchases query with date filters (DB-side)
        const { supabase } = db as any; // use db.supabase if available, otherwise fallback to exported supabase
        // prefer using the exported supabase client directly
        // Query purchase_orders (via supabase)
        let purchasesQuery: any = (supabase || (db as any).supabase)
          .from("purchase_orders")
          .select("*");
        if (start) purchasesQuery = purchasesQuery.gte("order_date", start);
        if (end) purchasesQuery = purchasesQuery.lte("order_date", end);
        purchasesQuery = purchasesQuery
          .order("order_date", { ascending: false })
          .limit(2000);
        const { data: posData, error: posErr } = await purchasesQuery;
        if (posErr) throw posErr;

        // apply search: PO number or supplier name
        let filteredPos = posData || [];
        if (rekapTanggalSearch) {
          const st = rekapTanggalSearch.toLowerCase();
          // try supplier name match
          const { data: supMatches } = await (supabase || (db as any).supabase)
            .from("suppliers")
            .select("id")
            .ilike("name", `%${st}%`)
            .limit(200);
          const supplierIds = (supMatches || []).map((s: any) => s.id);
          filteredPos = (filteredPos || []).filter((p: any) => {
            const matchPo = p.po_number?.toLowerCase().includes(st);
            const matchSupplier = supplierIds.length
              ? supplierIds.includes(p.supplier_id)
              : false;
            return matchPo || matchSupplier;
          });
        }

        const poIds = (filteredPos || []).map((p: any) => p.id).filter(Boolean);

        // fetch PO items for filtered PO ids only
        let poItems: any[] = [];
        if (poIds.length > 0) {
          const { data: itemsData, error: itemsErr } = await (
            supabase || (db as any).supabase
          )
            .from("purchase_order_items")
            .select("*")
            .in("po_id", poIds)
            .limit(5000);
          if (itemsErr) throw itemsErr;
          poItems = itemsData || [];
        }

        // build map: date -> productKey -> { qty, total }
        const map: Record<string, any> = {};
        for (const iti of (poItems || []) as any[]) {
          const po =
            ((filteredPos || []).find((p: any) => p.id === iti.po_id) as any) ||
            {};
          const orderDate = (po as any).order_date
            ? new Date((po as any).order_date).toISOString().slice(0, 10)
            : "unknown";
          const productId = iti.product_id ?? iti.productId ?? null;
          const name =
            iti.product_name ||
            (productId
              ? products.find((p: any) => String(p.id) === String(productId))
                  ?.name
              : "") ||
            "Unknown Produk";
          const qty = Number(iti.quantity || iti.qty || 0) || 0;
          const total =
            Number(iti.total || (iti.unit_cost ? iti.unit_cost * qty : 0)) || 0;
          if (!map[orderDate]) map[orderDate] = { products: {}, dateTotal: 0 };
          const key = String(productId ?? name);
          if (!map[orderDate].products[key])
            map[orderDate].products[key] = {
              productId,
              name,
              qty: 0,
              total: 0,
              lines: [],
            };
          map[orderDate].products[key].qty += qty;
          map[orderDate].products[key].total += total;
          const supplierName =
            suppliers.find((s: any) => s.id === po.supplier_id)?.name || "";
          map[orderDate].products[key].lines.push({
            poId: iti.po_id,
            qty,
            total,
            unitPrice: qty ? Math.round(total / qty) : 0,
            supplierName,
          });
          map[orderDate].dateTotal += total;
        }

        setRekapTanggalData(map);
      } catch (err: any) {
        setRekapTanggalError(err?.message || String(err));
        setRekapTanggalData({});
      } finally {
        setRekapTanggalLoading(false);
      }
    };

    const loadRekapPerBarang = async () => {
      if (purchaseTabView !== "rekapPerBarang") return;
      setRekapPerBarangLoading(true);
      setRekapPerBarangError(null);
      try {
        // Build date range (YYYY-MM-DD) from period/dateRange
        let start: string | null = null;
        let end: string | null = null;
        const now = new Date();
        switch (rekapPerBarangPeriod) {
          case "today": {
            const s = new Date();
            s.setHours(0, 0, 0, 0);
            start = s.toISOString().slice(0, 10);
            const e = new Date();
            e.setHours(23, 59, 59, 999);
            end = e.toISOString().slice(0, 10);
            break;
          }
          case "yesterday": {
            const s = new Date();
            s.setDate(s.getDate() - 1);
            s.setHours(0, 0, 0, 0);
            start = s.toISOString().slice(0, 10);
            const e = new Date(s);
            e.setHours(23, 59, 59, 999);
            end = e.toISOString().slice(0, 10);
            break;
          }
          case "week": {
            const s = new Date();
            const d = s.getDay();
            const diff = (d === 0 ? -6 : 1) - d;
            s.setDate(s.getDate() + diff);
            s.setHours(0, 0, 0, 0);
            start = s.toISOString().slice(0, 10);
            const e = new Date();
            e.setHours(23, 59, 59, 999);
            end = e.toISOString().slice(0, 10);
            break;
          }
          case "month": {
            const s = new Date(now.getFullYear(), now.getMonth(), 1);
            start = s.toISOString().slice(0, 10);
            const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            e.setHours(23, 59, 59, 999);
            end = e.toISOString().slice(0, 10);
            break;
          }
          case "range":
            if (rekapPerBarangDateRange.start)
              start = new Date(rekapPerBarangDateRange.start)
                .toISOString()
                .slice(0, 10);
            if (rekapPerBarangDateRange.end)
              end = new Date(rekapPerBarangDateRange.end)
                .toISOString()
                .slice(0, 10);
            break;
        }

        const supabase = (db as any).supabase;

        // Query matching purchase_orders with date filters
        let purchasesQuery: any = supabase.from("purchase_orders").select("*");
        if (start) purchasesQuery = purchasesQuery.gte("order_date", start);
        if (end) purchasesQuery = purchasesQuery.lte("order_date", end);
        purchasesQuery = purchasesQuery
          .order("order_date", { ascending: false })
          .limit(2000);
        const { data: posData, error: posErr } = await purchasesQuery;
        if (posErr) throw posErr;

        let filteredPos = posData || [];
        if (rekapPerBarangSearch) {
          const st = rekapPerBarangSearch.toLowerCase();
          const { data: supMatches } = await supabase
            .from("suppliers")
            .select("id")
            .ilike("name", `%${st}%`)
            .limit(200);
          const supplierIds = (supMatches || []).map((s: any) => s.id);
          filteredPos = (filteredPos || []).filter((p: any) => {
            const matchPo = p.po_number?.toLowerCase().includes(st);
            const matchSupplier = supplierIds.length
              ? supplierIds.includes(p.supplier_id)
              : false;
            return matchPo || matchSupplier;
          });
        }

        const poIds = (filteredPos || []).map((p: any) => p.id).filter(Boolean);

        // fetch only items for matching PO ids
        let poItems: any[] = [];
        if (poIds.length > 0) {
          const { data: itemsData, error: itemsErr } = await supabase
            .from("purchase_order_items")
            .select("*")
            .in("po_id", poIds)
            .limit(5000);
          if (itemsErr) throw itemsErr;
          poItems = itemsData || [];
        }

        // aggregate per product
        const map: Record<string, any> = {};
        for (const iti of (poItems || []) as any[]) {
          const po =
            ((filteredPos || []).find((p: any) => p.id === iti.po_id) as any) ||
            {};
          const orderDate = (po as any).order_date
            ? new Date((po as any).order_date).toISOString().slice(0, 10)
            : iti.created_at || iti.inserted_at || ""
            ? String(iti.created_at || iti.inserted_at).slice(0, 10)
            : "unknown";
          const productId = iti.product_id ?? iti.productId ?? null;
          const name =
            iti.product_name ||
            (productId
              ? products.find((p: any) => String(p.id) === String(productId))
                  ?.name
              : "") ||
            "Unknown Produk";
          const qty = Number(iti.quantity || iti.qty || 0) || 0;
          const total =
            Number(iti.total || (iti.unit_cost ? iti.unit_cost * qty : 0)) || 0;
          const key = String(productId ?? name);
          if (!map[key])
            map[key] = { productId, name, qty: 0, total: 0, lines: [] };
          map[key].qty += qty;
          map[key].total += total;
          const supplierName =
            suppliers.find((s: any) => s.id === po.supplier_id)?.name || "";
          map[key].lines.push({
            poId: iti.po_id,
            qty,
            total,
            unitPrice: qty ? Math.round(total / qty) : 0,
            date: orderDate,
            supplierName,
          });
        }

        setRekapPerBarangData(map);
      } catch (err: any) {
        setRekapPerBarangError(err?.message || String(err));
        setRekapPerBarangData({});
      } finally {
        setRekapPerBarangLoading(false);
      }
    };

    // run both (each will early-return if not active)
    loadRekapTanggal();
    loadRekapPerBarang();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    purchaseTabView,
    products,
    rekapTanggalPeriod,
    rekapTanggalDateRange.start,
    rekapTanggalDateRange.end,
    rekapTanggalSearch,
    rekapPerBarangPeriod,
    rekapPerBarangDateRange.start,
    rekapPerBarangDateRange.end,
    rekapPerBarangSearch,
  ]);

  // Render helpers for rekap tabs
  const renderRekapTanggalTab = () => {
    if (rekapTanggalLoading)
      return <div className="text-sm text-gray-500">Memuat rekap...</div>;
    if (rekapTanggalError)
      return <div className="text-sm text-red-500">{rekapTanggalError}</div>;
    const dateKeys = Object.keys(rekapTanggalData).sort((a, b) =>
      a < b ? 1 : -1
    );
    if (dateKeys.length === 0)
      return (
        <div className="text-sm text-gray-500">Belum ada data pembelian.</div>
      );
    const rtPeriodLabel = (() => {
      if (rekapTanggalPeriod === "range") {
        if (rekapTanggalDateRange.start && rekapTanggalDateRange.end) {
          const s = new Date(rekapTanggalDateRange.start).toLocaleDateString();
          const e = new Date(rekapTanggalDateRange.end).toLocaleDateString();
          return `${s} - ${e}`;
        }
        if (rekapTanggalDateRange.start)
          return `Mulai ${new Date(
            rekapTanggalDateRange.start
          ).toLocaleDateString()}`;
        return "Rentang waktu (tidak lengkap)";
      }
      switch (rekapTanggalPeriod) {
        case "today": {
          const d = new Date();
          return `Hari Ini (${d.toLocaleDateString()})`;
        }
        case "yesterday": {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          return `Kemarin (${d.toLocaleDateString()})`;
        }
        case "week": {
          const d0 = new Date();
          const dd = new Date(d0);
          const day = dd.getDay();
          const diff = (day === 0 ? -6 : 1) - day;
          dd.setDate(dd.getDate() + diff);
          return `Minggu Ini (${dd.toLocaleDateString()} - ${new Date().toLocaleDateString()})`;
        }
        case "month": {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          return `Bulan Ini (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`;
        }
        default:
          return "Semua Waktu";
      }
    })();

    return (
      <div className="space-y-4">
        {dateKeys.map((dk) => {
          const day = rekapTanggalData[dk];
          const productsArr = Object.values(day.products).sort(
            (a: any, b: any) => b.total - a.total
          );
          return (
            <div
              key={dk}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-500">
                    {new Date(dk).toLocaleDateString("id-ID", {
                      weekday: "long",
                    })}
                  </div>
                  <button
                    onClick={() => {
                      const s = new Set(expandedDates);
                      if (s.has(dk)) s.delete(dk);
                      else s.add(dk);
                      setExpandedDates(s);
                    }}
                    className="font-semibold text-left text-blue-600 hover:underline flex items-center gap-2"
                    aria-expanded={expandedDates.has(dk)}
                  >
                    <span>
                      {dk === "unknown"
                        ? "-"
                        : new Date(dk).toLocaleDateString("id-ID")}
                    </span>
                    <svg
                      className={`h-4 w-4 transform ${
                        expandedDates.has(dk) ? "rotate-180" : ""
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="font-semibold text-green-700">
                    Rp {Number(day.dateTotal || 0).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>
              {expandedDates.has(dk) && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Produk
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Qty
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Harga
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Total (Rp)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {productsArr.map((p: any) => {
                        const product = p.productId
                          ? products.find(
                              (item) => String(item.id) === String(p.productId)
                            )
                          : null;
                        const supplierNames =
                          Array.from(
                            new Set(
                              (p.lines || [])
                                .map((l: any) => l.supplierName)
                                .filter(Boolean)
                            )
                          ).join(", ") || "-";

                        return (
                        <tr key={String(p.productId ?? p.name)}>
                          <td className="px-4 py-2">
                            {renderProductIdentity({
                              product,
                              name: p.name,
                              secondaryText:
                                p.lines && p.lines.length > 0
                                  ? `Supplier: ${supplierNames}`
                                  : undefined,
                            })}
                          </td>
                          <td className="px-4 py-2 text-right font-medium">
                            {p.qty}
                          </td>
                          <td className="px-4 py-2 text-right font-medium">
                            {p.qty
                              ? Number(
                                  Math.round((p.total || 0) / p.qty)
                                ).toLocaleString("id-ID")
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">
                            {Number(p.total || 0).toLocaleString("id-ID")}
                          </td>
                        </tr>
                      );})}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const totalQty = productsArr.reduce(
                          (s: any, it: any) => s + (Number(it.qty) || 0),
                          0
                        );
                        const totalAmount = productsArr.reduce(
                          (s: any, it: any) => s + (Number(it.total) || 0),
                          0
                        );
                        return (
                          <>
                            <tr className="bg-gray-50">
                              <td className="px-4 py-2 text-left font-medium">
                                Subtotal
                              </td>
                              <td className="px-4 py-2 text-right font-medium">
                                {String(totalQty)}
                              </td>
                              <td className="px-4 py-2 text-right font-medium">
                                -
                              </td>
                              <td className="px-4 py-2 text-right font-semibold">
                                {String(
                                  Number(totalAmount).toLocaleString("id-ID")
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td
                                colSpan={3}
                                className="px-4 py-2 text-right font-semibold"
                              >
                                Grand Total
                              </td>
                              <td className="px-4 py-2 text-right font-semibold">
                                Rp {Number(totalAmount).toLocaleString("id-ID")}
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {/* Grand total for all dates - shown as a footer inside the container */}
        {(() => {
          const grand = Object.keys(rekapTanggalData).reduce(
            (s: any, dk: any) =>
              s + (Number(rekapTanggalData[dk]?.dateTotal) || 0),
            0
          );
          // compute days and average per day if possible
          const dateKeys = Object.keys(rekapTanggalData).filter(
            (k) => k !== null && k !== undefined && String(k).trim() !== ""
          );
          const days = dateKeys.length || 1;
          const avg = days ? Math.round((grand || 0) / days) : 0;
          return (
            <div className="mt-3">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Total {days}-Hari</div>
                  <div className="font-semibold text-gray-900">
                    {rtPeriodLabel}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Grand Total</div>
                  <div className="font-semibold text-green-700">
                    Rp {Number(grand).toLocaleString("id-ID")}
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    Rata-rata / hari
                  </div>
                  <div className="font-medium text-gray-900">
                    Rp {Number(avg).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  const renderRekapPerBarangTab = () => {
    if (rekapPerBarangLoading)
      return (
        <div className="text-sm text-gray-500">Memuat rekap per barang...</div>
      );
    if (rekapPerBarangError)
      return <div className="text-sm text-red-500">{rekapPerBarangError}</div>;
    // Compute period label for this tab
    const periodLabel = (() => {
      if (rekapPerBarangPeriod === "range") {
        if (rekapPerBarangDateRange.start && rekapPerBarangDateRange.end) {
          const s = new Date(
            rekapPerBarangDateRange.start
          ).toLocaleDateString();
          const e = new Date(rekapPerBarangDateRange.end).toLocaleDateString();
          return `${s} s.d. ${e}`;
        }
        if (rekapPerBarangDateRange.start)
          return `Mulai ${new Date(
            rekapPerBarangDateRange.start
          ).toLocaleDateString()}`;
        return "Rentang waktu (tidak lengkap)";
      }
      switch (rekapPerBarangPeriod) {
        case "today": {
          const d = new Date();
          return `Hari Ini (${d.toLocaleDateString()})`;
        }
        case "yesterday": {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          return `Kemarin (${d.toLocaleDateString()})`;
        }
        case "week": {
          const d0 = new Date();
          const dd = new Date(d0);
          const day = dd.getDay();
          const diff = (day === 0 ? -6 : 1) - day;
          dd.setDate(dd.getDate() + diff);
          return `Minggu Ini (${dd.toLocaleDateString()} - ${new Date().toLocaleDateString()})`;
        }
        case "month": {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          return `Bulan Ini (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`;
        }
        default:
          return "Semua Waktu";
      }
    })();
    const productKeys = Object.keys(rekapPerBarangData).sort((a, b) => {
      const A = rekapPerBarangData[a];
      const B = rekapPerBarangData[b];
      return (B.total || 0) - (A.total || 0);
    });
    if (productKeys.length === 0)
      return (
        <div className="text-sm text-gray-500">Belum ada data pembelian.</div>
      );
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Produk
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Qty Total
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Harga
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Total (Rp)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {productKeys.map((k) => {
                const p = rekapPerBarangData[k];
                const unitPrice = p.qty
                  ? Math.round((Number(p.total) || 0) / p.qty)
                  : 0;
                const product = p.productId
                  ? products.find((item) => String(item.id) === String(p.productId))
                  : null;
                const supplierNames =
                  Array.from(
                    new Set(
                      (p.lines || [])
                        .map((l: any) => l.supplierName)
                        .filter(Boolean)
                    )
                  ).join(", ") || "-";
                return (
                  <tr key={k}>
                    <td className="px-4 py-2">
                      {renderProductIdentity({
                        product,
                        name: p.name,
                        secondaryText:
                          p.lines && p.lines.length > 0
                            ? `Supplier: ${supplierNames}`
                            : undefined,
                      })}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {p.qty}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {unitPrice ? unitPrice.toLocaleString("id-ID") : "-"}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {Number(p.total || 0).toLocaleString("id-ID")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(() => {
            const grandPerBarang = Object.keys(rekapPerBarangData).reduce(
              (s: any, k) => s + (Number(rekapPerBarangData[k].total) || 0),
              0
            );
            const keys = Object.keys(rekapPerBarangData);
            const daysCount = keys.length || 1;
            const avgPer = daysCount
              ? Math.round((grandPerBarang || 0) / daysCount)
              : 0;
            return (
              <div className="mt-3">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">
                      Total {keys.length}-Item
                    </div>
                    <div className="font-semibold text-gray-900">
                      {periodLabel}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Grand Total</div>
                    <div className="font-semibold text-green-700">
                      Rp {Number(grandPerBarang).toLocaleString("id-ID")}
                    </div>
                    <div className="flex items-center justify-end gap-4 mt-2 text-sm text-gray-600">
                      <div className="text-gray-500">Rata-rata / item</div>
                      <div className="font-medium text-gray-900">
                        Rp {Number(avgPer).toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  // Calculate totals whenever items change
  const [purchaseSubtotal, setPurchaseSubtotal] = useState(0);
  // const [purchaseTax, setPurchaseTax] = useState(0);
  const [purchaseTotal, setPurchaseTotal] = useState(0);

  // State untuk print price list
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedProductsForPrint, setSelectedProductsForPrint] = useState<
    string[]
  >([]);
  const [selectAllProducts, setSelectAllProducts] = useState(false);
  const [selectLowStockProducts, setSelectLowStockProducts] = useState(false);

  // State untuk modal pemilihan produk pada form Purchase Order
  const [showProductSelectModal, setShowProductSelectModal] = useState<{
    open: boolean;
    index: number | null;
    forOpname?: boolean;
  }>({ open: false, index: null, forOpname: false });
  const [productSearchTerm, setProductSearchTerm] = useState("");

  // State untuk Stock Card modal
  const [showStockCard, setShowStockCard] = useState(false);
  const [stockCardProduct, setStockCardProduct] = useState<any | null>(null);
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [stockHistoryLoading, setStockHistoryLoading] = useState(false);
  const [stockHistoryError, setStockHistoryError] = useState<string | null>(
    null
  );
  // pagination for stock history
  const [historyPage, setHistoryPage] = useState<number>(0);
  const HISTORY_PAGE_SIZE = 10;

  const filteredProductsForSelect = React.useMemo(() => {
    const term = productSearchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => {
      const byName = (p.name || "").toLowerCase().includes(term);
      const byCat = (p.category || "").toLowerCase().includes(term);
      const byBarcode = (p.barcode || "").toLowerCase().includes(term);
      return byName || byCat || byBarcode;
    });
  }, [productSearchTerm, products]);

  // State untuk modal pemilihan supplier pada form Purchase Order
  const [showSupplierSelectModal, setShowSupplierSelectModal] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const filteredSuppliersForSelect = React.useMemo(() => {
    const term = supplierSearchTerm.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter((s: any) => {
      const byName = (s.name || "").toLowerCase().includes(term);
      const byContact = (s.contact_person || "").toLowerCase().includes(term);
      const byPhone = (s.phone || "").toLowerCase().includes(term);
      return byName || byContact || byPhone;
    });
  }, [supplierSearchTerm, suppliers]);

  // Update totals when items change
  useEffect(() => {
    const subtotal = newPurchase.items.reduce(
      (sum, item) => sum + item.total,
      0
    );
    // const tax = subtotal * 0.1; // 10% tax
    const total = subtotal;

    setPurchaseSubtotal(subtotal);
    // setPurchaseTax(tax);
    setPurchaseTotal(total);
  }, [newPurchase.items]);

  // Fetch products from Supabase
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await db.products.getAll();
        setProducts(data || []);
      } catch (error: any) {
        Swal.fire({
          icon: "error",
          title: "Gagal memuat produk",
          text:
            error.message || "Terjadi kesalahan saat mengambil data produk.",
        });
      }
    };
    fetchProducts();

    const subscription = supabase
      .channel("products_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        () => {
          fetchProducts();
        }
      )
      .subscribe();
    // expose for refresh
    (window as any).refreshProducts = fetchProducts;

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch suppliers from Supabase
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const data = await db.suppliers.getAll();
        setSuppliers(data || []);
      } catch (error: any) {
        Swal.fire({
          icon: "error",
          title: "Gagal memuat supplier",
          text:
            error.message || "Terjadi kesalahan saat mengambil data supplier.",
        });
      }
    };
    fetchSuppliers();
    (window as any).refreshSuppliers = fetchSuppliers;
  }, []);

  // Fetch purchase orders dari Supabase
  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        const data = await db.purchases.getAll();
        setPurchaseOrders(data || []);
      } catch (error: any) {
        Swal.fire({
          icon: "error",
          title: "Gagal memuat daftar pembelian",
          text:
            error.message || "Terjadi kesalahan saat mengambil data pembelian.",
        });
      }
    };
    fetchPurchases();
    (window as any).refreshPurchases = fetchPurchases;
  }, []);

  // State and fetch for sales (cashier transactions of type 'sale')
  const [sales, setSales] = useState<any[]>([]);
  // expanded product in Sales Summary (moved to top-level to avoid hook order mismatch)
  const [expandedSalesProductKey, setExpandedSalesProductKey] = useState<
    string | null
  >(null);
  // expanded products within date-based report (key = `${dateKey}::${productKey}`)
  const [expandedDateProducts, setExpandedDateProducts] = useState<Set<string>>(
    new Set()
  );
  // expanded dates for per-date report (key = dateKey)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  useEffect(() => {
    const fetchSales = async () => {
      try {
        // fetch cashier transactions where type is 'sale'
        const rows = (await db.select("cashier_transactions", "*", {
          type: "sale",
        })) as any[];
        setSales(rows || []);
      } catch (err: any) {
        console.error("Gagal mengambil data penjualan", err?.message || err);
        setSales([]);
      }
    };
    fetchSales();
    (window as any).refreshSales = fetchSales;
  }, []);

  // Helper: mapping DB fields to UI fields for purchases
  // function mapPurchaseFromDb(p: any) {
  //   return {
  //     id: p.id,
  //     poNumber: p.po_number || p.poNumber || '-',
  //     supplier_id: p.supplier_id,
  //     orderDate: p.order_date || p.orderDate,
  //     expectedDate: p.expected_date || p.expectedDate,
  //     status: p.status || 'pending',
  //     notes: p.notes,
  //     totalAmount: p.total_amount || p.totalAmount,
  //     createdBy: p.created_by || p.createdBy,
  //     // items: p.items || [] // items will be fetched separately if needed
  //   };
  // }

  // Buka modal edit dan isi data produk
  useEffect(() => {
    if (showEditForm) {
      const prod = products.find((p) => p.id === showEditForm);
      if (prod) setEditProduct({ ...prod });
    } else {
      setEditProduct(null);
    }
  }, [showEditForm, products]);

  // Buka modal edit supplier dan isi data
  useEffect(() => {
    if (showEditSupplierForm) {
      const sup = suppliers.find((s) => s.id === showEditSupplierForm);
      if (sup) setEditSupplier({ ...sup });
    } else {
      setEditSupplier(null);
    }
  }, [showEditSupplierForm, suppliers]);

  // Fetch item PO saat detail PO dibuka
  useEffect(() => {
    const fetchItems = async () => {
      if (!selectedPurchase) {
        setPurchaseOrderItems([]);
        setPurchaseItemsError(null);
        return;
      }
      setLoadingPurchaseItems(true);
      setPurchaseItemsError(null);
      try {
        const items = await db.select("purchase_order_items", "*", {
          po_id: selectedPurchase,
        });
        setPurchaseOrderItems(items || []);
      } catch (err: any) {
        setPurchaseItemsError(err?.message || "Gagal memuat item PO");
        setPurchaseOrderItems([]);
      } finally {
        setLoadingPurchaseItems(false);
      }
    };
    fetchItems();
  }, [selectedPurchase]);

  const categories = [
    { value: "all", label: "Semua Kategori" },
    { value: "beverage", label: "Minuman" },
    { value: "food", label: "Makanan" },
    { value: "snack", label: "Snack" },
    { value: "other", label: "Lainnya" },
  ];

  const productTypes = [
    { value: "all", label: "Semua Tipe" },
    { value: "finished_good", label: "Produk Jadi" },
    { value: "raw_material", label: "Bahan Baku" },
  ];

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.includes(searchTerm);
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    const matchesProductType =
      selectedProductType === "all" ||
      product.product_type === selectedProductType;
    return matchesSearch && matchesCategory && matchesProductType;
  });

  // const filteredPurchases = mockPurchaseOrders.filter(purchase => {
  //   const supplier = mockSuppliers.find(s => s.id === purchase.supplierId);
  //   return supplier?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     purchase.poNumber.toLowerCase().includes(searchTerm.toLowerCase());
  // });

  // Ganti filteredSuppliers agar pakai data dari database
  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.contact_person.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPurchaseOrders = purchaseOrders.filter((po) => {
    // Filter status
    const statusMatch =
      purchaseStatus === "all" || po.status === purchaseStatus;

    // Hitung periode tanggal berdasarkan preset (gunakan daftarPeriod untuk subtab Daftar)
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
        const diff = (day === 0 ? -6 : 1) - day; // Senin awal minggu
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
    const supplier = suppliers.find((s) => s.id === po.supplier_id);
    const searchMatch =
      po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return statusMatch && dateMatch && searchMatch;
  });

  // Filtered list for the Daftar Pembelian subtab (uses independent filter state)
  const filteredPurchaseOrdersForDaftar = purchaseOrders.filter((po) => {
    // Filter status (same as before)
    const statusMatch =
      purchaseStatus === "all" || po.status === purchaseStatus;

    // Hitung periode tanggal berdasarkan preset (use daftarPeriod/daftarDateRange)
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
        const diff = (day === 0 ? -6 : 1) - day; // Senin awal minggu
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

    // Filter search (use daftarSearch)
    const supplier = suppliers.find((s) => s.id === po.supplier_id);
    const searchMatch =
      po.po_number?.toLowerCase().includes(daftarSearch.toLowerCase()) ||
      supplier?.name?.toLowerCase().includes(daftarSearch.toLowerCase());

    return statusMatch && dateMatch && searchMatch;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "beverage":
        return "bg-blue-100 text-blue-800";
      case "food":
        return "bg-orange-100 text-orange-800";
      case "snack":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getProductTypeInfo = (productType: string) => {
    switch (productType) {
      case "finished_good":
        return {
          label: "Produk Jadi",
          color: "bg-purple-100 text-purple-800",
        };
      case "raw_material":
        return {
          label: "Bahan Baku",
          color: "bg-amber-100 text-amber-800",
        };
      default:
        return {
          label: "Lainnya",
          color: "bg-gray-100 text-gray-800",
        };
    }
  };

  // const getStatusColor = (status: string) => {
  //   switch (status) {
  //     case "pending":
  //       return "bg-yellow-100 text-yellow-800";
  //     case "ordered":
  //       return "bg-blue-100 text-blue-800";
  //     case "received":
  //       return "bg-green-100 text-green-800";
  //     case "cancelled":
  //       return "bg-red-100 text-red-800";
  //     default:
  //       return "bg-gray-100 text-gray-800";
  //   }
  // };

  // const getStatusIcon = (status: string) => {
  //   switch (status) {
  //     case "pending":
  //       return <Clock className="h-4 w-4" />;
  //     case "ordered":
  //       return <Truck className="h-4 w-4" />;
  //     case "received":
  //       return <CheckCircle className="h-4 w-4" />;
  //     case "cancelled":
  //       return <XCircle className="h-4 w-4" />;
  //     default:
  //       return <Clock className="h-4 w-4" />;
  //   }
  // };

  const lowStockProducts = products.filter((p) => p.stock <= p.min_stock);
  const PRODUCT_IMAGE_MAX_SIZE = 2 * 1024 * 1024;

  const getProductImageUrl = (product: any) =>
    product?.image_url || product?.image || "";

  const getProductSecondaryText = (product: any) => {
    if (product?.description) return product.description;
    if (product?.barcode) return `Barcode: ${product.barcode}`;
    return `${product?.category || "produk"} • ${product?.unit || "pcs"}`;
  };

  const renderProductThumbnail = (product: any, sizeClass = "h-12 w-12") => {
    const imageUrl = getProductImageUrl(product);
    const fallbackLabel = String(product?.name || "P")
      .trim()
      .charAt(0)
      .toUpperCase();

    return (
      <div
        className={`${sizeClass} relative flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 shadow-sm`}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-300">
          <Package className="h-4 w-4" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {fallbackLabel}
          </span>
        </div>
        {imageUrl && (
          <img
            src={imageUrl}
            alt={product?.name || "Product image"}
            className="relative z-10 h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
      </div>
    );
  };

  const renderProductIdentity = ({
    product,
    name,
    secondaryText,
    sizeClass = "h-10 w-10",
    nameClassName = "font-medium text-gray-900",
    secondaryClassName = "text-xs text-gray-500",
  }: {
    product?: any;
    name: string;
    secondaryText?: string;
    sizeClass?: string;
    nameClassName?: string;
    secondaryClassName?: string;
  }) => (
    <div className="flex min-w-0 items-center gap-3">
      {product ? (
        renderProductThumbnail(product, sizeClass)
      ) : (
        <span
          className={`${sizeClass} flex flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs font-medium text-slate-400`}
        >
          -
        </span>
      )}
      <div className="min-w-0">
        <div className={`${nameClassName} truncate`}>{name}</div>
        {secondaryText && (
          <div className={`${secondaryClassName} truncate`}>
            {secondaryText}
          </div>
        )}
      </div>
    </div>
  );

  const uploadProductImage = async (file: File, mode: "new" | "edit") => {
    if (!file.type.startsWith("image/")) {
      Swal.fire("Error", "File harus berupa gambar", "error");
      return;
    }

    if (file.size > PRODUCT_IMAGE_MAX_SIZE) {
      Swal.fire("Error", "Ukuran gambar maksimal 2MB", "error");
      return;
    }

    try {
      const productId = mode === "edit" ? editProduct?.id : undefined;
      const oldImageUrl =
        mode === "edit" ? editProduct?.image_url : newProduct.image_url;
      const publicUrl = await storage.uploadProductImage(
        file,
        productId,
        oldImageUrl
      );

      if (mode === "edit") {
        setEditProduct((prev: any) =>
          prev
            ? {
                ...prev,
                image_url: publicUrl,
              }
            : prev
        );
      } else {
        setNewProduct((prev) => ({
          ...prev,
          image_url: publicUrl,
        }));
      }

      Swal.fire("Berhasil", "Gambar produk berhasil diupload", "success");
    } catch (error) {
      console.error("Upload product image error:", error);
      Swal.fire("Error", "Gagal mengupload gambar produk", "error");
    }
  };

  const addItemToPurchase = () => {
    const newItem = {
      productId: "",
      productName: "",
      quantity: 1,
      unitCost: 0,
      total: 0,
    };

    setNewPurchase((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const updatePurchaseItem = (index: number, field: string, value: any) => {
    setNewPurchase((prev) => {
      const updatedItems = [...prev.items];
      const item = { ...updatedItems[index] };

      // Update the specific field
      // @ts-expect-error: dynamic assignment
      item[field as keyof typeof item] = value;

      // Handle product selection
      if (field === "productId") {
        const product = products.find((p) => p.id === value);
        if (product) {
          item.productName = product.name;
          item.unitCost = product.cost;
          item.total = item.quantity * product.cost;
        } else {
          item.productName = "";
          item.unitCost = 0;
          item.total = 0;
        }
      }

      // Recalculate total when quantity or unitCost changes
      if (field === "quantity" || field === "unitCost") {
        item.total = item.quantity * item.unitCost;
      }

      updatedItems[index] = item;

      return {
        ...prev,
        items: updatedItems,
      };
    });
  };

  const removePurchaseItem = (index: number) => {
    setNewPurchase((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || newProduct.price <= 0) {
      Swal.fire({
        icon: "error",
        title: "Validasi Gagal",
        text: "Nama produk dan harga wajib diisi",
      });
      return;
    }

    // Here we would normally save to database
    try {
      const { error } = await db.products.create(newProduct);
      if (error) {
        // If there was an error while saving to the database
        Swal.fire({
          icon: "error",
          title: "Gagal!",
          text: `Terjadi kesalahan saat menambahkan produk: ${error.message}`,
        });
        return;
      }

      // If no error, show success message
      Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: `Produk ${newProduct.name} berhasil ditambahkan!`,
      });

      setProducts(await db.products.getAll());

      setNewProduct({
        name: "",
        category: "beverage",
        product_type: "finished_good",
        unit: "pcs",
        price: 0,
        cost: 0,
        stock: 0,
        min_stock: 0,
        barcode: "",
        image_url: "",
        description: "",
        is_active: true,
      });
      setShowAddForm(false);
    } catch (err) {
      console.error("Error saving product:", err);
      Swal.fire({
        icon: "error",
        title: "Terjadi Kesalahan!",
        text: "Gagal menambahkan produk. Silakan coba lagi.",
      });
    }
  };

  // Ubah handleAddSupplier agar simpan ke database dan refresh list
  const handleAddSupplier = async () => {
    if (!newSupplier.name?.trim() || !newSupplier.contact_person?.trim()) {
      Swal.fire({
        icon: "error",
        title: "Validasi Gagal",
        text: "Nama supplier dan kontak person wajib diisi",
      });
      return;
    }
    try {
      await db.suppliers.create(newSupplier);
      Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: `Supplier ${newSupplier.name} berhasil ditambahkan!`,
      });
      setShowSupplierForm(false);
      setNewSupplier({
        name: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "",
        category: "beverage",
      });
      if ((window as any).refreshSuppliers) (window as any).refreshSuppliers();
    } catch (error: any) {
      Swal.fire({
        icon: "error",
        title: "Gagal tambah supplier",
        text: error.message || "Terjadi kesalahan saat menambah supplier.",
      });
    }
  };

  const [editProduct, setEditProduct] = useState<any | null>(null);

  const handleEditProduct = async () => {
    if (!editProduct.name || editProduct.price <= 0) {
      Swal.fire({
        icon: "error",
        title: "Validasi Gagal",
        text: "Nama produk dan harga wajib diisi",
      });
      return;
    }
    try {
      await db.products.update(editProduct.id, {
        name: editProduct.name,
        category: editProduct.category,
        product_type: editProduct.product_type,
        unit: editProduct.unit,
        price: editProduct.price,
        cost: editProduct.cost,
        stock: editProduct.stock,
        min_stock: editProduct.min_stock,
        barcode: editProduct.barcode,
        image_url: editProduct.image_url,
        description: editProduct.description,
        is_active: editProduct.is_active,
      });

      Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: `Produk ${editProduct.name} berhasil diupdate!`,
      });
      setShowEditForm(null);
      // Refresh produk
      if ((window as any).refreshProducts) (window as any).refreshProducts();
    } catch (error: any) {
      Swal.fire({
        icon: "error",
        title: "Gagal update",
        text: error.message || "Terjadi kesalahan saat update produk.",
      });
    }
  };

  // Edit supplier
  const handleEditSupplier = async () => {
    // Cek null/undefined dan string kosong
    if (
      !editSupplier ||
      !editSupplier.name?.trim() ||
      !editSupplier.contact_person?.trim()
    ) {
      Swal.fire({
        icon: "error",
        title: "Validasi Gagal",
        text: "Nama supplier dan kontak person wajib diisi",
      });
      return;
    }
    try {
      await db.suppliers.update(editSupplier.id, editSupplier);
      Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: "Supplier berhasil diupdate!",
      });
      setShowEditSupplierForm(null);
      if ((window as any).refreshSuppliers) (window as any).refreshSuppliers();
    } catch (error: any) {
      Swal.fire({
        icon: "error",
        title: "Gagal update supplier",
        text: error.message || "Terjadi kesalahan saat update supplier.",
      });
    }
  };

  const handleDeleteProduct = async (product: any) => {
    const result = await Swal.fire({
      title: `Hapus produk?`,
      text: `Yakin ingin menghapus produk ${product.name}? Data tidak dapat dikembalikan!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
    });
    if (result.isConfirmed) {
      try {
        if (product.image_url) {
          await storage.deleteProductImage(product.image_url);
        }
        await db.delete("products", product.id);
        Swal.fire(
          "Terhapus!",
          `Produk ${product.name} berhasil dihapus.`,
          "success"
        );
        if ((window as any).refreshProducts)
          await (window as any).refreshProducts();
      } catch (error: any) {
        Swal.fire("Gagal", error.message || "Gagal menghapus produk.", "error");
      }
    }
  };

  // Placeholder: buka kartu stok untuk produk
  const handleOpenStockCard = (product: any) => {
    // open React modal instead of Swal to allow richer UI
    setStockCardProduct(product);
    setShowStockCard(true);
    // fetch history
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

      // 1) incoming: purchase_order_items (assume field 'quantity' and 'created_at' or similar)
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
              quantity: qty, // positive = masuk
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
        // table might not exist or other error - ignore
      }

      // 2) outgoing: cashier_transactions (type = 'sale' or 'rental' etc.) - parse details JSON to find product quantities
      try {
        const { data: txs, error } = await supabase
          .from("cashier_transactions")
          .select("*")
          .in("type", ["sale", "stock_reduction"]);

        if (error) throw error;
        if (Array.isArray(txs) && txs.length > 0) {
          for (const tx of txs as any[]) {
            const details = (tx as any).details;
            let parsed: any = details;
            if (
              !parsed &&
              (tx as any).details &&
              typeof (tx as any).details === "string"
            ) {
              try {
                parsed = JSON.parse((tx as any).details);
              } catch (e) {
                parsed = null;
              }
            }

            // try several shapes: array of items, { items: [...] }, { products: [...] }
            const candidates = [] as any[];
            if (Array.isArray(parsed)) candidates.push(...parsed);
            if (parsed && Array.isArray(parsed.items))
              candidates.push(...parsed.items);
            if (parsed && Array.isArray(parsed.products))
              candidates.push(...parsed.products);
            if (parsed && Array.isArray(parsed.cart))
              candidates.push(...parsed.cart);

            // also some systems store details as object with keys being ids
            if (
              candidates.length === 0 &&
              parsed &&
              typeof parsed === "object"
            ) {
              // attempt to collect values that look like items
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
                  quantity: -Math.abs(qty), // negative = keluar
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

      // 3) outgoing: assembly_logs (raw material usage in assembly process)
      try {
        const { data: assemblyLogs } = await supabase.from("assembly_logs")
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

      // 4) stock opname adjustments (stock adjustments from opname sessions)
      try {
        const { data: opnameSessions } = await supabase
          .from("stock_opname_sessions")
          .select(
            `
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
          `
          )
          .eq("stock_opname_items.product_id", productId);

        if (Array.isArray(opnameSessions) && opnameSessions.length > 0) {
          for (const session of opnameSessions as any[]) {
            const sessionItems = session.stock_opname_items || [];
            for (const item of sessionItems) {
              if (String(item.product_id) === String(productId)) {
                // Calculate adjustment: physical_stock - system_stock
                const adjustment =
                  Number(item.physical_stock || 0) -
                  Number(item.system_stock || 0);

                if (adjustment !== 0) {
                  // Only add if there's actual adjustment
                  rows.push({
                    id: `opname_${session.id}_${item.product_id}`,
                    product_id: productId,
                    quantity: adjustment, // positive = stock increase, negative = stock decrease
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
        // ignore if table missing or error - for backward compatibility
      }

      if (rows.length === 0) {
        setStockHistory([]);
        setStockHistoryLoading(false);
        return;
      }

      // sort ascending (oldest -> newest)
      rows.sort(
        (a: any, b: any) =>
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

      // store newest-first for UI (existing code expects newest-first then we reverse when rendering)
      setStockHistory(withBalance);
    } catch (error: any) {
      setStockHistoryError(error?.message || String(error));
    } finally {
      setStockHistoryLoading(false);
    }
  };

  // reset page when history or product changes
  useEffect(() => {
    setHistoryPage(0);
  }, [stockHistory, stockCardProduct]);

  // Delete supplier
  const handleDeleteSupplier = async (supplier: any) => {
    // Cek apakah ada produk yang masih terkait dengan supplier ini
    const relatedProducts = products.filter(
      (p) => p.supplier_id === supplier.id
    );
    if (relatedProducts.length > 0) {
      Swal.fire({
        icon: "error",
        title: "Tidak bisa hapus supplier",
        text: `Masih ada ${relatedProducts.length} produk yang terkait dengan supplier ini. Hapus atau pindahkan produk terlebih dahulu.`,
      });
      return;
    }
    const result = await Swal.fire({
      title: `Hapus supplier?`,
      text: `Yakin ingin menghapus supplier ${supplier.name}? Data tidak dapat dikembalikan!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
    });
    if (result.isConfirmed) {
      try {
        await db.suppliers.delete(supplier.id);
        Swal.fire(
          "Terhapus!",
          `Supplier ${supplier.name} berhasil dihapus.`,
          "success"
        );
        if ((window as any).refreshSuppliers)
          await (window as any).refreshSuppliers();
      } catch (error: any) {
        Swal.fire(
          "Gagal",
          error.message || "Gagal menghapus supplier.",
          "error"
        );
      }
    }
  };

  const [productView, setProductView] = useState<"card" | "list">("list");
  const [productSortBy, setProductSortBy] = useState<string | null>(null);
  const [productSortOrder, setProductSortOrder] = useState<"asc" | "desc">(
    "asc"
  );
  const [productGroupBy, setProductGroupBy] = useState<
    "none" | "category" | "product_type"
  >("none");
  const [expandedProductGroups, setExpandedProductGroups] = useState<
    Record<string, boolean>
  >({});
  const [isLowStockAccordionOpen, setIsLowStockAccordionOpen] =
    useState(false);
  const [supplierView, setSupplierView] = useState<"card" | "list">("card");

  const handleProductSort = (columnKey: string) => {
    if (productSortBy === columnKey) {
      setProductSortOrder(productSortOrder === "asc" ? "desc" : "asc");
    } else {
      setProductSortBy(columnKey);
      setProductSortOrder("asc");
    }
  };

  const getSortedFilteredProducts = () => {
    if (!productSortBy) return filteredProducts;

    return [...filteredProducts].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (productSortBy) {
        case "stock_value":
          aValue = Number(a.cost || 0) * Number(a.stock || 0);
          bValue = Number(b.cost || 0) * Number(b.stock || 0);
          break;
        default:
          aValue = a[productSortBy as keyof typeof a];
          bValue = b[productSortBy as keyof typeof b];
          break;
      }

      if (aValue === null || aValue === undefined) aValue = "";
      if (bValue === null || bValue === undefined) bValue = "";

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (aValue < bValue) return productSortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return productSortOrder === "asc" ? 1 : -1;
      return 0;
    });
  };

  const sortedFilteredProducts = getSortedFilteredProducts();
  const productGroupByLabel =
    productGroupBy === "category"
      ? "Kategori"
      : productGroupBy === "product_type"
        ? "Tipe Produk"
        : "Tanpa Grouping";
  const groupedSortedProducts: Record<string, any[]> =
    productGroupBy === "none"
      ? {}
      : sortedFilteredProducts.reduce<Record<string, any[]>>((groups, product) => {
          const rawGroupValue =
            productGroupBy === "category"
              ? product.category
              : getProductTypeInfo(product.product_type).label;
          const groupKey = rawGroupValue || "Tanpa Grup";

          if (!groups[groupKey]) groups[groupKey] = [];
          groups[groupKey].push(product);
          return groups;
        }, {});
  const groupedSortedProductEntries: Array<[string, any[]]> = Object.entries(
    groupedSortedProducts
  );

  const toggleProductGroup = (groupName: string) => {
    setExpandedProductGroups((prev) => ({
      ...prev,
      [groupName]: prev[groupName] === false,
    }));
  };

  useEffect(() => {
    if (productGroupBy === "none") {
      setExpandedProductGroups({});
      return;
    }

    setExpandedProductGroups((prev) => {
      const nextState: Record<string, boolean> = {};
      for (const [groupName] of groupedSortedProductEntries) {
        nextState[groupName] = prev[groupName] ?? true;
      }
      return nextState;
    });
  }, [
    productGroupBy,
    groupedSortedProductEntries.length,
    searchTerm,
    selectedCategory,
    selectedProductType,
    productSortBy,
    productSortOrder,
  ]);

  const ProductSortHeader = ({
    label,
    sortKey,
    align = "left",
  }: {
    label: string;
    sortKey: string;
    align?: "left" | "right";
  }) => (
    <button
      onClick={() => handleProductSort(sortKey)}
      className={`flex items-center gap-2 hover:text-gray-900 transition-colors ${
        align === "right" ? "ml-auto" : ""
      }`}
      type="button"
    >
      {label}
      {productSortBy === sortKey &&
        (productSortOrder === "asc" ? (
          <ArrowUp className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ArrowDown className="h-4 w-4 flex-shrink-0" />
        ))}
    </button>
  );

  const renderProductsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manajemen Produk</h2>
          <p className="text-gray-600">Kelola inventory produk cafe</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProductView("card")}
            className={`p-2 rounded-lg border ${
              productView === "card"
                ? "bg-blue-100 border-blue-400 text-blue-600"
                : "border-gray-200 text-gray-400 hover:text-blue-600"
            }`}
            aria-label="Tampilan Card"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
          <button
            onClick={() => setProductView("list")}
            className={`p-2 rounded-lg border ${
              productView === "list"
                ? "bg-blue-100 border-blue-400 text-blue-600"
                : "border-gray-200 text-gray-400 hover:text-blue-600"
            }`}
            aria-label="Tampilan List"
          >
            <ListIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowStockReductionForm(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Minus className="h-5 w-5" />
            Gunakan Stok
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ml-2"
          >
            <Plus className="h-5 w-5" />
            Tambah Produk
          </button>
          <button
            onClick={() => setShowPrintModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ml-2"
          >
            <Printer className="h-5 w-5" />
            Print Price List
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5">
          <label
            htmlFor="product-search"
            className="block mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
          >
            Pencarian
          </label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 cursor-pointer"
              onClick={() => setSearchTerm("")}
            />
            <input
              id="product-search"
              type="text"
              placeholder="Cari produk atau barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="product-category-filter"
            className="block mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
          >
            Kategori
          </label>
          <select
            id="product-category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="product-type-filter"
            className="block mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
          >
            Tipe Produk
          </label>
          <select
            id="product-type-filter"
            value={selectedProductType}
            onChange={(e) => setSelectedProductType(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {productTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label
            htmlFor="product-group-by"
            className="block mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
          >
            Grouping
          </label>
          <select
            id="product-group-by"
            value={productGroupBy}
            onChange={(e) =>
              setProductGroupBy(
                e.target.value as "none" | "category" | "product_type"
              )
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="none">Tanpa Grouping</option>
            <option value="category">Grouping: Kategori</option>
            <option value="product_type">Grouping: Tipe Produk</option>
          </select>
          
        </div>
      </div>

      {/* Low Stock Alert */}
      {(() => {
        const rawMaterialLowStock = products.filter(
          (product) =>
            product.product_type === "raw_material" &&
            Number(product.stock || 0) <= Number(product.min_stock || 0)
        );

        if (rawMaterialLowStock.length === 0) return null;

        return (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setIsLowStockAccordionOpen((prev) => !prev)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-orange-100/60 transition-colors"
              aria-expanded={isLowStockAccordionOpen}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-orange-800">
                  Bahan Baku Stok Rendah
                </h3>
                <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                  {rawMaterialLowStock.length} item
                </span>
              </div>
              <ChevronRight
                className={`h-4 w-4 text-orange-700 transform transition-transform ${
                  isLowStockAccordionOpen ? "rotate-90" : "rotate-0"
                }`}
              />
            </button>

            {isLowStockAccordionOpen && (
              <div className="p-4 border-t border-orange-200">
                <div className="bg-white border border-orange-100 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-orange-50 text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                    <div className="col-span-6">Nama Barang</div>
                    <div className="col-span-3 text-right">Stok</div>
                    <div className="col-span-3 text-right">Min. Stok</div>
                  </div>
                  <ul className="divide-y divide-orange-100">
                    {rawMaterialLowStock.map((product) => (
                      <li key={product.id} className="grid grid-cols-12 gap-3 px-4 py-3">
                        <div className="col-span-6 font-medium text-gray-900">{product.name}</div>
                        <div className="col-span-3 text-right text-sm text-red-600 font-semibold">
                          {product.stock || 0} {product.unit || "pcs"}
                        </div>
                        <div className="col-span-3 text-right text-sm text-gray-600">
                          {product.min_stock || 0} {product.unit || "pcs"}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {showStockCard && stockCardProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Kartu Stok {stockCardProduct.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Riwayat pergerakan stok untuk produk ini.
                  </p>
                </div>
                <button
                  onClick={() => setShowStockCard(false)}
                  className="text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Stok Saat Ini
                  </p>
                  <p className="mt-2 text-2xl font-bold text-blue-600">
                    {stockCardProduct.stock || 0} {stockCardProduct.unit || "pcs"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Min. Stok
                  </p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {stockCardProduct.min_stock || 0} {stockCardProduct.unit || "pcs"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Nilai Stok
                  </p>
                  <p className="mt-2 text-2xl font-bold text-green-600">
                    Rp{" "}
                    {(
                      Number(stockCardProduct.stock || 0) *
                      Number(stockCardProduct.cost || 0)
                    ).toLocaleString("id-ID")}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h4 className="font-semibold text-gray-900">Riwayat Pergerakan</h4>
                </div>

                {stockHistoryLoading ? (
                  <div className="p-6 text-center text-gray-500">Memuat riwayat stok...</div>
                ) : stockHistoryError ? (
                  <div className="p-6 text-center text-red-600">{stockHistoryError}</div>
                ) : stockHistory.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">Belum ada riwayat stok.</div>
                ) : (
                  (() => {
                    const rev = [...stockHistory].reverse();
                    const totalPages = Math.max(
                      1,
                      Math.ceil(rev.length / HISTORY_PAGE_SIZE)
                    );
                    const page = Math.min(historyPage, totalPages - 1);
                    const start = page * HISTORY_PAGE_SIZE;
                    const paged = rev.slice(start, start + HISTORY_PAGE_SIZE);
                    const earliestRow = rev[rev.length - 1];
                    const startBalance = earliestRow
                      ? Number(earliestRow._balance || 0) - Number(earliestRow._qty || 0)
                      : Number(stockCardProduct.stock || 0);

                    return (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <tr>
                              <th className="px-4 py-3 text-left">Tanggal</th>
                              <th className="px-4 py-3 text-right">Keluar</th>
                              <th className="px-4 py-3 text-right">Masuk</th>
                              <th className="px-4 py-3 text-right">Saldo</th>
                              <th className="px-4 py-3 text-left">Catatan</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            <tr className="bg-blue-50/60">
                              <td className="px-4 py-3 text-sm font-medium text-gray-700">
                                Saldo Awal
                              </td>
                              <td className="px-4 py-3 text-right">-</td>
                              <td className="px-4 py-3 text-right">-</td>
                              <td className="px-4 py-3 text-right font-semibold">
                                {startBalance}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">Posisi awal histori</td>
                            </tr>
                            {paged.map((row) => (
                              <tr key={row.id || `${row.created_at}-${row._qty}`}>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {new Date(row.created_at).toLocaleString("id-ID", {
                                    timeZone: "Asia/Jakarta",
                                  })}
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-gray-700">
                                  {row._qty < 0 ? Math.abs(row._qty) : "-"}
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-gray-700">
                                  {row._qty > 0 ? row._qty : "-"}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                                  {row._balance}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {row.note || row.notes || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                          <div className="text-xs text-gray-500">
                            Menampilkan {start + 1} - {Math.min(start + HISTORY_PAGE_SIZE, rev.length)} dari {rev.length} entri
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setHistoryPage((prev) => Math.max(0, prev - 1))}
                              disabled={page === 0}
                              className={`px-3 py-1 rounded-lg border ${
                                page === 0
                                  ? "text-gray-400 border-gray-200"
                                  : "text-gray-700 border-gray-300 hover:bg-gray-50"
                              }`}
                              type="button"
                            >
                              Prev
                            </button>
                            <button
                              onClick={() =>
                                setHistoryPage((prev) => Math.min(totalPages - 1, prev + 1))
                              }
                              disabled={page >= totalPages - 1}
                              className={`px-3 py-1 rounded-lg border ${
                                page >= totalPages - 1
                                  ? "text-gray-400 border-gray-200"
                                  : "text-gray-700 border-gray-300 hover:bg-gray-50"
                              }`}
                              type="button"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowStockCard(false)}
                className="px-6 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white"
                type="button"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid/List */}
      {sortedFilteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          Tidak ada produk yang cocok dengan filter saat ini.
        </div>
      ) : productGroupBy !== "none" && productView === "card" ? (
        <div className="space-y-6">
          {groupedSortedProductEntries.map(([groupName, groupProducts]) => (
            <div
              key={groupName}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleProductGroup(groupName)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-slate-50 hover:bg-slate-100 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <ChevronRight
                    className={`h-4 w-4 text-slate-500 transform transition-transform ${
                      expandedProductGroups[groupName] === false
                        ? "rotate-0"
                        : "rotate-90"
                    }`}
                  />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {productGroupBy === "category" ? "Kategori" : "Tipe Produk"}
                    </p>
                    <h4 className="text-sm font-bold text-slate-900">{groupName}</h4>
                  </div>
                </div>
                <div className="text-sm text-slate-600">{groupProducts.length} produk</div>
              </button>

              {expandedProductGroups[groupName] !== false && (
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {groupProducts.map((product) => {
                    const productTypeInfo = getProductTypeInfo(product.product_type);

                    return (
                      <div
                        key={product.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="p-4 border-b border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                                product.category
                              )}`}
                            >
                              {product.category}
                            </span>
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${productTypeInfo.color}`}
                            >
                              {productTypeInfo.label}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setShowEditForm(product.id)}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                type="button"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleOpenStockCard(product)}
                                title="Kartu Stok"
                                className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                                type="button"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  className="h-4 w-4"
                                >
                                  <path d="M3 3h18v2H3V3zm2 6h14v2H5V9zm0 6h8v2H5v-2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                type="button"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 flex items-start gap-3">
                            {renderProductThumbnail(product, "h-14 w-14")}
                            <div className="min-w-0 flex-1 pt-0.5">
                              <h3 className="font-semibold text-gray-900 mb-1 truncate">
                                {product.name}
                              </h3>
                              <p className="text-sm text-gray-600 line-clamp-2 leading-5">
                                {getProductSecondaryText(product)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-4">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-xs text-gray-500">Harga Jual</p>
                                <p className="font-semibold text-green-600">
                                  Rp {product.price.toLocaleString("id-ID")}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Modal</p>
                                <p className="font-medium text-gray-700">
                                  Rp {product.cost.toLocaleString("id-ID")}
                                </p>
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-xs text-gray-500">Stok Tersedia</p>
                                <p
                                  className={`font-semibold ${
                                    product.stock <= product.min_stock
                                      ? "text-red-600"
                                      : "text-blue-600"
                                  }`}
                                >
                                  {product.stock} {product.unit}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Min. Stok</p>
                                <p className="font-medium text-gray-700">
                                  {product.min_stock} {product.unit}
                                </p>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-gray-100">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Margin Keuntungan</span>
                                <span className="font-semibold text-purple-600">
                                  {product.price > 0
                                    ? Math.round(
                                        ((product.price - product.cost) / product.price) * 100
                                      )
                                    : 0}
                                  %
                                </span>
                              </div>
                            </div>

                            {product.barcode && (
                              <div className="pt-2">
                                <p className="text-xs text-gray-500">Barcode</p>
                                <p className="font-mono text-sm text-gray-700">{product.barcode}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : productView === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedFilteredProducts.map((product) => {
            const productTypeInfo = getProductTypeInfo(product.product_type);

            return (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                        product.category
                      )}`}
                    >
                      {product.category}
                    </span>
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${productTypeInfo.color}`}
                    >
                      {productTypeInfo.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowEditForm(product.id)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        type="button"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleOpenStockCard(product)}
                        title="Kartu Stok"
                        className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                        type="button"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-4 w-4"
                        >
                          <path d="M3 3h18v2H3V3zm2 6h14v2H5V9zm0 6h8v2H5v-2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-start gap-3">
                    {renderProductThumbnail(product, "h-14 w-14")}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <h3 className="font-semibold text-gray-900 mb-1 truncate">
                        {product.name}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2 leading-5">
                        {getProductSecondaryText(product)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-500">Harga Jual</p>
                        <p className="font-semibold text-green-600">
                          Rp {product.price.toLocaleString("id-ID")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Modal</p>
                        <p className="font-medium text-gray-700">
                          Rp {product.cost.toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-500">Stok Tersedia</p>
                        <p
                          className={`font-semibold ${
                            product.stock <= product.min_stock
                              ? "text-red-600"
                              : "text-blue-600"
                          }`}
                        >
                          {product.stock} {product.unit}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Min. Stok</p>
                        <p className="font-medium text-gray-700">
                          {product.min_stock} {product.unit}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Margin Keuntungan</span>
                        <span className="font-semibold text-purple-600">
                          {product.price > 0
                            ? Math.round(
                                ((product.price - product.cost) / product.price) * 100
                              )
                            : 0}
                          %
                        </span>
                      </div>
                    </div>

                    {product.barcode && (
                      <div className="pt-2">
                        <p className="text-xs text-gray-500">Barcode</p>
                        <p className="font-mono text-sm text-gray-700">{product.barcode}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <ProductSortHeader label="Nama" sortKey="name" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <ProductSortHeader label="Kategori" sortKey="category" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <ProductSortHeader label="Barcode" sortKey="barcode" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <ProductSortHeader label="Tipe Produk" sortKey="product_type" />
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <ProductSortHeader label="Min. Stok" sortKey="min_stock" align="right" />
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <ProductSortHeader label="Stok" sortKey="stock" align="right" />
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <ProductSortHeader label="Modal" sortKey="cost" align="right" />
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <ProductSortHeader label="Nilai Stok" sortKey="stock_value" align="right" />
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <ProductSortHeader label="Harga Jual" sortKey="price" align="right" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {productGroupBy !== "none"
                ? groupedSortedProductEntries.map(([groupName, groupProducts]) => (
                    <React.Fragment key={groupName}>
                      <tr className="bg-slate-100/80">
                        <td colSpan={10} className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleProductGroup(groupName)}
                            className="w-full flex items-center justify-between gap-4 text-left"
                          >
                            <div className="flex items-center gap-3">
                              <ChevronRight
                                className={`h-4 w-4 text-slate-500 transform transition-transform ${
                                  expandedProductGroups[groupName] === false
                                    ? "rotate-0"
                                    : "rotate-90"
                                }`}
                              />
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                  {productGroupBy === "category" ? "Kategori" : "Tipe Produk"}
                                </p>
                                <h4 className="text-sm font-bold text-slate-900">{groupName}</h4>
                              </div>
                            </div>
                            <div className="text-sm text-slate-600">{groupProducts.length} produk</div>
                          </button>
                        </td>
                      </tr>
                      {expandedProductGroups[groupName] !== false &&
                        groupProducts.map((product) => {
                          const productTypeInfo = getProductTypeInfo(product.product_type);

                          return (
                            <tr key={product.id}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  {renderProductThumbnail(product, "h-11 w-11")}
                                  <div className="min-w-0">
                                    <div className="font-medium text-gray-900 truncate">
                                      {product.name}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate mt-0.5 max-w-[220px]">
                                      {getProductSecondaryText(product)}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                                    product.category
                                  )}`}
                                >
                                  {product.category}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-gray-700">
                                {product.barcode || "-"}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${productTypeInfo.color}`}
                                >
                                  {productTypeInfo.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">{product.min_stock}</td>
                              <td
                                className={`px-4 py-3 font-semibold text-right ${
                                  product.stock <= product.min_stock
                                    ? "text-red-600"
                                    : "text-blue-600"
                                }`}
                              >
                                {product.stock} {product.unit}
                              </td>
                              <td className="px-4 py-3 text-gray-700 text-right">
                                Rp {product.cost.toLocaleString("id-ID")}
                              </td>
                              <td className="px-4 py-3 font-semibold text-gray-700 text-right">
                                Rp {(product.cost * product.stock).toLocaleString("id-ID")}
                              </td>
                              <td className="px-4 py-3 text-green-600 font-semibold text-right">
                                Rp {product.price.toLocaleString("id-ID")}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setShowEditForm(product.id)}
                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                    title="Edit"
                                    type="button"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenStockCard(product)}
                                    title="Kartu Stok"
                                    className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                                    type="button"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                      className="h-4 w-4"
                                    >
                                      <path d="M3 3h18v2H3V3zm2 6h14v2H5V9zm0 6h8v2H5v-2z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(product)}
                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Hapus"
                                    type="button"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  ))
                : sortedFilteredProducts.map((product) => {
                const productTypeInfo = getProductTypeInfo(product.product_type);

                return (
                  <tr key={product.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {renderProductThumbnail(product, "h-11 w-11")}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {product.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate mt-0.5 max-w-[220px]">
                            {getProductSecondaryText(product)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                          product.category
                        )}`}
                      >
                        {product.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {product.barcode || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${productTypeInfo.color}`}
                      >
                        {productTypeInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{product.min_stock}</td>
                    <td
                      className={`px-4 py-3 font-semibold text-right ${
                        product.stock <= product.min_stock
                          ? "text-red-600"
                          : "text-blue-600"
                      }`}
                    >
                      {product.stock} {product.unit}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-right">
                      Rp {product.cost.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700 text-right">
                      Rp {(product.cost * product.stock).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-green-600 font-semibold text-right">
                      Rp {product.price.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowEditForm(product.id)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit"
                          type="button"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenStockCard(product)}
                          title="Kartu Stok"
                          className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                          type="button"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-4 w-4"
                          >
                            <path d="M3 3h18v2H3V3zm2 6h14v2H5V9zm0 6h8v2H5v-2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Hapus"
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                <td colSpan={7} className="px-4 py-3 text-right text-gray-900">
                  Total Nilai Stock:
                </td>
                <td className="px-4 py-3 text-gray-900 text-right">
                  Rp{" "}
                  {sortedFilteredProducts
                    .reduce(
                      (sum, product) =>
                        sum + Number(product.stock || 0) * Number(product.cost || 0),
                      0
                    )
                    .toLocaleString("id-ID")}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );

  // const paginatedPurchases = purchases.slice((purchasePage - 1) * purchasesPerPage, purchasePage * purchasesPerPage);
  // const totalPages = Math.ceil(totalPurchases / purchasesPerPage);

  const renderPurchasesTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pembelian Stok</h2>
          <p className="text-gray-600">
            Kelola purchase order dan pembelian produk
          </p>
        </div>
        <div>
          <button
            onClick={() => {
              setShowPurchaseForm(true);
              setNewPurchase({
                supplierId: "",
                items: [],
                notes: "",
                expectedDate: new Date().toISOString().split("T")[0],
                orderDate: new Date().toISOString(),
              });
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <ShoppingBag className="h-5 w-5" />
            Buat Purchase Order
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <input
          type="text"
          placeholder="Cari PO atau supplier..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Purchase Orders List */}
      <div className="space-y-4">
        {filteredPurchaseOrders.map((purchase) => {
          const supplier = suppliers.find((s) => s.id === purchase.supplier_id);
          return (
            <div
              key={purchase.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <FileText className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {purchase.po_number}
                    </h3>
                    <p className="text-gray-600">{supplier?.name}</p>
                  </div>
                </div>
                {/* <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      purchase.status
                    )}`}
                  >
                    {getStatusIcon(purchase.status)}
                    {purchase.status?.toUpperCase()}
                  </span>
                </div> */}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <div>
                    <p className="text-xs">Tanggal Order</p>
                    <p className="font-medium text-gray-900">
                      {purchase.order_date
                        ? new Date(purchase.order_date).toLocaleDateString(
                            "id-ID"
                          )
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Truck className="h-4 w-4" />
                  <div>
                    <p className="text-xs">Estimasi Tiba</p>
                    <p className="font-medium text-gray-900">
                      {purchase.expected_date
                        ? new Date(purchase.expected_date).toLocaleDateString(
                            "id-ID"
                          )
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Package className="h-4 w-4" />
                  <div>
                    <p className="text-xs">Total Item</p>
                    <p className="font-medium text-gray-900">
                      {selectedPurchase === purchase.id
                        ? loadingPurchaseItems
                          ? "-"
                          : `${
                              purchaseOrderItems.length
                            } / ${purchaseOrderItems.reduce(
                              (sum, item) => sum + Number(item.quantity || 0),
                              0
                            )}`
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <TrendingUp className="h-4 w-4" />
                  <div>
                    <p className="text-xs">Total Nilai</p>
                    <p className="font-medium text-gray-900">
                      Rp {Number(purchase.total_amount).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() =>
                    setSelectedPurchase(
                      selectedPurchase === purchase.id ? null : purchase.id
                    )
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Lihat Detail
                </button>
              </div>

              {/* Extended Details */}
              {selectedPurchase === purchase.id && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Detail Purchase Order
                  </h4>
                  {/* Items List - tampilkan jika sudah fetch item */}
                  <div className="mb-4">
                    {loadingPurchaseItems ? (
                      <div className="text-gray-500 text-sm">
                        Memuat item PO...
                      </div>
                    ) : purchaseItemsError ? (
                      <div className="text-red-500 text-sm">
                        {purchaseItemsError}
                      </div>
                    ) : purchaseOrderItems.length === 0 ? (
                      <div className="text-gray-400 text-sm">
                        Tidak ada item pada PO ini.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">
                                Produk
                              </th>
                              <th className="px-3 py-2 text-right font-medium text-gray-600">
                                Qty
                              </th>
                              <th className="px-3 py-2 text-right font-medium text-gray-600">
                                Harga Satuan
                              </th>
                              <th className="px-3 py-2 text-right font-medium text-gray-600">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {purchaseOrderItems.map((item, idx) => {
                              // Cari nama produk dari products jika product_name kosong
                              let productName = item.product_name;
                              if (!productName) {
                                const prod = products.find(
                                  (p) => p.id === item.product_id
                                );
                                productName = prod ? prod.name : "-";
                              }
                              const product = item.product_id
                                ? products.find((p) => p.id === item.product_id)
                                : null;
                              return (
                                <tr key={item.id || idx}>
                                  <td className="px-3 py-2">
                                    {renderProductIdentity({
                                      product,
                                      name: productName,
                                      secondaryText: product
                                        ? `${product.category || "produk"} • ${product.unit || "pcs"}`
                                        : undefined,
                                    })}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {item.quantity}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    Rp{" "}
                                    {Number(item.unit_cost).toLocaleString(
                                      "id-ID"
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    Rp{" "}
                                    {Number(item.total).toLocaleString("id-ID")}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  {/* Supplier Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">
                        Informasi Supplier
                      </h5>
                      <div className="text-sm space-y-1">
                        <div>
                          <strong>Nama:</strong> {supplier?.name}
                        </div>
                        <div>
                          <strong>Kontak:</strong> {supplier?.contact_person}
                        </div>
                        <div>
                          <strong>Telepon:</strong> {supplier?.phone}
                        </div>
                        <div>
                          <strong>Email:</strong> {supplier?.email}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">
                        Detail Order
                      </h5>
                      <div className="text-sm space-y-1">
                        <div>
                          <strong>PO Number:</strong> {purchase.po_number}
                        </div>
                        {/* <div>
                          <strong>Status:</strong> {purchase.status}
                        </div> */}
                        <div>
                          <strong>Total:</strong> Rp{" "}
                          {Number(purchase.total_amount).toLocaleString(
                            "id-ID"
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {purchase.notes && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <strong className="text-blue-800">Catatan:</strong>
                      <p className="text-blue-700 mt-1">{purchase.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filteredPurchaseOrders.length === 0 && (
          <div className="text-center text-gray-400 py-6">
            Tidak ada data purchase order ditemukan.
          </div>
        )}
      </div>
    </div>
  );

  // Form/Content untuk tab Daftar Pembelian
  const renderPurchaseListTab = () => {
    return (
      <div className="space-y-6">
        {/* Subtabs for Daftar Pembelian */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPurchaseTabView("daftar")}
            className={`px-3 py-2 text-sm rounded ${
              purchaseTabView === "daftar"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Daftar Pembelian
          </button>
          <button
            onClick={() => setPurchaseTabView("rekapTanggalBarang")}
            className={`px-3 py-2 text-sm rounded ${
              purchaseTabView === "rekapTanggalBarang"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Rekap Pembelian (Per tanggal - Per Barang)
          </button>
          <button
            onClick={() => setPurchaseTabView("rekapPerBarang")}
            className={`px-3 py-2 text-sm rounded ${
              purchaseTabView === "rekapPerBarang"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Rekap Per Barang
          </button>
        </div>

        {/* Daftar PO view */}
        {purchaseTabView === "daftar" && (
          <>
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Cari PO / Supplier
                </label>
                <input
                  type="text"
                  placeholder="Cari PO number atau nama supplier..."
                  value={daftarSearch}
                  onChange={(e) => setDaftarSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Periode
                </label>
                <select
                  value={daftarPeriod}
                  onChange={(e) => setDaftarPeriod(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="today">Hari Ini</option>
                  <option value="yesterday">Kemarin</option>
                  <option value="week">Minggu Ini</option>
                  <option value="month">Bulan Ini</option>
                  <option value="range">Rentang Waktu</option>
                </select>
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto mt-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      PO Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tanggal Order
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Supplier
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredPurchaseOrdersForDaftar.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center text-gray-400 py-6"
                      >
                        Tidak ada data purchase order ditemukan.
                      </td>
                    </tr>
                  )}
                  {filteredPurchaseOrdersForDaftar.map((po) => {
                    const supplier = suppliers.find(
                      (s) => s.id === po.supplier_id
                    );
                    return (
                      <React.Fragment key={po.id}>
                        <tr>
                          <td className="px-4 py-3 font-mono text-xs text-gray-900">
                            <button
                              onClick={() => openPoDetail(po)}
                              className="text-blue-600 hover:underline"
                            >
                              {po.po_number}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            {po.order_date
                              ? new Date(po.order_date).toLocaleDateString(
                                  "id-ID"
                                )
                              : "-"}
                          </td>
                          <td className="px-4 py-3">{supplier?.name || "-"}</td>
                          <td className="px-4 py-3 font-semibold text-blue-700 text-right">
                            Rp {Number(po.total_amount).toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  try {
                                    const items = await db.select(
                                      "purchase_order_items",
                                      "*",
                                      { po_id: po.id }
                                    );
                                    setNewPurchase({
                                      supplierId: po.supplier_id,
                                      items: (items || []).map((it: any) => ({
                                        id: it.id,
                                        productId: it.product_id,
                                        productName: it.product_name,
                                        quantity: Number(it.quantity) || 0,
                                        unitCost: Number(it.unit_cost) || 0,
                                        total: Number(it.total) || 0,
                                      })),
                                      notes: po.notes || "",
                                      expectedDate: po.expected_date
                                        ? new Date(po.expected_date)
                                            .toISOString()
                                            .split("T")[0]
                                        : new Date()
                                            .toISOString()
                                            .split("T")[0],
                                      orderDate: po.order_date
                                        ? new Date(po.order_date).toISOString()
                                        : new Date().toISOString(),
                                    });
                                    setEditingPoId(po.id);
                                    setShowPurchaseForm(true);
                                  } catch (err: any) {
                                    Swal.fire({
                                      icon: "error",
                                      title: "Gagal membuka edit",
                                      text:
                                        (err?.message || "") +
                                        (err?.details
                                          ? "\n" + err.details
                                          : ""),
                                    });
                                  }
                                }}
                                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  const confirm = await Swal.fire({
                                    title: "Hapus Purchase Order?",
                                    text: "Tindakan ini akan menghapus transaksi pembelian dan mengembalikan stok produk.",
                                    icon: "warning",
                                    showCancelButton: true,
                                    confirmButtonColor: "#d33",
                                    cancelButtonColor: "#6b7280",
                                    confirmButtonText: "Ya, hapus",
                                    cancelButtonText: "Batal",
                                  });
                                  if (!confirm.isConfirmed) return;
                                  try {
                                    await db.purchases.delete(po.id);
                                    await Swal.fire({
                                      icon: "success",
                                      title: "Berhasil",
                                      text: "Purchase Order telah dihapus dan stok dikembalikan.",
                                    });
                                    if ((window as any).refreshPurchases) {
                                      await (window as any).refreshPurchases();
                                    }
                                  } catch (err: any) {
                                    await Swal.fire({
                                      icon: "error",
                                      title: "Gagal menghapus",
                                      text:
                                        (err?.message || "") +
                                        (err?.details
                                          ? "\n" + err.details
                                          : ""),
                                    });
                                  }
                                }}
                                className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedPoId === po.id && poDetail && (
                          <tr>
                            <td colSpan={5} className="bg-gray-50 p-0">
                              <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-gray-200 p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    <div className="text-sm text-gray-500">
                                      PO Number
                                    </div>
                                    <div className="font-semibold text-gray-900">
                                      {poDetail.po_number}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm text-gray-500">
                                      Tanggal Order
                                    </div>
                                    <div className="font-semibold">
                                      {poDetail.order_date
                                        ? new Date(
                                            poDetail.order_date
                                          ).toLocaleDateString("id-ID")
                                        : "-"}
                                    </div>
                                  </div>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                          Produk
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                          Qty
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                          Harga
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                          Total (Rp)
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                      {((poDetail.items || []) as any[]).map(
                                        (it: any) => (
                                          <tr key={it.id}>
                                            <td className="px-4 py-2">
                                              {renderProductIdentity({
                                                product: it.product_id
                                                  ? products.find(
                                                      (p) =>
                                                        String(p.id) ===
                                                        String(it.product_id)
                                                    )
                                                  : null,
                                                name:
                                                  it.product_name ||
                                                  it.productName ||
                                                  "Unknown",
                                              })}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                              {Number(
                                                it.quantity || it.qty || 0
                                              )}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                              {it.unit_cost
                                                ? Number(
                                                    it.unit_cost
                                                  ).toLocaleString("id-ID")
                                                : it.unitPrice
                                                ? Number(
                                                    it.unitPrice
                                                  ).toLocaleString("id-ID")
                                                : "-"}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                              {Number(
                                                it.total || 0
                                              ).toLocaleString("id-ID")}
                                            </td>
                                          </tr>
                                        )
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="mt-4 text-right font-semibold">
                                  Total: Rp{" "}
                                  {Number(
                                    poDetail.total_amount ||
                                      poDetail.subtotal ||
                                      (poDetail.items || []).reduce(
                                        (s: any, it: any) =>
                                          s + (Number(it.total) || 0),
                                        0
                                      )
                                  ).toLocaleString("id-ID")}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} />
                    <td className="px-4 py-3 font-semibold text-blue-700 text-right">
                      Grand Total: Rp{" "}
                      {Number(
                        filteredPurchaseOrdersForDaftar.reduce(
                          (s: any, it: any) =>
                            s + (Number(it.total_amount) || 0),
                          0
                        )
                      ).toLocaleString("id-ID")}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* Rekap per tanggal view */}
        {purchaseTabView === "rekapTanggalBarang" && (
          <>
            <PurchaseFilters
              search={rekapTanggalSearch}
              onSearch={setRekapTanggalSearch}
              period={rekapTanggalPeriod}
              onPeriodChange={setRekapTanggalPeriod}
              dateRange={rekapTanggalDateRange}
              onDateRangeChange={setRekapTanggalDateRange}
            />
            <div className="mt-4">{renderRekapTanggalTab()}</div>
          </>
        )}

        {/* Rekap per barang view */}
        {purchaseTabView === "rekapPerBarang" && (
          <>
            <PurchaseFilters
              search={rekapPerBarangSearch}
              onSearch={setRekapPerBarangSearch}
              period={rekapPerBarangPeriod}
              onPeriodChange={setRekapPerBarangPeriod}
              dateRange={rekapPerBarangDateRange}
              onDateRangeChange={setRekapPerBarangDateRange}
            />
            <div className="mt-4">{renderRekapPerBarangTab()}</div>
          </>
        )}
      </div>
    );
  };

  // Helper to open a PO detail (used by PO number link and Edit button)
  const openPoDetail = async (po: any) => {
    try {
      const items = await db.select("purchase_order_items", "*", {
        po_id: po.id,
      });
      const detail = { ...po, items: items || [] };
      setPoDetail(detail);
      setExpandedPoId((prev) => (prev === po.id ? null : po.id));
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Gagal memuat detail PO",
        text: (err?.message || "") + (err?.details ? "\n" + err.details : ""),
      });
    }
  };

  // Render tab for sales report aggregated per date and per product
  const renderSalesListTab = () => {
    const parseItems = (details: any) => {
      if (!details) return [];
      let doc = details;
      if (typeof doc === "string") {
        try {
          doc = JSON.parse(doc);
        } catch (e) {
          return [];
        }
      }
      if (Array.isArray(doc)) return doc;
      if (doc.items && Array.isArray(doc.items)) return doc.items;
      if (doc.lines && Array.isArray(doc.lines)) return doc.lines;
      if (doc.cart && Array.isArray(doc.cart)) return doc.cart;
      if (doc.products && Array.isArray(doc.products)) return doc.products;
      for (const k of Object.keys(doc || {})) {
        if (Array.isArray((doc as any)[k])) return (doc as any)[k];
      }
      return [];
    };

    const groups: Record<
      string,
      {
        productMap: Record<
          string,
          {
            productId?: string;
            name: string;
            qty: number;
            total: number;
            lines?: Array<any>;
          }
        >;
        dateTotal: number;
      }
    > = {};

    for (const txn of sales) {
      // prefer timestamp column from cashier_transactions per schema
      const tsVal =
        txn.timestamp ?? txn.created_at ?? txn.inserted_at ?? txn.date ?? null;
      const dateKey = tsVal
        ? new Date(tsVal).toISOString().slice(0, 10)
        : "unknown";
      const items = parseItems(txn.details ?? txn.items ?? txn.lines ?? []);
      if (!groups[dateKey]) groups[dateKey] = { productMap: {}, dateTotal: 0 };
      for (const it of items) {
        const productId =
          it.product_id ??
          it.productId ??
          it.id ??
          it.item_id ??
          it.sku ??
          null;
        // prefer product name from products table when available
        const prod = productId
          ? products.find((p) => String(p.id) === String(productId))
          : null;
        const name =
          prod?.name ||
          it.product_name ||
          it.name ||
          it.title ||
          it.productName ||
          (it.product && it.product.name) ||
          String(it.sku || it.code || productId || "-");
        const qtyRaw = it.quantity ?? it.qty ?? it.qty_sold ?? it.q ?? 0;
        const qty = Number(qtyRaw) || 0;
        let totalRaw = 0;
        if (it.total !== undefined) totalRaw = it.total;
        else if (it.subtotal !== undefined) totalRaw = it.subtotal;
        else if (it.amount !== undefined) totalRaw = it.amount;
        else if (it.price_total !== undefined) totalRaw = it.price_total;
        else if (it.unit_price !== undefined)
          totalRaw = qty * Number(it.unit_price);
        const total = Number(totalRaw) || 0;

        const key = String(productId ?? name);
        if (!groups[dateKey].productMap[key])
          groups[dateKey].productMap[key] = {
            productId,
            name,
            qty: 0,
            total: 0,
            lines: [],
          };
        groups[dateKey].productMap[key].qty += qty;
        groups[dateKey].productMap[key].total += total;
        // store line for possible expansion in per-date view
        groups[dateKey].productMap[key].lines!.push({
          txId: txn.id ?? txn.transaction_id ?? null,
          ts: tsVal,
          qty,
          total,
          unitPrice: qty ? total / qty : 0,
        });
        groups[dateKey].dateTotal += total;
      }
    }

    const dateKeys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));
    // apply period filter similar to purchasePeriod logic
    let start: Date | null = null;
    let end: Date | null = null;
    const now = new Date();
    switch (salesPeriod) {
      case "today":
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      case "yesterday":
        start = new Date();
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
        break;
      case "week":
        start = new Date();
        const day = start.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        start.setDate(start.getDate() + diff);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "range":
        if (salesDateRange.start) {
          start = new Date(salesDateRange.start);
          start.setHours(0, 0, 0, 0);
        }
        if (salesDateRange.end) {
          end = new Date(salesDateRange.end);
          end.setHours(23, 59, 59, 999);
        }
        break;
    }

    const filteredDateKeys = dateKeys.filter((dk) => {
      const dkDate = dk === "unknown" ? null : new Date(dk + "T00:00:00");
      if (dkDate && start && dkDate < start) return false;
      if (dkDate && end && dkDate > end) return false;
      if (!salesSearch) return true;
      const st = salesSearch.toLowerCase();
      if (dk.includes(st)) return true;
      return Object.values(groups[dk].productMap).some((p) =>
        p.name.toLowerCase().includes(st)
      );
    });

    // compute footer totals based on currently filtered dates
    const footerTotals = filteredDateKeys.reduce(
      (acc: any, dk: string) => {
        const day = groups[dk];
        acc.days += 1;
        acc.amount += Number(day.dateTotal || 0);
        return acc;
      },
      { days: 0, amount: 0 }
    );

    const averagePerDay = footerTotals.days
      ? Math.round(footerTotals.amount / footerTotals.days)
      : 0;

    // build human-friendly period label for this tab too
    const periodLabel = (() => {
      if (salesPeriod === "range") {
        if (salesDateRange.start && salesDateRange.end) {
          const s = new Date(salesDateRange.start).toLocaleDateString();
          const e = new Date(salesDateRange.end).toLocaleDateString();
          return `${s} s.d. ${e}`;
        }
        if (salesDateRange.start)
          return `Mulai ${new Date(salesDateRange.start).toLocaleDateString()}`;
        return "Rentang waktu (tidak lengkap)";
      }
      switch (salesPeriod) {
        case "today": {
          const d = new Date();
          return `Hari Ini (${d.toLocaleDateString()})`;
        }
        case "yesterday": {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          return `Kemarin (${d.toLocaleDateString()})`;
        }
        case "week": {
          const d0 = new Date();
          const dd = new Date(d0);
          const day = dd.getDay();
          const diff = (day === 0 ? -6 : 1) - day;
          dd.setDate(dd.getDate() + diff);
          return `Minggu Ini (${dd.toLocaleDateString()} - ${new Date().toLocaleDateString()})`;
        }
        case "month": {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          return `Bulan Ini (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`;
        }
        default:
          return "Semua Waktu";
      }
    })();

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Laporan Penjualan (Per Tanggal & Per Barang)
            </h2>
            <p className="text-gray-600">
              Rekap penjualan teragregasi per tanggal, lalu per produk.
            </p>
            <div className="mt-2 text-sm text-gray-500">
              Periode:{" "}
              <span className="font-medium text-gray-700">{periodLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if ((window as any).refreshSales)
                  (window as any).refreshSales();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Filter by tanggal (YYYY-MM-DD) atau nama produk..."
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Periode
            </label>
            <select
              value={salesPeriod}
              onChange={(e) => setSalesPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="today">Hari Ini</option>
              <option value="yesterday">Kemarin</option>
              <option value="week">Minggu Ini</option>
              <option value="month">Bulan Ini</option>
              <option value="range">Rentang Waktu</option>
            </select>
          </div>
          {salesPeriod === "range" && (
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={salesDateRange.start}
                onChange={(e) =>
                  setSalesDateRange((r) => ({ ...r, start: e.target.value }))
                }
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <span className="self-center">-</span>
              <input
                type="date"
                value={salesDateRange.end}
                onChange={(e) =>
                  setSalesDateRange((r) => ({ ...r, end: e.target.value }))
                }
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          )}
        </div>

        {filteredDateKeys.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500">
            Tidak ada data penjualan untuk filter ini.
          </div>
        )}

        {filteredDateKeys.map((dk) => {
          const day = groups[dk];
          const productsArr = Object.values(day.productMap).sort(
            (a, b) => b.total - a.total
          );
          const dateExpanded = expandedDates.has(dk);
          return (
            <div
              key={dk}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-500">
                    {new Date(dk).toLocaleDateString("id-ID", {
                      weekday: "long",
                    })}
                  </div>
                  <button
                    onClick={() =>
                      setExpandedDates((prev) => {
                        const s = new Set(prev);
                        if (s.has(dk)) s.delete(dk);
                        else s.add(dk);
                        return s;
                      })
                    }
                    className="font-semibold text-left text-blue-600 hover:underline"
                  >
                    {new Date(dk).toLocaleDateString("id-ID")}
                  </button>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="font-semibold text-green-700">
                    Rp {Number(day.dateTotal || 0).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>

              {dateExpanded && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Produk
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Harga (Rp)
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Qty
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Total (Rp)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {productsArr.map((p) => {
                        const productKey = String(p.productId ?? p.name);
                        const compoundKey = `${dk}::${productKey}`;
                        const detailCount = (p.lines || []).length;
                        const expanded = expandedDateProducts.has(compoundKey);
                        const unit = p.qty
                          ? Math.round((p.total || 0) / p.qty)
                          : 0;
                        const product = p.productId
                          ? products.find(
                              (item) =>
                                String(item.id) === String(p.productId)
                            )
                          : null;
                        return (
                          <React.Fragment key={productKey}>
                            <tr>
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => {
                                    setExpandedDateProducts((prev) => {
                                      const s = new Set(prev);
                                      if (s.has(compoundKey))
                                        s.delete(compoundKey);
                                      else s.add(compoundKey);
                                      return s;
                                    });
                                  }}
                                  className="text-left text-blue-600 hover:underline flex items-center gap-2"
                                  aria-expanded={expandedDateProducts.has(
                                    compoundKey
                                  )}
                                >
                                  {renderProductIdentity({
                                    product,
                                    name: p.name,
                                    secondaryText: `${detailCount} detail`,
                                    nameClassName:
                                      "font-medium text-blue-600",
                                  })}
                                  <svg
                                    className={`h-4 w-4 transform ${
                                      expandedDateProducts.has(compoundKey)
                                        ? "rotate-180"
                                        : ""
                                    }`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="6 9 12 15 18 9" />
                                  </svg>
                                </button>
                              </td>
                              <td className="px-4 py-2 text-right">
                                {unit
                                  ? Number(unit).toLocaleString("id-ID")
                                  : "-"}
                              </td>
                              <td className="px-4 py-2 text-right font-medium">
                                {p.qty}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold">
                                {Number(p.total || 0).toLocaleString("id-ID")}
                              </td>
                            </tr>
                            {expanded && (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-0 py-0 bg-gray-50"
                                >
                                  <div className="w-full overflow-x-auto">
                                    <table className="min-w-full text-sm text-gray-700">
                                      <thead>
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs text-gray-500">
                                            Waktu
                                          </th>
                                          <th className="px-4 py-2 text-right text-xs text-gray-500">
                                            Harga (Rp)
                                          </th>
                                          <th className="px-4 py-2 text-right text-xs text-gray-500">
                                            Qty
                                          </th>
                                          <th className="px-4 py-2 text-right text-xs text-gray-500">
                                            Total (Rp)
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(p.lines || [])
                                          .sort((a, b) =>
                                            a.ts < b.ts ? 1 : -1
                                          )
                                          .map((ln: any, i: number) => (
                                            <tr key={i} className="border-t">
                                              <td className="px-4 py-1">
                                                {ln.ts
                                                  ? new Date(
                                                      ln.ts
                                                    ).toLocaleString("id-ID")
                                                  : ln.txId || "-"}
                                              </td>
                                              <td className="px-4 py-1 text-right">
                                                {ln.unitPrice
                                                  ? Number(
                                                      Math.round(ln.unitPrice)
                                                    ).toLocaleString("id-ID")
                                                  : "-"}
                                              </td>
                                              <td className="px-4 py-1 text-right">
                                                {ln.qty}
                                              </td>
                                              <td className="px-4 py-1 text-right">
                                                {ln.total
                                                  ? Number(
                                                      ln.total
                                                    ).toLocaleString("id-ID")
                                                  : "-"}
                                              </td>
                                            </tr>
                                          ))}
                                        {/* subtotal for this product on this date */}
                                        {(() => {
                                          const subtotalQty = (
                                            p.lines || []
                                          ).reduce(
                                            (s: number, d: any) =>
                                              s + (d.qty || 0),
                                            0
                                          );
                                          const subtotalAmount = (
                                            p.lines || []
                                          ).reduce(
                                            (s: number, d: any) =>
                                              s + (d.total || 0),
                                            0
                                          );
                                          return (
                                            <tr className="border-t bg-gray-100 font-semibold">
                                              <td className="px-4 py-1">
                                                Subtotal
                                              </td>
                                              <td className="px-4 py-1 text-right">
                                                -
                                              </td>
                                              <td className="px-4 py-1 text-right">
                                                {subtotalQty}
                                              </td>
                                              <td className="px-4 py-1 text-right">
                                                {Number(
                                                  subtotalAmount
                                                ).toLocaleString("id-ID")}
                                              </td>
                                            </tr>
                                          );
                                        })()}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {/* Footer summary: total days, period label, grand total, average per day */}
        {filteredDateKeys.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">
                  Total {footerTotals.days}-Hari
                </div>
                <div className="font-semibold text-gray-900">{periodLabel}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Grand Total</div>
                <div className="font-semibold text-green-700">
                  Rp {Number(footerTotals.amount).toLocaleString("id-ID")}
                </div>
                <div className="flex items-center justify-end gap-4 mt-2 text-sm text-gray-600">
                  <div className="text-gray-500">Rata-rata / hari</div>
                  <div className="font-medium text-gray-900">
                    Rp {Number(averagePerDay).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Function to print selected products price list
  const handlePrintPriceList = async () => {
    if (selectedProductsForPrint.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Pilih Produk",
        text: "Silakan pilih produk yang akan dicetak",
      });
      return;
    }
    const selectedProducts: ProductPriceList[] = products
      .filter((p) => selectedProductsForPrint.includes(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        stock: p.stock,
      }));
    try {
      await printPriceList(selectedProducts);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: err?.message || String(err),
      });
    }
  };

  const handleCopyPriceList = async () => {
    if (selectedProductsForPrint.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Pilih Produk",
        text: "Silakan pilih produk yang akan disalin",
      });
      return;
    }

    const selectedProducts: ProductPriceList[] = products
      .filter((p) => selectedProductsForPrint.includes(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        stock: p.stock,
      }));

    try {
      const { generatePriceListText } = await import("../utils/receipt");
      const priceListText = await generatePriceListText(selectedProducts);

      await navigator.clipboard.writeText(priceListText);

      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Daftar harga berhasil disalin ke clipboard",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: err?.message || String(err),
      });
    }
  };

  // Render tab for sales summary (aggregate per product across sales)
  const renderSalesSummaryTab = () => {
    // Helper to compute date window from summary period
    const computeWindow = (
      period: string,
      range: { start: string; end: string }
    ) => {
      let start: Date | null = null;
      let end: Date | null = null;
      const now = new Date();
      switch (period) {
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
          const d = start.getDay();
          const diff = (d === 0 ? -6 : 1) - d;
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
          if (range.start) {
            start = new Date(range.start);
            start.setHours(0, 0, 0, 0);
          }
          if (range.end) {
            end = new Date(range.end);
            end.setHours(23, 59, 59, 999);
          }
          break;
        }
      }
      return { start, end };
    };
    const parseItems = (details: any) => {
      if (!details) return [];
      let doc = details;
      if (typeof doc === "string") {
        try {
          doc = JSON.parse(doc);
        } catch (e) {
          return [];
        }
      }
      if (Array.isArray(doc)) return doc;
      if (doc.items && Array.isArray(doc.items)) return doc.items;
      if (doc.lines && Array.isArray(doc.lines)) return doc.lines;
      if (doc.cart && Array.isArray(doc.cart)) return doc.cart;
      if (doc.products && Array.isArray(doc.products)) return doc.products;
      for (const k of Object.keys(doc || {}))
        if (Array.isArray((doc as any)[k])) return (doc as any)[k];
      return [];
    };

    // apply salesSummary filters (period + search)
    const { start: ssStart, end: ssEnd } = computeWindow(
      salesSummaryPeriod,
      salesSummaryDateRange
    );
    const map: Record<string, any> = {};
    for (const txn of sales) {
      const tsVal =
        txn.timestamp ?? txn.created_at ?? txn.inserted_at ?? txn.date ?? null;
      const txnDate = tsVal ? new Date(tsVal) : null;
      if (txnDate) {
        if (ssStart && txnDate < ssStart) continue;
        if (ssEnd && txnDate > ssEnd) continue;
      }
      const items = parseItems(txn.details ?? txn.items ?? txn.lines ?? []);
      for (const it of items) {
        const productId =
          it.product_id ?? it.productId ?? it.id ?? it.item_id ?? null;
        const name = productId
          ? products.find((p) => String(p.id) === String(productId))?.name ??
            it.product_name ??
            it.name
          : it.product_name ||
            it.name ||
            String(it.sku || it.code || productId || "-");
        if (salesSummarySearch) {
          const st = salesSummarySearch.toLowerCase();
          if (!String(name).toLowerCase().includes(st)) continue;
        }
        const qty = Number(it.quantity ?? it.qty ?? it.q ?? 0) || 0;
        const total =
          Number(
            it.total ??
              it.subtotal ??
              it.amount ??
              (it.unit_price ? qty * Number(it.unit_price) : 0)
          ) || 0;
        const key = String(productId ?? name);
        if (!map[key])
          map[key] = { productId: productId ?? null, name, qty: 0, total: 0 };
        map[key].qty += qty;
        map[key].total += total;
      }
    }

    const keys = Object.keys(map).sort(
      (a, b) => (map[b].total || 0) - (map[a].total || 0)
    );
    if (keys.length === 0)
      return (
        <div className="text-sm text-gray-500">Belum ada data penjualan.</div>
      );
    return (
      <div>
        <div className="mb-4">
          <PurchaseFilters
            search={salesSummarySearch}
            onSearch={setSalesSummarySearch}
            period={salesSummaryPeriod}
            onPeriodChange={setSalesSummaryPeriod}
            dateRange={salesSummaryDateRange}
            onDateRangeChange={setSalesSummaryDateRange}
            placeholder="Cari produk..."
          />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Produk
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Qty
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Harga
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Total (Rp)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {keys.map((k) => {
                const item = map[k];
                const unitPrice = item.qty
                  ? Math.round((Number(item.total) || 0) / item.qty)
                  : 0;
                const isExpanded = expandedSalesProductKey === k;
                const product = item.productId
                  ? products.find((p) => String(p.id) === String(item.productId))
                  : null;
                return (
                  <React.Fragment key={k}>
                    <tr>
                      <td className="px-4 py-2">
                        <button
                          onClick={() =>
                            setExpandedSalesProductKey(isExpanded ? null : k)
                          }
                          className="text-blue-600 hover:underline text-left flex items-center gap-2"
                          aria-expanded={isExpanded}
                        >
                          {renderProductIdentity({
                            product,
                            name: item.name,
                            nameClassName: "font-medium text-blue-600",
                          })}
                          <svg
                            className={`h-4 w-4 transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {item.qty}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {unitPrice ? unitPrice.toLocaleString("id-ID") : "-"}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {Number(item.total || 0).toLocaleString("id-ID")}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="bg-gray-50 p-0">
                          <div className="p-4">
                            <div className="text-sm text-gray-600 mb-2">
                              Detail penjualan per tanggal
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-white">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs text-gray-500">
                                      Tanggal
                                    </th>
                                    <th className="px-4 py-2 text-right text-xs text-gray-500">
                                      Harga (Rp)
                                    </th>
                                    <th className="px-4 py-2 text-right text-xs text-gray-500">
                                      Qty
                                    </th>
                                    <th className="px-4 py-2 text-right text-xs text-gray-500">
                                      Total (Rp)
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                  {(() => {
                                    // compute per-date breakdown for product key k
                                    const perDate: Record<
                                      string,
                                      { qty: number; total: number }
                                    > = {};
                                    for (const txn of sales) {
                                      const tsVal =
                                        txn.timestamp ??
                                        txn.created_at ??
                                        txn.inserted_at ??
                                        txn.date ??
                                        null;
                                      const txnDate = tsVal
                                        ? new Date(tsVal)
                                        : null;
                                      if (txnDate) {
                                        if (ssStart && txnDate < ssStart)
                                          continue;
                                        if (ssEnd && txnDate > ssEnd) continue;
                                      }
                                      const items = parseItems(
                                        txn.details ??
                                          txn.items ??
                                          txn.lines ??
                                          []
                                      );
                                      for (const it of items) {
                                        const productId =
                                          it.product_id ??
                                          it.productId ??
                                          it.id ??
                                          it.item_id ??
                                          null;
                                        let name = productId
                                          ? products.find(
                                              (p) =>
                                                String(p.id) ===
                                                String(productId)
                                            )?.name ??
                                            it.product_name ??
                                            it.name
                                          : it.product_name ||
                                            it.name ||
                                            String(
                                              it.sku ||
                                                it.code ||
                                                productId ||
                                                "-"
                                            );
                                        name = String(name || "").trim();
                                        // build the same key used in the sales-summary map: String(productId ?? name)
                                        const keyMatch = String(
                                          productId ?? name
                                        );
                                        if (keyMatch !== k) continue;
                                        const qty =
                                          Number(it.quantity ?? it.qty ?? 0) ||
                                          0;
                                        const ttl =
                                          Number(
                                            it.total ??
                                              it.subtotal ??
                                              it.amount ??
                                              (it.unit_price
                                                ? qty * Number(it.unit_price)
                                                : 0)
                                          ) || 0;
                                        const dkey = txnDate
                                          ? txnDate.toISOString().slice(0, 10)
                                          : "unknown";
                                        if (!perDate[dkey])
                                          perDate[dkey] = { qty: 0, total: 0 };
                                        perDate[dkey].qty += qty;
                                        perDate[dkey].total += ttl;
                                      }
                                    }
                                    const dateKeys = Object.keys(perDate).sort(
                                      (a, b) => (a < b ? 1 : -1)
                                    );
                                    if (dateKeys.length === 0)
                                      return (
                                        <tr>
                                          <td
                                            colSpan={3}
                                            className="text-sm text-gray-500 py-3"
                                          >
                                            Tidak ada data.
                                          </td>
                                        </tr>
                                      );
                                    const rows = dateKeys.map((dk) => {
                                      const qty = perDate[dk].qty || 0;
                                      const totalAmt = perDate[dk].total || 0;
                                      const unit = qty
                                        ? Math.round(totalAmt / qty)
                                        : 0;
                                      return (
                                        <tr key={dk}>
                                          <td className="px-4 py-2">
                                            {new Date(dk).toLocaleDateString(
                                              "id-ID"
                                            )}
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            {unit
                                              ? Number(unit).toLocaleString(
                                                  "id-ID"
                                                )
                                              : "-"}
                                          </td>
                                          <td className="px-4 py-2 text-right font-medium">
                                            {qty}
                                          </td>
                                          <td className="px-4 py-2 text-right font-semibold">
                                            {Number(
                                              totalAmt || 0
                                            ).toLocaleString("id-ID")}
                                          </td>
                                        </tr>
                                      );
                                    });

                                    // compute footer totals for this product across dates
                                    const footerQty = dateKeys.reduce(
                                      (s, dk) => s + (perDate[dk].qty || 0),
                                      0
                                    );
                                    const footerAmount = dateKeys.reduce(
                                      (s, dk) => s + (perDate[dk].total || 0),
                                      0
                                    );
                                    // Better transaction count: count number of sales lines across all sales that match key k
                                    let realTxCount = 0;
                                    for (const txn of sales) {
                                      const items = parseItems(
                                        txn.details ??
                                          txn.items ??
                                          txn.lines ??
                                          []
                                      );
                                      for (const it of items) {
                                        const pid =
                                          it.product_id ??
                                          it.productId ??
                                          it.id ??
                                          it.item_id ??
                                          null;
                                        const nm = pid
                                          ? products.find(
                                              (pp) =>
                                                String(pp.id) === String(pid)
                                            )?.name ??
                                            it.product_name ??
                                            it.name
                                          : it.product_name ||
                                            it.name ||
                                            String(
                                              it.sku || it.code || pid || "-"
                                            );
                                        const keyMatch2 = String(
                                          pid ?? String(nm || "").trim()
                                        );
                                        if (keyMatch2 === k) realTxCount++;
                                      }
                                    }

                                    return (
                                      <>
                                        {rows}
                                        <tr className="bg-gray-50 font-semibold">
                                          <td className="px-4 py-2">
                                            Subtotal
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            -
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            {String(footerQty)}
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            Rp{" "}
                                            {Number(
                                              footerAmount
                                            ).toLocaleString("id-ID")}
                                          </td>
                                        </tr>
                                        <tr className="bg-white">
                                          <td
                                            colSpan={4}
                                            className="px-4 py-2 text-sm text-gray-600"
                                          >
                                            Jumlah transaksi: {realTxCount}
                                          </td>
                                        </tr>
                                      </>
                                    );
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render tab for suppliers
  const renderSuppliersTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Manajemen Supplier
          </h2>
          <p className="text-gray-600">Kelola data supplier produk</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSupplierView("card")}
            className={`p-2 rounded-lg border ${
              supplierView === "card"
                ? "bg-purple-100 border-purple-400 text-purple-600"
                : "border-gray-200 text-gray-400 hover:text-purple-600"
            }`}
            aria-label="Tampilan Card"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
          <button
            onClick={() => setSupplierView("list")}
            className={`p-2 rounded-lg border ${
              supplierView === "list"
                ? "bg-purple-100 border-purple-400 text-purple-600"
                : "border-gray-200 text-gray-400 hover:text-purple-600"
            }`}
            aria-label="Tampilan List"
          >
            <ListIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowSupplierForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Tambah Supplier
          </button>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <input
          type="text"
          placeholder="Cari supplier atau kontak person..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>
      {supplierView === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSuppliers.length === 0 && (
            <div className="col-span-full text-center text-gray-400 py-6">
              Tidak ada data supplier ditemukan.
            </div>
          )}
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {supplier.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowEditSupplierForm(supplier.id)}
                      className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSupplier(supplier)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {supplier.name}
                </h3>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {supplier.address}
                </p>
              </div>
              <div className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="font-medium">Kontak:</span>{" "}
                    {supplier.contact_person}
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="font-medium">Telepon:</span>{" "}
                    {supplier.phone || "-"}
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="font-medium">Email:</span>{" "}
                    {supplier.email || "-"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Nama
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Kontak Person
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Telepon
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Kategori
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-6">
                    Tidak ada data supplier ditemukan.
                  </td>
                </tr>
              )}
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {supplier.name}
                  </td>
                  <td className="px-4 py-3">{supplier.contact_person}</td>
                  <td className="px-4 py-3">{supplier.phone || "-"}</td>
                  <td className="px-4 py-3">{supplier.email || "-"}</td>
                  <td className="px-4 py-3">{supplier.category}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowEditSupplierForm(supplier.id)}
                        className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(supplier)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Manajemen Produk & Pembelian
          </h1>
          <p className="text-gray-600">
            Kelola produk, pembelian stok, dan supplier
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: "products", label: "Produk", icon: Package },
                { id: "purchases", label: "Pembelian", icon: ShoppingBag },
                { id: "stokOpname", label: "Stok Opname", icon: ListIcon },
                {
                  id: "purchaseList",
                  label: "Daftar Pembelian",
                  icon: FileText,
                },
                {
                  id: "reports",
                  label: "Laporan Penjualan",
                  icon: DollarSign,
                  children: [
                    {
                      id: "sales",
                      label: "Laporan Penjualan (Per Tanggal & Per Barang)",
                    },
                    { id: "salesSummary", label: "Laporan Rekap Per Barang" },
                  ],
                },
                { id: "suppliers", label: "Supplier", icon: Truck },
              ].map((tab: any) => {
                if (tab.children && Array.isArray(tab.children)) {
                  const Icon = tab.icon as any;
                  const isParentActive = activeTab === "reports";
                  // Render only the parent tab in the main nav. Sub-tabs will appear inside the reports content.
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab("reports" as any);
                        setReportTab("sales");
                        setSearchTerm("");
                      }}
                      className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                        isParentActive
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                }

                const Icon = tab.icon as any;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setSearchTerm("");
                    }}
                    className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "products" && renderProductsTab()}
        {activeTab === "purchases" && renderPurchasesTab()}
        {activeTab === "purchaseList" && renderPurchaseListTab()}
        {/* Reports parent: sub-nav + child content */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setReportTab("sales")}
                className={`px-3 py-2 text-sm rounded ${
                  reportTab === "sales"
                    ? "bg-blue-50 text-blue-700 border border-blue-100"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Laporan Penjualan (Per Tanggal & Per Barang)
              </button>
              <button
                onClick={() => setReportTab("salesSummary")}
                className={`px-3 py-2 text-sm rounded ${
                  reportTab === "salesSummary"
                    ? "bg-blue-50 text-blue-700 border border-blue-100"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Laporan Rekap Per Barang
              </button>
            </div>

            <div>
              {reportTab === "sales"
                ? renderSalesListTab()
                : renderSalesSummaryTab()}
            </div>
          </div>
        )}
        {activeTab === "suppliers" && renderSuppliersTab()}
        {activeTab === "stokOpname" && <StokOpname products={products} />}

        {/* Add Product Modal */}
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
              <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Tambah Produk Baru
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Susun data produk lebih cepat dengan form yang dibagi per section.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewProduct({
                      name: "",
                      category: "beverage",
                      product_type: "finished_good",
                      unit: "pcs",
                      price: 0,
                      cost: 0,
                      stock: 0,
                      min_stock: 0,
                      barcode: "",
                      image_url: "",
                      description: "",
                      is_active: true,
                    });
                  }}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                className="flex-1 overflow-y-auto p-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddProduct();
                }}
              >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-5">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Informasi Utama
                      </h3>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Nama Produk *
                      </label>
                      <input
                        type="text"
                        value={newProduct.name}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, name: e.target.value })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        placeholder="Masukkan nama produk"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Kategori
                        </label>
                        <select
                          value={newProduct.category}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              category: e.target.value as any,
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="beverage">Minuman</option>
                          <option value="food">Makanan</option>
                          <option value="snack">Snack</option>
                          <option value="other">Lainnya</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Tipe
                        </label>
                        <select
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          value={newProduct.product_type}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              product_type: e.target.value,
                            })
                          }
                        >
                          <option value="raw_material">Bahan Baku</option>
                          <option value="finished_good">Produk Jadi</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Satuan
                        </label>
                        <select
                          value={newProduct.unit}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              unit: e.target.value as "gram" | "liter" | "pcs",
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="gram">Gram</option>
                          <option value="liter">Liter</option>
                          <option value="pcs">Pcs</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Barcode (Opsional)
                        </label>
                        <input
                          type="text"
                          value={newProduct.barcode}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              barcode: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          placeholder="Scan atau masukkan barcode"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Deskripsi
                      </label>
                      <textarea
                        value={newProduct.description}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            description: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        rows={6}
                        placeholder="Deskripsi produk"
                      />
                    </div>
                  </div>

                  <div className="space-y-6 rounded-xl border border-gray-200 bg-gray-50/60 p-5">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Harga, Stok, dan Media
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Harga Modal *
                        </label>
                        <input
                          type="number"
                          value={newProduct.cost}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              cost: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Harga Jual *
                        </label>
                        <input
                          type="number"
                          value={newProduct.price}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              price: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Stok Awal
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={newProduct.stock}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              stock: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Min. Stok
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={newProduct.min_stock}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              min_stock: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Gambar Produk (Max 2MB)
                      </label>
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              await uploadProductImage(file, "new");
                              e.currentTarget.value = "";
                            }
                          }}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {newProduct.image_url ? (
                          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                            {renderProductThumbnail(newProduct, "h-16 w-16")}
                            <div>
                              <p className="text-sm font-medium text-gray-700">
                                Preview gambar produk
                              </p>
                              <p className="text-xs text-gray-500">
                                Thumbnail kecil akan dipakai di daftar produk.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-gray-50 px-3 py-4 text-sm text-gray-500">
                            Upload gambar agar produk lebih mudah dikenali saat dilihat di list.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newProduct.is_active}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              is_active: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          <span className="block text-sm font-medium text-gray-700">
                            Produk Aktif
                          </span>
                          <span className="block text-xs text-gray-500">
                            Produk aktif akan langsung muncul di daftar dan transaksi terkait.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </form>

              <div className="flex gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewProduct({
                      name: "",
                      category: "beverage",
                      product_type: "finished_good",
                      unit: "pcs",
                      price: 0,
                      cost: 0,
                      stock: 0,
                      min_stock: 0,
                      barcode: "",
                      image_url: "",
                      description: "",
                      is_active: true,
                    });
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:border-gray-400"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Simpan Produk
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Purchase Order Modal */}
        {showPurchaseForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {editingPoId ? "Edit Purchase Order" : "Buat Purchase Order"}
                </h2>

                <form className="space-y-6">
                  {/* Supplier Selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Supplier *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowSupplierSelectModal(true)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between"
                      >
                        <span>
                          {newPurchase.supplierId
                            ? suppliers.find(
                                (s) => s.id === newPurchase.supplierId
                              )?.name || "Pilih Supplier"
                            : "Pilih Supplier"}
                        </span>
                        <Search className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tanggal Diharapkan
                      </label>
                      <input
                        type="date"
                        value={newPurchase.expectedDate}
                        onChange={(e) =>
                          setNewPurchase({
                            ...newPurchase,
                            expectedDate: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Items Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        Item Pembelian
                      </h3>
                      <button
                        type="button"
                        onClick={addItemToPurchase}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Tambah Item
                      </button>
                    </div>

                    <div className="space-y-3">
                      {newPurchase.items.map((item, index) => {
                        const selectedProduct = products.find(
                          (p) => p.id === item.productId
                        );

                        return (
                        <div
                          key={index}
                          className="grid grid-cols-12 gap-3 items-end rounded-lg bg-gray-50 p-3"
                        >
                          <div className="col-span-4">
                            <label className="mb-1 block text-xs font-medium text-gray-700">
                              Produk
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setShowProductSelectModal({ open: true, index })
                              }
                              className="flex w-full items-center justify-between rounded border border-gray-300 px-2 py-2 text-left text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                {selectedProduct ? (
                                  renderProductThumbnail(selectedProduct, "h-10 w-10")
                                ) : (
                                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-medium text-gray-400">
                                    -
                                  </span>
                                )}
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-gray-800">
                                    {selectedProduct?.name ||
                                      item.productName ||
                                      "Pilih Produk"}
                                  </span>
                                  <span className="block truncate text-xs text-gray-500">
                                    {selectedProduct
                                      ? `Stok ${selectedProduct.stock} ${selectedProduct.unit || ""}`
                                      : "Klik untuk memilih produk"}
                                  </span>
                                </span>
                              </span>
                              <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
                            </button>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Qty
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) =>
                                  updatePurchaseItem(
                                    index,
                                    "quantity",
                                    Number(e.target.value)
                                  )
                                }
                                className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                min="1"
                                placeholder="0"
                              />
                              <span className="text-sm font-medium text-gray-600 px-2 py-1 bg-gray-100 rounded text-center flex items-center justify-center">
                                {selectedProduct?.unit || "Unit"}
                              </span>
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Harga Satuan
                            </label>
                            <input
                              type="number"
                              value={item.unitCost}
                              onChange={(e) =>
                                updatePurchaseItem(
                                  index,
                                  "unitCost",
                                  Number(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div className="col-span-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Total
                            </label>
                            <div className="px-2 py-1 bg-gray-100 rounded text-sm font-medium">
                              Rp {item.total.toLocaleString("id-ID")}
                            </div>
                          </div>
                          <div className="col-span-1">
                            <button
                              type="button"
                              onClick={() => removePurchaseItem(index)}
                              className="w-full p-1 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );})}
                    </div>

                    {/* Real-time Total Calculation */}
                    {newPurchase.items.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-3">
                          Ringkasan Purchase Order
                        </h4>
                        <div className="space-y-2">
                          {(() => {
                            const total = newPurchase.items.reduce(
                              (sum, item) =>
                                sum + item.quantity * item.unitCost,
                              0
                            );
                            return (
                              <>
                                {/* <div className="flex justify-between items-center">
                                  <span className="text-blue-800">
                                    Subtotal:
                                  </span>
                                  <span className="font-medium text-blue-900">
                                    Rp {subtotal.toLocaleString("id-ID")}
                                  </span>
                                </div> */}
                                {newPurchase.items.map((item, index) => {
                                  const selectedProduct = products.find(
                                    (p) => p.id === item.productId
                                  );

                                  return (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between gap-3"
                                  >
                                    <div className="flex min-w-0 items-center gap-3 text-blue-800">
                                      {selectedProduct &&
                                        renderProductThumbnail(selectedProduct, "h-10 w-10")}
                                      <div className="min-w-0">
                                        <div className="truncate font-medium text-blue-900">
                                          {selectedProduct?.name || item.productName || "Produk"}
                                        </div>
                                        <div className="truncate text-sm text-blue-800">
                                          {item.quantity} x Rp {item.unitCost.toLocaleString("id-ID")}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="font-medium text-blue-900">
                                      Rp{" "}
                                      {(
                                        item.quantity * item.unitCost
                                      ).toLocaleString("id-ID")}
                                    </div>
                                  </div>
                                );})}
                                {/* <div className="flex justify-between items-center">
                                  <span className="text-blue-800">
                                    Pajak (10%):
                                  </span>
                                  <span className="font-medium text-blue-900">
                                    Rp {tax.toLocaleString("id-ID")}
                                  </span>
                                </div> */}
                                <div className="flex justify-between items-center border-t border-blue-300 pt-2">
                                  <span className="font-bold text-blue-900">
                                    Total:
                                  </span>
                                  <span className="text-xl font-bold text-blue-900">
                                    Rp {total.toLocaleString("id-ID")}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Catatan (Opsional)
                    </label>
                    <textarea
                      value={newPurchase.notes}
                      onChange={(e) =>
                        setNewPurchase({
                          ...newPurchase,
                          notes: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Catatan untuk supplier"
                    />
                  </div>
                </form>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      if (isSavingPurchase) return;
                      setShowPurchaseForm(false);
                      setEditingPoId(null);
                    }}
                    disabled={isSavingPurchase}
                    className={`flex-1 px-4 py-2 border rounded-lg font-medium transition-colors ${
                      isSavingPurchase
                        ? "border-gray-200 text-gray-400 cursor-not-allowed"
                        : "border-gray-300 hover:border-gray-400 text-gray-700"
                    }`}
                  >
                    Batal
                  </button>
                  <button
                    onClick={async () => {
                      if (isSavingPurchase) return;
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

                          Swal.fire({
                            icon: "success",
                            title: "Berhasil!",
                            text: `Purchase Order berhasil diperbarui.`,
                          });
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

                          Swal.fire({
                            icon: "success",
                            title: "Berhasil!",
                            text: `Purchase Order berhasil dibuat dengan total Rp ${purchaseTotal.toLocaleString(
                              "id-ID"
                            )}`,
                          });
                        }

                        const reference = `PO-${poId}`;
                        const supplier = suppliers.find(
                          (s) => s.id === newPurchase.supplierId
                        );

                        const { data: existingEntry, error: fetchError } =
                          await supabase
                            .from("bookkeeping_entries")
                            .select("id")
                            .eq("reference", reference)
                            .single();

                        if (fetchError && fetchError.code !== "PGRST116") {
                          console.error(
                            "Error checking existing bookkeeping entry:",
                            fetchError
                          );
                        }

                        if (existingEntry) {
                          const { error: updateError } = await supabase
                            .from("bookkeeping_entries")
                            .update({
                              amount: purchaseTotal,
                              notes: `Purchase Order ${
                                poData.po_number || poId
                              } - ${supplier?.name || "Unknown Supplier"}${
                                newPurchase.notes
                                  ? ` (${newPurchase.notes})`
                                  : ""
                              }`,
                              entry_date: newPurchase.orderDate.split("T")[0], // Update date if order date changed
                            })
                            .eq("id", existingEntry.id);

                          if (updateError) {
                            console.error(
                              "Error updating bookkeeping entry:",
                              updateError
                            );
                          }
                        } else {
                          const { error: insertError } = await supabase
                            .from("bookkeeping_entries")
                            .insert([
                              {
                                entry_date: newPurchase.orderDate.split("T")[0],
                                type: "expense",
                                category: "inventory",
                                description: `Purchase Order - ${
                                  supplier?.name || "Unknown Supplier"
                                }`,
                                amount: purchaseTotal,
                                reference: reference,
                                notes: `${poData.po_number || poId}${
                                  newPurchase.notes
                                    ? ` - ${newPurchase.notes}`
                                    : ""
                                }`,
                              },
                            ]);

                          if (insertError) {
                            console.error(
                              "Error inserting bookkeeping entry:",
                              insertError
                            );
                          }
                        }

                        setShowPurchaseForm(false);
                        setEditingPoId(null);
                        setNewPurchase({
                          supplierId: "",
                          items: [],
                          notes: "",
                          expectedDate: new Date().toISOString().split("T")[0],
                          orderDate: new Date().toISOString(),
                        });
                        if ((window as any).refreshPurchases)
                          await (window as any).refreshPurchases();
                        if ((window as any).refreshProducts)
                          await (window as any).refreshProducts();
                      } catch (error: any) {
                        Swal.fire({
                          icon: "error",
                          title: editingPoId
                            ? "Gagal memperbarui PO"
                            : "Gagal tambah PO",
                          text:
                            (error?.message || "") +
                            (error?.details ? "\n" + error.details : ""),
                        });

                        console.error("PO Error:", error);
                      } finally {
                        setIsSavingPurchase(false);
                      }
                    }}
                    disabled={isSavingPurchase}
                    className={`flex-1 text-white px-4 py-2 rounded-lg font-medium transition-colors ${
                      isSavingPurchase
                        ? "bg-green-400 cursor-wait"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {isSavingPurchase
                      ? editingPoId
                        ? "Menyimpan..."
                        : "Membuat..."
                      : editingPoId
                      ? "Simpan Perubahan"
                      : "Buat Purchase Order"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inline PO Detail panel removed - details are shown as expanded row within the table */}

        {/* Add Supplier Modal */}
        {showSupplierForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Tambah Supplier Baru
                </h2>
                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama Supplier *
                    </label>
                    <input
                      type="text"
                      value={newSupplier.name}
                      onChange={(e) =>
                        setNewSupplier({ ...newSupplier, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Nama perusahaan supplier"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kontak Person *
                    </label>
                    <input
                      type="text"
                      value={newSupplier.contact_person}
                      onChange={(e) =>
                        setNewSupplier({
                          ...newSupplier,
                          contact_person: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Nama kontak person"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Telepon
                      </label>
                      <input
                        type="text"
                        value={newSupplier.phone}
                        onChange={(e) =>
                          setNewSupplier({
                            ...newSupplier,
                            phone: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="+62 8xx-xxxx-xxxx"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kategori
                      </label>
                      <select
                        value={newSupplier.category}
                        onChange={(e) =>
                          setNewSupplier({
                            ...newSupplier,
                            category: e.target.value as any,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="beverage">Minuman</option>
                        <option value="food">Makanan</option>
                        <option value="snack">Snack</option>
                        <option value="other">Lainnya</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={newSupplier.email}
                      onChange={(e) =>
                        setNewSupplier({
                          ...newSupplier,
                          email: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="email@supplier.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alamat
                    </label>
                    <textarea
                      value={newSupplier.address}
                      onChange={(e) =>
                        setNewSupplier({
                          ...newSupplier,
                          address: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Alamat lengkap supplier"
                      rows={2}
                    />
                  </div>
                </form>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowSupplierForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleAddSupplier}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Tambah Supplier
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Product Modal */}
        {showEditForm && editProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
              <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Edit Produk
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Perbarui informasi inti, harga, stok, dan thumbnail produk tanpa perlu scroll terlalu panjang.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditForm(null)}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form
                className="flex-1 overflow-y-auto p-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleEditProduct();
                }}
              >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-5">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Informasi Utama
                      </h3>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Nama Produk *
                      </label>
                      <input
                        type="text"
                        value={editProduct.name}
                        onChange={(e) =>
                          setEditProduct({ ...editProduct, name: e.target.value })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        placeholder="Masukkan nama produk"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Kategori
                        </label>
                        <select
                          value={editProduct.category}
                          onChange={(e) =>
                            setEditProduct({
                              ...editProduct,
                              category: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="beverage">Minuman</option>
                          <option value="food">Makanan</option>
                          <option value="snack">Snack</option>
                          <option value="other">Lainnya</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Tipe
                        </label>
                        <select
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          value={editProduct.product_type}
                          onChange={(e) =>
                            setEditProduct({
                              ...editProduct,
                              product_type: e.target.value,
                            })
                          }
                        >
                          <option value="raw_material">Bahan Baku</option>
                          <option value="finished_good">Produk Jadi</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Satuan
                        </label>
                        <select
                          value={editProduct.unit || "pcs"}
                          onChange={(e) =>
                            setEditProduct({
                              ...editProduct,
                              unit: e.target.value as "gram" | "liter" | "pcs",
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="gram">Gram</option>
                          <option value="liter">Liter</option>
                          <option value="pcs">Pcs</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Barcode (Opsional)
                        </label>
                        <input
                          type="text"
                          value={editProduct.barcode || ""}
                          onChange={(e) =>
                            setEditProduct({
                              ...editProduct,
                              barcode: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          placeholder="Scan atau masukkan barcode"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Deskripsi
                      </label>
                      <textarea
                        value={editProduct.description || ""}
                        onChange={(e) =>
                          setEditProduct({
                            ...editProduct,
                            description: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        rows={6}
                        placeholder="Deskripsi produk"
                      />
                    </div>
                  </div>

                  <div className="space-y-6 rounded-xl border border-gray-200 bg-gray-50/60 p-5">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Harga, Stok, dan Media
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Harga Modal *
                        </label>
                        <input
                          type="number"
                          value={editProduct.cost}
                          onChange={(e) =>
                            setEditProduct({
                              ...editProduct,
                              cost: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Harga Jual *
                        </label>
                        <input
                          type="number"
                          value={editProduct.price}
                          onChange={(e) =>
                            setEditProduct({
                              ...editProduct,
                              price: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Stok
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editProduct.stock}
                          onChange={(e) =>
                            setEditProduct({
                              ...editProduct,
                              stock: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Min. Stok
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editProduct.min_stock}
                          onChange={(e) =>
                            setEditProduct({
                              ...editProduct,
                              min_stock: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Gambar Produk (Max 2MB)
                      </label>
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              await uploadProductImage(file, "edit");
                              e.currentTarget.value = "";
                            }
                          }}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {editProduct.image_url ? (
                          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                            {renderProductThumbnail(editProduct, "h-16 w-16")}
                            <div>
                              <p className="text-sm font-medium text-gray-700">
                                Preview gambar produk
                              </p>
                              <p className="text-xs text-gray-500">
                                Thumbnail kecil akan dipakai di daftar produk.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-gray-50 px-3 py-4 text-sm text-gray-500">
                            Belum ada gambar. Upload thumbnail agar produk lebih mudah dikenali.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editProduct.is_active}
                          onChange={(e) =>
                            setEditProduct({
                              ...editProduct,
                              is_active: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          <span className="block text-sm font-medium text-gray-700">
                            Produk Aktif
                          </span>
                          <span className="block text-xs text-gray-500">
                            Produk aktif tetap tersedia untuk ditampilkan dan dipakai di transaksi.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </form>
              <div className="flex gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowEditForm(null)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:border-gray-400"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleEditProduct}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Select Modal for Purchase Items */}
        {showProductSelectModal.open && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex">
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Pilih Produk
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if ((window as any).refreshProducts) {
                          await (window as any).refreshProducts();
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 p-1 rounded"
                      title="Refresh data produk"
                    >
                      <RefreshCw className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        setShowProductSelectModal({ open: false, index: null });
                        setProductSearchTerm("");
                      }}
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
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                  {filteredProductsForSelect.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      {productSearchTerm
                        ? "Tidak ada produk yang cocok"
                        : "Belum ada produk"}
                    </div>
                  ) : (
                    filteredProductsForSelect.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (showProductSelectModal.index !== null) {
                            updatePurchaseItem(
                              showProductSelectModal.index,
                              "productId",
                              p.id
                            );
                          }
                          setShowProductSelectModal({
                            open: false,
                            index: null,
                          });
                          setProductSearchTerm("");
                        }}
                        className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            {renderProductThumbnail(p, "h-12 w-12")}
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {p.name}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                Kategori: {p.category || "-"}
                                {p.barcode ? ` • Barcode: ${p.barcode}` : ""}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-700">
                              Stok: {p.stock}
                            </div>
                            <div className="text-xs text-gray-500">
                              Modal: Rp{" "}
                              {Number(p.cost || 0).toLocaleString("id-ID")}
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
                    onClick={() => {
                      setShowProductSelectModal({ open: false, index: null });
                      setProductSearchTerm("");
                    }}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Supplier Select Modal for Purchase Order */}
        {showSupplierSelectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex">
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Pilih Supplier
                  </h3>
                  <button
                    onClick={() => {
                      setShowSupplierSelectModal(false);
                      setSupplierSearchTerm("");
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>

                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Cari supplier berdasarkan nama, kontak, atau telepon..."
                    value={supplierSearchTerm}
                    onChange={(e) => setSupplierSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                  {filteredSuppliersForSelect.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      {supplierSearchTerm
                        ? "Tidak ada supplier yang cocok"
                        : "Belum ada supplier"}
                    </div>
                  ) : (
                    filteredSuppliersForSelect.map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setNewPurchase({ ...newPurchase, supplierId: s.id });
                          setShowSupplierSelectModal(false);
                          setSupplierSearchTerm("");
                        }}
                        className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">
                              {s.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {s.contact_person || ""}
                              {s.phone ? ` • ${s.phone}` : ""}
                            </div>
                          </div>
                          <div className="text-right text-xs text-gray-400">
                            {s.email || ""}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4 mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSupplierSelectModal(false);
                      setSupplierSearchTerm("");
                    }}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {products.length}
            </h3>
            <p className="text-gray-600 text-sm">Total Produk</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShoppingBag className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {purchaseOrders?.length || 0}
            </h3>
            <p className="text-gray-600 text-sm">Purchase Order</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Truck className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {suppliers?.length || 0}
            </h3>
            <p className="text-gray-600 text-sm">Supplier</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {lowStockProducts.length}
            </h3>
            <p className="text-gray-600 text-sm">Stok Menipis</p>
          </div>
        </div>
      </div>
      {/* Modal Edit Supplier */}
      {showEditSupplierForm && editSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Edit Supplier
              </h2>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Supplier *
                  </label>
                  <input
                    type="text"
                    value={editSupplier.name}
                    onChange={(e) =>
                      setEditSupplier({ ...editSupplier, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Nama perusahaan supplier"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kontak Person *
                  </label>
                  <input
                    type="text"
                    value={editSupplier.contact_person}
                    onChange={(e) =>
                      setEditSupplier({
                        ...editSupplier,
                        contact_person: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Nama kontak person"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telepon
                    </label>
                    <input
                      type="text"
                      value={editSupplier.phone}
                      onChange={(e) =>
                        setEditSupplier({
                          ...editSupplier,
                          phone: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="+62 8xx-xxxx-xxxx"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kategori
                    </label>
                    <select
                      value={editSupplier.category}
                      onChange={(e) =>
                        setEditSupplier({
                          ...editSupplier,
                          category: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="beverage">Minuman</option>
                      <option value="food">Makanan</option>
                      <option value="snack">Snack</option>
                      <option value="other">Lainnya</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editSupplier.email}
                    onChange={(e) =>
                      setEditSupplier({
                        ...editSupplier,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="email@supplier.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alamat
                  </label>
                  <textarea
                    value={editSupplier.address}
                    onChange={(e) =>
                      setEditSupplier({
                        ...editSupplier,
                        address: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Alamat lengkap supplier"
                    rows={2}
                  />
                </div>
              </form>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEditSupplierForm(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleEditSupplier}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Reduction Modal */}
      {showStockReductionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Kurangi Stok Produk
                </h2>
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
                  if (
                    !stockReductionForm.product_id ||
                    stockReductionForm.quantity <= 0
                  ) {
                    Swal.fire(
                      "Error",
                      "Pilih produk dan jumlah yang valid",
                      "error"
                    );
                    return;
                  }

                  try {
                    // Decrease stock
                    await db.products.decreaseStock(
                      stockReductionForm.product_id,
                      stockReductionForm.quantity
                    );

                    // Create transaction log for stock reduction
                    const product = products.find(
                      (p) => p.id === stockReductionForm.product_id
                    );
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
                      description: `${
                        stockReductionForm.notes || "Stok dikurangi manual"
                      }`,
                      reference_id: `STOCK_REDUCTION-${Date.now()}`,
                      timestamp: new Date().toISOString(),
                    });

                    Swal.fire("Berhasil", "Stok berhasil dikurangi", "success");
                    setShowStockReductionForm(false);
                    setStockReductionForm({
                      product_id: "",
                      quantity: 1,
                      // reason: "",
                      notes: "",
                    });
                    (window as any).refreshProducts();
                  } catch (error) {
                    console.error("Error reducing stock:", error);
                    Swal.fire("Error", "Gagal mengurangi stok", "error");
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pilih Produk
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setShowProductSelectForStockReduction(true)
                      }
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-left focus:ring-2 focus:ring-red-500 focus:border-transparent hover:bg-gray-50"
                    >
                      {stockReductionForm.product_id ? (
                        (() => {
                          const selectedProduct = products.find(
                            (p) => p.id === stockReductionForm.product_id
                          );
                          return renderProductIdentity({
                            product: selectedProduct,
                            name:
                              selectedProduct?.name || "Produk tidak ditemukan",
                            secondaryText: `Stok: ${selectedProduct?.stock || 0}`,
                          });
                        })()
                      ) : (
                        <span className="text-gray-500">
                          Klik untuk pilih produk...
                        </span>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jumlah
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={stockReductionForm.quantity}
                    onChange={(e) =>
                      setStockReductionForm({
                        ...stockReductionForm,
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alasan
                  </label>
                  <select
                    value={stockReductionForm.reason}
                    onChange={(e) =>
                      setStockReductionForm({
                        ...stockReductionForm,
                        reason: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  >
                    <option value="">Pilih alasan...</option>
                    <option value="Rusak">Rusak</option>
                    <option value="Expired">Expired</option>
                    <option value="Hilang">Hilang</option>
                    <option value="Penggunaan Internal">
                      Penggunaan Internal
                    </option>
                    <option value="Adjustment">Adjustment</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div> */}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catatan (Opsional)
                  </label>
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

      {/* Product Select Modal for Stock Reduction */}
      {showProductSelectForStockReduction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex">
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Pilih Produk untuk Pengurangan Stok
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if ((window as any).refreshProducts) {
                        await (window as any).refreshProducts();
                      }
                    }}
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
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                {filteredProductsForSelect.filter(
                  (p) => p.product_type === "raw_material"
                ).length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    {productSearchTerm
                      ? "Tidak ada produk bahan baku yang cocok"
                      : "Belum ada produk bahan baku"}
                  </div>
                ) : (
                  filteredProductsForSelect
                    .filter((p) => p.product_type === "raw_material") // Filter hanya raw_material
                    .map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setStockReductionForm({
                            ...stockReductionForm,
                            product_id: p.id,
                          });
                          setShowProductSelectForStockReduction(false);
                          setProductSearchTerm("");
                        }}
                        className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            {renderProductThumbnail(p, "h-12 w-12")}
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {p.name}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                Kategori: {p.category || "-"}
                                {p.barcode ? ` • Barcode: ${p.barcode}` : ""}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-700">
                              Stok: {p.stock}
                            </div>
                            <div className="text-xs text-gray-500">
                              Modal: Rp{" "}
                              {Number(p.cost || 0).toLocaleString("id-ID")}
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

      {/* Print Price List Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Print Product List
                </h2>
                <button
                  onClick={() => {
                    setShowPrintModal(false);
                    setSelectedProductsForPrint([]);
                    setSelectAllProducts(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Pilih produk yang akan dicetak dalam daftar harga
              </p>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Select All Checkbox */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectAllProducts}
                    onChange={(e) => {
                      setSelectAllProducts(e.target.checked);
                      if (e.target.checked) {
                        setSelectedProductsForPrint(products.map((p) => p.id));
                      } else {
                        setSelectedProductsForPrint([]);
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-900">
                    Pilih Semua Produk ({products.length})
                  </span>
                </label>
              </div>

              {/* Select Low Stock Checkbox */}
              <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectLowStockProducts}
                    onChange={(e) => {
                      const lowStockProducts = products.filter(
                        (p) => p.stock <= p.min_stock
                      );
                      setSelectLowStockProducts(e.target.checked);
                      if (e.target.checked) {
                        setSelectedProductsForPrint((prev) => [
                          ...prev,
                          ...lowStockProducts
                            .map((p) => p.id)
                            .filter((id) => !prev.includes(id)),
                        ]);
                      } else {
                        setSelectedProductsForPrint((prev) =>
                          prev.filter(
                            (id) => !lowStockProducts.some((p) => p.id === id)
                          )
                        );
                      }
                    }}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="font-medium text-orange-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Pilih Produk Stok Rendah (
                    {products.filter((p) => p.stock <= p.min_stock).length})
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                {products
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProductsForPrint.includes(product.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductsForPrint((prev) => [
                              ...prev,
                              product.id,
                            ]);
                          } else {
                            setSelectedProductsForPrint((prev) =>
                              prev.filter((id) => id !== product.id)
                            );
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        {renderProductIdentity({
                          product,
                          name: product.name,
                          secondaryText: `${product.category} • Rp ${product.price.toLocaleString("id-ID")} • ${product.stock} ${product.unit}`,
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {selectedProductsForPrint.length} produk dipilih
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowPrintModal(false);
                      setSelectedProductsForPrint([]);
                      setSelectAllProducts(false);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleCopyPriceList}
                    disabled={selectedProductsForPrint.length === 0}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                      selectedProductsForPrint.length === 0
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    <Copy className="h-4 w-4" />
                    Copy ({selectedProductsForPrint.length})
                  </button>
                  <button
                    onClick={handlePrintPriceList}
                    disabled={selectedProductsForPrint.length === 0}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                      selectedProductsForPrint.length === 0
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  >
                    <Printer className="h-4 w-4" />
                    Print ({selectedProductsForPrint.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Products;
