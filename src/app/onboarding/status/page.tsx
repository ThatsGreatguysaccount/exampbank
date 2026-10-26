import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCustomer, homePathFor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fullDate } from "@/lib/format";
import { Brand } from "@/components/Brand";
import { Stepper } from "@/components/Stepper";
import { LogoutButton } from "@/components/LogoutButton";

const KIND_LABEL = { ID_FRONT: "Photo ID (front)", ID_BACK: "Photo ID (back)", BANK_STATEMENT: "Bank statement" };

export default async function StatusPage() {
  const user = await requireCustomer();
  if (user.kycStatus !== "PENDING_REVIEW") redirect(homePathFor(user));
  const [settings, docs] = await Promise.all([
    getSettings(),
    prisma.document.findMany({ where: { userId: user.id }, orderBy: { kind: "asc" } }),
  ]);
  const submittedAt = docs[0]?.createdAt;

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="section-header">
          <Brand settings={settings} />
          <LogoutButton />
        </div>
        <Stepper current={2} />
        <div className="status-hero">
          <div className="status-icon warn">
            <i className="fas fa-hourglass-half" />
          </div>
          <h2>Your application is under review</h2>
          <p>
            Thanks, {user.firstName}. Our team is verifying your documents. This usually takes less than one business day.
            Check back here — your dashboard unlocks as soon as you&apos;re approved.
          </p>
        </div>
        <div className="doc-list">
          {docs.map((d) => (
            <div className="detail-row" key={d.id}>
              <span>
                <i className={`fas ${d.mimeType === "application/pdf" ? "fa-file-pdf" : "fa-file-image"}`} />{" "}
                {KIND_LABEL[d.kind]}
              </span>
              <strong>
                <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer">
                  {d.fileName}
                </a>{" "}
                <span className="badge badge-amber">In review</span>
              </strong>
            </div>
          ))}
        </div>
        {submittedAt ? (
          <p className="modal-note">
            <i className="fas fa-clock" /> Submitted {fullDate(submittedAt.toISOString(), settings)}
          </p>
        ) : null}
        <div className="modal-footer">
          <Link href="/onboarding/status" className="btn-primary" prefetch={false}>
            <i className="fas fa-rotate" /> Check status
          </Link>
        </div>
      </div>
    </main>
  );
}
