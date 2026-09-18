import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, expectedRole?: string) => Promise<{ success: boolean; message?: string }>;
  register: (data: { email: string; password: string; name: string; role?: string; country?: string }) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  switchDemoUser: (roleKey: "admin" | "host1" | "buyer1" | "buyer2" | "buyer3") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEMO_USERS = {
  admin: { email: "admin@auctionhub.in", password: "admin123", role: "ADMIN", label: "Siddharth (Admin)" },
  host1: { email: "vikram@rareartifacts.in", password: "host123", role: "HOST", label: "Vikram (Authorized Host)" },
  buyer1: { email: "rahul@gmail.com", password: "buyer123", role: "BUYER", label: "Rahul (Buyer - ₹1.5L)" },
  buyer2: { email: "arjun@gmail.com", password: "buyer123", role: "BUYER", label: "Arjun (Buyer - ₹1.0L)" },
  buyer3: { email: "priya@gmail.com", password: "buyer123", role: "BUYER", label: "Priya (Buyer - ₹80K)" },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("auction_token"));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        localStorage.removeItem("auction_token");
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to fetch current user:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // If no token exists on first load, auto-login as Buyer Rahul for instant hackathon interaction
    if (!token) {
      switchDemoUser("buyer1");
    } else {
      refreshUser();
    }
  }, [token]);

  const login = async (email: string, password: string, expectedRole?: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, expectedRole }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem("auction_token", data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      }
      return { success: false, message: data.message || "Invalid credentials" };
    } catch (err: any) {
      return { success: false, message: err.message || "Network error" };
    }
  };

  const register = async (input: { email: string; password: string; name: string; role?: string; country?: string }) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem("auction_token", data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      }
      return { success: false, message: data.message || "Registration failed" };
    } catch (err: any) {
      return { success: false, message: err.message || "Network error" };
    }
  };

  const logout = () => {
    localStorage.removeItem("auction_token");
    setToken(null);
    setUser(null);
  };

  const switchDemoUser = async (roleKey: keyof typeof DEMO_USERS) => {
    const cred = DEMO_USERS[roleKey];
    if (cred) {
      await login(cred.email, cred.password, cred.role);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        switchDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
