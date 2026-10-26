"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";
import { homePathFor } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import type { FormState } from "@/lib/action-state";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = {
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    email: str(fd, "email").toLowerCase(),
    dateOfBirth: str(fd, "dateOfBirth"),
    addressLine: str(fd, "addressLine"),
    city: str(fd, "city"),
    province: str(fd, "province"),
    postalCode: str(fd, "postalCode"),
    country: str(fd, "country"),
  };
  const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
  const confirm = typeof fd.get("confirmPassword") === "string" ? (fd.get("confirmPassword") as string) : "";

  const fieldErrors: Record<string, string> = {};
  if (!values.firstName) fieldErrors.firstName = "Required";
  if (!values.lastName) fieldErrors.lastName = "Required";
  if (!EMAIL_RE.test(values.email)) fieldErrors.email = "Enter a valid email";
  if (!values.addressLine) fieldErrors.addressLine = "Required";
  if (!values.city) fieldErrors.city = "Required";
  if (!values.province) fieldErrors.province = "Required";
  if (!values.postalCode) fieldErrors.postalCode = "Required";
  if (!values.country) fieldErrors.country = "Required";

  const dob = values.dateOfBirth ? new Date(`${values.dateOfBirth}T00:00:00Z`) : null;
  if (!dob || Number.isNaN(dob.getTime())) {
    fieldErrors.dateOfBirth = "Required";
  } else {
    const adult = new Date(dob);
    adult.setUTCFullYear(adult.getUTCFullYear() + 18);
    if (adult > new Date()) fieldErrors.dateOfBirth = "You must be at least 18";
  }

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    fieldErrors.password = "At least 8 characters with letters and numbers";
  }
  if (password !== confirm) fieldErrors.confirmPassword = "Passwords do not match";
  if (fd.get("terms") !== "on") fieldErrors.terms = "You must accept the terms";

  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors, values };

  const settings = await getSettings();
  let user;
  try {
    user = await prisma.user.create({
      data: {
        ...values,
        dateOfBirth: dob,
        passwordHash: await bcrypt.hash(password, 12),
        branch: settings.defaultBranch,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "An account with this email already exists.", fieldErrors: { email: "Already registered" }, values };
    }
    throw e;
  }

  await createSession({ uid: user.id, role: "CUSTOMER" });
  redirect("/onboarding/documents");
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Incorrect email or password.", values: { email } };
  }
  if (user.suspended) return { error: "This account is suspended. Please contact the branch.", values: { email } };

  await createSession({ uid: user.id, role: user.role });
  redirect(homePathFor(user));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
