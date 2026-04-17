import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Ship, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

const ROLES = [
    { value: "chartering", label: "Chartering" },
    { value: "operations", label: "Operations" },
    { value: "legal", label: "Legal" },
    { value: "admin", label: "Admin" },
];

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: "", email: "", password: "", role: "chartering" });
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const u = await register(form);
            toast.success("Account created");
            if (u.role === "admin") {
                try { await api.post("/seed"); } catch (_) {}
            }
            navigate("/");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white" data-testid="register-page">
            <div className="hidden lg:block relative bg-bahri-blue overflow-hidden">
                <img
                    src="https://images.unsplash.com/photo-1758900348926-cd1ccbc15fef?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwzfHxjYXJnbyUyMHNoaXAlMjBzZWElMjBkcm9uZSUyMHZpZXd8ZW58MHx8fHwxNzc2NDM3NjU1fDA&ixlib=rb-4.1.0&q=85"
                    alt="Cargo ship"
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-bahri-blue/60" />
                <div className="relative z-10 p-12 h-full flex flex-col justify-between text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-bahri-orange flex items-center justify-center">
                            <Ship className="w-5 h-5 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                            <div className="font-heading font-black text-xl tracking-tighter">EMERGENT</div>
                            <div className="text-[10px] tracking-[0.25em] uppercase text-bahri-orange font-semibold mt-0.5">by Bahri</div>
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] tracking-[0.3em] uppercase text-bahri-orange font-semibold mb-4">Join the platform</div>
                        <h1 className="font-heading text-5xl font-black tracking-tighter leading-none mb-4">
                            Built for Bahri teams.<br />
                            <span className="text-bahri-orange">Chartering, Legal, Ops.</span>
                        </h1>
                        <p className="text-zinc-200 max-w-md text-base leading-relaxed">
                            Register as <span className="text-white font-semibold">Admin</span> to auto-load demo data (recaps + clause library). Or pick your team role.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-center p-8 lg:p-16">
                <div className="w-full max-w-sm">
                    <div className="label-caps mb-3">Create Account</div>
                    <h2 className="font-heading text-4xl font-black tracking-tighter text-zinc-950 mb-2">Get started</h2>
                    <p className="text-sm text-zinc-500 mb-10">Set up your team profile in 20 seconds.</p>

                    <form onSubmit={onSubmit} className="space-y-5" data-testid="register-form">
                        <div>
                            <label className="label-caps block mb-2">Full Name</label>
                            <input data-testid="register-name-input" required value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})}
                                className="w-full bg-transparent border border-zinc-300 p-3 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none" />
                        </div>
                        <div>
                            <label className="label-caps block mb-2">Email</label>
                            <input data-testid="register-email-input" type="email" required value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})}
                                className="w-full bg-transparent border border-zinc-300 p-3 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none" />
                        </div>
                        <div>
                            <label className="label-caps block mb-2">Password</label>
                            <input data-testid="register-password-input" type="password" required minLength={6} value={form.password} onChange={(e)=>setForm({...form, password:e.target.value})}
                                className="w-full bg-transparent border border-zinc-300 p-3 text-sm focus:border-bahri-blue focus:ring-2 focus:ring-bahri-blue focus:outline-none rounded-none" />
                        </div>
                        <div>
                            <label className="label-caps block mb-2">Role</label>
                            <div className="grid grid-cols-2 gap-2" data-testid="register-role-group">
                                {ROLES.map((r) => (
                                    <button
                                        type="button" key={r.value} data-testid={`role-${r.value}`}
                                        onClick={() => setForm({ ...form, role: r.value })}
                                        className={`border py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                                            form.role === r.value
                                                ? "bg-bahri-blue text-white border-bahri-blue"
                                                : "bg-white text-zinc-700 border-zinc-300 hover:border-bahri-blue"
                                        }`}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            data-testid="register-submit-btn"
                            type="submit" disabled={loading}
                            className="w-full bg-bahri-orange hover:bg-bahri-orange-600 text-white font-semibold rounded-none py-3 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-zinc-200 text-sm text-zinc-500">
                        Already have an account?{" "}
                        <Link to="/login" className="font-semibold text-bahri-blue hover:text-bahri-orange transition-colors" data-testid="go-login-link">
                            Sign in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
