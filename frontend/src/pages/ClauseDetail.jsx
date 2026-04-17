import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { ArrowLeft, Edit2, Save, X, Trash2, CheckCircle2, History, Tag, Activity } from "lucide-react";

export default function ClauseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [clause, setClause] = useState(null);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ title: "", category: "General", tags: "", text: "", change_note: "" });
    const [activeVersion, setActiveVersion] = useState(null);
    const [tab, setTab] = useState("current");
    const [audit, setAudit] = useState([]);

    const fetch = async () => {
        try {
            const { data } = await api.get(`/clauses/${id}`);
            setClause(data);
            setForm({ title: data.title, category: data.category, tags: (data.tags || []).join(", "), text: data.text, change_note: "" });
            setActiveVersion(data.versions[data.versions.length - 1]);
            const auditResp = await api.get(`/audit?entity_type=clause&entity_id=${id}`);
            setAudit(auditResp.data);
        } catch (e) { toast.error("Failed to load"); }
    };
    useEffect(() => { fetch(); }, [id]);

    const save = async () => {
        try {
            await api.patch(`/clauses/${id}`, { ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) });
            toast.success("Saved · new version created");
            setEditing(false);
            fetch();
        } catch (e) { toast.error(e.response?.data?.detail || "Save failed"); }
    };

    const toggleApprove = async () => {
        try {
            await api.patch(`/clauses/${id}`, { is_approved: !clause.is_approved });
            toast.success(clause.is_approved ? "Approval removed" : "Clause approved");
            fetch();
        } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    };

    const remove = async () => {
        if (!confirm("Delete this clause?")) return;
        try {
            await api.delete(`/clauses/${id}`);
            toast.success("Deleted");
            navigate("/clauses");
        } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    };

    if (!clause) return <div className="p-16 text-center text-sm text-zinc-500">Loading...</div>;
    const canEditApprove = ["legal", "admin"].includes(user?.role);

    return (
        <div className="max-w-6xl mx-auto px-8 py-8" data-testid="clause-detail-page">
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-start gap-4">
                    <button onClick={() => navigate("/clauses")} className="mt-1 text-zinc-500 hover:text-bahri-blue transition-colors" data-testid="back-to-library"><ArrowLeft className="w-4 h-4" strokeWidth={1.5} /></button>
                    <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <div className="label-caps">Clause</div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-bahri-orange bg-bahri-orange/10 px-2 py-0.5 border border-bahri-orange/30">{clause.category}</span>
                            {clause.is_approved && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-300 bg-emerald-50 px-2 py-0.5"><CheckCircle2 className="w-3 h-3" strokeWidth={2} /> Legal Approved</span>}
                            <span className="text-xs font-mono text-zinc-500">{clause.versions?.length || 1} revisions</span>
                        </div>
                        <h1 className="font-heading text-4xl font-black tracking-tighter text-bahri-blue leading-none">{clause.title}</h1>
                        <div className="text-sm text-zinc-500 mt-2">Created by {clause.created_by_name} · {new Date(clause.created_at).toLocaleDateString()}</div>
                        {clause.last_modified_by_name && (
                            <div className="mt-2 inline-flex items-center gap-2 text-xs bg-bahri-orange/10 border border-bahri-orange/30 text-bahri-orange px-2.5 py-1 font-semibold" data-testid="clause-last-modified">
                                <span className="uppercase tracking-wider text-[10px]">Last Modified</span>
                                <span className="text-zinc-900">{clause.last_modified_by_name}</span>
                                <span className="text-zinc-600 font-mono">· {clause.last_modified_by_role}</span>
                                <span className="text-zinc-500 font-mono">· {new Date(clause.last_modified_at).toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    {!editing && canEditApprove && (
                        <button data-testid="approve-clause-btn" onClick={toggleApprove} className={`border rounded-none px-4 py-2.5 text-sm font-medium transition-colors ${clause.is_approved ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50" : "border-zinc-300 hover:border-bahri-blue"}`}>
                            {clause.is_approved ? "Remove Approval" : "Approve (Legal)"}
                        </button>
                    )}
                    {!editing ? (
                        <button data-testid="edit-clause-btn" onClick={() => setEditing(true)} className="bg-bahri-blue hover:bg-bahri-blue-700 text-white rounded-none px-5 py-2.5 text-sm font-semibold transition-colors flex items-center gap-2"><Edit2 className="w-4 h-4" strokeWidth={1.5} /> Edit</button>
                    ) : (
                        <>
                            <button onClick={() => { setEditing(false); fetch(); }} className="border border-zinc-300 hover:border-zinc-500 rounded-none px-5 py-2.5 text-sm font-medium transition-colors flex items-center gap-2"><X className="w-4 h-4" strokeWidth={1.5} /> Cancel</button>
                            <button data-testid="save-clause-btn" onClick={save} className="bg-bahri-orange hover:bg-bahri-orange-600 text-white rounded-none px-5 py-2.5 text-sm font-semibold transition-colors flex items-center gap-2"><Save className="w-4 h-4" strokeWidth={1.5} /> Save New Version</button>
                        </>
                    )}
                    {canEditApprove && !editing && (
                        <button data-testid="delete-clause-btn" onClick={remove} className="border border-red-300 text-red-600 hover:bg-red-50 rounded-none px-4 py-2.5 text-sm font-medium transition-colors"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-200 gap-8 mb-6">
                <button data-testid="clause-tab-current" onClick={() => setTab("current")} className={`pb-3 flex items-center gap-2 text-sm transition-colors ${tab === "current" ? "border-b-2 border-bahri-orange text-bahri-blue font-bold -mb-px" : "text-zinc-500 hover:text-bahri-blue font-medium"}`}>
                    <History className="w-4 h-4" strokeWidth={1.5} /> Current & Versions
                </button>
                <button data-testid="clause-tab-activity" onClick={() => setTab("activity")} className={`pb-3 flex items-center gap-2 text-sm transition-colors ${tab === "activity" ? "border-b-2 border-bahri-orange text-bahri-blue font-bold -mb-px" : "text-zinc-500 hover:text-bahri-blue font-medium"}`}>
                    <Activity className="w-4 h-4" strokeWidth={1.5} /> Activity Log
                    {audit.length > 0 && <span className="text-xs text-zinc-400 font-mono">({audit.length})</span>}
                </button>
            </div>

            {tab === "current" && (
                <div className="grid grid-cols-4 gap-8" data-testid="clause-current-tab">
                    <div className="col-span-3">
                        {editing ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="label-caps block mb-2">Title</label>
                                    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-zinc-300 p-3 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label-caps block mb-2">Category</label>
                                        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-zinc-300 p-3 text-sm rounded-none">
                                            {["BIMCO","Shelltime","Asbatankvoy","Piracy","Sanctions","ETS","War Risk","General","Custom"].map(c => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label-caps block mb-2">Tags</label>
                                        <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="w-full border border-zinc-300 p-3 text-sm rounded-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-caps block mb-2">Clause Text</label>
                                    <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} rows={16} className="w-full border border-zinc-300 p-3 text-sm font-mono focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none" />
                                </div>
                                <div>
                                    <label className="label-caps block mb-2">Change Note (will appear in version history)</label>
                                    <input data-testid="change-note-input" value={form.change_note} onChange={(e) => setForm({ ...form, change_note: e.target.value })} placeholder="e.g. 'Updated sanctions reference to 2024 list'" className="w-full border border-zinc-300 p-3 text-sm rounded-none" />
                                </div>
                                <div className="text-xs text-zinc-500 italic">Any change (title, category, tags, or text) creates a new version.</div>
                            </div>
                        ) : (
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="label-caps">{activeVersion?.version_label || "Current"}</div>
                                    {activeVersion?.created_at && <span className="text-xs text-zinc-500 font-mono">{new Date(activeVersion.created_at).toLocaleString()}</span>}
                                    {activeVersion?.created_by_name && <span className="text-xs text-zinc-700 font-semibold">by {activeVersion.created_by_name}</span>}
                                    {activeVersion?.created_by_role && <span className="label-caps text-[9px]">{activeVersion.created_by_role}</span>}
                                </div>
                                <pre className="border border-zinc-200 bg-white p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap text-zinc-900">{activeVersion?.text || clause.text}</pre>
                                {clause.tags?.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {clause.tags.map((t) => (
                                            <span key={t} className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-zinc-600 bg-zinc-100 px-2.5 py-1"><Tag className="w-3 h-3" strokeWidth={1.5} /> {t}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="col-span-1">
                        <div className="label-caps mb-3 flex items-center gap-2"><History className="w-3 h-3" strokeWidth={1.5} /> Version History</div>
                        <div className="border border-zinc-200">
                            {clause.versions?.slice().reverse().map((v, i) => (
                                <button key={v.version_label} onClick={() => setActiveVersion(v)} data-testid={`version-${v.version_label}`}
                                    className={`w-full text-left p-3 border-b border-zinc-100 transition-colors ${activeVersion?.version_label === v.version_label ? "bg-bahri-blue-50 border-l-2 border-l-bahri-orange" : "hover:bg-zinc-50"}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="font-mono font-bold text-xs text-zinc-950">{v.version_label}</div>
                                        <div className="text-[10px] text-zinc-400 font-mono">{new Date(v.created_at).toLocaleDateString()}</div>
                                    </div>
                                    <div className="text-[11px] text-zinc-700 font-semibold mt-1">{v.created_by_name}</div>
                                    {v.created_by_role && <div className="label-caps text-[9px]">{v.created_by_role}</div>}
                                    {v.changed_fields?.length > 0 && v.changed_fields[0] !== "initial" && (
                                        <div className="text-[10px] text-bahri-orange font-mono mt-1 line-clamp-1">Δ {v.changed_fields.join(", ")}</div>
                                    )}
                                    {v.change_note && <div className="text-[11px] text-zinc-500 italic mt-1 line-clamp-2">{v.change_note}</div>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {tab === "activity" && (
                <div data-testid="clause-activity-tab">
                    <div className="border border-zinc-200 bg-white">
                        <div className="grid grid-cols-12 border-b-2 border-bahri-blue bg-bahri-blue-50 py-3 px-4 label-caps text-bahri-blue">
                            <div className="col-span-3">When</div>
                            <div className="col-span-3">Who</div>
                            <div className="col-span-2">Action</div>
                            <div className="col-span-4">Details</div>
                        </div>
                        {audit.length === 0 ? (
                            <div className="p-12 text-center text-sm text-zinc-500">No activity yet</div>
                        ) : audit.map((log) => (
                            <div key={log.id} className="grid grid-cols-12 border-b border-zinc-100 py-3 px-4 text-sm" data-testid={`clause-audit-${log.id}`}>
                                <div className="col-span-3 font-mono text-xs text-zinc-500">{new Date(log.created_at).toLocaleString()}</div>
                                <div className="col-span-3">
                                    <div className="font-semibold text-zinc-950 text-sm">{log.user_name}</div>
                                    <div className="label-caps">{log.user_role}</div>
                                </div>
                                <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-bahri-orange pt-0.5">{log.action}</div>
                                <div className="col-span-4 text-zinc-800">{log.summary}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
