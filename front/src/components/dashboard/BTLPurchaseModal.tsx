import React, { useState, useEffect, useCallback, memo } from 'react';
import './BTLPurchaseModal.css';
import { getAllPacks, createPurchaseIntent, formatPrice, calculateBonusPercentage, Pack } from '../../services/packsApi';

interface BTLPurchaseModalProps {
  onClose: () => void;
  suggestedAmount?: number;
  onPurchaseComplete?: () => void;
}

const BTLPurchaseModal: React.FC<BTLPurchaseModalProps> = memo(({
  onClose,
  suggestedAmount,
  onPurchaseComplete
}) => {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPacks();
  }, []);

  const loadPacks = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedPacks = await getAllPacks();
      setPacks(fetchedPacks);

      // Auto-select pack based on suggested amount
      if (suggestedAmount && fetchedPacks.length > 0) {
        const suitable = fetchedPacks.find(p => p.total_btl >= suggestedAmount);
        if (suitable) {
          setSelectedPack(suitable);
        }
      }
    } catch (err) {
      setError('Impossible de charger les packs. Veuillez réessayer.');
      console.error('Error loading packs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = useCallback(async () => {
    if (!selectedPack) return;

    try {
      setPurchasing(true);
      setError(null);

      const response = await createPurchaseIntent(selectedPack.id);

      // Redirect to Stripe Checkout
      if (response.url) {
        window.location.href = response.url;
      } else if (response.session_id) {
        // Alternative: use Stripe.js
        console.log('Session ID:', response.session_id);
      }

      if (onPurchaseComplete) {
        onPurchaseComplete();
      }
    } catch (err) {
      setError('Erreur lors de la création du paiement. Veuillez réessayer.');
      console.error('Error creating purchase:', err);
    } finally {
      setPurchasing(false);
    }
  }, [selectedPack, onPurchaseComplete]);

  const handlePackSelect = useCallback((pack: Pack) => {
    setSelectedPack(pack);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (!purchasing) {
      onClose();
    }
  }, [purchasing, onClose]);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content btl-purchase-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Acheter des BTL</h2>
          {suggestedAmount && (
            <p className="suggestion-text">
              Recommandé: {suggestedAmount.toFixed(0)} BTL minimum
            </p>
          )}
          <button
            className="modal-close"
            onClick={handleClose}
            disabled={purchasing}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-banner" role="alert">
              <span className="error-icon">🚨</span>
              <span className="error-text">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="packs-loading">
              <div className="spinner"></div>
              <p>Chargement des packs...</p>
            </div>
          ) : packs.length === 0 ? (
            <div className="no-packs">
              <p>Aucun pack disponible pour le moment.</p>
            </div>
          ) : (
            <div className="packs-grid">
              {packs.map((pack) => {
                const bonusPercentage = calculateBonusPercentage(pack.nb_btl, pack.bonus);
                const isSelected = selectedPack?.id === pack.id;
                const isRecommended = suggestedAmount ? pack.total_btl >= suggestedAmount : false;

                return (
                  <div
                    key={pack.id}
                    className={`pack-card ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
                    onClick={() => handlePackSelect(pack)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handlePackSelect(pack);
                      }
                    }}
                  >
                    {isRecommended && (
                      <div className="recommended-badge">Recommandé</div>
                    )}

                    <div className="pack-header">
                      <h3>{pack.name}</h3>
                      {bonusPercentage > 0 && (
                        <span className="bonus-badge">+{bonusPercentage}% bonus</span>
                      )}
                    </div>

                    <div className="pack-btl">
                      <span className="btl-base">{pack.nb_btl.toFixed(0)}</span>
                      {pack.bonus > 0 && (
                        <span className="btl-bonus"> +{pack.bonus.toFixed(0)}</span>
                      )}
                      <span className="btl-label"> BTL</span>
                    </div>

                    <div className="pack-total">
                      Total: <strong>{pack.total_btl.toFixed(0)} BTL</strong>
                    </div>

                    <div className="pack-price">
                      <span className="price-value">{formatPrice(pack.price_cents)}€</span>
                      <span className="price-per">({pack.price_per_100.toFixed(2)}€/100 BTL)</span>
                    </div>

                    {pack.note && (
                      <div className="pack-note">{pack.note}</div>
                    )}

                    {isSelected && (
                      <div className="selected-indicator">
                        <span>✓</span> Sélectionné
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={purchasing}
          >
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handlePurchase}
            disabled={!selectedPack || purchasing || loading}
          >
            {purchasing ? (
              <>
                <span className="btn-spinner"></span>
                Traitement...
              </>
            ) : (
              `Acheter ${selectedPack ? formatPrice(selectedPack.price_cents) + '€' : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

BTLPurchaseModal.displayName = 'BTLPurchaseModal';

export default BTLPurchaseModal;
