import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BCRYPT_ROUNDS = 10;

// Command line arguments parser
function parseArgs() {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = argv[i + 1];
      if (val && !val.startsWith('--')) {
        args[key] = val;
        i++;
      } else {
        args[key] = '';
      }
    }
  }
  return args;
}

// Zod Validation Schema
const createTenantSchema = z.object({
  name: z.string().min(2, 'Name must be between 2 and 120 characters').max(120, 'Name must be between 2 and 120 characters'),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens only, with no double or leading/trailing hyphens'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

async function main() {
  const args = parseArgs();
  const name = args['name'];
  const slug = args['slug'];
  const email = args['email'];
  const password = args['password'];

  if (!name || !slug || !email || !password) {
    console.error('❌ Error: Missing required arguments.');
    console.error('Usage: npx tsx scripts/create-tenant.ts --name "Tenant Name" --slug "tenant-slug" --email "owner@example.com" --password "securepassword"');
    process.exit(1);
  }

  // Validate inputs
  const parsed = createTenantSchema.safeParse({ name, slug, email, password });
  if (!parsed.success) {
    console.error('❌ Validation failed:');
    const errors = parsed.error.flatten().fieldErrors;
    for (const [field, messages] of Object.entries(errors)) {
      console.error(`   - ${field}: ${messages?.join(', ')}`);
    }
    process.exit(1);
  }

  // Password hashing
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    // Atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Pre-check slug uniqueness
      const existingTenant = await tx.tenant.findUnique({
        where: { slug },
      });
      if (existingTenant) {
        throw new Error(`Tenant slug "${slug}" is already in use.`);
      }

      // Pre-check email uniqueness
      const existingUser = await tx.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new Error(`User email "${email}" is already in use.`);
      }

      // Create Tenant
      const newTenant = await tx.tenant.create({
        data: {
          name,
          slug,
          settings: {
            currency: 'RON',
            enableB2C: true,
            enableB2B: false,
          },
        },
      });

      // Create User
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          globalRole: 'USER',
        },
      });

      // Create TenantMember link
      await tx.tenantMember.create({
        data: {
          tenantId: newTenant.id,
          userId: newUser.id,
          role: 'OWNER',
        },
      });

      return { newTenant, newUser };
    });

    console.log('✅ Tenant successfully created!');
    console.log(`   Tenant ID:      ${result.newTenant.id}`);
    console.log(`   Tenant Slug:    ${result.newTenant.slug}`);
    console.log(`   Owner Email:    ${result.newUser.email}`);
    console.log(`   Password:       ******** (masked)`);
    console.log(`   Storefront URL: http://localhost:8081/store/${result.newTenant.slug}`);
  } catch (error: any) {
    console.error(`❌ Creation failed: ${error.message}`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('❌ Unexpected script failure:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
