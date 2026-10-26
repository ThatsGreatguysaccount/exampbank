"use client";

import { useActionState, useState, useTransition } from "react";
import { submitDocumentsAction } from "@/app/actions/onboarding";
import { initialFormState } from "@/lib/action-state";

const MAX = 10 * 1024 * 1024;

function FileField({
  name,
  title,
  hint,
  icon,
  accept,
  error,
}: {
  name: string;
  title: string;
  hint: string;
  icon: string;
  accept: string;
  error?: string;
}) {
  const [chosen, setChosen] = useState<string>("");
  const [localError, setLocalError] = useState<string>("");

  return (
    <div className="upload-box">
      <h4>
        <i className={`fas ${icon}`} /> {title}
      </h4>
      <p>{hint}</p>
      <input
        type="file"
        name={name}
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return setChosen("");
          if (f.size > MAX) {
            e.target.value = "";
            setChosen("");
            return setLocalError("File is larger than 10 MB.");
          }
          setLocalError("");
          setChosen(`${f.name} · ${(f.size / 1024 / 1024).toFixed(2)} MB`);
        }}
      />
      {chosen ? (
        <div className="file-chosen">
          <i className="fas fa-check" /> {chosen}
        </div>
      ) : null}
      {localError || error ? <div className="field-error">{localError || error}</div> : null}
    </div>
  );
}

export function DocumentsForm() {
  const [state, action, pending] = useActionState(submitDocumentsAction, initialFormState);
  const [, startTransition] = useTransition();
  const [idType, setIdType] = useState("PASSPORT");
  const fe = state.fieldErrors ?? {};

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {state.error ? (
        <div className="form-error">
          <i className="fas fa-circle-exclamation" /> {state.error}
        </div>
      ) : null}

      <div className="form-group">
        <label htmlFor="idType">ID document type</label>
        <select id="idType" name="idType" value={idType} onChange={(e) => setIdType(e.target.value)}>
          <option value="PASSPORT">Passport</option>
          <option value="DRIVERS_LICENSE">Driver&apos;s licence</option>
          <option value="NATIONAL_ID">National / provincial ID card</option>
        </select>
        {fe.idType ? <div className="field-error">{fe.idType}</div> : null}
      </div>

      <FileField
        name="idFront"
        title={idType === "PASSPORT" ? "Passport photo page" : "ID — front side"}
        hint="Clear photo or scan. JPG, PNG, WEBP or PDF, max 10 MB. All four corners visible."
        icon="fa-id-card"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        error={fe.idFront}
      />
      {idType !== "PASSPORT" ? (
        <FileField
          name="idBack"
          title="ID — back side"
          hint="JPG, PNG, WEBP or PDF, max 10 MB."
          icon="fa-id-card-clip"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          error={fe.idBack}
        />
      ) : null}
      <FileField
        name="bankStatement"
        title="Bank statement"
        hint="PDF only, max 10 MB. Must show your name and address and be dated within the last 3 months."
        icon="fa-file-pdf"
        accept="application/pdf"
        error={fe.bankStatement}
      />

      <button type="submit" className="btn-primary" disabled={pending}>
        <i className={`fas ${pending ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}`} />
        {pending ? "Uploading documents…" : "Submit for review"}
      </button>
    </form>
  );
}
