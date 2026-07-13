export function getPublicBaseUrl(): string {
  const rawUrl = process.env.STOREFRONT_URL || process.env.FRONTEND_URL || 'http://localhost:8081';
  // Strip trailing slash if present
  return rawUrl.replace(/\/$/, '');
}
