import React, { useCallback, useMemo, useState, useEffect } from 'react';
import './CreateTicketModal.css';
import { createTicket, TicketCreateResponse } from '../../services/ticketsApi';
import type { MatchChoiceData, TicketCreatePayload } from '../../services/ticketsApi';
import { getParticipatedLeagues, getLeagueBalance, LeagueSummaryApi } from '../../services/leaguesApi';
import { useCurrentLeague } from '../../store/leagueStore';
import { useNavigate } from 'react-router-dom';

export type BetType = 'home' | 'draw' | 'away';

export interface BetItem {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  betType: BetType;
  odd: number;
  competition: string;
}

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  bets: BetItem[];
  onCreated: () => void;
}

const CreateTicketModal: React.FC<CreateTicketModalProps> = ({ isOpen, onClose, bets, onCreated }) => {
  const navigate = useNavigate();
  const currentLeague = useCurrentLeague();
  const [leagues, setLeagues] = useState<LeagueSummaryApi[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(currentLeague?.id ?? null);
  const [balance, setBalance] = useState<number | null>(null);

  const [stake, setStake] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ ticketId: number; message: string } | null>(null);

  // Charger les ligues participées à l'ouverture
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isOpen) return;
      try {
        setError(null);
        const list = await getParticipatedLeagues();
        if (!mounted) return;
        setLeagues(list);
        // Pré-sélectionner la ligue courante si présente, sinon la première
        const preferred = currentLeague?.id && list.some(l => l.id === currentLeague.id)
          ? currentLeague.id
          : (list[0]?.id ?? null);
        setSelectedLeagueId(preferred ?? null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Impossible de charger les ligues.');
        setLeagues([]);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, currentLeague?.id]);

  // Charger le solde BTL lorsqu'on a une ligue sélectionnée
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isOpen || !selectedLeagueId) { setBalance(null); return; }
      try {
        const btl = await getLeagueBalance(selectedLeagueId);
        if (!mounted) return;
        setBalance(btl);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Impossible de charger le solde BTL.');
        setBalance(null);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, selectedLeagueId]);

  const totalOdds = useMemo(() => {
    if (!bets || bets.length === 0) return 0;
    return Number(bets.reduce((acc, b) => acc * b.odd, 1).toFixed(2));
  }, [bets]);

  const stakeNumber = useMemo(() => Number(stake || '0'), [stake]);

  const potentialWin = useMemo(() => {
    if (!stakeNumber || !isFinite(stakeNumber)) return 0;
    return Number((stakeNumber * totalOdds).toFixed(2));
  }, [stakeNumber, totalOdds]);

  const isValidStake = useMemo(() => {
    if (!Number.isFinite(stakeNumber)) return false;
    if (!Number.isInteger(stakeNumber)) return false;
    if (stakeNumber <= 0) return false;
    if (balance != null && stakeNumber > balance) return false;
    return true;
  }, [stakeNumber, balance]);

  const canSubmit = useMemo(() => {
    return isOpen && !isSubmitting && error == null && isValidStake && !!selectedLeagueId && bets.length > 0;
  }, [isOpen, isSubmitting, error, isValidStake, selectedLeagueId, bets]);

  const formatBetType = (b: BetType): MatchChoiceData['choice'] => (b === 'home' ? '1' : b === 'draw' ? 'N' : '2');

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !selectedLeagueId) return;
    try {
      setIsSubmitting(true);
      setError(null);

      const match_choices: MatchChoiceData[] = bets.map(b => ({ match_id: b.matchId, choice: formatBetType(b.betType) }));
      const payload: TicketCreatePayload = {
        match_choices,
        mise: stakeNumber,
        gain: null,
      };

      const res: TicketCreateResponse = await createTicket(selectedLeagueId, payload);
      const createdId = res.ticket_id ?? 0;
      setSuccess({ ticketId: createdId, message: res.message || 'Ticket créé' });
      onCreated();
    } catch (e: any) {
      const msg = e?.message || 'Erreur lors de la création du ticket';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, selectedLeagueId, bets, stakeNumber, onCreated]);

  const onCloseModal = useCallback(() => {
    setSuccess(null);
    setStake('');
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onCloseModal} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{success ? 'Ticket créé' : 'Créer un ticket'}</h3>
          <button className="icon-btn" onClick={onCloseModal} aria-label="Fermer">×</button>
        </div>

        {success ? (
          <div className="success-block">
            <div className="success-msg">{success.message}</div>
            <div className="ticket-id">Ticket #{success.ticketId}</div>
            <div className="success-summary">
              <div className="row"><span>Paris:</span><strong>{bets.length}</strong></div>
              <div className="row"><span>Cote totale:</span><strong>{totalOdds}</strong></div>
              <div className="row"><span>Mise:</span><strong>{stakeNumber} BTL</strong></div>
              <div className="row"><span>Gain potentiel:</span><strong>{potentialWin} BTL</strong></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => navigate('/tickets')}>Voir le ticket</button>
            </div>
          </div>
        ) : (
          <>
            {/* Sélection de la ligue */}
            <div className="league-select">
              <label htmlFor="league">Ligue</label>
              <select
                id="league"
                className="league-dropdown"
                value={selectedLeagueId ?? ''}
                onChange={(e) => setSelectedLeagueId(e.target.value ? Number(e.target.value) : null)}
              >
                {leagues.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              {(!leagues || leagues.length === 0) && (
                <div className="inline-warning" role="alert">
                  Vous ne participez à aucune ligue. Rejoignez une ligue pour créer un ticket.
                </div>
              )}
            </div>

            {/* Solde BTL */}
            <div className="balance-row">
              <span>Solde disponible</span>
              <strong>{balance != null ? `${balance} BTL` : '-'}</strong>
            </div>

            {/* Récap paris */}
            <div className="ticket-summary">
              <div className="bets-list">
                {bets.map((b) => (
                  <div key={`${b.matchId}-${b.betType}`} className="bet-row">
                    <div className="teams">{b.homeTeam} vs {b.awayTeam}</div>
                    <div className="pick">{formatBetType(b.betType)} @ {b.odd}</div>
                  </div>
                ))}
              </div>

              <div className="stake-form">
                <label htmlFor="stake" className="stake-label">Mise</label>
                <div className="stake-input-wrap">
                  <input
                    id="stake"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="stake-input"
                    placeholder="Ex: 10"
                    value={stake}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, '');
                      setStake(v);
                    }}
                  />
                  <span className="currency">BTL</span>
                </div>
                {balance != null && stakeNumber > balance && (
                  <div className="inline-warning" role="alert">
                    Mise supérieure au solde disponible.
                  </div>
                )}
                <div className="calc-row">
                  <span>Cote totale</span>
                  <strong>{totalOdds || '-'}</strong>
                </div>
                <div className="calc-row primary">
                  <span>Gain potentiel</span>
                  <strong>{potentialWin || '-'}</strong>
                </div>
              </div>
            </div>

            {error && (
              <div className="error-banner" role="alert">{error}</div>
            )}

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={onCloseModal} disabled={isSubmitting}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
                {isSubmitting ? 'Création…' : 'Créer le ticket'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateTicketModal;
