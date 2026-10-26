import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Brand } from "@/components/Brand";
import { Stepper } from "@/components/Stepper";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  const settings = await getSettings();

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Brand settings={settings} />
        <Stepper current={0} />
        <h2 className="auth-title">Open your membership</h2>
        <p className="auth-sub">
          Tell us about yourself. Next you&apos;ll upload a photo ID and a recent bank statement so we can verify
          your identity.
        </p>
        <RegisterForm />
      </div>
    </main>
  );
}
