import React, { useState, useEffect } from "react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Plus,
  Search,
  Ticket,
  Clock,
  DollarSign,
  User,
  Eye,
  Edit,
  ShoppingCart,
  Package,
  TrendingUp,
  CheckCircle,
  XCircle,
  ChevronDown,
  Printer,
  QrCode,
  AlertCircle,
  Trash2,
} from "lucide-react";

import { db, supabase } from "../lib/supabase";
import paketService from '../lib/paketService';
import PurchaseFilters from "./PurchaseFilters";
import Swal from "sweetalert2";

type CashierDetailItem = {
  name?: string;
  type?: string;
  total?: number;
  profit?: number;
  capital?: number;
  description?: string;
};

type CashierDetails = {
  items?: CashierDetailItem[];
  voucher?: {
    voucher_id?: string;
    voucher_code?: string;
    total_points?: number;
    voucher_price?: number;
  };
  payment?: { amount?: number; method?: string };
  customer?: { name?: string; phone?: string };
  breakdown?: { voucher_price?: number };
};

const parseDetails = (raw: unknown): CashierDetails => {
  try {
    if (!raw) return {};
    return typeof raw === "string"
      ? (JSON.parse(raw) as CashierDetails)
      : (raw as CashierDetails) ?? {};
  } catch {
    return {};
  }
};

const extractVoucherCode = (details: any, firstItem: any): string => {
  const directCode =
    details?.voucher_code ??
    details?.voucherCode ??
    details?.voucher?.voucher_code ??
    details?.voucher?.voucherCode;

  if (directCode) return String(directCode);

  const itemCode =
    firstItem?.voucher_code ??
    firstItem?.voucherCode ??
    firstItem?.code;

  if (itemCode) return String(itemCode);

  const title = String(firstItem?.title ?? "");
  const titleMatch = title.match(/voucher\s+([A-Za-z0-9-]+)/i);
  if (titleMatch?.[1]) return titleMatch[1];

  const desc = String(firstItem?.description ?? "");
  if (desc.includes(":")) {
    const fromDesc = desc.split(":")[1]?.trim();
    if (fromDesc) return fromDesc;
  }

  return "-";
};

const extractCardUid = (details: any, firstItem: any): string => {
  const uid =
    details?.card_uid ??
    details?.cardUid ??
    firstItem?.card_uid ??
    firstItem?.cardUid ??
    firstItem?.uid;

  if (uid) return String(uid).trim();
  return "-";
};

const VoucherManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "master-paket" | "vouchers" | "purchase-history"
  >("master-paket");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showCreateVoucherForm, setShowCreateVoucherForm] = useState(false);
  const [showSellVoucherForm, setShowSellVoucherForm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState<string | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<string | null>(null);
  const [showEditVoucherForm, setShowEditVoucherForm] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<any>(null);

  const [voucherPurchases, setVoucherPurchases] = useState<any[]>([]);
  const [rfidAliasByUid, setRfidAliasByUid] = useState<Record<string, string>>({});
  const [purchaseHistorySearch, setPurchaseHistorySearch] = useState("");
  const [purchaseHistoryPeriod, setPurchaseHistoryPeriod] = useState<string>("week");
  const [purchaseHistoryDateRange, setPurchaseHistoryDateRange] = useState({ start: "", end: "" });
  const [expandedPurchaseHistoryDate, setExpandedPurchaseHistoryDate] = useState<string | null>(null);
  const [newVoucher, setNewVoucher] = useState({
    name: "",
    description: "",
    totalPoints: 5000,
    capital: 10000,
    voucherPrice: 50000,
  });

  // Modal-scoped Hari & Jam state used inside the Create Paket modal
  const [showAddHariJamModal, setShowAddHariJamModal] = useState(false);
  const [hariJamDraft, setHariJamDraft] = useState<{ day: string; startTime: string; endTime: string }>({ day: "Rabu", startTime: "09:00", endTime: "18:00" });
  // when editing an existing entry, hold its id here
  const [editHariJamId, setEditHariJamId] = useState<string | null>(null);
  // modal to select consoles for paket draft
  const [showSelectConsoleModal, setShowSelectConsoleModal] = useState(false);
  // staged selection inside the console modal; applied on 'Selesai'
  const [selectConsoleDraft, setSelectConsoleDraft] = useState<string[]>([]);
  const [selectConsoleModalTab, setSelectConsoleModalTab] = useState<"list" | "dipilih">("list");
  const [selectConsoleSearch, setSelectConsoleSearch] = useState("");

  // close select-console modal on Escape and discard staged changes
  useEffect(() => {
    if (!showSelectConsoleModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSelectConsoleModal(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSelectConsoleModal]);
  const hariOptions = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

  const [sellVoucher, setSellVoucher] = useState({
    voucherId: "",
    customerId: "",
    customerName: "",
    customerPhone: "",
    notes: "",
  });

  const [vouchers, setVouchers] = useState<any[]>([]);
  const [voucherUsages, setVoucherUsages] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  type Paket = {
    id: string;
    name: string;
    code?: string;
    status: string;
    description?: string;
    durationHours: number;
    durationMinutes: number;
    pricePerHour: number;
    discountAmount?: number; // fixed amount in IDR to subtract per hour
  };

  type DaySpec = {
    key: string;
    label: string;
    enabled: boolean;
    startTime: string; // HH:MM
    endTime: string; // HH:MM
  };

  const defaultDays: DaySpec[] = [
    { key: "mon", label: "Senin", enabled: false, startTime: "09:00", endTime: "21:00" },
    { key: "tue", label: "Selasa", enabled: false, startTime: "09:00", endTime: "21:00" },
    { key: "wed", label: "Rabu", enabled: false, startTime: "09:00", endTime: "21:00" },
    { key: "thu", label: "Kamis", enabled: false, startTime: "09:00", endTime: "21:00" },
    { key: "fri", label: "Jumat", enabled: false, startTime: "09:00", endTime: "21:00" },
    { key: "sat", label: "Sabtu", enabled: false, startTime: "09:00", endTime: "23:59" },
    { key: "sun", label: "Minggu", enabled: false, startTime: "09:00", endTime: "21:00" },
  ];

  const [pakets, setPakets] = useState<Paket[]>([
    {
      id: "pkg-1",
      name: "Paket 2 Jam",
      status: "active",
      description: "Paket standar 2 jam",
      durationHours: 2,
      durationMinutes: 0,
      pricePerHour: 30000,
      discountAmount: 0,
    },
  ]);
  // consoles loaded from DB
  const [consoles, setConsoles] = useState<{ id: string; name: string }[]>([]);
  const [showCreatePaketForm, setShowCreatePaketForm] = useState(false);
  const [createActiveTab, setCreateActiveTab] = useState<"info" | "hari" | "durasi" | "console">("info");
  const [newPaketDraft, setNewPaketDraft] = useState<Partial<Paket> & {
    discountAmount?: number;
    days?: DaySpec[];
    selectedConsoles?: string[];
    hariJamList?: { id: string; day: string; startTime: string; endTime: string }[];
    packagePrice?: number;
    hargaNormal?: number;
  }>({
    name: "",
    code: undefined,
    durationHours: 1,
    durationMinutes: 0,
    pricePerHour: 50000,
    status: "active",
    discountAmount: 0,
    days: defaultDays,
    hariJamList: [],
    packagePrice: undefined,
    hargaNormal: 50000,
  });
  const [editingPaketId, setEditingPaketId] = useState<string | null>(null);
  // viewPaketId not needed; we store full data in viewPaketData
  const [viewPaketData, setViewPaketData] = useState<any | null>(null);
  const [expandedHariFor, setExpandedHariFor] = useState<string | null>(null);
  const [expandedConsolesFor, setExpandedConsolesFor] = useState<string | null>(null);
  // local sub-tab state inside Master Paket
  const [masterPaketSubTab, setMasterPaketSubTab] = useState<'management' | 'history'>('management');

  const handleCreatePaketDraft = async () => {
    if (!newPaketDraft.name) return alert("Nama paket wajib diisi");
    const fullPayload: any = {
      name: String(newPaketDraft.name),
      code: String((newPaketDraft as any).code || ''),
      status: String(newPaketDraft.status || "active"),
      description: String(newPaketDraft.description || ""),
      durationHours: Number(newPaketDraft.durationHours || 0),
      durationMinutes: Number(newPaketDraft.durationMinutes || 0),
      hargaNormal: Number((newPaketDraft as any).hargaNormal || 0),
      packagePrice: (newPaketDraft as any).packagePrice === undefined ? undefined : Number((newPaketDraft as any).packagePrice),
      discountAmount: Number(newPaketDraft.discountAmount || 0),
      days: newPaketDraft.days || defaultDays,
      consoles: newPaketDraft.selectedConsoles || [],
      hariJamList: newPaketDraft.hariJamList || [],
    };

    try {
      if (editingPaketId) {
        await paketService.updatePackage(editingPaketId, {
          name: fullPayload.name,
          code: fullPayload.code,
          description: fullPayload.description,
          status: fullPayload.status,
          durationHours: fullPayload.durationHours,
          durationMinutes: fullPayload.durationMinutes,
          hargaNormal: fullPayload.hargaNormal,
          packagePrice: fullPayload.packagePrice,
          discountAmount: fullPayload.discountAmount,
          selectedConsoles: fullPayload.consoles,
          hariJamList: fullPayload.hariJamList,
        });

    // close modal first, give React a tick to settle, then refresh and show toast
    setShowCreatePaketForm(false);
    await sleep(40);
  await reloadPakets();
  await refreshOpenDetail(editingPaketId);

        await Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Paket berhasil diperbarui',
          showConfirmButton: false,
          timer: 2000,
        });
      } else {
        const created = await paketService.createPackage({
          name: fullPayload.name,
          code: fullPayload.code,
          description: fullPayload.description,
          status: fullPayload.status,
          durationHours: fullPayload.durationHours,
          durationMinutes: fullPayload.durationMinutes,
          hargaNormal: fullPayload.hargaNormal,
          packagePrice: fullPayload.packagePrice,
          discountAmount: fullPayload.discountAmount,
          selectedConsoles: fullPayload.consoles,
          hariJamList: fullPayload.hariJamList,
        });

    // close modal first, give React a tick to settle, then refresh and show toast
    setShowCreatePaketForm(false);
    await sleep(40);
        await reloadPakets();
        const createdId = (created && (created.id || created.package_id || created.packageId)) ? (created.id ?? created.package_id ?? created.packageId) : undefined;
        await refreshOpenDetail(createdId);

        await Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Paket berhasil dibuat',
          showConfirmButton: false,
          timer: 2000,
        });
      }

      // reset draft & editing state after success
      setNewPaketDraft({ name: "", code: undefined, durationHours: 0, durationMinutes: 0, pricePerHour: 0, status: "active", discountAmount: 0, days: defaultDays, selectedConsoles: [], hariJamList: [], packagePrice: undefined, hargaNormal: 0 });
      setEditingPaketId(null);
    } catch (err: any) {
      // keep modal open so user can correct input; show error toast
      await Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: err?.message || 'Gagal menyimpan paket',
        showConfirmButton: false,
        timer: 2500,
      });
    }
  };

  // fetch consoles from DB once (and provide paket refresh)
  useEffect(() => {
    const load = async () => {
      try {
        const rows = await paketService.loadConsoles();
        setConsoles(rows || []);
      } catch {
        setConsoles([]);
      }
    };
    load();

    // expose paket refresh and load initial pakets
    (window as any).refreshPakets = async () => {
      try {
        const rows = await paketService.loadPakets();
        const mapped = (rows || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          code: r.code,
          status: r.status || 'active',
          description: r.description,
          durationHours: r.durationHours || 0,
          durationMinutes: r.durationMinutes || 0,
          pricePerHour: r.hargaNormal ?? r.packagePrice ?? 0,
          hargaNormal: r.hargaNormal ?? 0,
          packagePrice: r.packagePrice ?? 0,
          discountAmount: r.discountAmount ?? 0,
        }));
        setPakets(mapped as Paket[]);
      } catch {
        setPakets([]);
      }
    };
    (window as any).refreshPakets();
  }, []);

  // helper to reload pakets and set local state immediately
  const reloadPakets = async () => {
    try {
      const rows = await paketService.loadPakets();
      const mapped = (rows || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        status: r.status || 'active',
        description: r.description,
        durationHours: r.durationHours || 0,
        durationMinutes: r.durationMinutes || 0,
        pricePerHour: r.hargaNormal ?? r.packagePrice ?? 0,
        hargaNormal: r.hargaNormal ?? 0,
        packagePrice: r.packagePrice ?? 0,
        discountAmount: r.discountAmount ?? 0,
      }));
      setPakets(mapped as Paket[]);
    } catch {
      setPakets([]);
    }
  };

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // refresh the currently open paket detail (if any). If deletedId is provided and
  // matches the open detail, clear the detail panel.
  const refreshOpenDetail = async (deletedId?: string) => {
    try {
      if (deletedId && viewPaketData && viewPaketData.id === deletedId) {
        setViewPaketData(null);
        return;
      }
      if (viewPaketData && viewPaketData.id) {
        const fresh = await paketService.getPackageById(viewPaketData.id);
        setViewPaketData(fresh);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const v = await db.select("vouchers", "*");
        const mapped = (v || []).map((it: any) => ({
          id: it.id,
          voucherCode: it.voucher_code ?? it.voucherCode,
          name: it.name,
          description: it.description,
          totalPoints: it.total_points ?? 0,
          capital: it.capital ?? 0,
          // hourlyRate: it.hourly_rate ?? 0,
          voucherPrice: it.voucher_price ?? 0,
          status: it.status,
          customerId: it.customer_id ?? it.customerId,
          customerName: it.customer_name ?? it.customerName,
          customerPhone: it.customer_phone ?? it.customerPhone,
          createdAt: it.created_at ?? null,
          updatedAt: it.updated_at ?? null,
        }));
        setVouchers(mapped);

        // voucher_usages tidak digunakan pada skema baru
        setVoucherUsages([]);

        const { data: rfidRows } = await supabase
          .from("rfid_cards")
          .select("uid, alias");
        const aliasMap = (rfidRows || []).reduce((acc: Record<string, string>, row: any) => {
          const key = String(row?.uid || "").trim().toLowerCase();
          if (key) acc[key] = row?.alias || "-";
          return acc;
        }, {});
        setRfidAliasByUid(aliasMap);

        const cs = await db.customers.getAll();
        setCustomers(cs || []);
      } catch {
        setVouchers([]);
        setVoucherUsages([]);
        setRfidAliasByUid({});
        setCustomers([]);
      }
    };
    fetchAll();
    // expose refresh
    (window as any).refreshVouchers = fetchAll;
    const fetchPurchases = async () => {
      try {
        const trx = await db.select("cashier_transactions", "*", {
          type: "voucher",
        });
        setVoucherPurchases(trx || []);
      } catch {
        setVoucherPurchases([]);
      }
    };
    fetchPurchases();
    (window as any).refreshVoucherPurchases = fetchPurchases;
  }, []);

  // Filter vouchers
  const filteredVouchers = vouchers.filter((voucher) => {
    const matchesSearch =
      voucher.voucherCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voucher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voucher.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voucher.customerPhone?.includes(searchTerm);
    const matchesStatus =
      selectedStatus === "all" || voucher.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredVoucherPurchases = voucherPurchases.filter((trx) => {
    let start: Date | null = null;
    let end: Date | null = null;
    const now = new Date();

    switch (purchaseHistoryPeriod) {
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
        if (purchaseHistoryDateRange.start) {
          start = new Date(purchaseHistoryDateRange.start);
          start.setHours(0, 0, 0, 0);
        }
        if (purchaseHistoryDateRange.end) {
          end = new Date(purchaseHistoryDateRange.end);
          end.setHours(23, 59, 59, 999);
        }
        break;
      }
    }

    const trxDate = trx.timestamp ? new Date(trx.timestamp) : null;
    let dateMatch = true;
    if (trxDate) {
      if (start && trxDate < start) dateMatch = false;
      if (end && trxDate > end) dateMatch = false;
    }

    let searchMatch = true;
    if (purchaseHistorySearch) {
      const search = purchaseHistorySearch.toLowerCase();
      const details = parseDetails(trx.details);
      const firstItem = details.items?.[0] ?? {};
      const voucherCode = extractVoucherCode(details, firstItem);
      const cardUid = extractCardUid(details, firstItem);
      const cardAlias = cardUid !== "-" ? rfidAliasByUid[cardUid.toLowerCase()] ?? "" : "";
      const customerName = details.customer?.name ?? "";
      const customerPhone = details.customer?.phone ?? "";
      const voucherName = firstItem.name ?? "";
      const paymentMethod = trx.payment_method ?? details.payment?.method ?? "";

      searchMatch = [voucherCode, cardUid, cardAlias, customerName, customerPhone, voucherName, paymentMethod]
        .some((value) => String(value).toLowerCase().includes(search));
    }

    return dateMatch && searchMatch;
  });

  const purchaseHistorySummary = {
    voucherCount: filteredVoucherPurchases.length,
    totalSales: filteredVoucherPurchases.reduce(
      (sum, trx) => sum + Number(trx.amount ?? 0),
      0,
    ),
  };

  const purchaseHistoryGroupedByDate = filteredVoucherPurchases.reduce(
    (groups, trx) => {
      const dateKey = trx.timestamp ? trx.timestamp.slice(0, 10) : "unknown";
      if (!groups[dateKey]) {
        groups[dateKey] = {
          subtotal: 0,
          transactions: [],
        };
      }

      groups[dateKey].subtotal += Number(trx.amount ?? 0);
      groups[dateKey].transactions.push(trx);
      return groups;
    },
    {} as Record<string, { subtotal: number; transactions: any[] }>,
  );

  const purchaseHistoryDateEntries = Object.entries(purchaseHistoryGroupedByDate).sort(
    ([dateA], [dateB]) => {
      if (dateA === "unknown") return 1;
      if (dateB === "unknown") return -1;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    },
  );

  // Filter for active vouchers
  const activeVouchers = filteredVouchers.filter((v) => v.status === "active");

  // Filter for expired/used vouchers
  // const expiredVouchers = filteredVouchers.filter(
  //   (v) => v.status === "expired" || v.status === "used-up"
  // );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      // case "expired":
      //   return "bg-red-100 text-red-800";
      case "used-up":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4" />;
      // case "expired":
      //   return <XCircle className="h-4 w-4" />;
      case "used-up":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // const calculateVoucherPrice = () => {
  //   if (!newVoucher.originalPrice || !newVoucher.discountPercentage)
  //     return { discounted: 0, savings: 0 };

  //   const discountAmount =
  //     (newVoucher.originalPrice * newVoucher.discountPercentage) / 100;
  //   const discountedPrice = newVoucher.originalPrice - discountAmount;

  //   return {
  //     discounted: discountedPrice,
  //     savings: discountAmount,
  //   };
  // };

  // const generateVoucherCode = () => {
  //   const lastVoucher = vouchers[vouchers.length - 1];
  //   const lastNumber = parseInt(lastVoucher.voucherCode.replace("VCH", ""));
  //   return `VCH${(lastNumber + 1).toString().padStart(3, "0")}`;
  // };

  // const handleCreateVoucher = () => {
  //   if (
  //     !newVoucher.name ||
  //     !newVoucher.totalHours ||
  //     !newVoucher.originalPrice
  //   ) {
  //     alert("Nama, total jam, dan harga original wajib diisi");
  //     return;
  //   }

  //   const voucherCode = generateVoucherCode();
  //   alert(`Voucher ${voucherCode} berhasil dibuat!`);
  //   setShowCreateVoucherForm(false);
  //   setNewVoucher({
  //     name: "",
  //     description: "",
  //     totalHours: 5,
  //     originalPrice: 50000,
  //     discountPercentage: 10,
  //     validityDays: 30,
  //   });
  // };

  const handleCreateVoucher = async () => {
    if (
      !newVoucher.name ||
      !newVoucher.totalPoints ||
      !newVoucher.voucherPrice
    ) {
      alert("Nama, total points, dan harga original wajib diisi");
      return;
    }

    try {
      // const totalMinutes = Math.max(
      //   Math.floor(Number(newVoucher.totalHours) * 60),
      //   1
      // );
      // const hourlyRate = Number(Number(newVoucher.hourlyRate).toFixed(2));
      // const voucherPrice = Number(
      //   (hourlyRate * Number(newVoucher.totalHours)).toFixed(2)
      // );

      const created = await db.vouchers.create({
        name: newVoucher.name,
        description: newVoucher.description,
        total_points: newVoucher.totalPoints,
        capital: Number(Number(newVoucher.capital)),
        // hourly_rate: hourlyRate,
        voucher_price: newVoucher.voucherPrice,
        status: "active",
      });
      alert(
        `Voucher ${
          created.voucher_code || created.voucherCode || ""
        } berhasil dibuat!`
      );
      (window as any).refreshVouchers?.();
    } catch (e: any) {
      alert(e?.message || "Gagal membuat voucher");
    }

    setShowCreateVoucherForm(false);
    setNewVoucher({
      name: "",
      description: "",
      totalPoints: 5000,
      voucherPrice: 50000,
      // validityDays: 30,
      capital: 10000,
    });
  };

  // const handleSellVoucher = () => {
  //   if (
  //     !sellVoucher.voucherId ||
  //     (!sellVoucher.customerId && !sellVoucher.customerName)
  //   ) {
  //     alert("Voucher dan customer wajib dipilih");
  //     return;
  //   }

  //   const voucher = mockVouchers.find((v) => v.id === sellVoucher.voucherId);
  //   alert(`Voucher ${voucher?.voucherCode} berhasil dijual!`);
  //   setShowSellVoucherForm(false);
  //   setSellVoucher({
  //     voucherId: "",
  //     customerId: "",
  //     customerName: "",
  //     customerPhone: "",
  //     notes: "",
  //   });
  // };

  const handleSellVoucher = async () => {
    if (
      !sellVoucher.voucherId ||
      (!sellVoucher.customerId && !sellVoucher.customerName)
    ) {
      alert("Voucher dan customer wajib dipilih");
      return;
    }

    try {
      const payload: any = {
        sold_date: new Date().toISOString(),
      };
      if (sellVoucher.customerId) {
        payload.customer_id = sellVoucher.customerId;
      } else {
        payload.customer_name = sellVoucher.customerName;
        payload.customer_phone = sellVoucher.customerPhone;
      }
      await db.update("vouchers", sellVoucher.voucherId, payload);
      alert("Voucher berhasil dijual!");
      (window as any).refreshVouchers?.();
    } catch (e: any) {
      alert(e?.message || "Gagal menjual voucher");
    }

    setShowSellVoucherForm(false);
    setSellVoucher({
      voucherId: "",
      customerId: "",
      customerName: "",
      customerPhone: "",
      notes: "",
    });
  };

  // const handleUseVoucher = (voucherId: string, hoursToUse: number) => {
  //   const voucher = mockVouchers.find((v) => v.id === voucherId);
  //   if (!voucher) return;

  //   if (hoursToUse > voucher.remainingHours) {
  //     alert("Jam yang digunakan melebihi sisa jam voucher");
  //     return;
  //   }

  //   alert(
  //     `Voucher ${
  //       voucher.voucherCode
  //     } berhasil digunakan untuk ${hoursToUse} jam. Sisa: ${
  //       voucher.remainingHours - hoursToUse
  //     } jam`
  //   );
  // };

  // const handleUseVoucher = async (voucherId: string, hoursToUse: number) => {
  //   // kept for future - disabled because it's unused here
  // };

  const renderPrintableVoucher = (voucher: any) => (
    <div className="w-[5.5cm] h-[9cm] bg-white border-2 border-dashed border-gray-400 p-3 text-xs font-mono relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="grid grid-cols-8 gap-1 h-full">
          {Array.from({ length: 64 }).map((_, i) => (
            <div key={i} className="bg-blue-500 rounded-full"></div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="text-center border-b border-gray-300 pb-2 mb-2">
          <div className="text-lg font-bold">GAMING VOUCHER</div>
          <div className="text-xs">PlayStation & Billiard Center</div>
        </div>

        {/* Voucher Code */}
        <div className="text-center mb-3">
          <div className="text-2xl font-bold tracking-wider">
            {voucher.voucherCode}
          </div>
          <div className="text-xs text-gray-600">Kode Voucher</div>
        </div>

        {/* QR Code Placeholder */}
        <div className="flex justify-center mb-3">
          <div className="w-16 h-16 border-2 border-gray-400 flex items-center justify-center">
            <QrCode className="h-12 w-12 text-gray-400" />
          </div>
        </div>

        {/* Voucher Details */}
        <div className="space-y-1 mb-3">
          <div className="flex justify-between">
            <span>Nama:</span>
            <span className="font-bold">{voucher.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Points:</span>
            <span className="font-bold">{voucher.totalPoints} Points</span>
          </div>
          <div className="flex justify-between">
            <span>Harga:</span>
            <span className="font-bold">
              Rp {voucher.voucherPrice.toLocaleString("id-ID")}
            </span>
          </div>
          {/* <div className="flex justify-between">
            <span>Hemat:</span>
            <span className="font-bold text-green-600">
              Rp {voucher.discountAmount.toLocaleString("id-ID")}
            </span>
          </div> */}
          <div className="flex justify-between">
            <span>Berlaku:</span>
            <span className="font-bold">{voucher.validityDays} Hari</span>
          </div>
        </div>

        {/* Customer Info */}
        {voucher.customerName && (
          <div className="border-t border-gray-300 pt-2 mb-3">
            <div className="text-xs text-gray-600 mb-1">Customer:</div>
            <div className="font-bold">{voucher.customerName}</div>
            {voucher.customerPhone && (
              <div className="text-xs">{voucher.customerPhone}</div>
            )}
          </div>
        )}

        {/* Dates */}
        <div className="border-t border-gray-300 pt-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span>Dibuat:</span>
            <span>
              {new Date(voucher.createdDate).toLocaleDateString("id-ID")}
            </span>
          </div>
          {/* <div className="flex justify-between text-xs">
            <span>Expired:</span>
            <span>
              {new Date(voucher.expiryDate).toLocaleDateString("id-ID")}
            </span>
          </div> */}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-3 border-t border-gray-300 pt-2">
          <div>Voucher ini dapat digunakan berulang</div>
          <div>sampai jam habis atau expired</div>
          <div className="mt-1 font-bold">Terima Kasih!</div>
        </div>
      </div>
    </div>
  );

  // Create Paket Modal (tabbed)
  const renderCreatePaketModal = () => {

    

    

    // helpers for 24-hour selects inside the 'Tambah Hari & Jam' modal
    const pad = (n: number | string) => String(n).padStart(2, "0");
    const normalizeTime = (raw?: string) => {
      if (!raw) return "00:00";
      const trimmed = String(raw).trim();
      const cleaned = trimmed.replace(/[.,]/g, ':').replace(/\s+/g, '');
      const m = cleaned.match(/^(\d{1,2}):?(\d{0,2})$/);
      if (!m) return "00:00";
      let hh = Number(m[1]) || 0;
      let mm = Number(m[2] || '0') || 0;
      if (hh < 0) hh = 0;
      if (hh > 23) hh = 23;
      if (mm < 0) mm = 0;
      if (mm > 59) mm = 59;
      return `${pad(hh)}:${pad(mm)}`;
    };

    if (!showCreatePaketForm) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Buat Paket</h2>
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-500">Form: </div>
                <button onClick={() => setShowCreatePaketForm(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="h-6 w-6" /></button>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-4">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: "info", label: "Informasi" },
                    { id: "hari", label: "Hari & Jam" },
                    { id: "durasi", label: "Durasi & Harga" },
                    { id: "console", label: `Console${(newPaketDraft.selectedConsoles || []).length > 0 ? ` (${(newPaketDraft.selectedConsoles || []).length})` : ''}` },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setCreateActiveTab(t.id as any)}
                      className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${createActiveTab === t.id ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            <div>
              {createActiveTab === "info" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kode Paket</label>
                    <input type="text" value={(newPaketDraft as any).code || ''} onChange={(e) => setNewPaketDraft({ ...newPaketDraft, code: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Paket *</label>
                    <input type="text" value={newPaketDraft.name} onChange={(e) => setNewPaketDraft({ ...newPaketDraft, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={newPaketDraft.status} onChange={(e) => setNewPaketDraft({ ...newPaketDraft, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi (opsional)</label>
                    <textarea value={newPaketDraft.description} onChange={(e) => setNewPaketDraft({ ...newPaketDraft, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} />
                  </div>
                </div>
              )}
              {createActiveTab === "hari" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Atur Hari & Jam berlaku untuk paket ini.</p>
                    <button onClick={() => { setEditHariJamId(null); setHariJamDraft({ day: 'Rabu', startTime: '09:00', endTime: '18:00' }); setShowAddHariJamModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm">+ Hari & Jam</button>
                  </div>

                  {/* List of hari-jam saved in the paket draft */}
                  {(newPaketDraft.hariJamList || []).length === 0 ? (
                    <div className="text-gray-500">Belum ada data Hari & Jam. Klik "+ Hari & Jam" untuk menambah.</div>
                  ) : (
                    <div className="overflow-x-auto bg-white rounded-lg p-3 border border-gray-100">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hari</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jam Berlaku</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {(newPaketDraft.hariJamList || []).map((h) => (
                              <tr key={h.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{h.day}</td>
                                <td className="px-4 py-3 text-sm text-gray-700">{h.startTime} sd {h.endTime}</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => {
                                      // open modal in edit mode
                                      setEditHariJamId(h.id);
                                      setHariJamDraft({ day: h.day, startTime: h.startTime, endTime: h.endTime });
                                      setShowAddHariJamModal(true);
                                    }} className="text-sm px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">Edit</button>
                                    <button onClick={() => {
                                      if (!confirm('Hapus entry Hari & Jam ini?')) return;
                                      const next = (newPaketDraft.hariJamList || []).filter((it) => it.id !== h.id);
                                      setNewPaketDraft({ ...newPaketDraft, hariJamList: next });
                                    }} className="text-sm px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50">Hapus</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Modal for adding Hari & Jam to paket draft (modal-scoped state declared below) */}
                  {showAddHariJamModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Tambah Hari & Jam</h3>
                            <button onClick={() => setShowAddHariJamModal(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="h-6 w-6" /></button>
                          </div>

                            <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Hari</label>
                              <div className="grid grid-cols-2 gap-2">
                                {hariOptions.map((d) => (
                                  <label key={d} className={`flex items-center gap-2 p-2 border rounded ${hariJamDraft.day === d ? 'border-blue-500 bg-blue-50' : 'border-gray-100'}`}>
                                    <input
                                      type="radio"
                                      name="hari"
                                      value={d}
                                      checked={hariJamDraft.day === d}
                                      onChange={() => setHariJamDraft({ ...hariJamDraft, day: d })}
                                      className="h-4 w-4 text-blue-600"
                                    />
                                    <span className="text-sm">{d}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Jam berlaku</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="HH:MM"
                                  aria-label="Jam Mulai (HH:MM)"
                                  value={hariJamDraft.startTime}
                                  onChange={(e) => setHariJamDraft({ ...hariJamDraft, startTime: e.target.value })}
                                  onBlur={(e) => setHariJamDraft({ ...hariJamDraft, startTime: normalizeTime(e.target.value) })}
                                  className="px-3 py-2 border border-gray-300 rounded-lg w-28"
                                />
                                <span className="text-sm text-gray-500">sd</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="HH:MM"
                                  aria-label="Jam Selesai (HH:MM)"
                                  value={hariJamDraft.endTime}
                                  onChange={(e) => setHariJamDraft({ ...hariJamDraft, endTime: e.target.value })}
                                  onBlur={(e) => setHariJamDraft({ ...hariJamDraft, endTime: normalizeTime(e.target.value) })}
                                  className="px-3 py-2 border border-gray-300 rounded-lg w-28"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-3 mt-6">
                            <button onClick={() => { setShowAddHariJamModal(false); setEditHariJamId(null); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg">Batal</button>
                            <button onClick={() => {
                              // validate and save into paket draft (add or update)
                              if (!hariJamDraft.day) return alert('Pilih hari terlebih dahulu');
                              if (!hariJamDraft.startTime || !hariJamDraft.endTime) return alert('Isi jam mulai dan selesai');
                              // basic validation: end must be after start
                              const start = hariJamDraft.startTime;
                              const end = hariJamDraft.endTime;
                              if (end <= start) return alert('Jam selesai harus lebih besar dari jam mulai');

                              if (editHariJamId) {
                                // update existing
                                const next = (newPaketDraft.hariJamList || []).map((it) => it.id === editHariJamId ? { ...it, day: hariJamDraft.day, startTime: hariJamDraft.startTime, endTime: hariJamDraft.endTime } : it);
                                setNewPaketDraft({ ...newPaketDraft, hariJamList: next });
                              } else {
                                const entry = { id: `hj-${Date.now()}`, day: hariJamDraft.day, startTime: hariJamDraft.startTime, endTime: hariJamDraft.endTime };
                                setNewPaketDraft({ ...newPaketDraft, hariJamList: [entry, ...(newPaketDraft.hariJamList || [])] });
                              }

                              setShowAddHariJamModal(false);
                              setHariJamDraft({ day: 'Rabu', startTime: '09:00', endTime: '18:00' });
                              setEditHariJamId(null);
                            }} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">{editHariJamId ? 'Simpan' : 'Tambahkan'}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {createActiveTab === "durasi" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Durasi</label>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <input type="number" min={0} value={newPaketDraft.durationHours} onChange={(e) => setNewPaketDraft({ ...newPaketDraft, durationHours: Number(e.target.value) })} className="w-20 px-3 py-2 border border-gray-300 rounded-lg" />
                        <span className="text-sm">jam</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" min={0} max={59} value={newPaketDraft.durationMinutes} onChange={(e) => setNewPaketDraft({ ...newPaketDraft, durationMinutes: Number(e.target.value) })} className="w-20 px-3 py-2 border border-gray-300 rounded-lg" />
                        <span className="text-sm">menit</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Harga Normal</label>
                    <input type="number" min={0} value={(newPaketDraft as any).hargaNormal ?? newPaketDraft.pricePerHour} onChange={(e) => setNewPaketDraft({ ...newPaketDraft, hargaNormal: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Harga Paket</label>
                    <input type="number" min={0} value={(newPaketDraft as any).packagePrice || ''} onChange={(e) => setNewPaketDraft({ ...newPaketDraft, packagePrice: e.target.value === '' ? undefined : Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hemat</label>
                    <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">Rp {(() => {
                      // hargaNormal is stored as TOTAL price for the duration (not per-hour)
                      const hargaNormalTotal = Number((newPaketDraft as any).hargaNormal || 0);
                      const packagePrice = Number((newPaketDraft as any).packagePrice || 0);
                      const savings = Math.max(0, Math.round(hargaNormalTotal) - Math.round(packagePrice));
                      return savings.toLocaleString('id-ID');
                    })()}</div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Info</label>
                    <div className="text-sm text-gray-600 space-y-1">
                      {(() => {
                        const hours = Number(newPaketDraft.durationHours || 0);
                        const minutes = Number(newPaketDraft.durationMinutes || 0);
                        const totalMinutes = (hours * 60 + minutes) || 1;
                        const hargaNormalTotal = Number(((newPaketDraft as any).hargaNormal ?? 0) || 0);
                        const hargaPaket = Number((newPaketDraft as any).packagePrice || 0);
                        const perHourNormal = Math.round((hargaNormalTotal / totalMinutes) * 60);
                        const perHourPaket = Math.round((hargaPaket / totalMinutes) * 60);
                        return (
                          <>
                            <div>Harga Normal per jam: Rp {perHourNormal.toLocaleString('id-ID')}</div>
                            <div>Harga Paket per jam: Rp {perHourPaket.toLocaleString('id-ID')}</div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {createActiveTab === "console" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Pilih console yang berlaku untuk paket ini.</p>
                    <button onClick={() => {
                      // initialize staged draft from current draft selections
                      setSelectConsoleDraft([...(newPaketDraft.selectedConsoles || [])]);
                      setSelectConsoleModalTab("list");
                      setShowSelectConsoleModal(true);
                    }} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm">+ Console</button>
                  </div>

                  {/* Selected consoles preview/list in draft */}
                  {(newPaketDraft.selectedConsoles || []).length === 0 ? (
                    <div className="text-gray-500">Belum ada console dipilih. Klik "+ Console" untuk menambah.</div>
                  ) : (
                    <div className="space-y-2">
                      {(newPaketDraft.selectedConsoles || []).map((id) => {
                        const c = consoles.find((m) => m.id === id);
                        return (
                          <div key={id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div className="text-sm">{c?.name || id}</div>
                            <button onClick={() => {
                              const next = (newPaketDraft.selectedConsoles || []).filter((x) => x !== id);
                              setNewPaketDraft({ ...newPaketDraft, selectedConsoles: next });
                            }} className="text-sm text-red-600 px-2 py-1 rounded hover:bg-red-50">Hapus</button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Modal to select consoles */}
                  {showSelectConsoleModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Pilih Console</h3>
                            <button onClick={() => setShowSelectConsoleModal(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="h-6 w-6" /></button>
                          </div>

                          {/* Tabs inside modal */}
                          <div className="mb-4">
                            <nav className="-mb-px flex space-x-8">
                              <button onClick={() => setSelectConsoleModalTab("list")} className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${selectConsoleModalTab === "list" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}>
                                Daftar Console
                              </button>
                              <button onClick={() => setSelectConsoleModalTab("dipilih")} className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${selectConsoleModalTab === "dipilih" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}>
                                Dipilih
                              </button>
                            </nav>
                          </div>

                          {selectConsoleModalTab === "list" && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <input value={selectConsoleSearch} onChange={(e) => setSelectConsoleSearch(e.target.value)} placeholder="Cari console..." className="flex-1 px-3 py-2 border border-gray-200 rounded" />
                                <button onClick={() => {
                                  // select all in filtered list
                                  const filtered = consoles.filter((c) => (c.name + ' ' + c.id).toLowerCase().includes(selectConsoleSearch.toLowerCase())).map((c) => c.id);
                                  setSelectConsoleDraft(Array.from(new Set([...(selectConsoleDraft || []), ...filtered])));
                                }} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Pilih Semua</button>
                                <button onClick={() => setSelectConsoleDraft([])} className="px-3 py-2 border border-gray-200 rounded">Bersihkan</button>
                              </div>

                              {consoles.filter((c) => (c.name + ' ' + c.id).toLowerCase().includes(selectConsoleSearch.toLowerCase())).map((c) => {
                                const checked = selectConsoleDraft.includes(c.id);
                                return (
                                  <label key={c.id} className="flex items-center justify-between p-2 border border-gray-100 rounded">
                                    <div className="flex items-center gap-3">
                                      <input type="checkbox" checked={checked} onChange={(e) => {
                                        const prev = selectConsoleDraft || [];
                                        const next = e.target.checked ? Array.from(new Set([...prev, c.id])) : prev.filter((id) => id !== c.id);
                                        setSelectConsoleDraft(next);
                                      }} />
                                      <div className="text-sm">{c.name}</div>
                                    </div>
                                    <div className="text-sm text-gray-500">ID: {c.id}</div>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {selectConsoleModalTab === "dipilih" && (
                            <div className="space-y-2">
                              {selectConsoleDraft.length === 0 ? (
                                <div className="text-gray-500">Belum ada console dipilih.</div>
                              ) : (
                                selectConsoleDraft.map((id) => {
                                  const c = consoles.find((m) => m.id === id);
                                  return (
                                    <div key={id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                      <div className="text-sm">{c?.name || id}</div>
                                      <button onClick={() => setSelectConsoleDraft((prev) => prev.filter((x) => x !== id))} className="text-sm text-red-600 px-2 py-1 rounded hover:bg-red-50">Hapus</button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}

                          <div className="flex gap-3 mt-6">
                            <button onClick={() => {
                              // Cancel: close modal and discard staged changes
                              setShowSelectConsoleModal(false);
                            }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg">Batal</button>
                            <button onClick={() => {
                              // Apply staged draft to paket draft
                              setNewPaketDraft({ ...newPaketDraft, selectedConsoles: selectConsoleDraft });
                              setShowSelectConsoleModal(false);
                            }} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">Selesai</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreatePaketForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg">Batal</button>
              <button onClick={handleCreatePaketDraft} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">{editingPaketId ? 'Simpan Paket' : 'Buat Paket'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Tab Riwayat Pembelian
  const renderPurchaseHistoryTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Riwayat Pembelian Voucher
        </h2>
        <p className="text-gray-600">
          Daftar transaksi penjualan voucher ke customer
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Jumlah Voucher</p>
            <h3 className="text-2xl font-bold text-gray-900">{purchaseHistorySummary.voucherCount}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg text-green-600">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Penjualan</p>
            <h3 className="text-2xl font-bold text-gray-900">
              Rp {purchaseHistorySummary.totalSales.toLocaleString("id-ID")}
            </h3>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <PurchaseFilters
            search={purchaseHistorySearch}
            onSearch={setPurchaseHistorySearch}
            period={purchaseHistoryPeriod}
            onPeriodChange={setPurchaseHistoryPeriod}
            dateRange={purchaseHistoryDateRange}
            onDateRangeChange={setPurchaseHistoryDateRange}
            placeholder="Cari UID, alias, kode voucher, nama voucher, atau metode bayar..."
          />
        </div>
        <div className="p-4">
          {purchaseHistoryDateEntries.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Tidak ada transaksi yang sesuai dengan filter.
            </div>
          ) : (
            <div className="space-y-4">
              {purchaseHistoryDateEntries.map(([date, group]) => {
                const isOpen = expandedPurchaseHistoryDate === date;

                return (
                  <div key={date} className="border rounded-xl overflow-hidden bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setExpandedPurchaseHistoryDate(isOpen ? null : date)}
                      className="w-full flex items-center justify-between gap-4 p-4 bg-slate-50 hover:bg-slate-100 transition"
                    >
                      <div>
                        <h4 className="font-bold text-gray-900">
                          {date === "unknown"
                            ? "Tanggal Tidak Diketahui"
                            : new Date(date).toLocaleDateString("id-ID", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {group.transactions.length} voucher
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-medium text-gray-500 uppercase">Sub Total</p>
                          <span className="font-bold text-blue-700">
                            Rp {group.subtotal.toLocaleString("id-ID")}
                          </span>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-2 overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-gray-500 border-b">
                              <th className="text-left py-2">Waktu</th>
                              <th className="text-left py-2">UID & Alias</th>
                              <th className="text-left py-2">Kode Voucher</th>
                              <th className="text-left py-2">Nama Voucher</th>
                              <th className="text-left py-2">Metode</th>
                              <th className="text-right py-2">Total Bayar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.transactions.map((trx) => {
                              const d = parseDetails(trx.details);
                              const items = d.items ?? [];
                              const firstItem = items[0] ?? {};
                              const voucherCode = extractVoucherCode(d, firstItem);
                              const cardUid = extractCardUid(d, firstItem);
                              const cardAlias =
                                cardUid !== "-"
                                  ? rfidAliasByUid[cardUid.toLowerCase()] ?? "-"
                                  : "-";

                              return (
                                <tr key={trx.id} className="border-b border-gray-100 last:border-b-0">
                                  <td className="py-3 pr-4 whitespace-nowrap text-gray-700">
                                    {trx.timestamp
                                      ? new Date(trx.timestamp).toLocaleTimeString("id-ID", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      : "-"}
                                  </td>
                                  <td className="py-3 pr-4">
                                    <div className="font-medium text-gray-900">
                                      {cardUid}
                                    </div>
                                    <div className="text-gray-500">
                                      {cardAlias}
                                    </div>
                                  </td>
                                  <td className="py-3 pr-4 whitespace-nowrap text-gray-700">
                                    {voucherCode}
                                  </td>
                                  <td className="py-3 pr-4 text-gray-700">{firstItem.name ?? "-"}</td>
                                  <td className="py-3 whitespace-nowrap text-gray-700">
                                    {(trx.payment_method ?? d.payment?.method ?? "-").toUpperCase()}
                                  </td>
                                  <td className="py-3 pr-4 text-right font-medium text-gray-900 whitespace-nowrap">
                                    Rp {Number(trx.amount ?? 0).toLocaleString("id-ID")}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderVouchersTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Voucher Aktif</h2>
          <p className="text-gray-600">Kelola voucher yang masih berlaku</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSellVoucherForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <ShoppingCart className="h-5 w-5" />
            Jual Voucher
          </button>
          <button
            onClick={() => setShowCreateVoucherForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Buat Voucher
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Cari kode voucher, nama, atau customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          {/* <option value="expired">Expired</option> */}
          <option value="used-up">Habis Terpakai</option>
        </select>
      </div>

      {/* Vouchers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeVouchers.map((voucher) => {
          // const totalHours = (voucher.totalMinutes ?? 0) / 60;
          // const totalCapital = Number(voucher.capital * totalHours || 0);
          // const capitalPerHour = Number(voucher.capital);
          // const totalPrice = Number(voucher.voucherPrice || 0);
          const bonusPct = voucher.voucherPrice
            ? ((voucher.totalPoints - voucher.voucherPrice) /
                voucher.voucherPrice) *
              100
            : 0;

          return (
            <div
              key={voucher.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                      <Ticket className="h-6 w-6" />
                    </div>
                    <div>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {voucher.voucherCode}
                        </h3>
                        <span className="text-sm opacity-90">
                          {voucher.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      voucher.status
                    )}`}
                  >
                    {getStatusIcon(voucher.status)}
                    {voucher.status.toUpperCase()}
                  </span>
                  <h2 className="font-bold text-lg">
                    Rp {voucher.voucherPrice.toLocaleString("ID", "id")}
                  </h2>
                  {/* {isExpiringSoon && voucher.status === "active" && (
                    <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                      Segera Expired
                    </span>
                  )} */}
                </div>
              </div>

              {/* Body */}
              <div className="p-4">
                <div className="space-y-4">
                  {/* Customer Info */}
                  {voucher.customerName && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">
                          Customer
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">
                        {voucher.customerName}
                      </p>
                      {voucher.customerPhone && (
                        <p className="text-sm text-gray-600">
                          {voucher.customerPhone}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Ringkasan points */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Total Points:</span>
                      <span className="font-medium">
                        {voucher.totalPoints} points
                      </span>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium text-purple-600">
                          Harga Voucher
                        </span>
                        <span className="font-bold text-purple-600">
                          Rp {voucher.voucherPrice.toLocaleString("id-ID")}
                        </span>
                      </div>
                      {/* <div className="flex justify-between">
                        <span className="text-gray-600">Modal Voucher</span>
                        <span className="font-medium">
                          Rp {voucher.capital.toLocaleString("id-ID")}
                        </span>
                      </div> */}

                      <div className="flex justify-between border-b border-gray-200 pb-1">
                        <span className="font-medium text-purple-600">
                          Total Points
                        </span>
                        <span className="font-bold text-purple-600">
                          {Number(voucher.totalPoints)} points
                        </span>
                      </div>
                      {/* <div className="flex justify-between">
                        <span className="text-gray-600">Harga Voucher</span>
                        <span className="font-bold text-green-600">
                          Rp {voucher.voucherPrice.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Modal</span>
                        <span className="font-medium">
                          Rp {voucher.capital.toLocaleString("id-ID")}
                        </span>
                      </div> */}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Bonus (%)</span>
                        <span className="font-bold">
                          {bonusPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tanggal Dibuat/Diupdate */}
                  {(voucher.createdAt || voucher.updatedAt) && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {voucher.createdAt && (
                        <div>
                          <span className="text-gray-600">Dibuat</span>
                          <p className="font-medium">
                            {new Date(voucher.createdAt).toLocaleDateString(
                              "id-ID"
                            )}
                          </p>
                        </div>
                      )}
                      {voucher.updatedAt && (
                        <div>
                          <span className="text-gray-600">Diupdate</span>
                          <p className="font-medium">
                            {new Date(voucher.updatedAt).toLocaleDateString(
                              "id-ID"
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-gray-100">
                    <button
                      onClick={() =>
                        setSelectedVoucher(
                          selectedVoucher === voucher.id ? null : voucher.id
                        )
                      }
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Detail
                    </button>
                    <button
                      onClick={() => setShowPrintModal(voucher.id)}
                      className="p-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg transition-colors"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openEditForm(voucher)}
                      className="p-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg transition-colors"
                      title="Edit Voucher"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteVoucher(voucher.id)}
                      className="p-2 border border-red-300 hover:border-red-400 text-red-600 hover:text-red-700 rounded-lg transition-colors"
                      title="Hapus Voucher"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Extended Details */}
                  {selectedVoucher === voucher.id && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3">
                        Detail Voucher
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Kode Voucher:</span>
                          <span className="font-medium">
                            {voucher.voucherCode}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Deskripsi:</span>
                          <span className="font-medium">
                            {voucher.description}
                          </span>
                        </div>
                        {/* <div className="flex justify-between">
                          <span className="text-gray-600">Diskon:</span>
                          <span className="font-medium">
                            {voucher.discountPercentage}%
                          </span>
                        </div> */}
                        {/* Skema baru tidak memiliki masa berlaku */}
                        {/* {voucher.soldDate && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tanggal Jual:</span>
                            <span className="font-medium">
                              {new Date(voucher.soldDate).toLocaleDateString(
                                "id-ID"
                              )}
                            </span>
                          </div>
                        )} */}
                        {voucher.soldBy && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Dijual oleh:</span>
                            <span className="font-medium">
                              {voucher.soldBy}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        <button
                          onClick={() => setShowPrintModal(voucher.id)}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <Printer className="h-4 w-4" />
                          Cetak Ulang Voucher
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  

  // const renderUsageHistoryTab = () => (
  //   <div className="space-y-6">
  //     <div>
  //       <h2 className="text-2xl font-bold text-gray-900">Riwayat Penggunaan</h2>
  //       <p className="text-gray-600">
  //         History penggunaan voucher oleh customer
  //       </p>
  //     </div>

  //     <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
  //       <div className="overflow-x-auto">
  //         <table className="w-full">
  //           <thead className="bg-gray-50">
  //             <tr>
  //               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  //                 Kode Voucher
  //               </th>
  //               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  //                 Customer
  //               </th>
  //               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  //                 Jam Digunakan
  //               </th>
  //               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  //                 Sisa Setelah
  //               </th>
  //               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  //                 Tanggal
  //               </th>
  //               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  //                 Diproses oleh
  //               </th>
  //             </tr>
  //           </thead>
  //           <tbody className="bg-white divide-y divide-gray-200">
  //             {voucherUsages.map((usage) => {
  //               const voucher = vouchers.find((v) => v.id === usage.voucherId);

  //               return (
  //                 <tr key={usage.id} className="hover:bg-gray-50">
  //                   <td className="px-6 py-4 whitespace-nowrap">
  //                     <div className="flex items-center">
  //                       <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
  //                         <Ticket className="h-4 w-4 text-purple-600" />
  //                       </div>
  //                       <div>
  //                         <div className="text-sm font-medium text-gray-900">
  //                           {usage.voucherCode}
  //                         </div>
  //                         <div className="text-sm text-gray-500">
  //                           {voucher?.name}
  //                         </div>
  //                       </div>
  //                     </div>
  //                   </td>
  //                   <td className="px-6 py-4 whitespace-nowrap">
  //                     <div>
  //                       <div className="text-sm font-medium text-gray-900">
  //                         {voucher?.customerName || "-"}
  //                       </div>
  //                       <div className="text-sm text-gray-500">
  //                         {voucher?.customerPhone || "-"}
  //                       </div>
  //                     </div>
  //                   </td>
  //                   <td className="px-6 py-4 whitespace-nowrap">
  //                     <div className="text-sm font-medium text-gray-900">
  //                       {usage.hoursUsed} jam
  //                     </div>
  //                   </td>
  //                   <td className="px-6 py-4 whitespace-nowrap">
  //                     <div className="text-sm font-medium text-gray-900">
  //                       {usage.remainingHoursAfter} jam
  //                     </div>
  //                   </td>
  //                   <td className="px-6 py-4 whitespace-nowrap">
  //                     <div className="text-sm text-gray-900">
  //                       {new Date(usage.usageDate).toLocaleDateString("id-ID")}
  //                     </div>
  //                   </td>
  //                   <td className="px-6 py-4 whitespace-nowrap">
  //                     <div className="text-sm text-gray-900">
  //                       {usage.usedBy || "-"}
  //                     </div>
  //                   </td>
  //                 </tr>
  //               );
  //             })}
  //           </tbody>
  //         </table>
  //       </div>
  //     </div>
  //   </div>
  // );

  const renderMasterPaketTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Master Paket</h2>
          <p className="text-gray-600">Daftar paket master (pengelolaan utama)</p>
        </div>
        <div>
          <button onClick={() => {
            // generate next PKT code (PKT###) based on existing pakets
            const existingNumbers = pakets.map((pp) => {
              const code = (pp as any).code || '';
              const m = code.match(/PKT(\d{1,})$/i);
              return m ? Number(m[1]) : 0;
            });
            const maxNum = existingNumbers.length ? Math.max(...existingNumbers) : 0;
            const next = (maxNum + 1).toString().padStart(3, '0');
            const defaultCode = `PKT${next}`;
            // reset draft to zeros/empty when opening form
            setNewPaketDraft({ name: "", code: defaultCode, durationHours: 0, durationMinutes: 0, pricePerHour: 0, status: "active", discountAmount: 0, days: defaultDays, selectedConsoles: [], hariJamList: [], packagePrice: undefined, hargaNormal: 0 });
            setShowCreatePaketForm(true);
          }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Buat Paket
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <nav className="flex space-x-4">
            <button onClick={() => setMasterPaketSubTab('management')} className={`py-2 px-3 rounded-md font-medium ${masterPaketSubTab === 'management' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}>Management Paket</button>
            <button onClick={() => setMasterPaketSubTab('history')} className={`py-2 px-3 rounded-md font-medium ${masterPaketSubTab === 'history' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}>History Pengunaan Paket</button>
          </nav>
        </div>

        <div className="p-6">
          {masterPaketSubTab === 'management' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kode Paket</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nama Paket</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Durasi</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Harga Normal</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Harga Paket</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hemat</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pakets.map((p) => (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          <button onClick={async () => {
                            try {
                              if (viewPaketData && viewPaketData.id === p.id) {
                                setViewPaketData(null);
                                return;
                              }
                              const full = await paketService.getPackageById(p.id);
                              setViewPaketData(full);
                            } catch (err: any) {
                              alert(err?.message || 'Gagal memuat detail paket');
                            }
                          }} className="text-blue-600 hover:underline">{(p as any).code || ''}</button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{p.name}</div>
                          <div className="text-sm text-gray-500">{p.description}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">{p.durationHours} jam {p.durationMinutes} menit</td>
                        <td className="px-4 py-3 text-sm">Rp {Number((p as any).hargaNormal ?? p.pricePerHour ?? 0).toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3 text-sm">Rp {Number((p as any).packagePrice ?? 0).toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3 text-sm">Rp {Math.max(0, Number((p as any).hargaNormal ?? p.pricePerHour ?? 0) - Number((p as any).packagePrice ?? 0)).toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <div className="inline-flex items-center gap-2">
                            <button onClick={async () => {
                              try {
                                const full = await paketService.getPackageById(p.id);
                                if (full) {
                                  setNewPaketDraft({
                                    name: full.name,
                                    status: full.status,
                                    description: full.description,
                                    durationHours: full.durationHours,
                                    durationMinutes: full.durationMinutes,
                                    pricePerHour: full.hargaNormal ?? full.packagePrice ?? 0,
                                    discountAmount: full.discountAmount ?? 0,
                                    days: defaultDays,
                                    selectedConsoles: full.selectedConsoles || [],
                                    hariJamList: full.hariJamList || [],
                                    packagePrice: full.packagePrice,
                                    hargaNormal: full.hargaNormal ?? full.packagePrice ?? 0,
                                    code: full.code,
                                  });
                                  setEditingPaketId(p.id);
                                  setShowCreatePaketForm(true);
                                } else {
                                  alert('Paket tidak ditemukan');
                                }
                              } catch (err: any) {
                                alert(err?.message || 'Gagal mengambil paket');
                              }
                            }} className="text-blue-600 hover:text-blue-700 p-1 rounded"><Edit className="h-4 w-4" /></button>
                            <button onClick={async () => {
                              if (!confirm(`Hapus paket ${p.name}?`)) return;
                              try {
                                await paketService.deletePackage(p.id);
                                await reloadPakets();
                                await refreshOpenDetail(p.id);
                                await Swal.fire({
                                  toast: true,
                                  position: 'top-end',
                                  icon: 'success',
                                  title: 'Paket berhasil dihapus',
                                  showConfirmButton: false,
                                  timer: 2000,
                                });
                              } catch (err: any) {
                                await Swal.fire({
                                  toast: true,
                                  position: 'top-end',
                                  icon: 'error',
                                  title: err?.message || 'Gagal menghapus paket',
                                  showConfirmButton: false,
                                  timer: 2500,
                                });
                              }
                            }} className="text-red-600 hover:text-red-700 p-1 rounded"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                      {viewPaketData && viewPaketData.id === p.id && (
                        <tr key={`detail-${p.id}`} className="bg-white">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="bg-gray-50 rounded-lg p-4 relative">
                              <button onClick={() => setViewPaketData(null)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600" aria-label="Tutup detail paket"><XCircle className="h-5 w-5" /></button>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <div className="text-sm text-gray-500">Kode Paket</div>
                                  <div className="font-medium">{viewPaketData.code}</div>
                                </div>
                                <div>
                                  <div className="text-sm text-gray-500">Nama Paket</div>
                                  <div className="font-medium">{viewPaketData.name}</div>
                                </div>
                                <div>
                                  <div className="text-sm text-gray-500">Status</div>
                                  <div className="font-medium">{viewPaketData.status}</div>
                                </div>
                                <div>
                                  <div className="text-sm text-gray-500">Durasi</div>
                                  <div className="font-medium">{viewPaketData.durationHours} jam {viewPaketData.durationMinutes} menit</div>
                                </div>
                                <div>
                                  <div className="text-sm text-gray-500">Harga Normal (Rp)</div>
                                  <div className="font-medium">Rp {Number(viewPaketData.hargaNormal ?? viewPaketData.packagePrice ?? 0).toLocaleString('id-ID')}</div>
                                </div>
                                <div>
                                  <div className="text-sm text-gray-500">Harga Paket (Rp)</div>
                                  <div className="font-medium">Rp {Number(viewPaketData.packagePrice ?? 0).toLocaleString('id-ID')}</div>
                                </div>
                                <div className="md:col-span-2">
                                  <div className="text-sm text-gray-500">Deskripsi</div>
                                  <div className="mt-1 text-sm text-gray-700">{viewPaketData.description || '-'}</div>
                                </div>
                                <div className="md:col-span-2">
                                  <div>
                                    <button onClick={() => setExpandedHariFor(expandedHariFor === p.id ? null : p.id)} className="w-full flex items-center justify-between bg-white p-2 rounded border">
                                      <div className="text-sm font-medium text-blue-600 hover:underline">Hari & Jam Berlaku</div>
                                      <div className="flex items-center gap-3">
                                        <div className="text-sm text-gray-500">{(viewPaketData.hariJamList || []).length}</div>
                                        <ChevronDown className={`h-4 w-4 text-gray-500 transform transition-transform duration-150 ease-in-out ${expandedHariFor === p.id ? 'rotate-180' : 'rotate-0'}`} />
                                      </div>
                                    </button>
                                    {expandedHariFor === p.id && (
                                      <div className="mt-2 space-y-2">
                                        {(viewPaketData.hariJamList || []).length === 0 ? (
                                          <div className="text-sm text-gray-500">Tidak ada hari/jam yang diatur.</div>
                                        ) : (
                                          (viewPaketData.hariJamList || []).map((hj: any) => (
                                            <div key={hj.id || (hj.day + hj.startTime)} className="flex items-center justify-between bg-white p-2 rounded border">
                                              <div className="font-medium">{hj.day}</div>
                                              <div className="text-sm text-gray-600">{hj.startTime} - {hj.endTime}</div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="md:col-span-2">
                                  <div>
                                    <button onClick={() => setExpandedConsolesFor(expandedConsolesFor === p.id ? null : p.id)} className="w-full flex items-center justify-between bg-white p-2 rounded border">
                                      <div className="text-sm font-medium text-blue-600 hover:underline">Consoles</div>
                                      <div className="flex items-center gap-3">
                                        <div className="text-sm text-gray-500">{(viewPaketData.selectedConsoles || []).length}</div>
                                        <ChevronDown className={`h-4 w-4 text-gray-500 transform transition-transform duration-150 ease-in-out ${expandedConsolesFor === p.id ? 'rotate-180' : 'rotate-0'}`} />
                                      </div>
                                    </button>
                                    {expandedConsolesFor === p.id && (
                                      <div className="mt-2 space-y-2">
                                        {(viewPaketData.selectedConsoles || []).length === 0 ? (
                                          <div className="text-sm text-gray-500">Tidak ada console terkait.</div>
                                        ) : (
                                          (viewPaketData.selectedConsoles || []).map((cid: any) => {
                                            const c = consoles.find((x) => x.id === cid);
                                            return (
                                              <div key={cid} className="flex items-center justify-between bg-white p-2 rounded border">
                                                <div className="font-medium">{c?.name ?? cid}</div>
                                                <div className="text-sm text-gray-600">ID: {cid}</div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-gray-500">History Pengunaan Paket masih kosong. Saya akan menunggu desain Anda untuk mengisinya.</div>
          )}
        </div>
      </div>
    </div>
  );

  // const renderExpiredTab = () => (
  //   <div className="space-y-6">
  //     <div>
  //       <h2 className="text-2xl font-bold text-gray-900">
  //         Voucher Expired/Habis
  //       </h2>
  //       <p className="text-gray-600">
  //         Riwayat voucher yang sudah tidak berlaku
  //       </p>
  //     </div>

  //     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  //       {expiredVouchers.map((voucher) => (
  //         <div
  //           key={voucher.id}
  //           className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden opacity-75"
  //         >
  //           {/* Header */}
  //           <div className="bg-gradient-to-r from-gray-500 to-gray-600 p-4 text-white">
  //             <div className="flex items-center justify-between mb-2">
  //               <div className="flex items-center gap-3">
  //                 <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
  //                   <Ticket className="h-6 w-6" />
  //                 </div>
  //                 <div>
  //                   <h3 className="font-semibold text-lg">
  //                     {voucher.voucherCode}
  //                   </h3>
  //                   <span className="text-sm opacity-90">{voucher.name}</span>
  //                 </div>
  //               </div>
  //             </div>

  //             <div className="flex items-center justify-between">
  //               <span
  //                 className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
  //                   voucher.status
  //                 )}`}
  //               >
  //                 {getStatusIcon(voucher.status)}
  //                 {voucher.status.toUpperCase()}
  //               </span>
  //             </div>
  //           </div>

  //           {/* Body */}
  //           <div className="p-4">
  //             <div className="space-y-3">
  //               {/* Customer Info */}
  //               {voucher.customerName && (
  //                 <div className="bg-gray-50 rounded-lg p-3">
  //                   <div className="flex items-center gap-2 mb-1">
  //                     <User className="h-4 w-4 text-gray-600" />
  //                     <span className="text-sm font-medium text-gray-700">
  //                       Customer
  //                     </span>
  //                   </div>
  //                   <p className="font-medium text-gray-900">
  //                     {voucher.customerName}
  //                   </p>
  //                   {voucher.customerPhone && (
  //                     <p className="text-sm text-gray-600">
  //                       {voucher.customerPhone}
  //                     </p>
  //                   )}
  //                 </div>
  //               )}

  //               {/* Final Stats */}
  //               <div className="grid grid-cols-2 gap-4 text-sm">
  //                 <div>
  //                   <span className="text-gray-600">Total Jam</span>
  //                   <p className="font-medium">{voucher.totalHours} jam</p>
  //                 </div>
  //                 <div>
  //                   <span className="text-gray-600">Jam Terpakai</span>
  //                   <p className="font-medium">{voucher.usedHours} jam</p>
  //                 </div>
  //                 <div>
  //                   <span className="text-gray-600">Harga Voucher</span>
  //                   <p className="font-medium">
  //                     Rp {voucher.voucherPrice.toLocaleString("id-ID")}
  //                   </p>
  //                 </div>
  //                 <div>
  //                   <span className="text-gray-600">Status</span>
  //                   <p className="font-medium">
  //                     {voucher.status === "expired"
  //                       ? "Expired"
  //                       : "Habis Terpakai"}
  //                   </p>
  //                 </div>
  //               </div>

  //               {/* Dates */}
  //               <div className="border-t border-gray-200 pt-3 grid grid-cols-2 gap-4 text-sm">
  //                 <div>
  //                   <span className="text-gray-600">Dibuat</span>
  //                   <p className="font-medium">
  //                     {new Date(voucher.createdDate).toLocaleDateString(
  //                       "id-ID"
  //                     )}
  //                   </p>
  //                 </div>
  //                 <div>
  //                   <span className="text-gray-600">Expired</span>
  //                   <p className="font-medium">
  //                     {new Date(voucher.expiryDate).toLocaleDateString("id-ID")}
  //                   </p>
  //                 </div>
  //               </div>
  //             </div>
  //           </div>
  //         </div>
  //       ))}
  //     </div>
  //   </div>
  // );

  const openEditForm = (voucher: any) => {
    setEditingVoucher({
      id: voucher.id,
      voucherCode: voucher.voucherCode,
      name: voucher.name,
      description: voucher.description,
      totalPoints: voucher.totalPoints,
      voucherPrice: voucher.voucherPrice,
      capital: voucher.capital,
    });
    setShowEditVoucherForm(true);
  };

  const handleEditVoucher = async () => {
    if (
      !editingVoucher ||
      !editingVoucher.name ||
      !editingVoucher.capital ||
      !editingVoucher.voucherPrice
    ) {
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Nama, modal voucher, dan harga voucher wajib diisi",
      });
      return;
    }

    try {
      // const totalMinutes = Math.max(
      //   Math.floor(Number(editingVoucher.totalHours) * 60),
      //   1
      // );
      // const hourlyRate = Number(Number(editingVoucher.hourlyRate).toFixed(2));
      // const voucherPrice = Number(
      //   (hourlyRate * Number(editingVoucher.totalHours)).toFixed(2)
      // );

      await db.update("vouchers", editingVoucher.id, {
        name: editingVoucher.name,
        description: editingVoucher.description,
        total_points: editingVoucher.totalPoints,
        capital: Number(Number(editingVoucher.capital)),
        // hourly_rate: hourlyRate,
        voucher_price: editingVoucher.voucherPrice,
      });

      await Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: `Voucher ${editingVoucher.voucherCode} berhasil diperbarui!`,
      });

      setShowEditVoucherForm(false);
      setEditingVoucher(null);
      (window as any).refreshVouchers?.();
    } catch (e: any) {
      await Swal.fire({
        icon: "error",
        title: "Gagal",
        text: e?.message || "Gagal memperbarui voucher",
      });
    }
  };

  const handleDeleteVoucher = async (voucherId: string) => {
    const voucher = vouchers.find((v) => v.id === voucherId);
    if (!voucher) return;

    const result = await Swal.fire({
      title: `Hapus Voucher ${voucher.voucherCode}?`,
      text: "Tindakan ini tidak bisa dibatalkan.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    });

    if (!result.isConfirmed) return;

    try {
      await db.delete("vouchers", voucherId);

      await Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: `Voucher ${voucher.voucherCode} berhasil dihapus!`,
      });

      (window as any).refreshVouchers?.();
    } catch (e: any) {
      await Swal.fire({
        icon: "error",
        title: "Gagal",
        text: e?.message || "Gagal menghapus voucher",
      });
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Manajemen Voucher
        </h1>
        <p className="text-gray-600">Kelola voucher dengan sistem kode unik</p>
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: "master-paket", label: "Master Paket", icon: Package },
              { id: "vouchers", label: "Voucher Aktif", icon: Ticket },
              // { id: "usage-history", label: "Riwayat Penggunaan", icon: Clock },
              // { id: "expired", label: "Expired/Habis", icon: XCircle },
              {
                id: "purchase-history",
                label: "Riwayat Pembelian Voucher",
                icon: ShoppingCart,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
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
  {activeTab === "master-paket" && renderMasterPaketTab()}
  {activeTab === "vouchers" && renderVouchersTab()}
  {/* {activeTab === "usage-history" && renderUsageHistoryTab()} */}
  {/* {activeTab === "expired" && renderExpiredTab()} */}
  {/* paket tab renderer not present in this version */}
  {activeTab === "purchase-history" && renderPurchaseHistoryTab()}

  {renderCreatePaketModal()}

  {/* inline paket details are rendered directly under the paket row; modal removed */}

      {/* Create Voucher Modal */}
      {showCreateVoucherForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Buat Voucher Baru
              </h2>

              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Voucher *
                  </label>
                  <input
                    type="text"
                    value={newVoucher.name}
                    onChange={(e) =>
                      setNewVoucher({ ...newVoucher, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Voucher Gaming 5 Jam"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deskripsi
                  </label>
                  <textarea
                    value={newVoucher.description}
                    onChange={(e) =>
                      setNewVoucher({
                        ...newVoucher,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                    placeholder="Deskripsi voucher"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Points *
                    </label>
                    <input
                      type="number"
                      value={newVoucher.totalPoints}
                      onChange={(e) =>
                        setNewVoucher({
                          ...newVoucher,
                          totalPoints: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Harga Voucher *
                    </label>
                    <input
                      type="number"
                      value={newVoucher.voucherPrice}
                      onChange={(e) =>
                        setNewVoucher({
                          ...newVoucher,
                          voucherPrice: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Modal Voucher
                    </label>
                    <input
                      type="number"
                      value={newVoucher.capital}
                      onChange={(e) =>
                        setNewVoucher({
                          ...newVoucher,
                          capital: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                    />
                  </div>

                  {/* <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Berlaku (hari)
                    </label>
                    <input
                      type="number"
                      value={newVoucher.validityDays}
                      onChange={(e) =>
                        setNewVoucher({
                          ...newVoucher,
                          validityDays: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      max="365"
                    />
                  </div> */}
                </div>

                {/* Price Preview */}
                {/* {newVoucher.hourlyRate && newVoucher.discountPercentage && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Preview Harga
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Harga Normal:</span>
                        <span>
                          Rp {newVoucher.hourlyRate.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Harga Voucher:</span>
                        <span className="font-bold text-green-600">
                          Rp{" "}
                          {calculateVoucherPrice().discounted.toLocaleString(
                            "id-ID"
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-1">
                        <span>Hemat:</span>
                        <span className="font-bold text-purple-600">
                          Rp{" "}
                          {calculateVoucherPrice().savings.toLocaleString(
                            "id-ID"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )} */}
              </form>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateVoucherForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleCreateVoucher}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Buat Voucher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sell Voucher Modal */}
      {showSellVoucherForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Jual Voucher
              </h2>

              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pilih Voucher *
                  </label>
                  <select
                    value={sellVoucher.voucherId}
                    onChange={(e) =>
                      setSellVoucher({
                        ...sellVoucher,
                        voucherId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Pilih Voucher</option>
                    {vouchers
                      .filter((v) => v.status === "active" && !v.customerId)
                      .map((voucher) => (
                        <option key={voucher.id} value={voucher.id}>
                          {voucher.voucherCode} - {voucher.name} (Rp{" "}
                          {voucher.voucherPrice.toLocaleString("id-ID")})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer (Opsional)
                  </label>
                  <select
                    value={sellVoucher.customerId}
                    onChange={(e) => {
                      const customer = customers.find(
                        (c) => c.id === e.target.value
                      );
                      setSellVoucher({
                        ...sellVoucher,
                        customerId: e.target.value,
                        customerName: customer?.name || "",
                        customerPhone: customer?.phone || "",
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Pilih Customer atau isi manual</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} - {customer.phone}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Manual Customer Input */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama Customer
                    </label>
                    <input
                      type="text"
                      value={sellVoucher.customerName}
                      onChange={(e) =>
                        setSellVoucher({
                          ...sellVoucher,
                          customerName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Nama customer"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      No. Telepon
                    </label>
                    <input
                      type="text"
                      value={sellVoucher.customerPhone}
                      onChange={(e) =>
                        setSellVoucher({
                          ...sellVoucher,
                          customerPhone: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="No. telepon"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catatan (Opsional)
                  </label>
                  <textarea
                    value={sellVoucher.notes}
                    onChange={(e) =>
                      setSellVoucher({ ...sellVoucher, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Catatan penjualan"
                  />
                </div>

                {/* Sale Summary */}
                {sellVoucher.voucherId && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Ringkasan Penjualan
                    </h4>
                    {(() => {
                      const selectedVoucher = vouchers.find(
                        (v) => v.id === sellVoucher.voucherId
                      );

                      if (!selectedVoucher) return null;

                      return (
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Kode Voucher:</span>
                            <span>{selectedVoucher.voucherCode}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Nama Voucher:</span>
                            <span>{selectedVoucher.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Points:</span>
                            <span>{selectedVoucher.totalPoints} points</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Berlaku:</span>
                            <span>{selectedVoucher.validityDays} hari</span>
                          </div>
                          <div className="flex justify-between font-medium border-t border-gray-200 pt-2">
                            <span>Total Bayar:</span>
                            <span>
                              Rp{" "}
                              {selectedVoucher.voucherPrice.toLocaleString(
                                "id-ID"
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </form>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSellVoucherForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSellVoucher}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Jual Voucher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Voucher Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Cetak Voucher
                </h2>
                <button
                  onClick={() => setShowPrintModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="flex justify-center mb-6">
                {(() => {
                  const voucher = vouchers.find((v) => v.id === showPrintModal);
                  return voucher ? renderPrintableVoucher(voucher) : null;
                })()}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPrintModal(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    window.print();
                    setShowPrintModal(null);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Cetak Voucher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Voucher Modal */}
      {showEditVoucherForm && editingVoucher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Edit Voucher {editingVoucher.voucherCode}
              </h2>

              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Voucher *
                  </label>
                  <input
                    type="text"
                    value={editingVoucher.name}
                    onChange={(e) =>
                      setEditingVoucher({
                        ...editingVoucher,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Voucher Gaming 5 Jam"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deskripsi
                  </label>
                  <textarea
                    value={editingVoucher.description}
                    onChange={(e) =>
                      setEditingVoucher({
                        ...editingVoucher,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                    placeholder="Deskripsi voucher"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Harga Voucher *
                    </label>
                    <input
                      type="number"
                      value={editingVoucher.voucherPrice}
                      onChange={(e) =>
                        setEditingVoucher({
                          ...editingVoucher,
                          voucherPrice: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Modal Voucher
                    </label>
                    <input
                      type="number"
                      value={editingVoucher.capital}
                      onChange={(e) =>
                        setEditingVoucher({
                          ...editingVoucher,
                          capital: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Points *
                  </label>
                  <input
                    type="number"
                    value={editingVoucher.totalPoints}
                    onChange={(e) =>
                      setEditingVoucher({
                        ...editingVoucher,
                        totalPoints: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>

                {/* Preview Harga */}
                {editingVoucher.voucherPrice &&
                  editingVoucher.totalPoints > 0 &&
                  (() => {
                    // const totalHours = Number(editingVoucher.totalHours) || 0;
                    // const capitalPerHour = Number(editingVoucher.capital) || 0;
                    // const hourlyRate = Number(editingVoucher.hourlyRate) || 0;
                    // const totalPrice = Number(hourlyRate * totalHours) || 0;
                    // const totalCapital =
                    //   Number(capitalPerHour * totalHours) || 0;
                    const bonusPct = editingVoucher.voucherPrice
                      ? ((editingVoucher.totalPoints -
                          editingVoucher.voucherPrice) /
                          editingVoucher.voucherPrice) *
                        100
                      : 0;

                    return (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">
                          Preview Harga
                        </h4>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium text-purple-600">
                                Harga Voucher
                              </span>
                              <span className="font-bold text-purple-600">
                                Rp{" "}
                                {editingVoucher.voucherPrice.toLocaleString(
                                  "id-ID"
                                )}
                              </span>
                            </div>
                            {/* <div className="flex justify-between">
                              <span className="text-gray-600">
                                Modal Voucher
                              </span>
                              <span className="font-medium">
                                Rp{" "}
                                {editingVoucher.capital.toLocaleString("id-ID")}
                              </span>
                            </div> */}
                            <div className="flex justify-between border-b border-gray-200 pb-1">
                              <span className="font-medium text-purple-600">
                                Total Points
                              </span>
                              <span className="font-bold text-purple-600">
                                {editingVoucher.totalPoints} points
                              </span>
                            </div>
                            {/* <div className="flex justify-between">
                              <span className="text-gray-600">
                                Harga Voucher
                              </span>
                              <span className="font-bold text-green-600">
                                Rp{" "}
                                {editingVoucher.voucherPrice.toLocaleString(
                                  "id-ID"
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Modal</span>
                              <span className="font-medium">
                                Rp{" "}
                                {editingVoucher.capital.toLocaleString("id-ID")}
                              </span>
                            </div> */}
                            <div className="flex justify-between">
                              <span className="text-gray-600">Bonus (%)</span>
                              <span className="font-bold">
                                {bonusPct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </form>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditVoucherForm(false);
                    setEditingVoucher(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleEditVoucher}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Ticket className="h-6 w-6 text-purple-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {vouchers.length}
          </h3>
          <p className="text-gray-600 text-sm">Total Voucher</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {vouchers.filter((v) => v.status === "active").length}
          </h3>
          <p className="text-gray-600 text-sm">Voucher Aktif</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <DollarSign className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            Rp{" "}
            {vouchers
              .filter((v) => v.soldDate)
              .reduce((sum, v) => sum + v.voucherPrice, 0)
              .toLocaleString("id-ID")}
          </h3>
          <p className="text-gray-600 text-sm">Total Penjualan</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="h-6 w-6 text-orange-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {voucherUsages.length}
          </h3>
          <p className="text-gray-600 text-sm">Total Penggunaan</p>
        </div>
      </div>
    </div>
  );
};

export default VoucherManagement;
