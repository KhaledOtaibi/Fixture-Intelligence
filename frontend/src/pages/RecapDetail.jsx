import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { StatusBadge } from "../components/StatusBadge";
import { VersionDiff } from "../components/VersionDiff";
import { ArrowLeft, Printer, Copy, Edit2, Save, X, MessageSquare, History, FileText, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FIELD_LABELS = [
    ["vessel_name", "Vessel Name"],
    ["charterer", "Charterer"],
    ["cargo_type", "Cargo Type"],
    ["cargo_quantity", "Cargo Quantity"],
    ["load_port", "Load Port"],
    ["discharge_port", "Discharge Port"],
    ["laycan_start", "Laycan Start"],
    ["laycan_end", "Laycan End"],
    ["freight", "Freight"],
    ["demurrage", "Demurrage"],
    ["despatch", "Despatch"],
    ["special_terms", "Special Terms"],
];

const TABS = [
    { key: "overview", label: "Overview", icon: FileText },
    { key: "raw", label: "Raw Text", icon: FileText },
    { key: "versions", label: "Versions", icon: History },
    { key: "comments", label: "Comments", icon: MessageSquare },
    { key: "approvals", label: "Approvals", icon: ShieldCheck },
];

export default function RecapDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [recap, setRecap] = useState(null);
    const [comments, setComments] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("overview");
    const [editing, setEditing] = useState(false);
    const [edits, setEdits] = useState({});
    const [editNote, setEditNote] = useState("");
    const [newComment, setNewComment] = useState("");
    const [approvalComment, setApprovalComment] = useState("");
    const [actionLoading, setActionLoading] = useState(null);
    const [versionPrev, setVersionPrev] = useState(null);
    const [versionCurr, setVersionCurr] = useState(null);

    const fetchAll = async () => {
        try {
            const [r, c, a] = await Promise.all([
                api.get(`/recaps/${id}`),
                api.get(`/recaps/${id}/comments`),
                api.get(`/recaps/${id}/approvals`),
            ]);
            setRecap(r.data);
            setComments(c.data);
            setApprovals(a.data);
            setEdits(r.data.structured);
            if (r.data.versions.length >= 2) {
                setVersionPrev(r.data.versions[r.data.versions.length - 2]);
                setVersionCurr(r.data.versions[r.data.versions.length - 1]);
            } else if (r.data.versions.length === 1) {
                setVersionCurr(r.data.versions[0]);
            }
        } catch (e) {
            toast.error("Failed to load recap");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, [id]);

    const saveEdits = async () => {
        setActionLoading("save");
        try {
            const cleaned = {};
            Object.entries(edits).forEach(([k, v]) => { cleaned[k] = v || null; });
            await api.patch(`/recaps/${id}`, { structured: cleaned, note: editNote || "Manual edit" });
            toast.success("New revision saved");
            setEditing(false);
            setEditNote("");
            fetchAll();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Save failed");
        } finally {
            setActionLoading(null);
        }
    };

    const doApproval = async (action) => {
        setActionLoading(action);
        try {
            await api.post(`/recaps/${id}/approvals`, { action, comment: approvalComment || null });
            toast.success(`Action: ${action}`);
            setApprovalComment("");
            fetchAll();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Action failed");
        } finally {
            setActionLoading(null);
        }
    };

    const submitComment = async () => {
        if (!newComment.trim()) return;
        try {
            await api.post(`/recaps/${id}/comments`, { text: newComment });
            setNewComment("");
            fetchAll();
        } catch (e) { toast.error("Comment failed"); }
    };

    const copyText = () => {
        const s = recap.structured;
        const text = `FIXTURE RECAP — ${recap.vessel_name}\n` +
            `Charterer: ${s.charterer || "—"}\n` +
            `Cargo: ${s.cargo_type || "—"} ${s.cargo_quantity || ""}\n` +
            `Route: ${s.load_port || "—"} → ${s.discharge_port || "—"}\n` +
            `Laycan: ${s.laycan_start || "—"} – ${s.laycan_end || "—"}\n` +
            `Freight: ${s.freight || "—"}\n` +
            `DEM/DES: ${s.demurrage || "—"} / ${s.despatch || "—"}\n` +
            `Terms: ${s.special_terms || "—"}\n` +
            `Status: ${recap.status.toUpperCase()} | Rev ${recap.versions.length}`;
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    const doPrint = () => window.print();

    if (loading) return <div className="p-16 text-center text-sm text-zinc-500" data-testid="detail-loading">Loading fixture...</div>;
    if (!recap) return <div className="p-16 text-center text-sm text-zinc-500">Not found</div>;

    const s = recap.structured;
    const canApprove = ["legal", "admin", "operations"].includes(user?.role);
    const canFix = ["operations", "admin"].includes(user?.role);

    return (
        <div className="max-w-6xl mx-auto px-8 py-8" data-testid="recap-detail-page">
            {/* Header */}
            <div className="flex items-start justify-between mb-6 no-print">
                <div className="flex items-start gap-4">
                    <button onClick={() => navigate("/")} className="mt-1 text-zinc-500 hover:text-zinc-950 transition-colors" data-testid="back-to-dashboard">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="label-caps">Fixture Recap</div>
                            <StatusBadge status={recap.status} />
                            <span className="text-xs font-mono text-zinc-500">Rev {recap.versions.length}</span>
                        </div>
                        <h1 className="font-heading text-5xl font-black tracking-tighter text-zinc-950 leading-none">
                            {recap.vessel_name}
                        </h1>
                        <div className="text-sm text-zinc-500 mt-2">
                            {recap.charterer} · Created by {recap.created_by_name} · Updated {new Date(recap.updated_at).toLocaleString()}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        data-testid="copy-text-btn"
                        onClick={copyText}
                        className="border border-zinc-300 hover:border-zinc-500 rounded-none px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Copy className="w-4 h-4" strokeWidth={1.5} /> Copy
                    </button>
                    <button
                        data-testid="pdf-btn"
                        onClick={doPrint}
                        className="border border-zinc-300 hover:border-zinc-500 rounded-none px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Printer className="w-4 h-4" strokeWidth={1.5} /> PDF
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-200 gap-8 mb-6 no-print">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        data-testid={`tab-${key}`}
                        onClick={() => setTab(key)}
                        className={`pb-3 flex items-center gap-2 text-sm transition-colors ${
                            tab === key
                                ? "border-b-2 border-blue-600 text-blue-600 font-bold -mb-px"
                                : "text-zinc-500 hover:text-zinc-950 font-medium"
                        }`}
                    >
                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                        {label}
                        {key === "comments" && comments.length > 0 && <span className="text-xs text-zinc-400 font-mono">({comments.length})</span>}
                        {key === "approvals" && approvals.length > 0 && <span className="text-xs text-zinc-400 font-mono">({approvals.length})</span>}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div id="print-area">
                {tab === "overview" && (
                    <div data-testid="tab-content-overview">
                        <div className="flex items-center justify-between mb-4 no-print">
                            <div className="label-caps">Structured Data</div>
                            {!editing ? (
                                <button
                                    data-testid="edit-btn"
                                    onClick={() => setEditing(true)}
                                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
                                >
                                    <Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Edit & Create Revision
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        data-testid="cancel-edit-btn"
                                        onClick={() => { setEditing(false); setEdits(recap.structured); }}
                                        className="text-sm font-medium text-zinc-600 hover:text-zinc-950 flex items-center gap-1.5"
                                    >
                                        <X className="w-3.5 h-3.5" strokeWidth={1.5} /> Cancel
                                    </button>
                                    <button
                                        data-testid="save-edit-btn"
                                        onClick={saveEdits}
                                        disabled={actionLoading === "save"}
                                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        {actionLoading === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}
                                        Save Revision
                                    </button>
                                </div>
                            )}
                        </div>
                        {editing && (
                            <div className="mb-4 no-print">
                                <input
                                    data-testid="edit-note-input"
                                    placeholder="Revision note (e.g. 'Freight adjusted to WS 150')"
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    className="w-full border border-zinc-300 p-2.5 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 focus:outline-none rounded-none"
                                />
                            </div>
                        )}

                        <div className="border border-zinc-200">
                            <div className="grid grid-cols-1 md:grid-cols-2">
                                {FIELD_LABELS.map(([key, label], i) => (
                                    <div key={key} className={`border-b border-zinc-200 p-5 ${i % 2 === 0 ? "md:border-r" : ""}`}>
                                        <div className="label-caps mb-1.5">{label}</div>
                                        {editing ? (
                                            <input
                                                data-testid={`edit-field-${key}`}
                                                value={edits[key] || ""}
                                                onChange={(e) => setEdits({ ...edits, [key]: e.target.value })}
                                                className="w-full border border-zinc-300 p-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 focus:outline-none rounded-none font-mono"
                                            />
                                        ) : (
                                            <div className="font-mono text-sm text-zinc-900">{s[key] || "—"}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {tab === "raw" && (
                    <div data-testid="tab-content-raw">
                        <div className="label-caps mb-3">Original Broker Text</div>
                        <pre className="border border-zinc-200 bg-zinc-50 p-6 font-mono text-sm whitespace-pre-wrap text-zinc-800 leading-relaxed">
                            {recap.raw_text || "(no raw text)"}
                        </pre>
                    </div>
                )}

                {tab === "versions" && (
                    <div data-testid="tab-content-versions">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="md:col-span-1 border border-zinc-200">
                                <div className="label-caps p-4 border-b border-zinc-200 bg-zinc-50">History</div>
                                {recap.versions.map((v, i) => {
                                    const isCurr = versionCurr?.version_label === v.version_label;
                                    return (
                                        <button
                                            key={i}
                                            data-testid={`version-item-${i}`}
                                            onClick={() => {
                                                setVersionCurr(v);
                                                setVersionPrev(i > 0 ? recap.versions[i - 1] : null);
                                            }}
                                            className={`w-full text-left p-4 border-b border-zinc-100 transition-colors ${
                                                isCurr ? "bg-blue-50 border-l-2 border-l-blue-600" : "hover:bg-zinc-50"
                                            }`}
                                        >
                                            <div className="font-mono font-bold text-sm text-zinc-950">{v.version_label}</div>
                                            <div className="text-xs text-zinc-500 mt-0.5">{new Date(v.created_at).toLocaleDateString()}</div>
                                            <div className="text-xs text-zinc-600 mt-1">{v.created_by_name}</div>
                                            {v.note && <div className="text-xs text-zinc-500 mt-1 italic">{v.note}</div>}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="md:col-span-3">
                                {versionCurr && versionPrev ? (
                                    <>
                                        <div className="label-caps mb-3">
                                            Diff: {versionPrev.version_label} → {versionCurr.version_label}
                                        </div>
                                        <VersionDiff prev={versionPrev.structured} curr={versionCurr.structured} />
                                    </>
                                ) : (
                                    <div className="border border-zinc-200 p-8 text-center text-sm text-zinc-500">
                                        Only one version exists. Make an edit to create a new revision.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {tab === "comments" && (
                    <div data-testid="tab-content-comments">
                        <div className="border border-zinc-200 mb-4">
                            {comments.length === 0 ? (
                                <div className="p-8 text-center text-sm text-zinc-500">No comments yet.</div>
                            ) : (
                                comments.map((c) => (
                                    <div key={c.id} className="border-b border-zinc-100 p-5 last:border-b-0" data-testid={`comment-${c.id}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="font-semibold text-sm text-zinc-950">{c.user_name}</div>
                                                <span className="label-caps">{c.user_role}</span>
                                            </div>
                                            <div className="text-xs text-zinc-500 font-mono">{new Date(c.created_at).toLocaleString()}</div>
                                        </div>
                                        <div className="text-sm text-zinc-800 whitespace-pre-wrap">{c.text}</div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input
                                data-testid="comment-input"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && submitComment()}
                                placeholder="Add internal comment..."
                                className="flex-1 border border-zinc-300 p-3 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 focus:outline-none rounded-none"
                            />
                            <button
                                data-testid="comment-submit-btn"
                                onClick={submitComment}
                                className="bg-zinc-950 hover:bg-zinc-800 text-white rounded-none px-5 py-3 text-sm font-semibold transition-colors"
                            >
                                Post
                            </button>
                        </div>
                    </div>
                )}

                {tab === "approvals" && (
                    <div data-testid="tab-content-approvals">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2">
                                <div className="label-caps mb-3">Approval History</div>
                                <div className="border border-zinc-200">
                                    {approvals.length === 0 ? (
                                        <div className="p-8 text-center text-sm text-zinc-500">No approval activity yet.</div>
                                    ) : (
                                        approvals.map((a) => (
                                            <div key={a.id} className="border-b border-zinc-100 p-5 last:border-b-0" data-testid={`approval-${a.id}`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-bold uppercase tracking-wider ${
                                                            a.action === "approved" ? "text-blue-700" :
                                                            a.action === "rejected" ? "text-red-700" :
                                                            a.action === "fixed" ? "text-emerald-700" : "text-amber-700"
                                                        }`}>{a.action}</span>
                                                        <span className="text-sm text-zinc-950 font-semibold">by {a.user_name}</span>
                                                        <span className="label-caps">{a.user_role}</span>
                                                    </div>
                                                    <div className="text-xs font-mono text-zinc-500">{new Date(a.created_at).toLocaleString()}</div>
                                                </div>
                                                {a.comment && <div className="text-sm text-zinc-700 mt-2 italic">"{a.comment}"</div>}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className="label-caps mb-3">Actions</div>
                                <div className="border border-zinc-200 p-5 space-y-3">
                                    <textarea
                                        data-testid="approval-comment-input"
                                        value={approvalComment}
                                        onChange={(e) => setApprovalComment(e.target.value)}
                                        placeholder="Optional comment..."
                                        rows={3}
                                        className="w-full border border-zinc-300 p-2.5 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 focus:outline-none rounded-none resize-none"
                                    />
                                    {recap.status === "draft" && (
                                        <button
                                            data-testid="submit-review-btn"
                                            onClick={() => doApproval("submit")}
                                            disabled={actionLoading === "submit"}
                                            className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-none py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                                        >
                                            Submit for Review
                                        </button>
                                    )}
                                    {recap.status === "under_review" && canApprove && (
                                        <>
                                            <button
                                                data-testid="approve-btn"
                                                onClick={() => doApproval("approve")}
                                                disabled={actionLoading === "approve"}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-none py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                data-testid="reject-btn"
                                                onClick={() => doApproval("reject")}
                                                disabled={actionLoading === "reject"}
                                                className="w-full bg-red-500 hover:bg-red-600 text-white rounded-none py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                        </>
                                    )}
                                    {recap.status === "approved" && canFix && (
                                        <button
                                            data-testid="fix-btn"
                                            onClick={() => doApproval("fix")}
                                            disabled={actionLoading === "fix"}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-none py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                                        >
                                            Mark as Fixed
                                        </button>
                                    )}
                                    {recap.status === "fixed" && (
                                        <div className="text-sm text-zinc-500 text-center py-2">Fixture is locked as Fixed.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
