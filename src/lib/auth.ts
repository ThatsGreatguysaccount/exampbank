import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { readSession } from "./session";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user || user.suspended) return null;
  return user;
});

export function homePathFor(user: Pick<User, "role" | "kycStatus">) {
  if (user.role === "ADMIN") return "/admin";
  switch (user.kycStatus) {
    case "APPROVED":
      return "/dashboard";
    case "PENDING_REVIEW":
      return "/onboarding/status";
    default:
      return "/onboarding/documents";
  }
}

export async function requireCustomer() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER") redirect("/admin");
  return user;
}

export async function requireApprovedCustomer() {
  const user = await requireCustomer();
  if (user.kycStatus !== "APPROVED") redirect(homePathFor(user));
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect(homePathFor(user));
  return user;
}
