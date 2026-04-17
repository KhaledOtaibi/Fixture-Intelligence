import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Bell, AlertTriangle, Info as InfoIcon, Ship } from "lucide-react";
import { toast } from "sonner";

const SEV_STYLE = {
    critical: "border-red-300 bg-red-50 text-red-800",
    warning: "border-amber-300 bg-amber-50 text-amber-800",
    info: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

export default function Alerts() {
    const navigate = useNavigate();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/alerts")
            .then((r) => setAlerts(r.data))
            .catch(() => toast.error("Failed to load alerts"))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="max-w-5xl mx-auto px-8 py-8" data-testid="alerts-page">
            <div className="mb-8 pb-6 border-b-2 border-bahri-blue">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 bg-bahri-orange"></div>
                    <div className="label-caps">Key Dates & Declarations</div>
                </div>
                <h1 className="font-heading text-5xl font-black tracking-tighter text-bahri-blue leading-none">Alerts</h1>
                <p className="text-sm text-zinc-500 mt-3">{alerts.length} active · auto-derived from laycan windows and approval backlogs.</p>
            </div>

            {loading ? (
                <div className="p-16 text-center text-sm text-zinc-500">Loading...</div>
            ) : alerts.length === 0 ? (
                <div className="border border-zinc-200 p-16 text-center" data-testid="no-alerts">
                    <Bell className="w-10 h-10 mx-auto text-zinc-300 mb-4" strokeWidth={1.5} />
                    <div className="font-heading font-bold text-lg text-zinc-950 mb-1">All clear</div>
                    <div className="text-sm text-zinc-500">No active alerts right now.</div>
                </div>
            ) : (
                <div className="space-y-3">
                    {alerts.map((a) => (
                        <div key={a.id} data-testid={`alert-${a.id}`}
                            onClick={() => navigate(`/recaps/${a.recap_id}`)}
                            className={`border-l-4 border border-zinc-200 bg-white hover:bg-zinc-50 cursor-pointer transition-colors p-5 flex items-start gap-4 ${
                                a.severity === "critical" ? "border-l-red-500" : a.severity === "warning" ? "border-l-amber-500" : "border-l-zinc-400"
                            }`}>
                            <div className={`w-10 h-10 border flex items-center justify-center shrink-0 ${SEV_STYLE[a.severity]}`}>
                                {a.severity === "critical" ? <AlertTriangle className="w-5 h-5" strokeWidth={1.5} /> : a.severity === "warning" ? <Bell className="w-5 h-5" strokeWidth={1.5} /> : <InfoIcon className="w-5 h-5" strokeWidth={1.5} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${SEV_STYLE[a.severity]}`}>{a.severity}</span>
                                    <span className="font-heading font-bold text-zinc-950">{a.alert_type}</span>
                                </div>
                                <div className="text-sm text-zinc-800 mb-1">{a.message}</div>
                                <div className="text-xs text-zinc-500 flex items-center gap-3 font-mono">
                                    <span className="flex items-center gap-1.5"><Ship className="w-3 h-3" strokeWidth={1.5} /> {a.vessel_name}</span>
                                    <span className="text-bahri-orange">{a.charter_party_id}</span>
                                    {a.due_date && <span>Due: {a.due_date}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
