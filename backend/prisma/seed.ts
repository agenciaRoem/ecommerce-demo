import { PrismaClient, RoleName } from '@prisma/client';
import * as argon2 from 'argon2';
import { seedDemoCatalog } from './seed-demo-catalog';

const prisma = new PrismaClient();

const ROLES: { name: RoleName; description: string }[] = [
  { name: 'SUPERADMIN', description: 'Control global del sitio' },
  { name: 'GERENTE', description: 'Métricas y gestión' },
  { name: 'SALA', description: 'Operación de sucursal' },
  { name: 'STOCKEO', description: 'Carga de depósito' },
  { name: 'ENCARGADO_STOCK', description: 'Alta y edición de productos' },
];

const BRANCHES = [
  { code: 'CEN', name: 'Sucursal Centro', address: 'Dirección a definir 100' },
  { code: 'NOR', name: 'Sucursal Norte', address: 'Dirección a definir 200' },
  { code: 'SUR', name: 'Sucursal Sur', address: 'Dirección a definir 300' },
];

const CATEGORIES = [
  { name: 'Papelería', slug: 'papeleria' },
  { name: 'Útiles escolares', slug: 'utiles-escolares' },
  { name: 'Oficina', slug: 'oficina' },
  { name: 'Arte y manualidades', slug: 'arte-y-manualidades' },
];

async function main() {
  for (const role of ROLES) {
    await prisma.role.upsert({ where: { name: role.name }, update: {}, create: role });
  }
  for (const branch of BRANCHES) {
    await prisma.branch.upsert({ where: { code: branch.code }, update: {}, create: branch });
  }
  for (const category of CATEGORIES) {
    await prisma.category.upsert({ where: { slug: category.slug }, update: {}, create: category });
  }

  await seedSuperadmin();
  await seedDemoStaff();
  if (process.env.SEED_DEMO_CATALOG === 'true') await seedDemoCatalog(prisma);
}

function requirePassword(name: string): string | undefined {
  const password = process.env[name];
  if (!password) return undefined;
  if (password.length < 12) throw new Error(`${name} debe tener al menos 12 caracteres.`);
  return password;
}

async function seedSuperadmin() {
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const password = requirePassword('SEED_SUPERADMIN_PASSWORD');
  if (!email || !password) {
    console.warn('SEED_SUPERADMIN_EMAIL/PASSWORD no definidos: se omite el SUPERADMIN inicial.');
    return;
  }
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPERADMIN' } });
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, fullName: 'Super Admin', passwordHash: await argon2.hash(password), roleId: role.id },
  });
}

/** Personal de ejemplo (solo desarrollo): se crea únicamente si se define SEED_DEMO_STAFF_PASSWORD. */
async function seedDemoStaff() {
  const password = requirePassword('SEED_DEMO_STAFF_PASSWORD');
  if (!password) return;

  const passwordHash = await argon2.hash(password);
  const demo: { email: string; fullName: string; role: RoleName; branch: string }[] = [
    { email: 'gerente.cen@omnistock.local', fullName: 'Gerente Centro', role: 'GERENTE', branch: 'CEN' },
    { email: 'sala.cen@omnistock.local', fullName: 'Sala Centro', role: 'SALA', branch: 'CEN' },
    { email: 'sala.nor@omnistock.local', fullName: 'Sala Norte', role: 'SALA', branch: 'NOR' },
    { email: 'stockeo.cen@omnistock.local', fullName: 'Stockeo Centro', role: 'STOCKEO', branch: 'CEN' },
    { email: 'stockeo.nor@omnistock.local', fullName: 'Stockeo Norte', role: 'STOCKEO', branch: 'NOR' },
    { email: 'encargado.cen@omnistock.local', fullName: 'Encargado de Stock Centro', role: 'ENCARGADO_STOCK', branch: 'CEN' },
  ];
  for (const staff of demo) {
    const [role, branch] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { name: staff.role } }),
      prisma.branch.findUniqueOrThrow({ where: { code: staff.branch } }),
    ]);
    await prisma.user.upsert({
      where: { email: staff.email },
      update: {},
      create: { email: staff.email, fullName: staff.fullName, passwordHash, roleId: role.id, branchId: branch.id },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
