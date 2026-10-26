const esc = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const SHIELD = `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/><rect x="9" y="11" width="6" height="5" rx="1"/><path d="M10 11V9.5a2 2 0 014 0V11"/></svg>`;

function layout(title: string, bankName: string, body: string) {
  const bank = esc(bankName);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · ${bank}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#13313b;
    background:linear-gradient(160deg,#0b3d4a 0%,#007287 100%)}
  main{width:100%;max-width:560px;background:#fff;border-radius:20px;padding:2.5rem 2.25rem;
    box-shadow:0 30px 60px -20px rgba(0,0,0,.45)}
  .brand{display:flex;align-items:center;gap:.6rem;font-weight:700;color:#0b3d4a;margin-bottom:2rem}
  .brand-mark{width:34px;height:34px;border-radius:10px;background:#e3f3f6;color:#007287;display:grid;place-items:center;font-size:.95rem}
  .icon{width:60px;height:60px;border-radius:16px;background:#fdecec;color:#b42318;display:grid;place-items:center;margin-bottom:1.25rem}
  .code{font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#b42318;margin:0 0 .4rem}
  h1{font-size:1.6rem;margin:0 0 .9rem;color:#0b3d4a}
  p{line-height:1.6;margin:0 0 1rem;color:#3d5560}
  dl{margin:1.5rem 0;padding:1rem 1.2rem;border:1px solid #e2e9f0;border-radius:14px;background:#f7fafc;display:grid;grid-template-columns:auto 1fr;gap:.5rem 1.25rem;font-size:.9rem}
  dt{color:#6b8290}
  dd{margin:0;font-weight:600;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all;text-align:right}
  .foot{font-size:.8rem;color:#6b8290;border-top:1px solid #e2e9f0;padding-top:1rem;margin:1.5rem 0 0}
</style>
</head>
<body>
<main>
  <div class="brand"><span class="brand-mark">${bank.charAt(0)}</span>${bank}</div>
  ${body}
</main>
</body>
</html>`;
}

export function restrictedPage(o: { bankName: string; ip: string | null; reference: string; time: Date }) {
  const bank = esc(o.bankName);
  return layout(
    "Access restricted",
    o.bankName,
    `<div class="icon">${SHIELD}</div>
  <p class="code">Error 403 · Access restricted</p>
  <h1>This service is available to authorized ${bank} users only</h1>
  <p>Access to ${bank} online banking is limited to approved networks. For your security and the security of our members, connections from your current network have not been authorized.</p>
  <p>If you believe you should have access, please contact ${bank} or your system administrator and quote the reference below so your access can be reviewed.</p>
  <dl>
    <dt>Your IP address</dt><dd>${esc(o.ip ?? "Unavailable")}</dd>
    <dt>Reference</dt><dd>${esc(o.reference)}</dd>
    <dt>Date &amp; time (UTC)</dt><dd>${esc(o.time.toISOString().replace("T", " ").slice(0, 19))}</dd>
  </dl>
  <p class="foot">Access attempts to this service are monitored and recorded. Unauthorized use is prohibited.</p>`,
  );
}

export function unavailablePage(bankName: string) {
  return layout(
    "Service temporarily unavailable",
    bankName,
    `<p class="code">Error 503</p>
  <h1>Service temporarily unavailable</h1>
  <p>We're unable to verify your access right now. Please try again in a few minutes.</p>`,
  );
}
