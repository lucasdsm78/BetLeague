/**
 * Tournament Subscription Modal Component
 * Displays subscription options for tournament access
 */

import React, { useState, useCallback, memo, useEffect, useMemo } from 'react';
import './TournamentSubscriptionModal.css';
import { createSubscriptionIntent } from '../../services/api/subscription';
import { useTournamentSubscriptionPlansQuery } from '../../hooks/queries/useTournamentQueries';
import {
  enrichSubscriptionPlans,
  getDefaultSubscriptionPlanId,
  getSubscriptionEquivalentMonthlyPrice,
  getSubscriptionIntervalLabel,
  getSubscriptionPlanById,
  getYearlyDiscountBadgeLabel,
} from '../../utils/subscriptionPlan';
import { formatPrice } from '../../utils/pricing';
import type {
  ApiSubscriptionPlan as SubscriptionPlan,
  ApiSubscriptionPlanId as SubscriptionPlanId,
} from '../../types/api/subscription';

interface TournamentSubscriptionModalProps {
  onClose: () => void;
  onSubscriptionComplete?: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Erreur lors de la création de l'abonnement";
}

const TournamentSubscriptionModal: React.FC<TournamentSubscriptionModalProps> = memo(({
  onClose,
  onSubscriptionComplete,
}) => {
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>('yearly');

  const plansQuery = useTournamentSubscriptionPlansQuery();
  const plans = useMemo(
    () => (plansQuery.data ? enrichSubscriptionPlans(plansQuery.data) : []),
    [plansQuery.data],
  );

  useEffect(() => {
    if (plans.length === 0) return;
    if (!plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(getDefaultSubscriptionPlanId(plans));
    }
  }, [plans, selectedPlanId]);

  const selectedPlan: SubscriptionPlan | undefined = useMemo(
    () => getSubscriptionPlanById(plans, selectedPlanId),
    [plans, selectedPlanId],
  );

  const handleSubscribe = useCallback(async () => {
    if (!selectedPlan) return;

    try {
      setSubscribing(true);
      setError(null);

      const response = await createSubscriptionIntent({
        subscription_plan: selectedPlan.id,
      });

      if (onSubscriptionComplete) {
        onSubscriptionComplete();
      }

      if (response.checkout_url) {
        window.location.assign(response.checkout_url);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      console.error('Subscription error:', err);
    } finally {
      setSubscribing(false);
    }
  }, [onSubscriptionComplete, selectedPlan]);

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
          <h2>Création tournoi illimitée</h2>
          <p className="subscription-subtitle">
            Vous avez 2 créations gratuites par mois. Choisissez la formule la plus rentable pour organiser vos tournois sans limite.
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
          {(error || plansQuery.error) && (
            <div className="error-banner" role="alert">
              <span className="error-icon">🚨</span>
              <span className="error-text">{error ?? getErrorMessage(plansQuery.error)}</span>
            </div>
          )}

          <div className="subscription-intro-card">
            <div className="intro-pill">2 créations gratuites / mois</div>
            <p>
              Ensuite, passez en illimité avec une facturation mensuelle flexible ou annuelle plus avantageuse.
            </p>
          </div>

          {plansQuery.isLoading ? (
            <div className="subscription-loading-state" aria-live="polite">
              <span className="btn-spinner subscription-spinner" />
              Chargement des formules…
            </div>
          ) : (
            <>
              <div className="subscription-plan-grid" role="list" aria-label="Choix de formule d'abonnement tournoi">
                {plans.map((plan) => {
                  const isSelected = plan.id === selectedPlanId;
                  const equivalentMonthly = getSubscriptionEquivalentMonthlyPrice(plan);
                  const savingsBadgeLabel = plan.interval === 'year' && plansQuery.data
                    ? getYearlyDiscountBadgeLabel(plansQuery.data.yearly_discount_percent)
                    : null;

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      className={`subscription-plan-option ${isSelected ? 'is-selected' : ''} ${plan.is_recommended ? 'is-recommended' : ''}`}
                      onClick={() => setSelectedPlanId(plan.id)}
                      aria-pressed={isSelected}
                    >
                      <div className="subscription-plan-option-top">
                        <div>
                          <div className="subscription-plan-option-name">{plan.name}</div>
                          <div className="subscription-plan-option-billing">{getSubscriptionIntervalLabel(plan)}</div>
                        </div>
                        {plan.is_recommended && (
                          <span className="subscription-plan-badge">{savingsBadgeLabel ?? 'Meilleure offre'}</span>
                        )}
                      </div>

                      <div className="subscription-plan-option-price">
                        <strong>{formatPrice(plan.price_cents)}€</strong>
                        <span>{getSubscriptionIntervalLabel(plan)}</span>
                      </div>

                      {equivalentMonthly && (
                        <div className="subscription-plan-equivalent">
                          Soit {formatPrice(equivalentMonthly)}€ / mois
                        </div>
                      )}

                      {savingsBadgeLabel && (
                        <div className="subscription-plan-savings">{savingsBadgeLabel}</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedPlan && (
                <div className="subscription-plan-card">
                  <div className="plan-header">
                    <div className="plan-header-copy">
                      <h3>{selectedPlan.name}</h3>
                      <p>
                        {selectedPlan.interval === 'year'
                          ? 'Le meilleur tarif pour les organisateurs réguliers.'
                          : 'Une formule flexible, sans engagement long terme.'}
                      </p>
                    </div>
                    <div className="plan-price">
                      <span className="price-amount">{formatPrice(selectedPlan.price_cents)}€</span>
                      <span className="price-interval">{getSubscriptionIntervalLabel(selectedPlan)}</span>
                    </div>
                  </div>

                  <div className="plan-features">
                    <h4>Fonctionnalités incluses :</h4>
                    <ul className="features-list">
                      {selectedPlan.features.map((feature: string, index: number) => (
                        <li key={index} className="feature-item">
                          <span className="feature-icon">✓</span>
                          <span className="feature-text">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="plan-details">
                    <div className="detail-item">
                      <span className="detail-icon">⚡</span>
                      <span className="detail-text">
                        Débloque immédiatement la création illimitée après vos 2 gratuits mensuels
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-icon">📱</span>
                      <span className="detail-text">
                        Parcours fluide et rapide sur mobile comme sur desktop
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-icon">🔒</span>
                      <span className="detail-text">
                        Paiement sécurisé via Stripe, prix validé côté serveur
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
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
            disabled={subscribing || plansQuery.isLoading || !selectedPlan}
          >
            {subscribing ? (
              <>
                <span className="btn-spinner"></span>
                Redirection…
              </>
            ) : (
              <>
                <span className="subscribe-icon">🏆</span>
                {selectedPlan?.interval === 'year' ? 'Choisir l’offre annuelle' : 'Choisir l’offre mensuelle'}
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
