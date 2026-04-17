import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Megaphone, Pin, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Noticeboard() {
    const { user } = useAuth();
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ title: "", body: "", pinned: false });
    const [showForm, setShowForm] = useState(false);

    const fetch = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/notices");
            setNotices(data);
        } catch (e) { toast.error("Failed to load"); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetch(); }, []);

    const post = async (e) => {
        e.preventDefault();
        try {
            await api.post("/notices", form);
            toast.success("Posted");
            setForm({ title: "", body: "", pinned: false });
            setShowForm(false);
            fetch();
        } catch (e) { toast.error("Post failed"); }
    };

    const remove = async (id) => {
        try {
            await api.delete(`/notices/${id}`);
            fetch();
        } catch (e) { toast.error(e.response?.data?.detail || "Delete failed"); }
    };

    return (
        <div className="max-w-5xl mx-auto px-8 py-8" data-testid="noticeboard-page">
            <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-bahri-blue">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-4 bg-bahri-orange"></div>
                        <div className="label-caps">Internal Communications</div>
                    </div>
                    <h1 className="font-heading text-5xl font-black tracking-tighter text-bahri-blue leading-none">Noticeboard</h1>
                    <p className="text-sm text-zinc-500 mt-3">Announcements, clarifications, and team-wide updates. All captured in the audit trail.</p>
                </div>
                <button data-testid="new-notice-btn" onClick={() => setShowForm(!showForm)}
                    className="bg-bahri-orange hover:bg-bahri-orange-600 text-white rounded-none px-5 py-2.5 text-sm font-semibold transition-colors">
                    {showForm ? "Cancel" : "+ Post Notice"}
                </button>
            </div>

            {showForm && (
                <form onSubmit={post} className="border border-zinc-200 p-6 mb-6 space-y-4" data-testid="notice-form">
                    <div>
                        <label className="label-caps block mb-2">Title</label>
                        <input data-testid="notice-title-input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                            className="w-full border border-zinc-300 p-3 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none" />
                    </div>
                    <div>
                        <label className="label-caps block mb-2">Body</label>
                        <textarea data-testid="notice-body-input" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                            rows={5}
                            className="w-full border border-zinc-300 p-3 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none" />
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-zinc-700">
                            <input data-testid="notice-pinned-checkbox" type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
                            Pin to top
                        </label>
                        <button data-testid="notice-submit-btn" type="submit" className="bg-bahri-blue hover:bg-bahri-blue-700 text-white rounded-none px-5 py-2.5 text-sm font-semibold">Post</button>
                    </div>
                </form>
            )}

            {loading ? <div className="p-16 text-center text-sm text-zinc-500">Loading...</div> :
                notices.length === 0 ? (
                <div className="border border-zinc-200 p-16 text-center">
                    <Megaphone className="w-10 h-10 mx-auto text-zinc-300 mb-4" strokeWidth={1.5} />
                    <div className="font-heading font-bold text-lg text-zinc-950 mb-1">No notices yet</div>
                    <div className="text-sm text-zinc-500">Be the first to post.</div>
                </div>
            ) : (
                <div className="space-y-0 border border-zinc-200 bg-white">
                    {notices.map((n) => (
                        <div key={n.id} data-testid={`notice-${n.id}`} className={`p-6 border-b border-zinc-100 last:border-b-0 ${n.pinned ? "bg-bahri-orange/5 border-l-4 border-l-bahri-orange" : ""}`}>
                            <div className="flex items-start justify-between gap-4 mb-2">
                                <div className="flex items-center gap-3">
                                    {n.pinned && <Pin className="w-4 h-4 text-bahri-orange" strokeWidth={2} />}
                                    <h3 className="font-heading font-bold text-lg text-zinc-950">{n.title}</h3>
                                </div>
                                {(user?.role === "admin" || user?.id === n.user_id) && (
                                    <button onClick={() => remove(n.id)} data-testid={`delete-notice-${n.id}`} className="text-zinc-400 hover:text-red-600 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    </button>
                                )}
                            </div>
                            <div className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">{n.body}</div>
                            <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500">
                                <span className="font-semibold text-zinc-700">{n.user_name}</span>
                                <span className="label-caps">{n.user_role}</span>
                                <span className="font-mono">· {new Date(n.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
