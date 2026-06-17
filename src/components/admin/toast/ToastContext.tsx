"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type ToastKind = "success" | "error" | "info";

export type Toast = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  /** Auto-dismiss after this many ms. Defaults to 4000. 0 = persistent. */
  duration?: number;
};

type Ctx = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).slice(2, 10);
      const toast: Toast = { id, duration: 4000, ...t };
      setToasts((prev) => [...prev, toast]);
      if (toast.duration && toast.duration > 0) {
        window.setTimeout(() => dismiss(id), toast.duration);
      }
    },
    [dismiss],
  );

  const value = useMemo<Ctx>(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return {
    success: (message: string, title?: string) => ctx.push({ kind: "success", message, title }),
    error:   (message: string, title?: string) => ctx.push({ kind: "error",   message, title }),
    info:    (message: string, title?: string) => ctx.push({ kind: "info",    message, title }),
    dismiss: ctx.dismiss,
  };
}

export function useToastList() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastList must be used inside <ToastProvider>");
  return ctx;
}
