import {
  CreditCard,
  RotateCcw,
  Pause,
  Info,
  Power,
  Printer,
  Ticket,
  History,
  RefreshCw,
  Loader2,
  Search,
  Copy,
  CheckCircle,
} from "lucide-react";
import { deleteSaleItem } from "../lib/deleteSaleItem";
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import RealTimeClock from "./RealTimeClock";
import Countdown from "./Countdown";
import { printReceipt, printRentalProof } from "../utils/receipt";
import { useTimer } from "../contexts/TimerContext";
import { useRFIDReader } from "../hooks/useRFIDReader";
import type { CardUsageLog, Game } from "../types";
import paketService from "../lib/paketService";
import { useAuth } from "../contexts/AuthContext";
// import { useMemberCardBilling } from "../hooks/useMemberCardBilling";

interface SaleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total?: number;
}

import {
  Clock,
  User,
  Gamepad2,
  DollarSign,
  Play,
  Square,
  Plus,
  ShoppingCart,
  Minus,
  X,
  UserPlus,
  Users,
  MapPin,
  Wrench,
  ArrowRightLeft,
  Lightbulb,
  Volume,
  VolumeX,
  Lock,
  Unlock,
} from "lucide-react";
import { db, supabase } from "../lib/supabase";
import Swal from "sweetalert2";

interface Console {
  id: string;
  name: string;
  equipment_type_id: string;
  rate_profile_id: string | null;
  rate_profiles?: {
    capital: number;
  };
  status: "available" | "rented" | "maintenance" | "paused";
  location?: string;
  serial_number?: string;
  is_active: boolean;
  auto_shutdown_enabled?: boolean;
  relay_command_on?: string;
  relay_command_off?: string;
  power_tv_command?: string;
  relay_command_status?: string;
  perintah_cek_power_tv?: string;
  ip_address_tv?: string;
}

interface RateProfile {
  id: string;
  name: string;
  hourly_rate: number;
  minimum_minutes: number;
  minimum_minutes_member: number;
}

interface RentalSession {
  id: string;
  card_uid?: string;
  customer_id?: string;
  console_id?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  total_amount: number;
  status: "active" | "completed" | "paused" | "cancelled";
  payment_status: "pending" | "partial" | "paid";
  paid_amount: number;
  is_voucher_used?: boolean;
  hourly_rate_snapshot?: number;
  per_minute_rate_snapshot?: number;
  total_points_deducted?: number;
  sale_items?: SaleItem[];
  // pause_start_time?: string;
  // total_pause_minutes?: number;
  customers?: {
    name: string;
    phone: string;
  };
  consoles?: {
    name: string;
    location: string;
    rate_profiles?: {
      capital?: number;
    };
  };
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  is_active: boolean;
  cost?: number;
}

interface CartItem {
  productId: string;
  productName: string;
  cost?: number;
  price: number;
  quantity: number;
  total: number;
  profit?: number;
}

type MoveModalState = { sessionId: string; fromConsoleId: string } | null;

type AddTimeModalState = {
  session: RentalSession;
  console: Console;
  currentDuration: number;
  hourlyRate: number;
} | null;

const getConsoleColorByRate = (console: any) => {
  const hourlyRate = console.rate_profiles?.hourly_rate;

  if (hourlyRate <= 6000) return "bg-green-700";
  if (hourlyRate <= 8000) return "bg-blue-700";
  if (hourlyRate <= 10000) return "bg-yellow-700";
  if (hourlyRate <= 20000) return "bg-orange-700";
  // return "bg-purple-900";
};

const getCurrentCashierSession = async () => {
  try {
    const { data } = await supabase.auth.getUser();
    const cashierId = data?.user?.id;

    if (!cashierId) return null;

    const { data: sessions } = await supabase
      .from("cashier_sessions")
      .select("id, cashier_id, cashier_name, start_time")
      .eq("cashier_id", cashierId)
      .eq("status", "active")
      .order("start_time", { ascending: false })
      .limit(1);

    return sessions?.[0] || null;
  } catch (error) {
    console.error("Error getting current cashier session:", error);
    return null;
  }
};

function groupDeductLogsBySession(logs: CardUsageLog[]) {
  const grouped: Record<
    string,
    {
      total_points: number;
      firstTimestamp: string;
      lastTimestamp: string;
      session_id: string;
      balance_before?: number;
      balance_after?: number;
      notes?: string;
    }
  > = {};

  logs.forEach((log) => {
    if (log.action_type !== "balance_deduct") return;

    const sid = log.session_id || "no-session";

    if (!grouped[sid]) {
      grouped[sid] = {
        total_points: log.points_amount,
        firstTimestamp: log.timestamp,
        lastTimestamp: log.timestamp,
        session_id: sid,
        balance_before: log.balance_before,
        balance_after: log.balance_after,
        notes: log.notes,
      };
    } else {
      grouped[sid].total_points += log.points_amount;

      // Update waktu awal dan akhir sesi
      if (new Date(log.timestamp) < new Date(grouped[sid].firstTimestamp)) {
        grouped[sid].firstTimestamp = log.timestamp;
        grouped[sid].balance_before = log.balance_before;
      }
      if (new Date(log.timestamp) > new Date(grouped[sid].lastTimestamp)) {
        grouped[sid].lastTimestamp = log.timestamp;
        grouped[sid].balance_after = log.balance_after;
      }
    }
  });

  // Hitung durasi sesi dan update notes
  Object.values(grouped).forEach((session) => {
    const start = new Date(session.firstTimestamp);
    const end = new Date(session.lastTimestamp);
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.ceil(diffMs / 60000);
    session.notes = `Automatic deduction for rental session - ${diffMinutes} minutes`;

    if (session.balance_before !== undefined && session.total_points > 0) {
      const expectedBalanceAfter =
        session.balance_before - session.total_points;

      // Jika balance_after dari log terakhir tidak konsisten, gunakan perhitungan
      if (session.balance_after !== expectedBalanceAfter) {
        session.balance_after = expectedBalanceAfter;
      }
    }
  });

  return Object.values(grouped);
}

