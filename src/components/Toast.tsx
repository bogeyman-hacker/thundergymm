"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { Check, X, Alert } from "./Icons";

type Kind = "ok" | "err" | "info";
type Toast = { id: number; kind: Kind; text: string };

const Ctx = createContext<{ push: (text: string, kind?: Kind) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((text: string, kind: Kind = "ok") => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p, { id, kind, text }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span
              style={{
                marginTop: 2,
                color:
                  t.kind === "ok" ? "var(--ok)" : t.kind === "err" ? "var(--danger)" : "var(--info)",
              }}
            >
              {t.kind === "ok" ? (
                <Check width={17} height={17} />
              ) : t.kind === "err" ? (
                <Alert width={17} height={17} />
              ) : (
                <Alert width={17} height={17} />
              )}
            </span>
            <span className="grow">{t.text}</span>
            <button
              onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))}
              style={{ color: "var(--muted)" }}
              aria-label="close"
            >
              <X width={15} height={15} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast must be used inside <ToastProvider>");
  return c.push;
}
