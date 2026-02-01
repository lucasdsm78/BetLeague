// utils/pricing.ts

export function formatPrice(priceCents: number): string {
  return (priceCents / 100).toFixed(2);
}

export function calculateBonusPercentage(nbBtl: number, bonus: number): number {
  if (nbBtl === 0) return 0;
  return Math.round((bonus / nbBtl) * 100);
}

