"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/app/actions/auth";
import { initialFormState } from "@/lib/action-state";
import { SubmitButton } from "@/components/SubmitButton";

type FieldProps = {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  span?: boolean;
  values: Record<string, string>;
  errors: Record<string, string>;
};

function Field({ name, label, type = "text", autoComplete, span, values, errors }: FieldProps) {
  return (
    <div className={`form-group${span ? " span-2" : ""}`}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={type === "password" ? undefined : values[name]}
        required
      />
      {errors[name] ? <div className="field-error">{errors[name]}</div> : null}
    </div>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, initialFormState);
  const f = { values: state.values ?? {}, errors: state.fieldErrors ?? {} };

  return (
    <form action={action} noValidate key={JSON.stringify(f.values)}>
      {state.error ? (
        <div className="form-error">
          <i className="fas fa-circle-exclamation" /> {state.error}
        </div>
      ) : null}

      <div className="form-section-title">Personal details</div>
      <div className="form-grid">
        <Field {...f} name="firstName" label="First name" autoComplete="given-name" />
        <Field {...f} name="lastName" label="Last name" autoComplete="family-name" />
        <Field {...f} name="email" label="Email" type="email" autoComplete="email" />
        <Field {...f} name="dateOfBirth" label="Date of birth" type="date" autoComplete="bday" />
      </div>

      <div className="form-section-title">Home address</div>
      <div className="form-grid">
        <Field {...f} name="addressLine" label="Street address" autoComplete="street-address" span />
        <Field {...f} name="city" label="City" autoComplete="address-level2" />
        <Field {...f} name="province" label="Province / State" autoComplete="address-level1" />
        <Field {...f} name="postalCode" label="Postal code" autoComplete="postal-code" />
        <Field {...f} name="country" label="Country" autoComplete="country-name" />
      </div>

      <div className="form-section-title">Secure your account</div>
      <div className="form-grid">
        <Field {...f} name="password" label="Password" type="password" autoComplete="new-password" />
        <Field {...f} name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" />
      </div>

      <label className="check-row">
        <input type="checkbox" name="terms" />
        <span>
          I confirm the information above is accurate and I agree to the membership terms and privacy policy.
          {f.errors.terms ? <span className="field-error"> {f.errors.terms}</span> : null}
        </span>
      </label>

      <SubmitButton icon="fa-user-plus" pendingText="Creating account…">
        Create account &amp; continue
      </SubmitButton>
      <p className="auth-switch">
        Already a member? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
