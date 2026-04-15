import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { supabase } from "../lib/supabase";
import type { RFIDCard } from "../types";
import type { CardUsageLog } from "../types";
import {
  Plus,
  CreditCard,
  Shield,
  Users,
  Settings,
  UserCheck,
  UserX,
  Trash2,
  Edit,
  History,
  LayoutGrid,
  List as ListIcon,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Star,
} from "lucide-react";

const RFIDCards: React.FC = () => {
  const [cards, setCards] = useState<RFIDCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [editAlias, setEditAlias] = useState("");
  const [uidInput, setUidInput] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [onlyAdmin, setOnlyAdmin] = useState<"all" | "admin" | "customer">(
    "all"
  );
  // keep setter referenced to avoid unused-local TypeScript diagnostic when it's intentionally unused
  void setOnlyAdmin;
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [activeTab, setActiveTab] = useState<"management" | "laporan">(
    (localStorage.getItem("rfid_active_tab") as "management" | "laporan") ||
      "management"
  );

  useEffect(() => {
    try {
      localStorage.setItem("rfid_active_tab", activeTab);
    } catch {}
  }, [activeTab]);

  // laporan state (summary and logs)
  const [searchTerm, setSearchTerm] = useState("");
  const [searchExact, setSearchExact] = useState<boolean>(false);
  const [purchasePeriod, setPurchasePeriod] = useState<string>("today");
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [laporanLoading, setLaporanLoading] = useState<boolean>(false);
  const [laporanSummary, setLaporanSummary] = useState<any[]>([]);
  const [laporanLogs, setLaporanLogs] = useState<any[]>([]);
  const [groupByDateUid, setGroupByDateUid] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("rfid_groupByDateUid");
      return v ? JSON.parse(v) : false;
    } catch {
      return false;
    }
  });

  // server-provided grouped summary (preferred when available)
  const [laporanGroupedRpc, setLaporanGroupedRpc] = useState<any[] | null>(
    null
  );

  // grouped view computed client-side (fallback)
  const laporanGrouped = useMemo(() => {
    if (!groupByDateUid) return null;
    const grouped: Record<string, Record<string, any>> = {};
    laporanLogs.forEach((row: any) => {
      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const uid = (row.card_uid || "").toLowerCase();
        if (searchExact) {
          if (uid !== term) return;
        } else {
          if (!uid.includes(term)) return;
        }
      }
      const dt = row.timestamp
        ? new Date(row.timestamp).toISOString().slice(0, 10)
        : "<unknown>";
      const uid = row.card_uid || "<unknown>";
      if (!grouped[dt]) grouped[dt] = {};
      if (!grouped[dt][uid])
        grouped[dt][uid] = {
          date: dt,
          card_uid: uid,
          total_add: 0,
          total_deduct: 0,
          net_change: 0,
          events: [],
        };
      const entry = grouped[dt][uid];
      const amt = Number(row.points_amount || 0);
      if (row.action_type === "balance_add") entry.total_add += amt;
      if (row.action_type === "balance_deduct") entry.total_deduct += amt;
      entry.net_change = entry.total_add - entry.total_deduct;
      entry.events.push(row);
    });
    // convert to array per date
    const result: Array<{ date: string; rows: any[] }> = Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        rows: Object.values(grouped[date]).sort(
          (x: any, y: any) => y.net_change - x.net_change
        ),
      }));
    return result;
  }, [groupByDateUid, laporanLogs]);
  // expand/collapse state for grouped view
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>(
    {}
  );
  const [expandedUid, setExpandedUid] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [sortByPerDate, setSortByPerDate] = useState<Record<string, string>>(
    {}
  );
  // initialize expanded/sort state from localStorage
  useEffect(() => {
    try {
      const ed = localStorage.getItem("rfid_expandedDates");
      const eu = localStorage.getItem("rfid_expandedUid");
      const sp = localStorage.getItem("rfid_sortByPerDate");
      if (ed) setExpandedDates(JSON.parse(ed));
      if (eu) setExpandedUid(JSON.parse(eu));
      if (sp) setSortByPerDate(JSON.parse(sp));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "rfid_groupByDateUid",
        JSON.stringify(groupByDateUid)
      );
    } catch {}
  }, [groupByDateUid]);

  useEffect(() => {
    try {
      localStorage.setItem("rfid_expandedDates", JSON.stringify(expandedDates));
    } catch {}
  }, [expandedDates]);

  useEffect(() => {
    try {
      localStorage.setItem("rfid_expandedUid", JSON.stringify(expandedUid));
    } catch {}
  }, [expandedUid]);

  useEffect(() => {
    try {
      localStorage.setItem("rfid_sortByPerDate", JSON.stringify(sortByPerDate));
    } catch {}
  }, [sortByPerDate]);

  const toggleDate = (date: string) => {
    setExpandedDates((s) => ({ ...s, [date]: !s[date] }));
  };

  const toggleUid = (date: string, uid: string) => {
    setExpandedUid((s) => ({
      ...s,
      [date]: { ...(s[date] || {}), [uid]: !(s[date]?.[uid] || false) },
    }));
  };

  const expandAllDates = () => {
    const map: Record<string, boolean> = {};
    laporanGrouped?.forEach((g: any) => (map[g.date] = true));
    setExpandedDates(map);
  };

  const collapseAllDates = () => {
    setExpandedDates({});
    setExpandedUid({});
  };

  const setSortForDate = (date: string, sortKey: string) => {
    setSortByPerDate((s) => ({ ...s, [date]: sortKey }));
  };

  const filtered = useMemo(() => {
    if (onlyAdmin === "all") return cards;
    if (onlyAdmin === "admin") return cards.filter((c) => c.is_admin);
    return cards.filter((c) => !c.is_admin);
  }, [cards, onlyAdmin]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rfid_cards")
      .select(
        `
        id, alias, is_admin, is_helper_card, is_pay_as_you_go_card, uid, status, created_at, balance_points, avg_nilai_point
      `
      )
      .order("created_at", { ascending: false });
    if (!error && Array.isArray(data)) {
      setCards(data as RFIDCard[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("rfid_cards_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rfid_cards" },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addCard = async () => {
    if (!uidInput.trim()) return;
    try {
      await supabase.from("rfid_cards").insert({
        uid: uidInput.trim(),
        status: "active",
        is_admin: false,
      });
      setUidInput("");
    } catch (error: any) {
      if (
        error.code === "23505" &&
        error.message.includes("unique_customer_card")
      ) {
        alert(
          "Customer ini sudah memiliki kartu. Silakan unassign kartu lama terlebih dahulu."
        );
      } else {
        alert("Error: " + (error.message || "Gagal menambah kartu"));
      }
    }
  };

  // const toggleAdmin = async (card: RFIDCard) => {
  //   try {
  //     await supabase
  //       .from("rfid_cards")
  //       .update({ is_admin: !card.is_admin })
  //       .eq("id", card.id);
  //     Swal.fire(
  //       "Berhasil",
  //       `Status admin kartu berhasil diubah menjadi ${
  //         !card.is_admin ? "Admin" : "Customer"
  //       }`,
  //       "success"
  //     );
  //     load();
  //   } catch (e: any) {
  //     Swal.fire("Gagal", e?.message || String(e), "error");
  //   }
  // };

  const blockCard = async (card: RFIDCard) => {
    await supabase
      .from("rfid_cards")
      .update({ status: card.status === "active" ? "blocked" : "active" })
      .eq("id", card.id);
    Swal.fire(
      "Berhasil",
      `Kartu berhasil diubah menjadi status "${
        card.status === "active" ? "blocked" : "active".toUpperCase()
      }"`,
      "success"
    );

    load();
  };

  // Edit/Delete state & handlers
  const [editCard, setEditCard] = useState<
    (RFIDCard & { customers?: { name: string; phone: string } | null }) | null
  >(null);
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editIsHelper, setEditIsHelper] = useState(false);
  const [editIsPayAsYouGo, setEditIsPayAsYouGo] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // History modal state
  const [historyCard, setHistoryCard] = useState<RFIDCard | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<CardUsageLog[]>([]);

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

    Object.values(grouped).forEach((session) => {
      const start = new Date(session.firstTimestamp);
      const end = new Date(session.lastTimestamp);
      const diffMs = end.getTime() - start.getTime();
      const diffMinutes = Math.ceil(diffMs / 60000);
      session.notes = `Automatic deduction for rental session - ${diffMinutes} minutes`;
    });

    return Object.values(grouped);
  }

  const openHistory = async (card: RFIDCard) => {
    setHistoryCard(card);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("card_usage_logs")
        .select(
          "id, card_uid, session_id, action_type, points_amount, balance_before, balance_after, timestamp, notes"
        )
        .eq("card_uid", card.uid)
        .order("timestamp", { ascending: false });
      if (error) throw error;

      setHistoryLogs((data || []) as unknown as CardUsageLog[]);
      console.log(data);
    } catch (e) {
      console.error("load card history error", e);
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Fetch laporan (summary + logs) based on selected period / range
  const fetchLaporan = async () => {
    setLaporanLoading(true);
    try {
      let s: string | null = null;
      let e: string | null = null;
      const now = new Date();
      switch (purchasePeriod) {
        case "today":
          s = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          ).toISOString();
          e = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999
          ).toISOString();
          break;
        case "yesterday": {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          s = new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate()
          ).toISOString();
          e = new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate(),
            23,
            59,
            59,
            999
          ).toISOString();
          break;
        }
        case "week": {
          const d = new Date();
          const day = d.getDay();
          const diff = (day === 0 ? -6 : 1) - day; // Monday start
          const start = new Date();
          start.setDate(d.getDate() + diff);
          s = new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate()
          ).toISOString();
          e = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999
          ).toISOString();
          break;
        }
        case "month":
          s = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          e = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
          ).toISOString();
          break;
        case "range":
          s = startDate ? new Date(startDate).toISOString() : null;
          e = endDate ? new Date(endDate).toISOString() : null;
          break;
      }

      console.log("fetchLaporan params", { start_ts: s, end_ts: e });

      // Attempt RPC summary first. If RPC is not found or fails (e.g., not deployed),
      // we'll fallback to computing the summary client-side from the logs we fetch below.
      let usedRpc = true;
      try {
        // supabase.rpc usually returns { data, error } in v2. We'll be defensive here.
        // @ts-ignore
        const rpcRes = await supabase.rpc("rpc_card_usage_summary", {
          start_ts: s,
          end_ts: e,
        });
        // @ts-ignore
        const rpcError = rpcRes?.error;
        // @ts-ignore
        const rpcData = rpcRes?.data ?? rpcRes;
        if (rpcError) throw rpcError;
        console.log(
          "summaryData length",
          Array.isArray(rpcData) ? rpcData.length : 0
        );
        setLaporanSummary(Array.isArray(rpcData) ? rpcData : []);
      } catch (rpcErr: any) {
        usedRpc = false;
        console.warn(
          "rpc_card_usage_summary unavailable or failed, will compute summary client-side:",
          rpcErr?.message || rpcErr
        );
        // clear summary for now; we'll fill it after fetching logs
        setLaporanSummary([]);
      }

      // Fetch logs (always fetch; needed both for display and for client-side summary fallback)
      let logsQuery = supabase
        .from("card_usage_logs")
        .select(
          "id, card_uid, session_id, used_by_name, used_by_phone, action_type, points_amount, balance_before, balance_after, timestamp, notes"
        )
        .order("timestamp", { ascending: false })
        .limit(2000);
      if (s) logsQuery = logsQuery.gte("timestamp", s);
      if (e) logsQuery = logsQuery.lte("timestamp", e);
      if (searchTerm && searchTerm.trim()) {
        if (searchExact) {
          logsQuery = logsQuery.eq("card_uid", searchTerm.trim());
        } else {
          logsQuery = logsQuery.ilike("card_uid", `%${searchTerm.trim()}%`);
        }
      }
      const { data: logsData, error: logsError } = await logsQuery;
      if (logsError) throw logsError;
      console.log(
        "logsData length",
        Array.isArray(logsData) ? logsData.length : 0
      );
      const logsArr = Array.isArray(logsData) ? logsData : [];
      setLaporanLogs(logsArr);

      // Try server-side grouped RPC (preferred for large ranges)
      try {
        // @ts-ignore
        const rpcGrouped = await supabase.rpc("rpc_card_usage_grouped", {
          start_ts: s,
          end_ts: e,
          search_uid: searchTerm || null,
          search_exact: searchExact,
        });
        // @ts-ignore
        const rpcGroupedErr = rpcGrouped?.error;
        // @ts-ignore
        const rpcGroupedData = rpcGrouped?.data ?? rpcGrouped;
        if (!rpcGroupedErr && Array.isArray(rpcGroupedData)) {
          // Filter RPC grouped results by searchTerm if provided
          if (searchTerm && searchTerm.trim()) {
            const term = searchTerm.trim().toLowerCase();
            const filtered = rpcGroupedData
              .map((g: any) => ({
                ...g,
                uids: (g.uids || []).filter((u: any) =>
                  (u.card_uid || "").toLowerCase().includes(term)
                ),
              }))
              .filter((g: any) => (g.uids || []).length > 0);
            setLaporanGroupedRpc(filtered);
          } else {
            setLaporanGroupedRpc(rpcGroupedData);
          }
        } else {
          setLaporanGroupedRpc(null);
        }
      } catch (e) {
        setLaporanGroupedRpc(null);
      }

      // If RPC wasn't used (missing), compute a basic per-card summary client-side
      if (!usedRpc) {
        const grouped: Record<string, any> = {};
        logsArr.forEach((row: any) => {
          const key = row.card_uid || "<unknown>";
          if (!grouped[key])
            grouped[key] = {
              card_uid: key,
              total_add: 0,
              total_deduct: 0,
              net_change: 0,
              last_activity: row.timestamp,
            };
          if (row.action_type === "balance_add")
            grouped[key].total_add += Number(row.points_amount || 0);
          if (row.action_type === "balance_deduct")
            grouped[key].total_deduct += Number(row.points_amount || 0);
          grouped[key].net_change =
            grouped[key].total_add - grouped[key].total_deduct;
          if (
            !grouped[key].last_activity ||
            new Date(row.timestamp) > new Date(grouped[key].last_activity)
          ) {
            grouped[key].last_activity = row.timestamp;
          }
        });
        const summaryFromLogs = Object.values(grouped);
        console.log("computed summary length", summaryFromLogs.length);
        setLaporanSummary(summaryFromLogs);
      }
    } catch (err: any) {
      console.error("fetch laporan error", err);
      Swal.fire("Gagal", err?.message || "Gagal memuat laporan", "error");
    } finally {
      setLaporanLoading(false);
    }
  };

  const openEdit = (
    card: RFIDCard & { customers?: { name: string; phone: string } | null }
  ) => {
    setEditCard(card);
    setEditIsAdmin(card.is_admin);
    setEditIsHelper(card.is_helper_card);
    setEditIsPayAsYouGo(card.is_pay_as_you_go_card || false);
    setEditAlias(card.alias || "");
  };

  const saveEdit = async () => {
    if (!editCard) return;
    setSavingEdit(true);
    try {
      await supabase
        .from("rfid_cards")
        .update({
          is_admin: editIsAdmin,
          is_helper_card: editIsHelper,
          is_pay_as_you_go_card: editIsPayAsYouGo,
          alias: editAlias.trim() || null,
        })
        .eq("id", editCard.id);
      Swal.fire("Berhasil", "Kartu berhasil diperbarui", "success");
      load();
      setEditCard(null);
    } catch (e: any) {
      Swal.fire("Gagal", e?.message || String(e), "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteCard = async (
    card: RFIDCard & { customers?: { name: string; phone: string } | null }
  ) => {
    if (card.customers) {
      Swal.fire(
        "Tidak bisa menghapus",
        "Kartu sedang ter-assign ke customer. Unassign terlebih dahulu.",
        "warning"
      );
      return;
    }
    const confirmRes = await Swal.fire({
      title: "Hapus kartu?",
      text: `Kartu UID ${card.uid} akan dihapus permanen`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
    });
    if (!confirmRes.isConfirmed) return;
    try {
      await supabase.from("rfid_cards").delete().eq("id", card.id);
      Swal.fire("Berhasil", "Kartu berhasil dihapus", "success");
    } catch (e: any) {
      Swal.fire("Gagal", e?.message || String(e), "error");
    }
  };

  // const unassignFromCustomer = async (card: RFIDCard) => {
  //   // Get customer ID first
  //   const customerId = card.assigned_customer_id;
  //   if (customerId) {
  //     // Remove from customer's primary_card_id
  //     await supabase
  //       .from("customers")
  //       .update({ primary_card_id: null })
  //       .eq("id", customerId);
  //   }

  //   // Remove from card's assigned_customer_id
  //   await supabase
  //     .from("rfid_cards")
  //     .update({ assigned_customer_id: null })
  //     .eq("id", card.id);
  // };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Summary Stats */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CreditCard className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {cards.length}
          </h3>
          <p className="text-gray-600 text-sm">Total Kartu RFID</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {cards.filter((c) => c.is_admin).length}
          </h3>
          <p className="text-gray-600 text-sm">Kartu Admin</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Users className="h-6 w-6 text-purple-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {cards.filter((c) => !c.is_admin).length}
          </h3>
          <p className="text-gray-600 text-sm">Kartu Member</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Settings className="h-6 w-6 text-orange-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {cards.filter((c) => c.status === "active").length}
          </h3>
          <p className="text-gray-600 text-sm">Kartu Aktif</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Star className="h-6 w-6 text-yellow-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {cards
              .filter((c) => !c.is_admin)
              .reduce((sum, c) => sum + (Number(c.balance_points) || 0), 0)
              .toLocaleString()}
          </h3>
          <p className="text-gray-600 text-sm">Total Points Member</p>
        </div>
      </div>

      {/* Main Tabs (moved to top-level) */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6">
            {[
              { id: "management", label: "Management Kartu", icon: CreditCard },
              { id: "laporan", label: "Laporan", icon: History },
            ].map((tab) => {
              const Icon = (tab as any).icon as any;
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
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {activeTab === "management" && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Master Kartu RFID
              </h1>
              <p className="text-gray-600">
                Kelola kartu RFID untuk customer dan admin
              </p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {activeTab !== "laporan" && (
              <>
                <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
                  <button
                    onClick={() => setViewMode("card")}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                      viewMode === "card"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Card
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                      viewMode === "list"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <ListIcon className="h-4 w-4" />
                    List
                  </button>
                </div>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 justify-center"
                >
                  <Plus className="h-5 w-5" />
                  Tambah Kartu
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {activeTab === "management" ? (
        <>
          {loading && (
            <div className="text-center text-gray-500">Memuat data...</div>
          )}
          {!loading && cards.length === 0 && (
            <div className="text-center text-gray-400 py-10">
              Tidak ada data kartu RFID ditemukan.
            </div>
          )}
          {!loading && cards.length > 0 && (
            <>
              {filtered.length === 0 ? (
                <div className="text-center text-gray-400 py-10">
                  Tidak ada kartu sesuai filter.
                </div>
              ) : viewMode === "card" ? (
                <div
                  key={cards.map((c) => c.id).join(",")}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {/* Cards Grid */}
                  {filtered.map((card) => {
                    // const assigned =
                    //   Array.isArray(card.customers) && card.customers.length > 0;
                    // const customer = assigned ? card.customers[0] : null;
                    return (
                      <div
                        key={card.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {/* Header */}
                        <div
                          className={`p-4 text-white ${
                            !card.is_admin
                              ? "bg-gradient-to-r from-gray-600 to-gray-700"
                              : "bg-gradient-to-r from-blue-600 to-blue-700"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                                <CreditCard className="h-6 w-6" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg font-mono">
                                  {card.uid}
                                </h3>
                                {card.alias && (
                                  <span className="text-sm opacity-90">
                                    {card.alias}
                                  </span>
                                )}
                                {/* <span className="text-sm opacity-90">
                              {assigned
                                ? "Ter-assign ke customer"
                                : "Belum ter-assign"}
                            </span> */}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                card.status === "active"
                                  ? "bg-green-500 text-white"
                                  : card.status === "blocked"
                                  ? "bg-red-500 text-white"
                                  : "bg-gray-400 text-white"
                              }`}
                            >
                              {card.status.toUpperCase()}
                            </span>
                            {card.is_admin && (
                              <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-yellow-500 text-white">
                                ADMIN
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Body */}
                        <div className="p-4">
                          <div className="space-y-4">
                            {/* Customer Info */}
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Informasi Customer
                              </h4>
                              <div className="flex flex-col gap-1 text-md text-gray-700">
                                <div className="flex justify-between">
                                  <span className="font-medium">Points:</span>
                                  <span className="font-mono">
                                    {card.balance_points}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="font-medium">
                                    Average (Rupiah per Point):
                                  </span>
                                  <span className="font-mono">
                                    {card.avg_nilai_point}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="font-medium">Status:</span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-sm font-semibold ${
                                      card.status === "active"
                                        ? "bg-green-100 text-green-700"
                                        : card.status === "blocked"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-gray-100 text-gray-700"
                                    }`}
                                  >
                                    {card.status.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-4 border-t border-gray-100">
                              <div className="flex gap-2 justify-end">
                                {/* <button
                              onClick={() => toggleAdmin(card)}
                              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                                !card.is_admin
                                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                                  : "bg-gray-500 hover:bg-gray-600 text-white"
                              }`}
                            >
                              <Shield className="h-4 w-4" />
                              {card.is_admin ? "Remove Admin" : "Make Admin"}
                            </button> */}
                                <button
                                  onClick={() => blockCard(card)}
                                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                                    card.status === "active"
                                      ? "bg-red-500 hover:bg-red-600 text-white"
                                      : "bg-green-500 hover:bg-green-600 text-white"
                                  }`}
                                >
                                  {card.status === "active" ? (
                                    <>
                                      <UserX className="h-4 w-4" />
                                      Block
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-4 w-4" />
                                      Unblock
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => openEdit(card as any)}
                                  className="p-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg transition-colors flex items-center justify-center"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openHistory(card)}
                                  className="p-2 border border-blue-300 hover:border-blue-400 text-blue-600 rounded-lg transition-colors flex items-center justify-center"
                                >
                                  <History className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteCard(card as any)}
                                  className="p-2 border border-red-300 hover:border-red-400 text-red-600 rounded-lg transition-colors flex items-center justify-center"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            UID & Alias
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tipe
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Points
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {filtered.map((card) => (
                          <tr key={card.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="text-sm font-semibold text-gray-900 font-mono">
                                {card.uid}
                              </div>
                              {card.alias && (
                                <div className="text-sm text-gray-500">
                                  {card.alias}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  card.is_admin
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {card.is_admin ? "Admin" : "Member"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                                  card.status === "active"
                                    ? "bg-green-100 text-green-700"
                                    : card.status === "blocked"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {card.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-sm text-gray-900">
                                {typeof card.balance_points === "number"
                                  ? card.balance_points.toLocaleString()
                                  : card.balance_points ?? "-"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => blockCard(card)}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                    card.status === "active"
                                      ? "bg-red-500 hover:bg-red-600 text-white"
                                      : "bg-green-500 hover:bg-green-600 text-white"
                                  }`}
                                >
                                  {card.status === "active" ? (
                                    <>
                                      <UserX className="h-4 w-4" />
                                      Block
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-4 w-4" />
                                      Unblock
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => openEdit(card as any)}
                                  className="p-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg transition-colors flex items-center justify-center"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openHistory(card)}
                                  className="p-2 border border-blue-300 hover:border-blue-400 text-blue-600 rounded-lg transition-colors flex items-center justify-center"
                                >
                                  <History className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteCard(card as any)}
                                  className="p-2 border border-red-300 hover:border-red-400 text-red-600 rounded-lg transition-colors flex items-center justify-center"
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
                </div>
              )}

              {/* Add Modal */}
              {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
                    <div className="p-6">
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Tambah Kartu RFID
                      </h2>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            UID Kartu
                          </label>
                          <input
                            value={uidInput}
                            onChange={(e) => setUidInput(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Masukkan UID kartu"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button
                          onClick={() => setShowAddModal(false)}
                          className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          onClick={async () => {
                            setUidInput(uidInput);
                            await addCard();
                            setShowAddModal(false);
                            setUidInput("");
                            Swal.fire(
                              "Berhasil",
                              "Kartu berhasil ditambahkan!",
                              "success"
                            );
                            load();
                          }}
                          disabled={!uidInput.trim()}
                          className={`flex-1 ${
                            !uidInput.trim()
                              ? "bg-blue-400"
                              : "bg-blue-600 hover:bg-blue-700"
                          } text-white px-4 py-2 rounded-lg font-medium transition-colors`}
                        >
                          Simpan
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Modal */}
              {editCard && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-semibold text-gray-900">
                          Edit Kartu
                        </h2>
                        <button
                          onClick={() => setEditCard(null)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ×
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            UID
                          </label>
                          <input
                            value={editCard.uid}
                            disabled
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Alias / Nama Kartu
                          </label>
                          <input
                            value={editAlias}
                            onChange={(e) => setEditAlias(e.target.value)}
                            placeholder="Contoh: Kartu Admin Utama"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <p className="mt-1 text-sm text-gray-500">
                            Alias memudahkan identifikasi kartu
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="edit-admin-only"
                            type="checkbox"
                            checked={editIsAdmin}
                            onChange={(e) => setEditIsAdmin(e.target.checked)}
                            className="rounded"
                          />
                          <label htmlFor="edit-admin-only" className="text-sm">
                            Kartu Admin
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="edit-helper-only"
                            type="checkbox"
                            checked={editIsHelper}
                            onChange={(e) => setEditIsHelper(e.target.checked)}
                            className="rounded"
                          />
                          <label htmlFor="edit-helper-only" className="text-sm">
                            Kartu Helper
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="edit-pay-as-you-go"
                            type="checkbox"
                            checked={editIsPayAsYouGo}
                            onChange={(e) =>
                              setEditIsPayAsYouGo(e.target.checked)
                            }
                            className="rounded"
                          />
                          <label
                            htmlFor="edit-pay-as-you-go"
                            className="text-sm"
                          >
                            Kartu Helper Pay-as-you-go
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button
                          onClick={() => setEditCard(null)}
                          className="flex-1 px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={savingEdit}
                          className={`flex-1 ${
                            savingEdit
                              ? "bg-blue-400"
                              : "bg-blue-600 hover:bg-blue-700"
                          } text-white px-4 py-2 rounded-lg font-medium transition-colors`}
                        >
                          {savingEdit ? "Menyimpan..." : "Simpan"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* History Modal */}
              {historyCard && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xl font-semibold text-gray-900">
                          Riwayat Points - UID {historyCard.uid}
                        </h2>
                        <button
                          onClick={() => {
                            setHistoryCard(null);
                            setHistoryLogs([]);
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ×
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
                              (log) => log.action_type === "balance_add"
                            );
                            const deductGrouped =
                              groupDeductLogsBySession(historyLogs);

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
                                new Date(a.timestamp).getTime()
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
                                      {new Date(
                                        item.timestamp
                                      ).toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Saldo:{" "}
                                      {item.balance_before?.toLocaleString()} →{" "}
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
                                      {new Date(
                                        item.timestamp
                                      ).toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Saldo:{" "}
                                      {item.balance_before?.toLocaleString()} →{" "}
                                      {item.balance_after?.toLocaleString()}
                                    </div>
                                    {item.notes && (
                                      <div className="text-xs text-gray-700 mt-1">
                                        {item.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Laporan</h2>
              <p className="text-gray-600">
                Laporan terkait kartu RFID (sementara placeholder)
              </p>
            </div>
            <div></div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Cari UID
                  </label>
                  <input
                    type="text"
                    placeholder="Cari UID atau sebagian UID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <input
                      id="search-exact"
                      type="checkbox"
                      checked={searchExact}
                      onChange={(e) => setSearchExact(e.target.checked)}
                      className="rounded"
                    />
                    <label
                      htmlFor="search-exact"
                      className="text-xs text-gray-600"
                    >
                      Exact match
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Periode
                  </label>
                  <select
                    value={purchasePeriod}
                    onChange={(e) => setPurchasePeriod(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                  >
                    <option value="today">Hari Ini</option>
                    <option value="yesterday">Kemarin</option>
                    <option value="week">Minggu Ini</option>
                    <option value="month">Bulan Ini</option>
                    <option value="range">Rentang Waktu</option>
                  </select>
                  {purchasePeriod === "range" && (
                    <div className="flex items-center gap-2 mt-2">
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
                <div className="flex items-end">
                  <button
                    onClick={() => void fetchLaporan()}
                    className={`px-4 py-2 text-white rounded-lg ${
                      laporanLoading
                        ? "bg-blue-400"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {laporanLoading ? "Memuat..." : "Cari"}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4 mb-4">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={groupByDateUid}
                    onChange={(e) => setGroupByDateUid(e.target.checked)}
                  />
                  <span>Group by Tanggal & UID</span>
                </label>
              </div>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={expandAllDates}
                    className="px-3 py-1 bg-blue-50 text-blue-600 rounded"
                  >
                    Expand all
                  </button>
                  <button
                    onClick={collapseAllDates}
                    className="px-3 py-1 bg-gray-50 text-gray-700 rounded"
                  >
                    Collapse all
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  Group by shown: Tanggal & UID
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-xl p-4 border">
                  <div className="text-sm text-gray-500">
                    Total Kartu (summary rows)
                  </div>
                  <div className="text-xl font-semibold">
                    {laporanSummary.length}
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border">
                  <div className="text-sm text-gray-500">
                    Total Events (logs)
                  </div>
                  <div className="text-xl font-semibold">
                    {laporanLogs.length}
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border">
                  <div className="text-sm text-gray-500">
                    Net Change (sample)
                  </div>
                  <div className="text-xl font-semibold">
                    {laporanSummary
                      .reduce((s, r) => s + Number(r.net_change || 0), 0)
                      .toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                {groupByDateUid && (laporanGroupedRpc || laporanGrouped) ? (
                  <div className="p-4">
                    {(
                      (laporanGroupedRpc
                        ? laporanGroupedRpc
                        : laporanGrouped) as any[]
                    ).map((grp: any) => {
                      const sortKey = sortByPerDate[grp.date] || "net_change";
                      // normalize rows: RPC might return { date, uids: [{card_uid,...,events}] }
                      const rows = grp.rows ?? grp.uids ?? grp.items ?? [];
                      const rowsSorted = [...rows].sort((a: any, b: any) => {
                        if (sortKey === "net_change")
                          return b.net_change - a.net_change;
                        if (sortKey === "events")
                          return b.events.length - a.events.length;
                        return a.card_uid.localeCompare(b.card_uid);
                      });

                      return (
                        <div key={grp.date} className="mb-6">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="text-sm font-semibold">
                                {grp.date}
                              </div>
                              <select
                                value={sortByPerDate[grp.date] || "net_change"}
                                onChange={(e) =>
                                  setSortForDate(grp.date, e.target.value)
                                }
                                className="text-xs px-2 py-1 border rounded bg-white"
                              >
                                <option value="net_change">
                                  Sort: Net Change
                                </option>
                                <option value="events">Sort: Events</option>
                                <option value="uid">Sort: UID</option>
                              </select>
                            </div>
                            <div>
                              <button
                                onClick={() => toggleDate(grp.date)}
                                className="p-1 rounded hover:bg-gray-100"
                                aria-label={
                                  expandedDates[grp.date]
                                    ? "Collapse date"
                                    : "Expand date"
                                }
                              >
                                {expandedDates[grp.date] ? (
                                  <ChevronDown className="w-4 h-4 text-gray-600 rotate-180" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-600" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="overflow-x-auto bg-white rounded border">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    UID
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Events
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Total Add
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Total Deduct
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Net
                                  </th>
                                  <th className="px-4 py-2" />
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-100">
                                {rowsSorted.map((r: any) => (
                                  <React.Fragment
                                    key={grp.date + "::" + r.card_uid}
                                  >
                                    <tr className="hover:bg-gray-50">
                                      <td className="px-4 py-2 text-sm font-mono text-gray-900">
                                        {r.card_uid}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-700">
                                        {r.events.length}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-700">
                                        {r.total_add.toLocaleString()}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-700">
                                        {r.total_deduct.toLocaleString()}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-700">
                                        {r.net_change.toLocaleString()}
                                      </td>
                                      <td className="px-4 py-2 text-right">
                                        <button
                                          onClick={() =>
                                            toggleUid(grp.date, r.card_uid)
                                          }
                                          className="p-1 rounded hover:bg-gray-100"
                                          aria-label={
                                            expandedUid[grp.date]?.[r.card_uid]
                                              ? "Hide events"
                                              : "Show events"
                                          }
                                        >
                                          {expandedUid[grp.date]?.[
                                            r.card_uid
                                          ] ? (
                                            <ChevronUp className="w-4 h-4 text-gray-600" />
                                          ) : (
                                            <ChevronRight className="w-4 h-4 text-gray-600" />
                                          )}
                                        </button>
                                      </td>
                                    </tr>
                                    {expandedUid[grp.date]?.[r.card_uid] && (
                                      <tr>
                                        <td
                                          colSpan={6}
                                          className="bg-gray-50 px-4 py-2"
                                        >
                                          <div className="max-h-56 overflow-auto">
                                            <table className="min-w-full">
                                              <thead>
                                                <tr>
                                                  <th className="px-2 py-1 text-xs text-gray-500">
                                                    Waktu
                                                  </th>
                                                  <th className="px-2 py-1 text-xs text-gray-500">
                                                    Jenis
                                                  </th>
                                                  <th className="px-2 py-1 text-xs text-gray-500">
                                                    Amount
                                                  </th>
                                                  <th className="px-2 py-1 text-xs text-gray-500">
                                                    Saldo
                                                  </th>
                                                  <th className="px-2 py-1 text-xs text-gray-500">
                                                    Notes
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {r.events.map((ev: any) => (
                                                  <tr
                                                    key={ev.id}
                                                    className="text-sm text-gray-700"
                                                  >
                                                    <td className="px-2 py-1">
                                                      {new Date(
                                                        ev.timestamp
                                                      ).toLocaleString()}
                                                    </td>
                                                    <td className="px-2 py-1">
                                                      {ev.action_type}
                                                    </td>
                                                    <td className="px-2 py-1">
                                                      {Number(
                                                        ev.points_amount || 0
                                                      ).toLocaleString()}
                                                    </td>
                                                    <td className="px-2 py-1">
                                                      {(ev.balance_before ??
                                                        "-") +
                                                        " → " +
                                                        (ev.balance_after ??
                                                          "-")}
                                                    </td>
                                                    <td className="px-2 py-1">
                                                      {ev.notes || "-"}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
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
                      );
                    })}
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Waktu
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          UID
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Jenis
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Amount
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Saldo
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {laporanLogs.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center text-gray-400 py-6"
                          >
                            Tidak ada data
                          </td>
                        </tr>
                      )}
                      {laporanLogs.map((l: any) => (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {new Date(l.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm font-mono text-gray-900">
                            {l.card_uid}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {l.action_type}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {Number(l.points_amount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {(l.balance_before ?? "-") +
                              " → " +
                              (l.balance_after ?? "-")}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {l.notes || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RFIDCards;
