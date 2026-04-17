import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, FilePlus2, LogOut, Sparkles, BookMarked, Bell, Megaphone, History, Ship } from "lucide-react";
import { useAuth } from "../lib/auth";

const roleLabel = {
    chartering: "Chartering",
    operations: "Operations",
    legal: "Legal",
    admin: "Admin",
};

export default function Layout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const navItem = ({ isActive }) =>
        `flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 transition-colors ${
            isActive
                ? "border-bahri-orange bg-bahri-blue-50 text-bahri-blue font-semibold"
                : "border-transparent text-zinc-600 hover:text-bahri-blue hover:bg-zinc-50"
        }`;

    return (
        <div className="min-h-screen bg-white flex" data-testid="app-layout">
            <aside className="w-64 border-r border-zinc-200 bg-white flex flex-col no-print">
                <div className="px-6 py-6 bg-bahri-blue text-white">
                    <Link to="/" className="flex items-center gap-3" data-testid="logo-link">
                        <div className="w-9 h-9 bg-bahri-orange flex items-center justify-center">
                            <Ship className="w-5 h-5 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                            <div className="font-heading font-black text-xl tracking-tighter leading-none">FIXTURE</div>
                            <div className="font-heading font-black text-xl tracking-tighter leading-none">INTELLIGENCE</div>
                            <div className="text-[10px] tracking-[0.25em] uppercase text-bahri-orange font-semibold mt-1">AI</div>
                        </div>
                    </Link>
                </div>

                <nav className="flex-1 py-4">
                    <NavLink to="/" end className={navItem} data-testid="nav-dashboard">
                        <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} />
                        Dashboard
                    </NavLink>
                    <NavLink to="/recaps/new" className={navItem} data-testid="nav-new-recap">
                        <FilePlus2 className="w-4 h-4" strokeWidth={1.5} />
                        New Recap
                    </NavLink>
                    <NavLink to="/clauses" className={navItem} data-testid="nav-clauses">
                        <BookMarked className="w-4 h-4" strokeWidth={1.5} />
                        Clause Library
                    </NavLink>
                    <NavLink to="/alerts" className={navItem} data-testid="nav-alerts">
                        <Bell className="w-4 h-4" strokeWidth={1.5} />
                        Alerts
                    </NavLink>
                    <NavLink to="/noticeboard" className={navItem} data-testid="nav-noticeboard">
                        <Megaphone className="w-4 h-4" strokeWidth={1.5} />
                        Noticeboard
                    </NavLink>
                    <NavLink to="/audit" className={navItem} data-testid="nav-audit">
                        <History className="w-4 h-4" strokeWidth={1.5} />
                        Audit Trail
                    </NavLink>
                    <NavLink to="/parser" className={navItem} data-testid="nav-parser">
                        <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                        AI Parser
                    </NavLink>
                </nav>

                <div className="border-t border-zinc-200 p-4">
                    <div className="mb-3">
                        <div className="text-sm font-semibold text-zinc-950" data-testid="sidebar-user-name">{user?.name}</div>
                        <div className="label-caps mt-0.5" data-testid="sidebar-user-role">{roleLabel[user?.role] || user?.role}</div>
                    </div>
                    <button
                        data-testid="logout-btn"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-bahri-orange transition-colors"
                    >
                        <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Sign Out
                    </button>
                </div>
            </aside>

            <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
        </div>
    );
}
