import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Anchor, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            navigate("/");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white" data-testid="login-page">
            <div className="hidden lg:block relative bg-zinc-950 overflow-hidden">
                <img
                    src="https://images.unsplash.com/photo-1758900348926-cd1ccbc15fef?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwzfHxjYXJnbyUyMHNoaXAlMjBzZWElMjBkcm9uZSUyMHZpZXd8ZW58MHx8fHwxNzc2NDM3NjU1fDA&ixlib=rb-4.1.0&q=85"
                    alt="Cargo ship"
                    className="absolute inset-0 w-full h-full object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent" />
                <div className="relative z-10 p-12 h-full flex flex-col justify-between text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white flex items-center justify-center">
                            <Anchor className="w-5 h-5 text-zinc-950" strokeWidth={1.5} />
                        </div>
                        <div className="font-heading font-black text-xl tracking-tighter">
                            FIXTURE INTELLIGENCE
                        </div>
                    </div>
                    <div>
                        <h1 className="font-heading text-5xl font-black tracking-tighter leading-none mb-4">
                            Command your fixtures.
                            <br />
                            <span className="text-blue-400">Parse. Version. Approve.</span>
                        </h1>
                        <p className="text-zinc-300 max-w-md text-base leading-relaxed">
                            AI-first platform for chartering, operations, and legal teams to manage fixture recaps end-to-end.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-center p-8 lg:p-16">
                <div className="w-full max-w-sm">
                    <div className="label-caps mb-3">Sign In</div>
                    <h2 className="font-heading text-4xl font-black tracking-tighter text-zinc-950 mb-2">Welcome back</h2>
                    <p className="text-sm text-zinc-500 mb-10">Enter your credentials to continue.</p>

                    <form onSubmit={onSubmit} className="space-y-5" data-testid="login-form">
                        <div>
                            <label className="label-caps block mb-2">Email</label>
                            <input
                                data-testid="login-email-input"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-transparent border border-zinc-300 p-3 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 focus:outline-none rounded-none transition-colors"
                                placeholder="you@shipping.com"
                            />
                        </div>
                        <div>
                            <label className="label-caps block mb-2">Password</label>
                            <input
                                data-testid="login-password-input"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-transparent border border-zinc-300 p-3 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 focus:outline-none rounded-none transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            data-testid="login-submit-btn"
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-none py-3 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-zinc-200 text-sm text-zinc-500">
                        Don't have an account?{" "}
                        <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700" data-testid="go-register-link">
                            Create one
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
