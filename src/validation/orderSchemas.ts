import { z } from 'zod';

export const emailSchema = z.string()
  .trim()
  .toLowerCase()
  .email('Invalid email address.')
  .max(254, 'Email must be at most 254 characters.');

export const customerNameSchema = z.string()
  .trim()
  .min(2, 'Name must be at least 2 characters long.')
  .max(120, 'Name must be at most 120 characters long.');

export const orderItemSchema = z.object({
  productId: z.string().uuid('Product ID must be a valid UUID.'),
  quantity: z.coerce.number()
    .int('Quantity must be an integer.')
    .positive('Quantity must be positive.')
    .max(1000, 'Quantity cannot exceed 1000 per item.'),
});

export const itemsSchema = z.array(orderItemSchema)
  .min(1, 'Order must contain at least one item.')
  .max(100, 'Order cannot exceed 100 items.');

export const createOrderSchema = z.object({
  customerName: customerNameSchema,
  customerEmail: emailSchema,
  items: itemsSchema,
});

export const checkoutSchema = createOrderSchema;
