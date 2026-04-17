import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Sparkles, Loader2, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

const EMPTY = {
    vessel_name: "", charterer: "", cargo_type: "", cargo_quantity: "",
    load_port: "", discharge_port: "", laycan_start: "", laycan_end: "",
    freight: "", demurrage: "", despatch: "", special_terms: "",
};

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

const SAMPLE = `MV SEA LION fixed BP, 80k mts crude oil, WS 145, laycan 10-12 Apr, 1 SB 1 SP Rotterdam/Houston, DEM USD 28,000 PDPR, DES 1/2 DEM`;

export default function CreateRecap() {
    const navigate = useNavigate();
    const [rawText, setRawText] = useState("");
    const [structured, setStructured] = useState(EMPTY);
    const [parsing, setParsing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [parsed, setParsed] = useState(false);

    const onParse = async () => {
        if (!rawText.trim()) { toast.error("Paste broker text first"); return; }
        setParsing(true);
        try {
            const { data } = await api.post("/parse", { raw_text: rawText });
            const clean = { ...EMPTY };
            Object.keys(EMPTY).forEach((k) => {
                clean[k] = data[k] || "";
            });
            setStructured(clean);
            setParsed(true);
            toast.success("Parsed — review and edit fields.");
        } catch (e) {
            toast.error(e.response?.data?.detail || "AI parse failed");
        } finally {
            setParsing(false);
        }
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
            const { data } = await api.post("/recaps", {
                raw_text: rawText,
                structured: cleaned,
            });
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
            {/* Top bar */}
            <div className="border-b border-zinc-200 bg-white px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-zinc-500 hover:text-zinc-950 transition-colors"
                        data-testid="back-btn"
                    >
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <div>
                        <div className="label-caps mb-1">New Fixture Recap</div>
                        <h1 className="font-heading text-2xl font-black tracking-tighter text-zinc-950">AI Parser</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        data-testid="save-draft-btn"
                        onClick={() => onSave(false)}
                        disabled={saving}
                        className="border border-zinc-300 hover:border-zinc-500 rounded-none px-5 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" strokeWidth={1.5} />
                        Save Draft
                    </button>
                    <button
                        data-testid="save-submit-btn"
                        onClick={() => onSave(true)}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                        Save & Submit
                    </button>
                </div>
            </div>

            {/* Split pane */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2">
                {/* Left: raw input */}
                <div className="border-r border-zinc-200 bg-zinc-50 p-8 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="label-caps">Raw Broker Text</div>
                            <div className="text-xs text-zinc-500 mt-1">Paste email, chat snippet or raw fix note</div>
                        </div>
                        <button
                            data-testid="load-sample-btn"
                            onClick={() => setRawText(SAMPLE)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2"
                        >
                            Load Sample
                        </button>
                    </div>

                    <textarea
                        data-testid="raw-text-input"
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder={`e.g. "MV SEA LION fixed BP, 80k mts crude, WS 145, laycan 10-12 Apr, 1 SB 1 SP..."`}
                        className="flex-1 min-h-[420px] w-full bg-white border border-zinc-300 p-4 font-mono text-sm leading-relaxed focus:border-blue-600 focus:ring-2 focus:ring-blue-600 focus:outline-none rounded-none resize-none"
                    />

                    <button
                        data-testid="parse-btn"
                        onClick={onParse}
                        disabled={parsing || !rawText.trim()}
                        className="mt-4 bg-zinc-950 hover:bg-zinc-800 text-white rounded-none py-3 font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" strokeWidth={1.5} />}
                        {parsing ? "Parsing with GPT-5.2..." : "Parse with AI"}
                    </button>
                </div>

                {/* Right: structured form */}
                <div className="bg-white p-8 overflow-y-auto">
                    <div className="mb-6">
                        <div className="label-caps">Structured Fixture Data</div>
                        <div className="text-xs text-zinc-500 mt-1">
                            {parsed ? "Review AI-extracted fields and edit as needed" : "Fill manually or click Parse on the left"}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4" data-testid="structured-form">
                        {FIELD_LABELS.map(([key, label]) => {
                            const isWide = ["special_terms"].includes(key);
                            return (
                                <div key={key} className={isWide ? "col-span-2" : ""}>
                                    <label className="label-caps block mb-1.5">{label}</label>
                                    {isWide ? (
                                        <textarea
                                            data-testid={`field-${key}`}
                                            value={structured[key] || ""}
                                            onChange={(e) => setStructured({ ...structured, [key]: e.target.value })}
                                            rows={2}
                                            className="w-full border border-zinc-300 p-2.5 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 focus:outline-none rounded-none resize-none font-mono"
                                        />
                                    ) : (
                                        <input
                                            data-testid={`field-${key}`}
                                            value={structured[key] || ""}
                                            onChange={(e) => setStructured({ ...structured, [key]: e.target.value })}
                                            className="w-full border border-zinc-300 p-2.5 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 focus:outline-none rounded-none font-mono"
                                        />
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
