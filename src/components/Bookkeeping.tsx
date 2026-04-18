import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  FileText,
  Loader2,
  AlertCircle,
  SquarePen,
  Coffee,
  Gamepad,
  Clock,
  Receipt,
  X,
  Ticket,
  Trash,
  CreditCard,
  Banknote,
  User,
  Search,
  RefreshCw,
} from "lucide-react";
import { supabase, db } from "../lib/supabase";
import { BookkeepingEntry } from "../types";
import Swal from "sweetalert2";
import { printReceipt } from "../utils/receipt";
import OccupancyCalendar from "./OccupancyCalendar";
import ProfitCalendar from "./ProfitCalendar";
import CashierCalendar from "./CashierCalendar";
import JournalCalendar from "./JournalCalendar";
import RevenueChart, { RevenueDataPoint } from "./RevenueChart";

type Summary = {
  totalRental?: number;
  totalCafe?: number;
  totalIncome?: number;
  totalExpense?: number;
  netProfit: number;
};

export const getDateRange = (period: string, startDateStr?: string, endDateStr?: string) => {
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
      const day = start.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      start.setDate(start.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "last_week": {
      start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "month": {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "last_month": {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "range": {
      if (startDateStr) {
        start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);
      }
      if (endDateStr) {
        end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
      }
      break;
    }
  }
  return { start, end };
};

const Bookkeeping: React.FC = () => {
  // State management
  const [entries, setEntries] = useState<BookkeepingEntry[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // Filter states
  const [selectedPeriod, setSelectedPeriod] = useState("today");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    type: "income" as "income" | "expense",
    category: "rental" as
      | "rental"
      | "cafe"
      | "inventory"
      | "operational"
      | "voucher"
      | "other",
    description: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    reference: "",
    notes: "",
  });

  const [showEditForm, setShowEditForm] = useState(false);
  const [editEntry, setEditEntry] = useState<BookkeepingEntry | null>(null);
  const [activeView, setActiveView] = useState<
    "jurnal" | "laba_rugi" | "laporan_kasir" | "rekap_kasir" | "rekap_console" | "history_discount"
  >("jurnal");
  const [activeTab, setActiveTab] = useState<
    "all" | "income" | "expense" | "rental" | "sale" | "voucher" | "rekap"
  >("all");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedTypeBuckets, setExpandedTypeBuckets] = useState<Set<string>>(
    new Set()
  );
  const [expandedSessionBuckets, setExpandedSessionBuckets] = useState<
    Set<string>
  >(new Set());
  const [expandedConsoleBuckets, setExpandedConsoleBuckets] = useState<
    Set<string>
  >(new Set());
  const [expandedConsoleDateBuckets, setExpandedConsoleDateBuckets] = useState<
    Set<string>
  >(new Set());
  const [expandedCashierBuckets, setExpandedCashierBuckets] = useState<
    Set<string>
  >(new Set());
  const [expandedCashierDateBuckets, setExpandedCashierDateBuckets] = useState<
    Set<string>
  >(new Set());
  const [rekapKasirSubTab, setRekapKasirSubTab] = useState<
    "per_tanggal" | "per_kasir"
  >("per_tanggal");
  const [rekapConsoleSubTab, setRekapConsoleSubTab] = useState<
    "per_tanggal" | "per_console"
  >("per_tanggal");
  const [labaRugiSubTab, setLabaRugiSubTab] = useState<"detail" | "rekap">(
    "detail"
  );
  const [transaksiKasirSubTab, setTransaksiKasirSubTab] = useState<
    "detail" | "rekap" | "rekap_tahunan"
  >("detail");
  const [rekapTahunanYear, setRekapTahunanYear] = useState<number>(new Date().getFullYear());
  const [rekapTahunanData, setRekapTahunanData] = useState<any[]>([]);
  const [rekapTahunanLoading, setRekapTahunanLoading] = useState(false);

  const fetchRekapTahunanData = useCallback(async (year: number) => {
    try {
      setRekapTahunanLoading(true);
      const startOfYear = new Date(year, 0, 1).toISOString();
      const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999).toISOString();

      const { data, error } = await supabase
        .from("cashier_transactions")
        .select("amount, timestamp, type, payment_method")
        .not("cashier_id", "is", null)
        .gte("timestamp", startOfYear)
        .lte("timestamp", endOfYear);

      if (error) throw error;
      setRekapTahunanData(data || []);
    } catch (err) {
      console.error("Error fetching rekap tahunan:", err);
    } finally {
      setRekapTahunanLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView === "rekap_kasir" && transaksiKasirSubTab === "rekap_tahunan") {
      fetchRekapTahunanData(rekapTahunanYear);
    }
  }, [activeView, transaksiKasirSubTab, rekapTahunanYear, fetchRekapTahunanData]);
  const [rekapConsoleViewSubTab, setRekapConsoleViewSubTab] = useState<
    "detail" | "rekap" | "protection_log"
  >("detail");
  const [jurnalSubTab, setJurnalSubTab] = useState<"detail" | "rekap" | "setoran">(
    "detail"
  );
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [chartData, setChartData] = useState<RevenueDataPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const [protectionLogs, setProtectionLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const fetchProtectionLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      let query = supabase
        .from("cashier_transactions")
        .select(
          "id, timestamp, description, details, cashier_id, cashier_sessions(cashier_name)"
        )
        .ilike("description", "[PROTECTION]%")
        .order("timestamp", { ascending: false });

      if (selectedPeriod !== "all") {
        const { start, end } = getDateRange(selectedPeriod, startDate, endDate);
        if (start) query = query.gte("timestamp", start.toISOString());
        if (end) query = query.lte("timestamp", end.toISOString());
      } else {
        query = query.limit(50);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching protection logs:", error);
        return;
      }

      const logs = data || [];
      const enableLogs = logs.filter((log) => {
        const action = log.details?.action;
        return action === "enable_auto_shutdown" || action === "enable_all_auto_shutdown";
      });

      let candidateDisables = logs.filter((log) => {
        const action = log.details?.action;
        return action === "disable_auto_shutdown" || action === "disable_all_auto_shutdown";
      });

      if (enableLogs.length > 0) {
        // Optimizing with a single query fetching enough disable events before the most recent enable event
        const maxTimestamp = new Date(
          Math.max(...enableLogs.map((l) => new Date(l.timestamp).getTime()))
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
          const existingIds = new Set(candidateDisables.map(log => log.id));
          const newDisables = previousDisables.filter(log => !existingIds.has(log.id));
          candidateDisables = [...candidateDisables, ...newDisables].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        }
      }

      const logsWithDuration = logs.map((log) => {
        const action = log.details?.action;
        if (
          action === "enable_auto_shutdown" ||
          action === "enable_all_auto_shutdown"
        ) {
          const consoleId = log.details?.console_id;
          const logTimestamp = new Date(log.timestamp).getTime();

          const pairData = candidateDisables.find((disableLog) => {
            const disableTimestamp = new Date(disableLog.timestamp).getTime();
            if (disableTimestamp >= logTimestamp) return false;

            const disableAction = disableLog.details?.action;
            if (action === "enable_auto_shutdown" && consoleId) {
              return (
                (disableAction === "disable_auto_shutdown" &&
                  disableLog.details?.console_id === consoleId) ||
                disableAction === "disable_all_auto_shutdown"
              );
            } else {
              return disableAction === "disable_all_auto_shutdown";
            }
          });

          if (pairData) {
            const start = new Date(pairData.timestamp).getTime();
            return { ...log, duration: logTimestamp - start };
          }
        }
        return log;
      });

      setProtectionLogs(logsWithDuration);
    } catch (error) {
      console.error("Error fetching protection logs:", error);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    if (activeView === "rekap_console" && rekapConsoleViewSubTab === "protection_log") {
      fetchProtectionLogs();
    }
  }, [fetchProtectionLogs, activeView, rekapConsoleViewSubTab]);


  const fetchChartData = async () => {
    try {
      setChartLoading(true);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);
      startDate.setDate(1);

      const { data: transactions, error } = await supabase
        .from("cashier_transactions")
        .select("amount, timestamp")
        .in("type", ["sale", "rental", "voucher", "income"])
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", endDate.toISOString())
        .order("timestamp", { ascending: true });

      if (error) throw error;

      const monthlyData: Record<string, number> = {};

      transactions?.forEach((transaction) => {
        const date = new Date(transaction.timestamp);
        const monthKey = date.toLocaleDateString("id-ID", {
          year: "numeric",
          month: "short",
        });

        monthlyData[monthKey] =
          (monthlyData[monthKey] || 0) + (transaction.amount || 0);
      });

      const chartData = Object.entries(monthlyData)
        .map(([month, revenue]) => ({
          month,
          revenue: revenue / 1000000,
        }))
        .sort((a, b) => {
          const dateA = new Date(a.month.replace(/(\w+)\s+(\d+)/, "$2-$1-01"));
          const dateB = new Date(b.month.replace(/(\w+)\s+(\d+)/, "$2-$1-01"));
          return dateA.getTime() - dateB.getTime();
        });

      setChartData(chartData);
    } catch (error) {
      console.error("Error fetching chart data:", error);
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, []);

  const renderDetailRekapNav = () => {
    if (activeView === "laba_rugi") {
      return (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setLabaRugiSubTab("detail")}
            className={`px-3 py-2 text-sm rounded ${
              labaRugiSubTab === "detail"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Detail Laba Rugi
          </button>
          <button
            onClick={() => setLabaRugiSubTab("rekap")}
            className={`px-3 py-2 text-sm rounded ${
              labaRugiSubTab === "rekap"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Rekap Laba Rugi
          </button>
        </div>
      );
    }

    if (activeView === "rekap_kasir") {
      return (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setTransaksiKasirSubTab("detail")}
            className={`px-3 py-2 text-sm rounded ${
              transaksiKasirSubTab === "detail"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Detail Transaksi Kasir
          </button>
          <button
            onClick={() => setTransaksiKasirSubTab("rekap")}
            className={`px-3 py-2 text-sm rounded ${
              transaksiKasirSubTab === "rekap"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Rekap Transaksi Kasir
          </button>
          <button
            onClick={() => setTransaksiKasirSubTab("rekap_tahunan")}
            className={`px-3 py-2 text-sm rounded ${
              transaksiKasirSubTab === "rekap_tahunan"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Rekap Tahunan
          </button>
        </div>
      );
    }

    if (activeView === "rekap_console") {
      return (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setRekapConsoleViewSubTab("detail")}
            className={`px-3 py-2 text-sm rounded ${
              rekapConsoleViewSubTab === "detail"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Detail Rekap Console
          </button>
          <button
            onClick={() => setRekapConsoleViewSubTab("rekap")}
            className={`px-3 py-2 text-sm rounded ${
              rekapConsoleViewSubTab === "rekap"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Rekap Console
          </button>
          <button
            onClick={() => {
              setRekapConsoleViewSubTab("protection_log");
              fetchProtectionLogs();
            }}
            className={`px-3 py-2 text-sm rounded ${
              rekapConsoleViewSubTab === "protection_log"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Protection Log
          </button>
        </div>
      );
    }

    if (activeView === "jurnal") {
      return (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setJurnalSubTab("detail")}
            className={`px-3 py-2 text-sm rounded ${
              jurnalSubTab === "detail"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Detail Jurnal Umum
          </button>
          <button
            onClick={() => setJurnalSubTab("rekap")}
            className={`px-3 py-2 text-sm rounded ${
              jurnalSubTab === "rekap"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Rekap Jurnal Umum
          </button>
          <button
            onClick={() => setJurnalSubTab("setoran")}
            className={`px-3 py-2 text-sm rounded ${
              jurnalSubTab === "setoran"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Setoran
          </button>

          {/* Search input for jurnal */}
          {activeView === "jurnal" && jurnalSubTab === "detail" && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari berdasarkan deskripsi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // Laporan Kasir states
  const [sessions, setSessions] = useState<any[]>([]);
  const [undepositedSessions, setUndepositedSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionPeriod, setSessionPeriod] = useState<string>("month");
  const [sessionStartDate, setSessionStartDate] = useState<string>("");
  const [sessionEndDate, setSessionEndDate] = useState<string>("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<
    "all" | "cash" | "non-cash"
  >("all");
  const [sessionStatusFilter, setSessionStatusFilter] = useState<
    "all" | "active" | "closed"
  >("all");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage] = useState(20);

  // Constants
  const periods = [
    { value: "today", label: "Hari Ini" },
    { value: "yesterday", label: "Kemarin" },
    {
      value: "week",
      label: `Minggu Ini`,
    },
    {
      value: "last_week",
      label: `Minggu Lalu`,
    },
    {
      value: "month",
      label: `Bulan Ini (${new Date().toLocaleDateString("id-ID", {
        month: "long",
      })})`,
    },
    {
      value: "last_month",
      label: `Bulan Lalu (${new Date(
        new Date().getFullYear(),
        new Date().getMonth() - 1,
        1
      ).toLocaleDateString("id-ID", {
        month: "long",
      })})`,
    },
    { value: "range", label: "Rentang Waktu" },
  ];

  const types = [
    { value: "all", label: "Semua" },
    { value: "income", label: "Pemasukan" },
    { value: "expense", label: "Pengeluaran" },
  ];

  const categories = [
    { value: "all", label: "Semua Kategori" },
    { value: "rental", label: "Rental PlayStation" },
    { value: "cafe", label: "Penjualan Cafe" },
    { value: "inventory", label: "Pembelian Inventory" },
    { value: "operational", label: "Operasional" },
    { value: "voucher", label: "Penjualan Voucher" },
    { value: "other", label: "Lainnya" },
  ];

  const filteredSessions = useMemo(() => {
    if (!showSessionModal) return sessions;
    let start: Date | null = null;
    let end: Date | null = null;
    const now = new Date();
    switch (sessionPeriod) {
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
      case "last_week": {
        start = new Date();
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "month": {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "last_month": {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "range": {
        if (sessionStartDate) {
          start = new Date(sessionStartDate);
          start.setHours(0, 0, 0, 0);
        }
        if (sessionEndDate) {
          end = new Date(sessionEndDate);
          end.setHours(23, 59, 59, 999);
        }
        break;
      }
    }
    return sessions.filter((s) => {
      const st = s.start_time ? new Date(s.start_time) : null;
      if (!st) return false;
      if (start && st < start) return false;
      if (end && st > end) return false;

      // Filter by status
      if (sessionStatusFilter !== "all") {
        const sessionStatus = s.status || "active";
        if (sessionStatusFilter === "active" && sessionStatus !== "active")
          return false;
        if (sessionStatusFilter === "closed" && sessionStatus === "active")
          return false;
      }

      return true;
    });
  }, [
    sessions,
    sessionPeriod,
    sessionStartDate,
    sessionEndDate,
    sessionStatusFilter,
    showSessionModal,
  ]);

  const fetchTransaction = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("cashier_transactions")
        .select("*")
        .order("timestamp", { ascending: false });

      if (activeView === "laba_rugi") {
        query = query.or("type.eq.sale,type.eq.rental");

        if (selectedPeriod !== "all") {
          const now = new Date();
          let start: Date | null = new Date();
          let end: Date | null = null;

          switch (selectedPeriod) {
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
            case "last_week": {
              start = new Date();
              start.setDate(start.getDate() - 7);
              start.setHours(0, 0, 0, 0);
              end = new Date();
              end.setDate(end.getDate() - 1);
              end.setHours(23, 59, 59, 999);
              break;
            }
            case "month": {
              start = new Date(now.getFullYear(), now.getMonth(), 1);
              end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              end.setHours(23, 59, 59, 999);
              break;
            }
            case "last_month": {
              start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              end = new Date(now.getFullYear(), now.getMonth(), 0);
              end.setHours(23, 59, 59, 999);
              break;
            }
            case "range": {
              if (startDate) {
                start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
              }
              if (endDate) {
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
              }
              break;
            }
          }
          if (start) {
            query = query.gte("timestamp", start.toISOString());
          }
          if (end) {
            query = query.lte("timestamp", end.toISOString());
          }
        }
      } else if (activeView === "rekap_kasir") {
        query = query.not("cashier_id", "is", null);
        if (selectedPeriod !== "all") {
          const now = new Date();
          let start: Date | null = new Date();
          let end: Date | null = null;
          switch (selectedPeriod) {
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
            case "last_week": {
              start = new Date();
              start.setDate(start.getDate() - 7);
              start.setHours(0, 0, 0, 0);
              end = new Date();
              end.setDate(end.getDate() - 1);
              end.setHours(23, 59, 59, 999);
              break;
            }
            case "month": {
              start = new Date(now.getFullYear(), now.getMonth(), 1);
              end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              end.setHours(23, 59, 59, 999);
              break;
            }
            case "last_month": {
              start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              end = new Date(now.getFullYear(), now.getMonth(), 0);
              end.setHours(23, 59, 59, 999);
              break;
            }
            case "range": {
              if (startDate) {
                start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
              }
              if (endDate) {
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
              }
              break;
            }
          }
          if (start) query = query.gte("timestamp", start.toISOString());
          if (end) query = query.lte("timestamp", end.toISOString());
        }
      } else if (activeView === "laporan_kasir") {
        if (selectedSessionId) {
          query = query.eq("session_id", selectedSessionId);
        }
        // if (startDate) {
        //   query = query.gte("timestamp", new Date(startDate).toISOString());
        // }
        // if (endDate) {
        //   const end = new Date(endDate);
        //   end.setHours(23, 59, 59, 999);
        //   query = query.lte("timestamp", end.toISOString());
        // }
      } else if (activeView === "history_discount") {
        // Fetch all transactions that have a discount in details
        if (selectedPeriod !== "all") {
          const now = new Date();
          let start: Date | null = null;
          let end: Date | null = null;
          switch (selectedPeriod) {
            case "today": { start = new Date(); start.setHours(0,0,0,0); end = new Date(); end.setHours(23,59,59,999); break; }
            case "yesterday": { start = new Date(); start.setDate(start.getDate()-1); start.setHours(0,0,0,0); end = new Date(start); end.setHours(23,59,59,999); break; }
            case "week": { start = new Date(); const dw = start.getDay(); start.setDate(start.getDate() + ((dw===0?-6:1)-dw)); start.setHours(0,0,0,0); end = new Date(); end.setHours(23,59,59,999); break; }
            case "last_week": { start = new Date(); start.setDate(start.getDate()-7); start.setHours(0,0,0,0); end = new Date(); end.setDate(end.getDate()-1); end.setHours(23,59,59,999); break; }
            case "month": { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth()+1, 0); end.setHours(23,59,59,999); break; }
            case "last_month": { start = new Date(now.getFullYear(), now.getMonth()-1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); end.setHours(23,59,59,999); break; }
            case "range": { if (startDate) { start = new Date(startDate); start.setHours(0,0,0,0); } if (endDate) { end = new Date(endDate); end.setHours(23,59,59,999); } break; }
          }
          if (start) query = query.gte("timestamp", start.toISOString());
          if (end) query = query.lte("timestamp", end.toISOString());
        }
      } else if (activeView === "rekap_console") {
        query = query
          .eq("type", "rental")
          .not("reference_id", "ilike", "MOVE_RENTAL-%");

        if (selectedPeriod !== "all") {
          const now = new Date();
          let start: Date | null = new Date();
          let end: Date | null = null;

          switch (selectedPeriod) {
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
            case "last_week": {
              start = new Date();
              start.setDate(start.getDate() - 7);
              start.setHours(0, 0, 0, 0);
              end = new Date();
              end.setDate(end.getDate() - 1);
              end.setHours(23, 59, 59, 999);
              break;
            }
            case "month": {
              start = new Date(now.getFullYear(), now.getMonth(), 1);
              end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              end.setHours(23, 59, 59, 999);
              break;
            }
            case "last_month": {
              const currentDate = new Date();
              start = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth() - 1,
                1
              );
              end = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                0
              );
              end.setHours(23, 59, 59, 999);
              break;
            }
            case "range": {
              if (startDate) {
                start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
              }
              if (endDate) {
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
              }
              break;
            }
          }
          if (start) query = query.gte("timestamp", start.toISOString());
          if (end) query = query.lte("timestamp", end.toISOString());
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengambil data laba rugi"
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch data from database
  const fetchEntries = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("bookkeeping_entries")
        .select("*")
        .order("entry_date", { ascending: false });

      // Apply period filter
      if (selectedPeriod) {
        const now = new Date();
        let start: Date | null = null;
        let end: Date | null = null;

        switch (selectedPeriod) {
          case "today": {
            start = new Date();
            end = new Date();
            break;
          }
          case "yesterday": {
            start = new Date();
            start.setDate(start.getDate() - 1);
            end = new Date(start);
            break;
          }
          case "week": {
            start = new Date();
            const day = start.getDay();
            const diff = (day === 0 ? -6 : 1) - day;
            start.setDate(start.getDate() + diff);
            // start.setHours(0, 0, 0, 0);
            end = new Date();
            // end.setHours(23, 59, 59, 999);
            break;
          }
          case "last_week": {
            start = new Date();
            start.setDate(start.getDate() - 7);
            // start.setHours(0, 0, 0, 0);
            end = new Date();
            end.setDate(end.getDate() - 1);
            // end.setHours(23, 59, 59, 999);
            break;
          }
          case "month": {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            // end.setHours(23, 59, 59, 999);
            break;
          }
          case "last_month": {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
            // end.setHours(23, 59, 59, 999);
            break;
          }
          case "range": {
            if (startDate) {
              start = new Date(startDate);
              // start.setHours(0, 0, 0, 0);
            }
            if (endDate) {
              end = new Date(endDate);
              // end.setHours(23, 59, 59, 999);
            }
            break;
          }
        }

        if (start) {
          query = query.gte("entry_date", start.toISOString().split("T")[0]);
        }
        if (end) {
          query = query.lte("entry_date", end.toISOString().split("T")[0]);
        }
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setEntries(data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil data"
      );
      console.error("Gagal mengambil data pembukuan");
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount and filter changes
  useEffect(() => {
    if (
      activeView === "laba_rugi" ||
      activeView === "rekap_kasir" ||
      activeView === "rekap_console" ||
      activeView === "history_discount"
    ) {
      fetchTransaction();
    } else if (activeView === "laporan_kasir") {
      if (selectedSessionId) {
        fetchTransaction();
      } else {
        setTransactions([]);
      }
    } else {
      fetchEntries();
    }
  }, [selectedPeriod, activeView, selectedSessionId, startDate, endDate]);

  useEffect(() => {
    setLabaRugiSubTab("detail");
    setTransaksiKasirSubTab("detail");
    setRekapConsoleViewSubTab("detail");
    setJurnalSubTab("detail");
  }, [activeView]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, activeView, debouncedSearchTerm]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Ambil daftar sesi
  const fetchSessions = async () => {
    try {
      if (
        activeView !== "laporan_kasir" &&
        activeView !== "rekap_kasir" &&
        activeView !== "history_discount" &&
        jurnalSubTab !== "setoran"
      )
        return;

      setLoading(true);
      // Fetch all sessions for reports
      const { data: allSessions, error: allErr } = await supabase
        .from("cashier_sessions")
        .select("*")
        .order("start_time", { ascending: false });

      if (allErr) throw allErr;
      setSessions(allSessions || []);

      if (!selectedSessionId && (allSessions || []).length > 0) {
        setSelectedSessionId((allSessions as any[])[0].id);
      }

      // Fetch undeposited sessions for "Setoran" tab
      const { data: undeposited, error: undepErr } = await supabase
        .from("cashier_sessions")
        .select("*")
        .eq("status", "closed")
        .eq("is_deposited", false)
        .order("end_time", { ascending: false });

      if (undepErr) throw undepErr;
      setUndepositedSessions(undeposited || []);
    } catch (e) {
      console.error("Error fetching sessions:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [activeView, selectedSessionId, activeTab, jurnalSubTab]);

  // Pagination
  const sourceList = useMemo(
    () =>
      activeView === "laba_rugi" ||
      activeView === "laporan_kasir" ||
      activeView === "rekap_kasir"
        ? transactions
        : entries,
    [activeView, transactions, entries]
  );

  // const filteredByTab = useMemo(() => {
  //   if (activeView === "jurnal" && activeTab === "income")
  //     return sourceList.filter(
  //       (e) => e.type === "income" || e.type === "sale" || e.type === "rental"
  //     );
  //   if (activeView === "jurnal" && activeTab === "expense")
  //     return sourceList.filter((e) => e.type === "expense");
  //   if (activeView === "laba_rugi" && activeTab === "rental")
  //     return sourceList.filter((e) => e.type === "rental");
  //   if (activeView === "laba_rugi" && activeTab === "sale")
  //     return sourceList.filter((e) => e.type === "sale");
  //   if (activeView === "laba_rugi" && activeTab === "voucher")
  //     return sourceList.filter((e) => e.type === "voucher");
  //   if (activeView === "laporan_kasir" && activeTab === "income")
  //     return sourceList.filter(
  //       (e) =>
  //         e.type === "income" ||
  //         e.type === "sale" ||
  //         e.type === "rental" ||
  //         e.type === "voucher"
  //     );
  //   // Filter berdasarkan metode pembayaran
  //   if (paymentMethodFilter === "cash") {
  //     sourceList = sourceList.filter((e) => (e.payment_method || "cash") === "cash");
  //   } else if (paymentMethodFilter === "non-cash") {
  //     sourceList = sourceList.filter((e) => (e.payment_method || "cash") !== "cash");
  //   }
  //   if (activeView === "laporan_kasir" && activeTab === "expense")
  //     return sourceList.filter((e) => e.type === "expense");
  //   return sourceList;
  // }, [sourceList, activeTab, activeView]);

  const filteredByTab = useMemo(() => {
    let list = sourceList;
    if (activeView === "jurnal" && activeTab === "income")
      list = list.filter(
        (e) => e.type === "income" || e.type === "sale" || e.type === "rental"
      );
    if (activeView === "jurnal" && activeTab === "expense")
      list = list.filter((e) => e.type === "expense");
    if (activeView === "laba_rugi" && activeTab === "rental")
      list = list.filter((e) => e.type === "rental");
    if (activeView === "laba_rugi" && activeTab === "sale")
      list = list.filter((e) => e.type === "sale");
    // if (activeView === "laba_rugi" && activeTab === "voucher")
    //   list = list.filter((e) => e.type === "voucher");
    if (activeView === "laporan_kasir" && activeTab === "income") {
      list = list.filter(
        (e) =>
          e.type === "income" ||
          e.type === "sale" ||
          e.type === "rental" ||
          e.type === "voucher"
      );

      // Filter berdasarkan metode pembayaran
      if (paymentMethodFilter === "cash") {
        list = list.filter((e) => (e.payment_method || "cash") === "cash");
      } else if (paymentMethodFilter === "non-cash") {
        list = list.filter((e) => (e.payment_method || "cash") !== "cash");
      }
    }
    if (activeView === "laporan_kasir" && activeTab === "expense")
      list = list.filter((e) => e.type === "expense");
    return list;
  }, [sourceList, activeTab, activeView, paymentMethodFilter]);

  const incomeCount = useMemo(
    () =>
      sourceList.filter(
        (e) =>
          e.type === "income" ||
          e.type === "sale" ||
          e.type === "rental" ||
          e.type === "voucher"
      ).length,
    [activeView, sourceList]
  );
  const expenseCount = useMemo(
    () => sourceList.filter((e) => e.type === "expense").length,
    [activeView, sourceList]
  );
  const rentalCount = useMemo(
    () => sourceList.filter((e) => e.type === "rental").length,
    [activeView, sourceList]
  );
  const saleCount = useMemo(
    () => sourceList.filter((e) => e.type === "sale").length,
    [activeView, sourceList]
  );
  // const voucherCount = useMemo(
  //   () => sourceList.filter((e) => e.type === "voucher").length,
  //   [activeView, sourceList]
  // );
  // Ringkasan pembayaran untuk Laporan Kasir
  const paymentSummary = useMemo(() => {
    const incomeTypes = new Set(["sale", "rental", "voucher"]);
    const list = transactions.filter((t: any) => incomeTypes.has(t.type));

    const normalizeMethod = (method: any) => {
      const m = (method || "cash").toString().toLowerCase();
      if (m === "debit" || m === "kartu" || m === "card") return "card";
      if (m === "transfer" || m === "tf" || m === "bank") return "transfer";
      return m === "cash" ? "cash" : m;
    };

    let cashAmount = 0;
    let cardAmount = 0;
    let transferAmount = 0;
    let cashCount = 0;
    let cardCount = 0;
    let transferCount = 0;
    let totalRevenue = 0;

    for (const t of list) {
      const amount = Number(t.amount) || 0;
      totalRevenue += amount;
      const method = normalizeMethod(t.payment_method);
      if (method === "cash") {
        cashAmount += amount;
        cashCount += 1;
      } else if (method === "card") {
        cardAmount += amount;
        cardCount += 1;
      } else if (method === "transfer") {
        transferAmount += amount;
        transferCount += 1;
      }
    }

    return {
      cashAmount,
      cardAmount,
      transferAmount,
      totalRevenue,
      countsByMethod: {
        cash: cashCount,
        card: cardCount,
        transfer: transferCount,
      },
    };
  }, [transactions]);

  const todayCashSales = paymentSummary.cashAmount;
  const todayCardSales = paymentSummary.cardAmount;
  const todayTransferSales = paymentSummary.transferAmount;
  const todayTotalRevenue = paymentSummary.totalRevenue;
  const paymentCounts = paymentSummary.countsByMethod;
  const totalPages = Math.ceil(filteredByTab.length / entriesPerPage);
  const paginatedData = filteredByTab.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  // Filtered entries for journal search
  const filteredEntries = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return entries;

    return entries.filter((entry) =>
      entry.description
        .toLowerCase()
        .includes(debouncedSearchTerm.toLowerCase())
    );
  }, [entries, debouncedSearchTerm]);

  const journalFilteredEntries = useMemo(() => {
    let filtered = filteredByTab;
    if (activeView === "jurnal" && debouncedSearchTerm.trim()) {
      filtered = filtered.filter((entry) =>
        entry.description
          .toLowerCase()
          .includes(debouncedSearchTerm.toLowerCase())
      );
    }
    return filtered;
  }, [filteredByTab, activeView, debouncedSearchTerm]);

  // Pagination logic for journal entries
  const journalEntriesPerPage = 20;
  const journalTotalPages = Math.ceil(
    journalFilteredEntries.length / journalEntriesPerPage
  );
  const paginatedEntries = journalFilteredEntries.slice(
    (currentPage - 1) * journalEntriesPerPage,
    currentPage * journalEntriesPerPage
  );

  // Rekap kasir per tanggal -> per sesi
  const rekapKasirByDate = useMemo(() => {
    const byDate: Record<
      string,
      {
        sessions: Record<
          string,
          { list: any[]; totalAmount: number; count: number }
        >;
      }
    > = {};
    for (const t of transactions as any[]) {
      if (!t || !t.timestamp) continue;
      const dk = new Date(t.timestamp).toISOString().slice(0, 10);
      const sid = String(t.session_id || "-");
      if (!byDate[dk]) byDate[dk] = { sessions: {} };
      if (!byDate[dk].sessions[sid])
        byDate[dk].sessions[sid] = { list: [], totalAmount: 0, count: 0 };
      byDate[dk].sessions[sid].list.push(t);
      byDate[dk].sessions[sid].totalAmount +=
        t.type === "expense" ? -Number(t.amount || 0) : Number(t.amount || 0);
      byDate[dk].sessions[sid].count += 1;
    }
    const dateKeys = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));
    return { map: byDate, dateKeys };
  }, [transactions]);

  const rekapKasirByCashier = useMemo(() => {
    const byCashier: Record<
      string,
      {
        cashierName: string;
        totalAmount: number;
        count: number;
        dates: Record<
          string,
          { list: any[]; totalAmount: number; count: number }
        >;
      }
    > = {};

    const getCashierName = (tx: any) => {
      if (tx?.cashier_id === null) return null;
      if (tx?.cashier_name) return tx.cashier_name as string;
      if (tx?.cashier_id) {
        const sess = sessions.find(
          (s: any) => String(s.cashier_id) === String(tx.cashier_id)
        );
        if (sess?.cashier_name) return sess.cashier_name as string;
      }
      if (tx?.session_id) {
        const sess = sessions.find(
          (s: any) => String(s.id) === String(tx.session_id)
        );
        if (sess?.cashier_name) return sess.cashier_name as string;
      }
      return "Kasir";
    };

    for (const t of transactions as any[]) {
      if (!t || !t.timestamp) continue;
      const cashierName = getCashierName(t);
      if (!cashierName) continue; // Skip jika cashierName null
      const cashierKey = t?.cashier_id
        ? `id:${t.cashier_id}`
        : `name:${cashierName}`;
      const dk = new Date(t.timestamp).toISOString().slice(0, 10);
      if (!byCashier[cashierKey]) {
        byCashier[cashierKey] = {
          cashierName,
          totalAmount: 0,
          count: 0,
          dates: {},
        };
      }
      if (!byCashier[cashierKey].dates[dk]) {
        byCashier[cashierKey].dates[dk] = {
          list: [],
          totalAmount: 0,
          count: 0,
        };
      }

      const amountDelta =
        t.type === "expense" ? -Number(t.amount || 0) : Number(t.amount || 0);

      byCashier[cashierKey].dates[dk].list.push(t);
      byCashier[cashierKey].dates[dk].totalAmount += amountDelta;
      byCashier[cashierKey].dates[dk].count += 1;

      byCashier[cashierKey].totalAmount += amountDelta;
      byCashier[cashierKey].count += 1;
    }

    const cashierKeys = Object.keys(byCashier).sort((a, b) => {
      const aTotal = byCashier[a].totalAmount;
      const bTotal = byCashier[b].totalAmount;
      if (aTotal === bTotal) return 0;
      return aTotal < bTotal ? 1 : -1;
    });

    return { map: byCashier, cashierKeys };
  }, [sessions, transactions]);

  // Rekap console per tanggal -> per console name (durasi)
  const rekapConsoleByDate = useMemo(() => {
    const byDate: Record<
      string,
      {
        consoles: Record<
          string,
          { list: any[]; totalDurationMinutes: number; count: number }
        >;
      }
    > = {};
    for (const t of transactions as any[]) {
      if (!t || !t.timestamp || t.type !== "rental") continue;
      const dk = new Date(t.timestamp).toISOString().slice(0, 10);
      const consoleName =
        t.details?.rental?.console ||
        t.details?.items?.[0]?.name ||
        t.details?.items?.[0]?.product_name ||
        "Unknown Console";
      const durationMinutes =
        t.details?.rental?.duration_minutes ||
        t.details?.duration_minutes ||
        t.details?.additional_duration_minutes ||
        0;
      if (!byDate[dk]) byDate[dk] = { consoles: {} };
      if (!byDate[dk].consoles[consoleName])
        byDate[dk].consoles[consoleName] = {
          list: [],
          totalDurationMinutes: 0,
          count: 0,
        };
      byDate[dk].consoles[consoleName].list.push(t);
      byDate[dk].consoles[consoleName].totalDurationMinutes += durationMinutes;
      byDate[dk].consoles[consoleName].count += 1;
    }
    const dateKeys = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));
    return { map: byDate, dateKeys };
  }, [transactions]);

  // Rekap console per console name -> per tanggal
  const rekapConsoleByConsole = useMemo(() => {
    const byConsole: Record<
      string,
      {
        consoleName: string;
        totalDurationMinutes: number;
        count: number;
        dates: Record<
          string,
          { list: any[]; totalDurationMinutes: number; count: number }
        >;
      }
    > = {};

    for (const t of transactions as any[]) {
      if (!t || !t.timestamp || t.type !== "rental") continue;
      const consoleName =
        t.details?.rental?.console ||
        t.details?.items?.[0]?.name ||
        t.details?.items?.[0]?.product_name ||
        "Unknown Console";
      const durationMinutes =
        t.details?.rental?.duration_minutes ||
        t.details?.duration_minutes ||
        t.details?.additional_duration_minutes ||
        0;

      if (!byConsole[consoleName]) {
        byConsole[consoleName] = {
          consoleName,
          totalDurationMinutes: 0,
          count: 0,
          dates: {},
        };
      }

      const dk = new Date(t.timestamp).toISOString().slice(0, 10);
      if (!byConsole[consoleName].dates[dk]) {
        byConsole[consoleName].dates[dk] = {
          list: [],
          totalDurationMinutes: 0,
          count: 0,
        };
      }

      byConsole[consoleName].dates[dk].list.push(t);
      byConsole[consoleName].dates[dk].totalDurationMinutes += durationMinutes;
      byConsole[consoleName].dates[dk].count += 1;

      byConsole[consoleName].totalDurationMinutes += durationMinutes;
      byConsole[consoleName].count += 1;
    }

    const consoleNames = Object.keys(byConsole).sort((a, b) => {
      const aTotal = byConsole[a].totalDurationMinutes;
      const bTotal = byConsole[b].totalDurationMinutes;
      if (aTotal === bTotal) return 0;
      return aTotal < bTotal ? 1 : -1;
    });

    return { map: byConsole, consoleNames };
  }, [transactions]);

  // Rekap laba rugi per tanggal (untuk tab rekap di laba_rugi)
  const rekapByDate = useMemo(() => {
    const map: Record<
      string,
      {
        rentalProfit: number;
        cafeProfit: number;
        voucherProfit: number;
        totalProfit: number;
        count: number;
      }
    > = {};
    for (const t of transactions as any[]) {
      if (!t || !t.timestamp) continue;
      const type = String(t.type || "");
      if (type !== "rental" && type !== "sale" && type !== "voucher") continue;
      const dk = new Date(t.timestamp).toISOString().slice(0, 10);
      const profit = (t?.details?.items || []).reduce(
        (s: number, it: any) => s + (Number(it?.profit) || 0),
        0
      );
      if (!map[dk]) {
        map[dk] = {
          rentalProfit: 0,
          cafeProfit: 0,
          voucherProfit: 0,
          totalProfit: 0,
          count: 0,
        };
      }
      if (type === "rental") map[dk].rentalProfit += profit;
      else if (type === "sale") map[dk].cafeProfit += profit;
      else if (type === "voucher") map[dk].voucherProfit += profit;
      map[dk].totalProfit += profit;
      map[dk].count += 1;
    }
    const dateKeys = Object.keys(map).sort((a, b) => (a < b ? 1 : -1));
    return { map, dateKeys };
  }, [transactions]);

  //Transaction profit calculation
  const profitSummary: Summary = useMemo(() => {
    // const incomeTypes = new Set(["sale", "rental", "income"]);
    const totalRental = transactions
      .filter((t: any) => t.type === "rental")
      .reduce((sum: number, t: any) => {
        const itemProfits = (t.details?.items || []).reduce(
          (itemSum: number, item: any) => itemSum + (Number(item.profit) || 0),
          0
        );
        return sum + itemProfits;
      }, 0);

    const totalCafe = transactions
      .filter((t: any) => t.type === "sale")
      .reduce((sum: number, t: any) => {
        const itemProfits = (t.details?.items || []).reduce(
          (itemSum: number, item: any) => itemSum + (Number(item.profit) || 0),
          0
        );
        return sum + itemProfits;
      }, 0);

    const netProfit = totalRental + totalCafe;
    return { totalRental, totalCafe, netProfit };
  }, [transactions]);

  // Financial calculations
  const financialSummary: Summary = useMemo(() => {
    const totalIncome = entries
      .filter((entry) => entry.type === "income")
      .reduce((sum, entry) => sum + entry.amount, 0);

    const totalExpense = entries
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + entry.amount, 0);

    const netProfit = totalIncome - totalExpense;

    return { totalIncome, totalExpense, netProfit };
  }, [entries]);

  const summary = activeView === "laba_rugi" ? profitSummary : financialSummary;

  // ===== Utilities untuk Laporan Kasir =====
  const getTransactionItems = (t: any) => {
    const d = t?.details ?? t?.metadata ?? {};
    const items = t?.items ?? d?.items ?? d?.line_items ?? [];
    const discount = d?.discount ?? 0;
    return Array.isArray(items) ? { items, discount } : { items: [], discount };
  };

  const convertTransactionToReceiptData = (transaction: any) => {
    const txItems = getTransactionItems(transaction);
    const items = txItems.items;
    const discount = txItems.discount;

    const receiptItems = items.map((item: any) => ({
      name: item.name || item.product_name || item.title || "Item",
      type:
        transaction.type === "sale"
          ? ("product" as const)
          : ("rental" as const),
      quantity: Number(item.qty || item.quantity || 1),
      total: Number(item.total || item.price || 0),
      description: item.description || "",
    }));

    if (receiptItems.length === 0) {
      receiptItems.push({
        name: transaction.description || "Transaksi",
        type:
          transaction.type === "sale"
            ? ("product" as const)
            : ("rental" as const),
        quantity: 1,
        total: Number(transaction.amount || 0),
        description: "",
      });
    }

    return {
      id: `COPY ${transaction.reference_id}` || `TXN-${transaction.id}`,
      timestamp: new Date(transaction.timestamp).toLocaleString("id-ID"),
      customer: { name: transaction.customer_name || "Customer" },
      items: receiptItems,
      subtotal: Number(transaction.amount || 0) + (discount?.amount || 0),
      tax: 0,
      discount: discount?.amount
        ? {
            type: "amount" as const,
            value: discount.amount,
            amount: discount.amount,
          }
        : undefined,
      total: Number(transaction.amount || 0),
      paymentMethod: transaction.payment_method || "cash",
      paymentAmount: transaction.details?.payment?.amount,
      change: transaction.details?.payment?.change,
      cashier: transaction.cashier_name || "Kasir",
    };
  };

  const handlePrintReceipt = (transaction: any) => {
    try {
      const receiptData = convertTransactionToReceiptData(transaction);
      printReceipt(receiptData);
    } catch (error) {
      console.error("Error printing receipt:", error);
      Swal.fire("Error", "Gagal mencetak struk. Silakan coba lagi.", "error");
    }
  };

  // Utility functions
  const getCategoryColor = (category: string) => {
    const colors = {
      rental: "bg-blue-100 text-blue-800",
      cafe: "bg-green-100 text-green-800",
      inventory: "bg-orange-100 text-orange-800",
      operational: "bg-red-100 text-red-800",
      voucher: "bg-purple-100 text-purple-800",
      other: "bg-gray-100 text-gray-800",
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  const getTypeIcon = (type: string) => {
    return type === "income" ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    );
  };

  // Handle form submission
  const handleAddEntry = async () => {
    // Validation
    if (!newEntry.description.trim()) {
      alert("Deskripsi transaksi harus diisi");
      return;
    }

    if (newEntry.amount <= 0) {
      alert("Jumlah transaksi harus lebih dari 0");
      return;
    }

    try {
      setSaving(true);

      const { error: insertError } = await supabase
        .from("bookkeeping_entries")
        .insert([
          {
            entry_date: newEntry.date,
            type: newEntry.type,
            category: newEntry.category,
            description: newEntry.description.trim(),
            amount: newEntry.amount,
            reference: newEntry.reference.trim() || null,
            notes: newEntry.notes.trim() || null,
          },
        ]);

      if (insertError) throw insertError;

      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Transaksi berhasil ditambahkan!",
        confirmButtonColor: "#3b82f6",
      });
      setShowAddForm(false);

      // Reset form
      setNewEntry({
        type: "income",
        category: "rental",
        description: "",
        amount: 0,
        date: new Date().toISOString().split("T")[0],
        reference: "",
        notes: "",
      });

      // Refresh data
      await fetchEntries();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan";
      console.error(errorMessage);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Handle entry edit
  const handleEditEntry = async () => {
    if (!editEntry) return;

    if (!editEntry.description.trim()) {
      alert("Deskripsi transaksi harus diisi");
      return;
    }

    if (editEntry.amount <= 0) {
      alert("Jumlah transaksi harus lebih dari 0");
      return;
    }

    try {
      setSaving(true);

      const { error: updateError } = await supabase
        .from("bookkeeping_entries")
        .update({
          entry_date: editEntry.entry_date,
          type: editEntry.type,
          category: editEntry.category,
          description: editEntry.description.trim(),
          amount: editEntry.amount,
          reference: editEntry.reference?.trim() || null,
          notes: editEntry.notes?.trim() || null,
        })
        .eq("id", editEntry.id);

      if (updateError) throw updateError;

      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Transaksi berhasil diperbarui!",
        confirmButtonColor: "#3b82f6",
      });
      setShowEditForm(false);
      setEditEntry(null);

      await fetchEntries();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan";
      console.error(errorMessage);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Handle deposit sessions
  const handleDepositSessions = async () => {
    if (selectedSessions.size === 0) {
      Swal.fire("Info", "Pilih minimal satu sesi untuk disetor.", "info");
      return;
    }

    const selectedSetoranTotal = undepositedSessions
      .filter((s) => selectedSessions.has(s.id))
      .reduce(
        (sum, s) => sum + (Number(s.total_cash || 0) - Number(s.total_expense || 0)),
        0
      );

    const { isConfirmed } = await Swal.fire({
      title: "Konfirmasi Setoran",
      html: `<p>Apakah Anda yakin ingin menyetor ${selectedSessions.size} sesi terpilih ke jurnal umum?</p><p style="margin-top:8px;"><strong>Total Setoran: Rp ${selectedSetoranTotal.toLocaleString("id-ID")}</strong></p>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Setor",
      cancelButtonText: "Batal",
      confirmButtonColor: "#3b82f6",
    });

    if (!isConfirmed) return;

    try {
      setSaving(true);

      const sessionsToDeposit = undepositedSessions.filter((s) =>
        selectedSessions.has(s.id)
      );

      for (const session of sessionsToDeposit) {
        const cafeRevenue = Number(session.total_sales || 0);
        const rentalRevenue = Number(session.total_rentals || 0);
        const voucherRevenue = Number(session.total_vouchers || 0);
        const incomeRevenue = Number(session.total_income || 0);
        const totalRevenue = Number(session.total_revenue || 0);

        if (totalRevenue > 0) {
          // Insert into bookkeeping_entries
          const { error: insertError } = await supabase
            .from("bookkeeping_entries")
            .insert([
              {
                entry_date: new Date(session.end_time || new Date())
                  .toISOString()
                  .split("T")[0],
                type: "income",
                category: "rental",
                description: `Pendapatan Sesi Kasir - ${session.cashier_name}`,
                amount: totalRevenue,
                reference: `SESSION-${session.id}`,
                notes: `Cafe: Rp ${cafeRevenue.toLocaleString(
                  "id-ID"
                )} | Rental: Rp ${rentalRevenue.toLocaleString(
                  "id-ID"
                )} | Voucher: Rp ${voucherRevenue.toLocaleString(
                  "id-ID"
                )} | Modal/Lain: Rp ${incomeRevenue.toLocaleString("id-ID")}`,
              },
            ]);

          if (insertError) throw insertError;
        }

        // Update session is_deposited status
        const { error: updateError } = await supabase
          .from("cashier_sessions")
          .update({ is_deposited: true })
          .eq("id", session.id);

        if (updateError) throw updateError;
      }

      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: `${selectedSessions.size} sesi berhasil disetor ke jurnal umum!`,
        confirmButtonColor: "#3b82f6",
      });

      setSelectedSessions(new Set());
      await fetchEntries();
      await fetchSessions();
    } catch (err) {
      console.error("Error depositing sessions:", err);
      Swal.fire("Error", "Gagal melakukan setoran. Silakan coba lagi.", "error");
    } finally {
      setSaving(false);
    }
  };

  const renderSetoranTab = () => {
    const selectedSessionsData = undepositedSessions.filter(s => selectedSessions.has(s.id));
    const grandTotal = selectedSessionsData.reduce((sum, s) => sum + Number(s.total_revenue || 0), 0);
    const grandTotalCash = selectedSessionsData.reduce((sum, s) => sum + Number(s.total_cash || 0), 0);
    const grandTotalNonCash = selectedSessionsData.reduce((sum, s) => sum + Number(s.total_card || 0) + Number(s.total_transfer || 0), 0);
    const grandTotalExpense = selectedSessionsData.reduce((sum, s) => sum + Number(s.total_expense || 0), 0);
    const grandTotalSetoran = selectedSessionsData.reduce(
      (sum, s) => sum + (Number(s.total_cash || 0) - Number(s.total_expense || 0)),
      0
    );
    const footerSummary = selectedSessionsData.reduce(
      (summary, session) => {
        const cafe = Number(session.total_sales || 0);
        const rental = Number(session.total_rentals || 0);
        const voucher = Number(session.total_vouchers || 0);
        const otherIncome = Number(session.total_income || 0);
        const expense = Number(session.total_expense || 0);
        const cash = Number(session.total_cash || 0);
        const nonCash =
          Number(session.total_card || 0) + Number(session.total_transfer || 0);
        const total = Number(session.total_revenue || 0) - expense;
        const setoran = cash - expense;

        return {
          total: summary.total + total,
          cash: summary.cash + cash,
          nonCash: summary.nonCash + nonCash,
          expense: summary.expense + expense,
          setoran: summary.setoran + setoran,
          cafe: summary.cafe + cafe,
          rental: summary.rental + rental,
          voucher: summary.voucher + voucher,
          otherIncome: summary.otherIncome + otherIncome,
        };
      },
      {
        total: 0,
        cash: 0,
        nonCash: 0,
        expense: 0,
        setoran: 0,
        cafe: 0,
        rental: 0,
        voucher: 0,
        otherIncome: 0,
      }
    );
    

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Setoran Kasir Pending
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Daftar sesi kasir yang sudah ditutup tetapi belum dicatat di
              jurnal umum.
            </p>
          </div>
          <div className="flex items-center gap-6">
            {selectedSessions.size > 0 && (
              <div className="text-right border-r border-gray-200 pr-6">
                <p className="text-sm text-gray-500 font-medium tracking-wide">Grand Total Terpilih</p>
                <div className="flex gap-4 mt-1">
                  <span className="text-xl font-bold text-green-600">Rp {grandTotal.toLocaleString("id-ID")}</span>
                  <div className="flex flex-col text-xs text-gray-500 justify-center">
                    <span>Cash: Rp {grandTotalCash.toLocaleString("id-ID")}</span>
                    <span>QRIS: Rp {grandTotalNonCash.toLocaleString("id-ID")}</span>
                    <span>Pengeluaran: Rp {grandTotalExpense.toLocaleString("id-ID")}</span>
                    <span>Setoran: Rp {grandTotalSetoran.toLocaleString("id-ID")}</span>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={handleDepositSessions}
              disabled={selectedSessions.size === 0 || saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              Setor ke Jurnal Umum ({selectedSessions.size})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      undepositedSessions.length > 0 &&
                      selectedSessions.size === undepositedSessions.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSessions(
                          new Set(undepositedSessions.map((s) => s.id))
                        );
                      } else {
                        setSelectedSessions(new Set());
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Waktu Mulai
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kasir
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Pendapatan
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Non-Cash (QRIS)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cash
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-red-500 uppercase tracking-wider">
                  Pengeluaran
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Setoran
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rincian (Cafe | Rental | Voucher)
                </th>
                
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {undepositedSessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    Tidak ada setoran pending.
                  </td>
                </tr>
              ) : (
                undepositedSessions.map((session) => {
                  const cafe = Number(session.total_sales || 0);
                  const rental = Number(session.total_rentals || 0);
                  const voucher = Number(session.total_vouchers || 0);
                  const total = Number(session.total_revenue || 0) - Number(session.total_expense || 0);
                  const expense = Number(session.total_expense || 0);
                  const cash = Number(session.total_cash || 0);
                  const nonCash = Number(session.total_card || 0) + Number(session.total_transfer || 0);
                  const setoran = Number(session.total_cash || 0) - Number(session.total_expense || 0);

                  return (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedSessions.has(session.id)}
                          onChange={() => {
                            const next = new Set(selectedSessions);
                            if (next.has(session.id)) next.delete(session.id);
                            else next.add(session.id);
                            setSelectedSessions(next);
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(session.start_time).toLocaleString("id-ID")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {session.cashier_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-green-600">
                        Rp {total.toLocaleString("id-ID")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-blue-600">
                        Rp {nonCash.toLocaleString("id-ID")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        Rp {cash.toLocaleString("id-ID")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-500">
                        Rp {expense.toLocaleString("id-ID")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-black-500">
                        Rp {setoran.toLocaleString("id-ID")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        Cafe: Rp {cafe.toLocaleString("id-ID")} | Rental: Rp{" "}
                        {rental.toLocaleString("id-ID")} | Voucher: Rp{" "}
                        {voucher.toLocaleString("id-ID")} | Modal/Lain: Rp{" "}
                        {Number(session.total_income || 0).toLocaleString(
                          "id-ID"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {undepositedSessions.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-sm font-semibold text-gray-900">
                    Grand Total Terpilih
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-green-700">
                    Rp {footerSummary.total.toLocaleString("id-ID")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-blue-700">
                    Rp {footerSummary.nonCash.toLocaleString("id-ID")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                    Rp {footerSummary.cash.toLocaleString("id-ID")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-red-600">
                    Rp {footerSummary.expense.toLocaleString("id-ID")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                    Rp {footerSummary.setoran.toLocaleString("id-ID")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-600">
                    Cafe: Rp {footerSummary.cafe.toLocaleString("id-ID")} | Rental: Rp{" "}
                    {footerSummary.rental.toLocaleString("id-ID")} | Voucher: Rp{" "}
                    {footerSummary.voucher.toLocaleString("id-ID")} | Modal/Lain: Rp{" "}
                    {footerSummary.otherIncome.toLocaleString("id-ID")}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  };

  // Handle entry deletion
  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) return;

    try {
      const { error: deleteError } = await supabase
        .from("bookkeeping_entries")
        .delete()
        .eq("id", entryId);

      if (deleteError) throw deleteError;

      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Transaksi berhasil dihapus!",
        confirmButtonColor: "#3b82f6",
      });
      await fetchEntries();
    } catch (err) {
      console.error("Gagal menghapus transaksi");
    }
  };

  // const handleDeleteTransaction = async (transactionId: string) => {
  //   const result = await Swal.fire({
  //     title: "Konfirmasi Hapus",
  //     text: "Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.",
  //     icon: "warning",
  //     showCancelButton: true,
  //     confirmButtonColor: "#d33",
  //     cancelButtonColor: "#3085d6",
  //     confirmButtonText: "Ya, Hapus!",
  //     cancelButtonText: "Batal",
  //   });

  //   if (!result.isConfirmed) return;

  //   try {
  //     setSaving(true);

  //     const { error: deleteError } = await supabase
  //       .from("cashier_transactions")
  //       .delete()
  //       .eq("id", transactionId);

  //     if (deleteError) throw deleteError;

  //     Swal.fire({
  //       icon: "success",
  //       title: "Berhasil",
  //       text: "Transaksi berhasil dihapus!",
  //       confirmButtonColor: "#3b82f6",
  //     });

  //     // Refresh transaction data
  //     await fetchTransaction();
  //   } catch (err) {
  //     console.error("Gagal menghapus transaksi:", err);
  //     Swal.fire({
  //       icon: "error",
  //       title: "Error",
  //       text: "Gagal menghapus transaksi. Silakan coba lagi.",
  //       confirmButtonColor: "#3b82f6",
  //     });
  //   } finally {
  //     setSaving(false);
  //   }
  // };

  const handleDeleteTransaction = async (transactionId: string) => {
    const result = await Swal.fire({
      title: "Konfirmasi Hapus",
      text: "Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Ya, Hapus!",
      cancelButtonText: "Batal",
    });

    if (!result.isConfirmed) return;

    try {
      setSaving(true);

      const { data: transactionToDelete, error: fetchError } = await supabase
        .from("cashier_transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (fetchError) throw fetchError;

      if (transactionToDelete.type === "sale") {
        const items =
          transactionToDelete?.details?.items ??
          transactionToDelete?.metadata?.items ??
          [];

        for (const item of items) {
          if (item.type !== "rental" && item.product_id && item.quantity) {
            await db.products.increaseStock(
              String(item.product_id),
              Number(item.quantity)
            );
          }
        }
      }

      const { error: deleteError } = await supabase
        .from("cashier_transactions")
        .delete()
        .eq("id", transactionId);

      if (deleteError) throw deleteError;

      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Transaksi berhasil dihapus!",
        confirmButtonColor: "#3b82f6",
      });

      // Refresh transaction data
      await fetchTransaction();
    } catch (err) {
      console.error("Gagal menghapus transaksi:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Gagal menghapus transaksi. Silakan coba lagi.",
        confirmButtonColor: "#3b82f6",
      });
    } finally {
      setSaving(false);
    }
  };

  // ===== Edit Transaksi (Laporan Kasir) =====
  const [showEditTxModal, setShowEditTxModal] = useState(false);
  const [editTx, setEditTx] = useState<any | null>(null);
  const [editTxItems, setEditTxItems] = useState<any[]>([]);

  const openEditTransaction = (transaction: any) => {
    // Hanya izinkan edit untuk tipe sale (mempengaruhi stok)
    // if (transaction.type !== "sale") {
    //   Swal.fire(
    //     "Info",
    //     "Hanya transaksi penjualan (cafe) yang bisa diedit.",
    //     "info"
    //   );
    //   return;
    // }
    const d = transaction?.details ?? transaction?.metadata ?? {};
    const items = Array.isArray(d.items) ? d.items : [];
    // Siapkan field standar: id, productId, name, price, quantity, total
    const normalized = items.map((it: any, idx: number) => ({
      id: it.id ?? idx,
      productId: it.product_id ?? it.productId ?? it.id ?? null,
      name: it.name ?? it.product_name ?? it.title ?? it.description ?? "Item",
      price: Number(it.price ?? 0),
      quantity: Number(it.qty ?? it.quantity ?? 1),
      total: Number(
        it.total ?? Number(it.price ?? 0) * Number(it.qty ?? it.quantity ?? 1)
      ),
      type: it.type || "product",
    }));
    setEditTx(transaction);
    setEditTxItems(normalized);
    setShowEditTxModal(true);
  };

  const updateEditItemQuantity = (index: number, qty: number) => {
    setEditTxItems((prev) => {
      const next = [...prev];
      const it = { ...next[index] };
      const newQty = Math.max(0, Math.floor(Number(qty) || 0));
      it.quantity = newQty;
      it.total = Number(it.price || 0) * newQty;
      next[index] = it;
      return next;
    });
  };

  const removeEditItem = (index: number) => {
    setEditTxItems((prev) => prev.filter((_, i) => i !== index));
  };

  const saveEditedTransaction = async () => {
    if (!editTx) return;
    try {
      setSaving(true);

      // Ambil items lama untuk hitung delta stok
      const oldItemsRaw = (editTx?.details?.items ??
        editTx?.metadata?.items ??
        []) as any[];
      const oldItems = oldItemsRaw.map((it: any, idx: number) => ({
        productId: it.product_id ?? it.productId ?? it.id ?? null,
        quantity: Number(it.qty ?? it.quantity ?? 1),
        type: it.type || "product",
      }));

      // Hitung delta per productId untuk item type product (bukan rental)
      const deltaByProduct: Record<string, number> = {};
      for (const it of oldItems) {
        if (!it.productId || it.type === "rental") continue;
        const pid = String(it.productId);
        deltaByProduct[pid] =
          (deltaByProduct[pid] || 0) - Number(it.quantity || 0);
      }
      for (const it of editTxItems) {
        if (!it.productId || it.type === "rental") continue;
        const pid = String(it.productId);
        deltaByProduct[pid] =
          (deltaByProduct[pid] || 0) + Number(it.quantity || 0);
      }

      // Recalculate amount
      const newAmount = editTxItems.reduce(
        (sum, it) =>
          sum +
          (Number(it.total) ||
            Number(it.price || 0) * Number(it.quantity || 0)),
        0
      );

      // Susun details baru
      const newDetails = {
        ...(editTx.details || {}),
        items: editTxItems.map((it) => ({
          id: it.id,
          product_id: it.productId,
          name: it.name,
          price: it.price,
          qty: it.quantity,
          total: it.total,
          type: it.type,
        })),
      };

      // Update transaksi
      const { error: updErr } = await supabase
        .from("cashier_transactions")
        .update({ amount: newAmount, details: newDetails })
        .eq("id", editTx.id);
      if (updErr) throw updErr;

      // Terapkan penyesuaian stok per delta
      for (const [productId, delta] of Object.entries(deltaByProduct)) {
        if (!productId) continue;
        const d = Number(delta);
        if (d > 0) {
          // butuh stok tambahan
          await db.products.decreaseStock(productId, d);
        } else if (d < 0) {
          // kembalikan stok
          await db.products.increaseStock(productId, Math.abs(d));
        }
      }

      // Refresh
      await fetchTransaction();
      setShowEditTxModal(false);
      setEditTx(null);
      setEditTxItems([]);
      Swal.fire("Berhasil", "Transaksi berhasil diperbarui.", "success");
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Gagal memperbarui transaksi.", "error");
    } finally {
      setSaving(false);
    }
  };

  const renderRekapTahunan = () => {
    if (rekapTahunanLoading) {
      return (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      );
    }

    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const monthlyBreakdown = months.map(() => ({ total: 0 }));
    let grandTotal = 0;

    rekapTahunanData.forEach(tx => {
      const d = new Date(tx.timestamp);
      if (d.getFullYear() === rekapTahunanYear) {
        const monthIndex = d.getMonth();
        const val = Number(tx.amount || 0);
        const amt = tx.type === "expense" ? -val : val;
        monthlyBreakdown[monthIndex].total += amt;
        grandTotal += amt;
      }
    });

    return (
      <div className="space-y-6 pt-2">
        <div className="flex justify-between items-center px-6 py-4 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="text-lg font-semibold text-gray-800">Rekap Tahunan</div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 font-medium">Pilih Tahun:</label>
            <div className="relative">
              <select
                value={rekapTahunanYear}
                onChange={(e) => setRekapTahunanYear(Number(e.target.value))}
                className="appearance-none pl-4 pr-10 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer hover:bg-white"
              >
                {[...Array(10)].map((_, i) => {
                  const y = new Date().getFullYear() - 5 + i;
                  return (
                    <option key={y} value={y}>{y}</option>
                  );
                })}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-gray-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {months.map((m, idx) => {
            const data = monthlyBreakdown[idx];
            return (
              <div key={m} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center transition-transform hover:-translate-y-1 hover:shadow-md">
                <div className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">{m}</div>
                <div className={`text-xl font-bold ${data.total >= 0 ? "text-green-600" : "text-red-500"}`}>
                  Rp {data.total.toLocaleString("id-ID")}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6 lg:p-8 mt-6 flex flex-col sm:flex-row sm:justify-between sm:items-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-indigo-900 opacity-20 rounded-full blur-xl"></div>
          <div className="text-lg font-medium opacity-90 z-10 mb-2 sm:mb-0">Grand Total Tahun {rekapTahunanYear}</div>
          <div className="text-4xl font-bold tracking-tight z-10 drop-shadow-sm">
            Rp {grandTotal.toLocaleString("id-ID")}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Memuat data pembukuan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Pembukuan</h1>
            <p className="text-gray-600">Kelola catatan keuangan bisnis</p>
          </div>

          <div className="flex gap-x-4">
            {/* Period Filter / Date range for laporan_kasir */}
            {activeView !== "laporan_kasir" &&
              rekapConsoleViewSubTab !== "rekap" &&
              transaksiKasirSubTab !== "rekap" &&
              labaRugiSubTab !== "rekap" &&
              jurnalSubTab !== "rekap" &&
              jurnalSubTab !== "setoran" && 
              transaksiKasirSubTab !== "rekap_tahunan" &&(
                <div className="flex items-center gap-2">
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {periods.map((period) => (
                      <option key={period.value} value={period.value}>
                        {period.label}
                      </option>
                    ))}
                  </select>
                  {selectedPeriod === "range" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-gray-500">s/d</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              )}

            {activeView === "laporan_kasir" && (
              <div className="px-6 pb-4">
                <div className="flex flex-col">
                  <label className="text-sm text-gray-600 mb-1">
                    Pilih Sesi Kasir
                  </label>

                  <button
                    onClick={() => setShowSessionModal(true)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left bg-white hover:bg-gray-50 transition-colors"
                  >
                    {selectedSessionId
                      ? sessions.find((s) => s.id === selectedSessionId)
                        ? `${
                            sessions.find((s) => s.id === selectedSessionId)
                              ?.cashier_name || "Kasir"
                          } - ${new Date(
                            sessions.find(
                              (s) => s.id === selectedSessionId
                            )?.start_time
                          ).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}`
                        : "Pilih Sesi Kasir"
                      : "Pilih Sesi Kasir"}
                  </button>
                </div>
                {/* {selectedSessionId && (
                  <div className="flex items-end text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Transaksi: {sourceList.length} entri</span>
                    </div>
                  </div>
                )} */}
              </div>
            )}

            {activeView === "jurnal" && jurnalSubTab !== "rekap" && jurnalSubTab !== "setoran"  && (
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Tambah Transaksi
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <div className="mt-4">
          {/* <div className="grid grid-cols-4 bg-gray-100 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setActiveView("jurnal")}
              className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === "jurnal"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Jurnal Umum
            </button>
            <button
              onClick={() => setActiveView("laba_rugi")}
              className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === "laba_rugi"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Laba Rugi
            </button>
            <button
              onClick={() => setActiveView("laporan_kasir")}
              className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === "laporan_kasir"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Laporan Transaksi Kasir
            </button>
            <button
              onClick={() => setActiveView("rekap_kasir")}
              className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === "rekap_kasir"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Rekap Transaksi Kasir
            </button>
          </div> */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveView("jurnal")}
              className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm ${
                activeView === "jurnal"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <FileText className="h-4 w-4" />
              Jurnal Umum
            </button>
            <button
              onClick={() => setActiveView("laba_rugi")}
              className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm ${
                activeView === "laba_rugi"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Laba Rugi
            </button>
            <button
              onClick={() => setActiveView("laporan_kasir")}
              className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm ${
                activeView === "laporan_kasir"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Receipt className="h-4 w-4" />
              Laporan Transaksi Kasir
            </button>
            <button
              onClick={() => setActiveView("rekap_kasir")}
              className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm ${
                activeView === "rekap_kasir"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Calendar className="h-4 w-4" />
              Transaksi Kasir
            </button>
            <button
              onClick={() => setActiveView("rekap_console")}
              className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm ${
                activeView === "rekap_console"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Gamepad className="h-4 w-4" />
              Console
            </button>
            <button
              onClick={() => setActiveView("history_discount")}
              className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm ${
                activeView === "history_discount"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Ticket className="h-4 w-4" />
              History Discount
            </button>
            {/* <button
              onClick={() => setActiveView("rekap_okupansi")}
              className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm ${
                activeView === "rekap_okupansi"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Rekap Okupansi
            </button> */}
          </div>
        </div>
      </div>

      {/* {activeView === "laba_rugi" && (
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setLabaRugiSubTab("detail")}
            className={`px-3 py-2 text-sm rounded ${
              labaRugiSubTab === "detail"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Detail Laba Rugi
          </button>
          <button
            onClick={() => setLabaRugiSubTab("rekap")}
            className={`px-3 py-2 text-sm rounded ${
              labaRugiSubTab === "rekap"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Rekap Laba Rugi
          </button>
        </div>
      )} */}
      {renderDetailRekapNav()}

      {/* Rekap Tahunan – rendered outside the main guarded block */}
      {activeView === "rekap_kasir" && transaksiKasirSubTab === "rekap_tahunan" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-6">
          {renderRekapTahunan()}
        </div>
      )}

      {/* History Discount View */}
      {activeView === "history_discount" && (() => {
        const discountTransactions = (transactions as any[]).filter(
          (t) => t?.details?.discount?.amount && Number(t.details.discount.amount) > 0
        );
        const totalDiscountAmount = discountTransactions.reduce(
          (sum, t) => sum + Number(t.details.discount.amount || 0), 0
        );
        const totalTransactions = discountTransactions.length;
        const getCashierName = (tx: any) => {
          if (tx?.cashier_name) return tx.cashier_name as string;
          if (tx?.operator_name) return tx.operator_name as string;
          if (tx?.created_by_name) return tx.created_by_name as string;
          
          if (tx?.cashier_id) {
            const sess = sessions.find((s: any) => String(s.cashier_id) === String(tx.cashier_id));
            if (sess?.cashier_name) return sess.cashier_name as string;
          }
          if (tx?.session_id) {
            const sess = sessions.find((s: any) => String(s.id) === String(tx.session_id));
            if (sess?.cashier_name) return sess.cashier_name as string;
          }
          return "-";
        };
        return (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-800">Total Transaksi Diskon</span>
                  <span className="text-xl font-bold text-purple-600">{totalTransactions}</span>
                </div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-orange-800">Total Diskon Diberikan</span>
                  <span className="text-xl font-bold text-orange-600">
                    Rp {Math.round(totalDiscountAmount).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">Rata-rata Diskon</span>
                  <span className="text-xl font-bold text-blue-600">
                    Rp {totalTransactions > 0 ? Math.round(totalDiscountAmount / totalTransactions).toLocaleString("id-ID") : 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">History Discount</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Menampilkan {totalTransactions} transaksi dengan diskon
                </p>
              </div>
              {loading ? (
                <div className="p-8 text-center text-gray-500">Memuat data...</div>
              ) : discountTransactions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Tidak ada transaksi dengan diskon pada periode ini</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal & Waktu</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referensi</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alasan</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kasir</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Diskon</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {discountTransactions.map((t: any) => {
                        const discountAmt = Number(t.details?.discount?.amount || 0);
                        const total = Number(t.amount || 0);
                        const subtotal = total + discountAmt;
                        const discountType = t.details?.discount?.type;
                        const discountValue = t.details?.discount?.value;
                        const discountLabel = discountType === "percent"
                          ? `${discountValue}%`
                          : discountType === "amount"
                          ? `Rp ${Number(discountValue || 0).toLocaleString("id-ID")}`
                          : "";
                        const typeLabel = t.type === "rental" ? "Rental" : t.type === "sale" ? "Penjualan" : t.type || "-";
                        return (
                          <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                              {t.timestamp ? new Date(t.timestamp).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 font-mono">{t.reference_id || t.id?.slice(0, 8) || "-"}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {t.details?.discount?.reason || "-"}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${t.type === "rental" ? "bg-blue-100 text-blue-800" : t.type === "sale" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                                {typeLabel}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">{getCashierName(t)}</td>
                            <td className="px-6 py-4 text-sm text-gray-700 text-right">Rp {Math.round(subtotal).toLocaleString("id-ID")}</td>
                            <td className="px-6 py-4 text-sm text-right">
                              <span className="text-red-600 font-medium">
                                - Rp {Math.round(discountAmt).toLocaleString("id-ID")}
                              </span>
                              {discountLabel && (
                                <span className="ml-1 text-xs text-gray-400">({discountLabel})</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Rp {Math.round(total).toLocaleString("id-ID")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td colSpan={5} className="px-6 py-3 text-sm font-semibold text-gray-700">Total ({totalTransactions} transaksi)</td>
                        <td className="px-6 py-3 text-sm font-semibold text-gray-700 text-right">
                          Rp {Math.round(discountTransactions.reduce((s, t) => s + Number(t.amount || 0) + Number(t.details?.discount?.amount || 0), 0)).toLocaleString("id-ID")}
                        </td>
                        <td className="px-6 py-3 text-sm font-semibold text-red-600 text-right">
                          - Rp {Math.round(totalDiscountAmount).toLocaleString("id-ID")}
                        </td>
                        <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                          Rp {Math.round(discountTransactions.reduce((s, t) => s + Number(t.amount || 0), 0)).toLocaleString("id-ID")}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Transactions List */}
      {activeView !== "history_discount" &&
        rekapConsoleViewSubTab !== "rekap" &&
        labaRugiSubTab !== "rekap" &&
        transaksiKasirSubTab !== "rekap" &&
        transaksiKasirSubTab !== "rekap_tahunan" &&
        jurnalSubTab !== "rekap" &&
        jurnalSubTab !== "setoran" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {activeView === "laba_rugi"
                      ? "Laporan Laba Rugi"
                      : activeView === "rekap_kasir"
                      ? "Rekap Kasir"
                      : activeView === "rekap_console"
                      ? "Rekap Console"
                      : activeView === "laporan_kasir"
                      ? "Laporan Transaksi Kasir"
                      : "Riwayat Transaksi"}
                  </h2>
                  {activeView !== "rekap_kasir" &&
                    activeView !== "rekap_console" && (
                      <p className="text-sm text-gray-600 mt-1">
                        {activeView === "jurnal" && jurnalSubTab === "detail"
                          ? `Menampilkan ${paginatedEntries.length} transaksi dari ${filteredEntries.length} hasil pencarian`
                          : `Menampilkan ${paginatedData.length} transaksi dari ${filteredByTab.length}`}
                      </p>
                    )}
                  {/* {activeView === "rekap_okupansi" && (
                    <p className="text-sm text-gray-600 mt-1">
                      Menampilkan data okupansi console gaming
                    </p>
                  )} */}
                </div>

                {activeView !== "rekap_kasir" &&
                  activeView !== "rekap_console" && (
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setActiveTab("all")}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === "all"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        Semua ({sourceList.length})
                      </button>
                      <button
                        onClick={() =>
                          setActiveTab(
                            activeView === "jurnal"
                              ? "income"
                              : activeView === "laba_rugi"
                              ? "rental"
                              : "income"
                          )
                        }
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                          activeTab === "income" || activeTab === "rental"
                            ? "bg-white text-green-600 shadow-sm"
                            : "text-gray-600 hover:text-green-600"
                        }`}
                      >
                        {activeView === "jurnal" ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : activeView === "laba_rugi" ? (
                          <Gamepad className="h-4 w-4" />
                        ) : (
                          <TrendingUp className="h-4 w-4" />
                        )}
                        {activeView === "jurnal"
                          ? "Pemasukan"
                          : activeView === "laba_rugi"
                          ? "Rental"
                          : "Pemasukan"}{" "}
                        (
                        {activeView === "jurnal"
                          ? incomeCount
                          : activeView === "laba_rugi"
                          ? rentalCount
                          : incomeCount}
                        )
                      </button>
                      <button
                        onClick={() =>
                          setActiveTab(
                            activeView === "jurnal"
                              ? "expense"
                              : activeView === "laba_rugi"
                              ? "sale"
                              : "expense"
                          )
                        }
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                          activeTab === "expense" || activeTab === "sale"
                            ? "bg-white text-red-600 shadow-sm"
                            : "text-gray-600 hover:text-red-600"
                        }`}
                      >
                        {activeView === "jurnal" ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : activeView === "laba_rugi" ? (
                          <Coffee className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {activeView === "jurnal"
                          ? "Pengeluaran"
                          : activeView === "laba_rugi"
                          ? "Cafe"
                          : "Pengeluaran"}{" "}
                        (
                        {activeView === "jurnal"
                          ? expenseCount
                          : activeView === "laba_rugi"
                          ? saleCount
                          : expenseCount}
                        )
                      </button>
                      {/* {activeView === "laba_rugi" && (
                <button
                  onClick={() => setActiveTab("voucher")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                    activeTab === "voucher"
                      ? "bg-white text-purple-600 shadow-sm"
                      : "text-gray-600 hover:text-purple-600"
                  }`}
                >
                  <Ticket className="h-4 w-4" />
                  Voucher ({voucherCount})
                </button>
              )} */}
                      {activeView === "laba_rugi" && (
                        <button
                          onClick={() => setActiveTab("rekap")}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeTab === "rekap"
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          Rekap Per Tanggal
                        </button>
                      )}
                      {activeView === "laporan_kasir" &&
                        activeTab === "income" && (
                          <div className="flex items-center gap-2 ml-4">
                            <label className="text-sm text-gray-600">
                              Pembayaran:
                            </label>
                            <select
                              value={paymentMethodFilter}
                              onChange={(e) =>
                                setPaymentMethodFilter(e.target.value as any)
                              }
                              className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="all">Semua</option>
                              <option value="cash">Tunai</option>
                              <option value="non-cash">Non Tunai</option>
                            </select>
                          </div>
                        )}
                    </div>
                  )}
              </div>

              {activeView === "laporan_kasir" && activeTab === "income" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Pembayaran Tunai
                      </h3>
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Banknote className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-gray-900">
                        Rp {todayCashSales.toLocaleString("id-ID")}
                      </p>
                      <p className="text-sm text-gray-600">
                        {paymentCounts.cash} transaksi hari ini
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              todayTotalRevenue > 0
                                ? (todayCashSales / todayTotalRevenue) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Pembayaran Kartu
                      </h3>
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-gray-900">
                        Rp {todayCardSales.toLocaleString("id-ID")}
                      </p>
                      <p className="text-sm text-gray-600">
                        {paymentCounts.card} transaksi hari ini
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              todayTotalRevenue > 0
                                ? (todayCardSales / todayTotalRevenue) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Transfer
                      </h3>
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-purple-600" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-gray-900">
                        Rp {todayTransferSales.toLocaleString("id-ID")}
                      </p>
                      <p className="text-sm text-gray-600">
                        {paymentCounts.transfer} transaksi hari ini
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              todayTotalRevenue > 0
                                ? (todayTransferSales / todayTotalRevenue) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeView !== "rekap_console" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-800">
                        {activeView === "jurnal"
                          ? "Total Pemasukan"
                          : activeView === "laba_rugi"
                          ? "Total Rental"
                          : "Total Pemasukan"}
                      </span>
                      <span className="text-lg font-bold text-green-600">
                        Rp{" "}
                        {activeView === "jurnal"
                          ? summary.totalIncome?.toLocaleString("id-ID")
                          : activeView === "laba_rugi"
                          ? Math.ceil(summary.totalRental ?? 0).toLocaleString(
                              "id-ID"
                            )
                          : sourceList
                              .filter(
                                (t: any) =>
                                  t.type === "income" ||
                                  t.type === "sale" ||
                                  t.type === "rental" ||
                                  t.type === "voucher"
                              )
                              .reduce(
                                (s: number, t: any) =>
                                  s + (Number(t.amount) || 0),
                                0
                              )
                              .toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-red-800">
                        {activeView === "jurnal"
                          ? "Total Pengeluaran"
                          : activeView === "laba_rugi"
                          ? "Total Cafe"
                          : "Total Pengeluaran"}
                      </span>
                      <span className="text-lg font-bold text-red-600">
                        Rp{" "}
                        {activeView === "jurnal"
                          ? summary.totalExpense?.toLocaleString("id-ID")
                          : activeView === "laba_rugi"
                          ? summary.totalCafe?.toLocaleString("id-ID")
                          : sourceList
                              .filter((t: any) => t.type === "expense")
                              .reduce(
                                (s: number, t: any) =>
                                  s + (Number(t.amount) || 0),
                                0
                              )
                              .toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-800">
                        {activeView === "jurnal"
                          ? "Profit"
                          : activeView === "laba_rugi"
                          ? "Laba Bruto"
                          : "Saldo Net"}
                      </span>
                      <span
                        className={`text-lg font-bold ${
                          summary.netProfit >= 0 ||
                          sourceList
                            .filter(
                              (t: any) =>
                                t.type === "income" ||
                                t.type === "sale" ||
                                t.type === "rental" ||
                                t.type === "voucher"
                            )
                            .reduce(
                              (s: number, t: any) =>
                                s + (Number(t.amount) || 0),
                              0
                            ) -
                            sourceList
                              .filter((t: any) => t.type === "expense")
                              .reduce(
                                (s: number, t: any) =>
                                  s + (Number(t.amount) || 0),
                                0
                              ) >=
                            0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        Rp{" "}
                        {(activeView === "laba_rugi"
                          ? Math.ceil(summary.netProfit)
                          : activeView === "jurnal"
                          ? summary.netProfit
                          : sourceList
                              .filter(
                                (t: any) =>
                                  t.type === "income" ||
                                  t.type === "sale" ||
                                  t.type === "rental" ||
                                  t.type === "voucher"
                              )
                              .reduce(
                                (s: number, t: any) =>
                                  s + (Number(t.amount) || 0),
                                0
                              ) -
                            sourceList
                              .filter((t: any) => t.type === "expense")
                              .reduce(
                                (s: number, t: any) =>
                                  s + (Number(t.amount) || 0),
                                0
                              )
                        ).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {activeView === "rekap_console" &&
                rekapConsoleViewSubTab === "detail" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {/* Total Durasi */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-800">
                          Total Durasi
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {(() => {
                            const totalMinutes = Object.values(
                              rekapConsoleByDate.map
                            ).reduce(
                              (sum: number, day: any) =>
                                sum +
                                Object.values(day.consoles).reduce(
                                  (daySum: number, console: any) =>
                                    daySum + console.totalDurationMinutes,
                                  0
                                ),
                              0
                            );
                            const hours = Math.floor(totalMinutes / 60);
                            const minutes = totalMinutes % 60;
                            return `${hours}j ${minutes}m`;
                          })()}
                        </span>
                      </div>
                    </div>

                    {/* Console Terpakai */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-800">
                          Total Console
                        </span>
                        <span className="text-lg font-bold text-green-600">
                          {Object.values(rekapConsoleByDate.map).reduce(
                            (sum: number, day: any) =>
                              sum + Object.keys(day.consoles).length,
                            0
                          )}{" "}
                          unit
                        </span>
                      </div>
                    </div>

                    {/* Rata-rata Durasi */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-purple-800">
                          Rata-rata Durasi
                        </span>
                        <span className="text-lg font-bold text-purple-600">
                          {(() => {
                            const totalConsoles = Object.values(
                              rekapConsoleByDate.map
                            ).reduce(
                              (sum: number, day: any) =>
                                sum + Object.keys(day.consoles).length,
                              0
                            );
                            const totalMinutes = Object.values(
                              rekapConsoleByDate.map
                            ).reduce(
                              (sum: number, day: any) =>
                                sum +
                                Object.values(day.consoles).reduce(
                                  (daySum: number, console: any) =>
                                    daySum + console.totalDurationMinutes,
                                  0
                                ),
                              0
                            );
                            const avgMinutes =
                              totalConsoles > 0
                                ? Math.round(totalMinutes / totalConsoles)
                                : 0;
                            const hours = Math.floor(avgMinutes / 60);
                            const minutes = avgMinutes % 60;
                            return `${hours}j ${minutes}m`;
                          })()}
                        </span>
                      </div>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-indigo-800">
                          Mode Member
                        </span>
                        <span className="text-lg font-bold text-indigo-600">
                          {(() => {
                            const memberHours = transactions
                              .filter(
                                (t: any) =>
                                  t.type === "rental" &&
                                  t.details?.payment?.method === "member_card"
                              )
                              .reduce((sum: number, t: any) => {
                                const durationMinutes =
                                  t.details?.rental?.duration_minutes ||
                                  t.details?.duration_minutes ||
                                  t.details?.additional_duration_minutes ||
                                  0;
                                return sum + durationMinutes;
                              }, 0);
                            const hours = Math.floor(memberHours / 60);
                            const minutes = memberHours % 60;
                            return `${hours}j ${minutes}m`;
                          })()}
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="text-xs text-indigo-600">
                          {
                            transactions.filter(
                              (t: any) =>
                                t.type === "rental" &&
                                t.details?.payment?.method === "member_card"
                            ).length
                          }{" "}
                          transaksi
                        </span>
                      </div>
                    </div>

                    {/* Mode Pay as You Go */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-800">
                          Pay as You Go
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {(() => {
                            const payAsYouGoHours = transactions
                              .filter(
                                (t: any) =>
                                  t.type === "rental" &&
                                  t.description ===
                                    "Rental payment (Pay-as-you-go)"
                              )
                              .reduce((sum: number, t: any) => {
                                const durationMinutes =
                                  t.details?.rental?.duration_minutes ||
                                  t.details?.duration_minutes ||
                                  t.details?.additional_duration_minutes ||
                                  0;
                                return sum + durationMinutes;
                              }, 0);
                            const hours = Math.floor(payAsYouGoHours / 60);
                            const minutes = payAsYouGoHours % 60;
                            return `${hours}j ${minutes}m`;
                          })()}
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="text-xs text-blue-600">
                          {
                            transactions.filter(
                              (t: any) =>
                                t.type === "rental" &&
                                t.description ===
                                  "Rental payment (Pay-as-you-go)"
                            ).length
                          }{" "}
                          transaksi
                        </span>
                      </div>
                    </div>

                    {/* Mode Bayar di Muka */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-800">
                          Bayar di Muka
                        </span>
                        <span className="text-lg font-bold text-green-600">
                          {(() => {
                            const prepaidHours = transactions
                              .filter(
                                (t: any) =>
                                  t.type === "rental" &&
                                  t.details?.rental?.prepaid
                              )
                              .reduce((sum: number, t: any) => {
                                const durationMinutes =
                                  t.details?.rental?.duration_minutes ||
                                  t.details?.duration_minutes ||
                                  t.details?.additional_duration_minutes ||
                                  0;
                                return sum + durationMinutes;
                              }, 0);
                            const hours = Math.floor(prepaidHours / 60);
                            const minutes = prepaidHours % 60;
                            return `${hours}j ${minutes}m`;
                          })()}
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="text-xs text-green-600">
                          {
                            transactions.filter(
                              (t: any) =>
                                t.type === "rental" &&
                                t.details?.rental?.prepaid &&
                                t.details?.rental?.duration_minutes
                            ).length
                          }{" "}
                          transaksi
                        </span>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {activeView === "laba_rugi" ? (
              <div className="divide-y divide-gray-200 max-h-screen overflow-y-auto">
                {activeTab === "rekap" ? (
                  <div className="space-y-4 p-4">
                    {rekapByDate.dateKeys.length === 0 ? (
                      <div className="p-12 text-center">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">
                          Tidak ada transaksi ditemukan
                        </p>
                      </div>
                    ) : (
                      rekapByDate.dateKeys.map((dk) => {
                        const day = rekapByDate.map[dk];
                        const isOpen = expandedDates.has(dk);
                        return (
                          <div
                            key={dk}
                            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm text-gray-500">
                                  {new Date(dk).toLocaleDateString("id-ID", {
                                    weekday: "long",
                                  })}
                                </div>
                                <button
                                  onClick={() => {
                                    const next = new Set(expandedDates);
                                    if (next.has(dk)) next.delete(dk);
                                    else next.add(dk);
                                    setExpandedDates(next);
                                  }}
                                  className="font-semibold text-left text-blue-600 hover:underline flex items-center gap-2"
                                  aria-expanded={isOpen}
                                >
                                  <span>
                                    {new Date(dk).toLocaleDateString("id-ID")}
                                  </span>
                                  <svg
                                    className={`h-4 w-4 transform ${
                                      isOpen ? "rotate-180" : ""
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
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-right">
                                <div>
                                  <div className="text-xs text-gray-500">
                                    Profit Rental
                                  </div>
                                  <div className="font-semibold text-green-700">
                                    Rp{" "}
                                    {Math.ceil(day.rentalProfit).toLocaleString(
                                      "id-ID"
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">
                                    Profit Cafe
                                  </div>
                                  <div className="font-semibold text-red-700">
                                    Rp{" "}
                                    {Math.ceil(day.cafeProfit).toLocaleString(
                                      "id-ID"
                                    )}
                                  </div>
                                </div>
                                {/* <div>
                              <div className="text-xs text-gray-500">
                                Profit Voucher
                              </div>
                              <div className="font-semibold text-purple-700">
                                Rp{" "}
                                {Math.ceil(day.voucherProfit).toLocaleString(
                                  "id-ID"
                                )}
                              </div>
                            </div> */}
                                <div>
                                  <div className="text-xs text-gray-500">
                                    Laba Bruto
                                  </div>
                                  <div className="font-bold text-blue-700">
                                    Rp{" "}
                                    {Math.ceil(day.totalProfit).toLocaleString(
                                      "id-ID"
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            {isOpen &&
                              (() => {
                                const dayTransactions = (transactions as any[])
                                  .filter((t: any) => {
                                    if (!t || !t.timestamp) return false;
                                    const txDate = new Date(t.timestamp)
                                      .toISOString()
                                      .slice(0, 10);
                                    if (!["rental", "sale"].includes(t.type))
                                      return false;
                                    return txDate === dk;
                                  })
                                  .sort(
                                    (a: any, b: any) =>
                                      new Date(b.timestamp).getTime() -
                                      new Date(a.timestamp).getTime()
                                  );

                                const makeKey = (type: string) =>
                                  `${dk}|${type}`;
                                const groups: Array<{
                                  label: string;
                                  type: string;
                                  color: string;
                                }> = [
                                  {
                                    label: "Profit Rental",
                                    type: "rental",
                                    color: "text-green-700",
                                  },
                                  {
                                    label: "Profit Cafe",
                                    type: "sale",
                                    color: "text-red-700",
                                  },
                                  // {
                                  //   label: "Profit Voucher",
                                  //   type: "voucher",
                                  //   color: "text-purple-700",
                                  // },
                                ];
                                const sumProfit = (list: any[]) =>
                                  list.reduce(
                                    (s, t) =>
                                      s +
                                      (t?.details?.items || []).reduce(
                                        (ss: number, it: any) =>
                                          ss + (Number(it?.profit) || 0),
                                        0
                                      ),
                                    0
                                  );

                                return (
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="mb-3 text-sm text-gray-600">
                                      Total {dayTransactions.length} transaksi
                                    </div>
                                    <div className="space-y-4">
                                      {groups.map((g) => {
                                        const list = dayTransactions.filter(
                                          (t: any) => t.type === g.type
                                        );
                                        if (list.length === 0) return null;
                                        const key = makeKey(g.type);
                                        const open =
                                          expandedTypeBuckets.has(key);
                                        const total = sumProfit(list);
                                        return (
                                          <div
                                            key={g.type}
                                            className="border rounded-lg"
                                          >
                                            <button
                                              onClick={() => {
                                                const next = new Set(
                                                  expandedTypeBuckets
                                                );
                                                if (next.has(key))
                                                  next.delete(key);
                                                else next.add(key);
                                                setExpandedTypeBuckets(next);
                                              }}
                                              className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100"
                                              aria-expanded={open}
                                            >
                                              <div className="flex items-center gap-2">
                                                <svg
                                                  className={`h-4 w-4 transform ${
                                                    open ? "rotate-180" : ""
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
                                                <span className="text-sm font-medium text-gray-900">
                                                  {g.label}
                                                </span>
                                              </div>
                                              <div className="text-right">
                                                <div
                                                  className={`text-sm font-semibold ${g.color}`}
                                                >
                                                  Rp{" "}
                                                  {Math.ceil(
                                                    total
                                                  ).toLocaleString("id-ID")}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                  {list.length} transaksi
                                                </div>
                                              </div>
                                            </button>
                                            {open && (
                                              <div className="p-3 overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                  <thead className="bg-white">
                                                    <tr>
                                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                        Waktu
                                                      </th>
                                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                        Tipe
                                                      </th>
                                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                        Deskripsi
                                                      </th>

                                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                        Detail Items
                                                      </th>
                                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                        Total Profit
                                                      </th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="bg-white divide-y divide-gray-100">
                                                    {list.map((t: any) => {
                                                      const items =
                                                        t?.details?.items || [];
                                                      const transactionProfit =
                                                        items.reduce(
                                                          (
                                                            s: number,
                                                            it: any
                                                          ) =>
                                                            s +
                                                            (Number(
                                                              it?.profit
                                                            ) || 0),
                                                          0
                                                        );
                                                      return (
                                                        <tr
                                                          key={t.id}
                                                          className="hover:bg-gray-50"
                                                        >
                                                          <td className="px-3 py-2 text-sm">
                                                            {new Date(
                                                              t.timestamp
                                                            ).toLocaleString(
                                                              "id-ID",
                                                              {
                                                                day: "numeric",
                                                                month:
                                                                  "numeric",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute:
                                                                  "2-digit",
                                                                hour12: false,
                                                              }
                                                            )}
                                                          </td>
                                                          <td className="px-3 py-2">
                                                            <span
                                                              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                                                t.type ===
                                                                "rental"
                                                                  ? "bg-green-100 text-green-800"
                                                                  : t.type ===
                                                                    "sale"
                                                                  ? "bg-red-100 text-red-800"
                                                                  : "bg-gray-100 text-gray-800"
                                                              }`}
                                                            >
                                                              {(t.type || "")
                                                                .toString()
                                                                .toUpperCase()}
                                                            </span>
                                                          </td>
                                                          <td className="px-3 py-2 text-sm text-gray-900">
                                                            {t.description ||
                                                              "-"}
                                                          </td>
                                                          <td className="px-3 py-2 text-sm text-gray-600">
                                                            {items.length >
                                                            0 ? (
                                                              <div className="space-y-1">
                                                                {items.map(
                                                                  (
                                                                    item: any,
                                                                    idx: number
                                                                  ) => {
                                                                    const name =
                                                                      item.name ??
                                                                      item.product_name ??
                                                                      item.title ??
                                                                      "Item";
                                                                    const profit =
                                                                      Number(
                                                                        item.profit ??
                                                                          0
                                                                      );
                                                                    const qty =
                                                                      Number(
                                                                        item.qty ??
                                                                          item.quantity ??
                                                                          1
                                                                      );
                                                                    return (
                                                                      <div
                                                                        key={
                                                                          idx
                                                                        }
                                                                        className="text-xs"
                                                                      >
                                                                        {name}{" "}
                                                                        {qty > 1
                                                                          ? `x${qty}`
                                                                          : ""}{" "}
                                                                        - Rp{" "}
                                                                        {profit.toLocaleString(
                                                                          "id-ID"
                                                                        )}
                                                                      </div>
                                                                    );
                                                                  }
                                                                )}
                                                              </div>
                                                            ) : (
                                                              <span className="text-gray-400">
                                                                -
                                                              </span>
                                                            )}
                                                          </td>
                                                          <td className="px-3 py-2 text-right font-semibold text-green-600">
                                                            Rp{" "}
                                                            {Math.ceil(
                                                              transactionProfit
                                                            ).toLocaleString(
                                                              "id-ID"
                                                            )}
                                                          </td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                  <tfoot>
                                                    <tr className="bg-gray-50">
                                                      <td
                                                        colSpan={3}
                                                        className="px-3 py-2 text-right font-semibold text-gray-900"
                                                      >
                                                        Subtotal {g.label}
                                                      </td>
                                                      <td className="px-3 py-2 text-right font-bold text-blue-700">
                                                        Rp{" "}
                                                        {Math.ceil(
                                                          total
                                                        ).toLocaleString(
                                                          "id-ID"
                                                        )}
                                                      </td>
                                                    </tr>
                                                  </tfoot>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : paginatedData.length === 0 ? (
                  <div className="p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">
                      Tidak ada transaksi ditemukan
                    </p>
                  </div>
                ) : (
                  paginatedData.map((t: any) => {
                    const isSelected = selectedItem === String(t.id);
                    return (
                      <div
                        key={t.id}
                        className="p-6 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                t.type === "rental"
                                  ? "bg-green-100"
                                  : t.type === "sale"
                                  ? "bg-red-100"
                                  : "bg-purple-100"
                              }`}
                            >
                              {t.type === "rental" ? (
                                <Gamepad className="h-4 w-4 text-green-600" />
                              ) : t.type === "sale" ? (
                                <Coffee className="h-4 w-4 text-red-600" />
                              ) : (
                                <Ticket className="h-4 w-4 text-purple-600" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">
                                {t.description}
                              </h3>
                              <div className="flex items-center gap-3 mt-1">
                                <span
                                  className={`inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800  ${
                                    t.type === "rental"
                                      ? "bg-green-100 text-green-800"
                                      : t.type === "sale"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-purple-100 text-purple-800"
                                  }`}
                                >
                                  {(t.type || "").toString().toUpperCase()}
                                </span>
                                <div className="flex items-center gap-1 text-sm text-gray-600">
                                  <Calendar className="h-4 w-4" />
                                  {new Date(t.timestamp).toLocaleDateString(
                                    "id-ID"
                                  )}
                                </div>
                                {t.reference_id && (
                                  <span className="text-sm text-gray-500">
                                    Ref: {t.reference_id}
                                  </span>
                                )}

                                {!t?.details ||
                                  (!t.details?.action &&
                                    t.type !== "voucher" && (
                                      <button
                                        onClick={
                                          () =>
                                            setSelectedItem(
                                              isSelected ? null : String(t.id)
                                            ) // Toggle detail
                                        }
                                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                        title={
                                          isSelected
                                            ? "Sembunyikan detail"
                                            : "Lihat detail"
                                        }
                                      >
                                        {isSelected ? "Tutup" : "Detail"}
                                      </button>
                                    ))}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600">
                              +{" "}
                              {Math.ceil(
                                (t.details?.items || []).reduce(
                                  (sum: number, item: any) =>
                                    sum + (Number(item.profit) || 0),
                                  0
                                )
                              ).toLocaleString("id-ID")}
                            </p>
                            <p className="text-sm text-gray-600 capitalize">
                              Profit
                            </p>
                          </div>
                        </div>
                        {isSelected && t.details?.items?.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <h4 className="font-medium text-gray-900 mb-3">
                              Detail
                            </h4>
                            <div className="space-y-2">
                              {t.details.items.map((item: any, idx: number) => {
                                const name =
                                  item.name ??
                                  item.product_name ??
                                  item.title ??
                                  "Item";
                                const profit = Number(item.profit ?? 0);
                                const qty = Number(
                                  item.qty ?? item.quantity ?? 1
                                );
                                const unit = Number(item.price ?? 0);
                                const total =
                                  Number(item.total ?? unit * qty) || 0;

                                let durationMinutes: number | null = null;
                                if (item.type === "rental") {
                                  durationMinutes =
                                    Number(
                                      t?.details?.rental?.duration_minutes ??
                                        null
                                    ) || null;
                                  if (!durationMinutes && item.description) {
                                    const m = item.description.match(
                                      /(\d{1,2}):(\d{2}):(\d{2})/
                                    );
                                    if (m) {
                                      const h = Number(m[1]);
                                      const mm = Number(m[2]);
                                      const s = Number(m[3]);
                                      durationMinutes = Math.round(
                                        h * 60 + mm + s / 60
                                      );
                                    }
                                  }
                                }

                                return (
                                  <div
                                    key={idx}
                                    className="flex justify-between items-center text-sm"
                                  >
                                    <span className="text-gray-700">
                                      {/* {name} x @{qty}{" "} */}
                                      {item.type === "rental"
                                        ? `${name} (${
                                            t.details.rental.duration_minutes ??
                                            durationMinutes
                                          } menit - Rp ${total.toLocaleString(
                                            "id-ID"
                                          )})`
                                        : `${name} x @${qty} (Rp ${(
                                            profit / qty
                                          ).toLocaleString("id-ID")})`}
                                      {t.details.discount?.amount &&
                                        t.details.discount.amount > 0 &&
                                        item.type === "rental" && (
                                          <span className="text-red-500">
                                            (Diskon{" "}
                                            {t.details.discount.amount.toLocaleString(
                                              "id-ID"
                                            )}
                                            )
                                          </span>
                                        )}
                                    </span>
                                    <span className="font-medium text-gray-900">
                                      Rp{" "}
                                      {item?.profit?.toLocaleString("id-ID") ||
                                        0}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : activeView === "rekap_kasir" ? (
              <div className="space-y-4">
                <>
                    <div className="flex border-b border-gray-200">
                      <button
                        onClick={() => setRekapKasirSubTab("per_tanggal")}
                    className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm ${
                      rekapKasirSubTab === "per_tanggal"
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <Calendar className="h-4 w-4" />
                    Rekap Per Tanggal
                  </button>
                  <button
                    onClick={() => setRekapKasirSubTab("per_kasir")}
                    className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm ${
                      rekapKasirSubTab === "per_kasir"
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <User className="h-4 w-4" />
                    Rekap Per Kasir
                  </button>
                </div>

                {rekapKasirSubTab === "per_tanggal" ? (
                  <div className="divide-y divide-gray-200 max-h-screen overflow-y-auto">
                    {rekapKasirByDate.dateKeys.length === 0 ? (
                      <div className="p-12 text-center">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">
                          Tidak ada transaksi ditemukan
                        </p>
                      </div>
                    ) : (
                      rekapKasirByDate.dateKeys.map((dk) => {
                        const isDateOpen = expandedDates.has(dk);
                        const sessionsMap =
                          rekapKasirByDate.map[dk]?.sessions || {};
                        const sessionIds = Object.keys(sessionsMap);
                        const filteredSessionIds = sessionIds.filter(
                          (sid) =>
                            sid &&
                            String(sid).trim() !== "" &&
                            sid !== "-" &&
                            sid !== "null"
                        );

                        const summarizedSessions = filteredSessionIds
                          .map((sid) => ({ sid, ...sessionsMap[sid] }))
                          .sort((a, b) => b.totalAmount - a.totalAmount);

                        const totalAll = summarizedSessions.reduce(
                          (sum, item) => sum + item.totalAmount,
                          0
                        );

                        return (
                          <div
                            key={dk}
                            className="p-6 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm text-gray-500">
                                  {new Date(dk).toLocaleDateString("id-ID", {
                                    weekday: "long",
                                  })}
                                </div>
                                <button
                                  onClick={() => {
                                    const next = new Set(expandedDates);
                                    if (next.has(dk)) next.delete(dk);
                                    else next.add(dk);
                                    setExpandedDates(next);
                                  }}
                                  className="font-semibold text-left text-blue-600 hover:underline flex items-center gap-2"
                                  aria-expanded={isDateOpen}
                                >
                                  <span>
                                    {new Date(dk).toLocaleDateString("id-ID")}
                                  </span>
                                  <svg
                                    className={`h-4 w-4 transform ${
                                      isDateOpen ? "rotate-180" : ""
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
                                <div className="text-sm text-gray-600">
                                  {filteredSessionIds.length} sesi
                                </div>
                              </div>
                              <div className="mt-4">
                                <div className="text-xs text-gray-500">
                                  Total
                                </div>
                                <div className="font-bold text-green-700">
                                  Rp {Number(totalAll).toLocaleString("id-ID")}
                                </div>
                              </div>
                            </div>

                            {isDateOpen && (
                              <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                                {summarizedSessions.map((sessionItem) => {
                                  const key = `${dk}|${sessionItem.sid}`;
                                  const open = expandedSessionBuckets.has(key);
                                  const sess = sessions.find(
                                    (s: any) =>
                                      String(s.id) === String(sessionItem.sid)
                                  );
                                  const sdata = sessionsMap[sessionItem.sid];

                                  return (
                                    <div
                                      key={sessionItem.sid}
                                      className="border rounded-lg"
                                    >
                                      <button
                                        onClick={() => {
                                          const next = new Set(
                                            expandedSessionBuckets
                                          );
                                          if (next.has(key)) next.delete(key);
                                          else next.add(key);
                                          setExpandedSessionBuckets(next);
                                        }}
                                        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100"
                                        aria-expanded={open}
                                      >
                                        <div className="text-left">
                                          <div className="text-sm font-medium text-gray-900">
                                            Sesi Kasir -{" "}
                                            {sess?.cashier_name || "Kasir"} (
                                            {sess?.status === "active"
                                              ? "Aktif"
                                              : "Selesai"}
                                            )
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            Mulai:{" "}
                                            {sess?.start_time
                                              ? new Date(
                                                  sess.start_time
                                                ).toLocaleString("id-ID", {
                                                  hour12: false,
                                                })
                                              : "-"}
                                            {sess?.end_time
                                              ? ` | Selesai: ${new Date(
                                                  sess.end_time
                                                ).toLocaleString("id-ID", {
                                                  hour12: false,
                                                })}`
                                              : ""}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-sm font-semibold text-blue-700">
                                            Rp{" "}
                                            {Number(
                                              sdata.totalAmount
                                            ).toLocaleString("id-ID")}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {sdata.count} transaksi
                                          </div>
                                        </div>
                                      </button>
                                      {open && (
                                        <div className="p-3 overflow-x-auto">
                                          <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-white">
                                              <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                  Waktu
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                  Tipe
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                  Deskripsi
                                                </th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                  Jumlah (Rp)
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-100">
                                              {sdata.list.map((t: any) => (
                                                <tr
                                                  key={t.id}
                                                  className="hover:bg-gray-50"
                                                >
                                                  <td className="px-3 py-2 text-sm">
                                                    {new Date(
                                                      t.timestamp
                                                    ).toLocaleString("id-ID", {
                                                      hour12: false,
                                                    })}
                                                  </td>
                                                  <td className="px-3 py-2 text-xs">
                                                    <span
                                                      className={`inline-block px-2 py-1 rounded-full ${
                                                        t.type === "expense"
                                                          ? "bg-red-100 text-red-800"
                                                          : "bg-green-100 text-green-800"
                                                      }`}
                                                    >
                                                      {String(
                                                        t.type || ""
                                                      ).toUpperCase()}
                                                    </span>
                                                  </td>
                                                  <td className="px-3 py-2 text-sm text-gray-900">
                                                    {t.description || "-"}
                                                  </td>
                                                  <td
                                                    className={`px-3 py-2 text-right text-sm font-semibold ${
                                                      t.type === "expense"
                                                        ? "text-red-500"
                                                        : ""
                                                    }`}
                                                  >
                                                    {t.type === "expense"
                                                      ? "- "
                                                      : ""}
                                                    Rp{" "}
                                                    {Number(
                                                      t.amount || 0
                                                    ).toLocaleString("id-ID")}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                            <tfoot>
                                              <tr className="bg-gray-50">
                                                <td
                                                  colSpan={3}
                                                  className="px-3 py-2 text-right font-semibold text-gray-900"
                                                >
                                                  Subtotal Sesi
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-blue-700">
                                                  Rp{" "}
                                                  {Number(
                                                    sdata.totalAmount
                                                  ).toLocaleString("id-ID")}
                                                </td>
                                              </tr>
                                            </tfoot>
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
                ) : (
                  <div className="divide-y divide-gray-200 max-h-screen overflow-y-auto">
                    {rekapKasirByCashier.cashierKeys.length === 0 ? (
                      <div className="p-12 text-center">
                        <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">
                          Tidak ada data kasir ditemukan
                        </p>
                      </div>
                    ) : (
                      rekapKasirByCashier.cashierKeys.map((ckey) => {
                        const cashier = rekapKasirByCashier.map[ckey];
                        const isCashierOpen = expandedCashierBuckets.has(ckey);
                        const sortedDates = Object.keys(cashier.dates).sort(
                          (a, b) => (a < b ? 1 : -1)
                        );

                        return (
                          <div
                            key={ckey}
                            className="p-6 hover:bg-gray-50 transition-colors"
                          >
                            <button
                              onClick={() => {
                                const next = new Set(expandedCashierBuckets);
                                if (next.has(ckey)) next.delete(ckey);
                                else next.add(ckey);
                                setExpandedCashierBuckets(next);
                              }}
                              className="w-full flex items-center justify-between"
                              aria-expanded={isCashierOpen}
                            >
                              <div className="text-left">
                                <div className="text-lg font-semibold text-gray-900">
                                  {cashier.cashierName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {cashier.count} transaksi
                                </div>
                              </div>
                              <div className="text-right space-y-1">
                                <div
                                  className={`text-sm font-semibold ${
                                    cashier.totalAmount >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  Rp{" "}
                                  {Number(cashier.totalAmount).toLocaleString(
                                    "id-ID"
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {sortedDates.length} hari aktif
                                </div>
                              </div>
                            </button>

                            {isCashierOpen && (
                              <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                                {sortedDates.map((dk) => {
                                  const dateKey = `${ckey}|${dk}`;
                                  const open =
                                    expandedCashierDateBuckets.has(dateKey);
                                  const dateData = cashier.dates[dk];

                                  return (
                                    <div
                                      key={dateKey}
                                      className="border rounded-lg"
                                    >
                                      <button
                                        onClick={() => {
                                          const next = new Set(
                                            expandedCashierDateBuckets
                                          );
                                          if (next.has(dateKey))
                                            next.delete(dateKey);
                                          else next.add(dateKey);
                                          setExpandedCashierDateBuckets(next);
                                        }}
                                        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100"
                                        aria-expanded={open}
                                      >
                                        <div className="text-left">
                                          <div className="text-sm font-medium text-gray-900">
                                            {new Date(dk).toLocaleDateString(
                                              "id-ID",
                                              {
                                                weekday: "long",
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric",
                                              }
                                            )}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {dateData.count} transaksi
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-sm font-semibold text-blue-700">
                                            Rp{" "}
                                            {Number(
                                              dateData.totalAmount
                                            ).toLocaleString("id-ID")}
                                          </div>
                                        </div>
                                      </button>
                                      {open && (
                                        <div className="p-3 overflow-x-auto">
                                          <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-white">
                                              <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                  Waktu
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                  Tipe
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                  Deskripsi
                                                </th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                  Jumlah (Rp)
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-100">
                                              {dateData.list.map((t: any) => (
                                                <tr
                                                  key={t.id}
                                                  className="hover:bg-gray-50"
                                                >
                                                  <td className="px-3 py-2 text-sm">
                                                    {new Date(
                                                      t.timestamp
                                                    ).toLocaleString("id-ID", {
                                                      hour12: false,
                                                    })}
                                                  </td>
                                                  <td className="px-3 py-2 text-xs">
                                                    <span
                                                      className={`inline-block px-2 py-1 rounded-full ${
                                                        t.type === "expense"
                                                          ? "bg-red-100 text-red-800"
                                                          : "bg-green-100 text-green-800"
                                                      }`}
                                                    >
                                                      {String(
                                                        t.type || ""
                                                      ).toUpperCase()}
                                                    </span>
                                                  </td>
                                                  <td className="px-3 py-2 text-sm text-gray-900">
                                                    {t.description || "-"}
                                                  </td>
                                                  <td
                                                    className={`px-3 py-2 text-right text-sm font-semibold ${
                                                      t.type === "expense"
                                                        ? "text-red-500"
                                                        : ""
                                                    }`}
                                                  >
                                                    {t.type === "expense"
                                                      ? "- "
                                                      : ""}
                                                    Rp{" "}
                                                    {Number(
                                                      t.amount || 0
                                                    ).toLocaleString("id-ID")}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                            <tfoot>
                                              <tr className="bg-gray-50">
                                                <td
                                                  colSpan={3}
                                                  className="px-3 py-2 text-right font-semibold text-gray-900"
                                                >
                                                  Subtotal Harian
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-blue-700">
                                                  Rp{" "}
                                                  {Number(
                                                    dateData.totalAmount
                                                  ).toLocaleString("id-ID")}
                                                </td>
                                              </tr>
                                            </tfoot>
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
                  </>
              </div>
            ) : activeView === "rekap_console" ? (
              rekapConsoleViewSubTab === "protection_log" ? (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                      <h3 className="font-semibold text-gray-800">
                        Riwayat Protection Log
                      </h3>
                      <button
                        onClick={fetchProtectionLogs}
                        disabled={isLoadingLogs}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${
                            isLoadingLogs ? "animate-spin" : ""
                          }`}
                        />
                        Refresh
                      </button>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {isLoadingLogs ? (
                        <div className="p-8 text-center text-gray-500">
                          Memuat data log...
                        </div>
                      ) : protectionLogs.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          Tidak ada log ditemukan
                        </div>
                      ) : (
                        protectionLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-4 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-gray-900">
                                {log.description}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(log.timestamp).toLocaleString(
                                  "id-ID"
                                )}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                              <span>
                                Kasir:{" "}
                                {log.cashier_sessions?.cashier_name || "System"}
                              </span>
                              {log.details?.reason && (
                                <span className="text-red-600 font-medium italic">
                                  Alasan: {log.details.reason}
                                </span>
                              )}
                              {log.duration !== undefined && (
                                <span className="text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                                  Durasi Off:{" "}
                                  {Math.floor(log.duration / 3600000)}h{" "}
                                  {Math.floor((log.duration % 3600000) / 60000)}m{" "}
                                  {Math.floor((log.duration % 60000) / 1000)}s
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setRekapConsoleSubTab("per_tanggal")}
                    className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm ${
                      rekapConsoleSubTab === "per_tanggal"
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <Calendar className="h-4 w-4" />
                    Rekap Per Tanggal
                  </button>
                  <button
                    onClick={() => setRekapConsoleSubTab("per_console")}
                    className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm ${
                      rekapConsoleSubTab === "per_console"
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <Gamepad className="h-4 w-4" />
                    Rekap Per Console
                  </button>
                </div>

                {rekapConsoleSubTab === "per_tanggal" ? (
                  <div className="divide-y divide-gray-200 max-h-screen overflow-y-auto">
                    {rekapConsoleByDate.dateKeys.length === 0 ? (
                      <div className="p-12 text-center">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">
                          Tidak ada transaksi ditemukan
                        </p>
                      </div>
                    ) : (
                      rekapConsoleByDate.dateKeys.map((dk) => {
                        const isDateOpen = expandedDates.has(dk);
                        const consolesMap =
                          rekapConsoleByDate.map[dk]?.consoles || {};
                        const consoleNames = Object.keys(consolesMap);
                        const formatDuration = (minutes: number) => {
                          const hours = Math.floor(minutes / 60);
                          const mins = minutes % 60;
                          if (hours === 0) return `${mins} menit`;
                          if (mins === 0) return `${hours} jam`;
                          return `${hours} jam ${mins} menit`;
                        };
                        return (
                          <div
                            key={dk}
                            className="p-6 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm text-gray-500">
                                  {new Date(dk).toLocaleDateString("id-ID", {
                                    weekday: "long",
                                  })}
                                </div>
                                <button
                                  onClick={() => {
                                    const next = new Set(expandedDates);
                                    if (next.has(dk)) next.delete(dk);
                                    else next.add(dk);
                                    setExpandedDates(next);
                                  }}
                                  className="font-semibold text-left text-blue-600 hover:underline flex items-center gap-2"
                                  aria-expanded={isDateOpen}
                                >
                                  <span>
                                    {new Date(dk).toLocaleDateString("id-ID")}
                                  </span>
                                  <svg
                                    className={`h-4 w-4 transform ${
                                      isDateOpen ? "rotate-180" : ""
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
                                <div className="text-sm text-gray-600">
                                  {consoleNames.length} console
                                </div>
                              </div>
                              <div className="mt-4">
                                {(() => {
                                  const validConsoles = Object.entries(
                                    consolesMap
                                  )
                                    .map(([name, data]) => ({
                                      name,
                                      ...data,
                                    }))
                                    .sort(
                                      (a, b) =>
                                        b.totalDurationMinutes -
                                        a.totalDurationMinutes
                                    );

                                  const totalAllMinutes = validConsoles.reduce(
                                    (sum, c) => sum + c.totalDurationMinutes,
                                    0
                                  );
                                  const operatingMinutes =
                                    validConsoles.length * 14 * 60;
                                  const occupancyRate =
                                    operatingMinutes > 0
                                      ? Math.round(
                                          (totalAllMinutes / operatingMinutes) *
                                            100
                                        )
                                      : 0;

                                  return (
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <div className="text-xs text-gray-500">
                                          Total Durasi
                                        </div>
                                        <div className="font-bold text-green-700">
                                          {formatDuration(totalAllMinutes)}
                                        </div>
                                      </div>

                                      <div>
                                        <div className="text-xs text-gray-500">
                                          Okupansi Harian
                                        </div>
                                        <div className="font-bold text-orange-700">
                                          {occupancyRate}%
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                            {isDateOpen && (
                              <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                                {consoleNames
                                  .sort(
                                    (a, b) =>
                                      consolesMap[b].totalDurationMinutes -
                                      consolesMap[a].totalDurationMinutes
                                  )
                                  .map((consoleName) => {
                                    const key = `${dk}|${consoleName}`;
                                    const open =
                                      expandedConsoleBuckets.has(key);
                                    const cdata = consolesMap[consoleName];
                                    return (
                                      <div
                                        key={consoleName}
                                        className="border rounded-lg"
                                      >
                                        <button
                                          onClick={() => {
                                            const next = new Set(
                                              expandedConsoleBuckets
                                            );
                                            if (next.has(key)) next.delete(key);
                                            else next.add(key);
                                            setExpandedConsoleBuckets(next);
                                          }}
                                          className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100"
                                          aria-expanded={open}
                                        >
                                          <div className="text-left">
                                            <div className="text-sm font-medium text-gray-900">
                                              {consoleName}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              {cdata.count} transaksi
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-sm font-semibold text-blue-700">
                                              {formatDuration(
                                                cdata.totalDurationMinutes
                                              )}
                                            </div>
                                          </div>
                                        </button>
                                        {open && (
                                          <div className="p-3 overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                              <thead className="bg-white">
                                                <tr>
                                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Waktu
                                                  </th>
                                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Console
                                                  </th>
                                                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                    Durasi
                                                  </th>
                                                  {/* <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                            Harga per Jam
                                          </th> */}
                                                </tr>
                                              </thead>
                                              <tbody className="bg-white divide-y divide-gray-100">
                                                {cdata.list.map((t: any) => {
                                                  const durationMinutes =
                                                    t.details?.rental
                                                      ?.duration_minutes ||
                                                    t.details
                                                      ?.duration_minutes ||
                                                    t.details
                                                      ?.additional_duration_minutes ||
                                                    0;
                                                  const consoleName =
                                                    t.details.items[0]?.name ||
                                                    t.details?.rental
                                                      ?.console ||
                                                    "-";
                                                  // const hourlyRate =
                                                  //   t.details?.rental
                                                  //     ?.hourly_rate_snapshot ||
                                                  //   t.details?.items?.[0]?.price ||
                                                  //   0;
                                                  return (
                                                    <tr
                                                      key={t.id}
                                                      className="hover:bg-gray-50"
                                                    >
                                                      <td className="px-3 py-2 text-sm">
                                                        {new Date(
                                                          t.timestamp
                                                        ).toLocaleString(
                                                          "id-ID",
                                                          {
                                                            hour12: false,
                                                          }
                                                        )}
                                                      </td>
                                                      <td className="px-3 py-2 text-sm text-gray-900">
                                                        {consoleName}
                                                      </td>
                                                      <td className="px-3 py-2 text-sm text-right text-gray-900">
                                                        {formatDuration(
                                                          durationMinutes
                                                        )}
                                                      </td>
                                                      {/* <td className="px-3 py-2 text-right text-sm">
                                                Rp{" "}
                                                {Number(
                                                  hourlyRate
                                                ).toLocaleString("id-ID")}
                                              </td> */}
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                              <tfoot>
                                                <tr className="bg-gray-50">
                                                  <td
                                                    colSpan={2}
                                                    className="px-3 py-2 text-right font-semibold text-gray-900"
                                                  >
                                                    Subtotal Console
                                                  </td>
                                                  <td className="px-3 py-2 text-sm text-right font-semibold text-blue-700">
                                                    {formatDuration(
                                                      cdata.totalDurationMinutes
                                                    )}
                                                  </td>
                                                </tr>
                                              </tfoot>
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
                ) : (
                  <div className="divide-y divide-gray-200 max-h-screen overflow-y-auto">
                    {rekapConsoleByConsole.consoleNames.length === 0 ? (
                      <div className="p-12 text-center">
                        <Gamepad className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">
                          Tidak ada data console ditemukan
                        </p>
                      </div>
                    ) : (
                      rekapConsoleByConsole.consoleNames.map((consoleName) => {
                        const consoleData =
                          rekapConsoleByConsole.map[consoleName];
                        const isConsoleOpen =
                          expandedConsoleBuckets.has(consoleName);
                        const sortedDates = Object.keys(consoleData.dates).sort(
                          (a, b) => (a < b ? 1 : -1)
                        );
                        const formatDuration = (minutes: number) => {
                          const hours = Math.floor(minutes / 60);
                          const mins = minutes % 60;
                          if (hours === 0) return `${mins} menit`;
                          if (mins === 0) return `${hours} jam`;
                          return `${hours} jam ${mins} menit`;
                        };

                        return (
                          <div
                            key={consoleName}
                            className="p-6 hover:bg-gray-50 transition-colors"
                          >
                            <button
                              onClick={() => {
                                const next = new Set(expandedConsoleBuckets);
                                if (next.has(consoleName))
                                  next.delete(consoleName);
                                else next.add(consoleName);
                                setExpandedConsoleBuckets(next);
                              }}
                              className="w-full flex items-center justify-between"
                              aria-expanded={isConsoleOpen}
                            >
                              <div className="text-left">
                                <div className="text-lg font-semibold text-gray-900">
                                  {consoleName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {consoleData.count} transaksi
                                </div>
                              </div>
                              <div className="text-right space-y-1">
                                <div className="text-sm font-semibold text-blue-700">
                                  {formatDuration(
                                    consoleData.totalDurationMinutes
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {sortedDates.length} hari aktif
                                </div>
                                <div className="text-xs text-blue-600 font-medium">
                                  Okupansi:{" "}
                                  {(() => {
                                    const operatingMinutes =
                                      sortedDates.length * 14 * 60;
                                    const occupancyRate =
                                      operatingMinutes > 0
                                        ? Math.round(
                                            (consoleData.totalDurationMinutes /
                                              operatingMinutes) *
                                              100
                                          )
                                        : 0;
                                    return `${occupancyRate}%`;
                                  })()}
                                </div>
                              </div>
                            </button>

                            {isConsoleOpen && (
                              <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                                {sortedDates.map((dk) => {
                                  const dateKey = `${consoleName}|${dk}`;
                                  const open =
                                    expandedConsoleDateBuckets.has(dateKey);
                                  const dateData = consoleData.dates[dk];

                                  return (
                                    <div
                                      key={dateKey}
                                      className="border rounded-lg"
                                    >
                                      <button
                                        onClick={() => {
                                          const next = new Set(
                                            expandedConsoleDateBuckets
                                          );
                                          if (next.has(dateKey))
                                            next.delete(dateKey);
                                          else next.add(dateKey);
                                          setExpandedConsoleDateBuckets(next);
                                        }}
                                        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100"
                                        aria-expanded={open}
                                      >
                                        <div className="text-left">
                                          <div className="text-sm font-medium text-gray-900">
                                            {new Date(dk).toLocaleDateString(
                                              "id-ID",
                                              {
                                                weekday: "long",
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric",
                                              }
                                            )}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {dateData.count} transaksi
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-sm font-semibold text-blue-700">
                                            {formatDuration(
                                              dateData.totalDurationMinutes
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                      {open && (
                                        <div className="p-3 overflow-x-auto">
                                          <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-white">
                                              <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                  Waktu
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                  Console
                                                </th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                  Durasi
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-100">
                                              {dateData.list.map((t: any) => {
                                                const durationMinutes =
                                                  t.details?.rental
                                                    ?.duration_minutes ||
                                                  t.details?.duration_minutes ||
                                                  t.details
                                                    ?.additional_duration_minutes ||
                                                  0;
                                                const consoleNameItem =
                                                  t.details.items[0]?.name ||
                                                  t.details?.rental?.console ||
                                                  "-";
                                                return (
                                                  <tr
                                                    key={t.id}
                                                    className="hover:bg-gray-50"
                                                  >
                                                    <td className="px-3 py-2 text-sm">
                                                      {new Date(
                                                        t.timestamp
                                                      ).toLocaleString(
                                                        "id-ID",
                                                        {
                                                          hour12: false,
                                                        }
                                                      )}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-900">
                                                      {consoleNameItem}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-right text-gray-900">
                                                      {formatDuration(
                                                        durationMinutes
                                                      )}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                            <tfoot>
                                              <tr className="bg-gray-50">
                                                <td
                                                  colSpan={2}
                                                  className="px-3 py-2 text-right font-semibold text-gray-900"
                                                >
                                                  Subtotal Harian
                                                </td>
                                                <td className="px-3 py-2 text-sm text-right font-semibold text-blue-700">
                                                  {formatDuration(
                                                    dateData.totalDurationMinutes
                                                  )}
                                                </td>
                                              </tr>
                                            </tfoot>
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
              </div>
            )
          ) : activeView === "laporan_kasir" ? (
              <>
                <div className="divide-y divide-gray-200 max-h-screen overflow-y-auto">
                  {paginatedData.length === 0 ? (
                    <div className="p-12 text-center">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        Tidak ada transaksi ditemukan
                      </p>
                    </div>
                  ) : (
                    paginatedData.map((transaction: any) => {
                      const isSelected =
                        selectedItem === String(transaction.id);
                      return (
                        <div
                          key={transaction.id}
                          className="p-6 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  transaction.type === "income"
                                    ? "bg-emerald-100"
                                    : transaction.type === "sale"
                                    ? "bg-green-100"
                                    : transaction.type === "rental"
                                    ? "bg-blue-100"
                                    : transaction.type === "voucher"
                                    ? "bg-purple-100"
                                    : "bg-red-100"
                                }`}
                              >
                                {transaction.type === "income" ? (
                                  <DollarSign className="h-5 w-5 text-emerald-600" />
                                ) : transaction.type === "sale" ? (
                                  <Coffee className="h-5 w-5 text-green-600" />
                                ) : transaction.type === "rental" ? (
                                  <Gamepad className="h-5 w-5 text-blue-600" />
                                ) : transaction.type === "voucher" ? (
                                  <Ticket className="h-5 w-5 text-purple-600" />
                                ) : (
                                  <TrendingDown className="h-5 w-5 text-red-600" />
                                )}
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900">
                                  {transaction.description}
                                </h3>
                                <div className="flex items-center gap-3 mt-1">
                                  <span
                                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                      transaction.type === "income"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : transaction.payment_method === "cash"
                                        ? "bg-green-100 text-green-800"
                                        : transaction.payment_method === "card"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-purple-100 text-purple-800"
                                    }`}
                                  >
                                    {transaction.type === "income"
                                      ? "SALDO"
                                      : (
                                          transaction.payment_method || "cash"
                                        ).toUpperCase()}
                                  </span>
                                  <div className="flex items-center gap-1 text-sm text-gray-600">
                                    <Clock className="h-4 w-4" />
                                    {new Date(
                                      transaction.timestamp
                                    ).toLocaleString("id-ID", {
                                      day: "numeric",
                                      month: "numeric",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: false,
                                    })}
                                  </div>
                                  {transaction.reference_id && (
                                    <span className="text-sm text-gray-500">
                                      Ref: {transaction.reference_id}
                                    </span>
                                  )}

                                  {!transaction?.details ||
                                    (!transaction.details?.action && (
                                      <button
                                        onClick={() =>
                                          setSelectedItem((prev) =>
                                            prev === String(transaction.id)
                                              ? null
                                              : String(transaction.id)
                                          )
                                        }
                                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                        title={
                                          isSelected
                                            ? "Sembunyikan detail"
                                            : "Lihat detail"
                                        }
                                      >
                                        {isSelected ? "Tutup" : "Detail"}
                                      </button>
                                    ))}

                                  {!(transaction.type === "expense") &&
                                    transaction.reference_id &&
                                    !String(transaction.reference_id)
                                      .toUpperCase()
                                      .includes("OPENING-CASH") &&
                                    !String(transaction.reference_id)
                                      .toUpperCase()
                                      .includes("MOVE_RENTAL") &&
                                    !String(transaction.reference_id)
                                      .toUpperCase()
                                      .includes("CANCELLED") && (
                                      <button
                                        onClick={() =>
                                          handlePrintReceipt(transaction)
                                        }
                                        className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center gap-1"
                                        title="Cetak struk"
                                      >
                                        <Receipt className="h-3 w-3" />
                                        Print
                                      </button>
                                    )}

                                  {/* Edit button */}
                                  {!(
                                    transaction.type === "expense" ||
                                    transaction.type === "voucher" ||
                                    transaction.type === "rental"
                                  ) &&
                                    transaction.reference_id &&
                                    !String(transaction.reference_id)
                                      .toUpperCase()
                                      .includes("OPENING-CASH") && (
                                      <button
                                        onClick={() =>
                                          openEditTransaction(transaction)
                                        }
                                        className="text-amber-600 hover:text-amber-700 text-sm font-medium flex items-center gap-1"
                                        title="Edit transaksi"
                                      >
                                        <SquarePen className="h-3 w-3" />
                                        Edit
                                      </button>
                                    )}

                                  {/* Delete button */}
                                  {transaction.type !== "expense" &&
                                    transaction.reference_id &&
                                    !String(transaction.reference_id)
                                      .toUpperCase()
                                      .includes("OPENING-CASH") &&
                                    !String(transaction.reference_id)
                                      .toUpperCase()
                                      .includes("MOVE_RENTAL") && (
                                      <button
                                        onClick={() =>
                                          handleDeleteTransaction(
                                            transaction.id
                                          )
                                        }
                                        disabled={saving}
                                        className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Hapus transaksi"
                                      >
                                        <Trash className="h-3 w-3" />
                                        Hapus
                                      </button>
                                    )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <p
                                className={`text-lg font-bold ${
                                  transaction.type === "expense"
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                {transaction.type === "expense" ? "-" : "+"}Rp{" "}
                                {Number(transaction.amount || 0).toLocaleString(
                                  "id-ID"
                                )}
                              </p>
                              <p className="text-sm text-gray-600 capitalize">
                                {transaction.type}
                              </p>
                            </div>
                          </div>

                          {isSelected &&
                            (
                              transaction.details?.items ??
                              transaction.metadata?.items ??
                              []
                            ).length > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <h4 className="font-medium text-gray-900 mb-3">
                                  Detail
                                </h4>
                                <div className="space-y-2">
                                  {(
                                    (transaction.details?.items ??
                                      transaction.metadata?.items) ||
                                    []
                                  ).map((it: any, idx: number) => {
                                    const name =
                                      it.name ??
                                      it.product_name ??
                                      it.title ??
                                      "Item";
                                    const qty = Number(
                                      it.qty ?? it.quantity ?? 1
                                    );
                                    const unit = Number(it.price ?? 0);
                                    const total =
                                      Number(it.total ?? unit * qty) || 0;
                                    return (
                                      <div
                                        key={idx}
                                        className="flex justify-between items-center text-sm"
                                      >
                                        <span className="text-gray-700">
                                          {/* {name} x @{qty} */}
                                          {it.type === "rental"
                                            ? name
                                            : `${name} x @${qty}`}
                                        </span>
                                        <span className="font-medium text-gray-900">
                                          Rp {total.toLocaleString("id-ID")}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                {jurnalSubTab === "detail" ? (
                  <div className="divide-y divide-gray-200">
                    {paginatedEntries.length === 0 ? (
                      <div className="p-12 text-center">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">
                          {debouncedSearchTerm.trim()
                            ? `Tidak ada transaksi yang cocok dengan "${debouncedSearchTerm}"`
                            : "Tidak ada data jurnal ditemukan"}
                        </p>
                      </div>
                    ) : (
                      paginatedEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="p-6 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  entry.type === "income"
                                    ? "bg-green-100"
                                    : "bg-red-100"
                                }`}
                              >
                                {getTypeIcon(entry.type)}
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900">
                                  {entry.description}
                                </h3>
                                <div className="flex items-center gap-3 mt-1">
                                  <span
                                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                                      entry.category
                                    )}`}
                                  >
                                    {categories.find(
                                      (c) => c.value === entry.category
                                    )?.label || entry.category}
                                  </span>
                                  <div className="flex items-center gap-1 text-sm text-gray-600">
                                    <Calendar className="h-4 w-4" />
                                    {new Date(
                                      entry.entry_date
                                    ).toLocaleDateString("id-ID")}
                                  </div>
                                  {entry.reference && (
                                    <span className="text-sm text-gray-500">
                                      Ref: {entry.reference}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p
                                  className={`text-lg font-bold ${
                                    entry.type === "income"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {entry.type === "income" ? "+" : "-"}Rp{" "}
                                  {entry.amount.toLocaleString("id-ID")}
                                </p>
                                <p className="text-sm text-gray-600 capitalize">
                                  {types.find((t) => t.value === entry.type)
                                    ?.label || entry.type}
                                </p>
                              </div>

                              {/* Action buttons */}
                              <div className="flex gap-2">
                                <button
                                  className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                  onClick={() => {
                                    setEditEntry(entry);
                                    setShowEditForm(true);
                                  }}
                                  title="Edit transaksi"
                                >
                                  <SquarePen className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Hapus transaksi"
                                >
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1-1H6a1 1 0 00-1-1z"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>

                          {entry.notes && (
                            <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                              <strong>Catatan:</strong> {entry.notes}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 p-4">
                    {(() => {
                      // Group entries by date
                      const entriesByDate = entries.reduce((acc, entry) => {
                        const date = entry.entry_date;
                        if (!acc[date]) {
                          acc[date] = {
                            entries: [],
                            totalIncome: 0,
                            totalExpense: 0,
                            netProfit: 0,
                          };
                        }
                        acc[date].entries.push(entry);
                        if (entry.type === "income") {
                          acc[date].totalIncome += entry.amount;
                        } else {
                          acc[date].totalExpense += entry.amount;
                        }
                        acc[date].netProfit =
                          acc[date].totalIncome - acc[date].totalExpense;
                        return acc;
                      }, {} as Record<string, { entries: any[]; totalIncome: number; totalExpense: number; netProfit: number }>);

                      const sortedDates = Object.keys(entriesByDate).sort(
                        (a, b) => b.localeCompare(a)
                      );

                      if (sortedDates.length === 0) {
                        return (
                          <div className="p-12 text-center">
                            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">
                              Tidak ada data jurnal ditemukan
                            </p>
                          </div>
                        );
                      }

                      return sortedDates.map((date) => {
                        const dayData = entriesByDate[date];
                        const isExpanded = expandedDates.has(date);

                        return (
                          <div
                            key={date}
                            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm text-gray-500">
                                  {new Date(date).toLocaleDateString("id-ID", {
                                    weekday: "long",
                                  })}
                                </div>
                                <button
                                  onClick={() => {
                                    const next = new Set(expandedDates);
                                    if (next.has(date)) next.delete(date);
                                    else next.add(date);
                                    setExpandedDates(next);
                                  }}
                                  className="font-semibold text-left text-blue-600 hover:underline flex items-center gap-2"
                                  aria-expanded={isExpanded}
                                >
                                  <span>
                                    {new Date(date).toLocaleDateString("id-ID")}
                                  </span>
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
                                <div className="text-sm text-gray-600 mt-1">
                                  {dayData.entries.length} transaksi
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-right">
                                <div>
                                  <div className="text-xs text-gray-500">
                                    Pemasukan
                                  </div>
                                  <div className="font-semibold text-green-600">
                                    Rp{" "}
                                    {dayData.totalIncome.toLocaleString(
                                      "id-ID"
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">
                                    Pengeluaran
                                  </div>
                                  <div className="font-semibold text-red-600">
                                    Rp{" "}
                                    {dayData.totalExpense.toLocaleString(
                                      "id-ID"
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">
                                    Saldo
                                  </div>
                                  <div
                                    className={`font-bold ${
                                      dayData.netProfit >= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    Rp{" "}
                                    {Math.abs(dayData.netProfit).toLocaleString(
                                      "id-ID"
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="space-y-3">
                                  {dayData.entries.map((entry) => (
                                    <div
                                      key={entry.id}
                                      className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span
                                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                                            entry.category
                                          )}`}
                                        >
                                          {categories.find(
                                            (c) => c.value === entry.category
                                          )?.label || entry.category}
                                        </span>
                                        <span className="text-sm text-gray-900">
                                          {entry.description}
                                        </span>
                                        {entry.reference && (
                                          <span className="text-xs text-gray-500">
                                            Ref: {entry.reference}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <span
                                          className={`text-sm font-semibold ${
                                            entry.type === "income"
                                              ? "text-green-600"
                                              : "text-red-600"
                                          }`}
                                        >
                                          {entry.type === "income" ? "+" : "-"}
                                          Rp{" "}
                                          {entry.amount.toLocaleString("id-ID")}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      {activeView == "laba_rugi" && labaRugiSubTab === "rekap" && (
        <ProfitCalendar />
      )}

      {activeView == "rekap_kasir" && transaksiKasirSubTab === "rekap" && (
        <div>
          <RevenueChart
            title="Total Omset Bulanan"
            data={chartData}
            height={300}
            loading={chartLoading}
          />
          <CashierCalendar />
        </div>
      )}

      {activeView == "rekap_console" && rekapConsoleViewSubTab === "rekap" && (
        <OccupancyCalendar />
      )}

      {activeView == "jurnal" && jurnalSubTab === "rekap" && (
        <JournalCalendar />
      )}

      {jurnalSubTab === "setoran" && renderSetoranTab()}

      {/* Pagination */}
      {activeTab !== "rekap" &&
        ((activeView === "jurnal" &&
          jurnalSubTab === "detail" &&
          journalTotalPages > 1) ||
          (activeView !== "jurnal" && totalPages > 1)) &&
        activeView !== "rekap_kasir" &&
        labaRugiSubTab !== "rekap" && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Halaman {currentPage} dari{" "}
                {activeView === "jurnal" && jurnalSubTab === "detail"
                  ? journalTotalPages
                  : totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        )}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Tambah Transaksi
              </h2>

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddEntry();
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipe Transaksi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newEntry.type}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="income">Pemasukan</option>
                    <option value="expense">Pengeluaran</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newEntry.category}
                    onChange={(e) =>
                      setNewEntry({
                        ...newEntry,
                        category: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {categories
                      .filter((c) => c.value !== "all")
                      .map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deskripsi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newEntry.description}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Deskripsi transaksi"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jumlah <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={newEntry.amount}
                    onChange={(e) =>
                      setNewEntry({
                        ...newEntry,
                        amount: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                    step="1000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={newEntry.date}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referensi (Opsional)
                  </label>
                  <input
                    type="text"
                    value={newEntry.reference}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, reference: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nomor referensi"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catatan (Opsional)
                  </label>
                  <textarea
                    value={newEntry.notes}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Catatan tambahan"
                  />
                </div>
              </form>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddForm(false)}
                  disabled={saving}
                  className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleAddEntry}
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pilih Sesi Kasir */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Pilih Sesi Kasir
                </h2>

                <button
                  onClick={() => setShowSessionModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Filters */}
              <div className="mb-4 flex items-center gap-2">
                <select
                  value={sessionPeriod}
                  onChange={(e) => setSessionPeriod(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {periods.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sessionStatusFilter}
                  onChange={(e) =>
                    setSessionStatusFilter(e.target.value as any)
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Aktif</option>
                  <option value="closed">Selesai</option>
                </select>
                {sessionPeriod === "range" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={sessionStartDate}
                      onChange={(e) => setSessionStartDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="text-gray-500">s/d</span>
                    <input
                      type="date"
                      value={sessionEndDate}
                      onChange={(e) => setSessionEndDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              <div className="mb-4">
                {(() => {
                  const totalIncome = filteredSessions.reduce(
                    (sum: number, s: any) => sum + Number(s.total_revenue || 0),
                    0
                  );
                  const totalExpense = filteredSessions.reduce(
                    (sum: number, s: any) => sum + Number(s.total_expense || 0),
                    0
                  );

                  const cashAmount = filteredSessions.reduce(
                    (sum: number, s: any) => sum + Number(s.total_cash || 0),
                    0
                  );
                  const cardAmount = filteredSessions.reduce(
                    (sum: number, s: any) => sum + Number(s.total_card || 0),
                    0
                  );
                  const transferAmount = filteredSessions.reduce(
                    (sum: number, s: any) =>
                      sum + Number(s.total_transfer || 0),
                    0
                  );
                  // const cashCount = filteredSessions.reduce(
                  //   (sum: number, s: any) =>
                  //     sum + Number(s.cash_transactions || 0),
                  //   0
                  // );
                  // const cardCount = filteredSessions.reduce(
                  //   (sum: number, s: any) =>
                  //     sum + Number(s.card_transactions || 0),
                  //   0
                  // );
                  // const transferCount = filteredSessions.reduce(
                  //   (sum: number, s: any) =>
                  //     sum + Number(s.transfer_transactions || 0),
                  //   0
                  // );
                  const paymentTotal = cashAmount + cardAmount + transferAmount;

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="text-sm text-green-700">
                            Total Pemasukan
                          </div>
                          <div className="mt-1 text-2xl font-bold text-green-800">
                            {`Rp ${totalIncome.toLocaleString("id-ID")}`}
                          </div>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="text-sm text-red-700">
                            Total Pengeluaran
                          </div>
                          <div className="mt-1 text-2xl font-bold text-red-800">
                            {`Rp ${totalExpense.toLocaleString("id-ID")}`}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-gray-700">
                              Pembayaran Tunai
                            </div>
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <Banknote className="h-4 w-4 text-green-600" />
                            </div>
                          </div>
                          <div className="text-xl font-bold text-gray-900">{`Rp ${cashAmount.toLocaleString(
                            "id-ID"
                          )}`}</div>
                          {/* <div className="text-xs text-gray-600 mt-1">
                            {cashCount} transaksi
                          </div> */}
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${
                                  paymentTotal > 0
                                    ? (cashAmount / paymentTotal) * 100
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-gray-700">
                              Pembayaran Kartu
                            </div>
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <CreditCard className="h-4 w-4 text-blue-600" />
                            </div>
                          </div>
                          <div className="text-xl font-bold text-gray-900">{`Rp ${cardAmount.toLocaleString(
                            "id-ID"
                          )}`}</div>
                          {/* <div className="text-xs text-gray-600 mt-1">
                            {cardCount} transaksi
                          </div> */}
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${
                                  paymentTotal > 0
                                    ? (cardAmount / paymentTotal) * 100
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-gray-700">
                              Transfer
                            </div>
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                              <CreditCard className="h-4 w-4 text-purple-600" />
                            </div>
                          </div>
                          <div className="text-xl font-bold text-gray-900">{`Rp ${transferAmount.toLocaleString(
                            "id-ID"
                          )}`}</div>
                          {/* <div className="text-xs text-gray-600 mt-1">
                            {transferCount} transaksi
                          </div> */}
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                            <div
                              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${
                                  paymentTotal > 0
                                    ? (transferAmount / paymentTotal) * 100
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Sessions List */}
              <div className="space-y-3">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedSessionId === session.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      setSelectedSessionId(session.id);
                      setShowSessionModal(false);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Clock className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {session.cashier_name || "Kasir"}
                            </h3>
                            <p className="text-sm text-gray-500">
                              ID: {session.id}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Mulai:</span>
                            <p className="font-medium">
                              {new Date(session.start_time).toLocaleString(
                                "id-ID",
                                {
                                  day: "numeric",
                                  month: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                }
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Status:</span>
                            <p
                              className={`font-medium ${
                                session.status === "active"
                                  ? "text-green-600"
                                  : "text-gray-600"
                              }`}
                            >
                              {session.status === "active"
                                ? "Aktif"
                                : "Selesai"}
                            </p>
                          </div>
                          {session.end_time && (
                            <div>
                              <span className="text-gray-600">Selesai:</span>
                              <p className="font-medium">
                                {new Date(session.end_time).toLocaleString(
                                  "id-ID"
                                )}
                              </p>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-600">Saldo Awal:</span>
                            <p className="font-medium">
                              Rp{" "}
                              {Number(session.opening_cash || 0).toLocaleString(
                                "id-ID"
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">
                              Total Pemasukan:
                            </span>
                            <p className="font-medium text-green-600">
                              Rp{" "}
                              {Number(
                                session.total_revenue || 0
                              ).toLocaleString("id-ID")}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">
                              Total Pengeluaran:
                            </span>
                            <p className="font-medium text-red-600">
                              Rp{" "}
                              {Number(
                                session.total_expense || 0
                              ).toLocaleString("id-ID")}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <button
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            selectedSessionId === session.id
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {selectedSessionId === session.id
                            ? "Dipilih"
                            : "Pilih"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {sessions.length === 0 && (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    Tidak ada sesi kasir ditemukan
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Transaksi Kasir (Sale) */}
      {showEditTxModal && editTx && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Edit Transaksi
                </h2>
                <button
                  onClick={() => setShowEditTxModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <div>Ref: {editTx.reference_id || "-"}</div>
                  <div>
                    Metode: {(editTx.payment_method || "cash").toUpperCase()}
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                    <div className="col-span-6">Item</div>
                    <div className="col-span-2 text-right">Harga</div>
                    <div className="col-span-2 text-right">Qty</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>
                  {editTxItems.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Tidak ada item
                    </div>
                  ) : (
                    editTxItems.map((it, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 px-4 py-2 border-t text-sm items-center"
                      >
                        <div className="col-span-6">
                          <div className="font-medium text-gray-900">
                            {it.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            PID: {it.productId || "-"}
                          </div>
                        </div>
                        <div className="col-span-2 text-right">
                          Rp {Number(it.price || 0).toLocaleString("id-ID")}
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={it.quantity}
                            min={0}
                            onChange={(e) =>
                              updateEditItemQuantity(
                                idx,
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                          />
                        </div>
                        <div className="col-span-2 text-right flex items-center justify-end gap-2">
                          <span>
                            Rp {Number(it.total || 0).toLocaleString("id-ID")}
                          </span>
                          <button
                            onClick={() => removeEditItem(idx)}
                            className="text-red-600 hover:text-red-700"
                            title="Hapus item"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div />
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Subtotal</div>
                    <div className="text-2xl font-bold text-gray-900">
                      Rp{" "}
                      {editTxItems
                        .reduce((s, it) => s + (Number(it.total) || 0), 0)
                        .toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowEditTxModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={saveEditedTransaction}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditForm && editEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Edit Transaksi
              </h2>

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleEditEntry();
                }}
              >
                {/* Tipe Transaksi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipe Transaksi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editEntry.type}
                    onChange={(e) =>
                      setEditEntry({
                        ...editEntry,
                        type: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="income">Pemasukan</option>
                    <option value="expense">Pengeluaran</option>
                  </select>
                </div>

                {/* Kategori */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editEntry.category}
                    onChange={(e) =>
                      setEditEntry({
                        ...editEntry,
                        category: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {categories
                      .filter((c) => c.value !== "all")
                      .map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Deskripsi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deskripsi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editEntry.description}
                    onChange={(e) =>
                      setEditEntry({
                        ...editEntry,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Deskripsi transaksi"
                    required
                  />
                </div>

                {/* Jumlah */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jumlah <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editEntry.amount}
                    onChange={(e) =>
                      setEditEntry({
                        ...editEntry,
                        amount: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                    step="1000"
                    required
                  />
                </div>

                {/* Tanggal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={editEntry.entry_date}
                    onChange={(e) =>
                      setEditEntry({ ...editEntry, entry_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Referensi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referensi (Opsional)
                  </label>
                  <input
                    type="text"
                    value={editEntry.reference || ""}
                    onChange={(e) =>
                      setEditEntry({ ...editEntry, reference: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nomor referensi"
                  />
                </div>

                {/* Catatan */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catatan (Opsional)
                  </label>
                  <textarea
                    value={editEntry.notes || ""}
                    onChange={(e) =>
                      setEditEntry({ ...editEntry, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Catatan tambahan"
                  />
                </div>
              </form>

              {/* Tombol Aksi */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditForm(false);
                    setEditEntry(null);
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleEditEntry}
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Perubahan"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookkeeping;
