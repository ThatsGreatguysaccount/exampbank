"use server";

import { redirect } from "next/navigation";
import type { DocumentKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { deleteUpload, isFilePresent, saveUpload, type SavedFile } from "@/lib/storage";
import type { FormState } from "@/lib/action-state";

const ID_TYPES = ["PASSPORT", "DRIVERS_LICENSE", "NATIONAL_ID"];

export async function submitDocumentsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireCustomer();
  if (user.kycStatus !== "PENDING_DOCUMENTS" && user.kycStatus !== "REJECTED") {
    redirect("/onboarding/status");
  }

  const idType = fd.get("idType");
  const idFront = fd.get("idFront");
  const idBack = fd.get("idBack");
  const statement = fd.get("bankStatement");

  const fieldErrors: Record<string, string> = {};
  if (typeof idType !== "string" || !ID_TYPES.includes(idType)) fieldErrors.idType = "Choose your ID type";
  if (!isFilePresent(idFront)) fieldErrors.idFront = "Upload the front of your ID";
  if (idType !== "PASSPORT" && !isFilePresent(idBack)) fieldErrors.idBack = "Upload the back of your ID";
  if (!isFilePresent(statement)) fieldErrors.bankStatement = "Upload your bank statement (PDF)";
  if (Object.keys(fieldErrors).length) return { error: "Some documents are missing.", fieldErrors };

  const toSave: { kind: DocumentKind; file: File; allowed: ("pdf" | "image")[] }[] = [
    { kind: "ID_FRONT", file: idFront as File, allowed: ["image", "pdf"] },
    { kind: "BANK_STATEMENT", file: statement as File, allowed: ["pdf"] },
  ];
  if (isFilePresent(idBack)) toSave.push({ kind: "ID_BACK", file: idBack, allowed: ["image", "pdf"] });

  const saved: (SavedFile & { kind: DocumentKind })[] = [];
  for (const item of toSave) {
    const res = await saveUpload(item.file, item.allowed);
    if (typeof res === "string") {
      await Promise.all(saved.map((s) => deleteUpload(s.storedName)));
      const field = item.kind === "ID_FRONT" ? "idFront" : item.kind === "ID_BACK" ? "idBack" : "bankStatement";
      return { error: res, fieldErrors: { [field]: res } };
    }
    saved.push({ ...res, kind: item.kind });
  }

  const previous = await prisma.document.findMany({ where: { userId: user.id } });
  await prisma.$transaction([
    prisma.document.deleteMany({ where: { userId: user.id } }),
    prisma.document.createMany({
      data: saved.map((s) => ({
        userId: user.id,
        kind: s.kind,
        idType: s.kind === "BANK_STATEMENT" ? null : (idType as string),
        fileName: s.fileName,
        storedName: s.storedName,
        mimeType: s.mimeType,
        size: s.size,
      })),
    }),
    prisma.user.update({ where: { id: user.id }, data: { kycStatus: "PENDING_REVIEW", kycNote: null } }),
  ]);
  await Promise.all(previous.map((d) => deleteUpload(d.storedName)));

  redirect("/onboarding/status");
}
