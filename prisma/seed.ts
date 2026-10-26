import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PRODUCT_CATALOG } from "./product-catalog";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "change-this-password";

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      firstName: "Bank",
      lastName: "Admin",
      role: "ADMIN",
      kycStatus: "APPROVED",
    },
  });

  for (const p of PRODUCT_CATALOG) {
    const existing = await prisma.product.findFirst({ where: { OR: [{ slug: p.slug }, { title: p.title }] } });
    if (!existing) {
      await prisma.product.create({ data: p });
    } else if (!existing.slug) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { slug: p.slug, kind: p.kind, summary: p.summary, minAmount: p.minAmount, options: p.options },
      });
    }
  }

  console.log(`Seed complete. Admin login: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
