/**
 * Tournament Subscription Modal Component
 * Displays subscription options for tournament access
 */

import React, { useState, useCallback, memo } from 'react';
import './TournamentSubscriptionModal.css';
import { createSubscriptionIntent } from '../../services/api/subscription';
import { getSubscriptionPlan } from '../../utils/subscriptionPlan';
import { formatPrice } from '../../utils/pricing';
import type { ApiSubscriptionPlan as SubscriptionPlan } from '../../types/api/subscription';

interface TournamentSubscriptionModalProps {
  onClose: () => void;
  onSubscriptionComplete?: () => void;
}

const TournamentSubscriptionModal: React.FC<TournamentSubscriptionModalProps> = memo(({
  onClose,
  onSubscriptionComplete
}) => {
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan: SubscriptionPlan = getSubscriptionPlan();

  const handleSubscribe = useCallback(async () => {
    try {
      setSubscribing(true);
      setError(null);

      const response = await createSubscriptionIntent({
        subscription_plan: 'monthly',
        success_url: `${window.location.origin}/shop?subscription=success`,
        cancel_url: `${window.location.origin}/shop?subscription=cancelled`
      });

      // Redirect to Stripe Checkout
      if (response.checkout_url) {
        window.location.href = response.checkout_url;
      }

      if (onSubscriptionComplete) {
        onSubscriptionComplete();
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de l\'abonnement');
      console.error('Subscription error:', err);
    } finally {
      setSubscribing(false);
    }
  }, [onSubscriptionComplete]);

  const handleClose = useCallback(() => {
    if (!subscribing) {
      onClose();
    }
  }, [subscribing, onClose]);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content tournament-subscription-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="subscription-icon">🏆</div>
          <h2>Abonnement tournois</h2>
          <p className="subscription-subtitle">
            Accédez aux tournois exclusifs et gagnez des récompenses
          </p>
          <button
            className="modal-close"
            onClick={handleClose}
            disabled={subscribing}
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

          <div className="subscription-plan-card">
            <div className="plan-header">
              <h3>{plan.name}</h3>
              <div className="plan-price">
                <span className="price-amount">{formatPrice(plan.price)}€</span>
                <span className="price-interval">/ mois</span>
              </div>
            </div>

            <div className="plan-features">
              <h4>Fonctionnalités incluses :</h4>
              <ul className="features-list">
                {plan.features.map((feature: string, index: number) => (
                  <li key={index} className="feature-item">
                    <span className="feature-icon">✓</span>
                    <span className="feature-text">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="plan-details">
              <div className="detail-item">
                <span className="detail-icon">🔄</span>
                <span className="detail-text">
                  Renouvelé automatiquement chaque mois
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">❌</span>
                <span className="detail-text">
                  Annulation possible à tout moment
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">🔒</span>
                <span className="detail-text">
                  Paiement sécurisé via Stripe
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={subscribing}
          >
            Annuler
          </button>
          <button
            className="btn btn-primary btn-subscribe"
            onClick={handleSubscribe}
            disabled={subscribing}
          >
            {subscribing ? (
              <>
                <span className="btn-spinner"></span>
                Traitement...
              </>
            ) : (
              <>
                <span className="subscribe-icon">🏆</span>
                S'abonner maintenant
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

TournamentSubscriptionModal.displayName = 'TournamentSubscriptionModal';

export default TournamentSubscriptionModal;
