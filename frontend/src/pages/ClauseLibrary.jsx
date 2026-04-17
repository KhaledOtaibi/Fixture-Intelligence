import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Plus, Search, BookMarked, GitCompare, CheckCircle2, Tag } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["All", "BIMCO", "Shelltime", "Asbatankvoy", "Piracy", "Sanctions", "ETS", "War Risk", "General", "Custom"];
const CATEGORY_OPTS = CATEGORIES.slice(1);

export default function ClauseLibrary() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [clauses, setClauses] = useState([]);
    const [q, setQ] = useState("");
    const [cat, setCat] = useState("All");
    const [showNew, setShowNew] = useState(false);
    const [compareMode, setCompareMode] = useState(false);
    const [selected, setSelected] = useState([]);
    const [form, setForm] = useState({ title: "", category: "General", tags: "", text: "" });
    const [loading, setLoading] = useState(true);

    const fetchClauses = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/clauses", { params: { search: q || undefined, category: cat !== "All" ? cat : undefined } });
            setClauses(data);
        } catch (e) { toast.error("Failed to load clauses"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchClauses(); }, [cat]);

    const onSearch = (e) => { e?.preventDefault(); fetchClauses(); };

    const toggleSelect = (id) => {
        if (!compareMode) { navigate(`/clauses/${id}`); return; }
        setSelected((prev) => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]);
    };

    const runCompare = () => {
        if (selected.length !== 2) { toast.error("Select exactly 2 clauses"); return; }
        navigate(`/clauses/compare?a=${selected[0]}&b=${selected[1]}`);
    };

    const createClause = async (e) => {
        e.preventDefault();
        try {
            const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
            await api.post("/clauses", { ...form, tags });
            toast.success("Clause created");
            setShowNew(false);
            setForm({ title: "", category: "General", tags: "", text: "" });
            fetchClauses();
        } catch (err) { toast.error(err.response?.data?.detail || "Create failed"); }
    };

    return (
        <div className="max-w-7xl mx-auto px-8 py-8" data-testid="clause-library-page">
            <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-bahri-blue">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-4 bg-bahri-orange"></div>
                        <div className="label-caps">Legal Repository</div>
                    </div>
                    <h1 className="font-heading text-5xl font-black tracking-tighter text-bahri-blue leading-none">Clause Library</h1>
                    <p className="text-sm text-zinc-500 mt-3">Version-controlled, tagged clauses with legal approval workflow. AI-assisted information retrieval only — not legal advice.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button data-testid="compare-toggle-btn" onClick={() => { setCompareMode(!compareMode); setSelected([]); }}
                        className={`border rounded-none px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 ${compareMode ? "border-bahri-orange bg-bahri-orange text-white" : "border-zinc-300 hover:border-bahri-blue"}`}>
                        <GitCompare className="w-4 h-4" strokeWidth={1.5} />
                        {compareMode ? `Compare (${selected.length}/2)` : "Compare"}
                    </button>
                    {compareMode && selected.length === 2 && (
                        <button data-testid="run-compare-btn" onClick={runCompare}
                            className="bg-bahri-orange hover:bg-bahri-orange-600 text-white rounded-none px-5 py-2.5 text-sm font-semibold transition-colors">
                            Run AI Compare
                        </button>
                    )}
                    <button data-testid="new-clause-btn" onClick={() => setShowNew(true)}
                        className="bg-bahri-blue hover:bg-bahri-blue-700 text-white rounded-none px-5 py-2.5 text-sm font-semibold transition-colors flex items-center gap-2">
                        <Plus className="w-4 h-4" strokeWidth={2} /> New Clause
                    </button>
                </div>
            </div>

            {/* Search + category filter */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <form onSubmit={onSearch} className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" strokeWidth={1.5} />
                    <input data-testid="clause-search-input" value={q} onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && onSearch(e)}
                        placeholder="Search clause title or text..."
                        className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 rounded-none text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none" />
                </form>
                <div className="flex gap-0 border border-zinc-300 overflow-x-auto">
                    {CATEGORIES.map((c, i) => (
                        <button key={c} data-testid={`cat-filter-${c}`} onClick={() => setCat(c)}
                            className={`px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                                i !== 0 ? "border-l border-zinc-300" : ""
                            } ${cat === c ? "bg-bahri-blue text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}>
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="border border-zinc-200 bg-white">
                {loading ? <div className="p-16 text-center text-sm text-zinc-500">Loading clauses...</div> :
                    clauses.length === 0 ? (
                    <div className="p-16 text-center" data-testid="empty-clauses">
                        <BookMarked className="w-10 h-10 mx-auto text-zinc-300 mb-4" strokeWidth={1.5} />
                        <div className="font-heading font-bold text-lg text-zinc-950 mb-1">No clauses yet</div>
                        <div className="text-sm text-zinc-500 mb-6">Add your first clause or ask admin to load demo library.</div>
                    </div>
                ) : (
                    clauses.map((c) => {
                        const isSelected = selected.includes(c.id);
                        return (
                            <div key={c.id} data-testid={`clause-row-${c.id}`}
                                onClick={() => toggleSelect(c.id)}
                                className={`border-b border-zinc-100 p-5 cursor-pointer transition-colors ${
                                    compareMode && isSelected ? "bg-bahri-orange/10 border-l-4 border-l-bahri-orange" : "hover:bg-bahri-blue-50"
                                }`}>
                                <div className="flex items-start justify-between gap-6">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className="font-heading font-bold text-zinc-950">{c.title}</div>
                                            {c.is_approved && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-300 bg-emerald-50 px-2 py-0.5">
                                                    <CheckCircle2 className="w-3 h-3" strokeWidth={2} /> Legal Approved
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-bahri-orange bg-bahri-orange/10 px-2 py-0.5 border border-bahri-orange/30">
                                                {c.category}
                                            </span>
                                            <span className="text-xs font-mono text-zinc-500">v{c.versions?.length || 1} · {c.versions?.length || 1} revs</span>
                                            {c.last_modified_by_name ? (
                                                <span className="text-xs text-zinc-600">Modified by <span className="font-semibold text-zinc-900">{c.last_modified_by_name}</span> · {new Date(c.last_modified_at || c.updated_at).toLocaleDateString()}</span>
                                            ) : (
                                                <span className="text-xs text-zinc-500">Updated {new Date(c.updated_at).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                        <div className="text-sm text-zinc-700 line-clamp-2">{c.text}</div>
                                        {c.tags?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-3">
                                                {c.tags.map((t) => (
                                                    <span key={t} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-600 bg-zinc-100 px-2 py-0.5">
                                                        <Tag className="w-2.5 h-2.5" strokeWidth={1.5} /> {t}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* New clause modal */}
            {showNew && (
                <div className="fixed inset-0 bg-bahri-blue/80 z-50 flex items-center justify-center p-8" onClick={() => setShowNew(false)}>
                    <div className="bg-white max-w-2xl w-full" onClick={(e) => e.stopPropagation()} data-testid="new-clause-modal">
                        <div className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
                            <h3 className="font-heading text-2xl font-black text-bahri-blue tracking-tighter">New Clause</h3>
                            <button onClick={() => setShowNew(false)} className="text-zinc-500 hover:text-zinc-950" data-testid="close-modal">✕</button>
                        </div>
                        <form onSubmit={createClause} className="p-6 space-y-4">
                            <div>
                                <label className="label-caps block mb-2">Title</label>
                                <input data-testid="clause-title-input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    className="w-full border border-zinc-300 p-3 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label-caps block mb-2">Category</label>
                                    <select data-testid="clause-category-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                                        className="w-full border border-zinc-300 p-3 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none">
                                        {CATEGORY_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label-caps block mb-2">Tags (comma-separated)</label>
                                    <input data-testid="clause-tags-input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                                        placeholder="sanctions, war, ets"
                                        className="w-full border border-zinc-300 p-3 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none" />
                                </div>
                            </div>
                            <div>
                                <label className="label-caps block mb-2">Clause Text</label>
                                <textarea data-testid="clause-text-input" required value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })}
                                    rows={10}
                                    className="w-full border border-zinc-300 p-3 text-sm font-mono leading-relaxed focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none resize-y" />
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowNew(false)} className="border border-zinc-300 hover:border-zinc-500 rounded-none px-5 py-2.5 text-sm font-medium transition-colors">Cancel</button>
                                <button type="submit" data-testid="clause-submit-btn" className="bg-bahri-blue hover:bg-bahri-blue-700 text-white rounded-none px-5 py-2.5 text-sm font-semibold transition-colors">Create Clause</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
