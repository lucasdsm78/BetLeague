// utils/pricing.ts

export function formatPrice(priceCents: number): string {
  return (priceCents / 100).toFixed(2);
}

export function formatPriceLabel(priceCents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceCents / 100);
}

export function calculateBonusPercentage(nbBtl: number, bonus: number): number {
  if (nbBtl === 0) return 0;
  return Math.round((bonus / nbBtl) * 100);
}
