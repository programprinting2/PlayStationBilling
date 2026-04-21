import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Clock3,
  DollarSign,
  ShoppingCart,
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
  const [showPurchaseReportModal, setShowPurchaseReportModal] = useState(false);
  const [purchaseReportView, setPurchaseReportView] = useState<
    "daftar" | "rekapTanggal" | "rekapBarang"
  >("daftar");
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
            amount,
            type,
            timestamp,
            cashier_sessions (
              cashier_name
            )
          `
          )
          .in("type", ["sale", "rental"]);

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
          .select("amount, entry_date, type")
          .eq("type", "expense");

        if (startDate) expenseQuery = expenseQuery.gte("entry_date", startDate);
        if (endDate) expenseQuery = expenseQuery.lte("entry_date", endDate);

        let rentalQuery = supabase
          .from("rental_sessions")
          .select(
            `
            console_id,
            start_time,
            end_time,
            duration_minutes,
            status,
            consoles (
              name,
              equipment_type_id,
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
      } catch {
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

  const perCashier = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of cashierRevenueRows) {
      const cashierName = row?.cashier_sessions?.cashier_name || "Kasir";
      const amount = Number(row?.amount || 0);
      map.set(cashierName, (map.get(cashierName) || 0) + amount);
    }

    return Array.from(map.entries())
      .map(([cashierName, total]) => ({ cashierName, total }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [cashierRevenueRows]);

  const totalRevenue = useMemo(
    () =>
      cashierRevenueRows.reduce(
        (sum: number, row: any) => sum + Number(row?.amount || 0),
        0
      ),
    [cashierRevenueRows]
  );

  const rentalRevenue = useMemo(
    () =>
      cashierRevenueRows
        .filter((row: any) => row?.type === "rental")
        .reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0),
    [cashierRevenueRows]
  );

  const cafeRevenue = useMemo(
    () =>
      cashierRevenueRows
        .filter((row: any) => row?.type === "sale")
        .reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0),
    [cashierRevenueRows]
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

  const rentalJamPerGroup = useMemo(() => {
    const groupMap = new Map<string, number>();

    for (const row of rentalRows) {
      const groupName =
        row?.consoles?.equipment_types?.name ||
        row?.consoles?.name ||
        "Tanpa Group";

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
      groupMap.set(groupName, (groupMap.get(groupName) || 0) + hours);
    }

    return Array.from(groupMap.entries())
      .map(([groupName, hours]) => ({ groupName, hours }))
      .filter((row) => row.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [rentalRows]);

  const totalRentalHours = useMemo(
    () => rentalJamPerGroup.reduce((sum, row) => sum + row.hours, 0),
    [rentalJamPerGroup]
  );

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

      <div className="max-w-6xl mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
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

      <div className="max-w-6xl grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Pendapatan</h2>
            <div className="rounded-lg bg-green-100 p-2 text-green-700">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            Rp {totalRevenue.toLocaleString("id-ID")}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5 text-blue-700">
              <div className="font-medium">Rental</div>
              <div className="text-sm font-semibold">
                Rp {rentalRevenue.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-emerald-700">
              <div className="font-medium">Cafe</div>
              <div className="text-sm font-semibold">
                Rp {cafeRevenue.toLocaleString("id-ID")}
              </div>
            </div>
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
            <div className="rounded-lg bg-red-100 p-2 text-red-700">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            Rp {totalPengeluaran.toLocaleString("id-ID")}
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
        </div>
      </div>

      <div className="max-w-6xl grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pendapatan</h2>
            <div className="p-2 rounded-lg bg-green-500">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            Rp {totalRevenue.toLocaleString("id-ID")}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700">
              <div className="text-xs font-medium uppercase tracking-wide">
                Rental
              </div>
              <div className="font-semibold">
                Rp {rentalRevenue.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-700">
              <div className="text-xs font-medium uppercase tracking-wide">
                Cafe
              </div>
              <div className="font-semibold">
                Rp {cafeRevenue.toLocaleString("id-ID")}
              </div>
            </div>
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
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
                  <div className="font-medium text-gray-800">{row.groupName}</div>
                  <div className="font-semibold text-gray-900">
                    {row.hours.toLocaleString("id-ID", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{" "}
                    jam
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
};

export default AdminDashboard;
