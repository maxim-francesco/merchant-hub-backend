import type { Request, Response } from 'express';
import { prisma } from '../utils/prismaClient';
import { Prisma } from '@prisma/client';
import { slugify, generateUniqueSlug } from '../utils/slugify';
import {
  createCategorySchema,
  updateCategorySchema,
  createProductSchema,
  updateProductSchema,
} from '../validation/catalogSchemas';
import { z } from 'zod';

// Helper to format validation errors
function handleValidationError(parsed: any, res: Response): void {
  const firstIssueMessage = parsed.error.issues[0]?.message || 'Validation failed';
  const flattenedErrors = parsed.error.flatten().fieldErrors;
  res.status(400).json({
    status: 'error',
    code: 'VALIDATION_ERROR',
    message: firstIssueMessage,
    issues: flattenedErrors,
  });
}

// ── GET /api/v1/catalog/categories ───────────────────────────────────────────
export async function getCategories(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  const categories = await prisma.category.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      expectedAttributes: true,
      _count: { select: { products: true } },
    },
  });

  res.status(200).json({
    status: 'success',
    data: { categories },
  });
}

// ── GET /api/v1/catalog/products ─────────────────────────────────────────────
export async function getProducts(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  const products = await prisma.product.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      attributes: true,
      createdAt: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  res.status(200).json({
    status: 'success',
    data: { products },
  });
}

// ── POST /api/v1/catalog/products ────────────────────────────────────────────
export async function createProduct(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    handleValidationError(parsed, res);
    return;
  }

  const { name, price, categoryId, attributes } = parsed.data;

  // Verify category exists and belongs to active tenant
  const category = await prisma.category.findFirst({
    where: { id: categoryId, tenantId },
  });

  if (!category) {
    res.status(404).json({
      status: 'error',
      code: 'CATEGORY_NOT_FOUND',
      message: 'Category not found.',
    });
    return;
  }

  let attempt = 0;
  while (true) {
    attempt++;
    const base = slugify(name);
    const slug = await generateUniqueSlug('product', tenantId, base);

    try {
      const product = await prisma.product.create({
        data: {
          tenantId,
          categoryId,
          name,
          slug,
          price, // validated string passed directly to Prisma Decimal
          attributes,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          attributes: true,
          createdAt: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      res.status(201).json({
        status: 'success',
        data: { product },
      });
      return;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        attempt < 3
      ) {
        continue;
      }
      throw error;
    }
  }
}

// ── POST /api/v1/catalog/categories ──────────────────────────────────────────
export async function createCategory(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    handleValidationError(parsed, res);
    return;
  }

  const { name, expectedAttributes } = parsed.data;

  let attempt = 0;
  while (true) {
    attempt++;
    const base = slugify(name);
    const slug = await generateUniqueSlug('category', tenantId, base);

    try {
      const category = await prisma.category.create({
        data: {
          tenantId,
          name,
          slug,
          expectedAttributes,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          expectedAttributes: true,
          _count: { select: { products: true } },
        },
      });

      res.status(201).json({
        status: 'success',
        data: { category },
      });
      return;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        attempt < 3
      ) {
        continue;
      }
      throw error;
    }
  }
}

// ── PUT /api/v1/catalog/categories/:id ────────────────────────────────────────
export async function updateCategory(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware
  const id = req.params.id as string;

  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    handleValidationError(parsed, res);
    return;
  }

  const { name, expectedAttributes } = parsed.data;

  // Verify category exists and belongs to tenant
  const existing = await prisma.category.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    res.status(404).json({
      status: 'error',
      code: 'CATEGORY_NOT_FOUND',
      message: 'Category not found.',
    });
    return;
  }

  const category = await prisma.category.update({
    where: {
      id,
    },
    data: {
      name,
      expectedAttributes,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      expectedAttributes: true,
      _count: { select: { products: true } },
    },
  });

  res.status(200).json({
    status: 'success',
    data: { category },
  });
}

// ── DELETE /api/v1/catalog/categories/:id ─────────────────────────────────────
export async function deleteCategory(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware
  const id = req.params.id as string;

  // Check if category exists and belongs to tenant
  const category = await prisma.category.findFirst({
    where: { id, tenantId },
  });

  if (!category) {
    res.status(404).json({
      status: 'error',
      code: 'CATEGORY_NOT_FOUND',
      message: 'Category not found.',
    });
    return;
  }

  // Check if it contains products
  const productCount = await prisma.product.count({
    where: { categoryId: id },
  });

  if (productCount > 0) {
    res.status(400).json({
      status: 'error',
      code: 'CATEGORY_HAS_PRODUCTS',
      message: 'Cannot delete category because it contains products. Reassign or delete those products first.',
    });
    return;
  }

  await prisma.category.delete({
    where: { id },
  });

  res.status(200).json({
    status: 'success',
    message: 'Category deleted successfully.',
  });
}

// ── PUT /api/v1/catalog/products/:id ──────────────────────────────────────────
export async function updateProduct(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware
  const id = req.params.id as string;

  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    handleValidationError(parsed, res);
    return;
  }

  const { name, price, categoryId, attributes } = parsed.data;

  // Verify product exists and belongs to tenant
  const existing = await prisma.product.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    res.status(404).json({
      status: 'error',
      code: 'PRODUCT_NOT_FOUND',
      message: 'Product not found.',
    });
    return;
  }

  // Verify category exists and belongs to active tenant
  const category = await prisma.category.findFirst({
    where: { id: categoryId, tenantId },
  });

  if (!category) {
    res.status(404).json({
      status: 'error',
      code: 'CATEGORY_NOT_FOUND',
      message: 'Category not found.',
    });
    return;
  }

  const product = await prisma.product.update({
    where: {
      id,
    },
    data: {
      categoryId,
      name,
      price, // validated string passed directly to Prisma Decimal
      attributes,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      attributes: true,
      createdAt: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  res.status(200).json({
    status: 'success',
    data: { product },
  });
}

// ── DELETE /api/v1/catalog/products/:id ───────────────────────────────────────
export async function deleteProduct(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware
  const id = req.params.id as string;

  // Check if product exists and belongs to tenant
  const product = await prisma.product.findFirst({
    where: { id, tenantId },
    include: {
      _count: { select: { orderItems: true } },
    },
  });

  if (!product) {
    res.status(404).json({
      status: 'error',
      code: 'PRODUCT_NOT_FOUND',
      message: 'Product not found.',
    });
    return;
  }

  if (product._count.orderItems > 0) {
    res.status(400).json({
      status: 'error',
      code: 'PRODUCT_HAS_ORDERS',
      message: 'Cannot delete product because it has been ordered in transaction history.',
    });
    return;
  }

  await prisma.product.delete({
    where: { id },
  });

  res.status(200).json({
    status: 'success',
    message: 'Product deleted successfully.',
  });
}
