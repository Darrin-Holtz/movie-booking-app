"use client";

import { createContext, ReactNode, useContext } from "react";
import { authClient } from "@/lib/auth-client";

type AuthSessionState = ReturnType<typeof authClient.useSession>;

const AuthSessionContext = createContext<AuthSessionState | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const sessionState = authClient.useSession();

  return (
    <AuthSessionContext.Provider value={sessionState}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider.");
  }

  return context;
}