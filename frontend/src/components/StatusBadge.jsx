import React from "react";

const MAP = {
    draft: "bg-zinc-100 text-zinc-700 border-zinc-200",
    under_review: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-blue-100 text-blue-800 border-blue-200",
    fixed: "bg-emerald-100 text-emerald-800 border-emerald-200",
};
const LABEL = {
    draft: "Draft",
    under_review: "Under Review",
    approved: "Approved",
    fixed: "Fixed",
};

export const StatusBadge = ({ status, size = "sm" }) => (
    <span
        data-testid={`status-badge-${status}`}
        className={`inline-flex items-center border px-2.5 ${size === "lg" ? "py-1.5 text-xs" : "py-0.5 text-[10px]"} font-bold uppercase tracking-[0.15em] rounded-none ${MAP[status] || MAP.draft}`}
    >
        {LABEL[status] || status}
    </span>
);
