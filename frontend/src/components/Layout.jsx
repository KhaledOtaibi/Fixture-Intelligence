import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, FilePlus2, Anchor, LogOut, Sparkles } from "lucide-react";
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
        `flex items-center gap-3 px-4 py-2.5 text-sm border-l-2 transition-colors ${
            isActive
                ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                : "border-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50"
        }`;

    return (
        <div className="min-h-screen bg-white flex" data-testid="app-layout">
            <aside className="w-64 border-r border-zinc-200 bg-white flex flex-col no-print">
                <div className="px-6 py-6 border-b border-zinc-200">
                    <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
                        <div className="w-8 h-8 bg-zinc-950 flex items-center justify-center">
                            <Anchor className="w-4 h-4 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                            <div className="font-heading font-black text-sm tracking-tighter leading-none text-zinc-950">FIXTURE</div>
                            <div className="font-heading font-black text-sm tracking-tighter leading-none text-zinc-950">INTELLIGENCE</div>
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
                        className="w-full flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-red-600 transition-colors"
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
