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

export const customerTypeSchema = z.enum(['B2C', 'B2B']).default('B2C');

export const companyNameSchema = z.string()
  .trim()
  .min(2, 'Company name must be at least 2 characters long.')
  .max(200, 'Company name must be at most 200 characters long.')
  .optional();

export const cuiSchema = z.string()
  .trim()
  .min(2, 'CUI must be at least 2 characters long.')
  .max(20, 'CUI must be at most 20 characters long.')
  .optional();

export const regComSchema = z.string()
  .trim()
  .max(30, 'Registration Number must be at most 30 characters long.')
  .optional();

export const phoneSchema = z.string()
  .trim()
  .min(7, 'Phone number is too short.')
  .max(30, 'Phone number is too long.')
  .regex(/^[0-9+()\s-]+$/, 'Phone number contains invalid characters.');

export const deliveryAddressSchema = z.string()
  .trim()
  .min(5, 'Delivery address is too short.')
  .max(250, 'Delivery address is too long.');

const optionalPhone = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  phoneSchema.optional()
);

const optionalDeliveryAddress = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  deliveryAddressSchema.optional()
);

export const createOrderSchema = z.object({
  customerName: customerNameSchema,
  customerEmail: emailSchema,
  items: itemsSchema,
  customerType: customerTypeSchema,
  companyName: companyNameSchema,
  cui: cuiSchema,
  regCom: regComSchema,
  phone: phoneSchema,
  deliveryAddress: deliveryAddressSchema,
  paymentMethod: z.enum(['ramburs', 'card']),
}).superRefine((data, ctx) => {
  if (data.customerType === 'B2B') {
    if (!data.companyName || data.companyName.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Company name is required for B2B orders.',
        path: ['companyName'],
      });
    }
    if (!data.cui || data.cui.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CUI is required for B2B orders.',
        path: ['cui'],
      });
    }
  }
}).transform((data) => {
  if (data.customerType === 'B2C') {
    return {
      ...data,
      companyName: undefined,
      cui: undefined,
      regCom: undefined,
    };
  }
  return data;
});

export const editOrderSchema = z.object({
  customerName: customerNameSchema,
  customerEmail: emailSchema,
  items: itemsSchema,
  customerType: customerTypeSchema,
  companyName: companyNameSchema,
  cui: cuiSchema,
  regCom: regComSchema,
  phone: optionalPhone,
  deliveryAddress: optionalDeliveryAddress,
}).superRefine((data, ctx) => {
  if (data.customerType === 'B2B') {
    if (!data.companyName || data.companyName.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Company name is required for B2B orders.',
        path: ['companyName'],
      });
    }
    if (!data.cui || data.cui.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CUI is required for B2B orders.',
        path: ['cui'],
      });
    }
  }
}).transform((data) => {
  if (data.customerType === 'B2C') {
    return {
      ...data,
      companyName: undefined,
      cui: undefined,
      regCom: undefined,
    };
  }
  return data;
});

export const checkoutSchema = createOrderSchema;


