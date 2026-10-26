import Link from "next/link";
import { requireApprovedCustomer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import { PRODUCT_KIND_LABELS, TAX_YEAR, TFSA_LIMIT_THIS_YEAR, RRSP_DEADLINE, parseOptions } from "@/lib/products";
import { PRODUCT_CONTENT } from "./content";
import { AppStatusBadge, featuredOption, pct } from "./shared";

export const metadata = { title: "Invest & borrow" };

export default async function ProductsIndexPage() {
  const user = await requireApprovedCustomer();
  const settings = await getSettings();
  const [products, applications] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.productApplication.findMany({
      where: { userId: user.id },
      include: { product: { select: { title: true, slug: true, icon: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const fmt = (v: number) => money(v, settings);
  const dateFmt = new Intl.DateTimeFormat(settings.locale, { dateStyle: "medium", timeZone: settings.timezone });

  return (
    <>
      <section className="product-hero">
        <div>
          <span className="eyebrow">Invest, save &amp; borrow</span>
          <h2>Plan for what matters, {user.firstName}</h2>
          <p>
            Tax-free savings, guaranteed retirement investments, retirement income and home financing — with today&apos;s
            rates, calculators and online applications in one place.
          </p>
        </div>
        <div className="hero-facts">
          <div>
            <strong>{fmt(TFSA_LIMIT_THIS_YEAR)}</strong>
            <span>{TAX_YEAR} TFSA limit</span>
          </div>
          <div>
            <strong>{RRSP_DEADLINE}</strong>
            <span>RRSP deadline</span>
          </div>
        </div>
      </section>

      <div className="product-grid">
        {products.map((p) => {
          const options = parseOptions(p.options);
          const top = featuredOption(options);
          const best = options.length ? Math.max(...options.map((o) => o.rate)) : null;
          const content = PRODUCT_CONTENT[p.kind];
          const body = (
            <>
              <div className="product-card-head">
                <div className="product-icon">
                  <i className={`fas ${p.icon}`} />
                </div>
                <div>
                  <span className="eyebrow">{content.eyebrow}</span>
                  <h3>{p.title}</h3>
                </div>
              </div>
              {top ? (
                <div className="product-rate">
                  <strong>{pct(top.rate)}</strong>
                  <span>{top.label}</span>
                </div>
              ) : (
                <div className="product-rate">
                  <span>{p.description}</span>
                </div>
              )}
              <p>{p.summary ?? p.description}</p>
              <div className="product-card-foot">
                {best !== null && options.length > 1 ? (
                  <span className="muted">
                    {options.length} options · up to {pct(best)}
                  </span>
                ) : (
                  <span />
                )}
                <span className="link-btn">
                  Learn more <i className="fas fa-arrow-right" />
                </span>
              </div>
            </>
          );
          return p.slug ? (
            <Link key={p.id} href={`/dashboard/products/${p.slug}`} className="product-card">
              {body}
            </Link>
          ) : (
            <div key={p.id} className="product-card">
              {body}
            </div>
          );
        })}
      </div>

      <div className="panel" style={{ marginTop: "2rem" }}>
        <div className="panel-title">
          <span>
            <i className="fas fa-file-signature" /> My applications
          </span>
        </div>
        {applications.length === 0 ? (
          <div className="empty">You haven&apos;t applied for anything yet. Explore a product above to get started.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Product</th>
                  <th>Option</th>
                  <th>Submitted</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <code>{a.reference}</code>
                    </td>
                    <td>
                      {a.product.slug ? (
                        <Link href={`/dashboard/products/${a.product.slug}#applications`}>{a.product.title}</Link>
                      ) : (
                        a.product.title
                      )}
                      <div className="muted">{PRODUCT_KIND_LABELS[a.kind]}</div>
                    </td>
                    <td>
                      {a.optionLabel ?? "—"}
                      {a.rate !== null ? <div className="muted">{pct(Number(a.rate))}</div> : null}
                    </td>
                    <td>{dateFmt.format(a.createdAt)}</td>
                    <td className="num">{a.amount !== null ? fmt(Number(a.approvedAmount ?? a.amount)) : "—"}</td>
                    <td>
                      <AppStatusBadge status={a.status} kind={a.kind} />
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
