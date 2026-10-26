import { redirect } from "next/navigation";
import { requireCustomer, homePathFor } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Brand } from "@/components/Brand";
import { Stepper } from "@/components/Stepper";
import { LogoutButton } from "@/components/LogoutButton";
import { DocumentsForm } from "./DocumentsForm";

export default async function DocumentsPage() {
  const user = await requireCustomer();
  if (user.kycStatus === "PENDING_REVIEW" || user.kycStatus === "APPROVED") redirect(homePathFor(user));
  const settings = await getSettings();

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="section-header">
          <Brand settings={settings} />
          <LogoutButton />
        </div>
        <Stepper current={1} />
        <h2 className="auth-title">Verify your identity, {user.firstName}</h2>
        <p className="auth-sub">
          Upload a government-issued photo ID and a recent bank statement (PDF, issued within the last 3 months). Our team
          reviews every application — you&apos;ll get access to online banking once approved.
        </p>
        {user.kycStatus === "REJECTED" ? (
          <div className="form-error">
            <i className="fas fa-circle-exclamation" />
            <div>
              <strong>Your previous documents were not accepted.</strong>
              {user.kycNote ? <div>Reason: {user.kycNote}</div> : null}
              <div>Please upload new documents below.</div>
            </div>
          </div>
        ) : null}
        <DocumentsForm />
      </div>
    </main>
  );
}
