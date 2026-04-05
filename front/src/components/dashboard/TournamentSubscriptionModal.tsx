/**
 * Tournament Subscription Modal Component
 * Displays subscription options for tournament access
 */

import React, { useState, useCallback, memo, useEffect, useMemo } from 'react';
import './TournamentSubscriptionModal.css';
import { createSubscriptionIntent } from '../../services/api/subscription';
import {
  useCancelTournamentSubscriptionMutation,
  useCurrentTournamentSubscriptionQuery,
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

function formatSubscriptionDate(timestamp?: number | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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
  const currentSubscriptionQuery = useCurrentTournamentSubscriptionQuery({ enabled: isManagingSubscription });
  const queryErrorMessage = !isManagingSubscription && plansQuery.error
    ? getErrorMessage(plansQuery.error, "Erreur lors du chargement des formules d'abonnement")
    : isManagingSubscription && currentSubscriptionQuery.error
      ? getErrorMessage(currentSubscriptionQuery.error, "Erreur lors du chargement de votre abonnement tournoi")
      : null;
  const plans = useMemo(
    () => (plansQuery.data ? enrichSubscriptionPlans(plansQuery.data) : []),
    [plansQuery.data],
  );
  const currentSubscription = currentSubscriptionQuery.data;

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
                  la résiliation prendra effet à la fin de la période en cours.
                </p>
              </div>

              <div className="subscription-manage-card" aria-live="polite">
                <div className="subscription-manage-card-header">
                  <div>
                    <h3>Gérer mon abonnement tournoi</h3>
                    <p>Contrôle total, avec visibilité claire sur votre échéance et votre accès.</p>
                  </div>
                  <span className="subscription-manage-status">
                    {currentSubscription?.cancel_at_period_end ? 'Fin de période' : 'Actif'}
                  </span>
                </div>

                <ul className="subscription-manage-list">
                  <li>
                    <span className="feature-icon">✓</span>
                    <span className="feature-text">
                      {currentSubscription?.cancel_at_period_end
                        ? 'Votre résiliation est déjà planifiée : aucun renouvellement supplémentaire ne sera déclenché.'
                        : 'Aucun futur prélèvement ne sera déclenché après résiliation à la fin de période.'}
                    </span>
                  </li>
                  <li>
                    <span className="feature-icon">✓</span>
                    <span className="feature-text">
                      Votre compte repassera sur 2 créations gratuites par mois une fois la période active terminée.
                    </span>
                  </li>
                  <li>
                    <span className="feature-icon">✓</span>
                    <span className="feature-text">L’action est sécurisée et confirmée côté serveur avant mise à jour de l’interface.</span>
                  </li>
                </ul>

                {currentSubscriptionQuery.isLoading ? (
                  <div className="subscription-loading-state" aria-live="polite">
                    <span className="btn-spinner subscription-spinner" />
                    Chargement de votre abonnement…
                  </div>
                ) : currentSubscription ? (
                  <div className="subscription-manage-metadata" aria-label="Détails de l'abonnement tournoi actuel">
                    <div className="subscription-manage-metadata-item">
                      <span className="subscription-manage-metadata-label">Formule</span>
                      <strong>{currentSubscription.plan_name}</strong>
                      <span>{formatPrice(currentSubscription.price_cents)}€ / {currentSubscription.interval === 'year' ? 'an' : 'mois'}</span>
                    </div>
                    <div className="subscription-manage-metadata-item">
                      <span className="subscription-manage-metadata-label">Statut</span>
                      <strong>{currentSubscription.cancel_at_period_end ? 'Résiliation planifiée' : 'Actif'}</strong>
                      <span>{currentSubscription.has_tournament_access ? 'Accès tournoi maintenu' : 'Accès restreint'}</span>
                    </div>
                    <div className="subscription-manage-metadata-item">
                      <span className="subscription-manage-metadata-label">
                        {currentSubscription.cancel_at_period_end ? 'Fin d’accès' : 'Prochaine échéance'}
                      </span>
                      <strong>{formatSubscriptionDate(currentSubscription.current_period_end)}</strong>
                      <span>
                        {currentSubscription.cancel_at_period_end
                          ? 'Votre accès illimité reste actif jusqu’à cette date.'
                          : 'Renouvellement automatique à cette date si vous ne résiliez pas avant.'}
                      </span>
                    </div>
                    {currentSubscription.cancellation_requested_at && (
                      <div className="subscription-manage-metadata-item">
                        <span className="subscription-manage-metadata-label">Résiliation demandée le</span>
                        <strong>{formatSubscriptionDate(currentSubscription.cancellation_requested_at)}</strong>
                        <span>La demande est bien enregistrée côté serveur.</span>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="subscription-manage-warning">
                  <span className="warning-icon">⚠️</span>
                  <p>
                    {currentSubscription?.cancel_at_period_end
                      ? 'Votre accès premium reste actif jusqu’à la fin de la période en cours. Après cette date, si votre quota gratuit mensuel est déjà consommé, vous devrez reprendre un abonnement pour créer de nouveaux tournois.'
                      : 'La résiliation prendra effet à la fin de la période en cours. Si votre quota gratuit mensuel est déjà consommé à cette date, vous devrez reprendre un abonnement pour créer de nouveaux tournois.'}
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
            disabled={isManagingSubscription
              ? isSubmitting || currentSubscriptionQuery.isLoading || currentSubscription?.cancel_at_period_end === true
              : isSubmitting || plansQuery.isLoading || !selectedPlan}
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
                  ? currentSubscription?.cancel_at_period_end
                    ? 'Résiliation déjà planifiée'
                    : 'Planifier la résiliation'
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
