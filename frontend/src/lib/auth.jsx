import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const raw = localStorage.getItem("fip_user");
        return raw ? JSON.parse(raw) : null;
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("fip_token");
        if (!token) { setLoading(false); return; }
        api.get("/auth/me")
            .then((r) => {
                setUser(r.data);
                localStorage.setItem("fip_user", JSON.stringify(r.data));
            })
            .catch(() => {
                localStorage.removeItem("fip_token");
                localStorage.removeItem("fip_user");
                setUser(null);
            })
            .finally(() => setLoading(false));
    }, []);

    const login = async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        localStorage.setItem("fip_token", data.token);
        localStorage.setItem("fip_user", JSON.stringify(data.user));
        setUser(data.user);
        return data.user;
    };

    const register = async (payload) => {
        const { data } = await api.post("/auth/register", payload);
        localStorage.setItem("fip_token", data.token);
        localStorage.setItem("fip_user", JSON.stringify(data.user));
        setUser(data.user);
        return data.user;
    };

    const logout = () => {
        localStorage.removeItem("fip_token");
        localStorage.removeItem("fip_user");
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
