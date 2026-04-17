import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, API } from "../lib/api";
import { useAuth } from "../lib/auth";
import { StatusBadge } from "../components/StatusBadge";
import { VersionDiff } from "../components/VersionDiff";
import { ArrowLeft, Printer, Copy, Edit2, Save, X, MessageSquare, History, FileText, ShieldCheck, Loader2, BookMarked, Paperclip, Upload, Trash2, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const FIELD_LABELS = [
    ["vessel_name", "Vessel Name"],
    ["vessel_imo", "Vessel IMO"],
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
    { key: "clauses", label: "Linked Clauses", icon: BookMarked },
    { key: "attachments", label: "Attachments", icon: Paperclip },
    { key: "comments", label: "Comments", icon: MessageSquare },
    { key: "approvals", label: "Approvals", icon: ShieldCheck },
    { key: "audit", label: "Audit", icon: History },
];

export default function RecapDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const fileInput = useRef(null);
    const [recap, setRecap] = useState(null);
    const [comments, setComments] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [audit, setAudit] = useState([]);
    const [attachments, setAttachments] = useState([]);
    const [allClauses, setAllClauses] = useState([]);
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
    const [linking, setLinking] = useState(false);
    const [selectedClauses, setSelectedClauses] = useState([]);
    const [uploadCategory, setUploadCategory] = useState("document");

    const fetchAll = async () => {
        try {
            const [r, c, a, at, aud, cl] = await Promise.all([
                api.get(`/recaps/${id}`),
                api.get(`/recaps/${id}/comments`),
                api.get(`/recaps/${id}/approvals`),
                api.get(`/attachments?recap_id=${id}`),
                api.get(`/audit?entity_type=recap&entity_id=${id}`),
                api.get(`/clauses`),
            ]);
            setRecap(r.data);
            setComments(c.data);
            setApprovals(a.data);
            setAttachments(at.data);
            setAudit(aud.data);
            setAllClauses(cl.data);
            setEdits(r.data.structured);
            setSelectedClauses(r.data.linked_clauses || []);
            if (r.data.versions.length >= 2) {
                setVersionPrev(r.data.versions[r.data.versions.length - 2]);
                setVersionCurr(r.data.versions[r.data.versions.length - 1]);
            } else {
                setVersionCurr(r.data.versions[0]);
            }
        } catch (e) { toast.error("Failed to load recap"); }
        finally { setLoading(false); }
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
        } catch (e) { toast.error(e.response?.data?.detail || "Save failed"); }
        finally { setActionLoading(null); }
    };

    const doApproval = async (action) => {
        setActionLoading(action);
        try {
            await api.post(`/recaps/${id}/approvals`, { action, comment: approvalComment || null });
            toast.success(`Action: ${action}`);
            setApprovalComment("");
            fetchAll();
        } catch (e) { toast.error(e.response?.data?.detail || "Action failed"); }
        finally { setActionLoading(null); }
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
        const text = `FIXTURE RECAP — ${recap.charter_party_id}\nVessel: ${recap.vessel_name} (IMO ${s.vessel_imo || "—"})\n` +
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

    const onFileSelected = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        try {
            await api.post(`/attachments?recap_id=${id}&category=${uploadCategory}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
            toast.success(`Uploaded ${file.name}`);
            e.target.value = "";
            fetchAll();
        } catch (err) { toast.error(err.response?.data?.detail || "Upload failed"); }
    };

    const deleteAttachment = async (aid) => {
        if (!confirm("Remove this file?")) return;
        try {
            await api.delete(`/attachments/${aid}`);
            fetchAll();
        } catch (err) { toast.error(err.response?.data?.detail || "Delete failed"); }
    };

    const downloadUrl = (att) => {
        const token = localStorage.getItem("fip_token");
        return `${API}/attachments/${att.id}/download?auth=${token}`;
    };

    const saveLinkedClauses = async () => {
        setLinking(true);
        try {
            await api.put(`/recaps/${id}/clauses`, { clause_ids: selectedClauses });
            toast.success("Clauses linked");
            fetchAll();
        } catch (e) { toast.error("Link failed"); }
        finally { setLinking(false); }
    };

    if (loading) return <div className="p-16 text-center text-sm text-zinc-500" data-testid="detail-loading">Loading fixture...</div>;
    if (!recap) return <div className="p-16 text-center text-sm text-zinc-500">Not found</div>;

    const s = recap.structured;
    const canApprove = ["legal", "admin", "operations"].includes(user?.role);
    const canFix = ["operations", "admin"].includes(user?.role);

    return (
        <div className="max-w-7xl mx-auto px-8 py-8" data-testid="recap-detail-page">
            <div className="flex items-start justify-between mb-6 no-print">
                <div className="flex items-start gap-4">
                    <button onClick={() => navigate("/")} className="mt-1 text-zinc-500 hover:text-bahri-blue transition-colors" data-testid="back-to-dashboard"><ArrowLeft className="w-4 h-4" strokeWidth={1.5} /></button>
                    <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <div className="label-caps">Fixture Recap</div>
                            <StatusBadge status={recap.status} />
                            <span className="text-xs font-mono text-bahri-orange font-semibold">{recap.charter_party_id}</span>
                            <span className="text-xs font-mono text-zinc-500">Rev {recap.versions.length}</span>
                        </div>
                        <h1 className="font-heading text-5xl font-black tracking-tighter text-bahri-blue leading-none">{recap.vessel_name}</h1>
                        <div className="text-sm text-zinc-500 mt-2">
                            {recap.charterer} {s.vessel_imo && `· IMO ${s.vessel_imo}`} · Created by {recap.created_by_name} · Updated {new Date(recap.updated_at).toLocaleString()}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button data-testid="copy-text-btn" onClick={copyText} className="border border-zinc-300 hover:border-bahri-blue rounded-none px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2"><Copy className="w-4 h-4" strokeWidth={1.5} /> Copy</button>
                    <button data-testid="pdf-btn" onClick={doPrint} className="border border-zinc-300 hover:border-bahri-blue rounded-none px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2"><Printer className="w-4 h-4" strokeWidth={1.5} /> PDF</button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-200 gap-6 mb-6 no-print overflow-x-auto">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button key={key} data-testid={`tab-${key}`} onClick={() => setTab(key)}
                        className={`pb-3 flex items-center gap-2 text-sm transition-colors whitespace-nowrap ${
                            tab === key ? "border-b-2 border-bahri-orange text-bahri-blue font-bold -mb-px" : "text-zinc-500 hover:text-bahri-blue font-medium"
                        }`}>
                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                        {label}
                        {key === "comments" && comments.length > 0 && <span className="text-xs text-zinc-400 font-mono">({comments.length})</span>}
                        {key === "approvals" && approvals.length > 0 && <span className="text-xs text-zinc-400 font-mono">({approvals.length})</span>}
                        {key === "attachments" && attachments.length > 0 && <span className="text-xs text-zinc-400 font-mono">({attachments.length})</span>}
                        {key === "clauses" && recap.linked_clauses?.length > 0 && <span className="text-xs text-zinc-400 font-mono">({recap.linked_clauses.length})</span>}
                    </button>
                ))}
            </div>

            <div id="print-area">
                {tab === "overview" && (
                    <div data-testid="tab-content-overview">
                        <div className="flex items-center justify-between mb-4 no-print">
                            <div className="label-caps">Structured Data</div>
                            {!editing ? (
                                <button data-testid="edit-btn" onClick={() => setEditing(true)} className="text-sm font-semibold text-bahri-orange hover:text-bahri-blue flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Edit & Create Revision</button>
                            ) : (
                                <div className="flex gap-2">
                                    <button data-testid="cancel-edit-btn" onClick={() => { setEditing(false); setEdits(recap.structured); }} className="text-sm font-medium text-zinc-600 hover:text-zinc-950 flex items-center gap-1.5"><X className="w-3.5 h-3.5" strokeWidth={1.5} /> Cancel</button>
                                    <button data-testid="save-edit-btn" onClick={saveEdits} disabled={actionLoading === "save"} className="bg-bahri-orange hover:bg-bahri-orange-600 text-white rounded-none px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50">
                                        {actionLoading === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}
                                        Save Revision
                                    </button>
                                </div>
                            )}
                        </div>
                        {editing && (
                            <div className="mb-4 no-print">
                                <input data-testid="edit-note-input" placeholder="Revision note (e.g. 'Freight adjusted to WS 150')" value={editNote} onChange={(e) => setEditNote(e.target.value)} className="w-full border border-zinc-300 p-2.5 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none" />
                            </div>
                        )}

                        <div className="border border-zinc-200">
                            <div className="grid grid-cols-1 md:grid-cols-2">
                                {FIELD_LABELS.map(([key, label], i) => (
                                    <div key={key} className={`border-b border-zinc-200 p-5 ${i % 2 === 0 ? "md:border-r" : ""}`}>
                                        <div className="label-caps mb-1.5">{label}</div>
                                        {editing ? (
                                            <input data-testid={`edit-field-${key}`} value={edits[key] || ""} onChange={(e) => setEdits({ ...edits, [key]: e.target.value })} className="w-full border border-zinc-300 p-2 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none font-mono" />
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
                        <pre className="border border-zinc-200 bg-zinc-50 p-6 font-mono text-sm whitespace-pre-wrap text-zinc-800 leading-relaxed">{recap.raw_text || "(no raw text)"}</pre>
                    </div>
                )}

                {tab === "versions" && (
                    <div data-testid="tab-content-versions">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="md:col-span-1 border border-zinc-200">
                                <div className="label-caps p-4 border-b-2 border-bahri-blue bg-bahri-blue-50 text-bahri-blue">History</div>
                                {recap.versions.map((v, i) => {
                                    const isCurr = versionCurr?.version_label === v.version_label;
                                    return (
                                        <button key={i} data-testid={`version-item-${i}`}
                                            onClick={() => { setVersionCurr(v); setVersionPrev(i > 0 ? recap.versions[i - 1] : null); }}
                                            className={`w-full text-left p-4 border-b border-zinc-100 transition-colors ${isCurr ? "bg-bahri-orange/5 border-l-4 border-l-bahri-orange" : "hover:bg-zinc-50"}`}>
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
                                        <div className="label-caps mb-3">Diff: {versionPrev.version_label} → {versionCurr.version_label}</div>
                                        <VersionDiff prev={versionPrev.structured} curr={versionCurr.structured} />
                                    </>
                                ) : (
                                    <div className="border border-zinc-200 p-8 text-center text-sm text-zinc-500">Only one version exists. Make an edit to create a new revision.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {tab === "clauses" && (
                    <div data-testid="tab-content-clauses">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="label-caps">Linked Rider Clauses</div>
                                <div className="text-xs text-zinc-500 mt-1">{selectedClauses.length} selected · Governed by Legal team</div>
                            </div>
                            <button data-testid="save-clauses-btn" onClick={saveLinkedClauses} disabled={linking}
                                className="bg-bahri-blue hover:bg-bahri-blue-700 text-white rounded-none px-5 py-2.5 text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50">
                                {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Save Links
                            </button>
                        </div>
                        <div className="border border-zinc-200 bg-white max-h-[600px] overflow-y-auto">
                            {allClauses.length === 0 ? (
                                <div className="p-12 text-center">
                                    <BookMarked className="w-10 h-10 mx-auto text-zinc-300 mb-4" strokeWidth={1.5} />
                                    <div className="text-sm text-zinc-500">No clauses in library. Add some from the Clause Library.</div>
                                </div>
                            ) : (
                                allClauses.map((c) => {
                                    const isLinked = selectedClauses.includes(c.id);
                                    return (
                                        <label key={c.id} data-testid={`link-clause-${c.id}`}
                                            className={`block border-b border-zinc-100 p-4 cursor-pointer transition-colors ${isLinked ? "bg-bahri-blue-50 border-l-4 border-l-bahri-orange" : "hover:bg-zinc-50"}`}>
                                            <div className="flex items-start gap-3">
                                                <input type="checkbox" checked={isLinked} onChange={(e) => {
                                                    if (e.target.checked) setSelectedClauses([...selectedClauses, c.id]);
                                                    else setSelectedClauses(selectedClauses.filter(x => x !== c.id));
                                                }} className="mt-1" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="font-semibold text-sm text-zinc-950">{c.title}</div>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-bahri-orange bg-bahri-orange/10 px-2 py-0.5">{c.category}</span>
                                                        {c.is_approved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />}
                                                    </div>
                                                    <div className="text-xs text-zinc-600 line-clamp-1">{c.text}</div>
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {tab === "attachments" && (
                    <div data-testid="tab-content-attachments">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="label-caps">Documents & Certificates</div>
                                <div className="text-xs text-zinc-500 mt-1">Invoices, certificates, CP PDFs, approvals. Max 25 MB per file.</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <select data-testid="upload-category" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}
                                    className="border border-zinc-300 p-2 text-xs uppercase tracking-wider font-semibold focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none">
                                    <option value="document">Document</option>
                                    <option value="invoice">Invoice</option>
                                    <option value="certificate">Certificate</option>
                                    <option value="charter_party">Charter Party</option>
                                    <option value="approval">Approval</option>
                                </select>
                                <input type="file" ref={fileInput} onChange={onFileSelected} className="hidden" data-testid="file-input" />
                                <button data-testid="upload-btn" onClick={() => fileInput.current?.click()}
                                    className="bg-bahri-orange hover:bg-bahri-orange-600 text-white rounded-none px-4 py-2.5 text-sm font-semibold transition-colors flex items-center gap-2">
                                    <Upload className="w-4 h-4" strokeWidth={1.5} /> Upload
                                </button>
                            </div>
                        </div>
                        <div className="border border-zinc-200 bg-white">
                            {attachments.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Paperclip className="w-10 h-10 mx-auto text-zinc-300 mb-4" strokeWidth={1.5} />
                                    <div className="text-sm text-zinc-500">No attachments yet</div>
                                </div>
                            ) : (
                                attachments.map((att) => (
                                    <div key={att.id} data-testid={`attachment-${att.id}`} className="border-b border-zinc-100 p-4 flex items-center gap-4">
                                        <div className="w-10 h-10 bg-bahri-blue-50 border border-bahri-blue/20 flex items-center justify-center shrink-0">
                                            <FileText className="w-5 h-5 text-bahri-blue" strokeWidth={1.5} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-sm text-zinc-950 truncate">{att.filename}</div>
                                            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5 font-mono">
                                                <span className="text-bahri-orange uppercase tracking-wider">{att.category}</span>
                                                <span>{(att.size / 1024).toFixed(1)} KB</span>
                                                <span>{new Date(att.created_at).toLocaleString()}</span>
                                                <span>by {att.uploaded_by_name}</span>
                                            </div>
                                        </div>
                                        <a href={downloadUrl(att)} target="_blank" rel="noreferrer"
                                            className="text-bahri-blue hover:text-bahri-orange transition-colors" data-testid={`download-${att.id}`}>
                                            <Download className="w-4 h-4" strokeWidth={1.5} />
                                        </a>
                                        {(user?.role === "admin" || att.uploaded_by === user?.id) && (
                                            <button onClick={() => deleteAttachment(att.id)} data-testid={`delete-attachment-${att.id}`}
                                                className="text-zinc-400 hover:text-red-600 transition-colors">
                                                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
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
                            <input data-testid="comment-input" value={newComment} onChange={(e) => setNewComment(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && submitComment()}
                                placeholder="Add internal comment..."
                                className="flex-1 border border-zinc-300 p-3 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none" />
                            <button data-testid="comment-submit-btn" onClick={submitComment}
                                className="bg-bahri-blue hover:bg-bahri-blue-700 text-white rounded-none px-5 py-3 text-sm font-semibold transition-colors">Post</button>
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
                                                            a.action === "approved" ? "text-bahri-blue" :
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
                                    <textarea data-testid="approval-comment-input" value={approvalComment} onChange={(e) => setApprovalComment(e.target.value)}
                                        placeholder="Optional comment..." rows={3}
                                        className="w-full border border-zinc-300 p-2.5 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none resize-none" />
                                    {recap.status === "draft" && (
                                        <button data-testid="submit-review-btn" onClick={() => doApproval("submit")} disabled={actionLoading === "submit"}
                                            className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-none py-2.5 text-sm font-semibold transition-colors disabled:opacity-50">
                                            Submit for Review
                                        </button>
                                    )}
                                    {recap.status === "under_review" && canApprove && (
                                        <>
                                            <button data-testid="approve-btn" onClick={() => doApproval("approve")} disabled={actionLoading === "approve"}
                                                className="w-full bg-bahri-blue hover:bg-bahri-blue-700 text-white rounded-none py-2.5 text-sm font-semibold transition-colors disabled:opacity-50">Approve</button>
                                            <button data-testid="reject-btn" onClick={() => doApproval("reject")} disabled={actionLoading === "reject"}
                                                className="w-full bg-red-500 hover:bg-red-600 text-white rounded-none py-2.5 text-sm font-semibold transition-colors disabled:opacity-50">Reject</button>
                                        </>
                                    )}
                                    {recap.status === "approved" && canFix && (
                                        <button data-testid="fix-btn" onClick={() => doApproval("fix")} disabled={actionLoading === "fix"}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-none py-2.5 text-sm font-semibold transition-colors disabled:opacity-50">
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

                {tab === "audit" && (
                    <div data-testid="tab-content-audit">
                        <div className="label-caps mb-3">Recap Audit Trail</div>
                        <div className="border border-zinc-200 bg-white">
                            {audit.length === 0 ? (
                                <div className="p-8 text-center text-sm text-zinc-500">No activity yet</div>
                            ) : (
                                audit.map((log) => (
                                    <div key={log.id} className="grid grid-cols-12 border-b border-zinc-100 py-3 px-4 text-sm" data-testid={`recap-audit-${log.id}`}>
                                        <div className="col-span-3 font-mono text-xs text-zinc-500">{new Date(log.created_at).toLocaleString()}</div>
                                        <div className="col-span-3">
                                            <div className="font-semibold text-zinc-950 text-sm">{log.user_name}</div>
                                            <div className="label-caps">{log.user_role}</div>
                                        </div>
                                        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-bahri-orange pt-0.5">{log.action}</div>
                                        <div className="col-span-4 text-zinc-800">{log.summary}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
