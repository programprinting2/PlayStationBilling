import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Clock3,
  DollarSign,
  Package,
  RefreshCw,
  Shield,
  ShoppingCart,
  Ticket,
  TrendingDown,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type PeriodType = "today" | "yesterday" | "week" | "month" | "range";

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const toYmd = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateId = (dateValue: string) => {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const parseLocalDate = (dateValue: string) => {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const toLocalIsoOffset = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMins = String(absOffset % 60).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${sign}${offsetHours}:${offsetMins}`;
};

const roundUpRupiah = (value: number) => Math.ceil(Number(value || 0));

const getPeriodWindow = (
  period: PeriodType,
  range: { start: string; end: string },
  selectedMonth: number
) => {
  const now = new Date();
  let start: Date | null = null;
  let end: Date | null = null;

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
      const day = start.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      start.setDate(start.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "month": {
      start = new Date(now.getFullYear(), selectedMonth, 1);
      end = new Date(now.getFullYear(), selectedMonth + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "range": {
      if (range.start) {
        start = parseLocalDate(range.start);
        if (start) start.setHours(0, 0, 0, 0);
      }
      if (range.end) {
        end = parseLocalDate(range.end);
        if (end) end.setHours(23, 59, 59, 999);
      }
      break;
    }
  }

  return { start, end };
};

const AdminDashboard: React.FC = () => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentMonthStart = toYmd(new Date(now.getFullYear(), currentMonth, 1));
  const currentMonthEnd = toYmd(new Date(now.getFullYear(), currentMonth + 1, 0));

  const [loading, setLoading] = useState(true);
  const [cashierRevenueRows, setCashierRevenueRows] = useState<any[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<any[]>([]);
  const [expenseRows, setExpenseRows] = useState<any[]>([]);
  const [rentalRows, setRentalRows] = useState<any[]>([]);
  const [period, setPeriod] = useState<PeriodType>("today");
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [showCafeReportModal, setShowCafeReportModal] = useState(false);
  const [showDiscountReportModal, setShowDiscountReportModal] = useState(false);
  const [showRevenueReportModal, setShowRevenueReportModal] = useState(false);
  const [showProtectionLogModal, setShowProtectionLogModal] = useState(false);
  const [protectionLogCount, setProtectionLogCount] = useState(0);
  const [protectionLogs, setProtectionLogs] = useState<any[]>([]);
  const [isLoadingProtectionLogs, setIsLoadingProtectionLogs] = useState(false);
  const [protectionLogRefreshKey, setProtectionLogRefreshKey] = useState(0);
  const [revenueReportView, setRevenueReportView] = useState<
    "daftar" | "rekapKasir" | "rekapTanggal"
  >("daftar");
  const [expandedRevenueCashiers, setExpandedRevenueCashiers] = useState<
    Set<string>
  >(new Set());
  const [expandedRevenueTypeGroups, setExpandedRevenueTypeGroups] = useState<
    Set<string>
  >(new Set());
  const [showPurchaseReportModal, setShowPurchaseReportModal] = useState(false);
  const [purchaseReportView, setPurchaseReportView] = useState<
    "daftar" | "rekapTanggal" | "rekapBarang"
  >("daftar");
  const [showExpenseReportModal, setShowExpenseReportModal] = useState(false);
  const [showRentalReportModal, setShowRentalReportModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryRows, setInventoryRows] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [expandedExpenseCategories, setExpandedExpenseCategories] = useState<
    Set<string>
  >(new Set());
  const [expandedProtectionCashiers, setExpandedProtectionCashiers] = useState<
    Set<string>
  >(new Set());
  const [purchaseOrderItems, setPurchaseOrderItems] = useState<any[]>([]);
  const [supplierMap, setSupplierMap] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: currentMonthStart,
    end: currentMonthEnd,
  });

  const periodWindow = useMemo(
    () => getPeriodWindow(period, dateRange, selectedMonth),
    [period, dateRange.start, dateRange.end, selectedMonth]
  );

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);

      const { start, end } = periodWindow;
      const startIso = start ? toLocalIsoOffset(start) : undefined;
      const endIso = end ? toLocalIsoOffset(end) : undefined;
      const startDate = start ? toYmd(start) : null;
      const endDate = end ? toYmd(end) : null;

      try {
        let sessionQuery = supabase
          .from("cashier_sessions")
          .select("id, cashier_name, start_time")
          .order("start_time", { ascending: false });

        if (startIso) sessionQuery = sessionQuery.gte("start_time", startIso);
        if (endIso) sessionQuery = sessionQuery.lte("start_time", endIso);

        let purchaseQuery = supabase
          .from("purchase_orders")
          .select("id, po_number, supplier_id, total_amount, order_date, notes");

        if (startDate) purchaseQuery = purchaseQuery.gte("order_date", startDate);
        if (endDate) purchaseQuery = purchaseQuery.lte("order_date", endDate);
        purchaseQuery = purchaseQuery.order("order_date", { ascending: false });

        let expenseQuery = supabase
          .from("bookkeeping_entries")
          .select("id, amount, entry_date, type, category, description, reference, notes")
          .eq("type", "expense");

        if (startDate) expenseQuery = expenseQuery.gte("entry_date", startDate);
        if (endDate) expenseQuery = expenseQuery.lte("entry_date", endDate);

        let rentalQuery = supabase
          .from("cashier_transactions")
          .select("id, amount, timestamp, type, reference_id, details")
          .eq("type", "rental")
          .not("reference_id", "ilike", "MOVE_RENTAL-%");

        if (startIso) rentalQuery = rentalQuery.gte("timestamp", startIso);
        if (endIso) rentalQuery = rentalQuery.lte("timestamp", endIso);

        let protectionCountQuery = supabase
          .from("cashier_transactions")
          .select("id", { count: "exact", head: true })
          .ilike("description", "[PROTECTION]%");

        if (startIso) protectionCountQuery = protectionCountQuery.gte("timestamp", startIso);
        if (endIso) protectionCountQuery = protectionCountQuery.lte("timestamp", endIso);

        const [sessionRes, purchaseRes, expenseRes, rentalRes, protectionCountRes] = await Promise.all([
          sessionQuery,
          purchaseQuery,
          expenseQuery,
          rentalQuery,
          protectionCountQuery,
        ]);

        const sessionRows = (sessionRes.data || []) as Array<{
          id: string;
          cashier_name: string | null;
        }>;

        const sessionIdList = sessionRows
          .map((row) => String(row.id || ""))
          .filter((id) => Boolean(id));

        const cashierNameMap = new Map<string, string>();
        for (const session of sessionRows) {
          cashierNameMap.set(String(session.id), String(session.cashier_name || "Kasir"));
        }

        let revenueRows: any[] = [];
        if (sessionIdList.length > 0) {
          const chunkSize = 500;
          const revenueChunks: any[] = [];

          for (let i = 0; i < sessionIdList.length; i += chunkSize) {
            const chunkIds = sessionIdList.slice(i, i + chunkSize);
            const { data } = await supabase
              .from("cashier_transactions")
              .select(
                "id, amount, type, timestamp, reference_id, description, payment_method, cashier_id, session_id, details"
              )
              .not("cashier_id", "is", null)
              .in("session_id", chunkIds)
              .order("timestamp", { ascending: false });

            if (data?.length) revenueChunks.push(...data);
          }

          revenueRows = revenueChunks
            .map((row: any) => ({
              ...row,
              cashier_sessions: {
                cashier_name:
                  cashierNameMap.get(String(row?.session_id || "")) || "Kasir",
              },
            }))
            .sort(
              (a, b) =>
                new Date(b?.timestamp || 0).getTime() -
                new Date(a?.timestamp || 0).getTime()
            );
        }

        setCashierRevenueRows(revenueRows);
        setPurchaseRows(purchaseRes.data || []);
        setExpenseRows(expenseRes.data || []);
        setRentalRows(rentalRes.data || []);
        setProtectionLogCount(protectionCountRes.count ?? 0);
      } catch (error) {
        console.error("Error fetching admin dashboard data:", error);
        setCashierRevenueRows([]);
        setPurchaseRows([]);
        setExpenseRows([]);
        setRentalRows([]);
        setProtectionLogCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [periodWindow]);

  useEffect(() => {
    const fetchPurchaseDetailData = async () => {
      if (!showPurchaseReportModal) return;

      try {
        const poIds = purchaseRows
          .map((po: any) => po.id)
          .filter((id: string) => Boolean(id));

        if (poIds.length === 0) {
          setPurchaseOrderItems([]);
          setSupplierMap({});
          return;
        }

        const [itemRes, supplierRes] = await Promise.all([
          supabase
            .from("purchase_order_items")
            .select("id, po_id, product_id, product_name, quantity, unit_cost, total")
            .in("po_id", poIds),
          supabase.from("suppliers").select("id, name"),
        ]);

        setPurchaseOrderItems(itemRes.data || []);

        const map: Record<string, string> = {};
        for (const supplier of supplierRes.data || []) {
          map[String((supplier as any).id)] = String((supplier as any).name || "-");
        }
        setSupplierMap(map);
      } catch {
        setPurchaseOrderItems([]);
        setSupplierMap({});
      }
    };

    fetchPurchaseDetailData();
  }, [showPurchaseReportModal, purchaseRows]);

  useEffect(() => {
    const fetchInventoryData = async () => {
      setInventoryLoading(true);
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, category, stock, min_stock, unit, cost, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) throw error;
        setInventoryRows(data || []);
      } catch (error) {
        console.error("Error fetching inventory data:", error);
        setInventoryRows([]);
      } finally {
        setInventoryLoading(false);
      }
    };

    fetchInventoryData();
  }, []);

  useEffect(() => {
    const fetchProtectionLogDetails = async () => {
      if (!showProtectionLogModal) return;

      setIsLoadingProtectionLogs(true);
      const { start, end } = periodWindow;
      const startIso = start ? toLocalIsoOffset(start) : undefined;
      const endIso = end ? toLocalIsoOffset(end) : undefined;

      try {
        let query = supabase
          .from("cashier_transactions")
          .select(
            "id, timestamp, description, details, cashier_id, cashier_sessions(cashier_name)"
          )
          .ilike("description", "[PROTECTION]%")
          .order("timestamp", { ascending: false });

        if (startIso) query = query.gte("timestamp", startIso);
        if (endIso) query = query.lte("timestamp", endIso);

        const { data, error } = await query;
        if (error) throw error;

        const logs = data || [];

        const enableLogs = logs.filter((log: any) => {
          const action = log.details?.action;
          return (
            action === "enable_auto_shutdown" || action === "enable_all_auto_shutdown"
          );
        });

        let candidateDisables: any[] = logs.filter((log: any) => {
          const action = log.details?.action;
          return (
            action === "disable_auto_shutdown" || action === "disable_all_auto_shutdown"
          );
        });

        if (enableLogs.length > 0) {
          const maxTimestamp = new Date(
            Math.max(...enableLogs.map((l: any) => new Date(l.timestamp).getTime()))
          ).toISOString();

          const { data: previousDisables } = await supabase
            .from("cashier_transactions")
            .select("id, timestamp, details")
            .ilike("description", "[PROTECTION]%")
            .in("details->>action", ["disable_auto_shutdown", "disable_all_auto_shutdown"])
            .lte("timestamp", maxTimestamp)
            .order("timestamp", { ascending: false })
            .limit(200);

          if (previousDisables) {
            const existingIds = new Set(candidateDisables.map((log: any) => log.id));
            const newDisables = previousDisables.filter(
              (log: any) => !existingIds.has(log.id)
            );
            candidateDisables = [...candidateDisables, ...newDisables].sort(
              (a: any, b: any) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          }
        }

        const logsWithDuration = logs.map((log: any) => {
          const action = log.details?.action;
          if (
            action === "enable_auto_shutdown" ||
            action === "enable_all_auto_shutdown"
          ) {
            const consoleId = log.details?.console_id;
            const logTimestamp = new Date(log.timestamp).getTime();

            const pairData = candidateDisables.find((disableLog: any) => {
              const disableTimestamp = new Date(disableLog.timestamp).getTime();
              if (disableTimestamp >= logTimestamp) return false;
              const disableAction = disableLog.details?.action;
              if (action === "enable_auto_shutdown" && consoleId) {
                return (
                  (disableAction === "disable_auto_shutdown" &&
                    disableLog.details?.console_id === consoleId) ||
                  disableAction === "disable_all_auto_shutdown"
                );
              }
              return disableAction === "disable_all_auto_shutdown";
            });

            if (pairData) {
              const pairStart = new Date(pairData.timestamp).getTime();
              return { ...log, duration: logTimestamp - pairStart };
            }
          }
          return log;
        });

        setProtectionLogs(logsWithDuration);
      } catch (err) {
        console.error("Error fetching protection log details:", err);
        setProtectionLogs([]);
      } finally {
        setIsLoadingProtectionLogs(false);
      }
    };

    fetchProtectionLogDetails();
  }, [showProtectionLogModal, periodWindow, protectionLogRefreshKey]);

  const revenueSummaryRows = useMemo(
    () =>
      cashierRevenueRows.filter(
        (row: any) =>
          row?.type === "sale" ||
          row?.type === "rental" ||
          row?.type === "voucher"
      ),
    [cashierRevenueRows]
  );

  const pendapatanRows = useMemo(
    () =>
      cashierRevenueRows.filter(
        (row: any) =>
          row?.type === "rental" ||
          row?.type === "voucher" ||
          row?.type === "sale"
      ),
    [cashierRevenueRows]
  );

  const getCashierDisplayName = (row: any) =>
    row?.cashier_sessions?.cashier_name || "Kasir";

  const totalRevenue = useMemo(
    () =>
      pendapatanRows.reduce(
        (sum: number, row: any) => sum + Number(row?.amount || 0),
        0
      ),
    [pendapatanRows]
  );

  const rentalRevenue = useMemo(
    () =>
      revenueSummaryRows
        .filter((row: any) => row?.type === "rental")
        .reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0),
    [revenueSummaryRows]
  );

  const cafeRevenue = useMemo(
    () =>
      revenueSummaryRows
        .filter((row: any) => row?.type === "sale")
        .reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0),
    [revenueSummaryRows]
  );

  const voucherRevenue = useMemo(
    () =>
      revenueSummaryRows
        .filter((row: any) => row?.type === "voucher")
        .reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0),
    [revenueSummaryRows]
  );

  const totalPersediaan = useMemo(
    () =>
      inventoryRows.reduce(
        (sum: number, row: any) => sum + Number(row?.stock || 0),
        0
      ),
    [inventoryRows]
  );

  const totalNilaiAset = useMemo(
    () =>
      inventoryRows.reduce((sum: number, row: any) => {
        const stock = Number(row?.stock || 0);
        const cost = Number(row?.cost || 0);
        return sum + stock * cost;
      }, 0),
    [inventoryRows]
  );

  const lowStockCount = useMemo(
    () =>
      inventoryRows.filter((row: any) => {
        const stock = Number(row?.stock || 0);
        const minStock = Number(row?.min_stock || 0);
        return minStock > 0 && stock <= minStock;
      }).length,
    [inventoryRows]
  );

  const totalPembelian = useMemo(
    () =>
      purchaseRows.reduce(
        (sum: number, row: any) => sum + Number(row?.total_amount || 0),
        0
      ),
    [purchaseRows]
  );

  const totalPengeluaran = useMemo(
    () =>
      expenseRows.reduce(
        (sum: number, row: any) => sum + Number(row?.amount || 0),
        0
      ),
    [expenseRows]
  );

  const expenseRowsSorted = useMemo(
    () =>
      [...expenseRows].sort((a: any, b: any) => {
        const dateA = String(a?.entry_date || "");
        const dateB = String(b?.entry_date || "");
        if (dateA === dateB) return 0;
        return dateA < dateB ? 1 : -1;
      }),
    [expenseRows]
  );

  const expenseByCategory = useMemo(() => {
    const map: Record<
      string,
      { category: string; total: number; count: number; rows: any[] }
    > = {};

    for (const row of expenseRowsSorted) {
      const category = String(row?.category || "Tanpa Kategori");
      if (!map[category]) {
        map[category] = {
          category,
          total: 0,
          count: 0,
          rows: [],
        };
      }

      map[category].rows.push(row);
      map[category].total += Number(row?.amount || 0);
      map[category].count += 1;
    }

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [expenseRowsSorted]);

  const rentalJamPerGroup = useMemo(() => {
    const getRentalConsoleName = (tx: any): string =>
      tx?.details?.rental?.console ||
      tx?.details?.items?.[0]?.name ||
      tx?.details?.items?.[0]?.product_name ||
      "Unknown Console";

    const getRentalDurationMinutes = (tx: any): number =>
      tx?.details?.rental?.duration_minutes ||
      tx?.details?.duration_minutes ||
      tx?.details?.additional_duration_minutes ||
      0;

    const getConsoleTypeLabel = (tx: any): string => {
      const rawType =
        tx?.details?.rental?.console_type ||
        tx?.details?.console_type ||
        tx?.details?.rental?.consoleType ||
        tx?.details?.consoleType ||
        tx?.details?.rental?.type ||
        "";
      const normalizedRaw = String(rawType).toLowerCase();

      if (normalizedRaw.includes("ps5")) return "PS5";
      if (normalizedRaw.includes("ps4")) return "PS4";
      if (normalizedRaw.includes("ps3")) return "PS3";
      if (normalizedRaw.includes("xbox")) return "XBOX";
      if (normalizedRaw.includes("nintendo") || normalizedRaw.includes("switch")) return "NINTENDO";

      const consoleName = getRentalConsoleName(tx).toLowerCase();
      if (consoleName.includes("ps5")) return "PS5";
      if (consoleName.includes("ps4")) return "PS4";
      if (consoleName.includes("ps3")) return "PS3";
      if (consoleName.includes("xbox")) return "XBOX";
      if (consoleName.includes("nintendo") || consoleName.includes("switch")) return "NINTENDO";
      if (consoleName.includes("vip")) return "VIP";

      return "Lainnya";
    };

    const groupMap = new Map<
      string,
      {
        groupName: string;
        hours: number;
        estimatedTotal: number;
        estimatedProfit: number;
        totalCapitalAmount: number;
      }
    >();

    for (const row of rentalRows) {
      const groupName = getConsoleTypeLabel(row);
      const durationMinutes = getRentalDurationMinutes(row);
      const hours = durationMinutes / 60;
      const revenue = Number(row?.amount || 0);
      const itemProfit = (row?.details?.items || []).reduce(
        (s: number, it: any) => s + (Number(it?.profit) || 0),
        0
      );
      const capital = revenue - itemProfit;

      const prev = groupMap.get(groupName) || {
        groupName,
        hours: 0,
        estimatedTotal: 0,
        estimatedProfit: 0,
        totalCapitalAmount: 0,
      };

      prev.hours += hours;
      prev.estimatedTotal += revenue;
      prev.estimatedProfit += itemProfit;
      prev.totalCapitalAmount += capital;

      groupMap.set(groupName, prev);
    }

    return Array.from(groupMap.values())
      .map((value) => ({
        ...value,
        avgHourlyRate: value.hours > 0 ? value.estimatedTotal / value.hours : 0,
        avgCapitalRate: value.hours > 0 ? value.totalCapitalAmount / value.hours : 0,
      }))
      .filter((row) => row.hours > 0 || row.estimatedTotal > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [rentalRows]);

  const totalRentalHours = useMemo(
    () => rentalJamPerGroup.reduce((sum, row) => sum + row.hours, 0),
    [rentalJamPerGroup]
  );

  const cafeDetailRows = useMemo(() => {
    const rows: Array<{
      id: string;
      timestamp: string;
      cashierName: string;
      referenceId: string;
      productName: string;
      quantity: number;
      sellingPrice: number;
      costPrice: number;
      omzet: number;
      modal: number;
      profit: number;
    }> = [];

    for (const row of cashierRevenueRows) {
      if (row?.type !== "sale") continue;

      let details = row?.details;
      if (typeof details === "string") {
        try {
          details = JSON.parse(details);
        } catch {
          details = null;
        }
      }

      const itemsList: any[] = Array.isArray(details)
        ? details
        : Array.isArray(details?.items)
        ? details.items
        : [];

      itemsList.forEach((item, index) => {
        if (item?.type === "rental") return;

        const quantity = Number(item?.quantity ?? 1);
        const omzet = Number(item?.total ?? Number(item?.price ?? 0) * quantity);
        const sellingPrice = Number(
          item?.price ?? (quantity > 0 ? omzet / quantity : 0)
        );
        const costPrice = Number(item?.cost ?? 0);
        const modal = costPrice * quantity;
        const profit = Number(item?.profit ?? omzet - modal);

        rows.push({
          id: `${String(row?.id || row?.reference_id || "sale")}-${index}`,
          timestamp: String(row?.timestamp || ""),
          cashierName: getCashierDisplayName(row),
          referenceId: String(row?.reference_id || row?.id || "-"),
          productName: String(
            item?.name || item?.product_name || item?.productName || "Produk"
          ),
          quantity,
          sellingPrice,
          costPrice,
          omzet,
          modal,
          profit,
        });
      });
    }

    return rows.sort(
      (a, b) =>
        new Date(b.timestamp || 0).getTime() -
        new Date(a.timestamp || 0).getTime()
    );
  }, [cashierRevenueRows]);

  const cafeModalTotal = useMemo(
    () => cafeDetailRows.reduce((sum, row) => sum + row.modal, 0),
    [cafeDetailRows]
  );

  const cafeKeuntungan = useMemo(
    () => cafeDetailRows.reduce((sum, row) => sum + row.profit, 0),
    [cafeDetailRows]
  );

  const cafeDetailOmzet = useMemo(
    () => cafeDetailRows.reduce((sum, row) => sum + row.omzet, 0),
    [cafeDetailRows]
  );

  const cafeTransactionCount = useMemo(
    () => new Set(cafeDetailRows.map((row) => row.referenceId)).size,
    [cafeDetailRows]
  );

  const cafeUnexplainedRevenue = useMemo(
    () => Math.max(0, cafeRevenue - cafeDetailOmzet),
    [cafeRevenue, cafeDetailOmzet]
  );

  const discountHistoryRows = useMemo(() => {
    const rows: Array<{
      id: string;
      timestamp: string;
      cashierName: string;
      referenceId: string;
      type: string;
      reason: string;
      discountType: string;
      discountValue: number;
      discountAmount: number;
      finalAmount: number;
      subtotalAmount: number;
    }> = [];

    for (const row of cashierRevenueRows) {
      let details = row?.details;
      if (typeof details === "string") {
        try {
          details = JSON.parse(details);
        } catch {
          details = null;
        }
      }

      const discountAmount = Number(details?.discount?.amount || 0);
      if (discountAmount <= 0) continue;

      const finalAmount = Number(row?.amount || 0);
      rows.push({
        id: String(row?.id || `${row?.reference_id || "discount"}-${rows.length}`),
        timestamp: String(row?.timestamp || ""),
        cashierName: getCashierDisplayName(row),
        referenceId: String(row?.reference_id || row?.id || "-"),
        type: String(row?.type || "other"),
        reason: String(details?.discount?.reason || row?.description || "-"),
        discountType: String(details?.discount?.type || "amount"),
        discountValue: Number(details?.discount?.value || 0),
        discountAmount,
        finalAmount,
        subtotalAmount: finalAmount + discountAmount,
      });
    }

    return rows.sort(
      (a, b) =>
        new Date(b.timestamp || 0).getTime() -
        new Date(a.timestamp || 0).getTime()
    );
  }, [cashierRevenueRows]);

  const totalDiscountAmount = useMemo(
    () => discountHistoryRows.reduce((sum, row) => sum + row.discountAmount, 0),
    [discountHistoryRows]
  );

  const averageDiscountAmount = useMemo(
    () =>
      discountHistoryRows.length > 0
        ? totalDiscountAmount / discountHistoryRows.length
        : 0,
    [discountHistoryRows, totalDiscountAmount]
  );

  const revenueDetailRows = useMemo(() => {
    return pendapatanRows
      .map((row: any) => ({
        id: String(row?.id || ""),
        timestamp: row?.timestamp || "",
        cashierName: getCashierDisplayName(row),
        type: String(row?.type || "-"),
        amount: Number(row?.amount || 0),
        referenceId: row?.reference_id || "-",
        description: row?.description || "-",
        paymentMethod: row?.payment_method || "cash",
      }))
      .sort(
        (a, b) =>
          new Date(b.timestamp || 0).getTime() -
          new Date(a.timestamp || 0).getTime()
      );
  }, [pendapatanRows]);

  const revenueRekapKasir = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();

    for (const row of revenueDetailRows) {
      const prev = map.get(row.cashierName) || { total: 0, count: 0 };
      map.set(row.cashierName, {
        total: prev.total + row.amount,
        count: prev.count + 1,
      });
    }

    return Array.from(map.entries())
      .map(([cashierName, value]) => ({
        cashierName,
        total: value.total,
        count: value.count,
      }))
      .sort((a, b) => b.total - a.total);
  }, [revenueDetailRows]);

  const revenueDetailByCashier = useMemo(() => {
    const map: Record<
      string,
      {
        cashierName: string;
        total: number;
        count: number;
        rows: any[];
        typeGroups: Record<string, { rows: any[]; total: number; count: number }>;
      }
    > = {};

    for (const row of revenueDetailRows) {
      const key = row.cashierName || "Kasir";
      if (!map[key]) {
        map[key] = {
          cashierName: key,
          total: 0,
          count: 0,
          rows: [],
          typeGroups: {},
        };
      }
      const typeKey = String(row.type || "other");
      if (!map[key].typeGroups[typeKey]) {
        map[key].typeGroups[typeKey] = { rows: [], total: 0, count: 0 };
      }
      map[key].rows.push(row);
      map[key].total += Number(row.amount || 0);
      map[key].count += 1;
      map[key].typeGroups[typeKey].rows.push(row);
      map[key].typeGroups[typeKey].total += Number(row.amount || 0);
      map[key].typeGroups[typeKey].count += 1;
    }

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [revenueDetailRows]);

  const getRevenueTypeLabel = (type: string) => {
    if (type === "sale") return "Cafe";
    if (type === "rental") return "Rental";
    if (type === "voucher") return "Voucher";
    return type;
  };

  const getTypeGroupOrder = (type: string) => {
    if (type === "rental") return 1;
    if (type === "sale") return 2;
    if (type === "voucher") return 3;
    return 99;
  };

  const revenueRekapTanggal = useMemo(() => {
    const map: Record<
      string,
      { total: number; count: number; cashiers: Record<string, number> }
    > = {};

    for (const row of revenueDetailRows) {
      const dateKey = row.timestamp
        ? new Date(row.timestamp).toISOString().slice(0, 10)
        : "unknown";

      if (!map[dateKey]) {
        map[dateKey] = { total: 0, count: 0, cashiers: {} };
      }

      map[dateKey].total += row.amount;
      map[dateKey].count += 1;
      map[dateKey].cashiers[row.cashierName] =
        (map[dateKey].cashiers[row.cashierName] || 0) + row.amount;
    }

    return map;
  }, [revenueDetailRows]);

  const purchaseRekapTanggal = useMemo(() => {
    const map: Record<string, any> = {};

    for (const po of purchaseRows) {
      const dateKey = po?.order_date ? String(po.order_date).slice(0, 10) : "unknown";
      if (!map[dateKey]) map[dateKey] = { dateTotal: 0, products: {} };

      const poItems = purchaseOrderItems.filter(
        (it: any) => String(it.po_id) === String(po.id)
      );

      for (const it of poItems) {
        const key = String(it.product_id || it.product_name || "unknown");
        if (!map[dateKey].products[key]) {
          map[dateKey].products[key] = {
            name: it.product_name || "Unknown",
            qty: 0,
            total: 0,
          };
        }
        map[dateKey].products[key].qty += Number(it.quantity || 0);
        map[dateKey].products[key].total += Number(it.total || 0);
      }

      map[dateKey].dateTotal += Number(po.total_amount || 0);
    }

    return map;
  }, [purchaseRows, purchaseOrderItems]);

  const purchaseRekapBarang = useMemo(() => {
    const map: Record<string, any> = {};

    for (const po of purchaseRows) {
      const dateKey = po?.order_date ? String(po.order_date).slice(0, 10) : "unknown";
      const poItems = purchaseOrderItems.filter(
        (it: any) => String(it.po_id) === String(po.id)
      );

      for (const it of poItems) {
        const key = String(it.product_id || it.product_name || "unknown");
        if (!map[key]) {
          map[key] = {
            name: it.product_name || "Unknown",
            qty: 0,
            total: 0,
            dates: {},
          };
        }

        const qty = Number(it.quantity || 0);
        const total = Number(it.total || 0);
        map[key].qty += qty;
        map[key].total += total;

        if (!map[key].dates[dateKey]) {
          map[key].dates[dateKey] = { qty: 0, total: 0 };
        }
        map[key].dates[dateKey].qty += qty;
        map[key].dates[dateKey].total += total;
      }
    }

    return map;
  }, [purchaseRows, purchaseOrderItems]);

  const protectionLogsByCashier = useMemo(() => {
    const map: Record<
      string,
      { cashierName: string; count: number; enable: number; disable: number; logs: any[] }
    > = {};

    for (const log of protectionLogs) {
      const cashierName =
        log.cashier_sessions?.cashier_name || "System";
      if (!map[cashierName]) {
        map[cashierName] = { cashierName, count: 0, enable: 0, disable: 0, logs: [] };
      }
      const action = log.details?.action;
      if (action === "enable_auto_shutdown" || action === "enable_all_auto_shutdown") {
        map[cashierName].enable += 1;
      } else if (
        action === "disable_auto_shutdown" ||
        action === "disable_all_auto_shutdown"
      ) {
        map[cashierName].disable += 1;
      }
      map[cashierName].count += 1;
      map[cashierName].logs.push(log);
    }

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [protectionLogs]);

  const activePeriodLabel = useMemo(() => {
    const { start, end } = periodWindow;

    if (period === "range") {
      if (dateRange.start && dateRange.end) {
        return `Periode aktif: ${formatDateId(dateRange.start)} s/d ${formatDateId(dateRange.end)}`;
      }
      if (dateRange.start) {
        return `Periode aktif: mulai ${formatDateId(dateRange.start)}`;
      }
      if (dateRange.end) {
        return `Periode aktif: sampai ${formatDateId(dateRange.end)}`;
      }
      return "Periode aktif: Rentang Waktu (belum lengkap)";
    }

    if (period === "today") {
      return `Periode aktif: Hari Ini (${formatDateId(toYmd(new Date()))})`;
    }

    if (period === "yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return `Periode aktif: Kemarin (${formatDateId(toYmd(y))})`;
    }

    if (period === "week") {
      if (start && end) {
        return `Periode aktif: Minggu Ini (${formatDateId(toYmd(start))} s/d ${formatDateId(toYmd(end))})`;
      }
      return "Periode aktif: Minggu Ini";
    }

    if (period === "month") {
      return `Periode aktif: Bulan ${MONTH_NAMES_ID[selectedMonth]} ${new Date().getFullYear()}`;
    }

    return "Periode aktif";
  }, [period, dateRange.start, dateRange.end, selectedMonth, periodWindow]);

  const periodButtons: Array<{
    value: PeriodType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { value: "today", label: "Hari Ini", icon: CalendarDays },
    { value: "yesterday", label: "Kemarin", icon: CalendarCheck2 },
    { value: "week", label: "Minggu Ini", icon: CalendarClock },
    { value: "month", label: "Bulan", icon: CalendarDays },
    { value: "range", label: "Rentang Waktu", icon: CalendarRange },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Dashboard Administrator
        </h1>
        <p className="text-gray-600">
          Ringkasan operasional dengan filter periode untuk keputusan yang lebih
          cepat.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {periodButtons.map((item) => {
            const Icon = item.icon;
            const active = period === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white shadow"
                    : "border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          <CalendarDays className="h-3.5 w-3.5" />
          {activePeriodLabel}
        </div>

        {period === "month" && (
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Pilih Bulan
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {MONTH_NAMES_ID.map((monthName, idx) => (
                  <option key={monthName} value={idx}>
                    {monthName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {period === "range" && (
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Dari
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Sampai
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Pendapatan</h2>
          <div className="text-2xl font-bold text-gray-900 mb-3">
            Rp {totalRevenue.toLocaleString("id-ID")}
          </div>
          <button
            type="button"
            onClick={() => setShowRevenueReportModal(true)}
            title="Lihat detail pendapatan kasir"
            className="w-full rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 transition hover:bg-green-100"
          >
            Lihat Detail →
          </button>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5 text-blue-700">
              <div className="font-medium">Rental</div>
              <div className="text-sm font-semibold">
                Rp {rentalRevenue.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-emerald-700">
              <div className="font-medium">Cafe</div>
              <div className="text-sm font-semibold">
                Rp {cafeRevenue.toLocaleString("id-ID")}
              </div>
            </div>
            {voucherRevenue > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5 text-amber-700">
                <div className="font-medium">Voucher</div>
                <div className="text-sm font-semibold">
                  Rp {voucherRevenue.toLocaleString("id-ID")}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Total Pembelian</h2>
          <div className="text-2xl font-bold text-gray-900 mb-3">
            Rp {totalPembelian.toLocaleString("id-ID")}
          </div>
          <button
            type="button"
            onClick={() => setShowPurchaseReportModal(true)}
            title="Lihat laporan pembelian"
            className="w-full rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 transition hover:bg-blue-100"
          >
            Lihat Detail →
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <TrendingDown className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Total Pengeluaran</h2>
          <div className="text-2xl font-bold text-gray-900 mb-3">
            Rp {totalPengeluaran.toLocaleString("id-ID")}
          </div>
          <button
            type="button"
            onClick={() => setShowExpenseReportModal(true)}
            title="Lihat detail pengeluaran"
            className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 transition hover:bg-red-100"
          >
            Lihat Detail →
          </button>
          <div className="mt-3 space-y-2 text-xs">
            {expenseByCategory.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-500">
                Belum ada pengeluaran.
              </div>
            ) : (
              expenseByCategory.map((group) => (
                <div
                  key={`expense-summary-${group.category}`}
                  className="rounded-lg border border-red-100 bg-red-50 px-2 py-1.5 text-red-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{group.category}</span>
                    <span className="text-[11px] text-red-600">{group.count} trx</span>
                  </div>
                  <div className="text-sm font-semibold">
                    Rp {group.total.toLocaleString("id-ID")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock3 className="h-6 w-6 text-purple-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Total Rental Jam</h2>
          <div className="text-2xl font-bold text-gray-900 mb-3">
            {totalRentalHours.toLocaleString("id-ID", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{" "}
            jam
          </div>
          <button
            type="button"
            onClick={() => setShowRentalReportModal(true)}
            title="Lihat detail total rental jam"
            className="w-full rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-700 transition hover:bg-purple-100"
          >
            Lihat Detail →
          </button>
        </div>

        <div className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Package className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Persediaan</h2>
          <div className="text-2xl font-bold text-gray-900 mb-3">
            Rp {roundUpRupiah(totalNilaiAset).toLocaleString("id-ID")}
          </div>
          <button
            type="button"
            onClick={() => setShowInventoryModal(true)}
            title="Lihat detail persediaan"
            className="w-full rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 transition hover:bg-amber-100"
          >
            Lihat Detail →
          </button>
          <div className="mt-3 space-y-2 text-xs">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-700">
              <div className="font-medium">Total Persediaan</div>
              <div className="text-sm font-semibold">
                {totalPersediaan.toLocaleString("id-ID")} unit
              </div>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5 text-amber-700">
              <div className="font-medium">Produk Aktif</div>
              <div className="text-sm font-semibold">{inventoryRows.length} produk</div>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50 px-2 py-1.5 text-rose-700">
              <div className="font-medium">Stok Menipis</div>
              <div className="text-sm font-semibold">{lowStockCount} produk</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-white p-6 shadow-sm text-center">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Protection Log</h2>
          <div className="text-2xl font-bold text-gray-900 mb-3">
            {protectionLogCount.toLocaleString("id-ID")}
            <span className="ml-1 text-base font-normal text-gray-500">event</span>
          </div>
          <button
            type="button"
            onClick={() => setShowProtectionLogModal(true)}
            className="w-full rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700 transition hover:bg-indigo-100"
          >
            Lihat Detail →
          </button>
          <div className="mt-3 text-xs">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1.5 text-indigo-700">
              <div className="text-[11px] text-indigo-600">
                Log aktivasi/nonaktivasi proteksi konsol
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Performa Cafe</h2>
            <button
              type="button"
              onClick={() => setShowCafeReportModal(true)}
              title="Lihat detail perhitungan keuntungan cafe"
              className="rounded-lg bg-orange-100 p-2 text-orange-700 transition hover:bg-orange-200"
            >
              <ShoppingCart className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Memuat data cafe...</div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-blue-700">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide">Total Omzet Cafe</div>
                  <div className="text-[11px] text-blue-500 mt-1">Total pendapatan penjualan cafe</div>
                </div>
                <div className="text-lg font-bold text-right">
                  Rp {roundUpRupiah(cafeRevenue).toLocaleString("id-ID")}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-rose-700">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide">Total Modal Cafe</div>
                  <div className="text-[11px] text-rose-500 mt-1">Harga pokok barang terjual (HPP)</div>
                </div>
                <div className="text-lg font-bold text-right">
                  Rp {roundUpRupiah(cafeModalTotal).toLocaleString("id-ID")}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-emerald-700">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide">Keuntungan Cafe</div>
                  <div className="text-[11px] text-emerald-500 mt-1">Omzet dikurangi HPP</div>
                </div>
                <div className="text-lg font-bold text-right">
                  Rp {roundUpRupiah(cafeKeuntungan).toLocaleString("id-ID")}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">History Discount</h2>
            <button
              type="button"
              onClick={() => setShowDiscountReportModal(true)}
              title="Lihat detail history discount"
              className="rounded-lg bg-amber-100 p-2 text-amber-700 transition hover:bg-amber-200"
            >
              <Ticket className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Memuat data discount...</div>
          ) : discountHistoryRows.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              Belum ada transaksi dengan discount pada periode ini.
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-purple-700">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide">Total Transaksi</div>
                  <div className="text-[11px] text-purple-500 mt-1">Jumlah transaksi yang memakai discount</div>
                </div>
                <div className="text-lg font-bold text-right">
                  {discountHistoryRows.length.toLocaleString("id-ID")} trx
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-rose-700">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide">Total Discount</div>
                  <div className="text-[11px] text-rose-500 mt-1">Akumulasi discount pada periode aktif</div>
                </div>
                <div className="text-lg font-bold text-right">
                  Rp {roundUpRupiah(totalDiscountAmount).toLocaleString("id-ID")}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-blue-700">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide">Rata-rata Discount</div>
                  <div className="text-[11px] text-blue-500 mt-1">Rata-rata nominal discount per transaksi</div>
                </div>
                <div className="text-lg font-bold text-right">
                  Rp {roundUpRupiah(averageDiscountAmount).toLocaleString("id-ID")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCafeReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Detail Keuntungan Cafe</h3>
                <p className="text-sm text-gray-500">
                  Sumber keuntungan: (harga jual - harga modal) x qty untuk setiap item cafe
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCafeReportModal(false)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-gray-100 bg-gray-50 px-6 py-3">
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700">
                  <div className="text-xs font-medium">Omzet Terjelaskan</div>
                  <div className="font-semibold">
                    Rp {roundUpRupiah(cafeDetailOmzet).toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-rose-700">
                  <div className="text-xs font-medium">Total Modal</div>
                  <div className="font-semibold">
                    Rp {roundUpRupiah(cafeModalTotal).toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-700">
                  <div className="text-xs font-medium">Total Keuntungan</div>
                  <div className="font-semibold">
                    Rp {roundUpRupiah(cafeKeuntungan).toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-700">
                  <div className="text-xs font-medium">Transaksi / Item</div>
                  <div className="font-semibold">
                    {cafeTransactionCount} trx / {cafeDetailRows.length} item
                  </div>
                </div>
              </div>
              {cafeUnexplainedRevenue > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Ada selisih omzet Rp {roundUpRupiah(cafeUnexplainedRevenue).toLocaleString("id-ID")} dari transaksi cafe yang tidak punya detail item lengkap.
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {cafeDetailRows.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
                  Belum ada detail item cafe pada periode ini.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Waktu</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Kasir</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Ref</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Qty</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga Jual</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga Modal</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Omzet</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Keuntungan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {cafeDetailRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                            {row.timestamp
                              ? new Date(row.timestamp).toLocaleString("id-ID")
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-gray-700">{row.cashierName}</td>
                          <td className="px-4 py-2 text-gray-600">{row.referenceId}</td>
                          <td className="px-4 py-2 font-medium text-gray-900">{row.productName}</td>
                          <td className="px-4 py-2 text-right text-gray-700">
                            {row.quantity.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-700">
                            Rp {roundUpRupiah(row.sellingPrice).toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-2 text-right text-rose-700">
                            Rp {roundUpRupiah(row.costPrice).toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-blue-700">
                            Rp {roundUpRupiah(row.omzet).toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-emerald-700">
                            Rp {roundUpRupiah(row.profit).toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={7} className="px-4 py-3 text-right font-semibold text-gray-700">
                          Grand Total
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-800">
                          Rp {roundUpRupiah(cafeDetailOmzet).toLocaleString("id-ID")}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-800">
                          Rp {roundUpRupiah(cafeKeuntungan).toLocaleString("id-ID")}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDiscountReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Detail History Discount</h3>
                <p className="text-sm text-gray-500">
                  {activePeriodLabel.replace("Periode aktif: ", "")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDiscountReportModal(false)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-gray-100 bg-gray-50 px-6 py-3">
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                <div className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2 text-purple-700">
                  <div className="text-xs font-medium">Total Transaksi</div>
                  <div className="font-semibold">{discountHistoryRows.length} trx</div>
                </div>
                <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-rose-700">
                  <div className="text-xs font-medium">Total Discount</div>
                  <div className="font-semibold">
                    Rp {roundUpRupiah(totalDiscountAmount).toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700">
                  <div className="text-xs font-medium">Rata-rata</div>
                  <div className="font-semibold">
                    Rp {roundUpRupiah(averageDiscountAmount).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {discountHistoryRows.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
                  Belum ada transaksi discount pada periode ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {discountHistoryRows.map((row) => (
                    <div key={row.id} className="rounded-xl border border-gray-200 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-gray-900">
                            {getRevenueTypeLabel(row.type)}
                          </div>
                          <div className="text-sm text-sky-700">{row.referenceId}</div>
                          <div className="text-sm text-gray-600">{row.reason}</div>
                          <div className="mt-1 text-xs text-gray-500">Kasir: {row.cashierName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">
                            {row.timestamp
                              ? new Date(row.timestamp).toLocaleString("id-ID")
                              : "-"}
                          </div>
                          <div className="mt-1 text-lg font-bold text-rose-700">
                            - Rp {roundUpRupiah(row.discountAmount).toLocaleString("id-ID")}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            Subtotal: Rp {roundUpRupiah(row.subtotalAmount).toLocaleString("id-ID")}
                          </div>
                          <div className="text-xs text-gray-500">
                            Total: Rp {roundUpRupiah(row.finalAmount).toLocaleString("id-ID")}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPurchaseReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Laporan Pembelian</h3>
                <p className="text-sm text-gray-500">{activePeriodLabel.replace("Periode aktif: ", "")}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPurchaseReportModal(false)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-gray-100 px-6 py-3">
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setPurchaseReportView("daftar")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    purchaseReportView === "daftar"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-white"
                  }`}
                >
                  Daftar
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseReportView("rekapTanggal")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    purchaseReportView === "rekapTanggal"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-white"
                  }`}
                >
                  Rekap Tanggal
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseReportView("rekapBarang")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    purchaseReportView === "rekapBarang"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-white"
                  }`}
                >
                  Rekap Barang
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {purchaseReportView === "daftar" && (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">PO #</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Supplier</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {purchaseRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                            Tidak ada data pembelian pada periode ini.
                          </td>
                        </tr>
                      ) : (
                        purchaseRows.map((po: any) => (
                          <tr key={po.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-blue-700">{po.po_number || po.id}</td>
                            <td className="px-4 py-2">{po.order_date ? formatDateId(String(po.order_date).slice(0, 10)) : "-"}</td>
                            <td className="px-4 py-2">{supplierMap[String(po.supplier_id)] || "-"}</td>
                            <td className="px-4 py-2 text-right font-semibold">Rp {Number(po.total_amount || 0).toLocaleString("id-ID")}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {purchaseReportView === "rekapTanggal" && (
                <div className="space-y-3">
                  {Object.keys(purchaseRekapTanggal).length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
                      Tidak ada data rekap per tanggal.
                    </div>
                  ) : (
                    Object.entries(purchaseRekapTanggal)
                      .sort(([a], [b]) => (a < b ? 1 : -1))
                      .map(([date, data]: [string, any]) => (
                        <div key={date} className="rounded-xl border border-gray-200 bg-white p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{date === "unknown" ? "Unknown" : formatDateId(date)}</p>
                              <p className="text-xs text-gray-500">{Object.keys(data.products || {}).length} produk</p>
                            </div>
                            <p className="font-bold text-blue-700">Rp {Number(data.dateTotal || 0).toLocaleString("id-ID")}</p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="border-b text-gray-500">
                                <tr>
                                  <th className="py-1 text-left">Produk</th>
                                  <th className="py-1 text-right">Qty</th>
                                  <th className="py-1 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(data.products || {}).map(([key, p]: [string, any]) => (
                                  <tr key={key} className="border-b border-gray-100">
                                    <td className="py-1.5">{p.name}</td>
                                    <td className="py-1.5 text-right">{Number(p.qty || 0).toLocaleString("id-ID")}</td>
                                    <td className="py-1.5 text-right font-medium">Rp {Number(p.total || 0).toLocaleString("id-ID")}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}

              {purchaseReportView === "rekapBarang" && (
                <div className="space-y-3">
                  {Object.keys(purchaseRekapBarang).length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
                      Tidak ada data rekap per barang.
                    </div>
                  ) : (
                    Object.entries(purchaseRekapBarang)
                      .sort(([, a]: any, [, b]: any) => Number(b.total || 0) - Number(a.total || 0))
                      .map(([key, p]: [string, any]) => (
                        <div key={key} className="rounded-xl border border-gray-200 bg-white p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{p.name}</p>
                              <p className="text-xs text-gray-500">{Object.keys(p.dates || {}).length} tanggal</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-blue-700">Rp {Number(p.total || 0).toLocaleString("id-ID")}</p>
                              <p className="text-xs text-gray-500">Qty {Number(p.qty || 0).toLocaleString("id-ID")}</p>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="border-b text-gray-500">
                                <tr>
                                  <th className="py-1 text-left">Tanggal</th>
                                  <th className="py-1 text-right">Qty</th>
                                  <th className="py-1 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(p.dates || {})
                                  .sort(([a], [b]) => (a < b ? 1 : -1))
                                  .map(([date, rec]: [string, any]) => (
                                    <tr key={date} className="border-b border-gray-100">
                                      <td className="py-1.5">{date === "unknown" ? "Unknown" : formatDateId(date)}</td>
                                      <td className="py-1.5 text-right">{Number(rec.qty || 0).toLocaleString("id-ID")}</td>
                                      <td className="py-1.5 text-right font-medium">Rp {Number(rec.total || 0).toLocaleString("id-ID")}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRevenueReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Detail Pendapatan Kasir
                </h3>
                <p className="text-sm text-gray-500">
                  {activePeriodLabel.replace("Periode aktif: ", "")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRevenueReportModal(false)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-gray-100 px-6 py-3">
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setRevenueReportView("daftar")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    revenueReportView === "daftar"
                      ? "bg-green-600 text-white"
                      : "text-gray-600 hover:bg-white"
                  }`}
                >
                  Daftar
                </button>
                <button
                  type="button"
                  onClick={() => setRevenueReportView("rekapKasir")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    revenueReportView === "rekapKasir"
                      ? "bg-green-600 text-white"
                      : "text-gray-600 hover:bg-white"
                  }`}
                >
                  Rekap Kasir
                </button>
                <button
                  type="button"
                  onClick={() => setRevenueReportView("rekapTanggal")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    revenueReportView === "rekapTanggal"
                      ? "bg-green-600 text-white"
                      : "text-gray-600 hover:bg-white"
                  }`}
                >
                  Rekap Tanggal
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {revenueReportView === "daftar" && (
                <div className="space-y-3">
                  {revenueDetailByCashier.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
                      Tidak ada data pendapatan pada periode ini.
                    </div>
                  ) : (
                    revenueDetailByCashier.map((group) => {
                      const isExpanded = expandedRevenueCashiers.has(group.cashierName);

                      return (
                        <div
                          key={group.cashierName}
                          className="rounded-xl border border-gray-200 bg-white"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRevenueCashiers((prev) => {
                                const next = new Set(prev);
                                if (next.has(group.cashierName)) {
                                  next.delete(group.cashierName);
                                } else {
                                  next.add(group.cashierName);
                                }
                                return next;
                              })
                            }
                            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                          >
                            <div>
                              <p className="font-semibold text-gray-900">
                                {group.cashierName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {group.count} transaksi
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="font-bold text-green-700">
                                Rp {group.total.toLocaleString("id-ID")}
                              </p>
                              <span className="text-gray-500 text-sm">
                                {isExpanded ? "-" : "+"}
                              </span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-3">
                              {Object.entries(group.typeGroups)
                                .sort(
                                  ([typeA], [typeB]) =>
                                    getTypeGroupOrder(typeA) - getTypeGroupOrder(typeB)
                                )
                                .map(([typeKey, typeGroup]) => {
                                  const typeGroupKey = `${group.cashierName}-${typeKey}`;
                                  const isTypeExpanded = expandedRevenueTypeGroups.has(typeGroupKey);

                                  return (
                                    <div
                                      key={typeGroupKey}
                                      className="rounded-lg border border-gray-200 overflow-hidden"
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedRevenueTypeGroups((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(typeGroupKey)) {
                                              next.delete(typeGroupKey);
                                            } else {
                                              next.add(typeGroupKey);
                                            }
                                            return next;
                                          })
                                        }
                                        className="flex w-full items-center justify-between bg-gray-50 px-3 py-2 text-left"
                                      >
                                        <div>
                                          <p className="text-sm font-semibold text-gray-900">
                                            {getRevenueTypeLabel(typeKey)}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {typeGroup.count} transaksi
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <p className="text-sm font-bold text-green-700">
                                            Grand Total: Rp {typeGroup.total.toLocaleString("id-ID")}
                                          </p>
                                          <span className="text-gray-500 text-sm">
                                            {isTypeExpanded ? "-" : "+"}
                                          </span>
                                        </div>
                                      </button>

                                      {isTypeExpanded && (
                                        <div className="overflow-x-auto border-t border-gray-200">
                                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                                            <thead className="bg-gray-50/70">
                                              <tr>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-600">
                                                  Waktu
                                                </th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-600">
                                                  Referensi
                                                </th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-600">
                                                  Keterangan
                                                </th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-600">
                                                  Pembayaran
                                                </th>
                                                <th className="px-3 py-2 text-right font-semibold text-gray-600">
                                                  Nominal
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                              {typeGroup.rows.map((row) => (
                                                <tr
                                                  key={row.id || `${row.timestamp}-${row.referenceId}`}
                                                  className="hover:bg-gray-50"
                                                >
                                                  <td className="px-3 py-2">
                                                    {row.timestamp
                                                      ? new Date(row.timestamp).toLocaleString("id-ID")
                                                      : "-"}
                                                  </td>
                                                  <td className="px-3 py-2 text-gray-600">
                                                    {row.referenceId}
                                                  </td>
                                                  <td className="px-3 py-2 text-gray-600">
                                                    {row.description}
                                                  </td>
                                                  <td className="px-3 py-2 text-gray-600">
                                                    {String(row.paymentMethod || "cash")}
                                                  </td>
                                                  <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                                    Rp {row.amount.toLocaleString("id-ID")}
                                                  </td>
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
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {revenueReportView === "rekapKasir" && (
                <div className="space-y-3">
                  {revenueRekapKasir.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
                      Tidak ada data rekap kasir pada periode ini.
                    </div>
                  ) : (
                    revenueRekapKasir.map((row) => (
                      <div
                        key={row.cashierName}
                        className="rounded-xl border border-gray-200 bg-white p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {row.cashierName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {row.count} transaksi
                            </p>
                          </div>
                          <p className="font-bold text-green-700">
                            Rp {row.total.toLocaleString("id-ID")}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {revenueReportView === "rekapTanggal" && (
                <div className="space-y-3">
                  {Object.keys(revenueRekapTanggal).length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
                      Tidak ada data rekap per tanggal.
                    </div>
                  ) : (
                    Object.entries(revenueRekapTanggal)
                      .sort(([a], [b]) => (a < b ? 1 : -1))
                      .map(([date, data]) => (
                        <div
                          key={date}
                          className="rounded-xl border border-gray-200 bg-white p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {date === "unknown" ? "Unknown" : formatDateId(date)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {data.count} transaksi
                              </p>
                            </div>
                            <p className="font-bold text-green-700">
                              Rp {Number(data.total || 0).toLocaleString("id-ID")}
                            </p>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="border-b text-gray-500">
                                <tr>
                                  <th className="py-1 text-left">Kasir</th>
                                  <th className="py-1 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(data.cashiers)
                                  .sort(([, a], [, b]) => Number(b) - Number(a))
                                  .map(([cashierName, total]) => (
                                    <tr
                                      key={`${date}-${cashierName}`}
                                      className="border-b border-gray-100"
                                    >
                                      <td className="py-1.5">{cashierName}</td>
                                      <td className="py-1.5 text-right font-medium">
                                        Rp {Number(total || 0).toLocaleString("id-ID")}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showExpenseReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Detail Pengeluaran</h3>
                <p className="text-sm text-gray-500">
                  {activePeriodLabel.replace("Periode aktif: ", "")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseReportModal(false)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {expenseByCategory.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
                  Tidak ada data pengeluaran pada periode ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {expenseByCategory.map((group) => {
                    const isExpanded = expandedExpenseCategories.has(group.category);

                    return (
                      <div
                        key={group.category}
                        className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedExpenseCategories((prev) => {
                              const next = new Set(prev);
                              if (next.has(group.category)) {
                                next.delete(group.category);
                              } else {
                                next.add(group.category);
                              }
                              return next;
                            })
                          }
                          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">{group.category}</p>
                            <p className="text-xs text-gray-500">{group.count} transaksi</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="font-bold text-red-700">
                              Rp {group.total.toLocaleString("id-ID")}
                            </p>
                            <span className="text-gray-500 text-sm">
                              {isExpanded ? "-" : "+"}
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="overflow-x-auto border-t border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
                                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Deskripsi</th>
                                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Referensi</th>
                                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Nominal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {group.rows.map((row: any) => (
                                  <tr
                                    key={String(
                                      row?.id ||
                                        `${row?.entry_date}-${row?.description || "expense"}`
                                    )}
                                    className="hover:bg-gray-50"
                                  >
                                    <td className="px-4 py-2">
                                      {row?.entry_date
                                        ? formatDateId(String(row.entry_date))
                                        : "-"}
                                    </td>
                                    <td className="px-4 py-2 text-gray-700">
                                      {String(row?.description || "-")}
                                    </td>
                                    <td className="px-4 py-2 text-gray-600">
                                      {String(row?.reference || "-")}
                                    </td>
                                    <td className="px-4 py-2 text-right font-semibold text-gray-900">
                                      Rp {Number(row?.amount || 0).toLocaleString("id-ID")}
                                    </td>
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
              )}
            </div>
          </div>
        </div>
      )}

      {showRentalReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Total Rental Jam (Per Group Console)
                </h3>
                <p className="text-sm text-gray-500">
                  {activePeriodLabel.replace("Periode aktif: ", "")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRentalReportModal(false)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="text-sm text-gray-500">Memuat data rental...</div>
              ) : rentalJamPerGroup.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
                  Belum ada data rental pada periode ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {rentalJamPerGroup.map((row) => (
                    <div
                      key={row.groupName}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
                    >
                      <div>
                        <div className="font-medium text-gray-800">{row.groupName}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          {row.hours.toLocaleString("id-ID", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}{" "}
                          jam
                        </div>
                        <div className="text-xs text-blue-700">
                          Omzet: Rp {roundUpRupiah(row.estimatedTotal).toLocaleString("id-ID")}
                        </div>
                        <div className="text-xs text-emerald-700">
                          Profit: Rp {roundUpRupiah(row.estimatedProfit).toLocaleString("id-ID")}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Grand Total</div>
                        <div className="text-xs text-gray-500">
                          Ringkasan performa rental pada periode aktif
                        </div>
                      </div>
                      <div className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600">
                        {rentalJamPerGroup.length} group console
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                      <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                        <div className="text-gray-500">Total Jam</div>
                        <div className="font-semibold text-gray-900">
                          {totalRentalHours.toLocaleString("id-ID", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })} jam
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showInventoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Detail Persediaan</h3>
                <p className="text-sm text-gray-500">Total stok produk aktif saat ini</p>
              </div>
              <button
                type="button"
                onClick={() => setShowInventoryModal(false)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-gray-100 bg-gray-50 px-6 py-3">
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-amber-700">
                  <div className="text-xs font-medium">Nilai Aset</div>
                  <div className="font-semibold">
                    Rp {roundUpRupiah(totalNilaiAset).toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700">
                  <div className="text-xs font-medium">Total Persediaan</div>
                  <div className="font-semibold">{totalPersediaan.toLocaleString("id-ID")} unit</div>
                </div>
                <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-rose-700">
                  <div className="text-xs font-medium">Stok Menipis</div>
                  <div className="font-semibold">{lowStockCount} produk</div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {inventoryLoading ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
                  Memuat data persediaan...
                </div>
              ) : inventoryRows.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
                  Tidak ada data persediaan.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Kategori</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Stok</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga Beli</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Nilai Aset</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Min. Stok</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {[...inventoryRows]
                        .sort((a: any, b: any) => {
                          const aLow = Number(a?.min_stock || 0) > 0 && Number(a?.stock || 0) <= Number(a?.min_stock || 0);
                          const bLow = Number(b?.min_stock || 0) > 0 && Number(b?.stock || 0) <= Number(b?.min_stock || 0);
                          if (aLow === bLow) {
                            return String(a?.name || "").localeCompare(String(b?.name || ""));
                          }
                          return aLow ? -1 : 1;
                        })
                        .map((row: any) => {
                          const stock = Number(row?.stock || 0);
                          const cost = Number(row?.cost || 0);
                          const assetValue = stock * cost;
                          const minStock = Number(row?.min_stock || 0);
                          const isLow = minStock > 0 && stock <= minStock;

                          return (
                            <tr key={String(row?.id || row?.name)} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium text-gray-900">{String(row?.name || "-")}</td>
                              <td className="px-4 py-2 text-gray-600">{String(row?.category || "-")}</td>
                              <td className="px-4 py-2 text-right font-semibold text-gray-900">
                                {stock.toLocaleString("id-ID")} {String(row?.unit || "")}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-700">
                                Rp {roundUpRupiah(cost).toLocaleString("id-ID")}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-amber-700">
                                Rp {roundUpRupiah(assetValue).toLocaleString("id-ID")}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-700">
                                {minStock.toLocaleString("id-ID")}
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                    isLow
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {isLow ? "Stok Menipis" : "Aman"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showProtectionLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Protection Log</h3>
                <p className="text-sm text-gray-500">
                  {activePeriodLabel.replace("Periode aktif: ", "")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProtectionLogRefreshKey((k) => k + 1)}
                  disabled={isLoadingProtectionLogs}
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoadingProtectionLogs ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setShowProtectionLogModal(false)}
                  className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="border-b border-gray-100 bg-gray-50 px-6 py-3">
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-indigo-700">
                  <div className="text-xs font-medium">Total Event</div>
                  <div className="font-semibold">{protectionLogs.length} log</div>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-700">
                  <div className="text-xs font-medium">Aktifkan Proteksi</div>
                  <div className="font-semibold">
                    {protectionLogs.filter((l: any) => {
                      const a = l.details?.action;
                      return a === "enable_auto_shutdown" || a === "enable_all_auto_shutdown";
                    }).length}{" "}
                    event
                  </div>
                </div>
                <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-rose-700">
                  <div className="text-xs font-medium">Nonaktifkan Proteksi</div>
                  <div className="font-semibold">
                    {protectionLogs.filter((l: any) => {
                      const a = l.details?.action;
                      return a === "disable_auto_shutdown" || a === "disable_all_auto_shutdown";
                    }).length}{" "}
                    event
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoadingProtectionLogs ? (
                <div className="p-10 text-center text-gray-500">Memuat data log...</div>
              ) : protectionLogs.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
                  Tidak ada protection log pada periode ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {protectionLogsByCashier.map((group) => {
                    const isExpanded = expandedProtectionCashiers.has(group.cashierName);
                    return (
                      <div
                        key={group.cashierName}
                        className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedProtectionCashiers((prev) => {
                              const next = new Set(prev);
                              if (next.has(group.cashierName)) {
                                next.delete(group.cashierName);
                              } else {
                                next.add(group.cashierName);
                              }
                              return next;
                            })
                          }
                          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-2">
                            <div className="rounded-full bg-indigo-100 p-1.5 text-indigo-700">
                              <UserRound className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{group.cashierName}</p>
                              <p className="text-xs text-gray-500">{group.count} event</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex gap-2 text-xs">
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                                ↑ {group.enable} aktif
                              </span>
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
                                ↓ {group.disable} nonaktif
                              </span>
                            </div>
                            <span className="text-sm text-gray-400">{isExpanded ? "−" : "+"}</span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="divide-y divide-gray-100 border-t border-gray-100">
                            {group.logs.map((log: any) => {
                              const action = log.details?.action;
                              const isEnable =
                                action === "enable_auto_shutdown" ||
                                action === "enable_all_auto_shutdown";
                              const isDisable =
                                action === "disable_auto_shutdown" ||
                                action === "disable_all_auto_shutdown";

                              return (
                                <div
                                  key={log.id}
                                  className="px-4 py-3 hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2">
                                      <div
                                        className={`mt-0.5 shrink-0 rounded-full p-1 ${
                                          isEnable
                                            ? "bg-emerald-100 text-emerald-700"
                                            : isDisable
                                            ? "bg-rose-100 text-rose-700"
                                            : "bg-gray-100 text-gray-600"
                                        }`}
                                      >
                                        <Shield className="h-3.5 w-3.5" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">
                                          {log.description}
                                        </p>
                                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                                          {log.details?.reason && (
                                            <span className="font-medium italic text-red-600">
                                              Alasan: {log.details.reason}
                                            </span>
                                          )}
                                          {log.details?.console_id && (
                                            <span className="text-indigo-600">
                                              Console ID: {log.details.console_id}
                                            </span>
                                          )}
                                        </div>
                                        {log.duration !== undefined && (
                                          <div className="mt-1 inline-flex items-center gap-1 rounded border border-orange-100 bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                                            Durasi Off:{" "}
                                            {Math.floor(log.duration / 3600000)}j{" "}
                                            {Math.floor((log.duration % 3600000) / 60000)}m{" "}
                                            {Math.floor((log.duration % 60000) / 1000)}d
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="shrink-0 text-right text-xs text-gray-500">
                                      {log.timestamp
                                        ? new Date(log.timestamp).toLocaleString("id-ID")
                                        : "-"}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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
      )}
    </div>
  );
};

export default AdminDashboard;
