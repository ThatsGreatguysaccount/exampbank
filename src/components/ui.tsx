"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error" | "info";

export function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: ToastType; show: boolean }>({
    msg: "",
    type: "success",
    show: false,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: ToastType = "success") => {
    setToast({ msg, type, show: true });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3600);
  }, []);

  const icon = toast.type === "error" ? "fa-circle-exclamation" : toast.type === "info" ? "fa-circle-info" : "fa-circle-check";
  const node = (
    <div className={`toast ${toast.show ? "show" : ""} ${toast.type}`} role="status" aria-live="polite">
      <i className={`fas ${icon}`} />
      <span>{toast.msg}</span>
    </div>
  );
  return { showToast, toastNode: node };
}

export function Modal({
  title,
  icon,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  icon: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h3>
            <i className={`fas ${icon}`} /> <span>{title}</span>
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
