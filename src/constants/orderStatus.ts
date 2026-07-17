export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'PAID', 'SHIPPED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const EDITABLE_STATUSES: OrderStatus[] = ['PENDING'];
