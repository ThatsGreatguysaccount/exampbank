import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  const [settings, pendingReviews, pendingTx, pendingApps] = await Promise.all([
    getSettings(),
    prisma.user.count({ where: { role: "CUSTOMER", kycStatus: "PENDING_REVIEW" } }),
    prisma.transaction.count({ where: { status: "PENDING", kind: { not: "INVESTMENT" } } }),
    prisma.productApplication.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="side-brand">
          <i className={`fas ${settings.brandIcon}`} />
          <div>
            <strong>{settings.bankName}</strong>
            <small>Admin console · {admin.firstName}</small>
          </div>
        </div>
        <AdminNav pendingReviews={pendingReviews} pendingTx={pendingTx} pendingApps={pendingApps} />
        <div className="side-bottom">
          <LogoutButton className="side-link" />
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
