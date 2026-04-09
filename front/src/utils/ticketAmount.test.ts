import { formatTicketAmount } from './ticketAmount';

describe('formatTicketAmount', () => {
  it('formate un montant ticket en BTL avec deux décimales par défaut', () => {
    expect(formatTicketAmount(12.5)).toBe('12,50 BTL');
  });

  it('respecte les options de précision', () => {
    expect(formatTicketAmount(12, { minimumFractionDigits: 0, maximumFractionDigits: 2 })).toBe('12 BTL');
    expect(formatTicketAmount(8.345, { minimumFractionDigits: 1, maximumFractionDigits: 1 })).toBe('8,3 BTL');
    expect(formatTicketAmount(8.345, { minimumFractionDigits: 1, maximumFractionDigits: 1, withUnit: false })).toBe('8,3');
  });

  it('retombe sur 0 quand la valeur est absente ou invalide', () => {
    expect(formatTicketAmount(undefined)).toBe('0,00 BTL');
    expect(formatTicketAmount(Number.NaN)).toBe('0,00 BTL');
  });
});


