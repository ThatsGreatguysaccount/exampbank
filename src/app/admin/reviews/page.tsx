import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fullDate } from "@/lib/format";
import { fullName } from "../shared";

export default async function ReviewsPage() {
  await requireAdmin();
  const [settings, users] = await Promise.all([
    getSettings(),
    prisma.user.findMany({
      where: { role: "CUSTOMER", kycStatus: "PENDING_REVIEW" },
      orderBy: { updatedAt: "asc" },
      include: { documents: true },
    }),
  ]);

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>
            <i className="fas fa-id-card" /> KYC reviews
          </h1>
          <p>Customers who uploaded documents and are waiting for approval. Oldest first.</p>
        </div>
      </div>
      <div className="panel">
        {users.length === 0 ? (
          <div className="empty">No applications waiting for review.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Documents</th>
                  <th>Submitted</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{fullName(u)}</strong>
                      <div className="muted">
                        {u.email}
                        {u.phone ? ` · ${u.phone}` : ""}
                      </div>
                    </td>
                    <td>
                      {u.documents.map((d) => (
                        <span key={d.id} className="badge badge-blue" style={{ marginRight: 4 }}>
                          {d.kind === "BANK_STATEMENT" ? "Statement" : d.kind === "ID_FRONT" ? "ID front" : "ID back"}
                        </span>
                      ))}
                    </td>
                    <td className="muted">
                      {u.documents[0] ? fullDate(u.documents[0].createdAt.toISOString(), settings) : "—"}
                    </td>
                    <td className="num">
                      <Link href={`/admin/customers/${u.id}`} className="btn-primary inline">
                        <i className="fas fa-magnifying-glass" /> Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
