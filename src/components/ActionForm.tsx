"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { initialFormState, type FormState } from "@/lib/action-state";
import { FormPendingContext } from "./SubmitButton";

export function ActionForm({
  action,
  children,
  className,
  confirm,
  style,
  resetOnSuccess = true,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  style?: React.CSSProperties;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  // Submitting manually keeps the user's input when the action returns an error
  // (React's built-in form actions reset the form after every submission).
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirm && !window.confirm(confirm)) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(fd));
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className={className} style={style}>
      {state.error ? (
        <div className="form-error">
          <i className="fas fa-circle-exclamation" /> {state.error}
        </div>
      ) : null}
      {state.ok && state.message ? (
        <div className="form-success">
          <i className="fas fa-circle-check" /> {state.message}
        </div>
      ) : null}
      <FormPendingContext.Provider value={pending}>{children}</FormPendingContext.Provider>
    </form>
  );
}
