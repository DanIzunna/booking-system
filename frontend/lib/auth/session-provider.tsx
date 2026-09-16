"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getCurrentUser, login as loginRequest, logout as logoutRequest, refresh, register as registerRequest } from "../api/auth";
import type { LoginInput, RegisterInput } from "../api/auth";
import { clearAccessToken } from "./session";
import type { AuthenticatedUser } from "../../types/auth";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionContextValue {
  status: SessionStatus;
  user: AuthenticatedUser | null;
  refreshSession: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const initialized = useRef(false);
  const mounted = useRef(false);

  async function refreshSession() {
    try {
      await refresh();
      if (!mounted.current) return;

      const currentUser = await getCurrentUser();
      if (!mounted.current) return;

      setUser(currentUser);
      setStatus("authenticated");
    } catch {
      if (!mounted.current) return;

      clearAccessToken();
      setUser(null);
      setStatus("unauthenticated");
    }
  }

  async function login(input: LoginInput) {
    const response = await loginRequest(input);
    setUser(response.user);
    setStatus("authenticated");
  }

  async function register(input: RegisterInput) {
    const response = await registerRequest(input);
    setUser(response.user);
    setStatus("authenticated");
  }

  async function logout() {
    await logoutRequest();
    setUser(null);
    setStatus("unauthenticated");
  }

  useEffect(() => {
    mounted.current = true;

    if (initialized.current) return;
    initialized.current = true;
    void refreshSession();

    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <SessionContext.Provider value={{ status, user, refreshSession, login, register, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}
