import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Loader2, Info } from "lucide-react";

export default function ClauseCompare() {
    const [sp] = useSearchParams();
    const navigate = useNavigate();
    const a = sp.get("a");
    const b = sp.get("b");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!a || !b) { navigate("/clauses"); return; }
        setLoading(true);
        api.post("/clauses/compare", { clause_a_id: a, clause_b_id: b })
            .then((r) => setData(r.data))
            .catch(() => toast.error("Comparison failed"))
            .finally(() => setLoading(false));
    }, [a, b]);

    if (loading) return (
        <div className="p-16 text-center" data-testid="compare-loading">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-bahri-blue mb-4" strokeWidth={1.5} />
            <div className="text-sm text-zinc-500">Running AI comparison with GPT-5.2...</div>
        </div>
    );

    if (!data) return <div className="p-16 text-center text-sm text-zinc-500">No data</div>;

    return (
        <div className="max-w-7xl mx-auto px-8 py-8" data-testid="clause-compare-page">
            <div className="flex items-start gap-4 mb-6">
                <button onClick={() => navigate("/clauses")} className="mt-1 text-zinc-500 hover:text-bahri-blue transition-colors" data-testid="back-to-library"><ArrowLeft className="w-4 h-4" strokeWidth={1.5} /></button>
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-4 bg-bahri-orange"></div>
                        <div className="label-caps">Side-by-side Comparison</div>
                    </div>
                    <h1 className="font-heading text-4xl font-black tracking-tighter text-bahri-blue leading-none">Clause Compare</h1>
                </div>
            </div>

            {/* AI summary */}
            <div className="border border-bahri-orange bg-bahri-orange/5 p-6 mb-6" data-testid="ai-analysis-block">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-bahri-orange" strokeWidth={1.5} />
                    <div className="label-caps text-bahri-orange">AI-Assisted Analysis · GPT-5.2</div>
                </div>
                <div className="text-sm text-zinc-900 mb-4 leading-relaxed">{data.ai_analysis?.summary || "—"}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-red-700 mb-2">Differences</div>
                        <ul className="space-y-1.5 text-sm text-zinc-800">
                            {(data.ai_analysis?.differences || []).map((d, i) => <li key={i} className="flex gap-2"><span className="text-red-600">•</span>{d}</li>)}
                            {(data.ai_analysis?.differences || []).length === 0 && <li className="text-zinc-500 italic">None identified</li>}
                        </ul>
                    </div>
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">Overlaps</div>
                        <ul className="space-y-1.5 text-sm text-zinc-800">
                            {(data.ai_analysis?.overlaps || []).map((d, i) => <li key={i} className="flex gap-2"><span className="text-emerald-600">•</span>{d}</li>)}
                            {(data.ai_analysis?.overlaps || []).length === 0 && <li className="text-zinc-500 italic">None identified</li>}
                        </ul>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-bahri-orange/20 flex items-start gap-2 text-xs text-zinc-600">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.5} />
                    {data.ai_analysis?.disclaimer}
                </div>
            </div>

            {/* Two-column clause view */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-zinc-200" data-testid="side-by-side">
                {[data.clause_a, data.clause_b].map((c, i) => (
                    <div key={c.id} className={`p-6 ${i === 0 ? "border-r border-zinc-200 bg-zinc-50" : "bg-white"}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-bahri-orange mb-1">Clause {i === 0 ? "A" : "B"} · {c.category}</div>
                        <div className="font-heading text-xl font-black tracking-tighter text-bahri-blue mb-4">{c.title}</div>
                        <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-zinc-900">{c.text}</pre>
                    </div>
                ))}
            </div>
        </div>
    );
}
