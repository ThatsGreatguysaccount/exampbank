import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { friendlyDate } from "@/lib/format";
import { buildMatcher, clientIp, isAllowed, readIpAccess } from "@/lib/ip-access";
import { BRAND_ICONS, PRODUCT_ICONS } from "@/lib/icons";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { IconPicker } from "@/components/IconPicker";
import {
  addIpEntryAction,
  deleteProductAction,
  removeIpEntryAction,
  saveProductAction,
  saveSettingsAction,
  setIpAccessAction,
} from "@/app/actions/admin";
import type { Prisma, ProductKind } from "@prisma/client";
import { PRODUCT_KIND_LABELS, parseOptions } from "@/lib/products";

const CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD", "CHF", "JPY", "AED", "INR", "GEL"];

export default async function SettingsPage() {
  await requireAdmin();
  const [s, products, ipAccess, h] = await Promise.all([
    getSettings(),
    prisma.product.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    readIpAccess(),
    headers(),
  ]);
  const myIp = clientIp(h);
  const myIpAllowed = isAllowed(myIp, ipAccess.matcher);

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>
            <i className="fas fa-gear" /> Settings
          </h1>
          <p>Branding, currency and content shown to customers.</p>
        </div>
      </div>

      <div className="two-col-wide">
        <div className="panel">
          <div className="panel-title">
            <span>
              <i className="fas fa-palette" /> Branding &amp; currency
            </span>
          </div>
          <ActionForm action={saveSettingsAction} resetOnSuccess={false}>
            <div className="form-grid">
              <div className="form-group">
                <label>Bank name</label>
                <input name="bankName" defaultValue={s.bankName} required />
              </div>
              <div className="form-group">
                <label>Tagline</label>
                <input name="bankTagline" defaultValue={s.bankTagline} />
              </div>
              <div className="form-group span-2">
                <label>Message when customer clicks the logo</label>
                <input name="brandMessage" defaultValue={s.brandMessage} />
              </div>
              <div className="form-group span-2">
                <label>Logo icon</label>
                <IconPicker name="brandIcon" icons={BRAND_ICONS} defaultValue={s.brandIcon} idPrefix="brand" />
              </div>
            </div>

            <div className="form-section-title">Money &amp; time</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Currency</label>
                <input name="currency" defaultValue={s.currency} list="currencies" maxLength={3} />
                <datalist id="currencies">
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <div className="hint">ISO code, e.g. CAD, USD, EUR</div>
              </div>
              <div className="form-group">
                <label>Number format locale</label>
                <input name="locale" defaultValue={s.locale} />
                <div className="hint">e.g. en-CA, en-US, fr-CA, de-DE</div>
              </div>
              <div className="form-group">
                <label>Timezone</label>
                <input name="timezone" defaultValue={s.timezone} />
                <div className="hint">IANA name, e.g. America/Regina</div>
              </div>
              <div className="form-group">
                <label>Member number prefix</label>
                <input name="memberPrefix" defaultValue={s.memberPrefix} maxLength={6} />
              </div>
            </div>

            <div className="form-section-title">Customers</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Default branch for new members</label>
                <input name="defaultBranch" defaultValue={s.defaultBranch} />
              </div>
              <div className="form-group">
                <label>Cheque deposit notice</label>
                <input name="chequeHoldNotice" defaultValue={s.chequeHoldNotice} />
              </div>
              <div className="form-group">
                <label>International wire fee ({s.currency})</label>
                <input name="wireFee" type="number" step="0.01" min="0" defaultValue={s.wireFee} />
              </div>
              <div className="form-group">
                <label>International wire notice</label>
                <input name="wireNotice" defaultValue={s.wireNotice} />
              </div>
            </div>

            <div className="form-section-title">Footer</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Footer left</label>
                <input name="footerLeft" defaultValue={s.footerLeft} />
              </div>
              <div className="form-group">
                <label>Footer right</label>
                <input name="footerRight" defaultValue={s.footerRight} />
              </div>
            </div>
            <SubmitButton icon="fa-save">Save settings</SubmitButton>
          </ActionForm>
        </div>

        <div>
          <div className="panel">
            <div className="panel-title">
              <span>
                <i className="fas fa-tags" /> Products &amp; rates
              </span>
            </div>
            <p className="modal-note" style={{ marginTop: 0, marginBottom: "1rem" }}>
              Shown on the customer dashboard and each product&apos;s page. Rate changes apply to new applications immediately.
            </p>
            {products.map((p) => (
              <details key={p.id} className="upload-box" style={{ padding: "1rem" }}>
                <summary style={{ cursor: "pointer", display: "flex", gap: ".6rem", alignItems: "center" }}>
                  <i className={`fas ${p.icon}`} style={{ color: "#007287" }} />
                  <strong style={{ flex: 1 }}>{p.title}</strong>
                  {!p.active ? <span className="badge badge-grey">Hidden</span> : null}
                </summary>
                <ActionForm action={saveProductAction} resetOnSuccess={false} style={{ marginTop: "1rem" }}>
                  <input type="hidden" name="productId" value={p.id} />
                  <ProductFields p={p} />
                  <SubmitButton icon="fa-save">Save</SubmitButton>
                </ActionForm>
                <ActionForm action={deleteProductAction} confirm={`Delete "${p.title}"?`} style={{ marginTop: ".5rem" }}>
                  <input type="hidden" name="productId" value={p.id} />
                  <SubmitButton className="btn-secondary" icon="fa-trash">
                    Delete
                  </SubmitButton>
                </ActionForm>
              </details>
            ))}
          </div>

          <div className="panel">
            <div className="panel-title">
              <span>
                <i className="fas fa-plus" /> Add product tile
              </span>
            </div>
            <ActionForm action={saveProductAction}>
              <ProductFields />
              <SubmitButton icon="fa-plus">Add product</SubmitButton>
            </ActionForm>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>
            <i className="fas fa-shield-halved" /> Network access (IP allowlist)
          </span>
          {ipAccess.enabled ? (
            <span className="badge badge-green">
              <i className="fas fa-lock" /> On
            </span>
          ) : (
            <span className="badge badge-grey">Off</span>
          )}
        </div>
        <p className="modal-note" style={{ marginTop: 0, marginBottom: "1rem" }}>
          When the allowlist is on, only the addresses below can open any page of the site, including the sign-in page.
          Everyone else sees an &quot;Access restricted&quot; notice stating the service is for authorized {s.bankName} users only.
        </p>

        <div className={`info-card ${myIpAllowed ? "good" : "warn"}`} style={{ marginBottom: "1rem" }}>
          <i className={`fas ${myIpAllowed ? "fa-circle-check" : "fa-triangle-exclamation"}`} />
          <div>
            Your current IP address is <strong>{myIp ?? "unknown"}</strong>
            {myIpAllowed ? " and it is on the allowlist." : " and it is not on the allowlist yet."}
          </div>
        </div>

        <div className="ip-access-grid">
          <div>
            <div className="form-section-title" style={{ marginTop: 0 }}>Add an address</div>
            <ActionForm action={addIpEntryAction}>
              <div className="form-group">
                <label>IP address or range</label>
                <input name="ip" required placeholder="e.g. 203.0.113.25 or 203.0.113.0/24" />
                <div className="hint">IPv4 or IPv6. Use CIDR notation for a whole office network.</div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input name="label" required maxLength={80} placeholder="e.g. Head office – Saskatoon" />
              </div>
              <SubmitButton icon="fa-plus">Add to allowlist</SubmitButton>
            </ActionForm>
            {myIp && !myIpAllowed ? (
              <ActionForm action={addIpEntryAction} style={{ marginTop: ".6rem" }}>
                <input type="hidden" name="ip" value={myIp} />
                <input type="hidden" name="label" value="Admin – current connection" />
                <SubmitButton className="btn-secondary" icon="fa-location-crosshairs">
                  Add my current IP ({myIp})
                </SubmitButton>
              </ActionForm>
            ) : null}

            <div className="form-section-title">Enforcement</div>
            <ActionForm
              action={setIpAccessAction}
              confirm={
                ipAccess.enabled
                  ? "Turn off the allowlist? The site will be reachable from any network."
                  : `Turn on the allowlist? Only the ${ipAccess.entries.length} listed address(es) will be able to open the site.`
              }
            >
              <input type="hidden" name="decision" value={ipAccess.enabled ? "disable" : "enable"} />
              <SubmitButton
                className={ipAccess.enabled ? "btn-secondary" : "btn-primary"}
                icon={ipAccess.enabled ? "fa-lock-open" : "fa-lock"}
              >
                {ipAccess.enabled ? "Turn off allowlist" : "Turn on allowlist"}
              </SubmitButton>
            </ActionForm>
            <p className="modal-note" style={{ marginTop: ".75rem" }}>
              You can&apos;t turn the allowlist on, or remove an entry, if that would block your own connection. If you&apos;re ever locked
              out, set <code>IP_ALLOWLIST_BYPASS=true</code> in <code>.env</code> and restart the server.
            </p>
          </div>

          <div>
            <div className="form-section-title" style={{ marginTop: 0 }}>
              Allowed addresses ({ipAccess.entries.length})
            </div>
            {ipAccess.entries.length === 0 ? (
              <div className="empty">No addresses yet. Add your office network and your own IP before turning the allowlist on.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>Description</th>
                      <th>Added</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {ipAccess.entries.map((e) => (
                      <tr key={e.value}>
                        <td>
                          <code>{e.value}</code>
                          {myIp && isAllowed(myIp, buildMatcher([e])) ? (
                            <span className="badge badge-blue" style={{ marginLeft: ".4rem" }}>
                              You
                            </span>
                          ) : null}
                        </td>
                        <td>{e.label}</td>
                        <td className="muted" style={{ whiteSpace: "nowrap" }}>
                          {e.addedAt ? friendlyDate(e.addedAt, s) : "—"}
                          {e.addedBy ? <div>{e.addedBy}</div> : null}
                        </td>
                        <td className="num">
                          <ActionForm action={removeIpEntryAction} confirm={`Remove ${e.value} from the allowlist?`}>
                            <input type="hidden" name="value" value={e.value} />
                            <SubmitButton className="btn-secondary" icon="fa-trash" pendingText="…">
                              Remove
                            </SubmitButton>
                          </ActionForm>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ProductFields({
  p,
}: {
  p?: {
    id: number;
    title: string;
    description: string;
    icon: string;
    sortOrder: number;
    active: boolean;
    kind: ProductKind;
    slug: string | null;
    summary: string | null;
    minAmount: Prisma.Decimal | null;
    options: Prisma.JsonValue;
  };
}) {
  const options = parseOptions(p?.options);
  const rows = [...options, ...Array.from({ length: options.length ? 1 : 3 }, () => null)];
  return (
    <>
      <div className="form-grid">
        <div className="form-group">
          <label>Title</label>
          <input name="title" defaultValue={p?.title} required />
        </div>
        <div className="form-group">
          <label>Product type</label>
          <select name="kind" defaultValue={p?.kind ?? "GENERAL"}>
            {Object.entries(PRODUCT_KIND_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Tile subtitle</label>
          <input name="description" defaultValue={p?.description} placeholder="e.g. 4.1% · 2yr term" />
        </div>
        <div className="form-group">
          <label>Page URL</label>
          <input name="slug" defaultValue={p?.slug ?? ""} placeholder="auto from title" />
          <div className="hint">/dashboard/products/{p?.slug ?? "…"}</div>
        </div>
      </div>
      <div className="form-group">
        <label>Page summary</label>
        <textarea name="summary" defaultValue={p?.summary ?? ""} rows={3} />
      </div>
      <div className="form-group">
        <label>Minimum amount (optional)</label>
        <div className="amount-input">
          <input name="minAmount" type="number" step="0.01" min="0" defaultValue={p?.minAmount ? Number(p.minAmount) : ""} />
        </div>
      </div>
      <div className="form-group">
        <label>Rates &amp; options</label>
        <div className="option-rows">
          <div className="option-row head">
            <span>Label</span>
            <span>Rate %</span>
            <span>Months</span>
            <span>Note</span>
          </div>
          {rows.map((o, i) => (
            <div key={i} className="option-row">
              <input name="optLabel" defaultValue={o?.label ?? ""} placeholder="e.g. 2-year non-redeemable" />
              <input name="optRate" type="number" step="0.01" min="0" defaultValue={o?.rate ?? ""} />
              <input name="optMonths" type="number" min="1" defaultValue={o?.months ?? ""} />
              <input name="optNote" defaultValue={o?.note ?? ""} />
            </div>
          ))}
        </div>
        <div className="hint">Leave a label empty to remove that row. Save to get another blank row.</div>
      </div>
      <div className="form-group">
        <label>Icon</label>
        <IconPicker name="icon" icons={PRODUCT_ICONS} defaultValue={p?.icon ?? PRODUCT_ICONS[0]} idPrefix={`prod${p?.id ?? "new"}`} />
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label>Sort order</label>
          <input name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} />
        </div>
        <label className="check-row" style={{ alignSelf: "center" }}>
          <input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> Visible
        </label>
      </div>
    </>
  );
}
