import bcrypt from 'bcrypt';
import type { PrismaClient } from '@prisma/client';

export async function seedCoanaAna(prisma: PrismaClient): Promise<{ tenantId: string }> {
  // a) Upsert the tenant BY SLUG 'coana-ana'
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'coana-ana' },
    update: {
      name: 'Coana Ana',
      settings: {
        currency: 'RON',
        enableB2C: true,
        enableB2B: false,
        stripeSecretKey: 'sk_test_mock_coana_ana_secret_key',
        stripeWebhookSecret: 'whsec_test_mock_coana_ana',
      }
    },
    create: {
      name: 'Coana Ana',
      slug: 'coana-ana',
      settings: {
        currency: 'RON',
        enableB2C: true,
        enableB2B: false,
        stripeSecretKey: 'sk_test_mock_coana_ana_secret_key',
        stripeWebhookSecret: 'whsec_test_mock_coana_ana',
      }
    }
  });

  const tenantId = tenant.id;

  // b) Upsert the owner user BY EMAIL 'contact@coanaana.ro'
  const passwordHash = await bcrypt.hash('parolaCoanaana123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'contact@coanaana.ro' },
    update: {
      passwordHash,
      globalRole: 'USER'
    },
    create: {
      email: 'contact@coanaana.ro',
      passwordHash,
      globalRole: 'USER'
    }
  });

  // c) Ensure a TenantMember linking that user to the Coana Ana tenant with role 'OWNER'
  await prisma.tenantMember.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenantId
      }
    },
    update: {
      role: 'OWNER'
    },
    create: {
      userId: user.id,
      tenantId: tenantId,
      role: 'OWNER'
    }
  });

  // d) Upsert the 3 categories
  const categories = [
    { name: 'Fructe',  slug: 'fructe',  expectedAttributes: ['unit'] },
    { name: 'Legume',  slug: 'legume',  expectedAttributes: ['unit'] },
    { name: 'Băcănie', slug: 'bacanie', expectedAttributes: ['unit'] },
  ];

  const catIds: Record<string, string> = {};
  for (const c of categories) {
    const cat = await prisma.category.upsert({
      where: {
        tenantId_slug: {
          tenantId: tenantId,
          slug: c.slug
        }
      },
      update: {
        name: c.name,
        expectedAttributes: c.expectedAttributes
      },
      create: {
        tenantId: tenantId,
        name: c.name,
        slug: c.slug,
        expectedAttributes: c.expectedAttributes
      }
    });
    catIds[c.slug] = cat.id;
  }

  // e) Upsert these 9 products
  const products = [
    { slug: 'rosii-de-gradina',  name: 'Roșii de grădină',  cat: 'legume',  price: '12.00', stock: 100, unit: 'kg',          featured: true,  description: 'Roșii coapte la soare, culese dimineața din grădina bunicii.' },
    { slug: 'salata-verde',      name: 'Salată verde',      cat: 'legume',  price: '6.00',  stock: 80,  unit: 'buc',         featured: false, description: 'Frunze fragede, crocante, culese în aceeași zi.' },
    { slug: 'morcovi-cu-frunze', name: 'Morcovi cu frunze', cat: 'legume',  price: '7.00',  stock: 60,  unit: 'legătură',    featured: false, description: 'Morcovi dulci, legați manual cu sfoară de iută.' },
    { slug: 'cartofi-noi',       name: 'Cartofi noi',       cat: 'legume',  price: '5.00',  stock: 120, unit: 'kg',          featured: false, description: 'Cartofi tineri, cu coajă subțire, ideali pentru copt.' },
    { slug: 'mere-ionatan',      name: 'Mere ionatan',      cat: 'fructe',  price: '8.00',  stock: 90,  unit: 'kg',          featured: true,  description: 'Mere dulci-acrișoare, perfecte pentru o gustare sănătoasă.' },
    { slug: 'capsuni-de-beriu',  name: 'Căpșuni de Beriu',  cat: 'fructe',  price: '22.00', stock: 40,  unit: 'kg',          featured: true,  description: 'Căpșuni parfumate, culese la primele ore ale dimineții.' },
    { slug: 'lamai-siciliene',   name: 'Lămâi siciliene',   cat: 'fructe',  price: '18.00', stock: 50,  unit: 'kg',          featured: false, description: 'Lămâi aromate cu coajă groasă, perfecte pentru limonadă.' },
    { slug: 'miere-de-salcam',   name: 'Miere de salcâm',   cat: 'bacanie', price: '45.00', stock: 30,  unit: 'borcan 500g', featured: true,  description: 'Miere pură de salcâm de la stupinele din Apuseni.' },
    { slug: 'paine-de-casa',     name: 'Pâine de casă',     cat: 'bacanie', price: '14.00', stock: 25,  unit: 'buc',         featured: false, description: 'Pâine cu maia, coaptă în cuptor cu lemne.' },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: {
        tenantId_slug: {
          tenantId: tenantId,
          slug: p.slug
        }
      },
      update: {
        name: p.name,
        price: p.price,
        stock: p.stock,
        categoryId: catIds[p.cat],
        attributes: { unit: p.unit, description: p.description, featured: p.featured, imageUrl: null }
      },
      create: {
        tenantId: tenantId,
        categoryId: catIds[p.cat],
        name: p.name,
        slug: p.slug,
        price: p.price,
        stock: p.stock,
        attributes: { unit: p.unit, description: p.description, featured: p.featured, imageUrl: null }
      }
    });
  }

  return { tenantId };
}
