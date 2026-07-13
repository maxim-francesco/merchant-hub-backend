import { prisma } from '../src/utils/prismaClient';

interface MigrationAction {
  id: string;
  slug: string;
  actions: string[];
  warning: boolean;
  newSettings: any;
}

const maskSecret = (val: string | null | undefined): string => {
  if (!val) return 'N/A';
  if (val.length <= 8) return '••••••••';
  return val.slice(0, 4) + '...' + val.slice(-4);
};

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply') && !args.includes('--dry-run');
  const isDryRun = !isApply;

  console.log(`==================================================`);
  console.log(`TENANT SETTINGS MIGRATION SCRIPT`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (ReadOnly)' : 'APPLY (Write)'}`);
  console.log(`==================================================\n`);

  const tenants = await prisma.tenant.findMany();
  const migrationActions: MigrationAction[] = [];

  for (const tenant of tenants) {
    const settings = { ...((tenant.settings as any) || {}) };
    const actions: string[] = [];
    let warning = false;
    let modified = false;

    const legacyKey = settings.paymentGatewayApiKey;
    const newKey = settings.stripeSecretKey;
    const currentCurrency = settings.currency;

    // 1. Handle Stripe Secret Key canonicalization
    if (legacyKey !== undefined) {
      if (newKey === undefined) {
        // Safe migration
        settings.stripeSecretKey = legacyKey;
        delete settings.paymentGatewayApiKey;
        actions.push(`Move paymentGatewayApiKey (${maskSecret(legacyKey)}) -> stripeSecretKey`);
        modified = true;
      } else {
        // Warning case: both exist, do NOT overwrite
        delete settings.paymentGatewayApiKey;
        actions.push(`Delete paymentGatewayApiKey (${maskSecret(legacyKey)}) WITHOUT overwrite (existing: ${maskSecret(newKey)})`);
        warning = true;
        modified = true;
      }
    }

    // 2. Force currency to RON
    if (currentCurrency !== 'RON') {
      settings.currency = 'RON';
      actions.push(`Set currency: ${currentCurrency || 'N/A'} -> RON`);
      modified = true;
    }

    if (modified) {
      migrationActions.push({
        id: tenant.id,
        slug: tenant.slug,
        actions,
        warning,
        newSettings: settings,
      });
    }
  }

  if (migrationActions.length === 0) {
    console.log('All tenants are already canonicalized and up to date. No actions needed.');
    return;
  }

  // Print Table of Actions
  console.log(String.prototype.padEnd ? 'Tenant Slug'.padEnd(20) + ' | ' + 'Actions to Take' : 'Tenant Slug | Actions to Take');
  console.log('-'.repeat(80));
  for (const ma of migrationActions) {
    const slugCol = ma.slug.padEnd(20);
    const actionText = ma.actions.join(', ');
    console.log(`${slugCol} | ${actionText}${ma.warning ? ' [WARNING]' : ''}`);
  }
  console.log('');

  if (isDryRun) {
    console.log('DRY RUN ONLY - No database changes were made.');
    console.log('To apply these changes, run with the --apply flag:');
    console.log('  npx tsx backend/scripts/migrate-settings-canonical.ts --apply\n');
  } else {
    console.log('Applying migrations to the database...');
    try {
      await prisma.$transaction(async (tx) => {
        for (const ma of migrationActions) {
          await tx.tenant.update({
            where: { id: ma.id },
            data: {
              settings: ma.newSettings,
            },
          });
        }
      });
      console.log('SUCCESS: Migration completed successfully.');
    } catch (err: any) {
      console.error('ERROR: Failed to run database transaction:', err.message || err);
      process.exit(1);
    }
  }
}

main()
  .catch((err) => {
    console.error('Migration crashed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
