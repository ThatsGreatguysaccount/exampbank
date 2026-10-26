import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Brand } from "@/components/Brand";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  const settings = await getSettings();

  return (
    <main className="auth-shell">
      <div className="auth-card narrow">
        <Brand settings={settings} />
        <h2 className="auth-title">Welcome back</h2>
        <p className="auth-sub">Sign in to continue to online banking.</p>
        <LoginForm />
      </div>
    </main>
  );
}
