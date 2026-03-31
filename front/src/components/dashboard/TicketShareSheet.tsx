import React, { memo, useCallback, useMemo, useState } from 'react';

import './TicketDetailSection.css';
import { useGlobalToast } from '../../toast/ToastProvider';
import { shareWinningTicket, type ShareTicketChoiceInput, type TicketShareAction, type TicketShareNetwork, type TicketShareVariant } from '../../utils/ticketShare';

interface ShareableTicketData {
  uuid: string;
  gain: number;
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
    id: 'instagram-feed',
    label: 'Instagram',
    hint: 'Publier avec message prérempli',
    emoji: '📸',
    network: 'instagram',
    variant: 'feed',
  },
  {
    id: 'instagram-story',
    label: 'Story Instagram',
    hint: 'Partager le ticket visuel en story',
    emoji: '✨',
    network: 'instagram',
    variant: 'story',
  },
  {
    id: 'tiktok-feed',
    label: 'TikTok',
    hint: 'Partager avec légende prête',
    emoji: '🎵',
    network: 'tiktok',
    variant: 'feed',
  },
  {
    id: 'tiktok-story',
    label: 'Story TikTok',
    hint: 'Partager le ticket visuel en story',
    emoji: '🚀',
    network: 'tiktok',
    variant: 'story',
  },
  {
    id: 'copy-message',
    label: 'Copier le message',
    hint: 'Collez votre message où vous voulez',
    emoji: '📝',
    network: 'system',
    variant: 'feed',
    action: 'copy-message',
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
        leagueName: normalizedTicket.leagueName,
        choices: normalizedTicket.choices,
        network: option.network,
        variant: option.variant,
        action: option.action,
      });

      if (result.method === 'download') {
        showSuccess('Ticket téléchargé', 'L’image du ticket est prête pour votre story ou votre post.');
      } else if (option.action === 'copy-message') {
        showSuccess('Message copié', 'Le message prédéfini est prêt à être collé sur votre réseau social.');
      } else if (option.action === 'copy-link') {
        showSuccess('Lien copié', 'Le lien public du ticket a été copié.');
      } else if (result.method === 'native+clipboard') {
        showInfo('Partage ouvert', 'Le partage s’ouvre et le message a aussi été copié pour Instagram/TikTok si nécessaire.');
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
            <p>Sélectionnez un réseau. Sur Instagram et TikTok, le message est aussi copié pour être collé facilement si l’app ignore le texte.</p>
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
          <p>Story = image du ticket. Post = message + lien du ticket partagé.</p>
        </div>
      </div>
    </div>
  );
});

TicketShareSheet.displayName = 'TicketShareSheet';

export default TicketShareSheet;

