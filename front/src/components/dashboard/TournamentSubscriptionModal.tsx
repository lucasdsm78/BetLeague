/**
 * Tournament Subscription Modal Component
 * Displays subscription options for tournament access
 */

import React, { useState, useCallback, memo, useEffect, useMemo } from 'react';
import './TournamentSubscriptionModal.css';
import { createSubscriptionIntent } from '../../services/api/subscription';
import {
  useCancelTournamentSubscriptionMutation,
  useTournamentSubscriptionPlansQuery,
} from '../../hooks/queries/useTournamentQueries';
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
  onCancellationComplete?: (message: string) => void;
  isSubscriber?: boolean;
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallbackMessage;
}

const TournamentSubscriptionModal: React.FC<TournamentSubscriptionModalProps> = memo(({
  onClose,
  onSubscriptionComplete,
  onCancellationComplete,
  isSubscriber = false,
}) => {
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>('yearly');
  const cancelSubscriptionMutation = useCancelTournamentSubscriptionMutation();
  const isManagingSubscription = isSubscriber;
  const isSubmitting = subscribing || cancelSubscriptionMutation.isPending;

  const plansQuery = useTournamentSubscriptionPlansQuery({ enabled: !isManagingSubscription });
  const queryErrorMessage = !isManagingSubscription && plansQuery.error
    ? getErrorMessage(plansQuery.error, "Erreur lors du chargement des formules d'abonnement")
    : null;
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

      const origin = typeof window !== 'undefined' && typeof window.location?.origin === 'string'
        ? window.location.origin
        : '';

      const requestPayload: { subscription_plan: SubscriptionPlanId; success_url?: string; cancel_url?: string } = {
        subscription_plan: selectedPlan.id,
      };

      if (origin.startsWith('http')) {
        requestPayload.success_url = `${origin}/shop?subscription=success`;
        requestPayload.cancel_url = `${origin}/shop?subscription=cancelled`;
      }

      const response = await createSubscriptionIntent(requestPayload);

      if (onSubscriptionComplete) {
        onSubscriptionComplete();
      }

      if (response.checkout_url) {
        window.location.assign(response.checkout_url);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erreur lors de la création de l'abonnement"));
      console.error('Subscription error:', err);
    } finally {
      setSubscribing(false);
    }
  }, [onSubscriptionComplete, selectedPlan]);

  const handleCancelSubscription = useCallback(async () => {
    try {
      setError(null);
      const response = await cancelSubscriptionMutation.mutateAsync();
      onCancellationComplete?.(response.message);
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erreur lors de l'annulation de l'abonnement"));
      console.error('Tournament subscription cancellation error:', err);
    }
  }, [cancelSubscriptionMutation, onCancellationComplete, onClose]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content tournament-subscription-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="subscription-icon">🏆</div>
          <h2>{isManagingSubscription ? 'Gérer l’abonnement tournoi' : 'Création tournoi illimitée'}</h2>
          <p className="subscription-subtitle">
            {isManagingSubscription
              ? 'Votre accès premium tournoi est actif. Vous pouvez le conserver ou l’annuler en un geste.'
              : 'Vous avez 2 créations gratuites par mois. Choisissez la formule la plus rentable pour organiser vos tournois sans limite.'}
          </p>
          <button
            className="modal-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {(error || queryErrorMessage) && (
            <div className="error-banner" role="alert">
              <span className="error-icon">🚨</span>
              <span className="error-text">{error ?? queryErrorMessage}</span>
            </div>
          )}

          {isManagingSubscription ? (
            <>
              <div className="subscription-intro-card subscription-intro-card-manage">
                <div className="intro-pill intro-pill-active">Abonnement actif</div>
                <p>
                  Votre accès illimité à la création de tournois est actif. Si vous annulez maintenant,
                  vous revenez immédiatement au quota gratuit mensuel standard.
                </p>
              </div>

              <div className="subscription-manage-card" aria-live="polite">
                <div className="subscription-manage-card-header">
                  <div>
                    <h3>Gérer mon abonnement tournoi</h3>
                    <p>Contrôle total, sans étape cachée.</p>
                  </div>
                  <span className="subscription-manage-status">Actif</span>
                </div>

                <ul className="subscription-manage-list">
                  <li>
                    <span className="feature-icon">✓</span>
                    <span className="feature-text">Aucun futur prélèvement ne sera déclenché après annulation.</span>
                  </li>
                  <li>
                    <span className="feature-icon">✓</span>
                    <span className="feature-text">Votre compte repasse sur 2 créations gratuites par mois.</span>
                  </li>
                  <li>
                    <span className="feature-icon">✓</span>
                    <span className="feature-text">L’action est sécurisée et confirmée côté serveur avant mise à jour de l’interface.</span>
                  </li>
                </ul>

                <div className="subscription-manage-warning">
                  <span className="warning-icon">⚠️</span>
                  <p>
                    Cette annulation est immédiate. Si votre quota gratuit mensuel est déjà consommé,
                    vous devrez reprendre un abonnement pour créer de nouveaux tournois.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {isManagingSubscription ? 'Retour' : 'Annuler'}
          </button>
          <button
            className={`btn ${isManagingSubscription ? 'btn-subscription-danger' : 'btn-primary btn-subscribe'}`}
            onClick={isManagingSubscription ? handleCancelSubscription : handleSubscribe}
            disabled={isManagingSubscription ? isSubmitting : isSubmitting || plansQuery.isLoading || !selectedPlan}
          >
            {isSubmitting ? (
              <>
                <span className="btn-spinner"></span>
                {isManagingSubscription ? 'Annulation…' : 'Redirection…'}
              </>
            ) : (
              <>
                <span className="subscribe-icon">{isManagingSubscription ? '⛔' : '🏆'}</span>
                {isManagingSubscription
                  ? 'Confirmer l’annulation'
                  : selectedPlan?.interval === 'year'
                    ? 'Choisir l’offre annuelle'
                    : 'Choisir l’offre mensuelle'}
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
