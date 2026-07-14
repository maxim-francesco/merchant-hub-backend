import { z } from 'zod';
import { normalizePrice } from '../utils/price';

export const slugSchema = z.string()
  .trim()
  .min(2, 'Slug must be at least 2 characters long.')
  .max(120, 'Slug must be at most 120 characters long.')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain only lowercase letters, numbers, and single hyphens.');

export const nameSchema = z.string()
  .trim()
  .min(2, 'Name must be at least 2 characters long.')
  .max(120, 'Name must be at most 120 characters long.');

export const priceSchema = z.union([z.string(), z.number()])
  .transform((val) => normalizePrice(val))
  .refine((val): val is string => val !== null, {
    message: 'Price must be a positive number with at most 2 decimals (extra decimals are rounded).',
  });

const attributeKeySchema = z.string()
  .regex(/^[A-Za-z0-9 _\-]{1,50}$/, 'Attribute keys must be alphanumeric, spaces, underscores, or hyphens (1-50 chars).')
  .refine((key) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype' && key !== '__proto_pollution_sentinel__', {
    message: 'Forbidden key name.',
  });

const attributeValueSchema = z.union([
  z.string().max(500, 'Attribute string value must be at most 500 characters.'),
  z.number().finite('Attribute number value must be finite.'),
  z.boolean(),
  z.array(z.string().max(100, 'Attribute array item must be at most 100 characters.')).max(20, 'Attribute array must have at most 20 items.'),
]);

export const attributesSchema = z.preprocess((val) => {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const proto = Object.getPrototypeOf(val);
    const hasPollution =
      (proto !== Object.prototype && proto !== null) ||
      Object.prototype.hasOwnProperty.call(val, '__proto__') ||
      Object.prototype.hasOwnProperty.call(val, 'constructor') ||
      Object.prototype.hasOwnProperty.call(val, 'prototype');
    if (hasPollution) {
      return { __proto_pollution_sentinel__: true };
    }
  }
  return val;
}, z.record(attributeKeySchema, attributeValueSchema)
  .default({})
  .refine((value) => {
    return !Object.prototype.hasOwnProperty.call(value, '__proto_pollution_sentinel__');
  }, {
    message: 'Forbidden key name or prototype pollution detected.',
  })
  .refine((value) => Object.keys(value).length <= 30, {
    message: 'Attributes must have at most 30 keys.',
  })
  .refine((value) => JSON.stringify(value).length <= 8000, {
    message: 'Serialized attributes size must not exceed 8000 bytes.',
  })
);

export const expectedAttributesSchema = z.array(
  z.string().trim().min(1, 'Attribute name must not be empty.').max(50, 'Attribute name must be at most 50 characters.')
)
  .max(30, 'Expected attributes must have at most 30 items.')
  .default([])
  .transform((arr) => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of arr) {
      const lower = item.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(item);
      }
    }
    return result;
  });

export const stockSchema = z.coerce.number()
  .int('Stock must be an integer.')
  .min(0, 'Stock cannot be negative.')
  .max(1_000_000, 'Stock cannot exceed 1,000,000.')
  .default(0);

export const createCategorySchema = z.object({
  name: nameSchema,
  expectedAttributes: expectedAttributesSchema,
});

export const updateCategorySchema = createCategorySchema;

export const createProductSchema = z.object({
  name: nameSchema,
  price: priceSchema,
  categoryId: z.string().uuid('Category ID must be a valid UUID.'),
  stock: stockSchema,
  attributes: attributesSchema,
});

export const updateProductSchema = createProductSchema;
