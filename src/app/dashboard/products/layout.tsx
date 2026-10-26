import Link from "next/link";
import { requireApprovedCustomer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { LogoutButton } from "@/components/LogoutButton";

export default async function ProductsLayout({ children }: LayoutProps<"/dashboard/products">) {
  const user = await requireApprovedCustomer();
  const settings = await getSettings();
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="dashboard">
      <div className="top-bar">
        <Link href="/dashboard" className="brand" style={{ textDecoration: "none" }}>
          <i className={`fas ${settings.brandIcon}`} />
          <div>
            <h1>{settings.bankName}</h1>
            <span>{settings.bankTagline}</span>
          </div>
        </Link>
        <nav className="top-nav">
          <Link href="/dashboard">
            <i className="fas fa-wallet" /> Accounts
          </Link>
          <Link href="/dashboard/products">
            <i className="fas fa-chart-line" /> Invest &amp; borrow
          </Link>
          <LogoutButton className="top-nav-btn" />
        </nav>
        <Link href="/dashboard" className="user-greeting" style={{ textDecoration: "none" }}>
          <div className="avatar">{initials}</div>
          <div className="name">
            {user.firstName} {user.lastName}
            <small>Member #{user.memberNumber ?? "—"}</small>
          </div>
        </Link>
      </div>

      {children}

      <div className="footer-note">
        <span>
          <i className="fas fa-shield-alt" /> {settings.footerLeft}
        </span>
        <span>
          <i className="fas fa-lock" /> {settings.footerRight}
        </span>
      </div>
    </div>
  );
}
