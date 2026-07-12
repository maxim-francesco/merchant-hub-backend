import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BCRYPT_ROUNDS = 10;

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ── 1. Clean existing data in dependency order ─────────────────────────────
  console.log('🧹 Clearing existing data...');
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.tenantMember.deleteMany(),
    prisma.user.deleteMany(),
    prisma.tenant.deleteMany(),
  ]);
  console.log('   ✓ Database cleared.\n');

  // ── 2. Super Admin User ────────────────────────────────────────────────────
  console.log('👤 Creating Super Admin user...');
  const passwordHash = await bcrypt.hash('password123', BCRYPT_ROUNDS);

  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@merchanthub.com',
      passwordHash,
      globalRole: 'SUPER_ADMIN',
    },
  });
  console.log(`   ✓ Super Admin created: ${superAdmin.email} (id: ${superAdmin.id})\n`);

  // ── 3. Demo Tenant ─────────────────────────────────────────────────────────
  console.log('🏪 Creating Demo Tenant "Luxe Fashion"...');
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Luxe Fashion',
      slug: 'luxe-fashion',
      settings: {
        currency: 'USD',
        timezone: 'Europe/Bucharest',
        billingMode: 'B2C',
        stripeSecretKey: 'sk_test_mock_luxe_fashion_secret_key_12345',
        stripeWebhookSecret: 'whsec_test_mock_12345',
        paymentGateways: {
          stripe: { enabled: true, publicKey: 'pk_test_placeholder' },
          paypal: { enabled: false },
        },
        features: {
          reviews: true,
          wishlist: true,
          multiCurrency: false,
        },
      },
    },
  });
  console.log(`   ✓ Tenant created: ${tenant.name} (slug: ${tenant.slug})\n`);

  // ── 4. Tenant Member — link Super Admin as OWNER ───────────────────────────
  console.log('🔗 Linking Super Admin to tenant as OWNER...');
  await prisma.tenantMember.create({
    data: {
      userId: superAdmin.id,
      tenantId: tenant.id,
      role: 'OWNER',
    },
  });
  console.log('   ✓ TenantMember relation created.\n');

  // ── 5. Categories ──────────────────────────────────────────────────────────
  console.log('📂 Creating categories...');
  const [accessories, apparel] = await Promise.all([
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Accessories',
        slug: 'accessories',
        expectedAttributes: ['Material', 'Dimensiune'],
      },
    }),
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Apparel',
        slug: 'apparel',
        expectedAttributes: ['Mărime', 'Culoare', 'Material'],
      },
    }),
  ]);
  console.log(`   ✓ Category: ${accessories.name}`);
  console.log(`   ✓ Category: ${apparel.name}\n`);

  // ── 6. Products ────────────────────────────────────────────────────────────
  console.log('📦 Creating products...');
  const productsData = [
    {
      tenantId: tenant.id,
      categoryId: accessories.id,
      name: 'Leather Crossbody Bag',
      slug: 'leather-crossbody-bag',
      price: 129.99,
      attributes: {
        color: 'cognac',
        material: 'genuine leather',
        strap: 'adjustable',
        dimensions: '22cm x 15cm x 8cm',
        inStock: true,
        tags: ['bestseller', 'summer-collection'],
      },
    },
    {
      tenantId: tenant.id,
      categoryId: accessories.id,
      name: 'Gold-Plated Hoop Earrings',
      slug: 'gold-plated-hoop-earrings',
      price: 49.95,
      attributes: {
        color: 'gold',
        material: '18k gold-plated brass',
        diameter: '40mm',
        inStock: true,
        tags: ['new-arrival', 'jewelry'],
      },
    },
    {
      tenantId: tenant.id,
      categoryId: apparel.id,
      name: 'Silk Wrap Midi Dress',
      slug: 'silk-wrap-midi-dress',
      price: 219.0,
      attributes: {
        color: 'dusty rose',
        material: '100% silk',
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        fit: 'wrap',
        care: 'dry clean only',
        inStock: true,
        tags: ['evening-wear', 'spring-collection'],
      },
    },
  ];

  const products = await Promise.all(
    productsData.map((p) => prisma.product.create({ data: p })),
  );

  products.forEach((p) => console.log(`   ✓ Product: ${p.name} ($${p.price})`));

  console.log('\n✅ Seeding complete!\n');
  console.log('─────────────────────────────────────────────');
  console.log('  Super Admin  : admin@merchanthub.com');
  console.log('  Password     : password123');
  console.log('  Tenant       : Luxe Fashion (luxe-fashion)');
  console.log(`  Categories   : ${accessories.name}, ${apparel.name}`);
  console.log(`  Products     : ${products.length} created`);
  console.log('─────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

