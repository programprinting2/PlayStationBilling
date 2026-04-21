import React, { useState, useRef, useEffect } from "react";
import { db } from "../lib/supabase";
import Swal from "sweetalert2";
import { Plus, Search, Trash, XCircle, Printer } from "lucide-react";
import {
  printStockOpname,
  StockOpnameData,
  printStockOpnameForm,
  StockOpnameFormData,
} from "../utils/receipt";
import { useAuth } from "../contexts/AuthContext";

type Product = any;

const generateId = () => Math.random().toString(36).slice(2, 9);

const MONTH_ABBR_ID = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MEI",
  "JUN",
  "JUL",
  "AGT",
  "SEP",
  "OKT",
  "NOV",
  "DES",
];

const formatNomor = (date: Date, seq: number) => {
  const m = MONTH_ABBR_ID[date.getMonth()] || "XXX";
  const yy = String(date.getFullYear()).slice(-2);
  const xxx = String(seq).padStart(3, "0");
  return `SO-${m}${yy}-${xxx}`;
};

const getLocalNextSeq = (sessions: any[], date: Date) => {
  const mm = date.getMonth();
  const yy = date.getFullYear();
  const same = sessions.filter((s: any) => {
    try {
      const d = new Date(s.createdAt || s.created_at || s.opname_date || null);
      return d.getMonth() === mm && d.getFullYear() === yy;
    } catch (e) {
      return false;
    }
  });
  return (same.length || 0) + 1;
};

