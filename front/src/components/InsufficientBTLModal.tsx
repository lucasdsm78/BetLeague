import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileMeQuery } from '../hooks/queries/useProfileQuery';
import './InsufficientBTLModal.css';

interface InsufficientBTLModalProps {
  currentBalance: number;
  requiredAmount: number;
  action: string;
  onClose: () => void;
}

/**
 * Modal contextuel affiché quand l'utilisateur n'a pas assez de BTL
 * Scénario de conversion optimal (Scénario 2)
 */
const InsufficientBTLModal: React.FC<InsufficientBTLModalProps> = ({
  currentBalance,
  requiredAmount,
  action,
  onClose
}) => {
  const navigate = useNavigate();
  const { data: profile } = useProfileMeQuery();
  const missingAmount = Math.max(0, requiredAmount - currentBalance);
  const isBTLPurchaseEnabled = profile?.commerce_availability?.btl_purchase_enabled !== false;

  const handleBuyBTL = useCallback(() => {
    if (!isBTLPurchaseEnabled) {
      return;
    }
    onClose();
    navigate('/shop');
  }, [isBTLPurchaseEnabled, navigate, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content insufficient-btl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header insufficient">
          <div className="icon-warning">⚠️</div>
          <h2>Solde BTL insuffisant</h2>
          <button
            className="modal-close"
            onClick={handleCancel}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="balance-info">
            <div className="balance-row">
              <span className="balance-label">Votre solde actuel</span>
              <span className="balance-value current">{currentBalance.toFixed(2)} BTL</span>
            </div>
            <div className="balance-row">
              <span className="balance-label">Montant requis pour {action}</span>
              <span className="balance-value required">{requiredAmount.toFixed(2)} BTL</span>
            </div>
            <div className="balance-row highlight">
              <span className="balance-label">Il vous manque</span>
              <span className="balance-value missing">{missingAmount.toFixed(2)} BTL</span>
            </div>
          </div>

          <div className="info-message">
            <div className="info-icon">ℹ️</div>
            <p>
              {isBTLPurchaseEnabled
                ? `Rechargez votre solde pour pouvoir ${action}. Vous serez redirigé vers la boutique pour sélectionner un pack BTL.`
                : `Vous n’avez pas assez de BTL pour ${action}, et l’achat de BTL est temporairement indisponible.`}
            </p>
          </div>

          <div className="cta-section">
            <div className="cta-icon">💳</div>
            <h3>{isBTLPurchaseEnabled ? 'Achetez des BTL maintenant' : 'Boutique BTL indisponible'}</h3>
            <p className="cta-description">
              {isBTLPurchaseEnabled
                ? 'Sélectionnez un pack et rechargez votre compte instantanément'
                : 'La recharge de votre solde sera de nouveau accessible dès la réouverture de la boutique'}
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleCancel}
          >
            Annuler
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleBuyBTL}
            disabled={!isBTLPurchaseEnabled}
          >
            <span className="btn-icon">🛒</span>
            {isBTLPurchaseEnabled ? 'Acheter des BTL' : 'Indisponible temporairement'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsufficientBTLModal;