// Fungsi helper untuk menghapus duplikat log berdasarkan kombinasi unik
function removeDuplicateLogs(logs: CardUsageLog[]): CardUsageLog[] {
  const seen = new Set<string>();
  const uniqueLogs: CardUsageLog[] = [];

  // Sort berdasarkan timestamp untuk memastikan kita ambil yang pertama
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  for (const log of sortedLogs) {
    // Buat key unik berdasarkan kombinasi yang penting
    const key = `${log.session_id || "no-session"}_${log.action_type}_${
      log.points_amount
    }_${log.balance_before}_${log.balance_after}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueLogs.push(log);
    }
  }

  return uniqueLogs;
}

// function groupDeductLogsBySession(
//   logs: CardUsageLog[],
//   currentBalance: number
// ) {
//   // Hapus duplikat terlebih dahulu
//   const uniqueLogs = removeDuplicateLogs(logs);

//   // Hitung running balance dari semua transaksi secara kronologis
//   const sortedLogs = [...uniqueLogs].sort(
//     (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
//   );

//   // Hitung running balance dari awal sampai akhir
//   let runningBalance = 0; // Mulai dari 0, kita akan hitung maju
//   const logsWithBalance = sortedLogs.map((log) => {
//     const balanceBefore = runningBalance;
//     let balanceAfter = runningBalance;

//     if (log.action_type === "balance_add") {
//       balanceAfter = runningBalance + log.points_amount;
//     } else if (log.action_type === "balance_deduct") {
//       balanceAfter = runningBalance - Math.abs(log.points_amount);
//     }

//     runningBalance = balanceAfter;

//     return {
//       ...log,
//       calculated_balance_before: balanceBefore,
//       calculated_balance_after: balanceAfter,
//     };
//   });

//   // Sesuaikan dengan balance saat ini
//   // Hitung selisih antara calculated balance akhir dengan current balance
//   const calculatedFinalBalance = runningBalance;
//   const adjustment = currentBalance - calculatedFinalBalance;

//   // Apply adjustment ke semua calculated balances
//   logsWithBalance.forEach((log) => {
//     log.calculated_balance_before += adjustment;
//     log.calculated_balance_after += adjustment;
//   });

//   // Sekarang group deduct logs menggunakan calculated balances
//   const grouped: Record<
//     string,
//     {
//       total_points: number;
//       firstTimestamp: string;
//       lastTimestamp: string;
//       session_id: string;
//       balance_before?: number;
//       balance_after?: number;
//       notes?: string;
//     }
//   > = {};

//   logsWithBalance
//     .filter((log) => log.action_type === "balance_deduct")
//     .forEach((log) => {
//       const sid = log.session_id || "no-session";

//       if (!grouped[sid]) {
//         grouped[sid] = {
//           total_points: Math.abs(log.points_amount), // Pastikan positive
//           firstTimestamp: log.timestamp,
//           lastTimestamp: log.timestamp,
//           session_id: sid,
//           balance_before: log.calculated_balance_before,
//           balance_after: log.calculated_balance_after,
//           notes: log.notes,
//         };
//       } else {
//         grouped[sid].total_points += Math.abs(log.points_amount);

//         // Update waktu awal dan akhir sesi
//         if (new Date(log.timestamp) < new Date(grouped[sid].firstTimestamp)) {
//           grouped[sid].firstTimestamp = log.timestamp;
//           grouped[sid].balance_before = log.calculated_balance_before;
//         }
//         if (new Date(log.timestamp) > new Date(grouped[sid].lastTimestamp)) {
//           grouped[sid].lastTimestamp = log.timestamp;
//           grouped[sid].balance_after = log.calculated_balance_after;
//         }
//       }
//     });

//   // Hitung durasi sesi dan update notes
//   Object.values(grouped).forEach((session) => {
//     const start = new Date(session.firstTimestamp);
//     const end = new Date(session.lastTimestamp);
//     const diffMs = end.getTime() - start.getTime();
//     const diffMinutes = Math.ceil(diffMs / 60000);
//     session.notes = `Automatic deduction for rental session - ${diffMinutes} minutes`;
//   });

//   return Object.values(grouped);
// }

export const ActiveRentals: React.FC = () => {
  // Timer context untuk global timer
  const {
    activeSessions: globalActiveSessions,
    refreshActiveSessions,
    isTimerRunning,
    triggerUnusedConsolesCheck,
  } = useTimer();

  const { user } = useAuth();

  // State untuk status relay dan TV
  const [relayStatus, setRelayStatus] = useState<string>("OFF");
  const [tvStatus, setTvStatus] = useState<"ON" | "OFF">("OFF");
  const [consoles, setConsoles] = useState<Console[]>([]);
  const [selectedConsoleIds, setSelectedConsoleIds] = useState<string[]>([]);
  const [consoleFilter, setConsoleFilter] = useState<
    "all" | "available" | "rented" | "maintenance"
  >("all");
  const [searchConsole, setSearchConsole] = useState("");
  const [rateProfiles, setRateProfiles] = useState<RateProfile[]>([]);
  const [activeSessions, setActiveSessions] = useState<RentalSession[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [billingProducts, setBillingProducts] = useState<any[]>([]);
  const [searchProduct, setSearchProduct] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showStartRentalModal, setShowStartRentalModal] = useState<
    string | null
  >(null);
  // const [customers, setCustomers] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<CardUsageLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistoryPointModal, setShowHistoryPointModal] = useState(false);
  const [rentalType, setRentalType] = useState<
    "pay-as-you-go" | "prepaid" | "member-card"
  >("pay-as-you-go");
  // const [activatedPayAsYouGoCard, setActivatedPayAsYouGoCard] =
  //   useState<string>("");
  const [payAsYouGoProcessing, setPayAsYouGoProcessing] = useState(false);
  const [payAsYouGoSummary, setPayAsYouGoSummary] = useState<{
    totalMinutes: number;
    totalPointsDeducted: number;
    sessionsCount: number;
    estimatedCost: number;
    minimumMinutes: number;
    hourlyRate: number;
  } | null>(null);
  const [payAsYouGoSummaryLoading, setPayAsYouGoSummaryLoading] =
    useState(false);
  const [scannedCardUID, setScannedCardUID] = useState<string>("");
  const [scannedCardData, setScannedCardData] = useState<any>(null);
  const [startRentalLoading, setStartRentalLoading] = useState<boolean>(false);
  const [processPaymentLoading, setProcessPaymentLoading] =
    useState<boolean>(false);
  const [endingSessionIds, setEndingSessionIds] = useState<Set<string>>(
    new Set(),
  );
  const [showVoucherPaymentModal, setShowVoucherPaymentModal] = useState(false);
  const [consoleHistorySessions, setConsoleHistorySessions] = useState<
    RentalSession[]
  >([]);
  const [showConsoleHistoryModal, setShowConsoleHistoryModal] = useState(false);
  const [selectedConsoleForHistory, setSelectedConsoleForHistory] =
    useState<string>("");

  // State untuk modal paket
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [availablePackages, setAvailablePackages] = useState<any[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [packageLoading, setPackageLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

  // Game Search Feature State
  const [showGameSearchModal, setShowGameSearchModal] = useState(false);
  const [catalogGames, setCatalogGames] = useState<Game[]>([]);
  const [catalogConsoles, setCatalogConsoles] = useState<any[]>([]);
  const [gameSearchTerm, setGameSearchTerm] = useState("");
  const [gameSearchPlatform, setGameSearchPlatform] = useState<string>("all");
  const [gameSearchGenre, setGameSearchGenre] = useState<string>("all");
  const [gameSearchConsole, setGameSearchConsole] = useState<string>("all");
  const [gameSearchLoading, setGameSearchLoading] = useState(false);
  const [gameSearchCopySuccess, setGameSearchCopySuccess] = useState(false);
  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    catalogGames.forEach((game) => {
      if (game.genre) {
        game.genre.forEach((g) => genres.add(g));
      }
    });
    return Array.from(genres).sort();
  }, [catalogGames]);

  const platformNames: Record<string, string> = {
    ET006: "PlayStation 3",
    ET001: "PlayStation 4 Pro",
    ET003: "PlayStation 4 Slim",
    ET002: "PlayStation 5",
  };

  const handleOpenGameSearch = async (consoleId?: string) => {
    setShowGameSearchModal(true);
    setGameSearchConsole(consoleId || "all");
    setGameSearchGenre("all");
    setGameSearchPlatform("all");
    setGameSearchTerm(""); // Also reset search term for better UX
    setGameSearchLoading(true);
    try {
      const [gamesData, consolesData] = await Promise.all([
        db.games.getAll(),
        db.consoles.getAll(),
      ]);
      setCatalogGames(gamesData || []);
      setCatalogConsoles(consolesData || []);
    } catch (error) {
      console.error("Error loading games data:", error);
      Swal.fire("Error", "Gagal memuat data game", "error");
    } finally {
      setGameSearchLoading(false);
    }
  };

  const handleCopyGameSearch = async () => {
    // Get filtered games
    const filteredGames = catalogGames.filter(
      (g) =>
        g.is_active &&
        g.title.toLowerCase().includes(gameSearchTerm.toLowerCase()) &&
        (gameSearchPlatform === "all" || (g.platform && g.platform.includes(gameSearchPlatform))) &&
        (gameSearchGenre === "all" || (g.genre && g.genre.includes(gameSearchGenre))) &&
        (gameSearchConsole === "all" || (catalogConsoles.find(c => c.id === gameSearchConsole)?.installed_games?.includes(g.id)))
    );

    // Get platform name from combo box value
    const platformName = gameSearchPlatform === "all" 
      ? "Semua Platform" 
      : platformNames[gameSearchPlatform] || gameSearchPlatform;

    // Get genre name from combo box value
    const genreName = gameSearchGenre === "all" 
      ? "Semua Genre" 
      : gameSearchGenre;

    // Get console name from combo box value
    const consoleName = gameSearchConsole === "all"
      ? "Semua Console"
      : catalogConsoles.find(c => c.id === gameSearchConsole)?.name || "-";

    // Build formatted text
    let textToCopy = `Platform : ${platformName}\n`;
    textToCopy += `Genre    : ${genreName}\n`;
    textToCopy += `Console  : ${consoleName}\n\n`;

    filteredGames.forEach((game, index) => {
      textToCopy += `${index + 1}. ${game.title}\n`;
    });

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(textToCopy);
      setGameSearchCopySuccess(true);
      setTimeout(() => setGameSearchCopySuccess(false), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      Swal.fire("Error", "Gagal copy ke clipboard", "error");
    }
  };

  const fetchCardData = async (uid: string) => {
    if (!uid) {
      setScannedCardData(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("rfid_cards")
        .select(
          "uid, balance_points, status, is_helper_card, is_pay_as_you_go_card",
        )
        .eq("uid", uid)
        .single();

      if (!error && data) {
        setScannedCardData(data);
        console.log("Card data fetched:", data);
      } else {
        setScannedCardData(null);
        console.error("Error fetching card data:", error);
      }
    } catch (error) {
      console.error("Error fetching card data:", error);
      setScannedCardData(null);
    }
  };

  useEffect(() => {
    const calculatePayAsYouGoSummary = async () => {
      if (!scannedCardUID || !scannedCardData?.is_pay_as_you_go_card) {
        setPayAsYouGoSummary(null);
        setPayAsYouGoSummaryLoading(false);
        return;
      }

      try {
        const { data: logs, error: logsError } = await supabase
          .from("card_usage_logs")
          .select("session_id, action_type, timestamp, points_amount")
          .eq("card_uid", scannedCardUID)
          .eq("action_type", "balance_deduct")
          .order("timestamp", { ascending: true });

        if (logsError) throw logsError;

        if (!logs || logs.length === 0) {
          setPayAsYouGoSummary(null);
          setPayAsYouGoSummaryLoading(false);
          return;
        }

        // Hitung total durasi dari semua logs
        let totalMinutes = 0;
        let totalPointsDeducted = 0;
        let minimumMinutes = 60;
        let hourlyRate = 50000;
        const sessionIds = [
          ...new Set(logs.map((log) => log.session_id).filter(Boolean)),
        ];

        if (logs[0]?.session_id) {
          const { data: firstSession } = await supabase
            .from("rental_sessions")
            .select(
              `
              consoles(rate_profiles(hourly_rate, minimum_minutes))
            `,
            )
            .eq("id", logs[0].session_id)
            .single();

          if (firstSession?.consoles?.rate_profiles) {
            minimumMinutes =
              firstSession.consoles?.rate_profiles.minimum_minutes ?? 60;
            hourlyRate =
              firstSession.consoles?.rate_profiles.hourly_rate ?? 10000;
          }
        }

        for (const log of logs) {
          if (log.session_id) {
            const { data: session } = await supabase
              .from("rental_sessions")
              .select(
                `
                start_time, end_time, duration_minutes,
                consoles(rate_profiles(hourly_rate))
              `,
              )
              .eq("id", log.session_id)
              .single();

            if (session?.consoles?.rate_profiles?.hourly_rate) {
              const hourlyRate =
                session?.consoles?.rate_profiles?.hourly_rate ?? 50000;
              const costPerMinute = hourlyRate / 60;
              const minutesUsed = Math.abs(log.points_amount) / costPerMinute;
              totalMinutes += minutesUsed;
            }
          }
          totalPointsDeducted += Math.abs(log.points_amount);
        }

        // Rule pay-as-you-go: minimal pembayaran per jam penuh
        let estimatedCost = 0;
        if (totalMinutes < minimumMinutes) {
          estimatedCost = hourlyRate;
        } else {
          estimatedCost = totalPointsDeducted;
        }

        setPayAsYouGoSummary({
          totalMinutes: Math.floor(totalMinutes),
          totalPointsDeducted,
          sessionsCount: sessionIds.length,
          estimatedCost,
          minimumMinutes,
          hourlyRate,
        });
      } catch (error) {
        console.error("Error calculating pay-as-you-go summary:", error);
        setPayAsYouGoSummary(null);
      } finally {
        setPayAsYouGoSummaryLoading(false);
      }
    };

    calculatePayAsYouGoSummary();
  }, [scannedCardUID, scannedCardData?.is_pay_as_you_go_card]);

  const resetPoints = async () => {
    if (!scannedCardUID || !scannedCardData) return;

    try {
      const { error } = await supabase
        .from("rfid_cards")
        .update({
          balance_points: 0,
          avg_nilai_point: 0,
          total_poin_ever: 0,
          total_uang_ever: 0,
        })
        .eq("uid", scannedCardUID);

      if (!error) {
        setScannedCardData({
          ...scannedCardData,
          balance_points: 0,
          avg_nilai_point: 0,
          total_poin_ever: 0,
          total_uang_ever: 0,
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        Swal.fire("Berhasil", "Points berhasil direset menjadi 0", "success");
      } else {
        Swal.fire("Gagal", "Gagal mereset points", "error");
      }
    } catch (error) {
      console.error("Error resetting points:", error);
      Swal.fire("Gagal", "Terjadi kesalahan saat mereset points", "error");
    }
  };

  // Fungsi untuk fetch paket
  const fetchAvailablePackages = async (consoleId: string) => {
    setPackageLoading(true);
    try {
      const packages = await paketService.loadPakets();
      const consoleObj = consoles.find((c) => c.id === consoleId);

      if (!consoleObj) {
        setAvailablePackages([]);
        return;
      }

      const filteredPackages = packages!.filter((pkg: any) => {
        const relatedConsoles = pkg.selectedConsoles || [];

        return relatedConsoles.includes(consoleId);
      });

      const activePackages = filteredPackages.filter(
        (pkg: any) => pkg.status === "active",
      );

      setAvailablePackages(activePackages);
    } catch (error) {
      console.error("Error fetching packages:", error);
      setAvailablePackages([]);
    } finally {
      setPackageLoading(false);
    }
  };

  // Fungsi untuk menangani pemilihan paket
  const handleSelectPackage = (pkg: any) => {
    if (!showStartRentalModal) return;

    setSelectedPackage(pkg);
    setShowPackageModal(false);

    setRentalDurationHours(pkg.durationHours);
    setRentalDurationMinutes(pkg.durationMinutes);

    // Tampilkan modal pembayaran prepaid
    const consoleObj = consoles.find((c) => c.id === showStartRentalModal);
    if (!consoleObj) return;

    const hourlyRate = pkg.pricePerHour || 0;
    const totalAmount = pkg.packagePrice || 0;

    setShowPrepaidPaymentModal({
      console: consoleObj,
      duration: pkg.durationHours * 60 + pkg.durationMinutes,
      hourlyRate,
      totalAmount,
      rentalDurationHours: pkg.durationHours,
      rentalDurationMinutes: pkg.durationMinutes,
    });
  };

  const fetchCardHistory = async (cardUID: string) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("card_usage_logs")
        .select(
          "id, card_uid, session_id, action_type, points_amount, balance_before, balance_after, timestamp, notes",
        )
        .eq("card_uid", cardUID)
        .order("timestamp", { ascending: false });
      // .limit(100);

      if (error) throw error;
      setHistoryLogs((data || []) as unknown as CardUsageLog[]);
    } catch (e) {
      console.error("Error loading card history:", e);
      setHistoryLogs([]);
      Swal.fire("Error", "Gagal memuat riwayat kartu", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  // RFID Reader hook
  useRFIDReader((uid) => {
    setScannedCardUID(uid);
    fetchCardData(uid);
  });

  // Member Card Billing hook
  // useMemberCardBilling(activeSessions);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showCheckBalanceModal, setShowCheckBalanceModal] = useState(false);
  const [showPayAsYouGoModal, setShowPayAsYouGoModal] = useState(false);
  const [voucherSearchTerm, setVoucherSearchTerm] = useState("");
  const [voucherList, setVoucherList] = useState<any[]>([]);
  const [showSellVoucherModal, setShowSellVoucherModal] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState("");
  const [selling, setSelling] = useState(false);
  const [voucherQuantity, setVoucherQuantity] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris" | "card">("cash");

  const [showAddTimeModal, setShowAddTimeModal] =
    useState<AddTimeModalState>(null);
  const [addTimeLoading, setAddTimeLoading] = useState(false);
  // const [addTimeHours, setAddTimeHours] = useState(1);
  // const [addTimeMinutes, setAddTimeMinutes] = useState(0);

  const [rentalDurationHours, setRentalDurationHours] = useState<number>(1);
  const [rentalDurationMinutes, setRentalDurationMinutes] = useState<number>(0);

  const [rentalStartTime, setRentalStartTime] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  // Auto shutdown protection states
  const [autoShutdownEnabled, setAutoShutdownEnabled] = useState<boolean>(true);
  const [consoleAutoShutdownStates, setConsoleAutoShutdownStates] = useState<{
    [key: string]: boolean;
  }>({});
  const [isUpdatingAutoShutdown, setIsUpdatingAutoShutdown] =
    useState<boolean>(false);
  const [updatingConsoleIds, setUpdatingConsoleIds] = useState<Set<string>>(
    new Set(),
  );
  const [showAutoShutdownModal, setShowAutoShutdownModal] =
    useState<boolean>(false);
  const [showToolsModal, setShowToolsModal] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [selectedCommand, setSelectedCommand] = useState("");
  const [volume, setVolume] = useState<number>(10);
  const [preparationMinutes, setPreparationMinutes] = useState<number>(5);
  const [consoleStatuses, setConsoleStatuses] = useState<{
    [key: string]: {
      tv: boolean;
      lamp: boolean;
      volume: number;
    };
  }>({});
  const [isRefreshingStatuses, setIsRefreshingStatuses] = useState(false);

  // State untuk tracking console yang sedang dalam mode persiapan
  const [preparationMode, setPreparationMode] = useState<{
    [consoleId: string]: {
      isActive: boolean;
      timeoutId: NodeJS.Timeout | null;
      originalAutoShutdown: boolean;
      endAtMs: number;
    };
  }>({});

  const getNowForDatetimeLocal = React.useCallback(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }, []);

  // Sinkronkan waktu setiap kali modal Start Rental dibuka
  React.useEffect(() => {
    if (showStartRentalModal) {
      setRentalStartTime(getNowForDatetimeLocal());
    }
  }, [showStartRentalModal, getNowForDatetimeLocal]);

  // Fungsi untuk menjalankan persiapan untuk satu console
  const handleSingleConsolePersiapan = async (targetConsole: Console) => {
    const { value: preparationMinutes } = await Swal.fire({
      title: "Persiapan Console",
      html: `
        <p>Perintah ini akan:</p>
        <ul style="text-align: left; margin: 10px 0;">
          <li>Menyalakan TV dan nomor untuk waktu tertentu</li>
          <li>Mematikan semuanya secara otomatis setelah waktu habis</li>
        </ul>
        <p><strong>Console: ${targetConsole.name}</strong></p>
        <div style="margin-top: 15px;">
          <label for="preparation-minutes" style="display: block; margin-bottom: 5px; font-weight: bold;">
            Durasi Persiapan (menit):
          </label>
          <input 
            id="preparation-minutes" 
            type="number" 
            min="1" 
            max="60" 
            value="5" 
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
            placeholder="Masukkan durasi dalam menit"
          />
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Mulai Persiapan",
      cancelButtonText: "Batal",
      preConfirm: () => {
        const input = document.getElementById(
          "preparation-minutes",
        ) as HTMLInputElement;
        const minutes = parseInt(input.value);
        if (!minutes || minutes < 1 || minutes > 60) {
          Swal.showValidationMessage("Masukkan durasi antara 1-60 menit");
          return false;
        }
        return minutes;
      },
    });

    if (!preparationMinutes) return;

    // Tampilkan loading
    const loadingAlert = Swal.fire({
      title: `Memulai Persiapan ${preparationMinutes} Menit...`,
      html: "Menyalakan TV dan nomor...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      // Simpan nilai auto_shutdown awal
      const originalAutoShutdown = targetConsole.auto_shutdown_enabled || false;

      // Clear timeout lama jika ada
      const existingPrep = preparationMode[targetConsole.id];
      if (existingPrep?.timeoutId) {
        clearTimeout(existingPrep.timeoutId);
      }

      // Jika auto_shutdown masih true, update ke false
      if (targetConsole.auto_shutdown_enabled) {
        try {
          await supabase
            .from("consoles")
            .update({ auto_shutdown_enabled: false })
            .eq("id", targetConsole.id);

          // Update local state juga
          setConsoles((prev) =>
            prev.map((c) =>
              c.id === targetConsole.id
                ? { ...c, auto_shutdown_enabled: false }
                : c,
            ),
          );
        } catch (error) {
          console.error(
            `Error updating auto_shutdown for ${targetConsole.name}:`,
            error,
          );
        }
      }

      // Nyalakan TV dan relay
      const results = [];

      // Nyalakan TV
      if (targetConsole.power_tv_command) {
        try {
          const tvRes = await fetch(targetConsole.power_tv_command);
          if (tvRes.ok) {
            results.push({ type: "tv", status: "success" });
          } else {
            results.push({ type: "tv", status: "failed" });
          }
        } catch (error) {
          results.push({ type: "tv", status: "failed" });
        }
      }

      // Nyalakan nomor/relay
      // if (console.relay_command_on) {
      //   try {
      //     const relayRes = await fetch(console.relay_command_on);
      //     if (relayRes.ok) {
      //       results.push({ type: "relay", status: "success" });
      //     } else {
      //       results.push({ type: "relay", status: "failed" });
      //     }
      //   } catch (error) {
      //     results.push({ type: "relay", status: "failed" });
      //   }
      // }

      // Hitung hasil
      const successful = results.filter((r) => r.status === "success").length;
      const total = results.length;

      await Swal.fire({
        title: "Persiapan Dimulai!",
        html: `
          <p>Console: <strong>${targetConsole.name}</strong></p>
          <p>Status: ${successful}/${total} perintah berhasil</p>
          <p>TV dan nomor akan dimatikan otomatis dalam ${preparationMinutes} menit</p>
        `,
        icon: "success",
        timer: 3000,
        timerProgressBar: true,
      });

      // Set timer untuk mematikan setelah waktu yang ditentukan
      const timeoutId = setTimeout(
        async () => {
          await handleStopPreparation(targetConsole, originalAutoShutdown);
        },
        preparationMinutes * 60 * 1000,
      ); // Konversi menit ke milidetik

      // Simpan state persiapan
      setPreparationMode((prev) => ({
        ...prev,
        [targetConsole.id]: {
          isActive: true,
          timeoutId,
          originalAutoShutdown,
          endAtMs: Date.now() + preparationMinutes * 60 * 1000,
        },
      }));
    } catch (error) {
      console.error("Error during preparation:", error);
      await Swal.fire({
        title: "Error",
        text: "Terjadi kesalahan saat menjalankan persiapan",
        icon: "error",
      });
    }
  };

  // Fungsi untuk menghentikan persiapan
  const handleStopPreparation = async (
    console: Console,
    originalAutoShutdown: boolean,
  ) => {
    const shutdownResults = [];

    // Matikan TV
    if (console.power_tv_command) {
      try {
        const tvRes = await fetch(console.power_tv_command);
        if (tvRes.ok) {
          shutdownResults.push({ type: "tv", status: "success" });
        } else {
          shutdownResults.push({ type: "tv", status: "failed" });
        }
      } catch (error) {
        shutdownResults.push({ type: "tv", status: "failed" });
      }
    }

    // Matikan nomor/relay
    // if (console.relay_command_off) {
    //   try {
    //     const relayRes = await fetch(console.relay_command_off);
    //     if (relayRes.ok) {
    //       shutdownResults.push({ type: "relay", status: "success" });
    //     } else {
    //       shutdownResults.push({ type: "relay", status: "failed" });
    //     }
    //   } catch (error) {
    //     shutdownResults.push({ type: "relay", status: "failed" });
    //   }
    // }

    // Kembalikan nilai auto_shutdown ke nilai awal
    if (originalAutoShutdown !== console.auto_shutdown_enabled) {
      try {
        await supabase
          .from("consoles")
          .update({ auto_shutdown_enabled: originalAutoShutdown })
          .eq("id", console.id);

        // Update local state juga
        setConsoles((prev) =>
          prev.map((c) =>
            c.id === console.id
              ? { ...c, auto_shutdown_enabled: originalAutoShutdown }
              : c,
          ),
        );
      } catch (error) {
        console.error(
          `Error restoring auto_shutdown for ${console.name}:`,
          error,
        );
      }
    }

    const shutdownSuccessful = shutdownResults.filter(
      (r) => r.status === "success",
    ).length;
    const shutdownTotal = shutdownResults.length;

    await Swal.fire({
      title: "Persiapan Selesai!",
      html: `
        <p>Console: <strong>${console.name}</strong></p>
        <p>Status: ${shutdownSuccessful}/${shutdownTotal} perintah berhasil</p>
        <p>TV dan nomor telah dimatikan</p>
      `,
      icon: "info",
      confirmButtonColor: "#3b82f6",
      // timer: 3000,
      // timerProgressBar: true,
    });

    // Hapus state persiapan
    setPreparationMode((prev) => {
      const newState = { ...prev };
      delete newState[console.id];
      return newState;
    });
  };

  // Fungsi untuk menghentikan persiapan secara manual
  const handleStopPreparationManual = async (targetConsole: Console) => {
    const preparation = preparationMode[targetConsole.id];
    if (!preparation) return;

    const confirmResult = await Swal.fire({
      title: "Berhenti Persiapan",
      text: `Apakah Anda yakin ingin menghentikan persiapan untuk console ${targetConsole.name}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Hentikan",
      cancelButtonText: "Batal",
    });

    if (!confirmResult.isConfirmed) return;

    // Clear timeout jika ada
    if (preparation.timeoutId) {
      clearTimeout(preparation.timeoutId);
    }

    // Hentikan persiapan
    await handleStopPreparation(
      targetConsole,
      preparation.originalAutoShutdown,
    );
  };

  // --- TV Status JSON and selectedConsole hooks must be after all state declarations ---
  const [tvStatusJson, setTvStatusJson] = React.useState<string>("");
  const selectedConsole = React.useMemo(
    () =>
      showStartRentalModal
        ? consoles.find((c: any) => c.id === showStartRentalModal)
        : undefined,
    [showStartRentalModal, consoles],
  );

  // const availableCustomers = React.useMemo(() => {
  //   return customers.filter((customer) => {
  //     // Cek apakah customer ini punya sesi aktif
  //     const hasActiveSession = activeSessions.some(
  //       (session) =>
  //         session.customer_id === customer.id && session.status === "active"
  //     );

  //     return !hasActiveSession;
  //   });
  // }, [customers, activeSessions]);

  React.useEffect(() => {
    if (showStartRentalModal && selectedConsole?.perintah_cek_power_tv) {
      setTvStatusJson("");
      fetch(String(selectedConsole.perintah_cek_power_tv))
        .then((res) => res.text())
        .then((text) => setTvStatusJson(text))
        .catch(() => setTvStatusJson("Gagal cek status"));
    } else {
      setTvStatusJson("");
    }
  }, [showStartRentalModal, selectedConsole?.perintah_cek_power_tv]);

  // Polling status TV & relay secara real-time saat modal Start Rental tampil
  const [statusIntervalId, setStatusIntervalId] =
    React.useState<NodeJS.Timeout | null>(null);
  React.useEffect(() => {
    if (!showStartRentalModal || !selectedConsole) {
      if (statusIntervalId) clearInterval(statusIntervalId);
      setStatusIntervalId(null);
      return;
    }
    // Interval pengecekan status setiap 3 detik
    const interval = setInterval(() => {
      if (selectedConsole.perintah_cek_power_tv) {
        fetch(selectedConsole.perintah_cek_power_tv)
          .then((res) => res.text())
          .then((text) => setTvStatusJson(text))
          .catch(() => setTvStatusJson("Gagal cek status"));
      }
      if (selectedConsole.relay_command_status) {
        fetch(selectedConsole.relay_command_status)
          .then((res) => res.text())
          .then((text) => setRelayStatus(text))
          .catch(() => setRelayStatus("-"));
      }
    }, 60000);
    setStatusIntervalId(interval);
    return () => clearInterval(interval);
  }, [showStartRentalModal, selectedConsole]);
  // Fetch cart items from rental_session_products when product modal is opened
  useEffect(() => {
    // Ambil produk billing (pending payment) dan produk keranjang terpisah
    const fetchProductData = async () => {
      setBillingProducts([]);
      if (!showProductModal || showProductModal === "retail") return;
      // Produk billing (pending payment)
      const { data: billingData, error: billingError } = await supabase
        .from("rental_session_products")
        .select("*")
        .eq("session_id", showProductModal)
        .eq("status", "pending");
      if (!billingError && Array.isArray(billingData)) {
        setBillingProducts(billingData);
      } else {
        setBillingProducts([]);
      }
      // Produk keranjang tetap dari state cart
    };
    fetchProductData();
  }, [showProductModal]);
  // Produk billing (pending payment)

  // Jalankan perintah cek status relay saat modal Start Rental dibuka
  useEffect(() => {
    if (!showStartRentalModal) return;
    const console = consoles.find((c) => c.id === showStartRentalModal);
    if (!console) return;
    // Cek status relay (jika ada endpoint relay_command_status)
    if (console.relay_command_status) {
      fetch(console.relay_command_status)
        .then((res) => res.text())
        .then((text) => {
          setRelayStatus(text.trim().toUpperCase() === "ON" ? "ON" : "OFF");
        })
        .catch(() => setRelayStatus("OFF"));
    } else {
      setRelayStatus("OFF");
    }
  }, [showStartRentalModal, consoles]);
  // const [nonMemberName, setNonMemberName] = useState<string>("");
  // const [nonMemberPhone, setNonMemberPhone] = useState<string>("");
  // const [countdownTimers, setCountdownTimers] = useState<
  //   Record<string, number>
  // >({});
  // Toggle view mode: 'simple' | 'detail' | 'list'
  const [viewMode, setViewMode] = useState<"simple" | "detail" | "list">(
    "simple",
  );
  // Tambahan: countdown detik
  // const [countdownSeconds, setCountdownSeconds] = useState<
  //   Record<string, number>
  // >({});
  // const [elapsedTimers, setElapsedTimers] = useState<Record<string, number>>(
  //   {}
  // );
  // const [countdownIntervals, setCountdownIntervals] = useState<
  //   Record<string, NodeJS.Timeout>
  // >({});
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySessions, setHistorySessions] = useState<RentalSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [historyEndDate, setHistoryEndDate] = useState<string>("");
  // Pagination states for history
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [showPaymentModal, setShowPaymentModal] = useState<null | {
    session: RentalSession | null;
    productsTotal: number;
  }>(null);
  // Mapping sessionId -> total produk
  const [productsTotalMap, setProductsTotalMap] = useState<
    Record<string, number>
  >({});
  // States for EndRentalModal are now internal to the component to prevent state bleed and resets.
  const [isCashierActive, setIsCashierActive] = useState<boolean>(true);
  const [showMoveModal, setShowMoveModal] = useState<MoveModalState>(null);
  const [moveTargetConsoleId, setMoveTargetConsoleId] = useState<string>("");
  const [isMovingSession, setIsMovingSession] = useState<boolean>(false);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data?.user?.id;
        if (!userId) {
          setIsCashierActive(false);
          Swal.fire(
            "Peringatan",
            "Anda harus login dan membuka sesi kasir aktif untuk mengakses menu ini.",
            "warning",
          );
          return;
        }
        const { data: sessions } = await supabase
          .from("cashier_sessions")
          .select("id")
          .eq("cashier_id", userId)
          .eq("status", "active")
          .limit(1);

        const active = Array.isArray(sessions) && sessions.length > 0;
        setIsCashierActive(active);
        if (!active) {
          Swal.fire({
            toast: true,
            position: "top-end",
            icon: "warning",
            title:
              "Tidak ada sesi kasir aktif. Silakan buka sesi kasir terlebih dahulu.",
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
          });
        }
      } catch {
        setIsCashierActive(false);
        Swal.fire(
          "Peringatan",
          "Gagal memeriksa sesi kasir. Silakan buka sesi kasir terlebih dahulu.",
          "warning",
        );
      }
    })();
  }, []);

  const ensureCashierActive = () => {
    if (!isCashierActive) {
      Swal.fire(
        "Peringatan",
        "Buka sesi kasir aktif terlebih dahulu.",
        "warning",
      );
      return false;
    }
    return true;
  };

  // Auto shutdown protection functions
  const loadConsoleAutoShutdownStates = useCallback(async () => {
    try {
      const { data: consolesData, error } = await supabase
        .from("consoles")
        .select("id, auto_shutdown_enabled")
        .eq("is_active", true);

      if (error) {
        console.error("Error loading console auto shutdown states:", error);
        return;
      }

      const states: { [key: string]: boolean } = {};
      consolesData?.forEach((console) => {
        states[console.id] = console.auto_shutdown_enabled ?? true;
      });

      setConsoleAutoShutdownStates(states);

      // Set global auto shutdown enabled based on if any console has it enabled
      const anyEnabled = Object.values(states).some((enabled) => enabled);
      setAutoShutdownEnabled(anyEnabled);
    } catch (error) {
      console.error("Error loading console auto shutdown states:", error);
    }
  }, []);

  const updateConsoleAutoShutdown = useCallback(
    async (consoleId: string, enabled: boolean) => {
      if (updatingConsoleIds.has(consoleId)) {
        return;
      }

      let reason = "";
      if (!enabled) {
        const { value: typedReason, isConfirmed } = await Swal.fire({
          title: "Alasan Menonaktifkan Protection",
          text: `Mengapa Anda menonaktifkan auto shutdown untuk ${
            consoles.find((c) => c.id === consoleId)?.name || "console ini"
          }?`,
          input: "text",
          inputPlaceholder: "Masukkan alasan...",
          showCancelButton: true,
          confirmButtonText: "Nonaktifkan",
          cancelButtonText: "Batal",
          inputValidator: (value) => {
            if (!value) {
              return "Alasan wajib diisi!";
            }
            return null;
          },
        });

        if (!isConfirmed) return;
        reason = typedReason;
      }

      const originalStates = { ...consoleAutoShutdownStates };
      const originalGlobalState = autoShutdownEnabled;

      const newStates = { ...originalStates, [consoleId]: enabled };
      const newGlobalState = Object.values(newStates).some((state) => state);

      setConsoleAutoShutdownStates(newStates);
      setAutoShutdownEnabled(newGlobalState);
      setUpdatingConsoleIds((prev) => new Set(prev).add(consoleId));

      try {
        const { error } = await supabase
          .from("consoles")
          .update({ auto_shutdown_enabled: enabled })
          .eq("id", consoleId);

        if (error) {
          throw error;
        }

        // Log if disabled
        if (!enabled && reason) {
          const targetConsole = consoles.find((c) => c.id === consoleId);
          await logCashierTransaction({
            type: "rental",
            amount: 0,
            paymentMethod: "cash",
            referenceId: `SHUTDOWN-PROT-${Date.now()}`,
            description: `[PROTECTION] Disabled: ${
              targetConsole?.name || consoleId
            }`,
            details: {
              action: "disable_auto_shutdown",
              console_id: consoleId,
              console_name: targetConsole?.name,
              reason: reason,
            },
          });
        } else if (enabled) {
          // Log if enabled
          const targetConsole = consoles.find((c) => c.id === consoleId);
          await logCashierTransaction({
            type: "rental",
            amount: 0,
            paymentMethod: "cash",
            referenceId: `SHUTDOWN-PROT-ENABLE-${Date.now()}`,
            description: `[PROTECTION] Enabled: ${
              targetConsole?.name || consoleId
            }`,
            details: {
              action: "enable_auto_shutdown",
              console_id: consoleId,
              console_name: targetConsole?.name,
            },
          });
        }

        Swal.fire(
          "Sukses",
          `Auto shutdown ${
            enabled ? "diaktifkan" : "dinonaktifkan"
          } untuk console ini`,
          "success",
        );

        if (enabled) {
          const console = consoles.find((c) => c.id === consoleId);
          if (console?.status !== "rented") {
            try {
              await triggerUnusedConsolesCheck();
            } catch {}
          }
        }
      } catch (error) {
        console.error("Error updating console auto shutdown:", error);

        setConsoleAutoShutdownStates(originalStates);
        setAutoShutdownEnabled(originalGlobalState);

        Swal.fire(
          "Error",
          "Gagal mengupdate status auto shutdown console",
          "error",
        );
      } finally {
        setUpdatingConsoleIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(consoleId);
          return newSet;
        });
      }
    },
    [
      consoleAutoShutdownStates,
      autoShutdownEnabled,
      updatingConsoleIds,
      triggerUnusedConsolesCheck,
      consoles,
      logCashierTransaction,
    ],
  );

  const toggleAllConsolesAutoShutdown = useCallback(
    async (enabled: boolean) => {
      if (isUpdatingAutoShutdown) {
        return;
      }

      let reason = "";
      if (!enabled) {
        const { value: typedReason, isConfirmed } = await Swal.fire({
          title: "Nonaktifkan Semua Protection",
          text: "Berikan alasan mengapa Anda menonaktifkan perlindungan untuk SEMUA console?",
          input: "text",
          inputPlaceholder: "Masukkan alasan...",
          showCancelButton: true,
          confirmButtonText: "Nonaktifkan Semua",
          cancelButtonText: "Batal",
          inputValidator: (value) => {
            if (!value) {
              return "Alasan wajib diisi!";
            }
            return null;
          },
        });

        if (!isConfirmed) return;
        reason = typedReason;
      }

      setIsUpdatingAutoShutdown(true);
      const originalStates = { ...consoleAutoShutdownStates };
      const originalGlobalState = autoShutdownEnabled;

      const newStates: { [key: string]: boolean } = {};
      consoles.forEach((console) => {
        newStates[console.id] = enabled;
      });

      setConsoleAutoShutdownStates(newStates);
      setAutoShutdownEnabled(enabled);

      try {
        const { error } = await supabase
          .from("consoles")
          .update({ auto_shutdown_enabled: enabled })
          .eq("is_active", true);

        if (error) {
          throw error;
        }

        // Log if disabled
        if (!enabled && reason) {
          await logCashierTransaction({
            type: "rental",
            amount: 0,
            paymentMethod: "cash",
            referenceId: `SHUTDOWN-PROT-ALL-${Date.now()}`,
            description: `[PROTECTION] Disabled for ALL consoles`,
            details: {
              action: "disable_all_auto_shutdown",
              reason: reason,
              console_count: consoles.length,
            },
          });
        } else if (enabled) {
          // Log if enabled
          await logCashierTransaction({
            type: "rental",
            amount: 0,
            paymentMethod: "cash",
            referenceId: `SHUTDOWN-PROT-ALL-ENABLE-${Date.now()}`,
            description: `[PROTECTION] Enabled for ALL consoles`,
            details: {
              action: "enable_all_auto_shutdown",
              console_count: consoles.length,
            },
          });
        }

        try {
          await triggerUnusedConsolesCheck();
        } catch {}

        Swal.fire(
          "Sukses",
          `Auto shutdown ${
            enabled ? "diaktifkan" : "dinonaktifkan"
          } untuk semua console`,
          "success",
        );
      } catch (error) {
        console.error("Error updating all consoles auto shutdown:", error);

        setConsoleAutoShutdownStates(originalStates);
        setAutoShutdownEnabled(originalGlobalState);

        Swal.fire(
          "Error",
          "Gagal mengupdate status auto shutdown semua console",
          "error",
        );
      } finally {
        setIsUpdatingAutoShutdown(false);
      }
    },
    [
      isUpdatingAutoShutdown,
      consoleAutoShutdownStates,
      autoShutdownEnabled,
      consoles,
      triggerUnusedConsolesCheck,
      logCashierTransaction,
    ],
  );

  // Function untuk sinkronisasi status console dan rental session
  const syncConsoleAndSessionStatus = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      console.log("Memulai sinkronisasi status console dan rental session...");

      // 1. Ambil semua console yang statusnya "rented"
      const { data: rentedConsoles, error: consoleError } = await supabase
        .from("consoles")
        .select("id, name, status")
        .eq("status", "rented")
        .eq("is_active", true);

      if (consoleError) {
        throw new Error("Gagal mengambil data console");
      }

      // 2. Ambil semua rental session yang aktif
      const { data: activeSessions, error: sessionError } = await supabase
        .from("rental_sessions")
        .select("id, console_id, status")
        .eq("status", "active");

      if (sessionError) {
        throw new Error("Gagal mengambil data rental session");
      }

      let fixedCount = 0;
      const issues: string[] = [];

      // 3. Cek console yang "rented" tapi tidak ada session aktif
      for (const console of rentedConsoles || []) {
        const hasActiveSession = activeSessions?.some(
          (session) => session.console_id === console.id,
        );

        if (!hasActiveSession) {
          // Console rented tapi tidak ada session aktif - set ke available
          await supabase
            .from("consoles")
            .update({ status: "available" })
            .eq("id", console.id);

          issues.push(
            `Console ${console.name} di-set ke "available" (tidak ada session aktif)`,
          );
          fixedCount++;
        }
      }

      // 4. Cek session aktif yang console-nya tidak "rented"
      for (const session of activeSessions || []) {
        const console = rentedConsoles?.find(
          (c) => c.id === session.console_id,
        );

        if (!console) {
          // Session aktif tapi console tidak rented - cari console dan set ke rented
          const { data: consoleData } = await supabase
            .from("consoles")
            .select("id, name, status")
            .eq("id", session.console_id)
            .single();

          if (consoleData && consoleData.status !== "rented") {
            await supabase
              .from("consoles")
              .update({ status: "rented" })
              .eq("id", session.console_id);

            issues.push(
              `Console ${consoleData.name} di-set ke "rented" (ada session aktif)`,
            );
            fixedCount++;
          }
        }
      }

      // 5. Refresh data
      await loadData();
      await refreshActiveSessions();

      if (fixedCount > 0) {
        Swal.fire({
          title: "Sinkronisasi Berhasil",
          html: `
            <div class="text-left">
              <p><strong>${fixedCount} masalah diperbaiki:</strong></p>
              <ul class="list-disc list-inside mt-2 space-y-1">
                ${issues
                  .map((issue) => `<li class="text-sm">${issue}</li>`)
                  .join("")}
              </ul>
            </div>
          `,
          icon: "success",
          confirmButtonText: "OK",
        });
      } else {
        Swal.fire({
          title: "Status Sudah Sinkron",
          text: "Tidak ada masalah yang ditemukan. Status console dan rental session sudah konsisten.",
          icon: "info",
          confirmButtonText: "OK",
        });
      }

      console.log(`Sinkronisasi selesai. ${fixedCount} masalah diperbaiki.`);
    } catch (error) {
      console.error("Error during sync:", error);
      Swal.fire({
        title: "Sinkronisasi Gagal",
        text:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat sinkronisasi",
        icon: "error",
        confirmButtonText: "OK",
      });
    } finally {
      setIsSyncing(false);
    }
  };


  // Load history sessions
  const loadHistorySessions = async (startDate?: string, endDate?: string) => {
    setLoadingHistory(true);
    try {
      // Get total count for pagination
      // let countQuery = supabase
      //   .from("rental_sessions")
      //   .select("id", { count: "exact", head: true });
      // // .in("status", ["completed", "cancelled"]);
      // if (startDate) {
      //   countQuery = countQuery.gte("start_time", startDate + "T00:00:00");
      // }
      // if (endDate) {
      //   countQuery = countQuery.lte("start_time", endDate + "T23:59:59");
      // }
      // const { count, error: countError } = await countQuery;
      // if (countError) throw countError;

      // Fetch paginated data
      const startIdx = (currentPage - 1) * 10;
      const endIdx = startIdx + 9;
      let query = supabase
        .from("rental_sessions")
        .select(`*, consoles(name, location)`, { count: "exact" })
        // .in("status", ["completed", "cancelled"])
        .order("start_time", { ascending: false })
        .range(startIdx, endIdx);
      if (startDate) {
        query = query.gte("start_time", startDate + "T00:00:00");
      }
      if (endDate) {
        query = query.lte("start_time", endDate + "T23:59:59");
      }
      const { data, error, count } = await query;
      if (error) throw error;
      setHistorySessions(data || []);
      setTotalItems(count || 0);
      setTotalPages(Math.max(1, Math.ceil((count || 0) / 10)));
    } catch (error) {
      Swal.fire("Error", "Gagal memuat history rental", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadConsoleHistoryToday = async (consoleId: string) => {
    setLoadingHistory(true);
    try {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      ).toISOString();
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59,
      ).toISOString();

      const { data, error } = await supabase
        .from("rental_sessions")
        .select(`*, consoles(name, location)`)
        .eq("console_id", consoleId)
        .gte("start_time", startOfDay)
        .lte("start_time", endOfDay)
        .order("start_time", { ascending: false });

      if (error) throw error;
      setConsoleHistorySessions(data || []);
    } catch (error) {
      Swal.fire("Error", "Gagal memuat history console", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistorySessions(historyStartDate, historyEndDate);
  }, [currentPage, historyStartDate, historyEndDate]);

  useEffect(() => {
    // Fetch voucher list
    db.select("vouchers", "*").then((v) => setVoucherList(v || []));
  }, []);

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Listen for member card session ended events
  useEffect(() => {
    const handleMemberCardSessionEnded = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { sessionId, reason } = customEvent.detail;
      console.log(`Member card session ${sessionId} ended due to: ${reason}`);

      // Refresh data to update UI
      await loadData();
      await refreshActiveSessions();

      // Show notification to user
      if (reason === "insufficient_balance") {
        Swal.fire({
          toast: true,
          position: "top-end",
          title: "Session Diakhiri",
          text: `Session rental diakhiri karena saldo member card habis`,
          icon: "warning",
          timer: 5000,
          showConfirmButton: false,
        });
      }
    };

    window.addEventListener(
      "memberCardSessionEnded",
      handleMemberCardSessionEnded,
    );

    return () => {
      window.removeEventListener(
        "memberCardSessionEnded",
        handleMemberCardSessionEnded,
      );
    };
  }, [refreshActiveSessions]);

  // Sync with global timer context
  useEffect(() => {
    // Always sync with global sessions, even when empty
    setActiveSessions(globalActiveSessions);
    // loadData();

    // Fetch consoles
    const fetchConsoles = async () => {
      const { data: consoleData, error: consoleError } = await supabase
        .from("consoles")
        .select("*, rate_profiles(capital, hourly_rate)")
        .eq("is_active", true);

      setConsoles(consoleData || []);

      if (consoleError) throw consoleError;
    };

    fetchConsoles();
  }, [globalActiveSessions]);

  // Additional realtime listener for immediate UI updates
  useEffect(() => {
    let channel = supabase
      .channel("active_rentals_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rental_sessions" },
        async () => {
          await refreshActiveSessions();
        },
      )
      .subscribe();

    // Fungsi untuk re-subscribe jika tab kembali aktif
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.error(e);
        }
        channel = supabase
          .channel("active_rentals_realtime")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "rental_sessions" },
            async () => {
              await refreshActiveSessions();
            },
          )
          .subscribe();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [refreshActiveSessions]);

  useEffect(() => {
    let isSubscribed = true;
    let updateTimeout: NodeJS.Timeout;
    let consolesChannel = supabase
      .channel("consoles_auto_shutdown_realtime_optimized")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "consoles" },
        async (payload) => {
          try {
            console.log("Console change detected in ActiveRentals:", payload);

            if (
              payload.eventType === "UPDATE" &&
              payload.new &&
              payload.old &&
              isSubscribed
            ) {
              const consoleId = payload.new.id;
              const oldAutoShutdown = payload.old.auto_shutdown_enabled;
              const newAutoShutdown = payload.new.auto_shutdown_enabled;

              if (
                oldAutoShutdown !== newAutoShutdown &&
                !updatingConsoleIds.has(consoleId)
              ) {
                console.log(
                  `External update: auto_shutdown_enabled for console ${consoleId}: ${oldAutoShutdown} -> ${newAutoShutdown}`,
                );

                clearTimeout(updateTimeout);
                updateTimeout = setTimeout(() => {
                  if (isSubscribed) {
                    setConsoleAutoShutdownStates((prev) => {
                      const newStates = {
                        ...prev,
                        [consoleId]: newAutoShutdown ?? true,
                      };

                      const anyEnabled = Object.values(newStates).some(
                        (state) => state,
                      );
                      setAutoShutdownEnabled(anyEnabled);
                      return newStates;
                    });
                  }
                }, 100);
              }
            }
          } catch (e) {
            console.error(
              "Console realtime refresh error in ActiveRentals:",
              e,
            );
          }
        },
      )
      .subscribe();

    // Fungsi untuk re-subscribe jika tab kembali aktif
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        try {
          supabase.removeChannel(consolesChannel);
        } catch (e) {
          console.error(e);
        }

        // Subscribe ulang ke channel baru
        consolesChannel = supabase
          .channel("consoles_auto_shutdown_realtime_optimized")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "consoles" },
            async (payload) => {
              try {
                console.log(
                  "Console change detected in ActiveRentals:",
                  payload,
                );

                if (
                  payload.eventType === "UPDATE" &&
                  payload.new &&
                  payload.old &&
                  isSubscribed
                ) {
                  const consoleId = payload.new.id;
                  const oldAutoShutdown = payload.old.auto_shutdown_enabled;
                  const newAutoShutdown = payload.new.auto_shutdown_enabled;

                  if (
                    oldAutoShutdown !== newAutoShutdown &&
                    !updatingConsoleIds.has(consoleId)
                  ) {
                    console.log(
                      `External update: auto_shutdown_enabled for console ${consoleId}: ${oldAutoShutdown} -> ${newAutoShutdown}`,
                    );

                    clearTimeout(updateTimeout);
                    updateTimeout = setTimeout(() => {
                      if (isSubscribed) {
                        setConsoleAutoShutdownStates((prev) => {
                          const newStates = {
                            ...prev,
                            [consoleId]: newAutoShutdown ?? true,
                          };

                          const anyEnabled = Object.values(newStates).some(
                            (state) => state,
                          );
                          setAutoShutdownEnabled(anyEnabled);
                          return newStates;
                        });
                      }
                    }, 100);
                  }
                }
              } catch (e) {
                console.error(
                  "Console realtime refresh error in ActiveRentals:",
                  e,
                );
              }
            },
          )
          .subscribe();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isSubscribed = false;
      clearTimeout(updateTimeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(consolesChannel);
    };
  }, [updatingConsoleIds]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch consoles
      // const { data: consoleData, error: consoleError } = await supabase
      //   .from("consoles")
      //   .select("*, rate_profiles(capital)")
      //   .eq("is_active", true);

      // if (consoleError) throw consoleError;

      // Fetch rate profiles
      // const { data: rateData, error: rateError } = await supabase
      //   .from("rate_profiles")
      //   .select(
      //     "id, name, hourly_rate, minimum_minutes, minimum_minutes_member"
      //   );

      // if (rateError) throw rateError;

      // Use global active sessions from TimerContext instead of fetching separately
      const rentalData = globalActiveSessions;

      // Fetch products from database
      // const productData = await db.products.getActiveProducts();

      const [consoleResult, rateResult, productData] = await Promise.all([
        supabase
          .from("consoles")
          .select("*, rate_profiles(capital)")
          .eq("is_active", true),
        supabase
          .from("rate_profiles")
          .select(
            "id, name, hourly_rate, minimum_minutes, minimum_minutes_member",
          ),
        db.products.getActiveProducts(),
      ]);

      const consoleData = consoleResult.data;
      const rateData = rateResult.data;

      // Fetch customers
      // const { data: customerData, error: customerError } = await supabase
      //   .from("customers")
      //   .select("*")
      //   .eq("status", "active");

      // if (customerError) throw customerError;

      // Fetch total produk per session aktif
      let productsTotalMap: Record<string, number> = {};
      if (Array.isArray(rentalData)) {
        const sessionIds = rentalData.map((s) => s.id);
        if (sessionIds.length > 0) {
          const { data: productRows, error: productRowsError } = await supabase
            .from("rental_session_products")
            .select("session_id, quantity, price")
            .in("session_id", sessionIds)
            .in("status", ["pending", "completed"]);
          if (!productRowsError && Array.isArray(productRows)) {
            for (const sessionId of sessionIds) {
              const items = productRows.filter(
                (row) => row.session_id === sessionId,
              );
              productsTotalMap[sessionId] = items.reduce(
                (sum, item) => sum + (item.quantity || 0) * (item.price || 0),
                0,
              );
            }
          }
        }
      }

      setConsoles(consoleData || []);
      setRateProfiles(rateData || []);
      setActiveSessions(rentalData || []);
      setProducts(productData || []);
      // setCustomers(customerData || []);
      setProductsTotalMap(productsTotalMap);

      // Load auto shutdown states
      await loadConsoleAutoShutdownStates();

      // Refresh global active sessions
      await refreshActiveSessions();
    } catch (error) {
      console.error("Error loading data:", error);
      Swal.fire("Error", "Gagal memuat data", "error");
    } finally {
      setLoading(false);
    }
  };

  // Format countdown in HH:MM:SS for Live Timer Display
  // const formatCountdownHMS = (totalSeconds: number) => {
  //   const hours = Math.floor(totalSeconds / 3600);
  //   const mins = Math.floor((totalSeconds % 3600) / 60);
  //   const secs = totalSeconds % 60;
  //   // Pad with zero
  //   const pad = (n: number) => n.toString().padStart(2, "0");
  //   return `Sisa Waktu : ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  // };

  // Format elapsed time in HH:MM:SS for PAY AS YOU GO
  const formatElapsedHMS = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    let diff = Math.floor((now.getTime() - start.getTime()) / 1000); // in seconds
    if (diff < 0) diff = 0;
    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `Durasi : ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  };

  const calculateCurrentCost = (session: RentalSession) => {
    if (!session.start_time) return 0;
    const start = new Date(session.start_time);
    const now = new Date();
    let totalMinutes = 0;
    if (session.duration_minutes) {
      totalMinutes = session.duration_minutes;
    } else {
      const diffMs = now.getTime() - start.getTime();
      totalMinutes = Math.ceil(diffMs / (1000 * 60));
    }
    const console = consoles.find((c) => c.id === session.console_id);
    const rateProfile = rateProfiles.find(
      (r) => r.id === console?.rate_profile_id,
    );
    const hourlyRate = rateProfile?.hourly_rate || 15000;
    const minimumMinutes = rateProfile?.minimum_minutes ?? 60;
    const minimumMinutesMember = rateProfile?.minimum_minutes_member ?? 60;

    // Untuk member-card, gunakan logika yang sama dengan useMemberCardBilling
    if (session.is_voucher_used) {
      // Gunakan rate snapshot yang sama dengan yang digunakan di billing
      const hourlyRateSnapshot = session.hourly_rate_snapshot || hourlyRate;
      const perMinuteRateSnapshot =
        session.per_minute_rate_snapshot || hourlyRate / 60;

      if (minimumMinutesMember === 0) {
        return totalMinutes * perMinuteRateSnapshot;
      } else if (totalMinutes <= minimumMinutesMember) {
        return hourlyRateSnapshot;
      } else {
        const extraMinutes = totalMinutes - 60;
        return hourlyRateSnapshot + extraMinutes * perMinuteRateSnapshot;
      }
    }

    // Untuk pay-as-you-go dan prepaid, gunakan logika lama dengan pembulatan
    if (totalMinutes <= minimumMinutes) {
      return hourlyRate;
    } else {
      const extraMinutes = totalMinutes - 60;
      const perMinuteRate = hourlyRate / 60;
      const total = hourlyRate + Math.ceil(extraMinutes * perMinuteRate);
      return Math.ceil(total / 100) * 100;
    }
  };

  // const RealtimeCost: React.FC<{
  //   session: RentalSession;
  //   productsTotal?: number;
  //   refreshMs?: number;
  // }> = ({ session, productsTotal, refreshMs = 60000 }) => {
  //   // const [tick, setTick] = useState(0);
  //   const [realTimeCost, setRealTimeCost] = useState(0);
  //   const isPrepaid = !!session.duration_minutes;

  //   // useEffect(() => {
  //   //   if (isPrepaid) return;
  //   //   const id = setInterval(() => setTick((t) => t + 1), refreshMs);
  //   //   return () => clearInterval(id);
  //   // }, [isPrepaid, refreshMs, session.id]);

  //   // Untuk member-card, gunakan total_points_deducted dari database
  //   useEffect(() => {
  //     if (session.is_voucher_used && !isPrepaid) {
  //       // Fetch fresh data dari database untuk sinkronisasi dengan billing system
  //       const fetchFreshSessionData = async () => {
  //         try {
  //           const { data: freshSession } = await supabase
  //             .from("rental_sessions")
  //             .select("total_points_deducted")
  //             .eq("id", session.id)
  //             .single();

  //           if (freshSession) {
  //             setRealTimeCost(freshSession.total_points_deducted || 0);
  //           } else {
  //             // Fallback ke data session yang ada
  //             setRealTimeCost(session.total_points_deducted || 0);
  //           }
  //         } catch (error) {
  //           console.error("Error fetching fresh session data:", error);
  //           // Fallback ke data session yang ada
  //           setRealTimeCost(session.total_points_deducted || 0);
  //         }
  //       };

  //       fetchFreshSessionData();

  //       // Listen for billing updates
  //       const handleBillingUpdate = (event: Event) => {
  //         const customEvent = event as CustomEvent;
  //         if (customEvent.detail?.sessionId === session.id) {
  //           setRealTimeCost(customEvent.detail.newTotalDeducted);
  //         }
  //       };

  //       window.addEventListener("memberCardBillingUpdate", handleBillingUpdate);

  //       // Refresh setiap 30 detik untuk sinkronisasi dengan billing
  //       const interval = setInterval(fetchFreshSessionData, 30000);

  //       return () => {
  //         clearInterval(interval);
  //         window.removeEventListener(
  //           "memberCardBillingUpdate",
  //           handleBillingUpdate
  //         );
  //       };
  //     } else {
  //       // Untuk pay-as-you-go dan prepaid, gunakan perhitungan real-time
  //       setRealTimeCost(calculateCurrentCost(session));
  //     }
  //   }, [session.is_voucher_used, session.id, isPrepaid, tick]);

  //   return <>{(realTimeCost + (productsTotal || 0)).toLocaleString("id-ID")}</>;
  // };

  const RealtimeCost: React.FC<{
    session: RentalSession;
    productsTotal?: number;
    refreshMs?: number;
  }> = ({ session, productsTotal, refreshMs = 60000 }) => {
    const [realTimeCost, setRealTimeCost] = useState(0);
    const isPrepaid = !!session.duration_minutes;

    useEffect(() => {
      if (session.is_voucher_used && !isPrepaid) {
        const fetchFreshSessionData = async () => {
          try {
            const { data: freshSession } = await supabase
              .from("rental_sessions")
              .select("total_points_deducted")
              .eq("id", session.id)
              .single();

            if (freshSession) {
              setRealTimeCost(freshSession.total_points_deducted || 0);
            } else {
              setRealTimeCost(session.total_points_deducted || 0);
            }
          } catch (error) {
            console.error("Error fetching fresh session data:", error);
            setRealTimeCost(session.total_points_deducted || 0);
          }
        };

        fetchFreshSessionData();

        const interval = setInterval(fetchFreshSessionData, 60000);

        return () => clearInterval(interval);
      } else {
        setRealTimeCost(calculateCurrentCost(session));
      }
    }, [session.is_voucher_used, session.id, isPrepaid]);

    return <>{(realTimeCost + (productsTotal || 0)).toLocaleString("id-ID")}</>;
  };

  // Letakkan helper ini di file yang sama (di luar komponen), ganti versi lama jika sudah ada
  async function finalizeProductsAndStock(sessionId: string) {
    try {
      // Ambil item produk PENDING pada sesi ini
      const { data: pendingItems, error: itemsErr } = await supabase
        .from("rental_session_products")
        .select("product_id, quantity, status")
        .eq("session_id", sessionId)
        .eq("status", "pending");

      if (itemsErr) throw itemsErr;
      if (!pendingItems || pendingItems.length === 0) return;

      // Tandai item pending â†’ completed
      const { error: updErr } = await supabase
        .from("rental_session_products")
        .update({
          status: "completed",
        })
        .eq("session_id", sessionId)
        .eq("status", "pending");

      if (updErr) throw updErr;

      // Kelompokkan qty per product_id hanya dari item yang barusan completed
      const qtyByProduct: Record<string, number> = {};
      for (const it of pendingItems) {
        const q = Number(it.quantity) || 0;
        qtyByProduct[it.product_id] = (qtyByProduct[it.product_id] || 0) + q;
      }

      const productIds = Object.keys(qtyByProduct);
      if (productIds.length === 0) return;

      // Ambil stok saat ini
      const { data: products, error: prodErr } = await supabase
        .from("products")
        .select("id, stock")
        .in("id", productIds);

      if (prodErr) throw prodErr;

      // Kurangi stok sesuai qty yang barusan diselesaikan
      for (const p of products || []) {
        const used = qtyByProduct[p.id] || 0;
        const current = Number(p.stock) || 0;
        const newStock = current - used;
        const { error: updStockErr } = await supabase
          .from("products")
          .update({ stock: newStock })
          .eq("id", p.id);
        if (updStockErr) throw updStockErr;
      }
    } catch (e) {
      console.error("finalizeProductsAndStock error:", e);
    }
  }

  // Fungsi untuk pause session (saat mati lampu)
  // const handlePauseSession = async (sessionId: string) => {
  //   if (!ensureCashierActive()) return;

  //   try {
  //     const session = activeSessions.find((s) => s.id === sessionId);
  //     if (!session) return;

  //     const pauseStartTime = new Date().toISOString();

  //     await supabase
  //       .from("rental_sessions")
  //       .update({
  //         status: "paused",
  //         pause_start_time: pauseStartTime,
  //       })
  //       .eq("id", sessionId);

  //     // Log pause event
  //     await logCashierTransaction({
  //       type: "rental",
  //       amount: 0,
  //       paymentMethod: "cash",
  //       referenceId: `PAUSE-${Date.now()}`,
  //       description: `Rental session paused: (${session.customers?.name})`,
  //       details: {
  //         action: "pause_session",
  //         session_id: sessionId,
  //         pause_start: pauseStartTime,
  //         reason: "Rental session di pause",
  //       },
  //     });

  //     await loadData();
  //     await refreshActiveSessions(); // Refresh global sessions
  //     Swal.fire("Berhasil", "Session berhasil di-pause", "success");
  //   } catch (error) {
  //     console.error("Error pausing session:", error);
  //     Swal.fire("Error", "Gagal pause session", "error");
  //   }
  // };

  // Fungsi untuk resume session
  // const handleResumeSession = async (sessionId: string) => {
  //   if (!ensureCashierActive()) return;

  //   try {
  //     const session = activeSessions.find((s) => s.id === sessionId);
  //     if (!session) return;

  //     const pauseEndTime = new Date().toISOString();

  //     // Ambil data session untuk hitung total pause time
  //     const { data: sessionData } = await supabase
  //       .from("rental_sessions")
  //       .select("pause_start_time, total_pause_minutes")
  //       .eq("id", sessionId)
  //       .single();

  //     if (!sessionData) throw new Error("Session not found");

  //     const pauseStart = new Date(sessionData.pause_start_time || "");
  //     const pauseEnd = new Date(pauseEndTime);
  //     const pauseDurationMs = pauseEnd.getTime() - pauseStart.getTime();
  //     const pauseMinutes = Math.floor(pauseDurationMs / (1000 * 60));
  //     const totalPauseMinutes =
  //       (sessionData.total_pause_minutes || 0) + pauseMinutes;

  //     // Update status di rental_sessions
  //     await supabase
  //       .from("rental_sessions")
  //       .update({
  //         status: "active", // Kembali ke status active
  //         pause_start_time: null, // Reset pause start time
  //         total_pause_minutes: totalPauseMinutes,
  //       })
  //       .eq("id", sessionId);

  //     // Log resume event
  //     await logCashierTransaction({
  //       type: "rental",
  //       amount: 0,
  //       paymentMethod: "cash",
  //       referenceId: `RESUME-${Date.now()}`,
  //       description: `Rental session resumed (${session.customers?.name})`,
  //       details: {
  //         action: "resume_session",
  //         session_id: sessionId,
  //         pause_end: pauseEndTime,
  //         pause_duration_minutes: pauseMinutes,
  //         total_pause_minutes: totalPauseMinutes,
  //       },
  //     });
  //     await loadData();
  //     await refreshActiveSessions(); // Refresh global sessions
  //     Swal.fire("Berhasil", "Session berhasil di-resume", "success");
  //   } catch (error) {
  //     console.error("Error resuming session:", error);
  //     Swal.fire("Error", "Gagal resume session", "error");
  //   }
  // };

  const handleEndSession = async (sessionId: string) => {
    if (endingSessionIds.has(sessionId)) return;
    setEndingSessionIds((prev) => new Set(prev).add(sessionId));
    try {
      const session = activeSessions.find((s) => s.id === sessionId);
      if (!session) return;

      // Untuk BAYAR DIMUKA (prepaid), relay_command_off dijalankan di sini
      let isPrepaid =
        session.duration_minutes && session.payment_status === "paid";
      if (isPrepaid) {
        const consoleObj = consoles.find((c) => c.id === session.console_id);
        if (consoleObj?.power_tv_command) {
          await fetch(consoleObj.power_tv_command).catch(() => {});
        }
        if (consoleObj?.relay_command_off) {
          await fetch(consoleObj.relay_command_off).catch(() => {});
        }

        // Update rental session
        await supabase
          .from("rental_sessions")
          .update({
            end_time: new Date().toISOString(),
            status: "completed",
          })
          .eq("id", session.id);

        const { data: otherActiveSessions, error: activeErr } = await supabase
          .from("rental_sessions")
          .select("id")
          .eq("console_id", session.console_id)
          .eq("status", "active")
          .limit(1);

        if (
          !activeErr &&
          Array.isArray(otherActiveSessions) &&
          otherActiveSessions.length === 0
        ) {
          await supabase
            .from("consoles")
            .update({ status: "available" })
            .eq("id", session.console_id);
        }

        await finalizeProductsAndStock(session.id);

        await loadData();
        // Swal.fire(
        //   "Berhasil",
        //   "Rental telah diakhiri otomatis (bayar dimuka)",
        //   "success"
        // );
        return;
      }

      // Untuk MEMBER CARD (points), finalisasi sesi dan lakukan final delta deduction bila ada
      if (session.is_voucher_used) {
        const consoleObj = consoles.find((c) => c.id === session.console_id);
        if (consoleObj?.power_tv_command) {
          await fetch(consoleObj.power_tv_command).catch(() => {});
        }
        if (consoleObj?.relay_command_off) {
          await fetch(consoleObj.relay_command_off).catch(() => {});
        }

        // Hitung menit yang terpakai
        const startTime = session.start_time
          ? new Date(session.start_time)
          : new Date();
        const endTime = new Date();
        const elapsedMinutes = Math.ceil(
          (endTime.getTime() - startTime.getTime()) / (1000 * 60),
        );

        // Hitung total points yang seharusnya ditarik untuk durasi berjalan
        // Gunakan snapshot tarif yang sudah disimpan saat start rental
        const hourlyRateSnapshot = session.hourly_rate_snapshot || 15000;
        // const perMinuteRateSnapshot =
        //   Math.ceil(
        //     (session.per_minute_rate_snapshot ||
        //       (session.hourly_rate_snapshot || 15000) / 60) / 100
        //   ) * 100;
        const perMinuteRateSnapshot =
          session.per_minute_rate_snapshot || hourlyRateSnapshot / 60;
        const rp = rateProfiles.find(
          (r) => r.id === consoleObj?.rate_profile_id,
        );
        const minimumMinutesMember = rp?.minimum_minutes_member ?? 60;

        let totalPoints = 0;
        if (minimumMinutesMember == 0) {
          totalPoints = elapsedMinutes * perMinuteRateSnapshot;
        } else if (elapsedMinutes <= minimumMinutesMember) {
          totalPoints = hourlyRateSnapshot;
        } else {
          totalPoints =
            hourlyRateSnapshot +
            Math.ceil(
              (elapsedMinutes - minimumMinutesMember) * perMinuteRateSnapshot,
            );
        }

        // Ambil total yang sudah dipotong dari session atau log
        let alreadyDeducted = session.total_points_deducted || 0;

        const needToDeduct = Math.max(0, totalPoints - alreadyDeducted);

        // Final deduction berbasis kartu tidak dilakukan di sini; billing hook sudah melakukan delta-billing.

        // Update rental session
        await supabase
          .from("rental_sessions")
          .update({
            end_time: endTime.toISOString(),
            status: "completed",
            payment_status: "paid",
            duration_minutes: elapsedMinutes,
          })
          .eq("id", session.id);

        // Update console status
        await supabase
          .from("consoles")
          .update({ status: "available" })
          .eq("id", session.console_id);

        await finalizeProductsAndStock(session.id);

        // const { error: manualEndLogError } = await supabase
        //   .from("card_usage_logs")
        //   .insert({
        //     card_uid: session.card_uid,
        //     session_id: session.id,
        //     action_type: "session_end_manual",
        //     points_amount: 0, // No additional deduction, already deducted during billing
        //     balance_before: alreadyDeducted, // Points already deducted
        //     balance_after: alreadyDeducted, // No change in balance
        //     notes: `Manual session end - ${elapsedMinutes} minutes total - Console: ${
        //       session.consoles?.name || "Unknown"
        //     }`,
        //   });

        // if (manualEndLogError) {
        //   console.error(
        //     `Error logging manual session end for ${session.id}:`,
        //     manualEndLogError
        //   );
        // }

        const { data: cardInfo } = await supabase
          .from("rfid_cards")
          .select("avg_nilai_point")
          .eq("uid", session.card_uid as string)
          .single();

        const avgNilaiPoint = cardInfo?.avg_nilai_point ?? 0;
        const capital = session?.consoles?.rate_profiles?.capital ?? 0;
        const durationHours = elapsedMinutes / 60;
        const totalCapitalCost = capital * durationHours;
        const profit = avgNilaiPoint * totalPoints - totalCapitalCost;
        // const profit = avgNilaiPoint * totalPoints;

        // Log transaksi kasir dengan struktur yang kompatibel untuk print receipt
        await logCashierTransaction({
          type: "rental",
          amount: 0,
          paymentMethod: "cash",
          referenceId: `MEMBER_CARD-${Date.now()}`,
          description: `Rental (member card)`,
          details: {
            items: [
              {
                name: `Rental ${session.consoles?.name || "Console"}`,
                type: "rental",
                quantity: 1,
                total: totalPoints,
                description: `Member Card - ${elapsedMinutes} menit`,
                qty: 1,
                price: totalPoints,
                profit: profit,
                capital: totalCapitalCost,
                product_name: `Rental ${session.consoles?.name || "Console"}`,
              },
            ],
            breakdown: {
              rental_cost: totalPoints,
              products_total: 0,
            },
            customer: {
              name: undefined,
              id: null,
            },
            rental: {
              session_id: session.id,
              console: session.consoles?.name,
              duration_minutes: elapsedMinutes,
              start_time: session.start_time,
              end_time: new Date().toISOString(),
            },
            member_card: {
              points_used: totalPoints,
              hourly_rate_snapshot: session.hourly_rate_snapshot,
              per_minute_rate_snapshot: session.per_minute_rate_snapshot,
              avg_nilai_point: avgNilaiPoint,
            },
            payment: {
              method: "member_card",
              amount: totalPoints,
              change: 0,
            },
            customer_id: null,
            console_id: session.console_id,
            elapsed_minutes: elapsedMinutes,
          },
        });

        await loadData();
        await refreshActiveSessions();
        Swal.fire(
          "Berhasil",
          `Sesi rental (member card) berhasil diakhiri. Waktu terpakai: ${elapsedMinutes} menit`,
          "success",
        );
        return;
      }

      if (!ensureCashierActive()) return;

      // Untuk pay-as-you-go, buka modal pembayaran seperti biasa
      // Hitung total biaya rental
      const totalCost = calculateCurrentCost(session);

      // Ambil total produk dari rental_session_products
      let productsTotal = 0;
      try {
        const { data: productRows, error: productErr } = await supabase
          .from("rental_session_products")
          .select("quantity, price")
          .eq("session_id", session.id)
          .in("status", ["pending", "completed"]);
        if (!productErr && Array.isArray(productRows)) {
          productsTotal = productRows.reduce(
            (sum, item) => sum + (item.quantity || 0) * (item.price || 0),
            0,
          );
        }
      } catch (e) {
        // Jika error, biarkan productsTotal = 0
      }

      // Tampilkan modal pembayaran kasir
      setShowPaymentModal({ session, productsTotal });
      setPaymentAmount(totalCost + productsTotal);
      setChangeAmount(0);
      // Proses update status rental & console dilakukan setelah pembayaran di modal
    } catch (error) {
      console.error("Error ending session:", error);
      Swal.fire("Error", "Gagal mengakhiri sesi rental", "error");
    } finally {
      setEndingSessionIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };
  const handleConfirmMoveSession = async () => {
    if (!ensureCashierActive()) return;
    if (!showMoveModal || !moveTargetConsoleId) {
      Swal.fire("Info", "Pilih unit tujuan terlebih dahulu", "info");
      return;
    }
    setIsMovingSession(true);
    const fromId = showMoveModal.fromConsoleId;
    const targetId = moveTargetConsoleId;
    try {
      const session = activeSessions.find(
        (s) => s.id === showMoveModal.sessionId,
      );
      const fromConsole = consoles.find((c) => c.id === fromId);
      const targetConsole = consoles.find((c) => c.id === targetId);

      if (!session || !fromConsole || !targetConsole) {
        throw new Error("Data sesi atau konsol tidak ditemukan");
      }
      if (targetConsole.status !== "available") {
        Swal.fire("Gagal", "Unit tujuan tidak tersedia.", "error");
        return;
      }

      // Double-check di DB target tidak punya sesi aktif
      const { data: existsActive, error: checkErr } = await supabase
        .from("rental_sessions")
        .select("id")
        .eq("console_id", targetId)
        .eq("status", "active")
        .limit(1);
      if (checkErr) throw checkErr;
      if (Array.isArray(existsActive) && existsActive.length > 0) {
        Swal.fire("Gagal", "Unit tujuan sedang dipakai.", "error");
        return;
      }

      // Kunci target (set rented bila masih available)
      const { error: tgtErr } = await supabase
        .from("consoles")
        .update({ status: "rented" })
        .eq("id", targetId)
        .eq("status", "available");
      if (tgtErr) throw tgtErr;

      // Pindahkan sesi ke target
      const { error: moveErr } = await supabase
        .from("rental_sessions")
        .update({ console_id: targetId })
        .eq("id", session.id);
      if (moveErr) {
        await supabase
          .from("consoles")
          .update({ status: "available" })
          .eq("id", targetId);
        throw moveErr;
      }

      // Set source available
      const { error: srcErr } = await supabase
        .from("consoles")
        .update({ status: "available" })
        .eq("id", fromId);
      if (srcErr) {
        // rollback penuh
        await supabase
          .from("rental_sessions")
          .update({ console_id: fromId })
          .eq("id", session.id);
        await supabase
          .from("consoles")
          .update({ status: "available" })
          .eq("id", targetId);
        await supabase
          .from("consoles")
          .update({ status: "rented" })
          .eq("id", fromId);
        throw srcErr;
      }

      // Perintah device
      try {
        if (fromConsole.relay_command_off)
          fetch(fromConsole.relay_command_off).catch(() => {});
        if (fromConsole.power_tv_command)
          fetch(fromConsole.power_tv_command).catch(() => {});
        if (targetConsole.power_tv_command)
          fetch(targetConsole.power_tv_command).catch(() => {});
        if (targetConsole.relay_command_on)
          fetch(targetConsole.relay_command_on).catch(() => {});
      } catch {}

      // Log cashier
      await logCashierTransaction({
        type: "rental",
        amount: 0,
        paymentMethod,
        referenceId: `MOVE_RENTAL-${Date.now()}`,
        description: `Pindah unit ${fromConsole.name} -> ${targetConsole.name}`,
        details: {
          action: "move_session",
          session_id: session.id,
          from_console: fromConsole,
          to_console: targetConsole,
          prepaid: !!session.duration_minutes,
        },
      });

      setShowMoveModal(null);
      setMoveTargetConsoleId("");
      await loadData();
      await refreshActiveSessions(); // Refresh global sessions
      Swal.fire("Berhasil", "Sesi berhasil dipindah ke unit baru.", "success");
    } catch (err) {
      console.error("handleConfirmMoveSession error:", err);
      Swal.fire("Error", "Gagal memindahkan sesi", "error");
    } finally {
      setIsMovingSession(false);
    }
  };

  async function logCashierTransaction(params: {
    type: "sale" | "rental" | "voucher";
    amount: number;
    paymentMethod: "cash" | "qris" | "card" | "transfer" | "member_card";
    referenceId: string;
    description: string;
    details?: any;
  }) {
    try {
      const { data } = await supabase.auth.getUser();
      const cashierId = data?.user?.id ?? null;

      let sessionId: string | null = null;
      if (cashierId) {
        const { data: sessions } = await supabase
          .from("cashier_sessions")
          .select("id")
          .eq("cashier_id", cashierId)
          .eq("status", "active")
          .order("start_time", { ascending: false })
          .limit(1);
        if (Array.isArray(sessions) && sessions.length > 0) {
          sessionId = sessions[0].id;
        }
      }

      const pm =
        params.paymentMethod === "qris" ? "transfer" : params.paymentMethod;

      await supabase.from("cashier_transactions").insert({
        session_id: sessionId,
        type: params.type,
        amount: params.amount,
        payment_method: pm,
        reference_id: params.referenceId,
        description: params.description,
        cashier_id: cashierId,
        details: params.details ?? null,
      });
    } catch (err) {
      console.error("logCashierTransaction error:", err);
    }
  }

  // di ActiveRentals.tsx
  // const printReceipt = (tx: {
  //   id: string;
  //   timestamp: string;
  //   customer?: { name: string };
  //   items: Array<{
  //     name: string;
  //     type: "rental" | "product";
  //     quantity?: number;
  //     total: number;
  //     description?: string;
  //   }>;
  //   subtotal: number;
  //   tax: number;
  //   total: number;
  //   paymentMethod: string;
  //   paymentAmount: number;
  //   change: number;
  //   cashier: string;
  // }) => {
  //   const win = window.open("", "_blank");
  //   if (!win) return;

  //   const html = `
  // <html>
  //   <head>
  //     <title>Receipt - ${tx.id}</title>
  //     <style>
  //       body { font-family: 'Courier New', monospace; font-size: 12px; margin: 20px; }
  //       .receipt { width: 300px; margin: 0 auto; }
  //       .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
  //       .item { display: flex; justify-content: space-between; margin: 5px 0; }
  //       .total { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
  //       .footer { text-align: center; margin-top: 20px; font-size: 10px; }
  //     </style>
  //   </head>
  //   <body>
  //     <div class="receipt">
  //       <div class="header">
  //         <h2>GAMING & BILLIARD CENTER</h2>
  //         <p>PlayStation Rental + Mini Cafe</p>
  //         <p>Receipt: ${tx.id}</p>
  //         <p>${tx.timestamp}</p>
  //         ${tx.customer ? `<p>Customer: ${tx.customer.name}</p>` : ""}
  //         <p>Kasir: ${tx.cashier}</p>
  //       </div>
  //       <div class="items">
  //         ${tx.items
  //           .map(
  //             (i) => `
  //           <div class="item">
  //             <span>${i.name} ${
  //               i.type === "product" ? `x${i.quantity ?? 1}` : ""
  //             }</span>
  //             <span>Rp ${i.total.toLocaleString("id-ID")}</span>
  //           </div>
  //           ${
  //             i.description
  //               ? `<div style="font-size:10px;color:#666;margin-left:10px;">${i.description}</div>`
  //               : ""
  //           }
  //         `
  //           )
  //           .join("")}
  //       </div>
  //       <div class="total">
  //         ${
  //           tx.tax > 0
  //             ? `<div class="item"><span>Pajak:</span><span>Rp ${tx.tax.toLocaleString(
  //                 "id-ID"
  //               )}</span></div>`
  //             : ""
  //         }
  //         <div class="item" style="font-weight:bold;font-size:14px;"><span>TOTAL:</span><span>Rp ${tx.total.toLocaleString(
  //           "id-ID"
  //         )}</span></div>
  //         <div class="item"><span>Bayar (${tx.paymentMethod.toUpperCase()}):</span><span>Rp ${tx.paymentAmount.toLocaleString(
  //     "id-ID"
  //   )}</span></div>
  //         ${
  //           tx.change > 0
  //             ? `<div class="item"><span>Kembalian:</span><span>Rp ${tx.change.toLocaleString(
  //                 "id-ID"
  //               )}</span></div>`
  //             : ""
  //         }
  //       </div>
  //       <div class="footer">
  //         <p>Terima kasih atas kunjungan Anda!</p>
  //         <p>Selamat bermain dan nikmati waktu Anda</p>
  //         <p>---</p>
  //         <p>Simpan struk ini sebagai bukti pembayaran</p>
  //       </div>
  //     </div>
  //   </body>
  // </html>`;

  //   win.document.open();
  //   win.document.write(html);
  //   win.document.close();
  //   win.focus();

  //   // Pastikan konten sudah siap sebelum print
  //   const doPrint = () => {
  //     try {
  //       win.print();
  //     } finally {
  //       /* opsional: win.close(); */
  //     }
  //   };
  //   // Beberapa browser perlu delay kecil
  //   if ("onload" in win) {
  //     win.onload = () => setTimeout(doPrint, 100);
  //   } else {
  //     setTimeout(doPrint, 200);
  //   }
  // };
  // Fungsi proses pembayaran kasir
  const handleProcessPayment = async (
    paymentMethod: "cash" | "card" | "transfer" | "qris",
    paymentAmount: number,
    discountAmount: number,
    discountType: "amount" | "percentage",
    discountValue: number,
    discountReason: string,
  ) => {
    if (!showPaymentModal) return;
    if (!ensureCashierActive()) return;
    if (processPaymentLoading) return;
    setProcessPaymentLoading(true);
    const { session, productsTotal } = showPaymentModal;
    const totalCost = session ? calculateCurrentCost(session) : 0;
    const subtotal = totalCost + (productsTotal ?? 0);
    const finalTotal = Math.max(0, subtotal - discountAmount);

    if (paymentAmount < finalTotal) {
      Swal.fire("Error", "Nominal pembayaran kurang dari total", "warning");
      setProcessPaymentLoading(false);
      return;
    }

    if (discountAmount > 0 && !discountReason.trim()) {
      Swal.fire("Error", "Alasan diskon wajib diisi!", "warning");
      setProcessPaymentLoading(false);
      return;
    }

    try {
      // RETAIL (pembelian umum)
      if (!session) {
        if (cart.length === 0) {
          await Swal.fire("Info", "Keranjang kosong", "info");
          return;
        }

        const rows = cart.map((i) => ({
          session_id: null,
          product_id: i.productId,
          product_name: i.productName,
          quantity: i.quantity,
          price: i.price,
          total: i.price * i.quantity,
          status: "completed",
        }));

        const { error: insertErr } = await supabase
          .from("rental_session_products")
          .insert(rows);
        if (insertErr) throw insertErr;

        // Kurangi stok produk sesuai isi keranjang
        for (const item of cart) {
          const p = products.find((x) => x.id === item.productId);
          if (!p) continue;
          const newStock = (Number(p.stock) || 0) - item.quantity;
          await supabase
            .from("products")
            .update({ stock: newStock })
            .eq("id", p.id);
        }

        // Struk retail
        const receiptData = {
          id: `RETAIL-${Date.now()}`,
          timestamp: new Date().toLocaleString("id-ID"),
          customer: { name: "Umum" },
          items: cart.map((i) => ({
            name: i.productName,
            product_id: i.productId,
            type: "product" as const,
            quantity: i.quantity,
            price: i.price,
            cost: i.cost,
            total: i.price * i.quantity, // harga sebelum diskon
            profit:
              Number((i.price - (i.cost ?? 0)) * i.quantity) -
              (discountAmount > 0 ? discountAmount : 0),
            description: `Harga: Rp ${i.price.toLocaleString("id-ID")}`,
          })),
          subtotal: productsTotal ?? 0,
          tax: 0,
          discount:
            discountAmount > 0
              ? {
                  type: discountType,
                  value: discountValue,
                  amount: discountAmount,
                  reason: discountReason,
                }
              : undefined,
          total: finalTotal,
          paymentMethod,
          paymentAmount,
          change: paymentAmount - finalTotal,
          cashier: "Kasir 1",
        };

        const details = {
          items: receiptData.items,
          breakdown: { rental_cost: 0, products_total: finalTotal },
          customer: receiptData.customer,
          discount:
            discountAmount > 0
              ? {
                  type: discountType,
                  value: discountValue,
                  amount: discountAmount,
                  reason: discountReason,
                }
              : undefined,
          payment: {
            method: paymentMethod,
            amount: paymentAmount,
            change: paymentAmount - finalTotal,
          },
        };

        await logCashierTransaction({
          type: "sale",
          amount: finalTotal,
          paymentMethod,
          referenceId: receiptData.id,
          description: "Retail purchase",
          details,
        });

        setShowPaymentModal(null);
        clearCart();
        await loadData();

        const result = await Swal.fire({
          title: "Berhasil",
          text: "Pembayaran berhasil",
          icon: "success",
          showCancelButton: true,
          confirmButtonText: "Print Receipt",
          cancelButtonText: "Tutup",
        });

        if (result.isConfirmed) {
          printReceipt(receiptData);
        }
        return;
      }

      // Jalankan relay_command_off untuk PAY AS YOU GO
      if (!session.duration_minutes) {
        const consoleObj = consoles.find((c) => c.id === session.console_id);
        if (consoleObj?.relay_command_off) {
          fetch(consoleObj.relay_command_off).catch(() => {});
        }
        if (consoleObj?.power_tv_command) {
          fetch(consoleObj.power_tv_command).catch(() => {});
        }
      }

      // Update rental session
      await supabase
        .from("rental_sessions")
        .update({
          end_time: new Date().toISOString(),
          total_amount: finalTotal,
          status: "completed",
          payment_status: "paid",
          payment_method: paymentMethod,
          paid_amount: paymentAmount,
        })
        .eq("id", session.id);

      // Update console status
      await supabase
        .from("consoles")
        .update({ status: "available" })
        .eq("id", session.console_id);

      await finalizeProductsAndStock(session.id);

      // Ambil detail produk langsung dari DB agar akurat
      const { data: productRows } = await supabase
        .from("rental_session_products")
        .select(
          `product_name, quantity, price, total, status, products(cost), product_id`,
        )
        .eq("session_id", session.id)
        .in("status", ["pending", "completed"]);

      const items = [
        {
          name: `Rental ${session.consoles?.name || "Console"}`,
          type: "rental" as const,
          capital: session?.consoles?.rate_profiles?.capital ?? 0,
          total: totalCost,
          profit: (() => {
            const capitalPerHour =
              session?.consoles?.rate_profiles?.capital ?? 0;
            const durationMinutes =
              session.duration_minutes ??
              (session.start_time
                ? Math.ceil(
                    (Date.now() - new Date(session.start_time).getTime()) /
                      (1000 * 60),
                  )
                : 0);
            const durationHours = durationMinutes / 60;
            const capitalCost = capitalPerHour * durationHours;
            return (
              totalCost -
              capitalCost -
              (discountAmount > 0 ? discountAmount : 0)
            );
          })(),
          description: `${formatElapsedHMS(session.start_time || "")}${
            session.consoles?.location
              ? ` | Lokasi: ${session.consoles.location}`
              : ""
          }`,
        },
        ...(productRows?.map((p) => ({
          name: p.product_name,
          product_id: p.product_id,
          type: "product" as const,
          quantity: p.quantity,
          price: p.price,
          cost: p.products?.cost ?? 0,
          total: p.total ?? p.price * p.quantity,
          profit: (p.price - (p.products?.cost ?? 0)) * p.quantity,
          description: `Harga: Rp ${p.price.toLocaleString("id-ID")}`,
        })) ?? []),
      ];

      const receiptData = {
        id: `RENTAL-${Date.now()}`,
        timestamp: new Date().toLocaleString("id-ID"),
        customer: session.customers,
        items,
        subtotal: totalCost,
        tax: 0,
        discount:
          discountAmount > 0
            ? {
                type: discountType,
                value: discountValue,
                amount: discountAmount,
                reason: discountReason,
              }
            : undefined,
        total: finalTotal,
        paymentMethod,
        paymentAmount,
        change: paymentAmount - finalTotal,
        cashier: "Kasir 1",
      };

      const details = {
        items: receiptData.items,
        breakdown: {
          rental_cost: totalCost,
          products_total: productsTotal ?? 0,
        },
        customer: receiptData.customer,
        rental: {
          session_id: session.id,
          console: session.consoles?.name,
          // duration_minutes: session.duration_minutes ?? null,
          duration_minutes:
            session.duration_minutes ??
            (session.start_time
              ? Math.ceil(
                  (Date.now() - new Date(session.start_time).getTime()) /
                    (1000 * 60),
                )
              : 0),
        },
        discount:
          discountAmount > 0
            ? {
                type: discountType,
                value: discountValue,
                amount: discountAmount,
                reason: discountReason,
              }
            : undefined,
        payment: {
          method: paymentMethod,
          amount: paymentAmount,
          change: receiptData.change,
        },
      };

      await logCashierTransaction({
        type: "rental",
        amount: finalTotal,
        paymentMethod,
        referenceId: receiptData.id,
        description: `Rental payment (Pay-as-you-go)`,
        details,
      });

      setShowPaymentModal(null);
      await loadData();
      await refreshActiveSessions(); // Refresh global sessions
      // Swal.fire(
      //   "Berhasil",
      //   "Pembayaran berhasil, rental telah diakhiri",
      //   "success"
      // );
      // Show success message with print option
      const result = await Swal.fire({
        title: "Berhasil",
        text: "Pembayaran berhasil, rental telah diakhiri",
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "Print Receipt",
        cancelButtonText: "Tutup",
      });

      if (result.isConfirmed) {
        printReceipt(receiptData);
      } else {
        await loadData();
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      Swal.fire("Error", "Gagal memproses pembayaran", "error");
    } finally {
      setProcessPaymentLoading(false);
    }
  };
  // PrepaidPaymentModal: Modal pembayaran untuk Bayar di Muka
  // const PrepaidPaymentModal = ({
  //   open,
  //   onClose,
  //   onConfirm,
  //   duration,
  //   hourlyRate,
  //   totalAmount,
  //   loading,
  // }: {
  //   open: boolean;
  //   onClose: () => void;
  //   onConfirm: (paymentMethod: "cash" | "qris") => void;
  //   duration: string;
  //   hourlyRate: number;
  //   totalAmount: number;
  //   loading: boolean;
  // }) => {
  //   const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris">("cash");
  //   if (!open) return null;
  //   return (
  //     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  //       <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
  //         <div className="p-6">
  //           <h2 className="text-xl font-semibold mb-4">Pembayaran </h2>
  //           <div className="mb-4">
  //             <p>
  //               <strong>Durasi:</strong> {duration}
  //             </p>
  //             <p>
  //               <strong>Tarif per jam:</strong> Rp{" "}
  //               {hourlyRate.toLocaleString("id-ID")}
  //             </p>
  //             <p>
  //               <strong>Total:</strong>{" "}
  //               <span className="text-lg font-bold text-blue-700">
  //                 Rp {totalAmount.toLocaleString("id-ID")}
  //               </span>
  //             </p>
  //           </div>
  //           <div className="mb-4">
  //             <label className="block mb-1 font-medium">
  //               Metode Pembayaran
  //             </label>
  //             <div className="flex gap-3">
  //               <button
  //                 className={`px-4 py-2 rounded-lg border font-medium ${
  //                   paymentMethod === "cash"
  //                     ? "bg-blue-600 text-white border-blue-600"
  //                     : "bg-white text-gray-700 border-gray-300"
  //                 }`}
  //                 onClick={() => setPaymentMethod("cash")}
  //                 disabled={loading}
  //               >
  //                 Tunai
  //               </button>
  //               <button
  //                 className={`px-4 py-2 rounded-lg border font-medium ${
  //                   paymentMethod === "qris"
  //                     ? "bg-blue-600 text-white border-blue-600"
  //                     : "bg-white text-gray-700 border-gray-300"
  //                 }`}
  //                 onClick={() => setPaymentMethod("qris")}
  //                 disabled={loading}
  //               >
  //                 QRIS
  //               </button>
  //             </div>
  //           </div>
  //           <div className="flex justify-end gap-2 mt-6">
  //             <button
  //               className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300"
  //               onClick={onClose}
  //               disabled={loading}
  //             >
  //               Batal
  //             </button>
  //             <button
  //               className="px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
  //               onClick={() => onConfirm(paymentMethod)}
  //               disabled={loading}
  //             >
  //               Bayar & Mulai
  //             </button>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // };
  // Modal Add Time untuk prepaid
  // Handler konfirmasi Add Time
  const handleConfirmAddTime = async (
    paymentMethod: "cash" | "qris",
    paymentAmount: number,
    discountAmount: number,
    discountType: "amount" | "percentage",
    discountValue: number,
    additionalHours: number,
    additionalMinutes: number,
    discountReason: string,
  ) => {
    if (!ensureCashierActive()) return;
    if (!showAddTimeModal) return;

    const additionalDurationMinutes = additionalHours * 60 + additionalMinutes;
    const additionalCost =
      (additionalDurationMinutes / 60) * showAddTimeModal.hourlyRate;
    const finalTotal = Math.max(0, additionalCost - discountAmount);

    if (paymentAmount < finalTotal) {
      Swal.fire("Error", "Nominal pembayaran kurang dari total", "warning");
      return;
    }

    if (discountAmount > 0 && !discountReason.trim()) {
      Swal.fire("Error", "Alasan diskon wajib diisi!", "warning");
      return;
    }

    if (additionalDurationMinutes === 0) {
      Swal.fire("Error", "Pilih durasi tambahan", "warning");
      return;
    }

    setAddTimeLoading(true);
    try {
      const { session, console: consoleData } = showAddTimeModal;

      // Update durasi sesi rental
      const newDurationMinutes =
        session.duration_minutes! + additionalDurationMinutes;
      const { error: updateError } = await supabase
        .from("rental_sessions")
        .update({
          duration_minutes: newDurationMinutes,
          total_amount: session.total_amount + finalTotal,
          paid_amount: session.paid_amount + paymentAmount,
        })
        .eq("id", session.id);

      if (updateError) throw updateError;

      // Log transaksi kasir
      const receiptData = {
        id: `ADD-TIME-${Date.now()}`,
        timestamp: new Date().toLocaleString("id-ID"),
        customer: { name: session.customers?.name || "Customer" },
        items: [
          {
            name: `Rental ${consoleData.name}`,
            type: "rental" as const,
            capital: consoleData?.rate_profiles?.capital ?? 0,
            total: additionalCost,
            profit: (() => {
              const capitalPerHour = consoleData?.rate_profiles?.capital ?? 0;
              const durationHours = additionalDurationMinutes / 60;
              const capitalCost = capitalPerHour * durationHours;
              return finalTotal - capitalCost;
            })(),
            description: `Durasi: ${additionalHours} jam ${
              additionalMinutes > 0 ? `${additionalMinutes} menit` : " Tambahan"
            }`,
          },
        ],
        subtotal: additionalCost,
        tax: 0,
        discount:
          discountAmount > 0
            ? {
                type: discountType,
                value: discountValue,
                amount: discountAmount,
                reason: discountReason,
              }
            : undefined,
        total: finalTotal,
        paymentMethod: paymentMethod.toUpperCase(),
        paymentAmount: paymentAmount,
        change: paymentAmount - finalTotal,
        cashier: user?.full_name || "System",
      };

      const details = {
        items: receiptData.items,
        breakdown: { rental_cost: finalTotal },
        customer: receiptData.customer,
        rental: {
          session_id: session.id,
          console: consoleData.name,
          add_time: true,
          additional_duration_minutes: additionalDurationMinutes,
          new_total_duration: newDurationMinutes,
        },
        discount:
          discountAmount > 0
            ? {
                type: discountType,
                value: discountValue,
                amount: discountAmount,
                reason: discountReason,
              }
            : undefined,
        payment: {
          method: paymentMethod,
          amount: paymentAmount,
          change: receiptData.change,
        },
      };

      await logCashierTransaction({
        type: "rental",
        amount: finalTotal,
        paymentMethod,
        referenceId: receiptData.id,
        description: `Add time rental (${consoleData.name})`,
        details,
      });

      const result = await Swal.fire({
        title: "Berhasil",
        text: `Waktu berhasil ditambahkan: ${additionalHours} jam ${
          additionalMinutes > 0 ? `${additionalMinutes} menit` : ""
        }`,
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "Print Receipt",
        cancelButtonText: "Tutup",
      });

      if (result.isConfirmed) {
        printReceipt(receiptData);
      }

      setShowAddTimeModal(null);
      await loadData();
      await refreshActiveSessions();
    } catch (error) {
      console.error("Error adding time:", error);
      Swal.fire("Error", "Gagal menambahkan waktu", "error");
    } finally {
      setAddTimeLoading(false);
    }
  };

  //Modal pembayaran voucher

  // Modal pembayaran prepaid, UI sama dengan kasir (end rental), tapi logic tetap prepaid

  // Modal pemilihan paket

  // Tambahkan state untuk modal pembayaran prepaid
  type PrepaidPaymentModalState = {
    console: any;
    duration: number;
    hourlyRate: number;
    totalAmount: number;
    rentalDurationHours: number;
    rentalDurationMinutes: number;
  } | null;
  const [showPrepaidPaymentModal, setShowPrepaidPaymentModal] =
    useState<PrepaidPaymentModalState>(null);
  const [prepaidPaymentLoading, setPrepaidPaymentLoading] = useState(false);

  const handleSellVoucher = async (
    paymentMethod: "cash" | "qris",
    paymentAmount: number,
    discountAmount: number,
    discountType: "amount" | "percentage",
    discountValue: number,
    discountReason: string,
  ) => {
    try {
      // Get selected voucher data
      const selectedVoucher = voucherList.find(
        (v) => v.id === selectedVoucherId,
      );
      if (!selectedVoucher) {
        alert("Voucher tidak ditemukan!");
        return;
      }

      // Validate member card is scanned
      if (!scannedCardUID || !scannedCardData) {
        alert("Silakan scan kartu member terlebih dahulu!");
        return;
      }

      // Get current balance
      const { data: currentCardData, error: fetchError } = await supabase
        .from("rfid_cards")
        .select("balance_points, total_poin_ever, total_uang_ever")
        .eq("uid", scannedCardUID)
        .single();

      if (fetchError || !currentCardData) {
        alert("Gagal mengambil data kartu!");
        return;
      }

      const qty = Math.max(1, Number(voucherQuantity) || 1);
      const pointsToAdd = (selectedVoucher.total_points || 0) * qty;
      const priceToPay = (selectedVoucher.voucher_price || 0) * qty;
      const finalAmount = Math.max(0, priceToPay - discountAmount);

      // Validate payment amount
      if (paymentAmount < finalAmount) {
        Swal.fire("Error", "Jumlah pembayaran kurang dari total", "error");
        return;
      }

      if (discountAmount > 0 && !discountReason.trim()) {
        Swal.fire("Error", "Alasan diskon wajib diisi!", "error");
        return;
      }

      const newBalance = currentCardData.balance_points + pointsToAdd;
      const newTotalPoinEver =
        (currentCardData.total_poin_ever || 0) + pointsToAdd;
      const newTotalUangEver =
        (currentCardData.total_uang_ever || 0) + finalAmount;
      const newAvgNilaiPoint =
        newTotalPoinEver > 0 ? newTotalUangEver / newTotalPoinEver : 0;

      // Update member card balance
      const { error: updateError } = await supabase
        .from("rfid_cards")
        .update({
          balance_points: newBalance,
          total_poin_ever: newTotalPoinEver,
          total_uang_ever: newTotalUangEver,
          avg_nilai_point: newAvgNilaiPoint,
        })
        .eq("uid", scannedCardUID);

      if (updateError) {
        alert("Gagal memperbarui saldo kartu!");
        return;
      }

      const currentCashierSession = await getCurrentCashierSession();
      const cashierSessionInfo = currentCashierSession
        ? `${currentCashierSession.cashier_name}`
        : "Unknown";

      const { error: logError } = await supabase
        .from("card_usage_logs")
        .insert({
          card_uid: scannedCardUID,
          session_id: null,
          action_type: "balance_add",
          points_amount: pointsToAdd,
          balance_before: currentCardData.balance_points,
          balance_after: newBalance,
          notes: `Voucher purchase: ${selectedVoucher.name} (${selectedVoucher.voucher_code}) x${qty} (+${pointsToAdd} points) - Payment: ${paymentMethod} by ${cashierSessionInfo}`,
        });

      if (logError) {
        console.error("Error logging voucher purchase:", logError);
      }

      // Log transaction with discount details
      await logCashierTransaction({
        type: "voucher",
        amount: finalAmount,
        paymentMethod,
        referenceId: selectedVoucher.id,
        description: `Penjualan voucher ${selectedVoucher.name} (${pointsToAdd} points) x ${qty} | UID: ${scannedCardUID}`,
        details: {
          voucher_id: selectedVoucher.id,
          voucher_code: selectedVoucher.voucher_code,
          points_added: pointsToAdd,
          quantity: qty,
          card_uid: scannedCardUID,
          previous_balance: currentCardData.balance_points,
          new_balance: newBalance,
          items: [
            {
              name: selectedVoucher.name,
              product_name: selectedVoucher.name,
              title: `Voucher ${selectedVoucher.voucher_code}`,
              qty: qty,
              quantity: qty,
              price: selectedVoucher.voucher_price || 0,
              total: priceToPay,
              description: `Voucher ${pointsToAdd} points`,
              type: "voucher",
            },
          ],
          discount:
            discountAmount > 0
              ? {
                  type: discountType,
                  value: discountValue,
                  amount: discountAmount,
                  reason: discountReason,
                }
              : undefined,
          payment: {
            method: paymentMethod,
            amount: paymentAmount,
            change: paymentAmount - finalAmount,
          },
        },
      });

      // Refresh card data
      const { data: updatedCardData } = await supabase
        .from("rfid_cards")
        .select("uid, balance_points, status")
        .eq("uid", scannedCardUID)
        .single();

      if (updatedCardData) {
        setScannedCardData(updatedCardData);
      }

      // Generate receipt data
      const receiptData = {
        id: `VOUCHER-${Date.now()}`,
        timestamp: new Date().toLocaleString("id-ID"),
        customer: { name: "Customer" },
        items: [
          {
            name: selectedVoucher.name,
            type: "voucher" as const,
            quantity: qty,
            price: selectedVoucher.voucher_price || 0,
            total: priceToPay,
            description: `Voucher ${pointsToAdd} points`,
          },
        ],
        subtotal: priceToPay,
        discount:
          discountAmount > 0
            ? {
                type: discountType,
                value: discountValue,
                amount: discountAmount,
              }
            : undefined,
        total: finalAmount,
        paymentMethod: paymentMethod.toUpperCase(),
        paymentAmount: paymentAmount,
        change: paymentAmount - finalAmount,
        cashier: user?.full_name || "System",
      };

      // Close modal and reset states
      setShowVoucherPaymentModal(false);
      setShowSellVoucherModal(false);
      setSelectedVoucherId("");
      setVoucherQuantity(1);

      // Show success message with print option
      const result = await Swal.fire({
        icon: "success",
        title: "Voucher berhasil dijual!",
        text: `Saldo kartu bertambah ${pointsToAdd} points`,
        showCancelButton: true,
        confirmButtonText: "Print Receipt",
        cancelButtonText: "Tutup",
        confirmButtonColor: "#22c55e",
      });

      if (result.isConfirmed) {
        printReceipt(receiptData);
      }
    } catch (error) {
      console.error("Error selling voucher:", error);
      Swal.fire("Error", "Terjadi kesalahan saat menjual voucher!", "error");
    }
  };

  // Ganti handleStartRental untuk prepaid agar memunculkan modal pembayaran
  const retryDatabaseOperation = async (
    operation: () => Promise<any>,
    maxRetries: number = 3,
    delayMs: number = 1000,
  ): Promise<any> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.warn(`Database operation attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
    throw new Error("Max retries exceeded");
  };

  // Helper function untuk atomic rental creation
  const createRentalAtomic = async (consoleId: string, sessionData: any) => {
    return await retryDatabaseOperation(async () => {
      // Step 1: End existing sessions
      const { data: existingSessions } = await supabase
        .from("rental_sessions")
        .select("id")
        .eq("console_id", consoleId)
        .eq("status", "active");

      if (existingSessions && existingSessions.length > 0) {
        const sessionIds = existingSessions.map((s) => s.id);
        await supabase
          .from("rental_sessions")
          .update({ status: "completed", end_time: new Date().toISOString() })
          .in("id", sessionIds);
      }

      // Step 2: Get latest console data
      const { data: latestConsole, error: consoleError } = await supabase
        .from("consoles")
        .select(`*, rate_profiles(capital)`)
        .eq("id", consoleId)
        .single();

      if (consoleError || !latestConsole) {
        throw new Error("Failed to get console data");
      }

      if (latestConsole.status !== "available") {
        throw new Error("Console is not available");
      }

      // Step 3: Atomic reservation - update console status only if still available
      const { data: reservedRows, error: reserveError } = await supabase
        .from("consoles")
        .update({ status: "rented" })
        .eq("id", consoleId)
        .eq("status", "available")
        .select("id");

      if (reserveError || !reservedRows || reservedRows.length === 0) {
        throw new Error("Console already in use");
      }

      // Step 4: Create rental session
      const { data: newSession, error: sessionError } = await supabase
        .from("rental_sessions")
        .insert(sessionData)
        .select()
        .single();

      if (sessionError || !newSession) {
        // Rollback console reservation
        await supabase
          .from("consoles")
          .update({ status: "available" })
          .eq("id", consoleId);
        throw new Error("Failed to create rental session");
      }

      return { console: latestConsole, session: newSession };
    });
  };

  const handleStartRental = async (consoleId: string) => {
    if (!ensureCashierActive()) return;
    if (startRentalLoading) return; // prevent re-entry
    setStartRentalLoading(true);

    try {
      // Ambil data console terbaru dari database
      const { data: latestConsole, error: latestConsoleError } = await supabase
        .from("consoles")
        .select(`*, rate_profiles(capital)`)
        .eq("id", consoleId)
        .single();
      if (latestConsoleError || !latestConsole) {
        Swal.fire("Error", "Gagal mengambil data console terbaru", "error");
        return;
      }
      if (latestConsole.status !== "available") {
        Swal.fire("Error", "Console sedang digunakan", "warning");
        return;
      }
      // --- Cek status TV dan relay sebelum mulai rental, matikan otomatis jika masih ON ---
      let tvStatusNow = tvStatusJson?.toUpperCase?.() || "";
      let relayStatusNow = relayStatus?.toUpperCase?.() || "";
      if (
        (tvStatusNow === "ON" || relayStatusNow === "ON") &&
        (latestConsole.power_tv_command || latestConsole.relay_command_off)
      ) {
        // Matikan otomatis tanpa konfirmasi
        if (latestConsole.power_tv_command && tvStatusNow === "ON") {
          await fetch(latestConsole.power_tv_command).catch(() => {});
        }
        if (latestConsole.relay_command_off && relayStatusNow === "ON") {
          await fetch(latestConsole.relay_command_off).catch(() => {});
        }
        // Tunggu beberapa detik agar benar-benar OFF
        await new Promise((res) => setTimeout(res, 2000));
      }
      // Untuk pay-as-you-go, kita nyalakan perangkat setelah reservasi sukses (lihat di bawah)
      // Hitung biaya jika prepaid
      let totalAmount = 0;
      let paidAmount = 0;
      let paymentStatus = "pending";
      let totalDurationMinutes =
        rentalType === "prepaid"
          ? rentalDurationHours * 60 + rentalDurationMinutes
          : null;
      if (rentalType === "prepaid") {
        const rateProfile = rateProfiles.find(
          (r) => r.id === latestConsole.rate_profile_id,
        );
        const hourlyRate = rateProfile?.hourly_rate || 0;
        // Billing rule: minimal 1 jam, setelah itu per menit
        if (totalDurationMinutes! <= 60) {
          totalAmount = hourlyRate;
        } else {
          const extraMinutes = totalDurationMinutes! - 60;
          const perMinuteRate = hourlyRate / 60;
          totalAmount = hourlyRate + Math.ceil(extraMinutes * perMinuteRate);
        }
        paidAmount = totalAmount;
        paymentStatus = "paid";
        // Tampilkan modal pembayaran prepaid
        setShowPrepaidPaymentModal({
          console: latestConsole,
          duration: totalDurationMinutes!,
          hourlyRate,
          totalAmount,
          rentalDurationHours,
          rentalDurationMinutes,
        });
        return; // Tunggu konfirmasi modal
      }

      // Member Card Mode - gunakan balance dari kartu RFID
      if (rentalType === "member-card") {
        // Perlu scan kartu RFID untuk mendapatkan balance
        if (!scannedCardUID) {
          Swal.fire(
            "Error",
            "Silakan scan kartu RFID terlebih dahulu",
            "warning",
          );
          return;
        }

        // Ambil data kartu dan cek balance dengan retry
        const cardData = await retryDatabaseOperation(async () => {
          const { data, error } = await supabase
            .from("rfid_cards")
            .select("uid, balance_points, status")
            .eq("uid", scannedCardUID)
            .single();

          if (error || !data) {
            throw new Error("Kartu tidak ditemukan");
          }
          return data;
        });

        if (cardData.status !== "active") {
          Swal.fire("Error", "Kartu tidak aktif", "error");
          return;
        }

        const availableBalance = Math.max(0, cardData.balance_points || 0);
        if (availableBalance <= 0) {
          Swal.fire("Error", "Balance kartu habis", "warning");
          return;
        }

        // Ambil snapshot rate untuk konsistensi harga selama sesi
        const rpForSnapshot = rateProfiles.find(
          (r) => r.id === latestConsole.rate_profile_id,
        );
        const hourlyRateSnapshot = rpForSnapshot?.hourly_rate || 15000;
        const perMinuteRateSnapshot = Math.ceil(hourlyRateSnapshot / 60);

        // Session data untuk member card
        const sessionData = {
          customer_id: null,
          console_id: consoleId,
          card_uid: scannedCardUID,
          status: "active",
          payment_status: "pending",
          total_amount: 0,
          paid_amount: 0,
          start_time: new Date(rentalStartTime).toISOString(),
          duration_minutes: null,
          is_voucher_used: true,
          hourly_rate_snapshot: hourlyRateSnapshot,
          per_minute_rate_snapshot: perMinuteRateSnapshot,
        };

        // Atomic rental creation
        const { console: updatedConsole, session: newSession } =
          await createRentalAtomic(consoleId, sessionData);

        // Nyalakan perangkat setelah atomic operation sukses
        if (updatedConsole.power_tv_command) {
          fetch(updatedConsole.power_tv_command).catch(() => {});
        }
        if (updatedConsole.relay_command_on) {
          fetch(updatedConsole.relay_command_on).catch(() => {});
        }

        // Cetak bukti
        printRentalProof({
          customerName: "Customer",
          unitNumber: updatedConsole.name,
          startTimestamp: new Date().toLocaleString("id-ID"),
          mode: rentalType,
        });

        setShowStartRentalModal(null);
        setRentalType("pay-as-you-go");
        setRentalDurationHours(1);
        setRentalDurationMinutes(0);
        setRentalStartTime(getNowForDatetimeLocal());
        setSearchConsole("");
        await loadData();
        await refreshActiveSessions();
        Swal.fire(
          "Berhasil",
          "Sesi rental (member card) berhasil dimulai",
          "success",
        );
        return;
      }

      // Create new rental session (pay-as-you-go)
      const sessionData = {
        customer_id: null,
        console_id: consoleId,
        status: "active",
        payment_status: paymentStatus,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        start_time: new Date(rentalStartTime).toISOString(),
        duration_minutes:
          rentalType === "prepaid" ? totalDurationMinutes : null,
      };

      // Atomic rental creation
      const { console: updatedConsole, session: newSession } =
        await createRentalAtomic(consoleId, sessionData);

      // Nyalakan perangkat setelah atomic operation sukses
      if (updatedConsole.power_tv_command) {
        fetch(updatedConsole.power_tv_command).catch(() => {});
      }
      if (updatedConsole.relay_command_on) {
        fetch(updatedConsole.relay_command_on).catch(() => {});
      }

      // Cetak bukti
      printRentalProof({
        customerName: "Customer",
        unitNumber: updatedConsole.name,
        startTimestamp: new Date().toLocaleString("id-ID"),
        mode: rentalType,
      });

      setShowStartRentalModal(null);
      setRentalType("pay-as-you-go");
      setRentalDurationHours(1);
      setRentalDurationMinutes(0);
      setRentalStartTime(getNowForDatetimeLocal());
      setSearchConsole("");
      await loadData();
      await refreshActiveSessions();
      Swal.fire("Berhasil", "Sesi rental berhasil dimulai", "success");
    } catch (error) {
      console.error("Error starting rental:", error);
      Swal.fire("Error", "Gagal memulai sesi rental", "error");
    } finally {
      setStartRentalLoading(false);
    }
  };
  // Product cart functions
  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.productId === product.id);
    let newQuantity = 1;
    if (existingItem) {
      newQuantity = existingItem.quantity + 1;
      setCart(
        cart.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: newQuantity,
                total: newQuantity * item.price,
                profit:
                  ((product.price ?? 0) - (product.cost ?? 0)) * newQuantity,
              }
            : item,
        ),
      );
    } else {
      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: 1,
        total: product.price,
        cost: product.cost,
        profit: ((product.price ?? 0) - (product.cost ?? 0)) * 1,
      };
      setCart([...cart, newItem]);
    }
  };

  const clearCart = () => {
    setCart([]);
  };

  const fetchConsoleStatus = async (console: any) => {
    const status = {
      tv: false,
      lamp: false,
      volume: 50,
    };

    try {
      const promises = [];

      // TV status check
      if (console.perintah_cek_power_tv) {
        const tvPromise = (async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 detik timeout

          try {
            const tvRes = await fetch(console.perintah_cek_power_tv, {
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (tvRes.ok) {
              const tvData = await tvRes.json();
              status.tv = tvData.status === "on";
            }
          } catch (err) {
            clearTimeout(timeoutId);
          }
        })();
        promises.push(tvPromise);
      }

      // Relay status check
      if (console.relay_command_status) {
        const relayPromise = (async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);

          try {
            const relayRes = await fetch(console.relay_command_status, {
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (relayRes.ok) {
              const relayData = await relayRes.json();
              status.lamp = relayData.POWER === "ON";
            }
          } catch (err) {
            clearTimeout(timeoutId);
          }
        })();
        promises.push(relayPromise);
      }

      await Promise.allSettled(promises);
    } catch (error) {
      console.error(`Error fetching status for ${console.name}:`, error);
    }

    return status;
  };

  const refreshConsoleStatuses = useCallback(async () => {
    if (isRefreshingStatuses) return;

    setIsRefreshingStatuses(true);
    try {
      const newStatuses: { [key: string]: any } = {};

      const statusPromises = consoles.map(async (console) => {
        try {
          const status = await fetchConsoleStatus(console);
          return { consoleId: console.id, status };
        } catch (error) {
          console.error(`Failed to fetch status for ${console.name}:`, error);
          return {
            consoleId: console.id,
            status: { tv: false, lamp: false, volume: 50 },
          };
        }
      });

      const results = await Promise.allSettled(statusPromises);

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const { consoleId, status } = result.value;
          newStatuses[consoleId] = status;
        }
      });

      setConsoleStatuses(newStatuses);
    } finally {
      setIsRefreshingStatuses(false);
    }
  }, [consoles, isRefreshingStatuses]);

  const debouncedRefreshConsoleStatuses = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshTime < 3000) {
      return;
    }

    setLastRefreshTime(now);
    await refreshConsoleStatuses();
  }, [lastRefreshTime, refreshConsoleStatuses]);

  const runCommand = async () => {
    if (!selectedCommand) {
      await Swal.fire({
        icon: "warning",
        title: "Pilih perintah terlebih dahulu",
      });
      return;
    }

    if (selectedConsoleIds.length === 0) {
      await Swal.fire({
        icon: "warning",
        title: "Pilih console terlebih dahulu",
      });
      return;
    }

    const r = await Swal.fire({
      title: `Jalankan: ${selectedCommand}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Run",
    });
    if (!r.isConfirmed) return;

    // Filter consoles yang dipilih
    const selectedConsoles = consoles.filter((c) =>
      selectedConsoleIds.includes(c.id),
    );

    switch (selectedCommand) {
      case "Matikan TV":
        {
          const results = await Promise.allSettled(
            selectedConsoles.map(async (device) => {
              // Cek status TV terlebih dahulu
              const statusRes = await fetch(device.perintah_cek_power_tv);

              if (!statusRes.ok) {
                throw new Error(`HTTP ${statusRes.status}`);
              }

              const statusData = await statusRes.json();

              // Jika TV sudah mati, skip
              if (statusData.status === "off") {
                return { device, status: "already_off" };
              }

              // Jika status "off"
              const res = await fetch(device.power_tv_command);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return { device, status: "success" };
            }),
          );

          const successful = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "success",
            )
            .map((r) => r.value.device);

          const alreadyOff = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "already_off",
            )
            .map((r) => r.value.device);

          const failed = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "failed",
            )
            .map((r) => r.value.device)
            .concat(
              results
                .filter(
                  (r): r is PromiseRejectedResult => r.status === "rejected",
                )
                .map((_, i) => selectedConsoles[i]),
            );

          // Menampilkan SweetAlert
          Swal.fire({
            title: "Hasil Proses",
            html: `
              <h4><strong>Berhasil Mati:</strong></h4>
              <ul>
                ${successful
                  .map((device) => `<li>${device.name}</li>`)
                  .join("")}
              </ul>
              <h4><strong>Sudah Mati:</strong></h4>
              <ul>
                ${alreadyOff
                  .map((device) => `<li>${device.name}</li>`)
                  .join("")}
              </ul>
              <h4><strong>Gagal Mati:</strong></h4>
              <ul>
                ${failed.map((device) => `<li>${device.name}</li>`).join("")}
              </ul>
            `,
            icon: "info",
            confirmButtonText: "Tutup",
            scrollbarPadding: false,
          });
        }
        break;
      case "Nyalakan TV":
        {
          const results = await Promise.allSettled(
            selectedConsoles.map(async (device) => {
              // Cek status TV terlebih dahulu
              const statusRes = await fetch(device.perintah_cek_power_tv);

              if (!statusRes.ok) {
                throw new Error(`HTTP ${statusRes.status}`);
              }

              const statusData = await statusRes.json();

              // Jika TV sudah menyala, skip
              if (statusData.status === "on") {
                return { device, status: "already_on" };
              }

              // Jika status "off"
              const res = await fetch(device.power_tv_command);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return { device, status: "success" };
            }),
          );

          const successful = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "success",
            )
            .map((r) => r.value.device);

          const alreadyOn = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "already_on",
            )
            .map((r) => r.value.device);

          const failed = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "failed",
            )
            .map((r) => r.value.device)
            .concat(
              results
                .filter(
                  (r): r is PromiseRejectedResult => r.status === "rejected",
                )
                .map((_, i) => selectedConsoles[i]),
            );

          // Menampilkan SweetAlert
          Swal.fire({
            title: "Hasil Proses",
            html: `
              <h4><strong>Berhasil Menyala:</strong></h4>
              <ul>
                ${successful
                  .map((device) => `<li>${device.name}</li>`)
                  .join("")}
              </ul>
              <h4><strong>Sudah Menyala:</strong></h4>
              <ul>
                ${alreadyOn.map((device) => `<li>${device.name}</li>`).join("")}
              </ul>
              <h4><strong>Gagal Menyala:</strong></h4>
              <ul>
                ${failed.map((device) => `<li>${device.name}</li>`).join("")}
              </ul>
            `,
            icon: "info",
            confirmButtonText: "Tutup",
            scrollbarPadding: false,
          });
        }
        break;
        // case "Matikan Nomor":
        //   {
        //     const results = await Promise.allSettled(
        //       selectedConsoles.map(async (device) => {
        //         try {
        //           // Cek status lampu terlebih dahulu
        //           const statusRes = await fetch(device.relay_command_status);

        //           if (!statusRes.ok) {
        //             throw new Error(`HTTP ${statusRes.status}`);
        //           }

        //           const statusData = await statusRes.json();

        //           if (statusData.POWER === "OFF") {
        //             return { device, status: "already_off" };
        //           }

        //           // Jika status "on", lakukan perintah untuk mematikan
        //           const res = await fetch(device.relay_command_off);
        //           if (!res.ok) throw new Error(`HTTP ${res.status}`);

        //           const resData = await res.json();

        //           if (resData.POWER === "OFF") {
        //             return { device, status: "success" };
        //           } else {
        //             return { device, status: "failed", reason: resData };
        //           }
        //         } catch (error) {
        //           return { device, status: "failed", reason: error };
        //         }
        //       })
        //     );

        //     const successful = results
        //       .filter(
        //         (
        //           r
        //         ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
        //           r.status === "fulfilled" && r.value.status === "success"
        //       )
        //       .map((r) => r.value.device);

        //     const alreadyOff = results
        //       .filter(
        //         (
        //           r
        //         ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
        //           r.status === "fulfilled" && r.value.status === "already_off"
        //       )
        //       .map((r) => r.value.device);

        //     const failed = results
        //       .filter(
        //         (
        //           r
        //         ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
        //           r.status === "fulfilled" && r.value.status === "failed"
        //       )
        //       .map((r) => r.value.device)
        //       .concat(
        //         results
        //           .filter(
        //             (r): r is PromiseRejectedResult => r.status === "rejected"
        //           )
        //           .map((_, i) => selectedConsoles[i])
        //       );

        //     await Swal.fire({
        //       title: "Hasil Proses",
        //       html: `
        //         <h4><strong>Berhasil Mati:</strong></h4>
        //         <ul>
        //           ${successful
        //             .map((device) => `<li>Unit ${device.name}</li>`)
        //             .join("")}
        //         </ul>
        //         <h4><strong>Sudah Mati:</strong></h4>
        //         <ul>
        //           ${alreadyOff
        //             .map((device) => `<li>Unit ${device.name}</li>`)
        //             .join("")}
        //         </ul>
        //         <h4><strong>Gagal Mati:</strong></h4>
        //         <ul>
        //           ${failed
        //             .map((device) => `<li>Unit ${device.name}</li>`)
        //             .join("")}
        //         </ul>
        //       `,
        //       icon: "info",
        //       confirmButtonText: "Tutup",
        //       scrollbarPadding: false,
        //     });
        //   }
        //   break;
        // case "Nyalakan Nomor":
        {
          const results = await Promise.allSettled(
            selectedConsoles.map(async (device) => {
              try {
                // Cek status lampu terlebih dahulu
                const statusRes = await fetch(device.relay_command_status);

                if (!statusRes.ok) {
                  throw new Error(`HTTP ${statusRes.status}`);
                }

                const statusData = await statusRes.json();

                if (statusData.POWER === "ON") {
                  return { device, status: "already_on" };
                }

                // Jika status "off", lakukan perintah untuk menyalakan
                const res = await fetch(device.relay_command_on);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const resData = await res.json();

                if (resData.POWER === "ON") {
                  return { device, status: "success" };
                } else {
                  return { device, status: "failed", reason: resData };
                }
              } catch (error) {
                return { device, status: "failed", reason: error };
              }
            }),
          );

          const successful = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "success",
            )
            .map((r) => r.value.device);

          const alreadyOn = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "already_on",
            )
            .map((r) => r.value.device);

          const failed = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "failed",
            )
            .map((r) => r.value.device)
            .concat(
              results
                .filter(
                  (r): r is PromiseRejectedResult => r.status === "rejected",
                )
                .map((_, i) => selectedConsoles[i]),
            );

          await Swal.fire({
            title: "Hasil Proses",
            html: `
              <h4><strong>Berhasil Menyala:</strong></h4>
              <ul>
                ${successful
                  .map((device) => `<li>Unit ${device.name}</li>`)
                  .join("")}
              </ul>
              <h4><strong>Sudah Menyala:</strong></h4>
              <ul>
                ${alreadyOn
                  .map((device) => `<li>Unit ${device.name}</li>`)
                  .join("")}
              </ul>
              <h4><strong>Gagal Menyala:</strong></h4>
              <ul>
                ${failed
                  .map((device) => `<li>Unit ${device.name}</li>`)
                  .join("")}
              </ul>
            `,
            icon: "info",
            confirmButtonText: "Tutup",
            scrollbarPadding: false,
          });
        }
        break;
      case "Matikan Nomor":
        {
          const results = await Promise.allSettled(
            selectedConsoles.map(async (device) => {
              let res = null;
              try {
                res = await fetch(device.relay_command_off);
              } catch (fetchErr) {
                return { device, status: "success" };
              }
              if (res && res.ok) {
                try {
                  await res.text();
                } catch (textErr) {}
                return { device, status: "success" };
              } else {
                return { device, status: "success" };
              }
            }),
          );

          const successful = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "success",
            )
            .map((r) => r.value.device);

          const failed = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "failed",
            )
            .map((r) => r.value.device)
            .concat(
              results
                .filter(
                  (r): r is PromiseRejectedResult => r.status === "rejected",
                )
                .map((_, i) => selectedConsoles[i]),
            );

          await Swal.fire({
            title: "Hasil Proses",
            html: `
                <h4><strong>Berhasil Mati:</strong></h4>
                <ul>
                  ${successful
                    .map((device) => `<li>Unit ${device.name}</li>`)
                    .join("")}
                </ul>
                <h4><strong>Gagal Mati:</strong></h4>
                <ul>
                  ${failed
                    .map((device) => `<li>Unit ${device.name}</li>`)
                    .join("")}
                </ul>
              `,
            icon: "info",
            confirmButtonText: "Tutup",
            scrollbarPadding: false,
          });
        }
        break;
      case "Nyalakan Nomor":
        {
          const results = await Promise.allSettled(
            selectedConsoles.map(async (device) => {
              let res = null;
              try {
                res = await fetch(device.relay_command_on);
              } catch (fetchErr) {
                return { device, status: "success" };
              }
              if (res && res.ok) {
                try {
                  await res.text();
                } catch (textErr) {}
                return { device, status: "success" };
              } else {
                return { device, status: "success" };
              }
            }),
          );

          const successful = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "success",
            )
            .map((r) => r.value.device);

          const failed = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "failed",
            )
            .map((r) => r.value.device)
            .concat(
              results
                .filter(
                  (r): r is PromiseRejectedResult => r.status === "rejected",
                )
                .map((_, i) => selectedConsoles[i]),
            );

          await Swal.fire({
            title: "Hasil Proses",
            html: `
                <h4><strong>Berhasil Menyala:</strong></h4>
                <ul>
                  ${successful
                    .map((device) => `<li>Unit ${device.name}</li>`)
                    .join("")}
                </ul>
                <h4><strong>Gagal Menyala:</strong></h4>
                <ul>
                  ${failed
                    .map((device) => `<li>Unit ${device.name}</li>`)
                    .join("")}
                </ul>
              `,
            icon: "info",
            confirmButtonText: "Tutup",
            scrollbarPadding: false,
          });
        }
        break;
      case "Set volume TV":
        {
          const results = await Promise.allSettled(
            selectedConsoles.map((device) =>
              fetch(
                `http://localhost:3001/tv/${device.ip_address_tv}/volume/${volume}?port=5555&method=adb`,
              )
                .then((res) => {
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  return { device, status: "success" };
                })
                .catch((err) => ({
                  device,
                  status: "failed",
                  error: err.message,
                })),
            ),
          );

          const successful = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "success",
            )
            .map((r) => r.value.device);

          const failed = results
            .filter(
              (
                r,
              ): r is PromiseFulfilledResult<{ device: any; status: string }> =>
                r.status === "fulfilled" && r.value.status === "failed",
            )
            .map((r) => r.value.device)
            .concat(
              results
                .filter(
                  (r): r is PromiseRejectedResult => r.status === "rejected",
                )
                .map((_, i) => selectedConsoles[i]),
            );

          await Swal.fire({
            title: "Hasil Set Volume",
            html: `
              <h4><strong>Berhasil:</strong></h4>
              <ul>
                ${successful
                  .map((device) => `<li>${device.name}</li>`)
                  .join("")}
              </ul>
              <h4><strong>Gagal:</strong></h4>
              <ul>
                ${failed.map((device) => `<li>${device.name}</li>`).join("")}
              </ul>
            `,
            icon: "info",
            confirmButtonText: "Tutup",
            scrollbarPadding: false,
          });
        }
        break;
      case "Set mute TV": {
        const results = await Promise.allSettled(
          selectedConsoles.map((device) =>
            fetch(
              `http://localhost:3001/tv/${device.ip_address_tv}/volume/0?port=5555&method=adb`,
            )
              .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return { device, status: "success" };
              })
              .catch((err) => ({
                device,
                status: "failed",
                error: err.message,
              })),
          ),
        );

        const successful = results
          .filter(
            (r): r is PromiseFulfilledResult<{ device: any; status: string }> =>
              r.status === "fulfilled" && r.value.status === "success",
          )
          .map((r) => r.value.device);

        const failed = results
          .filter(
            (r): r is PromiseFulfilledResult<{ device: any; status: string }> =>
              r.status === "fulfilled" && r.value.status === "failed",
          )
          .map((r) => r.value.device)
          .concat(
            results
              .filter(
                (r): r is PromiseRejectedResult => r.status === "rejected",
              )
              .map((_, i) => selectedConsoles[i]),
          );

        await Swal.fire({
          title: "Hasil Set Mute",
          html: `
            <h4><strong>Berhasil:</strong></h4>
            <ul>
              ${successful.map((device) => `<li>${device.name}</li>`).join("")}
            </ul>
            <h4><strong>Gagal:</strong></h4>
            <ul>
              ${failed.map((device) => `<li>${device.name}</li>`).join("")}
            </ul>
          `,
          icon: "info",
          confirmButtonText: "Tutup",
          scrollbarPadding: false,
        });
        break;
      }
      case "Cek Status IP (Relay & TV)": {
        const results = await Promise.allSettled(
          selectedConsoles.map(async (device) => {
            let relayStatus = "Error";
            let tvStatus = "Error";

            try {
              if (device.relay_command_status) {
                const res = await fetch(device.relay_command_status);
                if (res.ok) {
                  const data = await res.json();
                  relayStatus = data.POWER === "ON" ? "ON" : "OFF";
                }
              } else {
                relayStatus = "N/A";
              }
            } catch (e) {
              relayStatus = "Error";
            }

            try {
              if (device.perintah_cek_power_tv) {
                const res = await fetch(device.perintah_cek_power_tv);
                if (res.ok) {
                  const data = await res.json();
                  tvStatus = data.status === "on" ? "ON" : "OFF";
                }
              } else {
                tvStatus = "N/A";
              }
            } catch (e) {
              tvStatus = "Error";
            }

            const passed = relayStatus !== "Error" && tvStatus !== "Error";
            return { device, relayStatus, tvStatus, passed };
          }),
        );

        const summary = results.map((r, i) => {
          if (r.status === "fulfilled") return r.value;
          return {
            device: selectedConsoles[i],
            relayStatus: "Error",
            tvStatus: "Error",
            passed: false,
          };
        });

        await Swal.fire({
          title: "Hasil Cek Status IP",
          width: "600px",
          html: `
            <div class="text-left">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b">
                    <th class="py-2 text-left font-semibold text-gray-700">Unit</th>
                    <th class="py-2 text-center font-semibold text-gray-700">Relay</th>
                    <th class="py-2 text-center font-semibold text-gray-700">TV</th>
                    <th class="py-2 text-right font-semibold text-gray-700">Result</th>
                  </tr>
                </thead>
                <tbody>
                  ${summary
                    .map(
                      (item) => `
                    <tr class="border-b hover:bg-gray-50 transition-colors">
                      <td class="py-3 font-medium text-gray-900">${item.device.name}</td>
                      <td class="py-3 text-center">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shadow-sm ${
                          item.relayStatus === "ON"
                            ? "bg-green-100 text-green-800 border border-green-200"
                            : item.relayStatus === "OFF"
                              ? "bg-red-100 text-red-800 border border-red-200"
                              : "bg-gray-100 text-gray-800 border border-gray-200"
                        }">${item.relayStatus}</span>
                      </td>
                      <td class="py-3 text-center">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shadow-sm ${
                          item.tvStatus === "ON"
                            ? "bg-green-100 text-green-800 border border-green-200"
                            : item.tvStatus === "OFF"
                              ? "bg-red-100 text-red-800 border border-red-200"
                              : "bg-gray-100 text-gray-800 border border-gray-200"
                        }">${item.tvStatus}</span>
                      </td>
                      <td class="py-3 text-right">
                        ${
                          item.passed
                            ? '<span class="inline-flex items-center text-green-600 font-bold"><svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>PASSED</span>'
                            : '<span class="inline-flex items-center text-red-600 font-bold"><svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>ERROR</span>'
                        }
                      </td>
                    </tr>
                  `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `,
          icon: summary.every((s) => s.passed) ? "success" : "warning",
          confirmButtonText: "Tutup",
          scrollbarPadding: false,
        });
        break;
      }
    }
  };

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchProduct.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(products.map((p) => p.category))];
  const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);

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

  // Tambahkan fungsi utilitas getConsoleRateProfile agar error hilang
  type ConsoleType = {
    id: string;
    rate_profile_id?: string;
  };
  const getConsoleRateProfile = (consoleId: string) => {
    const consoleObj = consoles.find((c: ConsoleType) => c.id === consoleId);
    if (!consoleObj || !consoleObj.rate_profile_id) return null;
    return (
      rateProfiles.find((r) => r.id === consoleObj.rate_profile_id) || null
    );
  };

  // Render PrepaidPaymentModal setelah Start Rental Modal
  // State untuk pause pengecekan Console Information
  const [pauseConsoleInfoCheck, setPauseConsoleInfoCheck] = useState(false);

  // Pause timer pengecekan Console Information saat modal pembayaran prepaid tampil
  useEffect(() => {
    setPauseConsoleInfoCheck(!!showPrepaidPaymentModal);
  }, [showPrepaidPaymentModal]);

  // Tambahkan state untuk modal batal transaksi
  const [showCancelModal, setShowCancelModal] = useState<null | {
    session: RentalSession;
  }>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // Handler konfirmasi pembayaran prepaid
  const handleConfirmPrepaidPayment = async (
    paymentMethod: "cash" | "qris",
    paymentAmount: number,
    discountAmount: number,
    discountType: "amount" | "percentage",
    discountValue: number,
    discountReason: string,
  ) => {
    if (!ensureCashierActive()) return;
    if (!showPrepaidPaymentModal) return;
    if (prepaidPaymentLoading) return;

    const finalTotal = Math.max(
      0,
      showPrepaidPaymentModal.totalAmount - discountAmount,
    );

    if (paymentAmount < finalTotal) {
      Swal.fire("Error", "Nominal pembayaran kurang dari total", "warning");
      return;
    }

    if (discountAmount > 0 && !discountReason.trim()) {
      Swal.fire("Error", "Alasan diskon wajib diisi!", "warning");
      return;
    }

    setPrepaidPaymentLoading(true);
    let rentalSessionId: string | null = null;
    try {
      const {
        console: latestConsole,
        totalAmount,
        duration,
        rentalDurationHours,
        rentalDurationMinutes,
      } = showPrepaidPaymentModal;

      // Create new rental session (tanpa customer_id)
      const { data: insertedRows, error: rentalError } = await supabase
        .from("rental_sessions")
        .insert({
          console_id: latestConsole.id,
          status: "active",
          payment_status: "paid",
          total_amount: finalTotal,
          paid_amount: paymentAmount,
          start_time: new Date(rentalStartTime).toISOString(),
          duration_minutes: duration,
          payment_method: paymentMethod,
        })
        .select("id")
        .limit(1);
      if (rentalError) throw rentalError;
      rentalSessionId = insertedRows?.[0]?.id ?? null;

      // Update console status
      const { error: consoleError } = await supabase
        .from("consoles")
        .update({ status: "rented" })
        .eq("id", latestConsole.id);
      if (consoleError) {
        if (rentalSessionId) {
          await supabase
            .from("rental_sessions")
            .delete()
            .eq("id", rentalSessionId);
        }
        throw consoleError;
      }

      // Print receipt untuk pembayaran prepaid (tanpa customer)
      const receiptData = {
        id: `RENTAL-${Date.now()}`,
        timestamp: new Date().toLocaleString("id-ID"),
        customer: { name: "Customer" },
        items: [
          {
            name: `Rental ${latestConsole.name}`,
            type: "rental" as const,
            capital: latestConsole?.rate_profiles?.capital ?? 0,
            total: totalAmount,
            profit: (() => {
              const capitalPerHour = latestConsole?.rate_profiles?.capital ?? 0;
              const durationHours =
                rentalDurationHours + rentalDurationMinutes / 60;
              const capitalCost = capitalPerHour * durationHours;
              return finalTotal - capitalCost;
            })(),
            description: `Durasi: ${rentalDurationHours} jam ${
              rentalDurationMinutes > 0 ? `${rentalDurationMinutes} menit` : ""
            } (Prepaid)`,
          },
        ],
        subtotal: totalAmount,
        tax: 0,
        discount:
          discountAmount > 0
            ? {
                type: discountType,
                value: discountValue,
                amount: discountAmount,
                reason: discountReason,
              }
            : undefined,
        total: finalTotal,
        paymentMethod: paymentMethod.toUpperCase(),
        paymentAmount: paymentAmount,
        change: paymentAmount - finalTotal,
        cashier: user?.full_name || "System",
      };

      const details = {
        items: receiptData.items,
        breakdown: { rental_cost: finalTotal, products_total: 0 },
        rental: {
          session_id: rentalSessionId,
          console: latestConsole.name,
          prepaid: true,
          duration_minutes: duration,
        },
        discount:
          discountAmount > 0
            ? {
                type: discountType,
                value: discountValue,
                amount: discountAmount,
              }
            : undefined,
        payment: {
          method: paymentMethod,
          amount: paymentAmount,
          change: receiptData.change,
        },
      } as any;

      await logCashierTransaction({
        type: "rental",
        amount: finalTotal,
        paymentMethod,
        referenceId: receiptData.id,
        description: `Prepaid rental (${latestConsole.name})`,
        details,
      });

      printRentalProof({
        customerName: "",
        unitNumber: latestConsole.name,
        startTimestamp: new Date().toLocaleString("id-ID"),
        mode: rentalType,
      });

      const result = await Swal.fire({
        title: "Berhasil",
        text: "Sesi rental berhasil dimulai",
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "Print Receipt",
        cancelButtonText: "Tutup",
      });

      if (result.isConfirmed) {
        printReceipt(receiptData as any);
      } else {
        await loadData();
      }

      if (latestConsole.power_tv_command) {
        fetch(latestConsole.power_tv_command).catch(() => {});
      }
      if (latestConsole.relay_command_on) {
        fetch(latestConsole.relay_command_on).catch(() => {});
      }

      setSearchConsole("");
      setShowPrepaidPaymentModal(null);
      setShowStartRentalModal(null);
      setRentalType("pay-as-you-go");
      setRentalDurationHours(1);
      setRentalDurationMinutes(0);
      setRentalStartTime(getNowForDatetimeLocal());

      await loadData();
      await refreshActiveSessions();
    } catch (error) {
      console.error("Error starting prepaid rental:", error);

      if (rentalSessionId) {
        try {
          await supabase
            .from("rental_sessions")
            .delete()
            .eq("id", rentalSessionId);
        } catch (rollbackError) {
          console.error("Rollback failed:", rollbackError);
        }
      }
      Swal.fire("Error", "Gagal memulai sesi rental", "error");
    } finally {
      setPrepaidPaymentLoading(false);
    }
  };
  // Fungsi pembatalan transaksi
  const handleCancelTransaction = async (session: RentalSession) => {
    if (!cancelReason.trim()) {
      Swal.fire("Error", "Alasan pembatalan wajib diisi", "warning");
      return;
    }
    setCancelLoading(true);
    try {
      const { data: trx } = await supabase
        .from("cashier_transactions")
        .select("id, details, description, timestamp, amount")
        .eq("type", "rental")
        .filter("details->rental->>session_id", "eq", session.id)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      const isPrepaid = Boolean(
        trx?.details?.rental?.prepaid ?? trx?.details?.prepaid,
      );

      // Update rental session status
      await supabase
        .from("rental_sessions")
        .update({
          status: "cancelled",
          notes: `Dibatalkan oleh kasir pada ${new Date().toLocaleString(
            "id-ID",
          )}: ${cancelReason}`,
        })
        .eq("id", session.id);

      if (trx?.id) {
        const newDetails = {
          ...(trx.details ?? {}),
          cancelled: true,
          cancel_reason: cancelReason,
          cancelled_at: new Date().toISOString(),
        };

        if (isPrepaid) {
          await Promise.all([
            supabase
              .from("rental_sessions")
              .update({
                payment_status: "pending",
                total_amount: 0,
                paid_amount: 0,
                end_time: new Date().toISOString(),
              })
              .eq("id", session.id),

            supabase
              .from("cashier_transactions")
              .update({
                reference_id: `CANCELLED-${Date.now()}`,
                amount: 0,
                description: `[CANCELLED] ${
                  trx.description || ""
                } : ${cancelReason}`.trim(),
                details: newDetails,
              })
              .eq("id", trx.id),
          ]);
        }
      } else {
        await logCashierTransaction({
          type: "rental",
          amount: 0,
          paymentMethod: "cash",
          referenceId: `CANCELLED-${Date.now()}`,
          description: `Dibatalkan oleh kasir pada ${new Date().toLocaleString(
            "id-ID",
          )}: ${cancelReason}`,
          details: {
            action: "cancel_session",
            session_id: session.id,
            reason: cancelReason,
          },
        });
      }

      // Rollback stok produk jika ada
      const { data: products } = await supabase
        .from("rental_session_products")
        .select("product_id, quantity")
        .eq("session_id", session.id);
      if (Array.isArray(products)) {
        for (const item of products) {
          await supabase.rpc("increment_product_stock", {
            product_id: item.product_id,
            qty: item.quantity,
          });
        }
      }
      // Update status console
      if (session.console_id) {
        const { data: consoleData, error: consoleError } = await supabase
          .from("consoles")
          .update({ status: "available" })
          .eq("id", session.console_id)
          .select()
          .single();

        if (consoleData?.power_tv_command) {
          fetch(consoleData.power_tv_command).catch(() => {
            console.error("Gagal mematikan TV");
          });
        }
        if (consoleData?.relay_command_off) {
          fetch(consoleData.relay_command_off).catch(() => {
            console.error("Gagal mematikan relay");
          });
        }
      }

      setShowCancelModal(null);
      setCancelReason("");
      await loadData();
      Swal.fire("Berhasil", "Transaksi berhasil dibatalkan", "success");
    } catch (err) {
      Swal.fire("Error", "Gagal membatalkan transaksi", "error");
    } finally {
      setCancelLoading(false);
    }
  };

  // Filtered consoles
  const filteredConsoles = useMemo(() => {
    let filtered = consoles;

    // Filter by status
    if (consoleFilter !== "all") {
      filtered = filtered.filter((c) => c.status === consoleFilter);
    }

    // Filter by search
    if (searchConsole.trim()) {
      const searchLower = searchConsole.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.location?.toLowerCase().includes(searchLower),
      );
    }

    // Sort by console number
    return filtered.sort((a, b) => {
      const aNum = parseInt(a.name) || 0;
      const bNum = parseInt(b.name) || 0;
      return aNum - bNum;
    });
  }, [consoles, consoleFilter, searchConsole]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Console Management
            </h1>
            <p className="text-gray-600">
              Monitor all consoles and manage rental sessions
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isTimerRunning ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
              <span className="text-sm text-gray-600">
                Timer: {isTimerRunning ? "Running" : "Stopped"}
              </span>
            </div>

            {/* Auto Shutdown Protection Controls */}
            <div className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-lg border">
              <div className="flex items-center gap-2">
                <Power className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-gray-700">
                  Auto Shutdown Protection
                </span>
              </div>

              {/* Global Toggle */}
              <div className="flex items-center gap-2">
                <div
                  // onClick={() =>
                  //   toggleAllConsolesAutoShutdown(!autoShutdownEnabled)
                  // }
                  disabled={isUpdatingAutoShutdown}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    autoShutdownEnabled
                      ? "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
                      : "bg-red-100 text-red-700 border border-red-300 hover:bg-red-200"
                  } ${
                    isUpdatingAutoShutdown
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {isUpdatingAutoShutdown
                    ? "Updating..."
                    : autoShutdownEnabled
                      ? "All Protected"
                      : "All Disabled"}
                </div>
              </div>

              {/* Manage All Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAutoShutdownModal(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                  title="Manage auto shutdown for all consoles"
                >
                  Manage All
                </button>

                {/* Sync Status Button */}
                <button
                  onClick={syncConsoleAndSessionStatus}
                  disabled={isSyncing}
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium px-2 py-1 rounded border border-purple-200 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Sinkronisasi status console dan rental session"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3" />
                      Sync Status
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowToolsModal(true);
                  }}
                  aria-label="Tools"
                  title="Tools"
                  className="p-2 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-600"
                >
                  <Wrench className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time Display, Filter & View Mode Toggle */}
      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
            <RealTimeClock />
          </div>
          {/* Search Console */}
          <div className="relative" style={{ minWidth: 180 }}>
            <input
              type="text"
              placeholder="Cari nama console..."
              value={searchConsole}
              onChange={(e) => setSearchConsole(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ minWidth: 180 }}
            />
            {searchConsole && (
              <button
                type="button"
                onClick={() => setSearchConsole("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                tabIndex={-1}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              handleOpenGameSearch();
            }}
            className={` bg-teal-500 hover:bg-teal-600 text-white py-3 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm`}
            title="Cari Game di Console"
          >
            <Search className="h-5 w-5" />
            <span className="hidden sm:inline">Cari Game</span>
          </button>

          {/* Add Product */}
          <button
            onClick={() => {
              if (!ensureCashierActive()) return;
              setShowProductModal("retail");
            }}
            className={` bg-orange-500 hover:bg-orange-600 text-white py-3 px-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2`}
          >
            <ShoppingCart className="h-5 w-5" />
            Add Products
          </button>

          <button
            onClick={() => {
              if (!ensureCashierActive()) return;
              setShowPayAsYouGoModal(true);
            }}
            className=" bg-purple-500 hover:bg-purple-600 text-white py-3 px-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Play className="h-5 w-5" />
            Pay-as-you-go Card
          </button>

          <button
            onClick={() => {
              if (!ensureCashierActive()) return;
              setShowSellVoucherModal(true);
              setVoucherQuantity(1);
            }}
            className=" bg-blue-500 hover:bg-blue-600 text-white py-3 px-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Ticket className="h-5 w-5" />
            Jual Voucher
          </button>
          <button
            onClick={() => {
              setShowCheckBalanceModal(true);
            }}
            className="bg-green-500 hover:bg-green-600 text-white py-3 px-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard className="h-5 w-5" />
            Cek Saldo Kartu
          </button>
        </div>

        {/* Filter Buttons, View Mode Toggle & History Button */}
        <div className="flex gap-2 flex-wrap items-center">
          <button
            className={`px-4 py-2 rounded-lg font-medium border transition-colors ${
              consoleFilter === "all"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50"
            }`}
            onClick={() => setConsoleFilter("all")}
          >
            Semua
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-medium border transition-colors ${
              consoleFilter === "available"
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-green-50"
            }`}
            onClick={() => setConsoleFilter("available")}
          >
            Available ({consoles.filter((c) => c.status === "available").length}
            )
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-medium border transition-colors ${
              consoleFilter === "rented"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50"
            }`}
            onClick={() => setConsoleFilter("rented")}
          >
            Active ({consoles.filter((c) => c.status === "rented").length})
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-medium border transition-colors ${
              consoleFilter === "maintenance"
                ? "bg-red-600 text-white border-red-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-red-50"
            }`}
            onClick={() => setConsoleFilter("maintenance")}
          >
            Maintenance (
            {consoles.filter((c) => c.status === "maintenance").length})
          </button>
          {/* View Mode Toggle */}
          <div className="ml-2 flex gap-1">
            <button
              type="button"
              className={`px-3 py-2 rounded-lg font-medium border text-xs transition-colors ${
                viewMode === "simple"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50"
              }`}
              onClick={() => setViewMode("simple")}
            >
              Simple
            </button>
            <button
              type="button"
              className={`px-3 py-2 rounded-lg font-medium border text-xs transition-colors ${
                viewMode === "detail"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50"
              }`}
              onClick={() => setViewMode("detail")}
            >
              Detail
            </button>
            <button
              type="button"
              className={`px-3 py-2 rounded-lg font-medium border text-xs transition-colors ${
                viewMode === "list"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50"
              }`}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
            <button
            className="px-4 py-2 rounded-lg font-medium border border-gray-400 bg-white text-gray-700 hover:bg-gray-100 ml-2"
            onClick={() => {
              setShowHistoryModal(true);
              loadHistorySessions(historyStartDate, historyEndDate);
            }}
            type="button"
          >
            Lihat History
          </button>
          </div>
        </div>
      </div>

      {/* Voucher Modal */}
      {showSellVoucherModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Jual Voucher
              </h2>

              {/* Member Card Status */}
              {!scannedCardUID || !scannedCardData ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <div className="text-red-600">
                      <svg
                        className="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Kartu Member Belum Discan
                      </h3>
                      <p className="text-sm text-red-700 mt-1">
                        Silakan scan kartu member terlebih dahulu sebelum
                        menjual voucher.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <div className="text-green-600">
                      <svg
                        className="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">
                        Kartu Member Terdeteksi
                      </h3>
                      <p className="text-sm text-green-700 mt-1">
                        UID: {scannedCardUID}
                      </p>
                      <p className="text-sm text-green-700">
                        Saldo Saat Ini:{" "}
                        {scannedCardData?.balance_points?.toLocaleString()}{" "}
                        points
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <form className="space-y-4">
                {/* Pilih Voucher */}
                <div>
                  <div className="flex justify-between gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pilih Voucher
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowVoucherModal(true);
                            setVoucherSearchTerm("");
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left bg-white hover:bg-gray-50"
                        >
                          {selectedVoucherId
                            ? voucherList.find(
                                (v) => v.id === selectedVoucherId,
                              )?.name || "Pilih Voucher"
                            : "Pilih Voucher"}
                        </button>
                        {selectedVoucherId && (
                          <button
                            type="button"
                            onClick={() => setSelectedVoucherId("")}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Quantity */}
                    <div className="w-28">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={voucherQuantity}
                        onChange={(e) => {
                          const val = Math.max(
                            1,
                            parseInt(e.target.value) || 1,
                          );
                          setVoucherQuantity(val);
                        }}
                        className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(
                        e.target.value as "cash" | "qris" | "card",
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="cash">Cash</option>
                    <option value="qris">QRIS</option>
                  </select>
                </div>
                {/* Preview */}
                {selectedVoucherId && scannedCardUID && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    {(() => {
                      const v = voucherList.find(
                        (v) => v.id === selectedVoucherId,
                      );
                      if (!v) return null;

                      const currentBalance =
                        scannedCardData?.balance_points || 0;
                      const qty = Math.max(1, Number(voucherQuantity) || 1);
                      const pointsToAdd = (v.total_points || 0) * qty;
                      const priceToPay = (v.voucher_price || 0) * qty;
                      const newBalance = currentBalance + pointsToAdd;

                      return (
                        <div className="space-y-3">
                          <h4 className="font-medium text-gray-900">
                            Detail Transaksi
                          </h4>

                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>Kode Voucher:</span>
                              <span>{v.voucher_code}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Nama Voucher:</span>
                              <span>{v.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Quantity:</span>
                              <span className="font-medium">{qty}x</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Points Ditambahkan:</span>
                              <span className="text-green-600 font-medium">
                                +{pointsToAdd} points
                              </span>
                            </div>
                          </div>

                          <div className="border-t border-gray-200 pt-2">
                            <div className="flex justify-between items-center text-sm">
                              <span>Saldo Saat Ini:</span>
                              <span>
                                {currentBalance.toLocaleString()} points
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-medium text-green-600">
                              <span>Saldo Setelah Penjualan:</span>
                              <span>{newBalance.toLocaleString()} points</span>
                            </div>
                          </div>

                          <div className="flex justify-between font-medium border-t border-gray-200 pt-2">
                            <span>Total Bayar:</span>
                            <span>
                              Rp {priceToPay?.toLocaleString("id-ID")}
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
                  onClick={() => {
                    setShowSellVoucherModal(false);
                    setSelectedVoucherId("");
                    setScannedCardUID("");
                    setScannedCardData(null);
                    setVoucherQuantity(1);
                    setPaymentMethod("cash");
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={async () => {
                    if (!selectedVoucherId) {
                      alert("Pilih voucher!");
                      return;
                    }
                    setSelling(true);
                    // await handleSellVoucher();
                    const selectedVoucher = voucherList.find(
                      (v) => v.id === selectedVoucherId,
                    );
                    const qty = Math.max(1, Number(voucherQuantity) || 1);
                    const subtotal =
                      (selectedVoucher?.voucher_price || 0) * qty;

                    setShowVoucherPaymentModal(true);
                    setSelling(false);
                  }}
                  disabled={selling}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {selling ? "Memproses..." : "Jual Voucher"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check Balance Modal */}
      {showCheckBalanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Cek Saldo Kartu
              </h2>

              {/* Member Card Status */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="text-yellow-600 pt-1">
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Scan Kartu Member
                    </h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Silakan scan kartu RFID atau masukkan UID manual.
                    </p>

                    {/* <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="Input UID kartu manual"
                        value={scannedCardUID}
                        onChange={(e) => setScannedCardUID(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (e.currentTarget.value.trim()) {
                              fetchCardData(e.currentTarget.value.trim());
                            }
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          if (scannedCardUID.trim()) {
                            fetchCardData(scannedCardUID.trim());
                          }
                        }}
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                      >
                        Cek Kartu
                      </button>
                    </div> */}
                  </div>
                </div>
              </div>

              {/* Status */}
              {scannedCardUID && (
                <>
                  {
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="text-green-600 pt-1">
                          <svg
                            className="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-green-800">
                            Kartu Member Terdeteksi
                          </h3>
                          <p className="text-sm text-green-700 mt-1">
                            UID: {scannedCardUID}
                          </p>
                          <p
                            className={`text-sm font-medium ${
                              scannedCardData?.status === "active"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            Status:{" "}
                            {scannedCardData?.status === "active"
                              ? "âœ… Aktif"
                              : "âŒ Tidak Aktif"}
                          </p>
                          {/* <button
                            onClick={() => {
                              setScannedCardData(null);
                              setScannedCardUID("");
                            }}
                            className="text-sm text-green-600 underline mt-2"
                          >
                            Reset Input
                          </button> */}
                        </div>
                      </div>
                    </div>
                  }
                </>
              )}

              {/* Balance Information */}
              {scannedCardData && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {scannedCardData?.balance_points?.toLocaleString(
                        "id-ID",
                      ) || 0}{" "}
                      Points
                    </div>
                    <div className="text-sm text-blue-700">Saldo Tersedia</div>
                    <button
                      onClick={() => {
                        if (scannedCardUID) {
                          fetchCardHistory(scannedCardUID);
                          setShowHistoryPointModal(true);
                        }
                      }}
                      className="mx-auto mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <History className="h-5 w-5 mr-2" />
                      History Points
                    </button>
                    {scannedCardData?.is_helper_card && (
                      <button
                        onClick={resetPoints}
                        className="mx-auto mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="h-5 w-5 mr-2" />
                        Reset Points
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCheckBalanceModal(false);
                    setScannedCardUID("");
                    setScannedCardData(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPayAsYouGoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Aktivasi Kartu Pay-as-you-go
              </h2>

              {/* Card Scan Status */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="text-blue-600 pt-1">
                    <Play className="h-5 w-5" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-800">
                      Scan Kartu untuk Aktivasi
                    </h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Silakan scan kartu RFID yang akan digunakan untuk mode
                      pay-as-you-go.
                    </p>
                    {/* 
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        placeholder="Input UID kartu manual"
                        value={scannedCardUID}
                        onChange={(e) => setScannedCardUID(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (e.currentTarget.value.trim()) {
                              fetchCardData(e.currentTarget.value.trim());
                            }
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          if (scannedCardUID.trim()) {
                            fetchCardData(scannedCardUID.trim());
                          }
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                      >
                        Scan
                      </button>
                    </div> */}
                  </div>
                </div>
              </div>

              {/* Card Detected Status */}
              {scannedCardUID && scannedCardData && (
                <div
                  className={`border rounded-lg p-4 mb-4 ${
                    scannedCardData?.is_pay_as_you_go_card
                      ? "bg-green-50 border-green-200"
                      : "bg-yellow-50 border-yellow-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`pt-1 ${
                        scannedCardData?.is_pay_as_you_go_card
                          ? "text-green-600"
                          : "text-yellow-600"
                      }`}
                    >
                      {scannedCardData?.is_pay_as_you_go_card ? (
                        <svg
                          className="h-5 w-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3
                        className={`text-sm font-medium ${
                          scannedCardData?.is_pay_as_you_go_card
                            ? "text-green-800"
                            : "text-yellow-800"
                        }`}
                      >
                        {scannedCardData?.is_pay_as_you_go_card
                          ? "Kartu Pay-as-you-go Terdeteksi"
                          : "Kartu Bukan Tipe Pay-as-you-go"}
                      </h3>
                      <p
                        className={`text-sm mt-1 ${
                          scannedCardData?.is_pay_as_you_go_card
                            ? "text-green-700"
                            : "text-yellow-700"
                        }`}
                      >
                        UID: {scannedCardUID}
                      </p>
                      <p
                        className={`text-sm font-medium ${
                          scannedCardData?.status === "active"
                            ? scannedCardData?.is_pay_as_you_go_card
                              ? "text-green-600"
                              : "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        Status:{" "}
                        {scannedCardData?.status === "active"
                          ? "Aktif"
                          : "Tidak Aktif"}
                      </p>

                      {scannedCardData?.status === "active" &&
                        scannedCardData?.is_pay_as_you_go_card && (
                          <div className="mt-3 p-3 bg-white rounded border">
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-gray-700 mb-2">
                                Ringkasan Penggunaan Kartu
                              </div>

                              {payAsYouGoSummaryLoading ? (
                                <div className="text-xs text-gray-500 text-center py-2">
                                  Menghitung ringkasan penggunaan...
                                </div>
                              ) : payAsYouGoSummary ? (
                                <>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-gray-600">
                                        Total Durasi:
                                      </span>
                                      <div className="font-medium text-blue-600">
                                        {payAsYouGoSummary.totalMinutes} menit
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">
                                        Minimum Durasi:
                                      </span>
                                      <div className="font-medium text-orange-600">
                                        {payAsYouGoSummary.minimumMinutes} menit
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">
                                        Points Terpotong:
                                      </span>
                                      <div className="font-medium text-red-600">
                                        -
                                        {payAsYouGoSummary.totalPointsDeducted.toLocaleString(
                                          "id-ID",
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">
                                        Tarif Per Jam:
                                      </span>
                                      <div className="font-medium text-green-600">
                                        Rp{" "}
                                        {payAsYouGoSummary.hourlyRate.toLocaleString(
                                          "id-ID",
                                        )}
                                      </div>
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-gray-600">
                                        Biaya Harus Dibayar:
                                      </span>
                                      <div className="font-bold text-green-600 text-sm">
                                        Rp{" "}
                                        {payAsYouGoSummary.estimatedCost.toLocaleString(
                                          "id-ID",
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-xs text-gray-600 space-y-1 mt-2 pt-2 border-t">
                                    <div className="font-medium">
                                      Rule Pay-as-you-go:
                                    </div>
                                    <div>
                                      â€¢{" "}
                                      {payAsYouGoSummary.totalMinutes <
                                      payAsYouGoSummary.minimumMinutes
                                        ? `Durasi ${payAsYouGoSummary.totalMinutes} menit < minimum ${payAsYouGoSummary.minimumMinutes} menit â†’ bayar tarif penuh`
                                        : `Durasi ${payAsYouGoSummary.totalMinutes} menit â‰¥ minimum ${payAsYouGoSummary.minimumMinutes} menit â†’ bayar sesuai points terpotong`}
                                    </div>
                                    <div>
                                      â€¢ Klik "Bayar" untuk menyelesaikan
                                      pembayaran
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-gray-500 text-center py-2">
                                  Kartu belum pernah digunakan untuk bermain
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {scannedCardData?.status === "active" &&
                        !scannedCardData?.is_pay_as_you_go_card && (
                          <div className="mt-3 p-3 bg-yellow-100 rounded border border-yellow-300">
                            <p className="text-xs text-yellow-800 mb-2 font-medium">
                              Peringatan: Kartu ini bukan tipe Pay-as-you-go
                            </p>
                            <ul className="text-xs text-yellow-700 space-y-1">
                              <li>
                                â€¢ Kartu ini tidak dapat digunakan untuk mode
                                Pay-as-you-go
                              </li>
                              <li>
                                â€¢ Silakan gunakan kartu yang bertipe
                                Pay-as-you-go
                              </li>
                            </ul>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}

              {/* Error State */}
              {scannedCardUID && !scannedCardData && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="text-red-600 pt-1">
                      <svg
                        className="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-red-800">
                        Kartu Tidak Ditemukan
                      </h3>
                      <p className="text-sm text-red-700 mt-1">
                        UID {scannedCardUID} tidak terdaftar dalam sistem.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                {scannedCardData?.status === "active" &&
                  scannedCardData?.is_pay_as_you_go_card && (
                    <>
                      <button
                        onClick={async () => {
                          setPayAsYouGoProcessing(true);
                          try {
                            const [updateResult, deleteResult] =
                              await Promise.all([
                                supabase
                                  .from("rfid_cards")
                                  .update({
                                    balance_points: 100000,
                                    avg_nilai_point: 1,
                                    total_poin_ever: 100000,
                                    total_uang_ever: 100000,
                                  })
                                  .eq("uid", scannedCardUID),

                                supabase
                                  .from("card_usage_logs")
                                  .delete()
                                  .eq("card_uid", scannedCardUID),
                              ]);

                            if (updateResult.error) {
                              throw new Error(
                                `Gagal update saldo kartu: ${updateResult.error.message}`,
                              );
                            }

                            if (deleteResult.error) {
                              console.warn(
                                "Warning: Gagal menghapus logs kartu:",
                                deleteResult.error,
                              );
                            }

                            // setRentalType("pay-as-you-go");
                            // setActivatedPayAsYouGoCard(scannedCardUID);
                            setShowPayAsYouGoModal(false);
                            setScannedCardUID("");
                            setScannedCardData(null);
                            Swal.fire(
                              "Berhasil",
                              "Saldo kartu berhasil diset menjadi 100.000 dan logs lama dihapus",
                              "success",
                            );
                          } catch (error) {
                            console.error("Error setting card balance:", error);
                            Swal.fire(
                              "Gagal",
                              "Gagal mengatur saldo kartu",
                              "error",
                            );
                          } finally {
                            setPayAsYouGoProcessing(false);
                          }
                        }}
                        disabled={payAsYouGoProcessing}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                      >
                        {payAsYouGoProcessing
                          ? "Memproses..."
                          : "Aktivasi Kartu"}
                      </button>

                      <button
                        onClick={async () => {
                          setPayAsYouGoProcessing(true);
                          try {
                            // Ambil logs kartu untuk mendapatkan session terbaru
                            const { data: logs, error: logsError } =
                              await supabase
                                .from("card_usage_logs")
                                .select(
                                  "session_id, action_type, timestamp, points_amount",
                                )
                                .eq("card_uid", scannedCardUID)
                                .eq("action_type", "balance_deduct")
                                .order("timestamp", { ascending: true })
                                .limit(1);

                            if (logsError) throw logsError;

                            if (!logs || logs.length === 0) {
                              Swal.fire(
                                "Info",
                                "Tidak ada durasi main yang tercatat",
                                "info",
                              );
                              return;
                            }

                            const latestLog = logs[0];

                            // Ambil session details dari session terbaru
                            const { data: session, error: sessionError } =
                              await supabase
                                .from("rental_sessions")
                                .select(
                                  `
                                  id, console_id, start_time, end_time, duration_minutes,
                                  consoles(name, location, rate_profiles(hourly_rate, capital, minimum_minutes))
                                `,
                                )
                                .eq("id", latestLog.session_id)
                                .single();

                            if (sessionError || !session) {
                              Swal.fire(
                                "Error",
                                "Tidak dapat menemukan data session",
                                "error",
                              );
                              return;
                            }

                            // Hitung durasi berdasarkan session
                            const durationMinutes =
                              session.duration_minutes ??
                              (session.start_time
                                ? Math.ceil(
                                    (Date.now() -
                                      new Date(session.start_time).getTime()) /
                                      (1000 * 60),
                                  )
                                : 0);

                            if (durationMinutes === 0) {
                              Swal.fire(
                                "Info",
                                "Durasi main tidak dapat dihitung",
                                "info",
                              );
                              return;
                            }

                            // Gunakan hourly rate dan minimum minutes dari session
                            const hourlyRate =
                              session.consoles?.rate_profiles?.hourly_rate ??
                              50000;
                            const minimumMinutes =
                              session.consoles?.rate_profiles
                                ?.minimum_minutes ?? 60;

                            // Logika perhitungan biaya berdasarkan rule pay-as-you-go
                            let totalCost = 0;
                            if (durationMinutes < minimumMinutes) {
                              // Jika di bawah minimum, bayar hourly rate penuh
                              totalCost = hourlyRate;
                            } else {
                              // Jika sudah di atas minimum, bayar sesuai points yang sudah terpotong
                              totalCost = Math.abs(latestLog.points_amount);
                            }

                            // Buat session object untuk modal payment (sesuai format pay-as-you-go)
                            const paymentSession = {
                              ...session,
                              total_cost: totalCost,
                              payment_status: "pending" as const,
                            };

                            // Panggil modal payment seperti pay-as-you-go biasa
                            setShowPaymentModal({
                              session: paymentSession,
                              productsTotal: 0,
                            });
                            setPaymentAmount(totalCost);
                            setChangeAmount(0);
                          } catch (error) {
                            console.error("Error preparing payment:", error);
                            Swal.fire(
                              "Gagal",
                              "Gagal mempersiapkan pembayaran",
                              "error",
                            );
                          } finally {
                            setPayAsYouGoProcessing(false);
                          }
                        }}
                        disabled={payAsYouGoProcessing}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium transition-colors"
                      >
                        {payAsYouGoProcessing ? "Memproses..." : "Bayar"}
                      </button>
                    </>
                  )}

                {scannedCardData?.status === "active" &&
                  !scannedCardData?.is_pay_as_you_go_card && (
                    <div className="flex-1 px-4 py-2 text-center bg-gray-400 text-white rounded-lg font-medium cursor-not-allowed">
                      Kartu Tidak Valid
                    </div>
                  )}

                <button
                  onClick={() => {
                    setShowPayAsYouGoModal(false);
                    setScannedCardUID("");
                    setScannedCardData(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Point Modal */}
      {showHistoryPointModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold text-gray-900">
                  Riwayat Points - UID {scannedCardUID}
                </h2>
                <button
                  onClick={() => {
                    setShowHistoryPointModal(false);
                    setHistoryLogs([]);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Ã—
                </button>
              </div>
              {historyLoading ? (
                <div className="text-gray-500">Memuat riwayat...</div>
              ) : historyLogs.length === 0 ? (
                <div className="text-gray-500">
                  Tidak ada riwayat untuk kartu ini.
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-auto divide-y divide-gray-100">
                  {(() => {
                    // Filter logs penambahan dan group pemakaian
                    const addLogs = historyLogs.filter(
                      (log) => log.action_type === "balance_add",
                    );
                    const deductGrouped = groupDeductLogsBySession(historyLogs);

                    // Gabungkan dan urutkan semua logs
                    const combined = [
                      ...addLogs.map((log) => ({
                        type: "balance_add" as const,
                        id: log.id,
                        timestamp: log.timestamp,
                        points: log.points_amount,
                        notes: log.notes,
                        used_by_name: log.used_by_name,
                        balance_before: log.balance_before,
                        balance_after: log.balance_after,
                      })),
                      ...deductGrouped.map((g) => ({
                        type: "balance_deduct" as const,
                        session_id: g.session_id,
                        points: g.total_points,
                        timestamp: g.firstTimestamp,
                        balance_before: g.balance_before,
                        balance_after: g.balance_after,
                        notes: g.notes,
                      })),
                    ].sort(
                      (a, b) =>
                        new Date(b.timestamp).getTime() -
                        new Date(a.timestamp).getTime(),
                    );

                    if (combined.length === 0) {
                      return (
                        <div className="text-gray-500">
                          Tidak ada riwayat poin.
                        </div>
                      );
                    }

                    return combined.map((item) =>
                      item.type === "balance_add" ? (
                        <div
                          key={item.id}
                          className="py-3 flex items-start gap-3"
                        >
                          <div className="mt-1 w-2 h-2 rounded-full bg-green-500"></div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium text-gray-900">
                                Penambahan Poin
                              </div>
                              <div className="text-sm font-mono text-green-600">
                                +{item.points.toLocaleString()} points
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(item.timestamp).toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Saldo: {item.balance_before?.toLocaleString()} â†’{" "}
                              {item.balance_after?.toLocaleString()}
                            </div>
                            {item.notes && (
                              <div className="text-xs text-gray-700 mt-1">
                                {item.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div
                          key={item.session_id}
                          className="py-3 flex items-start gap-3"
                          title={`Sesi ID: ${item.session_id}`}
                        >
                          <div className="mt-1 w-2 h-2 rounded-full bg-red-500"></div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium text-gray-900">
                                Pemakaian Poin
                              </div>
                              <div className="text-sm font-mono text-red-600">
                                -{item.points.toLocaleString()} points
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(item.timestamp).toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Saldo: {item.balance_before?.toLocaleString()} â†’{" "}
                              {item.balance_after?.toLocaleString()}
                            </div>
                            {item.notes && (
                              <div className="text-xs text-gray-700 mt-1">
                                {item.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Console History Modal */}
      {showConsoleHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  History Console Hari Ini - {selectedConsoleForHistory}
                </h2>
                <button
                  onClick={() => setShowConsoleHistoryModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {loadingHistory ? (
                <div className="text-center py-8 text-gray-500">
                  Memuat data...
                </div>
              ) : consoleHistorySessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Tidak ada transaksi hari ini untuk console ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-3 py-2 border">Waktu Mulai</th>
                        <th className="px-3 py-2 border">Waktu Selesai</th>
                        <th className="px-3 py-2 border">UID Card</th>
                        <th className="px-3 py-2 border">Durasi</th>
                        <th className="px-3 py-2 border">Total</th>
                        <th className="px-3 py-2 border">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consoleHistorySessions.map((session) => {
                        const start = new Date(session.start_time);
                        const end = session.end_time
                          ? new Date(session.end_time)
                          : null;
                        const duration = end
                          ? Math.round(
                              (end.getTime() - start.getTime()) / 60000,
                            )
                          : null;
                        return (
                          <tr
                            key={session.id}
                            className={`border-b hover:bg-gray-50 ${
                              session.status === "cancelled"
                                ? "bg-red-100 text-red-700"
                                : ""
                            }`}
                          >
                            <td className="px-3 py-2 border font-mono">
                              <div className="flex items-center justify-between">
                                <span>
                                  {start.toLocaleString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "2-digit",
                                  })}
                                </span>
                                <button
                                  onClick={() => {
                                    const console = consoles.find(
                                      (c) => c.id === session.console_id,
                                    );
                                    if (console && session.start_time) {
                                      printRentalProof({
                                        customerName: "Customer",
                                        unitNumber: console.name,
                                        startTimestamp: new Date(
                                          session.start_time,
                                        ).toLocaleString("id-ID"),
                                        mode: session.duration_minutes
                                          ? "prepaid"
                                          : "pay-as-you-go",
                                      });
                                    }
                                  }}
                                  className="ml-2 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                                  title="Cetak bukti rental"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2 border font-mono">
                              {end
                                ? end.toLocaleString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "2-digit",
                                  })
                                : "-"}
                            </td>
                            <td className="px-3 py-2 border">
                              {session.card_uid || "-"}
                            </td>
                            <td className="px-3 py-2 border">
                              {duration !== null
                                ? `${Math.floor(duration / 60)}j ${
                                    duration % 60
                                  }m`
                                : "-"}
                            </td>
                            <td className="px-3 py-2 border">
                              {session.total_amount !== 0 ? (
                                <>
                                  Rp{" "}
                                  {session.total_amount.toLocaleString("id-ID")}
                                </>
                              ) : (
                                <>
                                  {session.total_points_deducted?.toLocaleString(
                                    "id-ID",
                                  )}{" "}
                                  points
                                </>
                              )}
                            </td>
                            <td className="px-3 py-2 border">
                              {session.status.toUpperCase()}
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

      {/* Search Voucher Modal */}
      {showVoucherModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Pilih Voucher
                </h2>
                <button
                  onClick={() => setShowVoucherModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <input
                  type="text"
                  value={voucherSearchTerm}
                  onChange={(e) => setVoucherSearchTerm(e.target.value)}
                  placeholder="Cari nama/kode voucher..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* List Voucher */}
              <div className="space-y-2">
                {(voucherList || [])
                  .filter((v: any) => {
                    const q = voucherSearchTerm.toLowerCase();
                    return (
                      (v.name || "").toLowerCase().includes(q) ||
                      (v.voucher_code || "").toLowerCase().includes(q)
                    );
                  })
                  .sort(
                    (a: any, b: any) =>
                      Number(a.voucher_price || 0) - Number(b.voucher_price || 0),
                  )
                  .map((v: any) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setSelectedVoucherId(v.id);
                        setShowVoucherModal(false);
                      }}
                      className={`w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition flex justify-between items-center ${
                        selectedVoucherId === v.id
                          ? "border-blue-500"
                          : "border-gray-300"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {v.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {v.voucher_code} = {v.total_points.toLocaleString("id-ID")} points
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-green-600">
                        Rp{" "}
                        {Number(v.voucher_price || 0).toLocaleString("id-ID")}
                      </div>
                    </button>
                  ))}
              </div>

              {/* Footer */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowVoucherModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    if (!selectedVoucherId) return;
                    setShowVoucherModal(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Gunakan Voucher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  History Active Rentals
                </h2>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              {/* Filter tanggal */}
              <form
                className="flex flex-wrap gap-4 mb-4 items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  setCurrentPage(1);
                  loadHistorySessions(historyStartDate, historyEndDate);
                }}
              >
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={historyStartDate}
                    onChange={(e) => setHistoryStartDate(e.target.value)}
                    className="border px-2 py-1 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={historyEndDate}
                    onChange={(e) => setHistoryEndDate(e.target.value)}
                    className="border px-2 py-1 rounded"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
                >
                  Filter
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300"
                  onClick={() => {
                    setHistoryStartDate("");
                    setHistoryEndDate("");
                    setCurrentPage(1);
                    loadHistorySessions();
                  }}
                >
                  Reset
                </button>
              </form>
              {loadingHistory ? (
                <div className="text-center py-8 text-gray-500">
                  Memuat data...
                </div>
              ) : historySessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Tidak ada history rental ditemukan.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-3 py-2 border">Waktu Mulai</th>
                          <th className="px-3 py-2 border">Waktu Selesai</th>
                          <th className="px-3 py-2 border">UID Card</th>
                          <th className="px-3 py-2 border">Console</th>
                          <th className="px-3 py-2 border">Durasi</th>
                          <th className="px-3 py-2 border">Total</th>
                          <th className="px-3 py-2 border">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historySessions.map((session) => {
                          const start = new Date(session.start_time);
                          const end = session.end_time
                            ? new Date(session.end_time)
                            : null;
                          const duration = end
                            ? Math.round(
                                (end.getTime() - start.getTime()) / 60000,
                              )
                            : null;
                          return (
                            <tr
                              key={session.id}
                              className={`border-b hover:bg-gray-50 ${
                                session.status === "cancelled"
                                  ? "bg-red-100 text-red-700"
                                  : ""
                              }`}
                            >
                              <td className="px-3 py-2 border font-mono">
                                <div className="flex items-center justify-between">
                                  <span>
                                    {start.toLocaleString("id-ID", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "2-digit",
                                    })}
                                  </span>
                                  <button
                                    onClick={() => {
                                      const console = consoles.find(
                                        (c) => c.id === session.console_id,
                                      );
                                      if (console && session.start_time) {
                                        printRentalProof({
                                          customerName: "Customer",
                                          unitNumber: console.name,
                                          startTimestamp: new Date(
                                            session.start_time,
                                          ).toLocaleString("id-ID"),
                                          mode: session.duration_minutes
                                            ? "prepaid"
                                            : "pay-as-you-go",
                                        });
                                      }
                                    }}
                                    className="ml-2 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                                    title="Cetak bukti rental"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-2 border font-mono">
                                {end
                                  ? end.toLocaleString("id-ID", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "2-digit",
                                    })
                                  : "-"}
                              </td>
                              <td className="px-3 py-2 border">
                                {session.card_uid || "-"}
                              </td>
                              <td className="px-3 py-2 border">
                                {session.consoles?.name || "-"}
                              </td>
                              <td className="px-3 py-2 border">
                                {duration !== null
                                  ? `${Math.floor(duration / 60)}j ${
                                      duration % 60
                                    }m`
                                  : "-"}
                              </td>
                              <td className="px-3 py-2 border">
                                {session.total_amount !== 0 ? (
                                  <>
                                    Rp{" "}
                                    {session.total_amount.toLocaleString(
                                      "id-ID",
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {session.total_points_deducted?.toLocaleString(
                                      "id-ID",
                                    )}{" "}
                                    points
                                  </>
                                )}
                              </td>
                              <td className="px-3 py-2 border">
                                {session.status.toUpperCase()}
                                {session.status !== "cancelled" &&
                                  session.status !== "completed" && (
                                    <button
                                      className="ml-2 px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                                      onClick={() =>
                                        setShowCancelModal({ session })
                                      }
                                    >
                                      Batal
                                    </button>
                                  )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination Controls */}
                  <div className="flex justify-between items-center mt-4">
                    <button
                      className="px-3 py-1 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300"
                      disabled={currentPage === 1}
                      onClick={() => {
                        if (currentPage > 1) {
                          setCurrentPage(currentPage - 1);
                        }
                      }}
                    >
                      Previous
                    </button>
                    <div className="flex gap-1 items-center">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => (
                          <button
                            key={page}
                            className={`px-2 py-1 rounded ${
                              page === currentPage
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-blue-100"
                            }`}
                            onClick={() => {
                              setCurrentPage(page);
                              loadHistorySessions(
                                historyStartDate,
                                historyEndDate,
                              );
                            }}
                            disabled={page === currentPage}
                          >
                            {page}
                          </button>
                        ),
                      )}
                    </div>
                    <button
                      className="px-3 py-1 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300"
                      disabled={currentPage === totalPages}
                      onClick={() => {
                        if (currentPage < totalPages) {
                          setCurrentPage(currentPage + 1);
                        }
                      }}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Tools Modal */}
      {showToolsModal ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Tools</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={debouncedRefreshConsoleStatuses}
                    disabled={isRefreshingStatuses}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      isRefreshingStatuses
                        ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                        : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    }`}
                    title="Refresh status console"
                  >
                    {isRefreshingStatuses ? (
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </div>
                    ) : (
                      "Refresh"
                    )}
                  </button>
                  <button
                    onClick={() => setShowToolsModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Perintah
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedCommand}
                    onChange={(e) => setSelectedCommand(e.target.value)}
                    className="flex-1 rounded-md border border-gray-200 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Pilih Perintah --</option>
                    <option value="Matikan TV">Matikan TV</option>
                    <option value="Nyalakan TV">Nyalakan TV</option>
                    <option value="Matikan Nomor">Matikan Nomor</option>
                    <option value="Nyalakan Nomor">Nyalakan Nomor</option>
                    <option value="Set volume TV">Set volume TV</option>
                    <option value="Set mute TV">Set mute TV</option>
                    <option value="Cek Status IP (Relay & TV)">Cek Status IP (Relay & TV)</option>
                  </select>

                  {selectedCommand === "Set volume TV" && (
                    <>
                      <div className="text-sm font-semibold text-slate-700 flex items-center">
                        Volume
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) =>
                          setVolume(Number(e.target.value) || 10)
                        }
                        className="w-20 px-3 py-2 border border-gray-200 rounded text-sm"
                        placeholder="0-100"
                      />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={runCommand}
                    className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                  >
                    Run
                  </button>
                </div>
              </div>

              <div className="py-4">
                <div className="grid grid-cols-6 gap-2 text-xs text-gray-500 font-medium mb-2">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      aria-label="select-all"
                      checked={
                        consoles.length > 0 &&
                        selectedConsoleIds.length === consoles.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedConsoleIds(consoles.map((c) => c.id));
                        } else {
                          setSelectedConsoleIds([]);
                        }
                      }}
                      className="form-checkbox h-4 w-4 text-indigo-600"
                    />
                  </div>
                  <div>Console</div>
                  <div className="text-center">TV</div>
                  <div className="text-center">Lampu</div>
                  <div className="text-center">Volume</div>
                  <div className="text-center">Protection</div>
                </div>
                <div className="border-b border-gray-200 mb-2" />
                <div className="max-h-64 overflow-y-auto">
                  {consoles.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      No consoles found.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {consoles
                        .slice()
                        .sort((a, b) => Number(a.name) - Number(b.name))
                        .map((c) => {
                          // Gunakan data real dari consoleStatuses atau fallback ke status console
                          const status = consoleStatuses[c.id] || {
                            tv: c.status === "rented",
                            lamp: c.status === "rented",
                            volume: 50,
                          };
                          return (
                            <div
                              key={c.id}
                              className="grid grid-cols-6 items-center gap-2 text-sm text-gray-800 border-b pb-1"
                            >
                              <div className="col-span-1 flex items-center justify-center">
                                <input
                                  aria-label={`select-${c.id}`}
                                  type="checkbox"
                                  checked={selectedConsoleIds.includes(c.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedConsoleIds((s) => [
                                        ...s,
                                        c.id,
                                      ]);
                                    } else {
                                      setSelectedConsoleIds((s) =>
                                        s.filter((id) => id !== c.id),
                                      );
                                    }
                                  }}
                                  className="form-checkbox h-4 w-4 text-indigo-600"
                                />
                              </div>
                              <div className="flex items-center gap-2 col-span-1">
                                <Gamepad2 className="h-4 w-4 text-gray-500" />
                                <span className="truncate">{c.name}</span>
                              </div>
                              <div className="col-span-1 flex items-center justify-center">
                                <button
                                  onClick={async (event) => {
                                    const button =
                                      event.currentTarget as HTMLButtonElement;
                                    const originalContent = button.innerHTML;

                                    try {
                                      // Konfirmasi sebelum menjalankan command
                                      const action = status.tv
                                        ? "mematikan"
                                        : "menyalakan";
                                      const result = await Swal.fire({
                                        title: `Konfirmasi`,
                                        text: `Apakah Anda yakin ingin ${action} TV untuk console ${c.name}?`,
                                        icon: "question",
                                        showCancelButton: true,
                                        confirmButtonText: "Ya",
                                        cancelButtonText: "Batal",
                                      });

                                      if (!result.isConfirmed) return;

                                      // Tampilkan loading state
                                      button.innerHTML =
                                        '<div class="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>';
                                      button.disabled = true;

                                      if (status.tv) {
                                        // Matikan TV
                                        if (c.power_tv_command) {
                                          await fetch(c.power_tv_command);
                                          // Refresh status setelah command
                                          setTimeout(() => {
                                            debouncedRefreshConsoleStatuses();
                                          }, 1000);
                                        }
                                      } else {
                                        // Nyalakan TV
                                        if (c.power_tv_command) {
                                          await fetch(c.power_tv_command);
                                          // Refresh status setelah command
                                          setTimeout(() => {
                                            debouncedRefreshConsoleStatuses();
                                          }, 1000);
                                        }
                                      }

                                      // Tampilkan sukses message
                                      Swal.fire({
                                        icon: "success",
                                        title: "Berhasil",
                                        text: `TV berhasil ${action}`,
                                        timer: 1500,
                                        showConfirmButton: false,
                                      });
                                    } catch (error) {
                                      console.error(
                                        "Error toggling TV:",
                                        error,
                                      );
                                      // Tampilkan error message
                                      Swal.fire({
                                        icon: "error",
                                        title: "Error",
                                        text: "Gagal mengubah status TV",
                                      });
                                    } finally {
                                      // Restore button state
                                      button.innerHTML = originalContent;
                                      button.disabled = false;
                                    }
                                  }}
                                  className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
                                  title={
                                    status.tv ? "Matikan TV" : "Nyalakan TV"
                                  }
                                  disabled={!c.power_tv_command}
                                >
                                  {status.tv ? (
                                    <Power className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Power className="h-4 w-4 text-red-600" />
                                  )}
                                </button>
                              </div>
                              <div className="col-span-1 flex items-center justify-center">
                                <button
                                  onClick={async (event) => {
                                    const button =
                                      event.currentTarget as HTMLButtonElement;
                                    const originalContent = button.innerHTML;

                                    try {
                                      // Konfirmasi sebelum menjalankan command
                                      const action = status.lamp
                                        ? "mematikan"
                                        : "menyalakan";
                                      const result = await Swal.fire({
                                        title: `Konfirmasi`,
                                        text: `Apakah Anda yakin ingin ${action} lampu untuk console ${c.name}?`,
                                        icon: "question",
                                        showCancelButton: true,
                                        confirmButtonText: "Ya",
                                        cancelButtonText: "Batal",
                                      });

                                      if (!result.isConfirmed) return;

                                      // Tampilkan loading state
                                      button.innerHTML =
                                        '<div class="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>';
                                      button.disabled = true;

                                      if (status.lamp) {
                                        // Matikan lampu
                                        if (c.relay_command_off) {
                                          await fetch(c.relay_command_off);
                                          // Refresh status setelah command
                                          setTimeout(() => {
                                            debouncedRefreshConsoleStatuses();
                                          }, 1000);
                                        }
                                      } else {
                                        // Nyalakan lampu
                                        if (c.relay_command_on) {
                                          await fetch(c.relay_command_on);
                                          // Refresh status setelah command
                                          setTimeout(() => {
                                            debouncedRefreshConsoleStatuses();
                                          }, 1000);
                                        }
                                      }

                                      // Tampilkan sukses message
                                      Swal.fire({
                                        icon: "success",
                                        title: "Berhasil",
                                        text: `Lampu berhasil ${action}`,
                                        timer: 1500,
                                        showConfirmButton: false,
                                      });
                                    } catch (error) {
                                      console.error(
                                        "Error toggling lamp:",
                                        error,
                                      );
                                      // Tampilkan error message
                                      Swal.fire({
                                        icon: "error",
                                        title: "Error",
                                        text: "Gagal mengubah status lampu",
                                      });
                                    } finally {
                                      // Restore button state
                                      button.innerHTML = originalContent;
                                      button.disabled = false;
                                    }
                                  }}
                                  className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
                                  title={
                                    status.lamp
                                      ? "Matikan Lampu"
                                      : "Nyalakan Lampu"
                                  }
                                  disabled={
                                    !c.relay_command_on && !c.relay_command_off
                                  }
                                >
                                  {status.lamp ? (
                                    <Lightbulb className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Lightbulb className="h-4 w-4 text-red-600" />
                                  )}
                                </button>
                              </div>
                              <div className="col-span-1 flex items-center justify-center gap-2">
                                {status.volume > 0 ? (
                                  <Volume className="h-4 w-4 text-green-600" />
                                ) : (
                                  <VolumeX className="h-4 w-4 text-red-600" />
                                )}
                                <span className="text-sm text-gray-600">
                                  / {status.volume}
                                </span>
                              </div>
                              <div className="col-span-1 flex items-center justify-center">
                                {c.auto_shutdown_enabled ? (
                                  <Lock className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Unlock className="h-4 w-4 text-red-600" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <button
                  onClick={() => setShowToolsModal(false)}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Console Grid */}
      {viewMode === "simple" ? (
        <div className="space-y-6">
          {(() => {
            // Group consoles by location

            const groupedConsoles = filteredConsoles.reduce(
              (acc, console) => {
                const location = console.location || "Lantai 1";
                if (!acc[location]) {
                  acc[location] = [];
                }
                acc[location].push(console);
                return acc;
              },
              {} as Record<string, typeof filteredConsoles>,
            );

            const sortedLocations = Object.keys(groupedConsoles).sort(
              (a, b) => {
                if (a === "Lantai 1") return -1;
                if (b === "Lantai 1") return 1;
                if (a === "Lantai 2") return -1;
                if (b === "Lantai 2") return 1;
                return a.localeCompare(b);
              },
            );

            return (
              <>
                {sortedLocations.map((location) => {
                  const locationConsoles = groupedConsoles[location].sort(
                    (a, b) => {
                      const sa = activeSessions.find(
                        (s) => s.console_id === a.id,
                      );
                      const sb = activeSessions.find(
                        (s) => s.console_id === b.id,
                      );

                      // Fungsi untuk menghitung sisa waktu prepaid
                      const getRemainingTime = (session: any) => {
                        if (
                          !session ||
                          !session.duration_minutes ||
                          !session.start_time
                        ) {
                          return Number.POSITIVE_INFINITY;
                        }
                        return Math.max(
                          0,
                          Number(session.duration_minutes) * 60 -
                            Math.floor(
                              (Date.now() -
                                new Date(session.start_time).getTime()) /
                                1000,
                            ),
                        );
                      };

                      // Fungsi untuk menghitung durasi play-as-you-go
                      const getElapsedTime = (session: any) => {
                        if (
                          !session ||
                          session.duration_minutes ||
                          !session.start_time
                        ) {
                          return 0;
                        }
                        return Math.floor(
                          (Date.now() -
                            new Date(session.start_time).getTime()) /
                            1000,
                        );
                      };

                      // Kategorisasi konsol
                      const getCategory = (console: any, session: any) => {
                        if (!session) return 0; // Available console
                        if (session.duration_minutes) return 1; // Prepaid console
                        return 2; // Pay-as-you-go console
                      };

                      const catA = getCategory(a, sa);
                      const catB = getCategory(b, sb);

                      // Sort by category first (0: available, 1: prepaid, 2: pay-as-you-go)
                      if (catA !== catB) {
                        return catA - catB;
                      }

                      // Within same category, sort differently
                      if (catA === 0) {
                        // Available consoles: sort by name
                        return a.name.localeCompare(b.name, "id", {
                          numeric: true,
                        });
                      } else if (catA === 1) {
                        // Prepaid consoles: sort by remaining time (ascending - least time first)
                        const remA = getRemainingTime(sa);
                        const remB = getRemainingTime(sb);
                        if (remA !== remB) return remA - remB;
                        return a.name.localeCompare(b.name, "id", {
                          numeric: true,
                        });
                      } else {
                        // Pay-as-you-go consoles: sort by elapsed time (descending - longest play first)
                        const elapsedA = getElapsedTime(sa);
                        const elapsedB = getElapsedTime(sb);
                        if (elapsedA !== elapsedB) return elapsedB - elapsedA; // Note: reversed for descending
                        return a.name.localeCompare(b.name, "id", {
                          numeric: true,
                        });
                      }
                    },
                  );

                  return (
                    <div key={location}>
                      {/* Location Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 h-px bg-gray-300"></div>
                        <h3 className="text-lg font-semibold text-gray-700 px-4 py-2 bg-gray-100 rounded-lg">
                          {location}
                        </h3>
                        <div className="flex-1 h-px bg-gray-300"></div>
                      </div>

                      {/* Console Grid for this location */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {locationConsoles.map((console) => {
                          const isActive = console.status === "rented";
                          const activeSession = activeSessions.find(
                            (s) => s.console_id === console.id,
                          );
                          const rateProfile = getConsoleRateProfile(console.id);
                          return (
                            <div
                              key={console.id}
                              className={`rounded-lg shadow border text-xs p-2 flex flex-col items-stretch min-w-0 ${
                                console.status === "available"
                                  ? "border-green-200 bg-white"
                                  : console.status === "rented"
                                    ? "border-blue-200 bg-white"
                                    : "border-red-200 bg-white"
                              }`}
                              style={{ minWidth: 0 }}
                            >
                              {/* Header */}
                              <div
                                className={`flex items-center gap-1 px-2 py-1 rounded-t-lg 
                                  ${getConsoleColorByRate(console)}
                                 text-white`}
                                style={{ fontSize: "0.95em" }}
                              >
                                <Gamepad2 className="h-4 w-4" />
                                <span className="font-semibold truncate">
                                  {console.name}
                                </span>
                                {console.location && (
                                  <span className="text-[10px] opacity-80 ml-auto">
                                    {console.location}
                                  </span>
                                )}
                              </div>

                              {/* Body */}
                              <div className="flex-1 flex flex-col gap-1 p-2">
                                {/* Tarif & Status */}
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-500 flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    {rateProfile
                                      ? rateProfile.hourly_rate.toLocaleString(
                                          "id-ID",
                                        )
                                      : "0"}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        console.status === "available"
                                          ? "bg-green-500 text-white"
                                          : console.status === "rented"
                                            ? "bg-blue-500 text-white"
                                            : "bg-red-500 text-white"
                                      }`}
                                    >
                                      {console.status === "available"
                                        ? "READY"
                                        : console.status === "rented"
                                          ? "ACTIVE"
                                          : "MAINT."}
                                    </span>
                                    {(consoleAutoShutdownStates[console.id] ??
                                    console.auto_shutdown_enabled) ? (
                                      <Lock className="h-4 w-4 text-green-700" />
                                    ) : (
                                      <Unlock className="h-4 w-4 text-red-700" />
                                    )}
                                      <div className="flex gap-1">
                                        <button
                                          className="rounded-md p-1 hover:bg-gray-100 transition-colors"
                                          onClick={() =>
                                            handleOpenGameSearch(console.id)
                                          }
                                          title="Cari game di console ini"
                                        >
                                          <Gamepad2 className="h-4 w-4 text-blue-600" />
                                        </button>
                                        {activeSession?.is_voucher_used && (
                                          <button
                                            className="rounded-md p-1"
                                            onClick={async () => {
                                              setScannedCardUID(
                                                activeSession.card_uid!,
                                              );
                                              await fetchCardHistory(
                                                activeSession.card_uid!,
                                              );
                                              setShowHistoryPointModal(true);
                                            }}
                                          >
                                            <Info className="h-4 w-4 text-gray-600" />
                                          </button>
                                        )}
                                        <button
                                          className="rounded-md p-1"
                                          onClick={async () => {
                                            setSelectedConsoleForHistory(
                                              console.name,
                                            );
                                            await loadConsoleHistoryToday(
                                              console.id,
                                            );
                                            setShowConsoleHistoryModal(true);
                                          }}
                                        >
                                          <History className="h-4 w-4 text-blue-600" />
                                        </button>
                                      </div>
                                  </div>
                                </div>

                                {/* Active Session Info (simple) */}
                                {isActive && activeSession && (
                                  <div className="mt-1 mb-1 p-1 bg-blue-50 rounded border border-blue-100 flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                      <User className="h-3 w-3 text-blue-600" />
                                      <span className="truncate font-semibold text-blue-800">
                                        {activeSession.customers?.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px]">
                                      <Clock className="h-3 w-3 text-purple-600 animate-pulse" />
                                      <Countdown
                                        sessionId={activeSession.id}
                                        startTimeMs={new Date(
                                          activeSession.start_time,
                                        ).getTime()}
                                        endTimeMs={
                                          activeSession.duration_minutes
                                            ? new Date(
                                                activeSession.start_time,
                                              ).getTime() +
                                              activeSession.duration_minutes *
                                                60 *
                                                1000
                                            : null
                                        }
                                        isPrepaid={
                                          !!activeSession.duration_minutes
                                        }
                                        onComplete={() => {}}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px]">
                                      <span>
                                        {activeSession.is_voucher_used ? (
                                          <>
                                            <RealtimeCost
                                              session={activeSession}
                                            />{" "}
                                            Points
                                          </>
                                        ) : (
                                          <>
                                            Rp{" "}
                                            <RealtimeCost
                                              session={activeSession}
                                            />
                                          </>
                                        )}
                                      </span>
                                      <span
                                        className={`ml-auto font-bold text-[10px] px-2 py-0.5 rounded-full ${
                                          activeSession.duration_minutes
                                            ? "bg-purple-100 text-purple-700 border border-purple-300"
                                            : activeSession.is_voucher_used
                                              ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                                              : "bg-green-100 text-green-700 border border-green-300"
                                        }`}
                                      >
                                        {activeSession.duration_minutes
                                          ? "BAYAR DIMUKA"
                                          : activeSession.is_voucher_used
                                            ? "MEMBER CARD"
                                            : "PAY AS YOU GO"}
                                      </span>
                                    </div>
                                    {/* Status Relay dan power tv command */}
                                  </div>
                                )}

                                {/* Info Mode Persiapan */}
                                {preparationMode[console.id]?.isActive && (
                                  <div className="w-full text-[15px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1 mb-1">
                                    Mode persiapan akan berakhir pada:
                                    <span className="ml-1 font-semibold">
                                      {new Date(
                                        preparationMode[console.id]!.endAtMs,
                                      ).toLocaleTimeString("id-ID", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                )}

                                {/* Action Buttons  */}
                                <div className="flex gap-1 mt-auto">
                                  {console.status === "available" ? (
                                    <button
                                      onClick={() => {
                                        if (!ensureCashierActive()) return;
                                        setShowStartRentalModal(console.id);
                                      }}
                                      disabled={
                                        preparationMode[console.id]?.isActive
                                      }
                                      className={`flex-1 py-1 rounded flex items-center justify-center text-xs ${
                                        preparationMode[console.id]?.isActive
                                          ? "bg-gray-400 cursor-not-allowed text-gray-200"
                                          : "bg-green-600 hover:bg-green-700 text-white"
                                      }`}
                                      title={
                                        preparationMode[console.id]?.isActive
                                          ? "Console sedang dalam mode persiapan"
                                          : "Start Rental"
                                      }
                                    >
                                      <Play className="h-4 w-4" />
                                    </button>
                                  ) : activeSession ? (
                                    <>
                                      {/* Tombol Pause/Resume */}
                                      {/* {activeSession.status === "paused" ? (
                            <button
                              onClick={() =>
                                handleResumeSession(activeSession.id)
                              }
                              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1 rounded flex items-center justify-center text-xs"
                              title="Resume Session (Listrik Kembali)"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handlePauseSession(activeSession.id)
                              }
                              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-1 rounded flex items-center justify-center text-xs"
                              title="Pause Session (Mati Lampu)"
                            >
                              <Pause className="h-4 w-4" />
                            </button>
                          )} */}

                                      {/* Tombol Add Time */}
                                      {activeSession?.duration_minutes && (
                                        <button
                                          onClick={() => {
                                            if (!ensureCashierActive()) return;
                                            const rateProfile =
                                              getConsoleRateProfile(console.id);
                                            setShowAddTimeModal({
                                              session: activeSession,
                                              console: console,
                                              currentDuration:
                                                activeSession.duration_minutes,
                                              hourlyRate:
                                                rateProfile?.hourly_rate || 0,
                                            });
                                          }}
                                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-1 rounded flex items-center justify-center text-xs"
                                          title="Tambah Waktu"
                                        >
                                          <Plus className="h-4 w-4" />
                                        </button>
                                      )}

                                      {/* Tombol End Rental */}
                                      <button
                                        onClick={() =>
                                          handleEndSession(activeSession.id)
                                        }
                                        className={`flex-1 bg-red-600 hover:bg-red-700 text-white py-1 rounded flex items-center justify-center text-xs ${
                                          endingSessionIds.has(activeSession.id)
                                            ? "opacity-60 cursor-not-allowed"
                                            : ""
                                        }`}
                                        title="End Rental"
                                        disabled={endingSessionIds.has(
                                          activeSession.id,
                                        )}
                                      >
                                        <Square className="h-4 w-4" />
                                      </button>

                                      {/* Tombol Move */}
                                      <button
                                        onClick={() => {
                                          if (!ensureCashierActive()) return;
                                          setShowMoveModal({
                                            sessionId: activeSession.id,
                                            fromConsoleId: console.id,
                                          });
                                        }}
                                        className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-1 rounded flex items-center justify-center text-xs"
                                        title="Pindah Unit"
                                      >
                                        <ArrowRightLeft className="h-4 w-4" />
                                      </button>
                                    </>
                                  ) : console.status === "maintenance" ? (
                                    <button
                                      disabled
                                      className="flex-1 bg-gray-400 text-white py-1 rounded flex items-center justify-center text-xs cursor-not-allowed"
                                      title="In Maintenance"
                                    >
                                      <Wrench className="h-4 w-4" />
                                    </button>
                                  ) : null}

                                  {/* Tombol Tes TV */}
                                  <button
                                    onClick={async () => {
                                      if (console.power_tv_command) {
                                        try {
                                          const response = await fetch(
                                            console.power_tv_command,
                                          );
                                          if (response.ok) {
                                            Swal.fire(
                                              "Tes TV",
                                              "Perintah power ON dikirim ke TV.",
                                              "success",
                                            );
                                          } else {
                                            const text = await response.text();
                                            console.error(
                                              "Tes TV error:",
                                              response.status,
                                              text,
                                            );
                                            Swal.fire(
                                              "Tes TV",
                                              `Gagal mengirim perintah ke TV. Status: ${response.status}`,
                                              "error",
                                            );
                                          }
                                        } catch (err) {
                                          console.error(
                                            "Tes TV fetch error:",
                                            err,
                                          );
                                          Swal.fire(
                                            "Tes TV",
                                            "Gagal mengirim perintah ke TV (fetch error).",
                                            "error",
                                          );
                                        }
                                      } else {
                                        Swal.fire(
                                          "Tes TV",
                                          "Perintah power ON tidak tersedia.",
                                          "info",
                                        );
                                      }
                                    }}
                                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-1 rounded flex items-center justify-center text-xs"
                                    title="Tes TV (Power ON)"
                                  >
                                    <Power className="h-4 w-4" />
                                  </button>

                                  {/* Tombol Tambah Saldo (member-card) */}
                                  {activeSession &&
                                    activeSession.status === "active" &&
                                    activeSession.is_voucher_used &&
                                    activeSession.card_uid && (
                                      <button
                                        onClick={async () => {
                                          if (!ensureCashierActive()) return;
                                          try {
                                            setSelectedVoucherId("");
                                            setVoucherQuantity(1);
                                            setScannedCardUID(
                                              activeSession.card_uid!,
                                            );
                                            await fetchCardData(
                                              activeSession.card_uid!,
                                            );
                                            setShowSellVoucherModal(true);
                                          } catch (e) {
                                            window.console.error(
                                              "Open Sell Voucher error:",
                                              e,
                                            );
                                            Swal.fire(
                                              "Error",
                                              "Gagal membuka penjualan voucher",
                                              "error",
                                            );
                                          }
                                        }}
                                        className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-1 rounded flex items-center justify-center text-xs"
                                        title="Tambah Saldo Points"
                                      >
                                        <CreditCard className="h-4 w-4" />
                                      </button>
                                    )}

                                  {/* Tombol Add Products - hanya tampil jika console rented */}
                                  {activeSession &&
                                    console.status === "rented" &&
                                    !activeSession.duration_minutes &&
                                    !activeSession.is_voucher_used && (
                                      <button
                                        onClick={() => {
                                          if (!ensureCashierActive()) return;
                                          if (
                                            console.status === "rented" &&
                                            activeSession &&
                                            activeSession.status === "active" &&
                                            !activeSession?.duration_minutes &&
                                            !activeSession.is_voucher_used
                                          ) {
                                            setShowProductModal(
                                              activeSession.id,
                                            );
                                          } else {
                                            Swal.fire(
                                              "Info",
                                              "Konsol harus dalam status aktif untuk menambahkan produk",
                                              "info",
                                            );
                                          }
                                        }}
                                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-1 rounded flex items-center justify-center text-xs"
                                        title="Add Products"
                                      >
                                        <ShoppingCart className="h-4 w-4" />
                                      </button>
                                    )}

                                  {/* Tombol Persiapan / Berhenti Persiapan */}
                                  {console.status !== "rented" &&
                                    (preparationMode[console.id]?.isActive ? (
                                      <button
                                        onClick={() =>
                                          handleStopPreparationManual(console)
                                        }
                                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1 rounded flex items-center justify-center text-xs"
                                        title="Berhenti Persiapan"
                                      >
                                        <Square className="h-4 w-4" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() =>
                                          handleSingleConsolePersiapan(console)
                                        }
                                        className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-1 rounded flex items-center justify-center text-xs"
                                        title="Mode Persiapan"
                                      >
                                        <Clock className="h-4 w-4" />
                                      </button>
                                    ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      ) : viewMode === "list" ? (
        // LIST MODE: Tampilkan dalam bentuk list
        <div className="divide-y divide-gray-200">
          {(consoleFilter === "all"
            ? consoles
            : consoles.filter((c) => c.status === consoleFilter)
          )
            .filter((c) =>
              c.name.toLowerCase().includes(searchConsole.toLowerCase()),
            )
            .sort((a, b) => {
              const sa = activeSessions.find((s) => s.console_id === a.id);
              const sb = activeSessions.find((s) => s.console_id === b.id);

              // Fungsi untuk menghitung sisa waktu prepaid
              const getRemainingTime = (session: any) => {
                if (
                  !session ||
                  !session.duration_minutes ||
                  !session.start_time
                ) {
                  return Number.POSITIVE_INFINITY;
                }
                return Math.max(
                  0,
                  Number(session.duration_minutes) * 60 -
                    Math.floor(
                      (Date.now() - new Date(session.start_time).getTime()) /
                        1000,
                    ),
                );
              };

              // Fungsi untuk menghitung durasi play-as-you-go
              const getElapsedTime = (session: any) => {
                if (
                  !session ||
                  session.duration_minutes ||
                  !session.start_time
                ) {
                  return 0;
                }
                return Math.floor(
                  (Date.now() - new Date(session.start_time).getTime()) / 1000,
                );
              };

              // Kategorisasi konsol
              const getCategory = (console: any, session: any) => {
                if (!session) return 0; // Available console
                if (session.duration_minutes) return 1; // Prepaid console
                return 2; // Pay-as-you-go console
              };

              const catA = getCategory(a, sa);
              const catB = getCategory(b, sb);

              // Sort by category first (0: available, 1: prepaid, 2: pay-as-you-go)
              if (catA !== catB) {
                return catA - catB;
              }

              // Within same category, sort differently
              if (catA === 0) {
                // Available consoles: sort by name
                return a.name.localeCompare(b.name, "id", { numeric: true });
              } else if (catA === 1) {
                // Prepaid consoles: sort by remaining time (ascending - least time first)
                const remA = getRemainingTime(sa);
                const remB = getRemainingTime(sb);
                if (remA !== remB) return remA - remB;
                return a.name.localeCompare(b.name, "id", { numeric: true });
              } else {
                // Pay-as-you-go consoles: sort by elapsed time (descending - longest play first)
                const elapsedA = getElapsedTime(sa);
                const elapsedB = getElapsedTime(sb);
                if (elapsedA !== elapsedB) return elapsedB - elapsedA; // Note: reversed for descending
                return a.name.localeCompare(b.name, "id", { numeric: true });
              }
            })
            .map((console) => {
              // const isActive = console.status === "rented";
              const activeSession = activeSessions.find(
                (s) => s.console_id === console.id,
              );
              const rateProfile = getConsoleRateProfile(console.id);
              return (
                <div
                  key={console.id}
                  className={`py-4 px-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
                    console.status === "available"
                      ? "bg-green-50"
                      : console.status === "rented"
                        ? "bg-blue-50"
                        : "bg-red-50"
                  } rounded-lg transition-all`}
                >
                  {/* Left: Status & Console Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          console.status === "available"
                            ? "bg-green-500"
                            : console.status === "rented"
                              ? "bg-blue-500"
                              : "bg-red-500"
                        }`}
                      ></div>
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {console.name}
                      </h3>
                      {console.auto_shutdown_enabled ? (
                        <Lock className="h-4 w-4 text-green-700" />
                      ) : (
                        <Unlock className="h-4 w-4 text-red-700" />
                      )}
                      <div className="flex gap-1">
                        <button
                          className="rounded-md p-1 hover:bg-gray-100 transition-colors"
                          onClick={() => handleOpenGameSearch(console.id)}
                          title="Cari game di console ini"
                        >
                          <Gamepad2 className="h-4 w-4 text-blue-600" />
                        </button>
                        {activeSession?.is_voucher_used && (
                          <button
                            className="rounded-md p-1"
                            onClick={async () => {
                              setScannedCardUID(activeSession.card_uid!);
                              await fetchCardHistory(activeSession.card_uid!);
                              setShowHistoryPointModal(true);
                            }}
                          >
                            <Info className="h-4 w-4 text-gray-600" />
                          </button>
                        )}
                        <button
                          className="rounded-md p-1"
                          onClick={async () => {
                            setSelectedConsoleForHistory(console.name);
                            await loadConsoleHistoryToday(console.id);
                            setShowConsoleHistoryModal(true);
                          }}
                        >
                          <History className="h-4 w-4 text-blue-600" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 flex flex-wrap gap-4">
                      <div className="flex items-center gap-1">
                        <Gamepad2 className="h-4 w-4 text-gray-500" />
                        <span>{console.equipment_type_id}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-gray-500" />
                        <span>
                          {rateProfile
                            ? rateProfile.hourly_rate.toLocaleString("id-ID")
                            : "0"}
                          /jam
                        </span>
                      </div>
                      {console.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span>{console.location}</span>
                        </div>
                      )}
                      {activeSession?.duration_minutes && (
                        <div className="flex items-center gap-1 text-[13px]">
                          <Clock className="h-3 w-3 text-purple-600 animate-pulse" />
                          <Countdown
                            sessionId={activeSession?.id}
                            startTimeMs={new Date(
                              activeSession?.start_time,
                            ).getTime()}
                            endTimeMs={
                              activeSession?.duration_minutes
                                ? new Date(
                                    activeSession?.start_time,
                                  ).getTime() +
                                  activeSession?.duration_minutes * 60 * 1000
                                : null
                            }
                            isPrepaid={!!activeSession?.duration_minutes}
                            onComplete={() => {}}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Action & Status */}
                  <div className="shrink-0">
                    {activeSession ? (
                      <div className="flex flex-col items-end">
                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold rounded-full py-1 px-3 mb-2 border ${
                            activeSession.duration_minutes
                              ? "bg-purple-100 text-purple-800 border-purple-300"
                              : activeSession.is_voucher_used
                                ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                : "bg-green-100 text-green-800 border-green-300"
                          }`}
                        >
                          {activeSession.duration_minutes
                            ? "BAYAR DIMUKA"
                            : activeSession.is_voucher_used
                              ? "MEMBER CARD"
                              : "PAY AS YOU GO"}
                        </span>

                        {/* Action Button */}
                        <div className="flex gap-2">
                          {/* Pause/Resume */}
                          {/* {activeSession.status !== "paused" ? (
                            <button
                              onClick={() =>
                                handlePauseSession(activeSession.id)
                              }
                              className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                              title="Pause Rental"
                            >
                              <Pause className="h-5 w-5" />
                              Pause Sesi
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEndSession(activeSession.id)}
                              className={`bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${endingSessionIds.has(activeSession.id) ? "opacity-60 cursor-not-allowed" : ""}`}
                              title="Resume Session"
                              disabled={endingSessionIds.has(activeSession.id)}
                            >
                              <Play className="h-5 w-5" />
                              Resume Sesi
                            </button>
                          )} */}

                          {/* Tombol Add Time */}
                          {activeSession?.duration_minutes && (
                            <button
                              onClick={() => {
                                if (!ensureCashierActive()) return;
                                const rateProfile = getConsoleRateProfile(
                                  console.id,
                                );
                                setShowAddTimeModal({
                                  session: activeSession,
                                  console: console,
                                  currentDuration:
                                    activeSession.duration_minutes,
                                  hourlyRate: rateProfile?.hourly_rate || 0,
                                });
                              }}
                              className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                              title="Tambah Waktu"
                            >
                              <Plus className="h-5 w-5" />
                              Tambah Waktu
                            </button>
                          )}
                          <button
                            onClick={() => handleEndSession(activeSession.id)}
                            className={`bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                              endingSessionIds.has(activeSession.id)
                                ? "opacity-60 cursor-not-allowed"
                                : ""
                            }`}
                            title="Akhiri Sesi"
                            disabled={endingSessionIds.has(activeSession.id)}
                          >
                            <Square className="h-5 w-5" />
                            Akhiri Sesi
                          </button>

                          {/* Pindah Sesi */}
                          <button
                            onClick={() => {
                              if (!ensureCashierActive()) return;
                              setShowMoveModal({
                                sessionId: activeSession.id,
                                fromConsoleId: console.id,
                              });
                            }}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                            title="Pindah Unit"
                          >
                            <ArrowRightLeft className="h-5 w-5" />
                            Pindah
                          </button>

                          {/* Tombol Tambah Saldo (member-card) */}
                          {activeSession &&
                            activeSession.status === "active" &&
                            activeSession.is_voucher_used &&
                            activeSession.card_uid && (
                              <button
                                onClick={async () => {
                                  if (!ensureCashierActive()) return;
                                  try {
                                    setSelectedVoucherId("");
                                    setVoucherQuantity(1);
                                    setScannedCardUID(activeSession.card_uid!);
                                    await fetchCardData(
                                      activeSession.card_uid!,
                                    );
                                    setShowSellVoucherModal(true);
                                  } catch (e) {
                                    window.console.error(
                                      "Open Sell Voucher error:",
                                      e,
                                    );
                                    Swal.fire(
                                      "Error",
                                      "Gagal membuka penjualan voucher",
                                      "error",
                                    );
                                  }
                                }}
                                className="bg-teal-500 hover:bg-teal-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                                title="Tambah Saldo Points"
                              >
                                <CreditCard className="h-5 w-5" />
                                Jual Voucher
                              </button>
                            )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 w-full">
                        {preparationMode[console.id]?.isActive && (
                          <div className="w-full text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                            Mode persiapan akan berakhir pada:
                            <span className="ml-1 font-semibold">
                              {new Date(
                                preparationMode[console.id]!.endAtMs,
                              ).toLocaleString("id-ID")}
                            </span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (!ensureCashierActive()) return;
                              setShowStartRentalModal(console.id);
                            }}
                            disabled={preparationMode[console.id]?.isActive}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                              preparationMode[console.id]?.isActive
                                ? "bg-gray-400 cursor-not-allowed text-gray-200"
                                : "bg-green-600 hover:bg-green-700 text-white"
                            }`}
                            title={
                              preparationMode[console.id]?.isActive
                                ? "Console sedang dalam mode persiapan"
                                : "Mulai Rental"
                            }
                          >
                            <Play className="h-5 w-5" />
                            Mulai Rental
                          </button>

                          {/* Persiapan Button */}
                          {console.status !== "rented" &&
                          preparationMode[console.id]?.isActive ? (
                            <button
                              onClick={() =>
                                handleStopPreparationManual(console)
                              }
                              className="bg-purple-500 hover:bg-purple-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                            >
                              <Square className="h-5 w-5" />
                              Stop Persiapan
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handleSingleConsolePersiapan(console)
                              }
                              className="bg-purple-500 hover:bg-purple-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                            >
                              <Clock className="h-5 w-5" />
                              Mode Persiapan
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        // DETAIL MODE: Card besar (seperti sebelumnya)
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(consoleFilter === "all"
            ? consoles
            : consoles.filter((c) => c.status === consoleFilter)
          )
            .filter((c) =>
              c.name.toLowerCase().includes(searchConsole.toLowerCase()),
            )
            .sort((a, b) => {
              const sa = activeSessions.find((s) => s.console_id === a.id);
              const sb = activeSessions.find((s) => s.console_id === b.id);

              // Fungsi untuk menghitung sisa waktu prepaid
              const getRemainingTime = (session: any) => {
                if (
                  !session ||
                  !session.duration_minutes ||
                  !session.start_time
                ) {
                  return Number.POSITIVE_INFINITY;
                }
                return Math.max(
                  0,
                  Number(session.duration_minutes) * 60 -
                    Math.floor(
                      (Date.now() - new Date(session.start_time).getTime()) /
                        1000,
                    ),
                );
              };

              // Fungsi untuk menghitung durasi play-as-you-go
              const getElapsedTime = (session: any) => {
                if (
                  !session ||
                  session.duration_minutes ||
                  !session.start_time
                ) {
                  return 0;
                }
                return Math.floor(
                  (Date.now() - new Date(session.start_time).getTime()) / 1000,
                );
              };

              // Kategorisasi konsol
              const getCategory = (console: any, session: any) => {
                if (!session) return 0; // Available console
                if (session.duration_minutes) return 1; // Prepaid console
                return 2; // Pay-as-you-go console
              };

              const catA = getCategory(a, sa);
              const catB = getCategory(b, sb);

              // Sort by category first (0: available, 1: prepaid, 2: pay-as-you-go)
              if (catA !== catB) {
                return catA - catB;
              }

              // Within same category, sort differently
              if (catA === 0) {
                // Available consoles: sort by name
                return a.name.localeCompare(b.name, "id", { numeric: true });
              } else if (catA === 1) {
                // Prepaid consoles: sort by remaining time (ascending - least time first)
                const remA = getRemainingTime(sa);
                const remB = getRemainingTime(sb);
                if (remA !== remB) return remA - remB;
                return a.name.localeCompare(b.name, "id", { numeric: true });
              } else {
                // Pay-as-you-go consoles: sort by elapsed time (descending - longest play first)
                const elapsedA = getElapsedTime(sa);
                const elapsedB = getElapsedTime(sb);
                if (elapsedA !== elapsedB) return elapsedB - elapsedA; // Note: reversed for descending
                return a.name.localeCompare(b.name, "id", { numeric: true });
              }
            })
            .map((console) => {
              const isActive = console.status === "rented";
              const activeSession = activeSessions.find(
                (s) => s.console_id === console.id,
              );
              const rateProfile = getConsoleRateProfile(console.id);
              return (
                <div
                  key={console.id}
                  className={`rounded-xl overflow-hidden shadow-sm border ${
                    console.status === "available"
                      ? "border-green-200 bg-white"
                      : console.status === "rented"
                        ? "border-blue-200 bg-white"
                        : "border-red-200 bg-white"
                  }`}
                >
                  {/* Header */}
                  <div
                    className={`p-4 
                      ${getConsoleColorByRate(console)}
                    } text-white`}
                  >
                    <div className="flex items-center gap-3 justify-between">
                      <div className="flex items-center gap-3">
                        <Gamepad2 className="h-6 w-6" />
                        <h3 className="font-semibold text-lg">
                          {console.name}
                        </h3>
                        {console.location && (
                          <span className="text-sm opacity-80">
                            {console.location}
                          </span>
                        )}
                        {console.auto_shutdown_enabled ? (
                          <Lock className="h-4 w-4 " />
                        ) : (
                          <Unlock className="h-4 w-4" />
                        )}
                      </div>
                      {/* Total Rp. */}
                      {console.status === "rented" && activeSession && (
                        <div className="text-right">
                          <div className="text-xs font-semibold opacity-80">
                            Total
                          </div>
                          <div className="text-lg font-bold">
                            {/* Rp{" "}
                            <RealtimeCost
                              session={activeSession}
                              productsTotal={
                                productsTotalMap[activeSession.id] || 0
                              }
                            /> */}
                            {activeSession.is_voucher_used ? (
                              <>
                                <RealtimeCost session={activeSession} /> Points
                              </>
                            ) : (
                              <>
                                Rp <RealtimeCost session={activeSession} />
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          activeSession?.status === "active"
                            ? "bg-green-500 text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {/* {console.status === "available"
                          ? "AVAILABLE"
                          : console.status === "rented"
                          ? "ACTIVE"
                          : "MAINTENANCE"} */}
                        {activeSession?.status === "active"
                          ? "ACTIVE"
                          : "READY"}
                      </span>
                      {/* {console.location && (
                        <span className="text-sm opacity-80">
                          {console.location}
                        </span>
                      )} */}
                      <div className="flex gap-1">
                        <button
                          className="rounded-md p-1 hover:bg-white/10 transition-colors"
                          onClick={() => handleOpenGameSearch(console.id)}
                          title="Cari game di console ini"
                        >
                          <Gamepad2 className="h-5 w-5 text-white" />
                        </button>
                        {activeSession?.is_voucher_used && (
                          <button
                            className="rounded-md p-1"
                            onClick={async () => {
                              setScannedCardUID(activeSession.card_uid!);
                              await fetchCardHistory(activeSession.card_uid!);
                              setShowHistoryPointModal(true);
                            }}
                          >
                            <Info className="h-5 w-5 text-white-600" />
                          </button>
                        )}
                        <button
                          className="rounded-md p-1"
                          onClick={async () => {
                            setSelectedConsoleForHistory(console.name);
                            await loadConsoleHistoryToday(console.id);
                            setShowConsoleHistoryModal(true);
                          }}
                        >
                          <History className="h-5 w-5 text-white-600" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    {/* Active Session Info */}
                    {isActive && activeSession && (
                      <div
                        className={`mb-4 p-3 rounded-lg border ${
                          activeSession.duration_minutes
                            ? "bg-purple-50 border-purple-100"
                            : activeSession.is_voucher_used
                              ? "bg-yellow-50 border-yellow-100"
                              : "bg-green-50 border-green-100"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-blue-800">
                              {activeSession.customers?.name}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${
                              activeSession.duration_minutes
                                ? "bg-purple-100 text-purple-800 border-purple-300"
                                : activeSession.is_voucher_used
                                  ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                  : "bg-green-100 text-green-800 border-green-300"
                            }`}
                          >
                            {activeSession.duration_minutes
                              ? "BAYAR DIMUKA"
                              : activeSession.is_voucher_used
                                ? "MEMBER CARD"
                                : "PAY AS YOU GO"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-blue-600">Mulai:</span>
                            <p className="font-medium">
                              {new Date(
                                activeSession.start_time,
                              ).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div>
                            <span className="text-blue-600">Durasi:</span>
                            <p className="font-medium">
                              {activeSession.duration_minutes ? (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-purple-600 animate-pulse" />
                                  <span className="font-bold text-purple-700">
                                    {/* {formatCountdown(
                                      countdownTimers[activeSession.id] || 0
                                    )}
                                    tersisa */}
                                    <Countdown
                                      sessionId={activeSession.id}
                                      startTimeMs={new Date(
                                        activeSession.start_time,
                                      ).getTime()}
                                      endTimeMs={
                                        activeSession.duration_minutes
                                          ? new Date(
                                              activeSession.start_time,
                                            ).getTime() +
                                            activeSession.duration_minutes *
                                              60 *
                                              1000
                                          : null
                                      }
                                      isPrepaid={
                                        !!activeSession.duration_minutes
                                      }
                                      onComplete={() => {}}
                                    />
                                    <span className="ml-1">tersisa</span>
                                  </span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-green-600 animate-pulse" />
                                  <span className="font-bold text-green-700">
                                    {/* {formatElapsedHMS(activeSession.start_time)} */}
                                    <Countdown
                                      sessionId={activeSession.id}
                                      startTimeMs={new Date(
                                        activeSession.start_time,
                                      ).getTime()}
                                      endTimeMs={
                                        activeSession.duration_minutes
                                          ? new Date(
                                              activeSession.start_time,
                                            ).getTime() +
                                            activeSession.duration_minutes *
                                              60 *
                                              1000
                                          : null
                                      }
                                      isPrepaid={
                                        !!activeSession.duration_minutes
                                      }
                                      onComplete={() => {}}
                                    />
                                  </span>
                                </span>
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="text-blue-600">Biaya:</span>
                            <p className="font-medium">
                              {activeSession.is_voucher_used ? (
                                <>
                                  <RealtimeCost session={activeSession} />{" "}
                                  Points
                                </>
                              ) : (
                                <>
                                  Rp <RealtimeCost session={activeSession} />
                                </>
                              )}
                            </p>
                            <span className="text-blue-600">Status:</span>
                            <p className="font-medium">
                              {activeSession.payment_status.toUpperCase()}
                            </p>
                          </div>
                          <div>
                            <span className="text-blue-600">Total Produk:</span>
                            <p className="font-medium">
                              Rp{" "}
                              {productsTotalMap[
                                activeSession.id
                              ]?.toLocaleString("id-ID") ?? "0"}
                            </p>
                            <span className="text-blue-600">
                              Tarif per Jam{" "}
                            </span>
                            <p className="font-medium">
                              Rp{" "}
                              {rateProfile
                                ? rateProfile.hourly_rate.toLocaleString(
                                    "id-ID",
                                  )
                                : "0"}
                            </p>
                          </div>
                        </div>

                        {/* Live Timer Display */}
                        {/* <div className="mt-2 pt-2 border-t border-blue-200">
                          <div className="text-center font-mono text-lg font-bold text-blue-700">
                            {activeSession.duration_minutes
                              ? formatCountdownHMS(
                                  countdownSeconds[activeSession.id] ?? 0
                                )
                              : formatElapsedHMS(activeSession.start_time)}
                          </div>
                        </div> */}

                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <div className="text-center font-mono text-lg font-bold text-blue-700">
                            <Countdown
                              sessionId={activeSession.id}
                              startTimeMs={new Date(
                                activeSession.start_time,
                              ).getTime()}
                              endTimeMs={
                                activeSession.duration_minutes
                                  ? new Date(
                                      activeSession.start_time,
                                    ).getTime() +
                                    activeSession.duration_minutes * 60 * 1000
                                  : null
                              }
                              isPrepaid={!!activeSession.duration_minutes}
                              onComplete={() => {}}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Info Mode Persiapan (Detail card) */}
                    {preparationMode[console.id]?.isActive && (
                      <div className="w-full text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1 mb-2">
                        Mode persiapan akan berakhir pada:
                        <span className="ml-1 font-semibold">
                          {new Date(
                            preparationMode[console.id]!.endAtMs,
                          ).toLocaleString("id-ID")}
                        </span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-1">
                      {console.status === "available" ? (
                        <>
                          <button
                            onClick={() => {
                              if (!ensureCashierActive()) return;
                              setShowStartRentalModal(console.id);
                            }}
                            disabled={preparationMode[console.id]?.isActive}
                            className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                              preparationMode[console.id]?.isActive
                                ? "bg-gray-400 cursor-not-allowed text-gray-200"
                                : "bg-green-600 hover:bg-green-700 text-white"
                            }`}
                            title={
                              preparationMode[console.id]?.isActive
                                ? "Console sedang dalam mode persiapan"
                                : "Start Rental"
                            }
                          >
                            <Play className="h-5 w-5" />
                            Start Rental
                          </button>

                          {/* Persiapan Button / Berhenti Persiapan */}
                          {preparationMode[console.id]?.isActive ? (
                            <button
                              onClick={() =>
                                handleStopPreparationManual(console)
                              }
                              className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              <Square className="h-5 w-5" />
                              Berhenti Persiapan
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handleSingleConsolePersiapan(console)
                              }
                              className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              <Clock className="h-5 w-5" />
                              Mode Persiapan
                            </button>
                          )}
                        </>
                      ) : console.status === "rented" && activeSession ? (
                        <>
                          {/* Tombol Pause/Resume */}
                          {/* {activeSession.status !== "paused" ? (
                          <button
                            onClick={() => handlePauseSession(activeSession.id)}
                            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mb-2"
                          >
                            <Pause className="h-5 w-5" />
                            Pause Sesi
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleResumeSession(activeSession.id)
                            }
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mb-2"
                          >
                            <Play className="h-5 w-5" />
                            Resume Sesi
                          </button>
                        )} */}

                          {/* Tombol Add Time */}
                          {activeSession?.duration_minutes && (
                            <button
                              onClick={() => {
                                if (!ensureCashierActive()) return;
                                const rateProfile = getConsoleRateProfile(
                                  console.id,
                                );
                                setShowAddTimeModal({
                                  session: activeSession,
                                  console: console,
                                  currentDuration:
                                    activeSession.duration_minutes,
                                  hourlyRate: rateProfile?.hourly_rate || 0,
                                });
                              }}
                              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mb-2"
                              title="Tambah Waktu"
                            >
                              <Plus className="h-5 w-5" />
                              Tambah Waktu
                            </button>
                          )}

                          {/* Tombol Tambah Saldo (member-card) */}
                          {activeSession &&
                            activeSession.status === "active" &&
                            activeSession.is_voucher_used &&
                            activeSession.card_uid && (
                              <button
                                onClick={async () => {
                                  if (!ensureCashierActive()) return;
                                  try {
                                    setSelectedVoucherId("");
                                    setVoucherQuantity(1);
                                    setScannedCardUID(activeSession.card_uid!);
                                    await fetchCardData(
                                      activeSession.card_uid!,
                                    );
                                    setShowSellVoucherModal(true);
                                  } catch (e) {
                                    window.console.error(
                                      "Open Sell Voucher error:",
                                      e,
                                    );
                                    Swal.fire(
                                      "Error",
                                      "Gagal membuka penjualan voucher",
                                      "error",
                                    );
                                  }
                                }}
                                className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mb-2"
                                title="Tambah Saldo Points"
                              >
                                <CreditCard className="h-5 w-5" />
                                Jual Voucher
                              </button>
                            )}

                          <button
                            onClick={() => handleEndSession(activeSession.id)}
                            className={`w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mb-2 ${
                              endingSessionIds.has(activeSession.id)
                                ? "opacity-60 cursor-not-allowed"
                                : ""
                            }`}
                            disabled={endingSessionIds.has(activeSession.id)}
                          >
                            <Square className="h-5 w-5" />
                            End Rental
                          </button>
                          <button
                            onClick={() => {
                              if (!ensureCashierActive()) return;
                              setShowMoveModal({
                                sessionId: activeSession.id,
                                fromConsoleId: console.id,
                              });
                            }}
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mb-2"
                            title="Pindah Unit"
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                            Pindah Unit
                          </button>
                        </>
                      ) : (
                        <button
                          disabled
                          className="w-full bg-gray-400 text-white py-3 rounded-lg font-medium mb-2 cursor-not-allowed"
                        >
                          <Wrench className="h-5 w-5 inline mr-2" />
                          In Maintenance
                        </button>
                      )}
                    </div>

                    {/* Add Products Button - hanya tampil jika console rented */}
                    {activeSession &&
                      console.status === "rented" &&
                      !activeSession.duration_minutes &&
                      !activeSession.is_voucher_used && (
                        <button
                          onClick={() => {
                            if (!ensureCashierActive()) return;
                            if (console.status === "rented" && activeSession) {
                              setShowProductModal(activeSession.id);
                            } else {
                              Swal.fire(
                                "Info",
                                "Konsol harus dalam status aktif untuk menambahkan produk",
                                "info",
                              );
                            }
                          }}
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <ShoppingCart className="h-5 w-5" />
                          Add Products
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* No Consoles */}
      {consoles.length === 0 && (
        <div className="text-center py-12">
          <Gamepad2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Consoles Found
          </h3>
          <p className="text-gray-600">
            Add consoles to start managing rentals
          </p>
        </div>
      )}

      {/* Modal Pindah Unit */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Pindah Unit</h2>
                <button
                  onClick={() => setShowMoveModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Tutup"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              {(() => {
                const session = activeSessions.find(
                  (s) => s.id === showMoveModal.sessionId,
                );
                const from = consoles.find(
                  (c) => c.id === showMoveModal.fromConsoleId,
                );
                const targets = consoles.filter(
                  (c) =>
                    c.status === "available" &&
                    c.id !== showMoveModal.fromConsoleId &&
                    c.equipment_type_id === from?.equipment_type_id,
                );
                return (
                  <>
                    <div className="mb-4 text-sm text-gray-700 space-y-1">
                      <div className="flex justify-between">
                        <span>Customer:</span>
                        <span className="font-medium">
                          {session?.customers?.name ?? "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Dari Unit:</span>
                        <span className="font-medium">
                          {from?.name}{" "}
                          {from?.location ? `(${from.location})` : ""}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Jenis:</span>
                        <span className="font-medium">
                          {session?.duration_minutes
                            ? "Bayar Dimuka"
                            : "Pay As You Go"}
                        </span>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pindah ke Unit
                      </label>
                      <select
                        value={moveTargetConsoleId}
                        onChange={(e) => setMoveTargetConsoleId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">-- Pilih Unit Tersedia --</option>
                        {targets.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.location ? `- ${c.location}` : ""}
                          </option>
                        ))}
                      </select>
                      {targets.length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Tidak ada unit yang tersedia saat ini.
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={() => setShowMoveModal(null)}
                        className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                        disabled={isMovingSession}
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleConfirmMoveSession}
                        className={`flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-colors ${
                          !moveTargetConsoleId || isMovingSession
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                        disabled={!moveTargetConsoleId || isMovingSession}
                      >
                        Pindah
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {/* Start Rental Modal */}
      {/* Timer pengecekan Console Information DIHENTIKAN jika pauseConsoleInfoCheck true */}
      {/* ...rest of the code... */}
      {showStartRentalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl mx-4">
            <div className="p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Start New Rental
              </h2>

              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Waktu Mulai Rental
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={rentalStartTime}
                      onChange={(e) => setRentalStartTime(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                        setRentalStartTime(d.toISOString().slice(0, 16));
                      }}
                      className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg border border-blue-300 text-sm font-medium"
                      title="Set ke waktu saat ini"
                    >
                      Sekarang
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jenis Rental
                  </label>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => setRentalType("pay-as-you-go")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                        rentalType === "pay-as-you-go"
                          ? "bg-green-50 border-green-500 text-green-700"
                          : "bg-white border-gray-300 text-gray-700"
                      }`}
                    >
                      <Clock className="h-5 w-5" />
                      <span className="font-medium">Pay As You Go</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRentalType("prepaid")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                        rentalType === "prepaid"
                          ? "bg-green-50 border-green-500 text-green-700"
                          : "bg-white border-gray-300 text-gray-700"
                      }`}
                    >
                      <DollarSign className="h-5 w-5" />
                      <span className="font-medium">Bayar Dimuka</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRentalType("member-card")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                        rentalType === "member-card"
                          ? "bg-green-50 border-green-500 text-green-700"
                          : "bg-white border-gray-300 text-gray-700"
                      }`}
                    >
                      <CreditCard className="h-5 w-5" />
                      <span className="font-medium">Member Card</span>
                    </button>
                  </div>

                  {rentalType === "prepaid" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Durasi Rental
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          value={rentalDurationHours}
                          onChange={(e) => {
                            const val = Math.max(
                              0,
                              parseInt(e.target.value) || 0,
                            );
                            setRentalDurationHours(val);
                          }}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Jam"
                        />
                        <span className="self-center">jam</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={rentalDurationMinutes}
                          onChange={(e) => {
                            let val = Math.max(
                              0,
                              Math.min(59, parseInt(e.target.value) || 0),
                            );
                            setRentalDurationMinutes(val);
                          }}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Menit"
                        />
                        <span className="self-center">menit</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Jam dan menit akan digabung sebagai total durasi.
                      </p>

                      {/* Button Beli Paket */}
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!showStartRentalModal) return;
                            await fetchAvailablePackages(showStartRentalModal);
                            setShowPackageModal(true);
                          }}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          <ShoppingCart className="h-4 w-4" />
                          Beli Paket
                        </button>
                        <p className="text-xs text-gray-500 mt-1 text-center">
                          Pilih paket dengan harga dan durasi yang sudah
                          ditentukan
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Member Card Mode */}
                  {rentalType === "member-card" && (
                    <div>
                      {scannedCardData ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-blue-800">
                            Kartu: {scannedCardData.uid}
                          </p>
                          <p className="text-sm font-medium text-blue-800">
                            Sisa Balance: {scannedCardData?.balance_points}{" "}
                            points
                          </p>
                          {/* {(() => {
                            const cardBalance =
                              scannedCardData?.balance_points ?? 0;
                            const consoleRateProfile =
                              selectedConsole?.rate_profile_id
                                ? rateProfiles.find(
                                    (r) =>
                                      r.id === selectedConsole.rate_profile_id
                                  )
                                : null;
                            const hourlyRate =
                              consoleRateProfile?.hourly_rate ?? 0;

                            return cardBalance < hourlyRate ? (
                              <p className="text-sm text-red-600 mt-2">
                                âš ï¸ Kurang points - Balance tidak cukup untuk
                                minimal waktu rental
                              </p>
                            ) : null;
                          })()} */}
                          <p className="text-xs text-blue-600 mt-1">
                            Points akan otomatis dipotong dari balance saat sesi
                            diakhiri. Sisa balance akan tetap tersimpan.
                          </p>
                          <button
                            onClick={() => {
                              setScannedCardUID("");
                              setScannedCardData(null);
                            }}
                            className="text-xs text-red-600 underline mt-1"
                          >
                            Reset Kartu
                          </button>
                        </div>
                      ) : (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm text-yellow-800">
                            Silakan tempelkan kartu RFID untuk menggunakan
                            member card mode.
                          </p>
                          <p className="text-xs text-yellow-600 mt-1">
                            Kartu akan otomatis terdeteksi saat di-tempel.
                          </p>
                        </div>
                        // <div className="flex flex-col gap-2">
                        //   <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        //     <p className="text-sm text-yellow-800">
                        //       Silakan scan kartu RFID atau masukkan UID manual.
                        //     </p>
                        //     <input
                        //       type="text"
                        //       placeholder="Input UID kartu manual"
                        //       value={scannedCardUID}
                        //       onChange={(e) =>
                        //         setScannedCardUID(e.target.value)
                        //       }
                        //       onKeyDown={(e) => {
                        //         if (e.key === "Enter") {
                        //           e.preventDefault();
                        //         }
                        //       }}
                        //       className="mt-2 px-3 py-2 border border-gray-300 rounded-lg"
                        //     />
                        //     <p className="text-xs text-yellow-600 mt-1">
                        //       Kartu akan otomatis terdeteksi saat di-scan
                        //     </p>
                        //   </div>
                        //   {/* <button
                        //     type="button"
                        //     onClick={() => {
                        //       if (scannedCardUID.trim()) {
                        //         fetchCardData(scannedCardUID.trim());
                        //       }
                        //     }}
                        //     className="mt-2 px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                        //   >
                        //     Cek Kartu
                        //   </button> */}
                        // </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Console Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Console:</span>
                      <span className="font-medium">
                        {selectedConsole?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Location:</span>
                      <span className="font-medium">
                        {selectedConsole?.location || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hourly Rate:</span>
                      <span className="font-medium">
                        Rp{" "}
                        {selectedConsole?.rate_profile_id
                          ? (rateProfiles
                              .find(
                                (r) => r.id === selectedConsole.rate_profile_id,
                              )
                              ?.hourly_rate.toLocaleString("id-ID") ?? "0")
                          : "0"}
                        /jam
                      </span>
                    </div>
                    {/* Status TV & Relay */}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status TV:</span>
                      <span className="font-medium flex items-center gap-2">
                        {/* Metode pembacaan status TV dan relay disamakan */}
                        {tvStatusJson ? (
                          <span>
                            {(() => {
                              try {
                                const obj =
                                  typeof tvStatusJson === "string"
                                    ? JSON.parse(tvStatusJson)
                                    : tvStatusJson;
                                const status =
                                  typeof obj === "object" &&
                                  obj !== null &&
                                  "status" in obj
                                    ? obj.status
                                    : undefined;
                                if (typeof status === "string") {
                                  return status.trim().toUpperCase() === "ON"
                                    ? "ON"
                                    : "OFF";
                                }
                                return "-";
                              } catch {
                                return "-";
                              }
                            })()}
                          </span>
                        ) : (
                          <span>-</span>
                        )}
                        {selectedConsole?.perintah_cek_power_tv && (
                          <>
                            <button
                              type="button"
                              className="ml-2 px-2 py-0.5 text-xs rounded bg-gray-200 hover:bg-gray-300 border border-gray-300 text-gray-700"
                              onClick={() => {
                                Swal.fire(
                                  "Isi Perintah perintah_cek_power_tv",
                                  `<pre style='text-align:left'>${selectedConsole.perintah_cek_power_tv}</pre>`,
                                  "info",
                                );
                              }}
                            >
                              Lihat
                            </button>
                            <button
                              type="button"
                              className="ml-1 px-2 py-0.5 text-xs rounded bg-blue-200 hover:bg-blue-300 border border-blue-300 text-blue-700"
                              title="Refresh Status TV"
                              onClick={async () => {
                                if (selectedConsole?.perintah_cek_power_tv) {
                                  try {
                                    const res = await fetch(
                                      selectedConsole.perintah_cek_power_tv,
                                    );
                                    const data = await res.json();
                                    setTvStatusJson(data);
                                  } catch (err) {
                                    setTvStatusJson("-");
                                  }
                                }
                              }}
                            >
                              &#x21bb;
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status Relay:</span>
                      <span className="font-medium flex items-center gap-2">
                        {/* Metode pembacaan status relay sesuai output baru */}
                        {relayStatus ? (
                          <span>
                            {(() => {
                              try {
                                // Jika respons langsung 'ON' atau 'OFF'
                                if (typeof relayStatus === "string") {
                                  const trimmed = relayStatus
                                    .trim()
                                    .toUpperCase();
                                  if (trimmed === "ON" || trimmed === "OFF") {
                                    return trimmed;
                                  }
                                  // Coba parse JSON jika bukan string ON/OFF
                                  const obj = JSON.parse(relayStatus);
                                  if (
                                    typeof obj === "object" &&
                                    obj !== null &&
                                    "POWER" in obj &&
                                    typeof obj.POWER === "string"
                                  ) {
                                    const power =
                                      obj.POWER.trim().toUpperCase();
                                    if (power === "ON" || power === "OFF") {
                                      return power;
                                    }
                                  }
                                }
                                // Jika relayStatus sudah object
                                if (
                                  typeof relayStatus === "object" &&
                                  relayStatus !== null &&
                                  "POWER" in relayStatus &&
                                  typeof relayStatus.POWER === "string"
                                ) {
                                  const power =
                                    relayStatus.POWER.trim().toUpperCase();
                                  if (power === "ON" || power === "OFF") {
                                    return power;
                                  }
                                }
                                return "-";
                              } catch {
                                return "-";
                              }
                            })()}
                          </span>
                        ) : (
                          <span>-</span>
                        )}
                        {selectedConsole?.relay_command_status && (
                          <>
                            <button
                              type="button"
                              className="ml-2 px-2 py-0.5 text-xs rounded bg-gray-200 hover:bg-gray-300 border border-gray-300 text-gray-700"
                              onClick={() => {
                                Swal.fire(
                                  "Isi Perintah relay_command_status",
                                  `<pre style='text-align:left'>${selectedConsole.relay_command_status}</pre>`,
                                  "info",
                                );
                              }}
                            >
                              Lihat
                            </button>
                            <button
                              type="button"
                              className="ml-1 px-2 py-0.5 text-xs rounded bg-blue-200 hover:bg-blue-300 border border-blue-300 text-blue-700"
                              title="Refresh Status Relay"
                              onClick={async () => {
                                if (selectedConsole?.relay_command_status) {
                                  try {
                                    const res = await fetch(
                                      selectedConsole.relay_command_status,
                                    );
                                    const data = await res.json();
                                    setRelayStatus(data);
                                  } catch (err) {
                                    setRelayStatus("-");
                                  }
                                }
                              }}
                            >
                              &#x21bb;
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                    {/* Power TV Command */}
                    <div className="flex justify-between">
                      <span className="text-gray-600">power tv command:</span>
                      <span className="font-medium break-all">
                        {selectedConsole?.power_tv_command || (
                          <span className="italic text-gray-400">
                            (tidak ada)
                          </span>
                        )}
                      </span>
                    </div>
                    {/* Tombol Reset Status hanya muncul jika status TV atau Relay ON */}
                    {(() => {
                      // Cek status TV
                      let tvOn = false;
                      try {
                        if (tvStatusJson) {
                          const obj =
                            typeof tvStatusJson === "string"
                              ? JSON.parse(tvStatusJson)
                              : tvStatusJson;
                          const status =
                            typeof obj === "object" &&
                            obj !== null &&
                            "status" in obj
                              ? obj.status
                              : undefined;
                          if (typeof status === "string") {
                            tvOn = status.trim().toUpperCase() === "ON";
                          }
                        }
                      } catch {}
                      // Cek status relay
                      let relayOn = false;
                      try {
                        if (relayStatus) {
                          if (typeof relayStatus === "string") {
                            const trimmed = relayStatus.trim().toUpperCase();
                            if (trimmed === "ON") relayOn = true;
                            else if (trimmed !== "OFF") {
                              const obj = JSON.parse(relayStatus);
                              if (
                                typeof obj === "object" &&
                                obj !== null &&
                                "POWER" in obj &&
                                typeof obj.POWER === "string"
                              ) {
                                relayOn =
                                  obj.POWER.trim().toUpperCase() === "ON";
                              }
                            }
                          } else if (
                            typeof relayStatus === "object" &&
                            relayStatus !== null &&
                            "POWER" in (relayStatus as any) &&
                            typeof (relayStatus as any).POWER === "string"
                          ) {
                            relayOn =
                              (
                                relayStatus as any
                              ).POWER.trim().toUpperCase() === "ON";
                          }
                        }
                      } catch {}
                      if (!tvOn && !relayOn) return null;
                      return (
                        <div className="flex justify-center mt-6">
                          <button
                            type="button"
                            className="px-4 py-2 rounded bg-red-100 hover:bg-red-200 border border-red-300 text-red-700 font-semibold shadow-sm"
                            onClick={async () => {
                              // Matikan TV jika ON
                              if (tvOn && selectedConsole?.power_tv_command) {
                                try {
                                  await fetch(selectedConsole.power_tv_command);
                                } catch {}
                              }
                              // Matikan relay jika ON
                              if (
                                relayOn &&
                                selectedConsole?.relay_command_off
                              ) {
                                try {
                                  await fetch(
                                    selectedConsole.relay_command_off,
                                  );
                                } catch {}
                              }
                              // Refresh status TV
                              if (selectedConsole?.perintah_cek_power_tv) {
                                try {
                                  const res = await fetch(
                                    selectedConsole.perintah_cek_power_tv,
                                  );
                                  const data = await res.json();
                                  setTvStatusJson(data);
                                } catch {
                                  setTvStatusJson("-");
                                }
                              }
                              // Refresh status relay
                              if (selectedConsole?.relay_command_status) {
                                try {
                                  const res = await fetch(
                                    selectedConsole.relay_command_status,
                                  );
                                  const data = await res.json();
                                  setRelayStatus(data);
                                } catch {
                                  setRelayStatus("-");
                                }
                              }
                            }}
                          >
                            Reset Status
                          </button>
                        </div>
                      );
                    })()}
                    {rentalType === "prepaid" && (
                      <div className="flex justify-between border-t border-gray-200 pt-2 mt-2 font-medium">
                        <span className="text-gray-800">
                          Total ({rentalDurationHours} jam{" "}
                          {rentalDurationMinutes} menit):
                        </span>
                        <span className="text-green-600">
                          {(() => {
                            const hourlyRate = selectedConsole?.rate_profile_id
                              ? (rateProfiles.find(
                                  (r) =>
                                    r.id === selectedConsole.rate_profile_id,
                                )?.hourly_rate ?? 0)
                              : 0;
                            const totalDurationMinutes =
                              rentalDurationHours * 60 + rentalDurationMinutes;
                            let totalAmount = 0;
                            if (totalDurationMinutes <= 60) {
                              totalAmount = hourlyRate;
                            } else {
                              const extraMinutes = totalDurationMinutes - 60;
                              const perMinuteRate = hourlyRate / 60;
                              totalAmount =
                                hourlyRate +
                                Math.round(extraMinutes * perMinuteRate);
                            }
                            return `Rp ${totalAmount.toLocaleString("id-ID")}`;
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </form>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowStartRentalModal(null);
                    setScannedCardUID("");
                    setScannedCardData(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleStartRental(showStartRentalModal)}
                  className={`flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors ${
                    startRentalLoading ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  disabled={startRentalLoading}
                >
                  {startRentalLoading
                    ? rentalType === "prepaid"
                      ? "Memproses..."
                      : "Memulai..."
                    : rentalType === "prepaid"
                      ? "Bayar"
                      : "Mulai Rental"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex">
            {/* Product List */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Select Products
                </h2>
                <button
                  onClick={() => {
                    setShowProductModal(null);
                    clearCart();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Produk Sudah Ditambahkan (Pending Payment) */}
              {billingProducts.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-md font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Produk Sudah Ditambahkan (Pending Payment)
                  </h3>
                  <div className="space-y-2">
                    {billingProducts.map((prod, idx) => (
                      <div
                        key={prod.product_id || idx}
                        className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2"
                      >
                        <div>
                          <span className="font-medium text-gray-900">
                            {prod.product_name}
                          </span>
                          <span className="ml-2 text-xs text-gray-500">
                            x{prod.quantity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-yellow-700">
                            Rp {prod.price.toLocaleString("id-ID")}
                          </span>
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-800 text-xs font-semibold">
                            Pending Payment
                          </span>
                          <button
                            onClick={async () => {
                              const result = await Swal.fire({
                                title: "Konfirmasi",
                                text: `Hapus produk ${prod.product_name} dari billing?`,
                                icon: "warning",
                                showCancelButton: true,
                                confirmButtonText: "Ya, hapus",
                                cancelButtonText: "Batal",
                              });
                              if (result.isConfirmed) {
                                try {
                                  await deleteSaleItem(
                                    prod.product_id,
                                    prod.session_id,
                                  );
                                  await loadData();
                                  // Refresh billingProducts
                                  const { data: billingData } = await supabase
                                    .from("rental_session_products")
                                    .select("*")
                                    .eq("session_id", prod.session_id)
                                    .eq("status", "pending");
                                  setBillingProducts(billingData || []);
                                  Swal.fire(
                                    "Berhasil",
                                    "Produk berhasil dihapus dari billing.",
                                    "success",
                                  );
                                } catch (err) {
                                  Swal.fire(
                                    "Gagal",
                                    "Gagal menghapus produk dari database.",
                                    "error",
                                  );
                                }
                              }
                            }}
                            className="ml-2 text-red-500 hover:text-red-700 px-2 py-1 rounded"
                            title="Hapus produk dari billing"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Total Produk Pending Payment */}
                  <div className="flex justify-between items-center mt-4 px-3 py-2 bg-yellow-100 rounded-lg font-bold text-yellow-800">
                    <span>Total Produk Pending Payment:</span>
                    <span>
                      Rp{" "}
                      {billingProducts
                        .reduce(
                          (total, prod) => total + prod.price * prod.quantity,
                          0,
                        )
                        .toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              )}

              {/* Search and Filter */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      if (product.stock <= 0) {
                        Swal.fire({
                          icon: "warning",
                          title: "Stok Habis",
                          text: `Produk "${product.name}" tidak dapat dipilih karena stok habis.`,
                          confirmButtonText: "OK",
                        });
                        return;
                      }
                      addToCart(product);
                    }}
                    className={`bg-white border border-gray-200 rounded-lg p-4 transition-shadow ${
                      product.stock <= 0
                        ? "cursor-not-allowed opacity-50 hover:shadow-none"
                        : "cursor-pointer hover:shadow-md"
                    }`}
                  >
                    <div className="mb-3">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                          product.category,
                        )}`}
                      >
                        {product.category}
                      </span>
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-2">
                      {product.name}
                    </h3>

                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-blue-600">
                        Rp {product.price.toLocaleString("id-ID")}
                      </span>
                      <span
                        className={`text-sm ${
                          product.stock <= 0
                            ? "text-red-500 font-medium"
                            : "text-gray-500"
                        }`}
                      >
                        Stock: {product.stock <= 0 ? "HABIS" : product.stock}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-8">
                  <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Tidak ada produk ditemukan</p>
                </div>
              )}
            </div>

            {/* Cart Sidebar */}
            <div className="w-96 bg-gray-50 border-l border-gray-200 flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Keranjang ({cart.length})
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {cart.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Keranjang kosong</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div
                        key={item.productId}
                        className="bg-white rounded-lg p-4 border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">
                            {item.productName}
                          </h4>
                          <button
                            onClick={async () => {
                              const result = await Swal.fire({
                                title: "Konfirmasi",
                                text: `Hapus produk ${item.productName} dari keranjang?`,
                                icon: "warning",
                                showCancelButton: true,
                                confirmButtonText: "Ya, hapus",
                                cancelButtonText: "Batal",
                              });
                              if (result.isConfirmed) {
                                setCart((prev) =>
                                  prev.filter(
                                    (cartItem) =>
                                      cartItem.productId !== item.productId,
                                  ),
                                );
                                Swal.fire(
                                  "Berhasil",
                                  "Produk dihapus dari keranjang.",
                                  "success",
                                );
                              }
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700">
                              x{item.quantity}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-blue-700">
                              Rp {item.price.toLocaleString("id-ID")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Total Keranjang */}
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span>Rp {cartTotal.toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t border-gray-200 p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span>Rp {cartTotal.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="space-y-2">
                      {/* Tombol Tambahkan ke Billing hanya muncul untuk Pay As You Go dan billing belum dibayar */}
                      {(() => {
                        const session = activeSessions.find(
                          (s) => s.id === showProductModal,
                        );
                        if (
                          !session ||
                          (!session?.duration_minutes &&
                            session?.payment_status !== "paid")
                        ) {
                          return (
                            <button
                              onClick={async () => {
                                try {
                                  // Pembelian umum
                                  if (!session) {
                                    const productsTotal = cart.reduce(
                                      (sum, it) => sum + it.price * it.quantity,
                                      0,
                                    );
                                    if (productsTotal <= 0) {
                                      await Swal.fire(
                                        "Info",
                                        "Keranjang kosong",
                                        "info",
                                      );
                                      return;
                                    }
                                    setShowProductModal(null);
                                    setShowPaymentModal({
                                      session: null,
                                      productsTotal,
                                    });
                                    return;
                                  }

                                  for (const item of cart) {
                                    const existing = billingProducts.find(
                                      (bp) => bp.product_id === item.productId,
                                    );
                                    if (existing) {
                                      // Update quantity jika sudah ada
                                      await supabase
                                        .from("rental_session_products")
                                        .update({
                                          quantity:
                                            existing.quantity + item.quantity,
                                          total:
                                            (existing.quantity +
                                              item.quantity) *
                                            item.price,
                                        })
                                        .eq("session_id", session.id)
                                        .eq("product_id", item.productId)
                                        .eq("status", "pending");
                                    } else {
                                      // Insert baru jika belum ada
                                      await supabase
                                        .from("rental_session_products")
                                        .insert({
                                          session_id: session.id,
                                          product_id: item.productId,
                                          product_name: item.productName,
                                          quantity: item.quantity,
                                          price: item.price,
                                          total: item.price * item.quantity,
                                          status: "pending",
                                        });
                                    }
                                  }
                                  clearCart();
                                  await loadData();

                                  // Refresh billingProducts
                                  if (session) {
                                    const { data: billingData } = await supabase
                                      .from("rental_session_products")
                                      .select("*")
                                      .eq("session_id", session.id)
                                      .eq("status", "pending");
                                    setBillingProducts(billingData || []);

                                    Swal.fire(
                                      "Berhasil",
                                      "Produk berhasil ditambahkan ke billing.",
                                      "success",
                                    );
                                  }
                                } catch (err) {
                                  Swal.fire(
                                    "Gagal",
                                    "Gagal menambahkan produk ke billing.",
                                    "error",
                                  );
                                }
                              }}
                              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mb-2"
                            >
                              <ShoppingCart className="h-5 w-5" />
                              {session ? "Tambahkan ke Billing" : "Bayar"}
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal Pembayaran Kasir Style (Cashier) */}
      <EndRentalModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(null)}
        onConfirm={handleProcessPayment}
        calculateCurrentCost={calculateCurrentCost}
        formatElapsedHMS={formatElapsedHMS}
        loading={processPaymentLoading}
      />

      <VoucherPaymentModal
        open={showVoucherPaymentModal}
        onClose={() => setShowVoucherPaymentModal(false)}
        onConfirm={handleSellVoucher}
        loading={selling}
        voucher={voucherList.find((v) => v.id === selectedVoucherId)}
        quantity={voucherQuantity}
        subtotal={
          (voucherList.find((v) => v.id === selectedVoucherId)?.voucher_price ||
            0) * voucherQuantity
        }
        currentBalance={scannedCardData?.balance_points || 0}
        newBalance={
          (scannedCardData?.balance_points || 0) +
          (voucherList.find((v) => v.id === selectedVoucherId)?.total_points ||
            0) *
            voucherQuantity
        }
      />

      {/* Prepaid Payment Modal - render di root, bukan di dalam loop/grid/list/detail */}
      <PrepaidPaymentModal2
        open={!!showPrepaidPaymentModal}
        onClose={() => setShowPrepaidPaymentModal(null)}
        onConfirm={handleConfirmPrepaidPayment}
        duration={
          showPrepaidPaymentModal
            ? `${showPrepaidPaymentModal.rentalDurationHours} jam ${showPrepaidPaymentModal.rentalDurationMinutes} menit`
            : ""
        }
        hourlyRate={
          showPrepaidPaymentModal ? showPrepaidPaymentModal.hourlyRate : 0
        }
        totalAmount={
          showPrepaidPaymentModal ? showPrepaidPaymentModal.totalAmount : 0
        }
        loading={prepaidPaymentLoading}
      />

      {/* Package Selection Modal */}
      <PackageSelectionModal
        open={showPackageModal}
        onClose={() => setShowPackageModal(false)}
        onSelectPackage={handleSelectPackage}
        packages={availablePackages}
        loading={packageLoading}
      />

      {/* Add Time Modal */}
      <AddTimeModal
        open={!!showAddTimeModal}
        onClose={() => setShowAddTimeModal(null)}
        onConfirm={handleConfirmAddTime}
        session={showAddTimeModal?.session!}
        console={showAddTimeModal?.console!}
        currentDuration={showAddTimeModal?.currentDuration || 0}
        hourlyRate={showAddTimeModal?.hourlyRate || 0}
        loading={addTimeLoading}
      />
      {/* Modal konfirmasi batal transaksi */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-red-700">
                Batalkan Transaksi
              </h2>
              <p className="mb-2">Masukkan alasan pembatalan transaksi:</p>
              <textarea
                className="w-full border rounded p-2 mb-4"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Alasan pembatalan..."
                disabled={cancelLoading}
              />
              <div className="flex gap-2 justify-end mt-4">
                <button
                  className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300"
                  onClick={() => setShowCancelModal(null)}
                  disabled={cancelLoading}
                >
                  Batal
                </button>
                <button
                  className="px-4 py-2 rounded bg-red-600 text-white font-medium hover:bg-red-700"
                  onClick={() =>
                    handleCancelTransaction(showCancelModal.session)
                  }
                  disabled={cancelLoading || !cancelReason.trim()}
                >
                  Konfirmasi Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto Shutdown Protection Modal */}
      {showAutoShutdownModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Power className="h-6 w-6 text-orange-600" />
                  <h2 className="text-xl font-semibold text-gray-800">
                    Auto Shutdown Protection Management
                  </h2>
                </div>
                <button
                  onClick={() => setShowAutoShutdownModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-800 mb-2">
                  Apa itu Auto Shutdown Protection?
                </h3>
                <p className="text-sm text-blue-700">
                  Fitur ini akan secara otomatis mematikan TV dan perangkat
                  console yang tidak sedang disewa.
                </p>
              </div>

              {/* Global Controls */}
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="font-medium text-gray-800 mb-3">
                  Kontrol Global
                </h3>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleAllConsolesAutoShutdown(true)}
                    disabled={isUpdatingAutoShutdown}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isUpdatingAutoShutdown
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700"
                    }`}
                  >
                    {isUpdatingAutoShutdown ? "Updating..." : "Aktifkan Semua"}
                  </button>
                  <button
                    onClick={() => toggleAllConsolesAutoShutdown(false)}
                    disabled={isUpdatingAutoShutdown}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isUpdatingAutoShutdown
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                  >
                    {isUpdatingAutoShutdown
                      ? "Updating..."
                      : "Nonaktifkan Semua"}
                  </button>
                  <div className="text-sm text-gray-600">
                    Status:{" "}
                    <span
                      className={`font-medium ${
                        autoShutdownEnabled ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {autoShutdownEnabled
                        ? "Beberapa console dilindungi"
                        : "Semua console tidak dilindungi"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Individual Console Controls */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-800 mb-3">
                  Kontrol Per Console
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {consoles.map((console) => (
                    <div
                      key={console.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            consoleAutoShutdownStates[console.id]
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                        ></div>
                        <div>
                          <div className="font-medium text-gray-800">
                            {console.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            Status: {console.status} |{" "}
                            {consoleAutoShutdownStates[console.id]
                              ? "Dilindungi"
                              : "Tidak dilindungi"}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          updateConsoleAutoShutdown(
                            console.id,
                            !consoleAutoShutdownStates[console.id],
                          )
                        }
                        disabled={
                          isUpdatingAutoShutdown ||
                          updatingConsoleIds.has(console.id)
                        }
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                          consoleAutoShutdownStates[console.id]
                            ? "bg-red-100 text-red-700 border border-red-300 hover:bg-red-200"
                            : "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
                        } ${
                          isUpdatingAutoShutdown
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {updatingConsoleIds.has(console.id)
                          ? "Updating..."
                          : consoleAutoShutdownStates[console.id]
                            ? "Nonaktifkan"
                            : "Aktifkan"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowAutoShutdownModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Search Modal */}
      {showGameSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Gamepad2 className="h-6 w-6 text-blue-600" />
                Cari Game di Console
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyGameSearch}
                  className={`p-2 rounded-lg transition-all ${
                    gameSearchCopySuccess
                      ? "bg-green-100 text-green-600"
                      : "hover:bg-gray-100 text-gray-600"
                  }`}
                  title="Salin daftar game ke clipboard"
                >
                  {gameSearchCopySuccess ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={() => setShowGameSearchModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 border-b bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Search className="h-4 w-4" /> Cari Judul
                  </label>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Judul game..."
                      value={gameSearchTerm}
                      onChange={(e) => setGameSearchTerm(e.target.value)}
                      className="pl-9 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                  <select
                    value={gameSearchPlatform}
                    onChange={(e) => setGameSearchPlatform(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="all">Semua Platform</option>
                    {Object.entries(platformNames).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Genre</label>
                  <select
                    value={gameSearchGenre}
                    onChange={(e) => setGameSearchGenre(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="all">Semua Genre</option>
                    {availableGenres.map((genre) => (
                      <option key={genre} value={genre}>{genre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Console</label>
                  <select
                    value={gameSearchConsole}
                    onChange={(e) => setGameSearchConsole(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="all">Semua Console</option>
                    {catalogConsoles.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              {gameSearchLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <p>Memuat data game...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {catalogGames
                    .filter(
                      (g) =>
                        g.is_active &&
                        g.title.toLowerCase().includes(gameSearchTerm.toLowerCase()) &&
                        (gameSearchPlatform === "all" || (g.platform && g.platform.includes(gameSearchPlatform))) &&
                        (gameSearchGenre === "all" || (g.genre && g.genre.includes(gameSearchGenre))) &&
                        (gameSearchConsole === "all" || (catalogConsoles.find(c => c.id === gameSearchConsole)?.installed_games?.includes(g.id)))
                    )
                    .map((game) => {
                      const availableConsoles = catalogConsoles
                        .filter(
                          (c) => c.installed_games && c.installed_games.includes(game.id),
                        )
                        .sort((a, b) =>
                          a.name.localeCompare(b.name, "id", { numeric: true }),
                        );
                      const activeAvailableConsoles = availableConsoles.filter(
                        (c) => consoles.find((cs) => cs.id === c.id)?.status === "rented",
                      );
                      const nonActiveAvailableConsoles = availableConsoles.filter(
                        (c) => consoles.find((cs) => cs.id === c.id)?.status !== "rented",
                      );
                      
                      return (
                        <div key={game.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                          {game.cover_image_url ? (
                            <div className="aspect-[3/4] w-full bg-gray-100 overflow-hidden shrink-0">
                              <img src={game.cover_image_url} alt={game.title} className="w-full h-full object-cover" loading="lazy" />
                            </div>
                          ) : (
                            <div className="aspect-[3/4] w-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center shrink-0">
                              <Gamepad2 className="h-12 w-12 text-blue-300" />
                            </div>
                          )}
                          <div className="p-4 flex flex-col flex-1">
                            <h3 className="font-semibold text-base text-gray-900 mb-1 line-clamp-2">{game.title}</h3>
                            <p className="text-xs text-gray-500 mb-3 line-clamp-1">{game.genre?.join(', ')}</p>
                            
                            <div className="mt-auto pt-3 border-t border-gray-100">
                              <p className="text-xs font-medium text-gray-700 mb-2">
                                Tersedia di: ({availableConsoles.length} console)
                              </p>
                              {availableConsoles.length > 0 ? (
                                <div className="space-y-2">
                                  {activeAvailableConsoles.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-medium text-yellow-700 mb-1">
                                        Aktif ({activeAvailableConsoles.length})
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {activeAvailableConsoles.map((c) => (
                                          <span
                                            key={c.id}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border bg-yellow-100 text-yellow-700 border-yellow-200"
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                            {c.name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {nonActiveAvailableConsoles.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-medium text-blue-700 mb-1">
                                        Nonaktif ({nonActiveAvailableConsoles.length})
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {nonActiveAvailableConsoles.map((c) => (
                                          <span
                                            key={c.id}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border bg-blue-100 text-blue-700 border-blue-200"
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            {c.name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-red-500 font-medium tracking-tight">Belum diinstall</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                  {catalogGames.length > 0 && catalogGames.filter(
                    (g) =>
                      g.is_active &&
                      g.title.toLowerCase().includes(gameSearchTerm.toLowerCase()) &&
                      (gameSearchPlatform === "all" || (g.platform && g.platform.includes(gameSearchPlatform))) &&
                      (gameSearchGenre === "all" || (g.genre && g.genre.includes(gameSearchGenre))) &&
                      (gameSearchConsole === "all" || (catalogConsoles.find(c => c.id === gameSearchConsole)?.installed_games?.includes(g.id)))
                  ).length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
                      <Gamepad2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p>Tidak ada game yang cocok dengan pencarian '{gameSearchTerm}'</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Panel summary stats di bawah dihapus sesuai permintaan */}
    </div>
  );
};


// ==========================================
// MODAL COMPONENTS (DEFINED OUTSIDE TO PREVENT STATE RESET)
// ==========================================

// Modal Add Time untuk prepaid
const AddTimeModal = ({
  open,
  onClose,
  onConfirm,
  session,
  console,
  currentDuration,
  hourlyRate,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    paymentMethod: "cash" | "qris",
    paymentAmount: number,
    discountAmount: number,
    discountType: "amount" | "percentage",
    discountValue: number,
    additionalHours: number,
    additionalMinutes: number,
    discountReason: string,
  ) => void;
  session: RentalSession;
  console: Console;
  currentDuration: number;
  hourlyRate: number;
  loading: boolean;
}) => {
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris">("cash");
  const [isManualInput, setIsManualInput] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [localDiscountType, setLocalDiscountType] = useState<
    "amount" | "percentage"
  >("amount");
  const [localDiscountValue, setLocalDiscountValue] = useState<number>(0);
  const [localDiscountAmount, setLocalDiscountAmount] = useState<number>(0);
  const [localDiscountReason, setLocalDiscountReason] = useState<string>("");
  const [additionalHours, setAdditionalHours] = useState(1);
  const [additionalMinutes, setAdditionalMinutes] = useState(0);

  // Hitung total biaya tambahan
  const additionalDurationMinutes = additionalHours * 60 + additionalMinutes;
  const additionalCost = (additionalDurationMinutes / 60) * hourlyRate;

  // Track previous open state to ensure we only reset on OPENING
  const prevOpenRef = useRef(false);

  // Reset state saat modal dibuka
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setPaymentAmount(hourlyRate);
      setLocalDiscountValue(0);
      setLocalDiscountAmount(0);
      setLocalDiscountReason("");
      setLocalDiscountType("amount");
      setAdditionalHours(1);
      setAdditionalMinutes(0);
    }
    prevOpenRef.current = open;
  }, [open, hourlyRate]);

  useEffect(() => {
    if (open && localDiscountAmount === 0 && localDiscountValue === 0) {
      setPaymentAmount(additionalCost);
    }
  }, [additionalCost, open, localDiscountAmount, localDiscountValue]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xl font-bold text-gray-700">
              Tambah Waktu
            </div>
            <div className="text-right">
              {localDiscountAmount > 0 && (
                <div className="text-sm text-gray-500 line-through">
                  Rp {additionalCost.toLocaleString("id-ID")}
                </div>
              )}
              <div className="text-2xl font-bold text-blue-700">
                Rp{" "}
                {Math.max(
                  0,
                  additionalCost - localDiscountAmount,
                ).toLocaleString("id-ID")}
              </div>
            </div>
          </div>

          {/* Info sesi saat ini */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-800">
              <div className="font-medium mb-1">Sesi Aktif:</div>
              <div>Konsol: {console.name}</div>
              <div>Customer: {session.customers?.name}</div>
              <div>
                Durasi saat ini: {Math.floor(currentDuration / 60)} jam{" "}
                {currentDuration % 60} menit
              </div>
            </div>
          </div>

          {/* Pilih durasi tambahan */}
          <div className="mb-4">
            <div className="font-medium text-gray-700 mb-2">
              Durasi Tambahan
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-1">
                  Jam
                </label>
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={additionalHours}
                  onChange={(e) =>
                    setAdditionalHours(
                      Math.max(0, parseInt(e.target.value) || 0),
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-1">
                  Menit
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={additionalMinutes}
                  onChange={(e) =>
                    setAdditionalMinutes(
                      Math.max(
                        0,
                        Math.min(59, parseInt(e.target.value) || 0),
                      ),
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Total tambahan: {additionalHours} jam {additionalMinutes} menit
            </div>
          </div>

          {/* Metode Pembayaran */}
          <div className="mb-4">
            <div className="mb-2 font-medium text-gray-700">
              Metode Pembayaran
            </div>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                className={`flex-1 py-2 rounded-md font-semibold border text-base transition-colors flex items-center justify-center gap-2 ${
                  paymentMethod === "cash"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
                onClick={() => setPaymentMethod("cash")}
                disabled={loading}
              >
                <span className="inline-block mr-1"></span> Cash
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-md font-semibold border text-base transition-colors flex items-center justify-center gap-2 ${
                  paymentMethod === "qris"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
                onClick={() => setPaymentMethod("qris")}
                disabled={loading}
              >
                <span className="inline-block mr-1"></span> QRIS
              </button>
            </div>
          </div>

          {/* Diskon Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-700">Diskon</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    localDiscountType === "amount"
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => {
                    setLocalDiscountType("amount");
                    setLocalDiscountValue(0);
                    setLocalDiscountAmount(0);
                  }}
                >
                  Rp
                </button>
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    localDiscountType === "percentage"
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => {
                    setLocalDiscountType("percentage");
                    setLocalDiscountValue(0);
                    setLocalDiscountAmount(0);
                  }}
                >
                  %
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 ml-2"
                  onClick={() => {
                    setLocalDiscountValue(0);
                    setLocalDiscountAmount(0);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max={localDiscountType === "percentage" ? 100 : undefined}
                value={localDiscountValue}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setLocalDiscountValue(val);

                  if (localDiscountType === "percentage") {
                    const maxPercentage = Math.min(100, val);
                    setLocalDiscountAmount(
                      (additionalCost * maxPercentage) / 100,
                    );
                  } else {
                    setLocalDiscountAmount(Math.min(val, additionalCost));
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                placeholder={localDiscountType === "percentage" ? "0" : "0"}
              />
              <span className="self-center text-gray-600 font-medium">
                {localDiscountType === "percentage" ? "%" : "Rp"}
              </span>
            </div>

            {localDiscountAmount > 0 && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-green-700">Diskon:</span>
                  <span className="font-bold text-green-800">
                    - Rp {localDiscountAmount.toLocaleString("id-ID")}
                  </span>
                </div>
                {localDiscountType === "percentage" && (
                  <div className="text-xs text-green-600 text-center mb-2">
                    ({localDiscountValue}% dari total)
                  </div>
                )}
                <input
                  type="text"
                  value={localDiscountReason}
                  onChange={(e) => setLocalDiscountReason(e.target.value)}
                  placeholder="Alasan Diskon (wajib)"
                  className="w-full px-2 py-1 text-sm border border-green-300 rounded focus:ring-1 focus:ring-green-500 focus:border-transparent text-gray-700 placeholder-green-500 bg-white"
                />
              </div>
            )}
          </div>

          {/* Jumlah Bayar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-700">Jumlah Bayar</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    !isManualInput
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => setIsManualInput(false)}
                >
                  Quick
                </button>
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    isManualInput
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => setIsManualInput(true)}
                >
                  Manual
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 ml-2"
                  onClick={() => setPaymentAmount(0)}
                >
                  Clear
                </button>
              </div>
            </div>
            {!isManualInput ? (
              <>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[1000, 5000, 10000, 20000, 50000, 100000].map((nom) => (
                    <button
                      key={nom}
                      type="button"
                      className="py-3 rounded font-bold border border-green-200 text-green-800 text-base bg-green-50 hover:bg-green-100"
                      onClick={() => setPaymentAmount((prev) => prev + nom)}
                    >
                      {nom >= 1000 ? `${nom / 1000}K` : nom}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="w-full py-2 rounded bg-blue-100 border border-blue-200 text-blue-800 font-bold text-base hover:bg-blue-200 mb-2"
                  onClick={() =>
                    setPaymentAmount(
                      Math.max(0, additionalCost - localDiscountAmount),
                    )
                  }
                >
                  LUNAS (Rp{" "}
                  {Math.max(
                    0,
                    additionalCost - localDiscountAmount,
                  ).toLocaleString("id-ID")}
                  )
                </button>
              </>
            ) : (
              <input
                type="number"
                min={0}
                value={paymentAmount}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setPaymentAmount(val);
                }}
                className="w-full px-3 py-3 border rounded text-center text-2xl font-mono mb-2"
                placeholder="Masukkan nominal bayar"
              />
            )}
            <div className="text-center text-3xl font-mono font-bold py-2 border-b border-gray-200 mb-2">
              Rp {paymentAmount.toLocaleString("id-ID")}
            </div>
          </div>

          {/* Kembalian */}
          <div className="mb-4">
            <div className="font-medium text-gray-700 mb-1">Kembalian</div>
            <div className="text-2xl font-mono font-bold text-green-700 text-center">
              Rp{" "}
              {(() => {
                const finalTotal = Math.max(
                  0,
                  additionalCost - localDiscountAmount,
                );
                const change = paymentAmount - finalTotal;
                return change > 0 ? change.toLocaleString("id-ID") : 0;
              })()}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
              disabled={loading}
            >
              Batal
            </button>
            <button
              onClick={() =>
                onConfirm(
                  paymentMethod,
                  paymentAmount,
                  localDiscountAmount,
                  localDiscountType,
                  localDiscountValue,
                  additionalHours,
                  additionalMinutes,
                  localDiscountReason,
                )
              }
              className={`flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors ${(() => {
                const finalTotal = Math.max(
                  0,
                  additionalCost - localDiscountAmount,
                );
                return paymentAmount < finalTotal ||
                  (localDiscountAmount > 0 && !localDiscountReason.trim())
                  ? "opacity-50 cursor-not-allowed"
                  : "";
              })()}`}
              disabled={(() => {
                const finalTotal = Math.max(
                  0,
                  additionalCost - localDiscountAmount,
                );
                return (
                  paymentAmount < finalTotal ||
                  loading ||
                  (additionalHours === 0 && additionalMinutes === 0) ||
                  (localDiscountAmount > 0 && !localDiscountReason.trim())
                );
              })()}
            >
              Tambah Waktu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal Voucher Payment
const VoucherPaymentModal = ({
  open,
  onClose,
  onConfirm,
  loading,
  voucher,
  quantity,
  subtotal,
  currentBalance,
  newBalance,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    paymentMethod: "cash" | "qris",
    paymentAmount: number,
    discountAmount: number,
    discountType: "amount" | "percentage",
    discountValue: number,
    discountReason: string,
  ) => void;
  loading: boolean;
  voucher: any;
  quantity: number;
  subtotal: number;
  currentBalance: number;
  newBalance: number;
}) => {
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris">("cash");
  const [isManualInput, setIsManualInput] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(subtotal);
  const [localDiscountType, setLocalDiscountType] = useState<
    "amount" | "percentage"
  >("amount");
  const [localDiscountValue, setLocalDiscountValue] = useState<number>(0);
  const [localDiscountAmount, setLocalDiscountAmount] = useState<number>(0);
  const [localDiscountReason, setLocalDiscountReason] = useState<string>("");

  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const paymentProcessingRef = useRef(false);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setPaymentAmount(subtotal);
      setLocalDiscountValue(0);
      setLocalDiscountAmount(0);
      setLocalDiscountReason("");
      setLocalDiscountType("amount");
      setIsPaymentProcessing(false);
      paymentProcessingRef.current = false;
    }
    prevOpenRef.current = open;
  }, [open, subtotal]);

  const handlePayment = useCallback(async () => {
    if (isPaymentProcessing || paymentProcessingRef.current || loading) {
      console.log("Payment already in progress");
      return;
    }

    const finalTotal = Math.max(0, subtotal - localDiscountAmount);

    if (paymentAmount < finalTotal) {
      Swal.fire({
        icon: "warning",
        title: "Pembayaran Kurang",
        text: `Jumlah pembayaran kurang. Total yang harus dibayar: Rp ${finalTotal.toLocaleString(
          "id-ID",
        )}`,
      });
      return;
    }

    setIsPaymentProcessing(true);
    paymentProcessingRef.current = true;

    try {
      await Promise.race([
        onConfirm(
          paymentMethod,
          paymentAmount,
          localDiscountAmount,
          localDiscountType,
          localDiscountValue,
          localDiscountReason,
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Payment timeout")), 30000),
        ),
      ]);
    } catch (error) {
      console.error("Payment error:", error);
      Swal.fire({
        icon: "error",
        title: "Pembayaran Gagal",
        text:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat memproses pembayaran",
      });
    } finally {
      setTimeout(() => {
        setIsPaymentProcessing(false);
        paymentProcessingRef.current = false;
      }, 2000);
    }
  }, [
    isPaymentProcessing,
    paymentProcessingRef,
    loading,
    subtotal,
    localDiscountAmount,
    paymentAmount,
    paymentMethod,
    localDiscountType,
    localDiscountValue,
    onConfirm,
    localDiscountReason,
  ]);

  if (!open) return null;

  const finalTotal = Math.max(0, subtotal - localDiscountAmount);
  const isValidPayment = paymentAmount >= finalTotal;
  const isProcessing = loading || isPaymentProcessing;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 relative">
        {isProcessing && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-20 rounded-xl">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <p className="text-sm text-gray-600 font-medium">
                Memproses pembayaran...
              </p>
              <p className="text-xs text-gray-500">Mohon tunggu sebentar</p>
            </div>
          </div>
        )}

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xl font-bold text-gray-700">Total:</div>
            <div className="text-right">
              {localDiscountAmount > 0 && (
                <div className="text-sm text-gray-500 line-through">
                  Rp {subtotal.toLocaleString("id-ID")}
                </div>
              )}
              <div className="text-2xl font-bold text-blue-700">
                Rp {finalTotal.toLocaleString("id-ID")}
              </div>
            </div>
          </div>

          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h3 className="font-medium text-blue-800 mb-2">Detail Voucher</h3>
            <div className="space-y-1 text-sm text-blue-700">
              <div className="flex justify-between">
                <span>Nama Voucher:</span>
                <span className="font-medium">{voucher?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Kode:</span>
                <span className="font-medium">{voucher?.voucher_code}</span>
              </div>
              <div className="flex justify-between">
                <span>Points:</span>
                <span className="font-medium">
                  {voucher?.total_points} x {quantity}
                </span>
              </div>
              <div className="border-t border-blue-200 mt-2 pt-2">
                <div className="flex justify-between">
                  <span>Balance Awal:</span>
                  <span className="font-medium">{currentBalance} points</span>
                </div>
                <div className="flex justify-between text-green-700 font-medium">
                  <span>Balance Akhir:</span>
                  <span>{newBalance} points</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-2 font-medium text-gray-700">
              Metode Pembayaran
            </div>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                className={`flex-1 py-2 rounded-md font-semibold border text-base transition-colors flex items-center justify-center gap-2 ${
                  paymentMethod === "cash"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
                onClick={() => setPaymentMethod("cash")}
                disabled={isProcessing}
              >
                <span className="inline-block mr-1"></span> Cash
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-md font-semibold border text-base transition-colors flex items-center justify-center gap-2 ${
                  paymentMethod === "qris"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
                onClick={() => setPaymentMethod("qris")}
                disabled={isProcessing}
              >
                <span className="inline-block mr-1"></span> QRIS
              </button>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-700">Diskon</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    localDiscountType === "amount"
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => {
                    setLocalDiscountType("amount");
                    setLocalDiscountValue(0);
                    setLocalDiscountAmount(0);
                    setLocalDiscountReason("");
                  }}
                  disabled={isProcessing}
                >
                  Rp
                </button>
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    localDiscountType === "percentage"
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => {
                    setLocalDiscountType("percentage");
                    setLocalDiscountValue(0);
                    setLocalDiscountAmount(0);
                    setLocalDiscountReason("");
                  }}
                  disabled={isProcessing}
                >
                  %
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 ml-2"
                  onClick={() => {
                    setLocalDiscountValue(0);
                    setLocalDiscountAmount(0);
                    setLocalDiscountReason("");
                  }}
                  disabled={isProcessing}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max={localDiscountType === "percentage" ? 100 : undefined}
                value={localDiscountValue}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setLocalDiscountValue(val);

                  if (localDiscountType === "percentage") {
                    const maxPercentage = Math.min(100, val);
                    setLocalDiscountAmount((subtotal * maxPercentage) / 100);
                  } else {
                    setLocalDiscountAmount(Math.min(val, subtotal));
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                placeholder={localDiscountType === "percentage" ? "0" : "0"}
                disabled={isProcessing}
              />
              <span className="self-center text-gray-600 font-medium">
                {localDiscountType === "percentage" ? "%" : "Rp"}
              </span>
            </div>

            {localDiscountAmount > 0 && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-green-700">Diskon:</span>
                  <span className="font-bold text-green-800">
                    - Rp {localDiscountAmount.toLocaleString("id-ID")}
                  </span>
                </div>
                {localDiscountType === "percentage" && (
                  <div className="text-xs text-green-600 text-center mb-2">
                    ({localDiscountValue}% dari total)
                  </div>
                )}
                <input
                  type="text"
                  value={localDiscountReason}
                  onChange={(e) => setLocalDiscountReason(e.target.value)}
                  placeholder="Alasan Diskon (wajib)"
                  className="w-full px-2 py-1 text-sm border border-green-300 rounded focus:ring-1 focus:ring-green-500 focus:border-transparent text-gray-700 placeholder-green-500 bg-white"
                />
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-700">Jumlah Bayar</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    !isManualInput
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => setIsManualInput(false)}
                  disabled={isProcessing}
                >
                  Quick
                </button>
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    isManualInput
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => setIsManualInput(true)}
                  disabled={isProcessing}
                >
                  Manual
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 ml-2"
                  onClick={() => setPaymentAmount(0)}
                  disabled={isProcessing}
                >
                  Clear
                </button>
              </div>
            </div>

            {!isManualInput ? (
              <>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[1000, 5000, 10000, 20000, 50000, 100000].map((nom) => (
                    <button
                      key={nom}
                      type="button"
                      className="py-3 rounded font-bold border border-green-200 text-green-800 text-base bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => setPaymentAmount((prev) => prev + nom)}
                      disabled={isProcessing}
                    >
                      {nom >= 1000 ? `${nom / 1000}K` : nom}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="w-full py-2 rounded bg-blue-100 border border-blue-200 text-blue-800 font-bold text-base hover:bg-blue-200 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setPaymentAmount(finalTotal)}
                  disabled={
                    isProcessing ||
                    (localDiscountAmount > 0 && !localDiscountReason.trim())
                  }
                >
                  LUNAS (Rp {finalTotal.toLocaleString("id-ID")})
                </button>
              </>
            ) : (
              <input
                type="number"
                min={0}
                value={paymentAmount}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setPaymentAmount(val);
                }}
                className="w-full px-3 py-3 border rounded text-center text-2xl font-mono mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Masukkan nominal bayar"
                disabled={isProcessing}
              />
            )}

            <div className="text-center text-3xl font-mono font-bold py-2 border-b border-gray-200 mb-2">
              Rp {paymentAmount.toLocaleString("id-ID")}
            </div>
          </div>

          <div className="mb-4">
            <div className="font-medium text-gray-700 mb-1">Kembalian</div>
            <div className="text-2xl font-mono font-bold text-green-700 text-center">
              Rp{" "}
              {(() => {
                const change = paymentAmount - finalTotal;
                return change > 0 ? change.toLocaleString("id-ID") : 0;
              })()}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isProcessing}
            >
              Batal
            </button>
            <button
              onClick={handlePayment}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                !isValidPayment || isProcessing
                  ? "bg-gray-400 cursor-not-allowed opacity-60"
                  : "bg-green-600 hover:bg-green-700 active:bg-green-800"
              } text-white`}
              disabled={!isValidPayment || isProcessing}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Memproses...</span>
                </>
              ) : (
                <>
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Bayar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal Prepaid Payment
const PrepaidPaymentModal2 = ({
  open,
  onClose,
  onConfirm,
  duration,
  hourlyRate,
  totalAmount,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    paymentMethod: "cash" | "qris",
    paymentAmount: number,
    discountAmount: number,
    discountType: "amount" | "percentage",
    discountValue: number,
    discountReason: string,
  ) => void;
  duration: string;
  hourlyRate: number;
  totalAmount: number;
  loading: boolean;
}) => {
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris">("cash");
  const [isManualInput, setIsManualInput] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(totalAmount);
  const [localDiscountType, setLocalDiscountType] = useState<
    "amount" | "percentage"
  >("amount");
  const [localDiscountValue, setLocalDiscountValue] = useState<number>(0);
  const [localDiscountAmount, setLocalDiscountAmount] = useState<number>(0);
  const [localDiscountReason, setLocalDiscountReason] = useState<string>("");

  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setPaymentAmount(totalAmount);
      setLocalDiscountValue(0);
      setLocalDiscountAmount(0);
      setLocalDiscountReason("");
      setLocalDiscountType("amount");
    }
    prevOpenRef.current = open;
  }, [open, totalAmount]);

  if (!open) return null;

  const finalTotal = Math.max(0, totalAmount - localDiscountAmount);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xl font-bold text-gray-700">Total:</div>
            <div className="text-right">
              {localDiscountAmount > 0 && (
                <div className="text-sm text-gray-500 line-through">
                  Rp {totalAmount.toLocaleString("id-ID")}
                </div>
              )}
              <div className="text-2xl font-bold text-blue-700">
                Rp {finalTotal.toLocaleString("id-ID")}
              </div>
            </div>
          </div>
          <div className="mb-4">
            <div className="mb-2 font-medium text-gray-700">
              Metode Pembayaran
            </div>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                className={`flex-1 py-2 rounded-md font-semibold border text-base transition-colors flex items-center justify-center gap-2 ${
                  paymentMethod === "cash"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
                onClick={() => setPaymentMethod("cash")}
                disabled={loading}
              >
                <span className="inline-block mr-1"></span> Cash
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-md font-semibold border text-base transition-colors flex items-center justify-center gap-2 ${
                  paymentMethod === "qris"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
                onClick={() => setPaymentMethod("qris")}
                disabled={loading}
              >
                <span className="inline-block mr-1"></span> QRIS
              </button>
            </div>
          </div>
          <div className="mb-4 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Durasi:</span>
              <span className="font-medium">{duration}</span>
            </div>
            <div className="flex justify-between">
              <span>Tarif per jam:</span>
              <span className="font-medium">
                Rp {hourlyRate.toLocaleString("id-ID")}
              </span>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-700">Diskon</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    localDiscountType === "amount"
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => {
                    setLocalDiscountType("amount");
                    setLocalDiscountValue(0);
                    setLocalDiscountAmount(0);
                    setLocalDiscountReason("");
                  }}
                >
                  Rp
                </button>
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    localDiscountType === "percentage"
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => {
                    setLocalDiscountType("percentage");
                    setLocalDiscountValue(0);
                    setLocalDiscountAmount(0);
                    setLocalDiscountReason("");
                  }}
                >
                  %
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 ml-2"
                  onClick={() => {
                    setLocalDiscountValue(0);
                    setLocalDiscountAmount(0);
                    setLocalDiscountReason("");
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max={localDiscountType === "percentage" ? 100 : undefined}
                value={localDiscountValue}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setLocalDiscountValue(val);

                  if (localDiscountType === "percentage") {
                    const maxPercentage = Math.min(100, val);
                    setLocalDiscountAmount((totalAmount * maxPercentage) / 100);
                  } else {
                    setLocalDiscountAmount(Math.min(val, totalAmount));
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                placeholder={localDiscountType === "percentage" ? "0" : "0"}
              />
              <span className="self-center text-gray-600 font-medium">
                {localDiscountType === "percentage" ? "%" : "Rp"}
              </span>
            </div>

            {localDiscountAmount > 0 && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-green-700">Diskon:</span>
                  <span className="font-bold text-green-800">
                    - Rp {localDiscountAmount.toLocaleString("id-ID")}
                  </span>
                </div>
                {localDiscountType === "percentage" && (
                  <div className="text-xs text-green-600 text-center mb-2">
                    ({localDiscountValue}% dari total)
                  </div>
                )}
                <input
                  type="text"
                  value={localDiscountReason}
                  onChange={(e) => setLocalDiscountReason(e.target.value)}
                  placeholder="Alasan Diskon (wajib)"
                  className="w-full px-2 py-1 text-sm border border-green-300 rounded focus:ring-1 focus:ring-green-500 focus:border-transparent text-gray-700 placeholder-green-500 bg-white"
                />
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-700">Jumlah Bayar</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    !isManualInput
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => setIsManualInput(false)}
                >
                  Quick
                </button>
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    isManualInput
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => setIsManualInput(true)}
                >
                  Manual
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 ml-2"
                  onClick={() => setPaymentAmount(0)}
                >
                  Clear
                </button>
              </div>
            </div>
            {!isManualInput ? (
              <>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[1000, 5000, 10000, 20000, 50000, 100000].map((nom) => (
                    <button
                      key={nom}
                      type="button"
                      className="py-3 rounded font-bold border border-green-200 text-green-800 text-base bg-green-50 hover:bg-green-100"
                      onClick={() => setPaymentAmount((prev) => prev + nom)}
                    >
                      {nom >= 1000 ? `${nom / 1000}K` : nom}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="w-full py-2 rounded bg-blue-100 border border-blue-200 text-blue-800 font-bold text-base hover:bg-blue-200 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setPaymentAmount(finalTotal)}
                  disabled={
                    loading ||
                    (localDiscountAmount > 0 && !localDiscountReason.trim())
                  }
                >
                  LUNAS (Rp {finalTotal.toLocaleString("id-ID")})
                </button>
              </>
            ) : (
              <input
                type="number"
                min={0}
                value={paymentAmount}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setPaymentAmount(val);
                }}
                className="w-full px-3 py-3 border rounded text-center text-2xl font-mono mb-2"
                placeholder="Masukkan nominal bayar"
              />
            )}
            <div className="text-center text-3xl font-mono font-bold py-2 border-b border-gray-200 mb-2">
              Rp {paymentAmount.toLocaleString("id-ID")}
            </div>
          </div>

          <div className="mb-4">
            <div className="font-medium text-gray-700 mb-1">Kembalian</div>
            <div className="text-2xl font-mono font-bold text-green-700 text-center">
              Rp{" "}
              {(() => {
                const change = paymentAmount - finalTotal;
                return change > 0 ? change.toLocaleString("id-ID") : 0;
              })()}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
              disabled={loading}
            >
              Batal
            </button>
            <button
              onClick={() =>
                onConfirm(
                  paymentMethod,
                  paymentAmount,
                  localDiscountAmount,
                  localDiscountType,
                  localDiscountValue,
                  localDiscountReason,
                )
              }
              className={`flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors ${
                paymentAmount < finalTotal || (localDiscountAmount > 0 && !localDiscountReason.trim())
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              disabled={
                paymentAmount < finalTotal ||
                loading ||
                (localDiscountAmount > 0 && !localDiscountReason.trim())
              }
            >
              Bayar & Mulai
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal Package Selection
const PackageSelectionModal = ({
  open,
  onClose,
  onSelectPackage,
  packages,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSelectPackage: (pkg: any) => void;
  packages: any[];
  loading: boolean;
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Pilih Paket</h2>
              <p className="text-gray-600">Pilih paket yang sesuai</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Memuat paket...</span>
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                Tidak ada paket tersedia untuk console ini
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => onSelectPackage(pkg)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                      <p className="text-sm text-gray-500">{pkg.code}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Durasi:</span>
                      <span className="font-medium">
                        {pkg.durationHours} jam {pkg.durationMinutes} menit
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Harga:</span>
                      <span className="font-medium text-blue-600">
                        Rp {Number(pkg.packagePrice || 0).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>

                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
                    Pilih Paket
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal End Rental (Cashier Style)
const EndRentalModal = ({
  open,
  onClose,
  onConfirm,
  calculateCurrentCost,
  formatElapsedHMS,
  loading,
}: {
  open: { session: any; productsTotal?: number } | null;
  onClose: () => void;
  onConfirm: (
    paymentMethod: "cash" | "card" | "transfer" | "qris",
    paymentAmount: number,
    discountAmount: number,
    discountType: "amount" | "percentage",
    discountValue: number,
    discountReason: string,
  ) => void;
  calculateCurrentCost: (session: any) => number;
  formatElapsedHMS: (startTime: string) => string;
  loading: boolean;
}) => {
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "card" | "transfer" | "qris"
  >("cash");
  const [isManualInput, setIsManualInput] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [discountType, setDiscountType] = useState<"amount" | "percentage">(
    "amount",
  );
  const [discountValue, setDiscountValue] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");

  const prevOpenRef = useRef<boolean>(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setPaymentMethod("cash");
      setPaymentAmount(0);
      setDiscountType("amount");
      setDiscountValue(0);
      setDiscountAmount(0);
      setDiscountReason("");
      setIsManualInput(false);
    }
    prevOpenRef.current = !!open;
  }, [open]);

  if (!open) return null;

  const rentalCost = open.session ? calculateCurrentCost(open.session) : 0;
  const productsTotal = open.productsTotal ?? 0;
  const subtotal = rentalCost + productsTotal;
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const change = paymentAmount - finalTotal;
  const isValidPayment =
    paymentAmount >= finalTotal &&
    (discountAmount <= 0 || (discountAmount > 0 && discountReason.trim()));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          {/* Header Total */}
          <div className="flex items-center justify-between mb-6">
            <div className="text-xl font-bold text-gray-700">Total:</div>
            <div className="text-right">
              {discountAmount > 0 && (
                <div className="text-sm text-gray-500 line-through">
                  Rp {subtotal.toLocaleString("id-ID")}
                </div>
              )}
              <div className="text-2xl font-bold text-blue-700">
                Rp {finalTotal.toLocaleString("id-ID")}
              </div>
            </div>
          </div>

          {/* Metode Pembayaran */}
          <div className="mb-4">
            <div className="mb-2 font-medium text-gray-700">
              Metode Pembayaran
            </div>
            <div className="flex gap-2 mb-2">
              {[
                {
                  key: "cash",
                  label: "Cash",
                  icon: <span className="inline-block mr-1"></span>,
                },
                {
                  key: "card",
                  label: "Card",
                  icon: <span className="inline-block mr-1"></span>,
                },
                {
                  key: "transfer",
                  label: "Transfer",
                  icon: <span className="inline-block mr-1"></span>,
                },
              ].map((method) => (
                <button
                  key={method.key}
                  type="button"
                  className={`flex-1 py-2 rounded-md font-semibold border text-base transition-colors flex items-center justify-center gap-2 ${
                    paymentMethod === method.key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                  }`}
                  onClick={() =>
                    setPaymentMethod(
                      method.key as "cash" | "card" | "transfer" | "qris",
                    )
                  }
                >
                  {method.icon} {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Detail Info */}
          <div className="mb-4 text-sm text-gray-600">
            {open.session && (
              <>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-medium">
                    {open.session.customers?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Durasi:</span>
                  <span className="font-medium">
                    {formatElapsedHMS(open.session.start_time)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Rental:</span>
                  <span className="font-medium">
                    Rp {rentalCost.toLocaleString("id-ID")}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span>Total Produk:</span>
              <span className="font-medium">
                Rp {productsTotal.toLocaleString("id-ID")}
              </span>
            </div>
          </div>

          {/* DISKON SECTION */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-700">Diskon</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    discountType === "amount"
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => {
                    setDiscountType("amount");
                    setDiscountValue(0);
                    setDiscountAmount(0);
                    setDiscountReason("");
                  }}
                >
                  Rp
                </button>
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    discountType === "percentage"
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  onClick={() => {
                    setDiscountType("percentage");
                    setDiscountValue(0);
                    setDiscountAmount(0);
                    setDiscountReason("");
                  }}
                >
                  %
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 ml-2"
                  onClick={() => {
                    setDiscountValue(0);
                    setDiscountAmount(0);
                    setDiscountReason("");
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max={discountType === "percentage" ? 100 : undefined}
                value={discountValue}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setDiscountValue(val);
                  if (discountType === "percentage") {
                    const maxPercentage = Math.min(100, val);
                    setDiscountAmount((subtotal * maxPercentage) / 100);
                  } else {
                    setDiscountAmount(Math.min(val, subtotal));
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                placeholder="0"
              />
              <span className="self-center text-gray-600 font-medium">
                {discountType === "percentage" ? "%" : "Rp"}
              </span>
            </div>

            {discountAmount > 0 && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-green-700">Diskon:</span>
                  <span className="font-bold text-green-800">
                    - Rp {discountAmount.toLocaleString("id-ID")}
                  </span>
                </div>
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Alasan Diskon (wajib)"
                  className="w-full px-2 py-1 text-sm border border-green-300 rounded focus:ring-1 focus:ring-green-500 focus:border-transparent text-gray-700 placeholder-green-500 bg-white"
                />
              </div>
            )}
          </div>

          {/* Jumlah Bayar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-700">Jumlah Bayar</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${!isManualInput ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-700"}`}
                  onClick={() => setIsManualInput(false)}
                >
                  Quick
                </button>
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${isManualInput ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-700"}`}
                  onClick={() => setIsManualInput(true)}
                >
                  Manual
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 ml-2"
                  onClick={() => setPaymentAmount(0)}
                >
                  Clear
                </button>
              </div>
            </div>
            {!isManualInput ? (
              <>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[1000, 5000, 10000, 20000, 50000, 100000].map((nom) => (
                    <button
                      key={nom}
                      type="button"
                      className="py-3 rounded font-bold border border-green-200 text-green-800 text-base bg-green-50 hover:bg-green-100"
                      onClick={() => setPaymentAmount((prev) => prev + nom)}
                    >
                      {nom >= 1000 ? `${nom / 1000}K` : nom}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="w-full py-2 rounded bg-blue-100 border border-blue-200 text-blue-800 font-bold text-base hover:bg-blue-200 mb-2"
                  onClick={() => setPaymentAmount(finalTotal)}
                >
                  LUNAS (Rp {finalTotal.toLocaleString("id-ID")})
                </button>
              </>
            ) : (
              <input
                type="number"
                min={0}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-3 border rounded text-center text-2xl font-mono mb-2"
                placeholder="0"
              />
            )}
            <div className="text-center text-3xl font-mono font-bold py-2 border-b border-gray-200 mb-2">
              Rp {paymentAmount.toLocaleString("id-ID")}
            </div>
          </div>

          {/* Kembalian */}
          <div className="mb-4">
            <div className="font-medium text-gray-700 mb-1">Kembalian</div>
            <div className="text-2xl font-mono font-bold text-green-700 text-center">
              Rp {change > 0 ? change.toLocaleString("id-ID") : 0}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() =>
                onConfirm(
                  paymentMethod,
                  paymentAmount,
                  discountAmount,
                  discountType,
                  discountValue,
                  discountReason,
                )
              }
              disabled={loading || !isValidPayment}
              className={`flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors ${loading || !isValidPayment ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {loading ? "Memproses..." : "Bayar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveRentals;
