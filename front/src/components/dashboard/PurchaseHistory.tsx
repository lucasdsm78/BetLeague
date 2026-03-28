import React, { memo } from 'react';
import './PurchaseHistory.css';

import { useMyPurchasesQuery } from '../../hooks/queries/usePurchaseQueries';
import { formatPriceLabel } from '../../utils/pricing';
import type { ApiPurchaseStatus, ApiUserPurchase } from '../../types/api/purchases';

interface PurchaseHistoryProps {
  enabled?: boolean;
}

const STATUS_LABELS: Record<ApiPurchaseStatus, string> = {
  PENDING: 'En cours',
  SUCCEEDED: 'Confirmé',
  FAILED: 'Échoué',
};

function formatPurchaseDate(timestamp?: number): string {
  if (!timestamp) return 'Date indisponible';
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusClassName(status: ApiPurchaseStatus): string {
  switch (status) {
    case 'SUCCEEDED':
      return 'purchase-status success';
    case 'FAILED':
      return 'purchase-status failed';
    default:
      return 'purchase-status pending';
  }
}

function PurchaseHistoryCard({ purchase }: { purchase: ApiUserPurchase }) {
  return (
    <article className="purchase-history-card">
      <div className="purchase-history-card-head">
        <div>
          <h4>{purchase.pack_name}</h4>
          <p>{formatPurchaseDate(purchase.created_at)}</p>
        </div>
        <span className={getStatusClassName(purchase.status)}>
          {STATUS_LABELS[purchase.status]}
        </span>
      </div>

      <div className="purchase-history-card-body">
        <div className="purchase-metric">
          <span className="metric-label">Montant</span>
          <strong>{formatPriceLabel(purchase.pack_price_cents)}€</strong>
        </div>
        <div className="purchase-metric">
          <span className="metric-label">BTL reçus</span>
          <strong>{purchase.pack_total_btl.toFixed(0)} BTL</strong>
        </div>
      </div>
    </article>
  );
}

const PurchaseHistory: React.FC<PurchaseHistoryProps> = memo(({ enabled = true }) => {
  const query = useMyPurchasesQuery({ enabled });

  return (
    <section className="purchase-history-section" aria-labelledby="purchase-history-title">
      <div className="purchase-history-header">
        <div>
          <h3 id="purchase-history-title">Mes achats BTL</h3>
          <p>Retrouve ici tes derniers achats confirmés, en cours ou échoués.</p>
        </div>
      </div>

      {query.isLoading ? (
        <div className="purchase-history-state">
          <div className="purchase-history-spinner" aria-hidden="true" />
          <p>Chargement de l’historique...</p>
        </div>
      ) : query.error ? (
        <div className="purchase-history-state error" role="alert">
          <p>{query.error.message || "Impossible de charger l'historique des achats."}</p>
        </div>
      ) : query.data && query.data.length > 0 ? (
        <div className="purchase-history-grid">
          {query.data.map((purchase) => (
            <PurchaseHistoryCard key={purchase.uuid} purchase={purchase} />
          ))}
        </div>
      ) : (
        <div className="purchase-history-state empty">
          <p>Tu n’as pas encore acheté de BTL.</p>
        </div>
      )}
    </section>
  );
});

PurchaseHistory.displayName = 'PurchaseHistory';

export default PurchaseHistory;

