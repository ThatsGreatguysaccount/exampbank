"use client";

import { createContext, useContext } from "react";
import { useFormStatus } from "react-dom";

/** Lets forms that submit through a transition (see ActionForm) report pending state. */
export const FormPendingContext = createContext(false);

export function SubmitButton({
  children,
  pendingText = "Please wait…",
  className = "btn-primary",
  icon,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  icon?: string;
  name?: string;
  value?: string;
}) {
  const status = useFormStatus();
  const pending = useContext(FormPendingContext) || status.pending;
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value}>
      {pending ? <i className="fas fa-spinner fa-spin" /> : icon ? <i className={`fas ${icon}`} /> : null}
      {pending ? pendingText : children}
    </button>
  );
}
