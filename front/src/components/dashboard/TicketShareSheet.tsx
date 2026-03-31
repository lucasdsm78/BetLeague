import React, { memo, useCallback, useMemo, useState } from 'react';

import './TicketDetailSection.css';
import { useGlobalToast } from '../../toast/ToastProvider';
import { shareWinningTicket, type ShareTicketChoiceInput, type TicketShareAction, type TicketShareNetwork, type TicketShareVariant } from '../../utils/ticketShare';

interface ShareableTicketData {
  uuid: string;
  gain: number;
  mise?: number;
  leagueName?: string | null;
  choices?: ShareTicketChoiceInput[];
}

interface TicketShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: ShareableTicketData | null;
}

interface ShareOption {
  id: string;
  label: string;
  hint: string;
  emoji: string;
  network: TicketShareNetwork;
  variant: TicketShareVariant;
  action?: TicketShareAction;
}

const SHARE_OPTIONS: ShareOption[] = [
  {
    id: 'instagram-story',
    label: 'Partager sur les réseaux sociaux',
    hint: 'Partager le ticket visuel sur vos réseaux',
    emoji: '✨',
    network: 'instagram',
    variant: 'story',
  },
  {
    id: 'copy-link',
    label: 'Copier le lien',
    hint: 'Lien public du ticket gagnant',
    emoji: '🔗',
    network: 'system',
    variant: 'feed',
    action: 'copy-link',
  },
  {
    id: 'download-image',
    label: 'Télécharger le ticket',
    hint: 'Image prête pour story ou post',
    emoji: '⬇️',
    network: 'system',
    variant: 'story',
    action: 'download-image',
  },
];

const TicketShareSheet: React.FC<TicketShareSheetProps> = memo(({ isOpen, onClose, ticket }) => {
  const [loadingOptionId, setLoadingOptionId] = useState<string | null>(null);
  const { showSuccess, showInfo, showError } = useGlobalToast();

  const normalizedTicket = useMemo<ShareableTicketData | null>(() => {
    if (!ticket) return null;
    return {
      uuid: ticket.uuid,
      gain: ticket.gain,
      mise: ticket.mise,
      leagueName: ticket.leagueName,
      choices: ticket.choices ?? [],
    };
  }, [ticket]);

  const handleSelect = useCallback(async (option: ShareOption) => {
    if (!normalizedTicket) return;
    setLoadingOptionId(option.id);

    try {
      const result = await shareWinningTicket({
        ticketUuid: normalizedTicket.uuid,
        gain: normalizedTicket.gain,
        mise: normalizedTicket.mise,
        leagueName: normalizedTicket.leagueName,
        choices: normalizedTicket.choices,
        network: option.network,
        variant: option.variant,
        action: option.action,
      });

      if (result.method === 'download') {
        showSuccess('Ticket téléchargé', 'L’image du ticket est prête pour votre story ou votre post.');
      } else if (option.action === 'copy-link') {
        showSuccess('Lien copié', 'Le lien public du ticket a été copié.');
      } else if (result.method === 'native+clipboard') {
        showInfo('Partage ouvert', 'Instagram s’ouvre et le texte du ticket a été copié si besoin pour votre story.');
      } else {
        showSuccess('Partage ouvert', 'Choisissez votre app puis validez le partage.');
      }

      onClose();
    } catch (e: any) {
      showError('Partage impossible', e?.message || 'Impossible de préparer ce partage pour le moment.');
    } finally {
      setLoadingOptionId(null);
    }
  }, [normalizedTicket, onClose, showError, showInfo, showSuccess]);

  if (!isOpen || !normalizedTicket) return null;

  return (
    <div className="share-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-share-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="share-sheet-handle" aria-hidden="true" />
        <div className="share-sheet-header">
          <div>
            <h3 id="ticket-share-sheet-title">Partager le ticket gagné</h3>
            <p>Partagez votre ticket en story Instagram, copiez le lien public ou téléchargez le visuel du ticket.</p>
          </div>
          <button type="button" className="share-sheet-close" onClick={onClose} aria-label="Fermer le partage">
            ×
          </button>
        </div>

        <div className="share-sheet-grid">
          {SHARE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="share-sheet-option"
              onClick={() => handleSelect(option)}
              disabled={loadingOptionId !== null}
            >
              <span className="share-sheet-option-icon" aria-hidden="true">{option.emoji}</span>
              <span className="share-sheet-option-label">{loadingOptionId === option.id ? 'Préparation…' : option.label}</span>
              <span className="share-sheet-option-hint">{option.hint}</span>
            </button>
          ))}
        </div>

        <div className="share-sheet-footer">
          <p>Story Instagram = image du ticket. Le lien public reste disponible si vous voulez le coller ailleurs.</p>
        </div>
      </div>
    </div>
  );
});

TicketShareSheet.displayName = 'TicketShareSheet';

export default TicketShareSheet;

