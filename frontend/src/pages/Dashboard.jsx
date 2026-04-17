import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { StatusBadge } from "../components/StatusBadge";
import { Search, Plus, Sparkles, RefreshCw, Ship, BookMarked, Bell, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const STATUS_FILTERS = ["all", "draft", "under_review", "approved", "fixed"];
const STATUS_LABEL = { all: "All", draft: "Draft", under_review: "Under Review", approved: "Approved", fixed: "Fixed" };

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [recaps, setRecaps] = useState([]);
    const [stats, setStats] = useState({ total: 0, by_status: {}, clauses: { total: 0, approved: 0 } });
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [r, s, a] = await Promise.all([api.get("/recaps"), api.get("/stats"), api.get("/alerts")]);
            setRecaps(r.data);
            setStats(s.data);
            setAlerts(a.data);
        } catch (e) {
            toast.error("Failed to load dashboard");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const filtered = useMemo(() => {
        return recaps.filter((r) => {
            if (statusFilter !== "all" && r.status !== statusFilter) return false;
            if (!q) return true;
            const s = q.toLowerCase();
            return (
                r.vessel_name?.toLowerCase().includes(s) ||
                r.charterer?.toLowerCase().includes(s) ||
                r.charter_party_id?.toLowerCase().includes(s) ||
                r.structured?.cargo_type?.toLowerCase().includes(s) ||
                r.structured?.load_port?.toLowerCase().includes(s) ||
                r.structured?.discharge_port?.toLowerCase().includes(s)
            );
        });
    }, [recaps, q, statusFilter]);

    const seed = async () => {
        try {
            await api.post("/seed");
            toast.success("Demo data loaded (recaps + clauses)");
            fetchAll();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Seed failed — admin role required");
        }
    };

    const criticalAlerts = alerts.filter(a => a.severity === "critical").length;

    return (
        <div className="max-w-7xl mx-auto px-8 py-8" data-testid="dashboard-page">
            {/* Header */}
            <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-bahri-blue">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-4 bg-bahri-orange"></div>
                        <div className="label-caps">Command Center</div>
                    </div>
                    <h1 className="font-heading text-5xl font-black tracking-tighter text-bahri-blue leading-none">Dashboard</h1>
                    <p className="text-sm text-zinc-500 mt-3">
                        Welcome back, {user?.name} · <span className="text-bahri-orange font-semibold">{stats.total}</span> fixtures ·
                        <span className="text-bahri-orange font-semibold"> {stats.clauses?.total || 0}</span> clauses
                        {criticalAlerts > 0 && <span className="ml-2 text-red-600 font-semibold">· {criticalAlerts} critical alerts</span>}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button data-testid="refresh-btn" onClick={fetchAll}
                        className="border border-zinc-300 hover:border-bahri-blue rounded-none px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" strokeWidth={1.5} /> Refresh
                    </button>
                    {user?.role === "admin" && (
                        <button data-testid="seed-demo-btn" onClick={seed}
                            className="border border-zinc-300 hover:border-bahri-blue rounded-none px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2">
                            <Sparkles className="w-4 h-4" strokeWidth={1.5} /> Load Demo
                        </button>
                    )}
                    <button data-testid="new-recap-btn" onClick={() => navigate("/recaps/new")}
                        className="bg-bahri-orange hover:bg-bahri-orange-600 text-white rounded-none px-5 py-2.5 text-sm font-semibold transition-colors flex items-center gap-2">
                        <Plus className="w-4 h-4" strokeWidth={2} /> New Recap
                    </button>
                </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-0 border border-zinc-200 mb-6">
                {[
                    { key: "total", label: "Total Recaps", value: stats.total, color: "text-bahri-blue" },
                    { key: "draft", label: "Draft", value: stats.by_status?.draft || 0, color: "text-zinc-700" },
                    { key: "under_review", label: "Under Review", value: stats.by_status?.under_review || 0, color: "text-amber-700" },
                    { key: "approved", label: "Approved", value: stats.by_status?.approved || 0, color: "text-bahri-blue" },
                    { key: "fixed", label: "Fixed", value: stats.by_status?.fixed || 0, color: "text-emerald-700" },
                    { key: "clauses", label: "Clauses", value: stats.clauses?.total || 0, color: "text-bahri-orange" },
                ].map((s, i) => (
                    <div key={s.key} className={`p-5 ${i !== 5 ? "border-r border-zinc-200" : ""}`} data-testid={`stat-${s.key}`}>
                        <div className="label-caps mb-2">{s.label}</div>
                        <div className={`font-heading text-3xl font-black tracking-tighter ${s.color}`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Alerts + Shortcuts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 mb-8 border border-zinc-200">
                <button onClick={() => navigate("/clauses")} className="p-5 text-left hover:bg-zinc-50 transition-colors border-r border-zinc-200 flex items-center gap-4" data-testid="shortcut-clauses">
                    <div className="w-10 h-10 bg-bahri-blue-50 border border-bahri-blue/20 flex items-center justify-center">
                        <BookMarked className="w-5 h-5 text-bahri-blue" strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="font-heading font-bold text-zinc-950">Clause Library</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{stats.clauses?.approved || 0} approved / {stats.clauses?.total || 0} total</div>
                    </div>
                </button>
                <button onClick={() => navigate("/alerts")} className="p-5 text-left hover:bg-zinc-50 transition-colors border-r border-zinc-200 flex items-center gap-4" data-testid="shortcut-alerts">
                    <div className={`w-10 h-10 border flex items-center justify-center ${criticalAlerts > 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                        <Bell className={`w-5 h-5 ${criticalAlerts > 0 ? "text-red-600" : "text-amber-700"}`} strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="font-heading font-bold text-zinc-950">Alerts</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{alerts.length} active · {criticalAlerts} critical</div>
                    </div>
                </button>
                <a
                    href="https://app.powerbi.com"
                    target="_blank" rel="noreferrer"
                    className="p-5 text-left hover:bg-zinc-50 transition-colors flex items-center gap-4"
                    data-testid="shortcut-powerbi"
                >
                    <div className="w-10 h-10 bg-bahri-orange/10 border border-bahri-orange/20 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-bahri-orange" strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="font-heading font-bold text-zinc-950">Power BI Reports</div>
                        <div className="text-xs text-zinc-500 mt-0.5">Fixtures, brokers, compliance ↗</div>
                    </div>
                </a>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" strokeWidth={1.5} />
                    <input data-testid="search-input" value={q} onChange={(e) => setQ(e.target.value)}
                        placeholder="Search vessel, charterer, CP ID, cargo, port..."
                        className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 rounded-none text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none" />
                </div>
                <div className="flex gap-0 border border-zinc-300">
                    {STATUS_FILTERS.map((s, i) => (
                        <button key={s} data-testid={`filter-${s}`} onClick={() => setStatusFilter(s)}
                            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                                i !== 0 ? "border-l border-zinc-300" : ""
                            } ${statusFilter === s ? "bg-bahri-blue text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}>
                            {STATUS_LABEL[s]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="border border-zinc-200 bg-white">
                <div className="grid grid-cols-12 border-b-2 border-bahri-blue bg-bahri-blue-50 py-3 px-4 label-caps text-bahri-blue">
                    <div className="col-span-3">Vessel · CP ID</div>
                    <div className="col-span-2">Charterer</div>
                    <div className="col-span-2">Cargo</div>
                    <div className="col-span-2">Laycan / Freight</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-1 text-right">Rev</div>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-sm text-zinc-500" data-testid="loading-state">Loading fixtures...</div>
                ) : filtered.length === 0 ? (
                    <div className="py-20 text-center" data-testid="empty-state">
                        <Ship className="w-10 h-10 mx-auto text-zinc-300 mb-4" strokeWidth={1.5} />
                        <div className="font-heading font-bold text-lg text-zinc-950 mb-1">No fixtures yet</div>
                        <div className="text-sm text-zinc-500 mb-6">Create your first recap or load demo data.</div>
                        <div className="flex items-center gap-3 justify-center">
                            <button onClick={() => navigate("/recaps/new")} className="bg-bahri-orange hover:bg-bahri-orange-600 text-white rounded-none px-5 py-2.5 text-sm font-semibold transition-colors" data-testid="empty-create-btn">Create Recap</button>
                            {user?.role === "admin" && (
                                <button onClick={seed} className="border border-zinc-300 hover:border-bahri-blue rounded-none px-5 py-2.5 text-sm font-medium transition-colors" data-testid="empty-seed-btn">Load Demo</button>
                            )}
                        </div>
                    </div>
                ) : (
                    filtered.map((r) => (
                        <div key={r.id} data-testid={`recap-row-${r.id}`}
                            onClick={() => navigate(`/recaps/${r.id}`)}
                            className="grid grid-cols-12 border-b border-zinc-100 py-4 px-4 cursor-pointer hover:bg-bahri-blue-50 transition-colors">
                            <div className="col-span-3">
                                <div className="font-semibold text-zinc-950 text-sm">{r.vessel_name}</div>
                                <div className="text-xs font-mono text-bahri-orange mt-0.5">{r.charter_party_id}</div>
                                <div className="text-xs text-zinc-500 mt-0.5">{r.structured?.load_port || "—"} → {r.structured?.discharge_port || "—"}</div>
                            </div>
                            <div className="col-span-2 text-sm text-zinc-800 pt-0.5">{r.charterer}</div>
                            <div className="col-span-2 text-sm text-zinc-700 pt-0.5">
                                <div>{r.structured?.cargo_type || "—"}</div>
                                <div className="text-xs text-zinc-500">{r.structured?.cargo_quantity || ""}</div>
                            </div>
                            <div className="col-span-2 text-sm text-zinc-700 pt-0.5 font-mono">
                                <div>{r.structured?.laycan_start} – {r.structured?.laycan_end}</div>
                                <div className="text-xs text-zinc-500">{r.structured?.freight || "—"}</div>
                            </div>
                            <div className="col-span-2 pt-0.5"><StatusBadge status={r.status} /></div>
                            <div className="col-span-1 text-right text-xs font-mono text-zinc-500 pt-1">v{r.versions?.length || 1}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
