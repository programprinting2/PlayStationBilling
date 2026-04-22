import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Clock3,
  DollarSign,
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
  const [expandedExpenseCategories, setExpandedExpenseCategories] = useState<
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
      const startIso = start?.toISOString();
      const endIso = end?.toISOString();
      const startDate = start ? toYmd(start) : null;
      const endDate = end ? toYmd(end) : null;

      try {
        let revenueQuery = supabase
          .from("cashier_transactions")
          .select(
            `
            id,
            amount,
            type,
            timestamp,
            reference_id,
            description,
            payment_method,
            cashier_id,
            session_id,
            details,
            cashier_sessions (
              cashier_name
            )
          `
          )
          .not("cashier_id", "is", null)
          .order("timestamp", { ascending: false });

        if (startIso) revenueQuery = revenueQuery.gte("timestamp", startIso);
        if (endIso) revenueQuery = revenueQuery.lte("timestamp", endIso);

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
          .from("rental_sessions")
          .select(
            `
            id,
            console_id,
            start_time,
            end_time,
            duration_minutes,
            hourly_rate_snapshot,
            status,
            consoles (
              name,
              equipment_type_id,
              rate_profiles (
                hourly_rate,
                capital
              ),
              equipment_types (
                name
              )
            )
          `
          );

        if (startIso) rentalQuery = rentalQuery.gte("start_time", startIso);
        if (endIso) rentalQuery = rentalQuery.lte("start_time", endIso);

        const [revenueRes, purchaseRes, expenseRes, rentalRes] = await Promise.all([
          revenueQuery,
          purchaseQuery,
          expenseQuery,
          rentalQuery,
        ]);

        setCashierRevenueRows(revenueRes.data || []);
        setPurchaseRows(purchaseRes.data || []);
        setExpenseRows(expenseRes.data || []);
        setRentalRows(rentalRes.data || []);
      } catch (error) {
        console.error("Error fetching admin dashboard data:", error);
        setCashierRevenueRows([]);
        setPurchaseRows([]);
        setExpenseRows([]);
        setRentalRows([]);
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

  const getCashierDisplayName = (row: any) =>
    row?.cashier_sessions?.cashier_name || "Kasir";

  const perCashier = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of revenueSummaryRows) {
      const cashierName = getCashierDisplayName(row);
      const amount = Number(row?.amount || 0);
      map.set(cashierName, (map.get(cashierName) || 0) + amount);
    }

    return Array.from(map.entries())
      .map(([cashierName, total]) => ({ cashierName, total }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [revenueSummaryRows]);

  const totalRevenue = useMemo(
    () =>
      revenueSummaryRows.reduce(
        (sum: number, row: any) => sum + Number(row?.amount || 0),
        0
      ),
    [revenueSummaryRows]
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
      const groupName =
        row?.consoles?.equipment_types?.name ||
        row?.consoles?.name ||
        "Tanpa Group";

      const hourlyRate = Number(
        row?.hourly_rate_snapshot ?? row?.consoles?.rate_profiles?.hourly_rate ?? 0
      );
      const capitalRate = Number(row?.consoles?.rate_profiles?.capital ?? 0);

      const durationMinutes = Number(row?.duration_minutes || 0);
      let minutes = durationMinutes;

      if (minutes <= 0 && row?.start_time) {
        const start = new Date(row.start_time).getTime();
        const end = row?.end_time
          ? new Date(row.end_time).getTime()
          : new Date().getTime();
        const diffMinutes = Math.max(0, Math.round((end - start) / 60000));
        minutes = diffMinutes;
      }

      const hours = minutes / 60;
      const prev = groupMap.get(groupName) || {
        groupName,
        hours: 0,
        estimatedTotal: 0,
        estimatedProfit: 0,
        totalCapitalAmount: 0,
      };

      prev.hours += hours;
      prev.estimatedTotal += hours * hourlyRate;
      prev.estimatedProfit += hours * (hourlyRate - capitalRate);
      prev.totalCapitalAmount += hours * capitalRate;

      groupMap.set(groupName, prev);
    }

    return Array.from(groupMap.entries())
      .map(([, value]) => ({
        ...value,
        avgHourlyRate: value.hours > 0 ? value.estimatedTotal / value.hours : 0,
        avgCapitalRate: value.hours > 0 ? value.totalCapitalAmount / value.hours : 0,
      }))
      .filter((row) => row.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [rentalRows]);

  const totalRentalHours = useMemo(
    () => rentalJamPerGroup.reduce((sum, row) => sum + row.hours, 0),
    [rentalJamPerGroup]
  );

  const totalEstimatedRental = useMemo(
    () => rentalJamPerGroup.reduce((sum, row) => sum + row.estimatedTotal, 0),
    [rentalJamPerGroup]
  );

  const totalEstimatedRentalProfit = useMemo(
    () => rentalJamPerGroup.reduce((sum, row) => sum + row.estimatedProfit, 0),
    [rentalJamPerGroup]
  );

  const totalEstimatedCapital = useMemo(
    () => rentalJamPerGroup.reduce((sum, row) => sum + row.totalCapitalAmount, 0),
    [rentalJamPerGroup]
  );

  const averageProfitPerHour = useMemo(
    () => (totalRentalHours > 0 ? totalEstimatedRentalProfit / totalRentalHours : 0),
    [totalEstimatedRentalProfit, totalRentalHours]
  );

  const profitMarginPercent = useMemo(
    () =>
      totalEstimatedRental > 0
        ? (totalEstimatedRentalProfit / totalEstimatedRental) * 100
        : 0,
    [totalEstimatedRentalProfit, totalEstimatedRental]
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
    return revenueSummaryRows
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
  }, [revenueSummaryRows]);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-gray-50 to-gray-100 p-6">
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
          <CalendarDays className="h-3.5 w-3.5" />
          Administrator View
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Dashboard Administrator
        </h1>
        <p className="text-gray-600">
          Ringkasan operasional dengan filter periode untuk keputusan yang lebih
          cepat.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
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

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Pendapatan</h2>
            <button
              type="button"
              onClick={() => setShowRevenueReportModal(true)}
              title="Lihat detail pendapatan kasir"
              className="rounded-lg bg-green-100 p-2 text-green-700 transition hover:bg-green-200"
            >
              <DollarSign className="h-4 w-4" />
            </button>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            Rp {totalRevenue.toLocaleString("id-ID")}
          </div>
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

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Total Pembelian</h2>
            <button
              type="button"
              onClick={() => setShowPurchaseReportModal(true)}
              title="Lihat laporan pembelian"
              className="rounded-lg bg-blue-100 p-2 text-blue-700 transition hover:bg-blue-200"
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            Rp {totalPembelian.toLocaleString("id-ID")}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Total Pengeluaran</h2>
            <button
              type="button"
              onClick={() => setShowExpenseReportModal(true)}
              title="Lihat detail pengeluaran"
              className="rounded-lg bg-red-100 p-2 text-red-700 transition hover:bg-red-200"
            >
              <TrendingDown className="h-4 w-4" />
            </button>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            Rp {totalPengeluaran.toLocaleString("id-ID")}
          </div>
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

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Total Rental Jam</h2>
            <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
              <Clock3 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {totalRentalHours.toLocaleString("id-ID", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{" "}
            jam
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5 text-blue-700">
              <div className="font-medium">Total Omzet</div>
              <div className="text-sm font-semibold">
                Rp {roundUpRupiah(totalEstimatedRental).toLocaleString("id-ID")}
              </div>
              <div className="text-[11px] text-blue-600">Jumlah jam x harga rental per jam</div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-emerald-700">
              <div className="font-medium">Estimasi Keuntungan</div>
              <div className="text-sm font-semibold">
                Rp {roundUpRupiah(totalEstimatedRentalProfit).toLocaleString("id-ID")}
              </div>
              <div className="text-[11px] text-emerald-600">(Harga rental - harga modal) x jumlah jam</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 lg:col-span-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pendapatan</h2>
            <div className="p-2 rounded-lg bg-green-500">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            Rp {totalRevenue.toLocaleString("id-ID")}
          </div>
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-blue-700">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide">Rental</div>
                <div className="text-[11px] text-blue-500 mt-1">Pendapatan dari sesi rental</div>
              </div>
              <div className="text-lg font-bold text-right">
                Rp {rentalRevenue.toLocaleString("id-ID")}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-emerald-700">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide">Cafe</div>
                <div className="text-[11px] text-emerald-500 mt-1">Pendapatan dari penjualan cafe</div>
              </div>
              <div className="text-lg font-bold text-right">
                Rp {cafeRevenue.toLocaleString("id-ID")}
              </div>
            </div>

            {voucherRevenue > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-amber-700">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide">Voucher</div>
                  <div className="text-[11px] text-amber-600 mt-1">Pendapatan dari penjualan voucher</div>
                </div>
                <div className="text-lg font-bold text-right">
                  Rp {voucherRevenue.toLocaleString("id-ID")}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-gray-200 pt-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Per Kasir</h3>

            {loading ? (
              <div className="text-sm text-gray-500">Memuat data pendapatan...</div>
            ) : perCashier.length === 0 ? (
              <div className="text-sm text-gray-500">Belum ada pendapatan hari ini.</div>
            ) : (
              <div className="space-y-3">
                {perCashier.map((row) => (
                  <div
                    key={row.cashierName}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
                  >
                    <div className="flex items-center gap-2 text-gray-800 font-medium">
                      <UserRound className="h-4 w-4 text-gray-500" />
                      <span>{row.cashierName}</span>
                    </div>
                    <div className="font-semibold text-gray-900">
                      Rp {row.total.toLocaleString("id-ID")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 lg:col-span-4">
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 lg:col-span-4">
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 lg:col-span-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Total Rental Jam (Per Group Console)
            </h2>
            <Clock3 className="h-5 w-5 text-purple-600" />
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Memuat data rental...</div>
          ) : rentalJamPerGroup.length === 0 ? (
            <div className="text-sm text-gray-500">Belum ada data rental pada periode ini.</div>
          ) : (
            <div className="space-y-3">
              {rentalJamPerGroup.map((row) => (
                <div
                  key={row.groupName}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-gray-800">{row.groupName}</div>
                    <div className="text-xs text-violet-700">
                      Rental/Jam: Rp {roundUpRupiah(row.avgHourlyRate).toLocaleString("id-ID")}
                    </div>
                    <div className="text-xs text-rose-700">
                      Modal/Jam: Rp {roundUpRupiah(row.avgCapitalRate).toLocaleString("id-ID")}
                    </div>
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
                  <div className="rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200">
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

                  <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
                    <div className="text-blue-600">Total Omzet</div>
                    <div className="font-semibold text-blue-800">
                      Rp {roundUpRupiah(totalEstimatedRental).toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2">
                    <div className="text-rose-600">Total Modal</div>
                    <div className="font-semibold text-rose-800">
                      Rp {roundUpRupiah(totalEstimatedCapital).toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
                    <div className="text-emerald-600">Estimasi Keuntungan</div>
                    <div className="font-semibold text-emerald-800">
                      Rp {roundUpRupiah(totalEstimatedRentalProfit).toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="rounded-md border border-violet-100 bg-violet-50 px-3 py-2">
                    <div className="text-violet-600">Profit / Jam</div>
                    <div className="font-semibold text-violet-800">
                      Rp {roundUpRupiah(averageProfitPerHour).toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
                    <div className="text-amber-700">Margin Profit</div>
                    <div className="font-semibold text-amber-800">
                      {profitMarginPercent.toLocaleString("id-ID", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCafeReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
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
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
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
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
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
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
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
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
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
    </div>
  );
};

export default AdminDashboard;
