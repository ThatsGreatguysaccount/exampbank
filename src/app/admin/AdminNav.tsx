"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({
  pendingReviews,
  pendingTx,
  pendingApps,
}: {
  pendingReviews: number;
  pendingTx: number;
  pendingApps: number;
}) {
  const path = usePathname();
  const links = [
    { href: "/admin", label: "Overview", icon: "fa-gauge-high", exact: true },
    { href: "/admin/customers", label: "Customers", icon: "fa-users" },
    { href: "/admin/reviews", label: "KYC reviews", icon: "fa-id-card", count: pendingReviews },
    { href: "/admin/applications", label: "Applications", icon: "fa-file-signature", count: pendingApps },
    { href: "/admin/transactions", label: "Transactions", icon: "fa-arrow-right-arrow-left", count: pendingTx },
    { href: "/admin/settings", label: "Settings", icon: "fa-gear" },
  ];

  return (
    <>
      {links.map((l) => {
        const active = l.exact ? path === l.href : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`side-link${active ? " active" : ""}`}>
            <i className={`fas ${l.icon}`} /> {l.label}
            {l.count ? <span className="count">{l.count}</span> : null}
          </Link>
        );
      })}
    </>
  );
}
