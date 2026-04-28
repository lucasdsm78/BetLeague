interface FormatTicketAmountOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  withUnit?: boolean;
}

export function formatTicketAmount(
  amount: number | null | undefined,
  options: FormatTicketAmountOptions = {}
): string {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    withUnit = true,
  } = options;

  const safeAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;

  const formattedAmount = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(safeAmount);

  return withUnit ? `${formattedAmount} BTL` : formattedAmount;
}


