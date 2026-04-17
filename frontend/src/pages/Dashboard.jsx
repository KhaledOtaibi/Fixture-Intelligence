import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { StatusBadge } from "../components/StatusBadge";
import { Search, Plus, Sparkles, RefreshCw, Ship } from "lucide-react";
import { toast } from "sonner";

const STATUS_FILTERS = ["all", "draft", "under_review", "approved", "fixed"];
const STATUS_LABEL = { all: "All", draft: "Draft", under_review: "Under Review", approved: "Approved", fixed: "Fixed" };

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [recaps, setRecaps] = useState([]);
    const [stats, setStats] = useState({ total: 0, by_status: {} });
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [r, s] = await Promise.all([api.get("/recaps"), api.get("/stats")]);
            setRecaps(r.data);
            setStats(s.data);
        } catch (e) {
            toast.error("Failed to load fixtures");
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
                r.structured?.cargo_type?.toLowerCase().includes(s) ||
                r.structured?.load_port?.toLowerCase().includes(s) ||
                r.structured?.discharge_port?.toLowerCase().includes(s)
            );
        });
    }, [recaps, q, statusFilter]);

    const seed = async () => {
        try {
            await api.post("/seed");
            toast.success("Demo fixtures loaded");
            fetchAll();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Seed failed — admin role required");
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-8 py-8" data-testid="dashboard-page">
            {/* Header */}
            <div className="flex items-start justify-between mb-10 pb-6 border-b border-zinc-200">
                <div>
                    <div className="label-caps mb-2">Fixture Command Center</div>
                    <h1 className="font-heading text-5xl font-black tracking-tighter text-zinc-950 leading-none">Dashboard</h1>
                    <p className="text-sm text-zinc-500 mt-3">Welcome back, {user?.name}. {stats.total} fixtures tracked.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        data-testid="refresh-btn"
                        onClick={fetchAll}
                        className="border border-zinc-300 hover:border-zinc-500 rounded-none px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                        Refresh
                    </button>
                    {user?.role === "admin" && (
                        <button
                            data-testid="seed-demo-btn"
                            onClick={seed}
                            className="border border-zinc-300 hover:border-zinc-500 rounded-none px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                            Load Demo
                        </button>
                    )}
                    <button
                        data-testid="new-recap-btn"
                        onClick={() => navigate("/recaps/new")}
                        className="bg-zinc-950 hover:bg-zinc-800 text-white rounded-none px-5 py-2.5 text-sm font-semibold transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" strokeWidth={2} />
                        New Recap
                    </button>
                </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border border-zinc-200 mb-8">
                {[
                    { key: "total", label: "Total", value: stats.total, color: "text-zinc-950" },
                    { key: "draft", label: "Draft", value: stats.by_status?.draft || 0, color: "text-zinc-700" },
                    { key: "under_review", label: "Under Review", value: stats.by_status?.under_review || 0, color: "text-amber-700" },
                    { key: "approved", label: "Approved", value: stats.by_status?.approved || 0, color: "text-blue-700" },
                    { key: "fixed", label: "Fixed", value: stats.by_status?.fixed || 0, color: "text-emerald-700" },
                ].map((s, i) => (
                    <div key={s.key} className={`p-6 ${i !== 4 ? "border-r border-zinc-200" : ""}`} data-testid={`stat-${s.key}`}>
                        <div className="label-caps mb-2">{s.label}</div>
                        <div className={`font-heading text-4xl font-black tracking-tighter ${s.color}`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" strokeWidth={1.5} />
                    <input
                        data-testid="search-input"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search vessel, charterer, cargo, port..."
                        className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 rounded-none text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                </div>
                <div className="flex gap-0 border border-zinc-300">
                    {STATUS_FILTERS.map((s, i) => (
                        <button
                            key={s}
                            data-testid={`filter-${s}`}
                            onClick={() => setStatusFilter(s)}
                            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                                i !== 0 ? "border-l border-zinc-300" : ""
                            } ${
                                statusFilter === s
                                    ? "bg-zinc-950 text-white"
                                    : "bg-white text-zinc-700 hover:bg-zinc-50"
                            }`}
                        >
                            {STATUS_LABEL[s]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="border border-zinc-200 bg-white">
                <div className="grid grid-cols-12 border-b border-zinc-300 bg-zinc-50 py-3 px-4 label-caps">
                    <div className="col-span-3">Vessel</div>
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
                            <button
                                onClick={() => navigate("/recaps/new")}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-5 py-2.5 text-sm font-semibold transition-colors"
                                data-testid="empty-create-btn"
                            >
                                Create Recap
                            </button>
                            {user?.role === "admin" && (
                                <button
                                    onClick={seed}
                                    className="border border-zinc-300 hover:border-zinc-500 rounded-none px-5 py-2.5 text-sm font-medium transition-colors"
                                    data-testid="empty-seed-btn"
                                >
                                    Load Demo
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    filtered.map((r) => (
                        <div
                            key={r.id}
                            data-testid={`recap-row-${r.id}`}
                            onClick={() => navigate(`/recaps/${r.id}`)}
                            className="grid grid-cols-12 border-b border-zinc-100 py-4 px-4 cursor-pointer hover:bg-zinc-50 transition-colors"
                        >
                            <div className="col-span-3">
                                <div className="font-semibold text-zinc-950 text-sm">{r.vessel_name}</div>
                                <div className="text-xs text-zinc-500 mt-0.5">
                                    {r.structured?.load_port || "—"} → {r.structured?.discharge_port || "—"}
                                </div>
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
                            <div className="col-span-2 pt-0.5">
                                <StatusBadge status={r.status} />
                            </div>
                            <div className="col-span-1 text-right text-xs font-mono text-zinc-500 pt-1">
                                v{r.versions?.length || 1}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
