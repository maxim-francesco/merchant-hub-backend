import type { Request, Response } from 'express';
import { prisma } from '../utils/prismaClient';

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
  const { name, slug, price, categoryId, attributes } = req.body;

  if (!name || !slug || !price || !categoryId) {
    res.status(400).json({
      status: 'error',
      message: 'Missing required fields: name, slug, price, and categoryId are required.',
    });
    return;
  }

  try {
    const product = await prisma.product.create({
      data: {
        tenantId,
        categoryId,
        name,
        slug,
        price: parseFloat(price),
        attributes: attributes || {},
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
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to create product.',
    });
  }
}

// ── POST /api/v1/catalog/categories ──────────────────────────────────────────
export async function createCategory(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware
  const { name, slug, expectedAttributes } = req.body;

  if (!name || !slug) {
    res.status(400).json({
      status: 'error',
      message: 'Missing required fields: name and slug are required.',
    });
    return;
  }

  try {
    const category = await prisma.category.create({
      data: {
        tenantId,
        name,
        slug,
        expectedAttributes: Array.isArray(expectedAttributes) ? expectedAttributes : [],
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
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to create category.',
    });
  }
}

// ── PUT /api/v1/catalog/categories/:id ────────────────────────────────────────
export async function updateCategory(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware
  const id = req.params.id as string;
  const { name, slug, expectedAttributes } = req.body;

  if (!name || !slug) {
    res.status(400).json({
      status: 'error',
      message: 'Missing required fields: name and slug are required.',
    });
    return;
  }

  try {
    // Verify category exists and belongs to tenant
    const existing = await prisma.category.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({
        status: 'error',
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
        slug,
        expectedAttributes: Array.isArray(expectedAttributes) ? expectedAttributes : undefined,
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
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update category.',
    });
  }
}

// ── DELETE /api/v1/catalog/categories/:id ─────────────────────────────────────
export async function deleteCategory(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware
  const id = req.params.id as string;

  try {
    // Check if category exists and belongs to tenant
    const category = await prisma.category.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      res.status(404).json({
        status: 'error',
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
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to delete category.',
    });
  }
}

// ── PUT /api/v1/catalog/products/:id ──────────────────────────────────────────
export async function updateProduct(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware
  const id = req.params.id as string;
  const { name, slug, price, categoryId, attributes } = req.body;

  if (!name || !slug || !price || !categoryId) {
    res.status(400).json({
      status: 'error',
      message: 'Missing required fields: name, slug, price, and categoryId are required.',
    });
    return;
  }

  try {
    // Verify product exists and belongs to tenant
    const existing = await prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({
        status: 'error',
        message: 'Product not found.',
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
        slug,
        price: parseFloat(price),
        attributes: attributes || {},
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
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update product.',
    });
  }
}

// ── DELETE /api/v1/catalog/products/:id ───────────────────────────────────────
export async function deleteProduct(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware
  const id = req.params.id as string;

  try {
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
        message: 'Product not found.',
      });
      return;
    }

    if (product._count.orderItems > 0) {
      res.status(400).json({
        status: 'error',
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
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to delete product.',
    });
  }
}

