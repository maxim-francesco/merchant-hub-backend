import { prisma } from './prismaClient';

export function slugify(input: string): string {
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  let slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length > 100) {
    slug = slug.substring(0, 100).replace(/-+$/, '');
  }

  if (slug.length < 2) {
    return 'item';
  }

  return slug;
}

export async function generateUniqueSlug(
  model: 'category' | 'product',
  tenantId: string,
  base: string
): Promise<string> {
  const dbModel = model === 'category' ? prisma.category : prisma.product;

  const existing = await (dbModel as any).findMany({
    where: {
      tenantId,
      slug: {
        startsWith: base,
      },
    },
    select: {
      slug: true,
    },
  });

  const taken = new Set<string>(existing.map((x: any) => x.slug));

  if (!taken.has(base)) {
    return base;
  }

  let n = 2;
  while (true) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
    n++;
  }
}
