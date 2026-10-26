import { logoutAction } from "@/app/actions/auth";

export function LogoutButton({ className = "btn-secondary", label = "Sign out" }: { className?: string; label?: string }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className={className}>
        <i className="fas fa-right-from-bracket" /> {label}
      </button>
    </form>
  );
}
