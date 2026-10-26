"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { initialFormState } from "@/lib/action-state";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialFormState);

  return (
    <form action={action}>
      {state.error ? (
        <div className="form-error">
          <i className="fas fa-circle-exclamation" /> {state.error}
        </div>
      ) : null}
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required />
      </div>
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton icon="fa-right-to-bracket" pendingText="Signing in…">
        Sign in
      </SubmitButton>
      <p className="auth-switch">
        New here? <Link href="/register">Open a membership</Link>
      </p>
    </form>
  );
}
