import { useQuery } from '@tanstack/react-query';
import { getMyPurchases } from '../../services/api/purchases';
import type { ApiUserPurchase } from '../../types/api/purchases';
import { purchaseKeys } from './purchaseKeys';

export function useMyPurchasesQuery(options?: { enabled?: boolean }) {
  return useQuery<ApiUserPurchase[], Error>({
    queryKey: purchaseKeys.mine(),
    queryFn: () => getMyPurchases(),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60,
  });
}

