import React from "react";

const FIELDS = [
    ["vessel_name", "Vessel"],
    ["charterer", "Charterer"],
    ["cargo_type", "Cargo"],
    ["cargo_quantity", "Qty"],
    ["load_port", "Load Port"],
    ["discharge_port", "Discharge Port"],
    ["laycan_start", "Laycan Start"],
    ["laycan_end", "Laycan End"],
    ["freight", "Freight"],
    ["demurrage", "Demurrage"],
    ["despatch", "Despatch"],
    ["special_terms", "Special Terms"],
];

export const VersionDiff = ({ prev, curr }) => {
    return (
        <div className="border border-zinc-200 bg-white">
            <div className="grid grid-cols-12 border-b border-zinc-200 bg-zinc-50 py-2 px-4 label-caps">
                <div className="col-span-3">Field</div>
                <div className="col-span-4">Previous</div>
                <div className="col-span-5">Current</div>
            </div>
            {FIELDS.map(([key, label]) => {
                const a = prev?.[key] ?? "—";
                const b = curr?.[key] ?? "—";
                const changed = a !== b;
                return (
                    <div key={key} className="grid grid-cols-12 border-b border-zinc-100 py-2.5 px-4 text-sm">
                        <div className="col-span-3 label-caps pt-0.5">{label}</div>
                        <div className={`col-span-4 font-mono ${changed ? "bg-red-100 text-red-900 px-1" : "text-zinc-600"}`}>
                            {a || "—"}
                        </div>
                        <div className={`col-span-5 font-mono ${changed ? "bg-green-100 text-green-900 px-1" : "text-zinc-900"}`}>
                            {b || "—"}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