const StokOpname: React.FC<{
  products: Product[];
  onOpenCreate?: () => void;
}> = ({ products, onOpenCreate }) => {
  const [sessions, setSessions] = useState<any[]>([]); // local saved sessions
  const [savedSessions, setSavedSessions] = useState<any[]>([]); // sessions from database
  const [current, setCurrent] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingLoading, setSavingLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [showProductSelectModal, setShowProductSelectModal] = useState<{
    open: boolean;
    index: number | null;
  }>({ open: false, index: null });
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set()
  );
  const [sessionItemsMap, setSessionItemsMap] = useState<Record<string, any[]>>(
    {}
  );
  const { user } = useAuth();

  // Print Form modal states (pilih produk untuk form kosong)
  const [showPrintFormModal, setShowPrintFormModal] = useState(false);
  const [selectedProductsForForm, setSelectedProductsForForm] = useState<
    string[]
  >([]);
  const [selectAllProductsForForm, setSelectAllProductsForForm] =
    useState(false);
  // Filters like purchases list
  const [opnameSearch, setOpnameSearch] = useState<string>("");
  const [opnamePeriod, setOpnamePeriod] = useState<string>("week");
  const [opnameDateRange, setOpnameDateRange] = useState<{
    start: string;
    end: string;
  }>({ start: "", end: "" });

  // track focused input to restore focus after state updates (prevents focus-jump)
  const focusedRef = useRef<{
    id: string;
    field: string;
    start: number | null;
    end: number | null;
  } | null>(null);
  // per-row input refs to reliably restore focus to the correct input
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // restore focus to input after updates (if we recorded it)
  useEffect(() => {
    const info = focusedRef.current;
    if (!info) return;
    // first try: use the dedicated per-row ref map (most reliable)
    try {
      const el = inputRefs.current[info.id];
      if (el) {
        el.focus();
        if (info.start !== null && info.end !== null) {
          try {
            el.setSelectionRange(info.start, info.end);
          } catch (e) {}
        }
        focusedRef.current = null;
        return;
      }
    } catch (e) {
      // ignore
    }
    // fallback: try to find input by data attributes in the DOM
    try {
      const selector = `input[data-row-id="${info.id}"][data-field="${info.field}"]`;
      const el = document.querySelector(selector) as HTMLInputElement | null;
      if (el) {
        el.focus();
        if (info.start !== null && info.end !== null) {
          try {
            el.setSelectionRange(info.start, info.end);
          } catch (e) {}
        }
        focusedRef.current = null;
        return;
      }
    } catch (e) {
      // ignore
    }
    focusedRef.current = null;
  }, [current]);

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

  const getProductImageUrl = (product: any) =>
    product?.image_url || product?.image || "";

  const renderProductThumbnail = (product: any, sizeClass = "h-10 w-10") => {
    const imageUrl = getProductImageUrl(product);

    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt={product?.name || "Produk"}
          className={`${sizeClass} flex-shrink-0 rounded-lg object-cover border border-gray-200 bg-gray-100`}
          loading="lazy"
        />
      );
    }

    return (
      <div
        className={`${sizeClass} flex-shrink-0 rounded-lg border border-dashed border-gray-300 bg-gray-100 text-[10px] font-semibold uppercase tracking-wide text-gray-500 flex items-center justify-center`}
      >
        IMG
      </div>
    );
  };

  const renderProductIdentity = ({
    product,
    name,
    secondaryText,
    sizeClass = "h-10 w-10",
  }: {
    product?: any;
    name: string;
    secondaryText?: string;
    sizeClass?: string;
  }) => (
    <div className="flex min-w-0 items-center gap-2">
      {renderProductThumbnail(product, sizeClass)}
      <div className="min-w-0">
        <div className="truncate font-medium text-gray-900">{name}</div>
        {secondaryText && (
          <div className="truncate text-xs text-gray-500">{secondaryText}</div>
        )}
      </div>
    </div>
  );

  // Load saved sessions from database
  const loadSavedSessions = async () => {
    try {
      setLoading(true);
      const sessions = await (db as any).stockOpname.getAllSessions();
      setSavedSessions(sessions);

      // Load first session as current if no current session exists
      // if (sessions.length > 0 && !current) {
      //   const firstSession = await (db as any).stockOpname.getSessionWithItems(
      //     sessions[0].id
      //   );
      //   setCurrent(firstSession);
      // }
    } catch (err: any) {
      console.error("Error loading sessions:", err);
      Swal.fire({
        icon: "error",
        title: "Gagal memuat sesi",
        text: err?.message || "Terjadi kesalahan saat memuat sesi stok opname.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load specific session with items
  const loadSession = async (sessionId: string) => {
    try {
      setLoading(true);
      const session = await (db as any).stockOpname.getSessionWithItems(
        sessionId
      );
      setSessionItemsMap((m: any) => ({
        ...m,
        [sessionId]: session.rows || [],
      }));
      setExpandedSessions((prev) => {
        const s = new Set(prev);
        if (s.has(sessionId)) s.delete(sessionId);
        else s.add(sessionId);
        return s;
      });
    } catch (err: any) {
      console.error("Error loading session:", err);
      Swal.fire({
        icon: "error",
        title: "Gagal memuat sesi",
        text: err?.message || "Terjadi kesalahan saat memuat sesi stok opname.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load sessions on component mount
  React.useEffect(() => {
    loadSavedSessions();
  }, []);

  // Compute filtered sessions (by period + search)
  const filteredSavedSessions = React.useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    switch (opnamePeriod) {
      case "today": {
        const s = new Date();
        s.setHours(0, 0, 0, 0);
        start = s;
        const e = new Date();
        e.setHours(23, 59, 59, 999);
        end = e;
        break;
      }
      case "yesterday": {
        const s = new Date();
        s.setDate(s.getDate() - 1);
        s.setHours(0, 0, 0, 0);
        start = s;
        const e = new Date(s);
        e.setHours(23, 59, 59, 999);
        end = e;
        break;
      }
      case "week": {
        const s = new Date();
        const d = s.getDay();
        const diff = (d === 0 ? -6 : 1) - d;
        s.setDate(s.getDate() + diff);
        s.setHours(0, 0, 0, 0);
        start = s;
        const e = new Date();
        e.setHours(23, 59, 59, 999);
        end = e;
        break;
      }
      case "month": {
        const s = new Date(now.getFullYear(), now.getMonth(), 1);
        start = s;
        const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        e.setHours(23, 59, 59, 999);
        end = e;
        break;
      }
      case "range": {
        if (opnameDateRange.start) {
          start = new Date(opnameDateRange.start);
          start.setHours(0, 0, 0, 0);
        }
        if (opnameDateRange.end) {
          end = new Date(opnameDateRange.end);
          end.setHours(23, 59, 59, 999);
        }
        break;
      }
      default:
        break;
    }
    const out = (savedSessions || [])
      .filter((s: any) => {
        const dt = s.opname_date
          ? new Date(s.opname_date)
          : s.created_at
          ? new Date(s.created_at)
          : null;
        if (dt) {
          if (start && dt < start) return false;
          if (end && dt > end) return false;
        }
        if (!opnameSearch) return true;
        const st = opnameSearch.toLowerCase();
        const nomor = String(s.nomor || s.name || "").toLowerCase();
        return nomor.includes(st);
      })
      .sort((a: any, b: any) => {
        const da = new Date(a.opname_date || a.created_at).getTime();
        const db = new Date(b.opname_date || b.created_at).getTime();
        return db - da; // newest first
      });
    return out;
  }, [
    savedSessions,
    opnameSearch,
    opnamePeriod,
    opnameDateRange.start,
    opnameDateRange.end,
  ]);

  const startNew = async () => {
    try {
      const now = new Date();
      const dbSeq = await (db as any).stockOpname.getNextSequenceNumber(now);
      const nomor = formatNomor(now, dbSeq);
      const s = {
        id: generateId(),
        nomor,
        name: nomor,
        createdAt: new Date().toISOString(),
        opnameDate: new Date().toISOString(),
        notes: "",
        rows: [] as any[],
      };
      setCurrent(s);
      setShowCreateModal(true);
    } catch (err: any) {
      console.error("Error generating nomor:", err);
      const now = new Date();
      const localSeq = getLocalNextSeq([...sessions, ...savedSessions], now);
      const nomor = formatNomor(now, localSeq);
      const s = {
        id: generateId(),
        nomor,
        name: nomor,
        createdAt: new Date().toISOString(),
        opnameDate: new Date().toISOString(),
        notes: "",
        rows: [] as any[],
      };
      setCurrent(s);
      setShowCreateModal(true);
    }
  };

  const addRow = async (product?: Product) => {
    if (!current) await startNew();
    const row = {
      id: generateId(),
      productId: product?.id ?? null,
      code:
        product?.code || product?.sku || product?.barcode || product?.id || "",
      productName: product?.name ?? "",
      barcode: product?.barcode ?? "",
      systemStock: product?.stock ?? 0,
      physicalStock: 0,
      note: "",
      unitCost: Number(product?.cost || product?.price || 0),
      unit: product?.unit || "pcs",
    };
    setCurrent((c: any) => ({ ...c, rows: [...(c?.rows || []), row] }));
  };

  // Add row with product selection for existing sessions
  // const addRowWithProduct = async () => {
  //   if (!current) await startNew();
  //   const row = {
  //     id: generateId(),
  //     productId: null,
  //     code: "",
  //     productName: "",
  //     barcode: "",
  //     systemStock: 0,
  //     physicalStock: 0,
  //     note: "",
  //     unitCost: 0,
  //   };
  //   setCurrent((c: any) => ({ ...c, rows: [...(c?.rows || []), row] }));
  // };

  const updateRow = (id: string, changes: Partial<any>) => {
    setCurrent((c: any) => {
      if (!c) return c;
      const rows = (c.rows || []).map((r: any) =>
        r.id === id ? { ...r, ...changes } : r
      );
      return { ...c, rows };
    });
  };

  const removeRow = (id: string) => {
    if (!current) return;
    const rows = (current.rows || []).filter((r: any) => r.id !== id);
    // cleanup ref map
    if (inputRefs.current[id]) delete inputRefs.current[id];
    setCurrent({ ...current, rows });
  };

  const saveSession = () => {
    if (!current) return;
    setSessions((s) => [current, ...s]);
    setCurrent(null);
  };

  const parseCSV = (text: string) => {
    // naive CSV parser: split by lines, commas; expect header or simple rows
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];
    const rows: { productKey: string; qty: number }[] = [];
    // Try detect header: if first line contains non-numeric in qty position
    for (const line of lines) {
      const cols = line.split(",").map((c) => c.trim());
      if (cols.length === 0) continue;
      // Try: barcode,name,qty or name,qty or barcode,qty
      let productKey = cols[0];
      let qty =
        Number((cols[cols.length - 1] || "").replace(/[^0-9.-]/g, "")) || 0;
      // If first line looks like header (contains 'name' or 'barcode' or 'qty'), skip
      if (/name|barcode|qty|quantity/i.test(productKey) && rows.length === 0)
        continue;
      rows.push({ productKey, qty });
    }
    return rows;
  };

  const importCSV = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const txt = String(e.target?.result || "");
      const parsed = parseCSV(txt);
      if (!current) await startNew();
      // Map parsed rows to products (by barcode or name)
      const mapped = parsed.map((r) => {
        const lower = String(r.productKey).toLowerCase();
        const found = products.find(
          (p: any) =>
            String(p.barcode || "").toLowerCase() === lower ||
            String(p.name || "")
              .toLowerCase()
              .includes(lower)
        );
        return {
          id: generateId(),
          productId: found?.id ?? null,
          productName: found?.name ?? r.productKey,
          barcode: found?.barcode ?? "",
          systemStock: found?.stock ?? 0,
          physicalStock: Number(r.qty) || 0,
        };
      });
      setCurrent((c: any) => ({ ...c, rows: [...(c?.rows || []), ...mapped] }));
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    importCSV(f ?? null);
    // clear file input to allow re-import of same file
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // const computeSummary = (s: any) => {
  //   const rows = s?.rows || [];
  //   let totalSystem = 0;
  //   let totalPhysical = 0;
  //   let totalDiff = 0;
  //   for (const r of rows) {
  //     const sys = Number(r.systemStock || 0);
  //     const phy = Number(r.physicalStock ?? 0);
  //     totalSystem += sys;
  //     totalPhysical += phy;
  //     totalDiff += phy - sys;
  //   }
  //   return { totalSystem, totalPhysical, totalDiff };
  // };

  const computeTotalsWithNominal = (s: any) => {
    const rows = s?.rows || [];
    let totalDiff = 0;
    let totalNominal = 0;
    for (const r of rows) {
      const sys = Number(r.systemStock || 0);
      const phy = Number(r.physicalStock ?? 0);
      const diff = phy - sys;
      totalDiff += diff;
      totalNominal += diff * Number(r.unitCost || 0);
    }
    return { totalDiff, totalNominal };
  };

  // product select handler: open modal for index
  const openProductSelect = (index: number) => {
    setShowProductSelectModal({ open: true, index });
    setProductSearchTerm("");
  };

  const handleSelectProduct = (p: any) => {
    if (showProductSelectModal.index === null) {
      setShowProductSelectModal({ open: false, index: null });
      return;
    }
    const idx = showProductSelectModal.index;
    setCurrent((c: any) => {
      const items = [...(c.rows || [])];
      const unitCost = Number(p.cost || p.price || 0);
      items[idx] = {
        ...items[idx],
        productId: p.id,
        productName: p.name,
        barcode: p.barcode || "",
        systemStock: Number(p.stock || 0),
        unitCost,
        unit: p.unit || "pcs",
      };
      return { ...c, rows: items };
    });
    setShowProductSelectModal({ open: false, index: null });
    setProductSearchTerm("");
  };

  const saveToServer = async () => {
    if (!current) return;
    const hasRows = (current.rows || []).length > 0;
    if (!hasRows) {
      Swal.fire({
        icon: "warning",
        title: "Tidak ada item",
        text: "Tambahkan minimal satu item sebelum menyimpan.",
      });
      return;
    }
    setSavingLoading(true);
    try {
      const totals = computeTotalsWithNominal(current);
      const isExisting = Boolean(current.id && String(current.id).length > 8); // simple heuristic: DB uuid vs local id
      let sessionId = current.id;

      if (!isExisting) {
        const session = await (db as any).stockOpname.createSession({
          nomor: current.nomor,
          name: current.name,
          opname_date: current.opnameDate || current.createdAt,
          notes: current.notes,
          totals_diff: totals.totalDiff,
          totals_nominal: totals.totalNominal,
        });
        sessionId = session.id;
        // insert items
        await (db as any).stockOpname.addItems(
          sessionId,
          (current.rows || []).map((r: any) => ({
            productId: r.productId,
            productName: r.productName,
            barcode: r.barcode,
            systemStock: r.systemStock,
            physicalStock: r.physicalStock,
            unitCost: r.unitCost,
          }))
        );
        await (db as any).stockOpname.syncProductStocks(
          (current.rows || []).map((r: any) => ({
            productId: r.productId,
            physicalStock: r.physicalStock,
          }))
        );
      } else {
        await (db as any).stockOpname.updateSession(sessionId, {
          name: current.name,
          opname_date: current.opnameDate || current.createdAt,
          notes: current.notes,
          totals_diff: totals.totalDiff,
          totals_nominal: totals.totalNominal,
        });
        // replace items
        await (db as any).stockOpname.replaceItems(
          sessionId,
          (current.rows || []).map((r: any) => ({
            productId: r.productId,
            productName: r.productName,
            barcode: r.barcode,
            systemStock: r.systemStock,
            physicalStock: r.physicalStock,
            unitCost: r.unitCost,
          }))
        );
        await (db as any).stockOpname.syncProductStocks(
          (current.rows || []).map((r: any) => ({
            productId: r.productId,
            physicalStock: r.physicalStock,
          }))
        );
      }

      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: isExisting
          ? "Perubahan sesi Stok Opname telah disimpan."
          : "Sesi Stok Opname tersimpan dan stok produk diperbarui.",
      });
      if (!isExisting) {
        setSessions((s) => [
          {
            ...current,
            id: sessionId,
            totals,
            opnameDate: current.opnameDate || current.createdAt,
          },
          ...s,
        ]);
      }
      setCurrent((c: any) => (c ? { ...c, id: sessionId, totals } : c));
      setShowCreateModal(false);
      // Reload saved sessions to show the new one
      loadSavedSessions();
    } catch (err: any) {
      console.error("saveToServer error", err);
      Swal.fire({
        icon: "error",
        title: "Gagal menyimpan",
        text: err?.message || "Terjadi kesalahan saat menyimpan stok opname.",
      });
    } finally {
      setSavingLoading(false);
    }
  };

  // Modal & product-select UI
  const CreateModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Buat Stok Opname
          </h2>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nomor Stok Opname
                </label>
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                  {current?.nomor}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Stok Opname
                </label>
                <input
                  type="date"
                  value={new Date().toISOString().slice(0, 10)}
                  // value={
                  //   current
                  //     ? new Date(current.opnameDate || current.createdAt)
                  //         .toLocaleString()
                  //         .slice(0, 10)
                  //     : ""
                  // }
                  // onChange={async (e) => {
                  //   const val = e.target.value;
                  //   const d = new Date(val + "T00:00:00");
                  //   try {
                  //     // Get next sequence number from database for the new date
                  //     const dbSeq = await (
                  //       db as any
                  //     ).stockOpname.getNextSequenceNumber(d);
                  //     const newNomor = formatNomor(d, dbSeq);
                  //     setCurrent((c: any) => ({
                  //       ...c,
                  //       opnameDate: d.toISOString(),
                  //       nomor: newNomor,
                  //       name: newNomor,
                  //     }));
                  //   } catch (err) {
                  //     // Fallback to local sequence if database fails
                  //     const seq = getLocalNextSeq(
                  //       [...sessions, ...savedSessions],
                  //       d
                  //     );
                  //     const newNomor = formatNomor(d, seq);
                  //     setCurrent((c: any) => ({
                  //       ...c,
                  //       opnameDate: d.toISOString(),
                  //       nomor: newNomor,
                  //       name: newNomor,
                  //     }));
                  //   }
                  // }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Item Stok Opname
                </h3>
                <button
                  type="button"
                  onClick={async () => await addRow()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Tambah Item
                </button>
              </div>

              <div className="space-y-3">
                {(current?.rows || []).map((item: any, index: number) => (
                  <div
                    key={item.id || index}
                    className="grid grid-cols-12 gap-3 items-end p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="col-span-4">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Produk
                      </label>
                      <button
                        type="button"
                        onClick={() => openProductSelect(index)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-left flex items-center justify-between gap-2"
                      >
                        <span className="min-w-0">
                          {item.productId ? (
                            (() => {
                              const selectedProduct = products.find(
                                (p) => p.id === item.productId
                              );
                              return renderProductIdentity({
                                product: selectedProduct,
                                name:
                                  selectedProduct?.name ||
                                  item.productName ||
                                  "Pilih Produk",
                                secondaryText: selectedProduct
                                  ? `${selectedProduct.category || "produk"} • ${selectedProduct.unit || "pcs"}`
                                  : undefined,
                              });
                            })()
                          ) : (
                            <span className="text-gray-500">Pilih Produk</span>
                          )}
                        </span>
                        <Search className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Stok Komputer
                      </label>
                      <div className="px-2 py-1 bg-gray-100 rounded text-sm font-medium text-right">
                        {Number(item.systemStock || 0).toLocaleString()}{" "}
                        {item.unit}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Stok Fisik
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          data-row-id={item.id}
                          data-field="physicalStock"
                          value={item.physicalStock ?? ""}
                          ref={(el) => {
                            inputRefs.current[item.id] = el;
                          }}
                          autoFocus={true}
                          onFocus={(e) => {
                            const target = e.target as HTMLInputElement;
                            focusedRef.current = {
                              id: item.id,
                              field: "physicalStock",
                              start: target.selectionStart,
                              end: target.selectionEnd,
                            };
                          }}
                          onChange={(e) => {
                            const raw = String(e.target.value || "");
                            const cleaned = raw.replace(/[^0-9.-]/g, "");
                            const v = cleaned === "" ? 0 : Number(cleaned);
                            updateRow(item.id, { physicalStock: v });
                          }}
                          className="w-full px-2 py-1 pr-10 border border-gray-300 rounded text-sm text-right"
                        />
                        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                          {item.unit}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Selisih
                      </label>
                      <div className="px-2 py-1 bg-gray-100 rounded text-sm font-medium text-right">
                        {(
                          Number(item.physicalStock ?? 0) -
                          Number(item.systemStock || 0)
                        ).toLocaleString()}
                      </div>
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Harga Beli
                      </label>
                      <div className="px-2 py-1 bg-gray-100 rounded text-sm font-medium text-right">
                        Rp {Number(item.unitCost || 0).toLocaleString("id-ID")}
                      </div>
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Nominal
                      </label>
                      <div className="px-2 py-1 bg-gray-100 rounded text-sm font-medium text-right">
                        Rp{" "}
                        {(
                          (Number(item.physicalStock ?? 0) -
                            Number(item.systemStock || 0)) *
                          Number(item.unitCost || 0)
                        ).toLocaleString("id-ID")}
                      </div>
                    </div>
                    <div className="col-span-12 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(item.id)}
                        className="text-sm text-red-600"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {(current?.rows || []).length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg">
                  <h4 className="font-medium text-indigo-900 mb-3">
                    Ringkasan Stok Opname
                  </h4>
                  <div className="flex justify-between items-center">
                    <div className="text-indigo-800">Total Selisih</div>
                    <div className="font-medium text-indigo-900">
                      {computeTotalsWithNominal(
                        current
                      ).totalDiff.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-indigo-800">Total Nominal Selisih</div>
                    <div className="font-medium text-indigo-900">
                      Rp{" "}
                      {computeTotalsWithNominal(
                        current
                      ).totalNominal.toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan (Opsional)
              </label>
              <textarea
                value={current?.notes || ""}
                onChange={(e) =>
                  setCurrent((c: any) => ({ ...c, notes: e.target.value }))
                }
                autoFocus={true}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCurrent(null);
                }}
                className="flex-1 px-4 py-2 border rounded-lg font-medium"
              >
                Batal
              </button>
              <button
                onClick={() => saveToServer()}
                className={`flex-1 text-white px-4 py-2 rounded-lg ${
                  (current?.rows || []).length === 0
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700"
                } font-medium`}
                disabled={(current?.rows || []).length === 0}
              >
                {savingLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Menyimpan...
                  </div>
                ) : (
                  "Buat Stok Opname"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ProductSelectModal = () =>
    showProductSelectModal.open ? (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex">
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                Pilih Produk
              </h3>
              <button
                onClick={() =>
                  setShowProductSelectModal({ open: false, index: null })
                }
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Cari produk..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                autoFocus={true}
                className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg"
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
                    onClick={() => handleSelectProduct(p)}
                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 pr-3">
                        {renderProductIdentity({
                          product: p,
                          name: p.name,
                          secondaryText: `Kategori: ${p.category || "-"}${
                            p.barcode ? ` • Barcode: ${p.barcode}` : ""
                          }`,
                          sizeClass: "h-12 w-12",
                        })}
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
                onClick={() =>
                  setShowProductSelectModal({ open: false, index: null })
                }
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  // removed LoadSessionModal

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Stok Opname</h2>
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-500">
            Total: {savedSessions.length} sesi
          </div>
          {onOpenCreate && (
            <button
              onClick={async () => await startNew()}
              className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
            >
              Buat Stok Opname
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileInput}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm"
          >
            Import CSV
          </button>
          <button
            onClick={() => {
              setShowPrintFormModal(true);
              setSelectAllProductsForForm(false);
              setSelectedProductsForForm([]);
            }}
            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm flex items-center gap-2"
          >
            <Printer className="h-4 w-4" /> Print Form
          </button>
          <button
            onClick={async () => {
              await startNew();
            }}
            className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
          >
            Buat Stok Opname
          </button>
          <button
            onClick={() => {
              if (current) saveSession();
            }}
            className={`px-3 py-1 rounded text-white text-sm ${
              !current
                ? "bg-gray-300 cursor-not-allowed"
                : (current?.rows || []).length === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            }`}
            disabled={!current || (current?.rows || []).length === 0}
          >
            Simpan (lokal)
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-gray-500 mb-4">
          Memuat sesi stok opname...
        </div>
      )}

      {!loading && !current && savedSessions.length === 0 && (
        <div className="text-sm text-gray-500 mb-4">
          Tekan "Buat Stok Opname" untuk memulai.
        </div>
      )}

      {/* {current && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-gray-500">Sesi</div>
                <div className="font-medium">
                  {current.name}{" "}
                  {current.nomor ? (
                    <span className="text-xs text-gray-500 ml-2">
                      ({current.nomor})
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Dibuat</div>
                <div className="font-medium">
                  {current.created_at
                    ? new Date(current.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Tanggal tidak tersedia"}
                </div>
              </div>
            </div>

            {(() => {
              const isExisting = Boolean(
                current?.id && String(current.id).length > 8
              );
              if (isExisting) {
                return (
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={async () => {
                        try {
                          await (db as any).stockOpname.deleteSession(
                            current.id
                          );
                          Swal.fire({
                            icon: "success",
                            title: "Terhapus",
                            text: "Sesi stok opname dihapus.",
                          });
                          setCurrent(null);
                          loadSavedSessions();
                        } catch (e: any) {
                          Swal.fire({
                            icon: "error",
                            title: "Gagal",
                            text: e?.message || "Gagal menghapus sesi",
                          });
                        }
                      }}
                      className="px-3 py-1 rounded bg-red-600 text-white text-sm"
                    >
                      Hapus Sesi
                    </button>
                  </div>
                );
              }
              return (
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={async () => await addRowWithProduct()}
                    className="px-3 py-1 rounded bg-blue-600 text-white text-sm flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" /> Tambah Item
                  </button>
                  <button
                    onClick={() => saveToServer()}
                    className={`px-3 py-1 rounded text-white text-sm ${
                      (current?.rows || []).length === 0
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                    disabled={(current?.rows || []).length === 0}
                  >
                    Simpan
                  </button>
                  <button
                    onClick={() => setCurrent(null)}
                    className="px-3 py-1 rounded bg-gray-500 text-white text-sm"
                  >
                    Tutup Sesi
                  </button>
                </div>
              );
            })()}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Produk
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Sistem
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Fisik
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Selisih
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Harga Beli
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Nominal
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Catatan
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {(current.rows || []).map((r: any, index: number) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openProductSelect(index)}
                          disabled={Boolean(
                            current?.id && String(current.id).length > 8
                          )}
                          className="w-full text-left px-2 py-1 border border-gray-300 rounded text-sm flex items-center justify-between hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <span>
                            {r.productId
                              ? products.find((p) => p.id === r.productId)
                                  ?.name ||
                                r.productName ||
                                "Pilih Produk"
                              : "Pilih Produk"}
                          </span>
                          <Search className="h-4 w-4 text-gray-400" />
                        </button>
                        {r.barcode && (
                          <div className="text-xs text-gray-500 mt-1">
                            Barcode: {r.barcode}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {Number(r.systemStock || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="text"
                          inputMode="numeric"
                          data-row-id={r.id}
                          data-field="physicalStock"
                          value={r.physicalStock ?? ""}
                          ref={(el) => {
                            inputRefs.current[r.id] = el;
                          }}
                          disabled={Boolean(
                            current?.id && String(current.id).length > 8
                          )}
                          onFocus={(e) => {
                            const t = e.target as HTMLInputElement;
                            focusedRef.current = {
                              id: r.id,
                              field: "physicalStock",
                              start: t.selectionStart,
                              end: t.selectionEnd,
                            };
                          }}
                          onChange={(e) => {
                            const raw = String(e.target.value || "");
                            const cleaned = raw.replace(/[^0-9.-]/g, "");
                            const v = cleaned === "" ? 0 : Number(cleaned);
                            updateRow(r.id, { physicalStock: v });
                          }}
                          className="w-20 text-right px-2 py-1 border rounded appearance-none"
                          style={{ MozAppearance: "textfield" as any }}
                        />
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          Number(r.physicalStock || 0) -
                            Number(r.systemStock || 0) >
                          0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {(
                          (r.physicalStock ?? 0) - (r.systemStock ?? 0)
                        ).toLocaleString?.() ??
                          (r.physicalStock ?? 0) - (r.systemStock ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="text-sm">
                          Rp {Number(r.unitCost || 0).toLocaleString("id-ID")}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="text-sm font-medium">
                          Rp{" "}
                          {(
                            ((r.physicalStock || 0) - (r.systemStock || 0)) *
                            Number(r.unitCost || 0)
                          ).toLocaleString("id-ID")}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={r.note || ""}
                          onChange={(e) =>
                            updateRow(r.id, { note: e.target.value })
                          }
                          disabled={Boolean(
                            current?.id && String(current.id).length > 8
                          )}
                          className="w-full px-2 py-1 border rounded text-sm disabled:opacity-60"
                          placeholder="Catatan..."
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        {!Boolean(
                          current?.id && String(current.id).length > 8
                        ) && (
                          <button
                            onClick={() => removeRow(r.id)}
                            className="text-sm text-red-600 hover:text-red-800"
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Baris: {(current.rows || []).length}
              </div>
              <div className="text-sm">
                {(() => {
                  const sum = computeSummary(current);
                  return (
                    <div className="text-right">
                      <div>
                        Stok Sistem:{" "}
                        <span className="font-medium">
                          {sum.totalSystem.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        Stok Fisik:{" "}
                        <span className="font-medium">
                          {sum.totalPhysical.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        Selisih:{" "}
                        <span
                          className={`font-medium ${
                            sum.totalDiff > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {sum.totalDiff.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )} */}

      {/* Saved sessions list */}
      {savedSessions.length > 0 && (
        <div className="mt-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Cari Sesi
              </label>
              <input
                type="text"
                placeholder="Cari Nomor/Name Sesi..."
                value={opnameSearch}
                onChange={(e) => setOpnameSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Periode
              </label>
              <select
                value={opnamePeriod}
                onChange={(e) => setOpnamePeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="today">Hari Ini</option>
                <option value="yesterday">Kemarin</option>
                <option value="week">Minggu Ini</option>
                <option value="month">Bulan Ini</option>
                <option value="range">Rentang Waktu</option>
              </select>
            </div>
            {opnamePeriod === "range" && (
              <div className="flex gap-2 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Dari
                  </label>
                  <input
                    type="date"
                    value={opnameDateRange.start}
                    onChange={(e) =>
                      setOpnameDateRange((r) => ({
                        ...r,
                        start: e.target.value,
                      }))
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Sampai
                  </label>
                  <input
                    type="date"
                    value={opnameDateRange.end}
                    onChange={(e) =>
                      setOpnameDateRange((r) => ({ ...r, end: e.target.value }))
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            )}
            {showPrintFormModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-gray-900">
                        Print Form Stok Opname
                      </h2>
                      <button
                        onClick={() => {
                          setShowPrintFormModal(false);
                          setSelectedProductsForForm([]);
                          setSelectAllProductsForForm(false);
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <XCircle className="h-6 w-6" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Pilih produk yang akan dicantumkan di form. Kolom stok
                      akan dikosongkan untuk ditulis manual.
                    </p>
                  </div>

                  <div className="p-6 overflow-y-auto max-h-[60vh]">
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectAllProductsForForm}
                          onChange={(e) => {
                            setSelectAllProductsForForm(e.target.checked);
                            if (e.target.checked) {
                              setSelectedProductsForForm(
                                products.map((p: any) => p.id)
                              );
                            } else {
                              setSelectedProductsForForm([]);
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="font-medium text-gray-900">
                          Pilih Semua Produk ({products.length})
                        </span>
                      </label>
                    </div>

                    <div className="space-y-2">
                      {products
                        .slice()
                        .sort((a: any, b: any) =>
                          String(a.name).localeCompare(String(b.name))
                        )
                        .map((product: any) => (
                          <div
                            key={product.id}
                            className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedProductsForForm.includes(
                                product.id
                              )}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProductsForForm((prev) => [
                                    ...prev,
                                    product.id,
                                  ]);
                                } else {
                                  setSelectedProductsForForm((prev) =>
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
                                secondaryText: `${product.category || "-"} • ${product.unit || "pcs"}`,
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        {selectedProductsForForm.length} produk dipilih
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowPrintFormModal(false);
                            setSelectedProductsForForm([]);
                            setSelectAllProductsForForm(false);
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                        >
                          Batal
                        </button>
                        <button
                          onClick={() => {
                            const selected = products.filter((p: any) =>
                              selectedProductsForForm.includes(p.id)
                            );
                            const data: StockOpnameFormData = {
                              nomor: current?.nomor || "",
                              tanggal: new Date().toLocaleDateString("id-ID"),
                              // staf: (() => {
                              //   const isExisting = Boolean(
                              //     current?.id && String(current.id).length > 8
                              //   );
                              //   if (isExisting) {
                              //     const saved = savedSessions.find(
                              //       (s: any) => s.id === current?.id
                              //     );
                              //     return saved?.users?.full_name || "System";
                              //   }
                              //   return "System";
                              // })(),
                              staf: user?.full_name || "System",
                              items: selected.map((p: any) => ({
                                productName: p.name,
                              })),
                            };
                            printStockOpnameForm(data);
                          }}
                          disabled={selectedProductsForForm.length === 0}
                          className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                            selectedProductsForForm.length === 0
                              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                              : "bg-green-600 hover:bg-green-700 text-white"
                          }`}
                        >
                          <Printer className="h-4 w-4" />
                          Print ({selectedProductsForForm.length})
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto mt-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nomor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total Selisih
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Nominal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredSavedSessions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-6">
                      Tidak ada sesi stok opname ditemukan.
                    </td>
                  </tr>
                )}
                {filteredSavedSessions.map((s: any) => {
                  const dateStr = s.opname_date
                    ? new Date(s.opname_date).toLocaleDateString("id-ID")
                    : s.created_at
                    ? new Date(s.created_at).toLocaleDateString("id-ID")
                    : "-";
                  const isOpen = expandedSessions.has(s.id);
                  return (
                    <React.Fragment key={s.id}>
                      <tr>
                        <td className="px-4 py-3 font-mono text-xs text-gray-900">
                          <button
                            onClick={() => loadSession(s.id)}
                            className="text-blue-600 hover:underline"
                          >
                            {s.nomor || s.name || "-"}
                          </button>
                        </td>
                        <td className="px-4 py-3">{dateStr}</td>
                        <td className="px-4 py-3 text-right">
                          {Number(s.totals_diff || 0).toLocaleString("id-ID")}
                        </td>
                        <td className="px-4 py-3 font-semibold text-blue-700 text-right">
                          Rp{" "}
                          {Number(s.totals_nominal || 0).toLocaleString(
                            "id-ID"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {/* <button
                              onClick={() => loadSession(s.id)}
                              className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                            >
                              {isOpen ? "Tutup" : "Lihat"} Items
                            </button> */}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const sessionData = await (
                                    db as any
                                  ).stockOpname.getSessionWithItems(s.id);

                                  const stockOpnameData: StockOpnameData = {
                                    nomor:
                                      sessionData.nomor ||
                                      sessionData.name ||
                                      "",
                                    tanggal: sessionData.opname_date
                                      ? new Date(
                                          sessionData.opname_date
                                        ).toLocaleDateString("id-ID")
                                      : new Date(
                                          sessionData.created_at
                                        ).toLocaleDateString("id-ID"),
                                    staf:
                                      sessionData.users?.full_name || "System",
                                    items: (sessionData.rows || []).map(
                                      (row: any) => ({
                                        productName: row.productName || "",
                                        physicalStock: row.physicalStock || 0,
                                      })
                                    ),
                                  };
                                  printStockOpname(stockOpnameData);
                                } catch (error) {
                                  console.error(
                                    "Error loading session for print:",
                                    error
                                  );
                                  Swal.fire({
                                    icon: "error",
                                    title: "Gagal",
                                    text: "Gagal memuat data untuk print",
                                  });
                                }
                              }}
                              className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            <button
                              onClick={async () => {
                                const result = await Swal.fire({
                                  title: "Hapus Sesi?",
                                  text: `Sesi \"${
                                    s.name || s.nomor
                                  }\" akan dihapus permanen`,
                                  icon: "warning",
                                  showCancelButton: true,
                                  confirmButtonColor: "#d33",
                                  cancelButtonColor: "#6b7280",
                                  confirmButtonText: "Ya, hapus",
                                  cancelButtonText: "Batal",
                                });
                                if (!result.isConfirmed) return;
                                try {
                                  await (db as any).stockOpname.deleteSession(
                                    s.id
                                  );
                                  await Swal.fire({
                                    icon: "success",
                                    title: "Berhasil",
                                    text: "Sesi dihapus",
                                  });
                                  loadSavedSessions();
                                } catch (err: any) {
                                  await Swal.fire({
                                    icon: "error",
                                    title: "Gagal",
                                    text:
                                      err?.message || "Gagal menghapus sesi",
                                  });
                                }
                              }}
                              className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={5} className="bg-gray-50 p-0">
                            <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-gray-200 p-4">
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                        Produk
                                      </th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                        Sistem
                                      </th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                        Fisik
                                      </th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                        Selisih
                                      </th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                        Nominal (Rp)
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-100">
                                    {(sessionItemsMap[s.id] || []).map(
                                      (it: any) => (
                                        <tr key={it.id}>
                                          <td className="px-4 py-2">
                                            {renderProductIdentity({
                                              product: products.find(
                                                (p: any) =>
                                                  String(p.id) ===
                                                  String(it.productId)
                                              ),
                                              name: it.productName || "-",
                                              secondaryText: it.barcode
                                                ? `Barcode: ${it.barcode}`
                                                : undefined,
                                            })}
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            {Number(
                                              it.systemStock || 0
                                            ).toLocaleString("id-ID")}
                                            <span className="text-xs text-gray-500">
                                              {" "}
                                              {it.unit}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            {Number(
                                              it.physicalStock || 0
                                            ).toLocaleString("id-ID")}
                                            <span className="text-xs text-gray-500">
                                              {" "}
                                              {it.unit}
                                            </span>
                                          </td>
                                          <td
                                            className={`px-4 py-2 text-right font-medium ${
                                              Number(it.physicalStock || 0) -
                                                Number(it.systemStock || 0) >
                                              0
                                                ? "text-green-600"
                                                : "text-red-600"
                                            }`}
                                          >
                                            {(
                                              Number(it.physicalStock || 0) -
                                              Number(it.systemStock || 0)
                                            ).toLocaleString("id-ID")}
                                            <span className="text-xs text-gray-500">
                                              {" "}
                                              {it.unit}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 font-semibold text-blue-700 text-right">
                                            {(
                                              (Number(it.physicalStock || 0) -
                                                Number(it.systemStock || 0)) *
                                              Number(it.unitCost || 0)
                                            ).toLocaleString("id-ID")}
                                          </td>
                                        </tr>
                                      )
                                    )}
                                  </tbody>
                                </table>
                              </div>
                              {(sessionItemsMap[s.id]?.length || 0) === 0 && (
                                <div className="text-sm text-gray-500">
                                  Tidak ada item.
                                </div>
                              )}
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
      )}
      {showCreateModal && <CreateModal />}
      <ProductSelectModal />
      {/* LoadSessionModal removed */}
    </div>
  );
};

export default StokOpname;
