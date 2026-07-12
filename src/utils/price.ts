export function normalizePrice(raw: string | number): string | null {
  const s = String(raw).trim().replace(',', '.');
  if (!/^\d{1,9}(\.\d+)?$/.test(s)) {
    return null;
  }

  const parts = s.split('.');
  const intPart = parts[0];
  const decPart = parts[1] || '';

  let cents: bigint;
  if (decPart.length <= 2) {
    const paddedDec = decPart.padEnd(2, '0');
    cents = BigInt(intPart + paddedDec);
  } else {
    const centsStr = intPart + decPart.slice(0, 2);
    cents = BigInt(centsStr);
    const thirdDec = decPart[2];
    if (thirdDec && thirdDec >= '5') {
      cents += 1n;
    }
  }

  const centsStr = cents.toString().padStart(3, '0');
  const normalized = centsStr.slice(0, -2) + '.' + centsStr.slice(-2);

  if (normalized === '0.00') {
    return null;
  }

  const finalIntPart = normalized.split('.')[0] || '';
  if (finalIntPart.length > 8) {
    return null;
  }

  return normalized;
}
