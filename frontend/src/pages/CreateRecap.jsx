import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Sparkles, Loader2, ArrowLeft, Save, Search, Ship } from "lucide-react";
import { toast } from "sonner";

const EMPTY = {
    vessel_name: "", vessel_imo: "", charterer: "", cargo_type: "", cargo_quantity: "",
    load_port: "", discharge_port: "", laycan_start: "", laycan_end: "",
    freight: "", demurrage: "", despatch: "", special_terms: "",
};

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

const SAMPLE = `MV SEA LION fixed BP, 80k mts crude oil, WS 145, laycan 10-12 Apr, 1 SB 1 SP Rotterdam/Houston, DEM USD 28,000 PDPR, DES 1/2 DEM`;

export default function CreateRecap() {
    const navigate = useNavigate();
    const [rawText, setRawText] = useState("");
    const [structured, setStructured] = useState(EMPTY);
    const [parsing, setParsing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [parsed, setParsed] = useState(false);
    const [lookupQuery, setLookupQuery] = useState("");
    const [lookingUp, setLookingUp] = useState(false);
    const [vesselInfo, setVesselInfo] = useState(null);

    const onParse = async () => {
        if (!rawText.trim()) { toast.error("Paste broker text first"); return; }
        setParsing(true);
        try {
            const { data } = await api.post("/parse", { raw_text: rawText });
            const clean = { ...EMPTY };
            Object.keys(EMPTY).forEach((k) => { clean[k] = data[k] || ""; });
            setStructured(clean);
            setParsed(true);
            toast.success("Parsed — review and edit fields.");
        } catch (e) {
            toast.error(e.response?.data?.detail || "AI parse failed");
        } finally {
            setParsing(false);
        }
    };

    const onLookup = async () => {
        if (!lookupQuery.trim()) return;
        setLookingUp(true);
        try {
            const { data } = await api.post("/vessels/lookup", { query: lookupQuery });
            if (data.found) {
                const v = data.vessel;
                setVesselInfo(v);
                setStructured((prev) => ({ ...prev, vessel_name: v.name, vessel_imo: v.imo }));
                toast.success(`Q88 ${data.source}: ${v.name} · IMO ${v.imo}`);
            } else {
                toast.error("Vessel not found in Q88 registry");
                setVesselInfo(null);
            }
        } catch (e) { toast.error("Lookup failed"); }
        finally { setLookingUp(false); }
    };

    const onSave = async (andSubmit = false) => {
        if (!structured.vessel_name.trim()) {
            toast.error("Vessel name is required");
            return;
        }
        setSaving(true);
        try {
            const cleaned = {};
            Object.entries(structured).forEach(([k, v]) => { cleaned[k] = v || null; });
            const { data } = await api.post("/recaps", { raw_text: rawText, structured: cleaned });
            if (andSubmit) {
                await api.post(`/recaps/${data.id}/approvals`, { action: "submit" });
            }
            toast.success(andSubmit ? "Submitted for review" : "Draft saved");
            navigate(`/recaps/${data.id}`);
        } catch (e) {
            toast.error(e.response?.data?.detail || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col" data-testid="create-recap-page">
            <div className="border-b border-zinc-200 bg-white px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="text-zinc-500 hover:text-bahri-blue transition-colors" data-testid="back-btn"><ArrowLeft className="w-4 h-4" strokeWidth={1.5} /></button>
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <div className="w-1 h-3 bg-bahri-orange"></div>
                            <div className="label-caps">New Recap · AI Parser</div>
                        </div>
                        <h1 className="font-heading text-2xl font-black tracking-tighter text-bahri-blue">Capture & Structure</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button data-testid="save-draft-btn" onClick={() => onSave(false)} disabled={saving}
                        className="border border-zinc-300 hover:border-bahri-blue rounded-none px-5 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50">
                        <Save className="w-4 h-4" strokeWidth={1.5} /> Save Draft
                    </button>
                    <button data-testid="save-submit-btn" onClick={() => onSave(true)} disabled={saving}
                        className="bg-bahri-orange hover:bg-bahri-orange-600 text-white rounded-none px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50">
                        Save & Submit
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2">
                {/* Left */}
                <div className="border-r border-zinc-200 bg-zinc-50 p-8 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="label-caps">Raw Broker Text</div>
                            <div className="text-xs text-zinc-500 mt-1">Paste email, chat snippet or raw fix note</div>
                        </div>
                        <button data-testid="load-sample-btn" onClick={() => setRawText(SAMPLE)}
                            className="text-xs font-semibold text-bahri-orange hover:text-bahri-blue underline underline-offset-2">
                            Load Sample
                        </button>
                    </div>

                    <textarea data-testid="raw-text-input" value={rawText} onChange={(e) => setRawText(e.target.value)}
                        placeholder={`e.g. "MV SEA LION fixed BP, 80k mts crude, WS 145, laycan 10-12 Apr, 1 SB 1 SP..."`}
                        className="flex-1 min-h-[420px] w-full bg-white border border-zinc-300 p-4 font-mono text-sm leading-relaxed focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none resize-none" />

                    <button data-testid="parse-btn" onClick={onParse} disabled={parsing || !rawText.trim()}
                        className="mt-4 bg-bahri-blue hover:bg-bahri-blue-700 text-white rounded-none py-3 font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                        {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" strokeWidth={1.5} />}
                        {parsing ? "Parsing with GPT-5.2..." : "Parse with AI"}
                    </button>
                </div>

                {/* Right */}
                <div className="bg-white p-8 overflow-y-auto">
                    <div className="mb-4">
                        <div className="label-caps">Structured Fixture Data</div>
                        <div className="text-xs text-zinc-500 mt-1">
                            {parsed ? "Review AI-extracted fields and edit as needed" : "Fill manually or click Parse on the left"}
                        </div>
                    </div>

                    {/* Q88 vessel lookup */}
                    <div className="mb-6 border border-bahri-blue/20 bg-bahri-blue-50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Ship className="w-4 h-4 text-bahri-blue" strokeWidth={1.5} />
                            <div className="label-caps text-bahri-blue">Q88 Vessel Lookup</div>
                            <span className="text-[10px] uppercase tracking-wider text-zinc-500">(mock)</span>
                        </div>
                        <div className="flex gap-2">
                            <input data-testid="q88-query-input" value={lookupQuery} onChange={(e) => setLookupQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onLookup())}
                                placeholder="Vessel name or IMO (e.g. BAHRI ABHA or 9594367)"
                                className="flex-1 border border-zinc-300 p-2.5 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none" />
                            <button data-testid="q88-lookup-btn" onClick={onLookup} disabled={lookingUp || !lookupQuery.trim()}
                                className="bg-bahri-blue hover:bg-bahri-blue-700 text-white rounded-none px-4 py-2.5 text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50">
                                {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" strokeWidth={1.5} />}
                                Lookup
                            </button>
                        </div>
                        {vesselInfo && (
                            <div className="mt-3 text-xs font-mono text-zinc-700 flex gap-4 flex-wrap" data-testid="q88-result">
                                <span>IMO: <span className="text-bahri-blue font-semibold">{vesselInfo.imo}</span></span>
                                <span>Type: {vesselInfo.type}</span>
                                <span>DWT: {vesselInfo.dwt?.toLocaleString()}</span>
                                <span>Year: {vesselInfo.year}</span>
                                <span>Flag: {vesselInfo.flag}</span>
                                <span>Owner: {vesselInfo.owner}</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4" data-testid="structured-form">
                        {FIELD_LABELS.map(([key, label]) => {
                            const isWide = ["special_terms"].includes(key);
                            return (
                                <div key={key} className={isWide ? "col-span-2" : ""}>
                                    <label className="label-caps block mb-1.5">{label}</label>
                                    {isWide ? (
                                        <textarea data-testid={`field-${key}`} value={structured[key] || ""}
                                            onChange={(e) => setStructured({ ...structured, [key]: e.target.value })}
                                            rows={2}
                                            className="w-full border border-zinc-300 p-2.5 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none resize-none font-mono" />
                                    ) : (
                                        <input data-testid={`field-${key}`} value={structured[key] || ""}
                                            onChange={(e) => setStructured({ ...structured, [key]: e.target.value })}
                                            className="w-full border border-zinc-300 p-2.5 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none font-mono" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
