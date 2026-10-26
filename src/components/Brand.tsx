import type { Settings } from "@/lib/settings";

export function Brand({ settings }: { settings: Settings }) {
  return (
    <div className="brand">
      <i className={`fas ${settings.brandIcon}`} />
      <div>
        <h1>{settings.bankName}</h1>
        <span>{settings.bankTagline}</span>
      </div>
    </div>
  );
}
