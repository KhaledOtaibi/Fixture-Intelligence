import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { History } from "lucide-react";
import { toast } from "sonner";

const ACTION_COLOR = {
    created: "text-bahri-blue", revised: "text-bahri-orange", updated: "text-zinc-700",
    submitted: "text-amber-700", approved: "text-emerald-700", rejected: "text-red-600",
    fixed: "text-emerald-700", clauses_linked: "text-bahri-blue", deleted: "text-red-600",
    uploaded: "text-bahri-blue", posted: "text-bahri-orange", registered: "text-zinc-700",
};

export default function Audit() {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/audit?limit=200")
            .then((r) => setLogs(r.data))
            .catch(() => toast.error("Failed to load"))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="max-w-5xl mx-auto px-8 py-8" data-testid="audit-page">
            <div className="mb-8 pb-6 border-b-2 border-bahri-blue">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 bg-bahri-orange"></div>
                    <div className="label-caps">Compliance</div>
                </div>
                <h1 className="font-heading text-5xl font-black tracking-tighter text-bahri-blue leading-none">Audit Trail</h1>
                <p className="text-sm text-zinc-500 mt-3">Every mutation, approval, upload, and internal communication — timestamped and attributed.</p>
            </div>

            {loading ? <div className="p-16 text-center text-sm text-zinc-500">Loading...</div> :
                logs.length === 0 ? (
                <div className="border border-zinc-200 p-16 text-center"><History className="w-10 h-10 mx-auto text-zinc-300 mb-4" strokeWidth={1.5} /><div className="text-sm text-zinc-500">No activity yet</div></div>
            ) : (
                <div className="border border-zinc-200 bg-white">
                    <div className="grid grid-cols-12 border-b-2 border-bahri-blue bg-bahri-blue-50 py-3 px-4 label-caps text-bahri-blue">
                        <div className="col-span-2">Time</div>
                        <div className="col-span-2">User · Role</div>
                        <div className="col-span-2">Entity</div>
                        <div className="col-span-2">Action</div>
                        <div className="col-span-4">Summary</div>
                    </div>
                    {logs.map((log) => (
                        <div key={log.id} data-testid={`audit-row-${log.id}`}
                            onClick={() => log.entity_type === "recap" && navigate(`/recaps/${log.entity_id}`)}
                            className={`grid grid-cols-12 border-b border-zinc-100 py-3 px-4 text-sm ${log.entity_type === "recap" ? "cursor-pointer hover:bg-zinc-50" : ""}`}>
                            <div className="col-span-2 font-mono text-xs text-zinc-500">{new Date(log.created_at).toLocaleString()}</div>
                            <div className="col-span-2">
                                <div className="font-semibold text-zinc-950">{log.user_name}</div>
                                <div className="label-caps">{log.user_role}</div>
                            </div>
                            <div className="col-span-2 text-xs">
                                <div className="label-caps text-bahri-orange">{log.entity_type}</div>
                                <div className="font-mono text-zinc-500 truncate">{log.entity_id.slice(0, 8)}…</div>
                            </div>
                            <div className={`col-span-2 text-xs font-bold uppercase tracking-wider pt-0.5 ${ACTION_COLOR[log.action] || "text-zinc-700"}`}>{log.action}</div>
                            <div className="col-span-4 text-zinc-800">{log.summary}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
