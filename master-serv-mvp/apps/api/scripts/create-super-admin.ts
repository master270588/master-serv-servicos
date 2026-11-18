import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Defina SUPER_ADMIN_EMAIL com um e-mail válido.');
  }
  if (!password || password.length < 16) {
    throw new Error('Defina SUPER_ADMIN_PASSWORD com pelo menos 16 caracteres.');
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.appUser.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new Error('Já existe uma conta com esse e-mail. Nenhuma permissão foi alterada.');
    }
    const role = await prisma.role.findUnique({ where: { code: 'super_admin' } });
    if (!role) throw new Error('Papel super_admin ausente. Aplique primeiro database/001_initial_schema.sql.');

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.appUser.create({
        data: { email, passwordHash, status: 'active' },
        select: { id: true, email: true },
      });
      await tx.userRole.create({ data: { userId: created.id, roleId: role.id } });
      await tx.auditEvent.create({
        data: {
          actorUserId: created.id,
          action: 'admin.bootstrap_created',
          entityType: 'app_user',
          entityId: created.id,
          metadata: { role: 'super_admin', method: 'one_time_bootstrap_script' },
        },
      });
      return created;
    });
    process.stdout.write(`Superadministrador criado: ${user.email}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Falha ao criar superadministrador.'}\n`);
  process.exitCode = 1;
});
