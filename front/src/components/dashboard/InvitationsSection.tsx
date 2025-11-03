import React, { memo, useCallback, useEffect, useState } from 'react';
import './LeaguesSection.css'; // Réutilise la même charte visuelle (onglets, cartes, empty-state)
import leagueApiService from '../../services/leagueApiService';

interface InvitationUI {
  id: number;
  leagueName: string;
  inviterName: string;
  inviteDate: string;
  members: number;
  maxMembers: number;
}

interface InvitationCardProps {
  invitation: InvitationUI;
  onAccept: (invitation: InvitationUI) => void;
  onDecline: (invitation: InvitationUI) => void;
}

const InvitationCard: React.FC<InvitationCardProps> = ({ invitation, onAccept, onDecline }) => (
  <div className="invitation-card">
    <div className="invitation-info">
      <h4 className="league-name">{invitation.leagueName}</h4>
      <p className="invitation-text">
        <strong>{invitation.inviterName}</strong> vous invite à rejoindre cette ligue
      </p>
      <div className="invitation-meta">
        <span>{invitation.members}/{invitation.maxMembers} participants</span>
        <span>•</span>
        <span>{new Date(invitation.inviteDate).toLocaleDateString('fr-FR')}</span>
      </div>
    </div>
    <div className="invitation-actions">
      <button className="btn btn-primary btn-sm" onClick={() => onAccept(invitation)}>
        Accepter
      </button>
      <button className="btn btn-outline btn-sm" onClick={() => onDecline(invitation)}>
        Refuser
      </button>
    </div>
  </div>
);

const InvitationsSection: React.FC = memo(() => {
  const [activeTab, setActiveTab] = useState<'received'>('received');
  const [invitations, setInvitations] = useState<InvitationUI[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const loadReceived = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await leagueApiService.getReceivedInvitations();
      if (result.success && result.data) {
        const mapped: InvitationUI[] = (result.data as any[]).map((inv: any) => ({
          id: Number(inv.id),
          leagueName: String(inv.league?.name || ''),
          inviterName: String(inv.league?.user_creator?.pseudo || 'Inconnu'),
          inviteDate: String(new Date(inv.league?.start_date || Date.now()).toISOString()),
          members: Number((inv.league?.max_players || 0) - (inv.league?.nb_players_remaining || 0)),
          maxMembers: Number(inv.league?.max_players || 0),
        }));
        setInvitations(mapped);
      } else {
        setInvitations([]);
      }
    } catch (e: any) {
      setError(e?.message || "Erreur lors du chargement des invitations");
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReceived();
  }, [loadReceived]);

  const handleAccept = useCallback(async (invitation: InvitationUI) => {
    try {
      const res = await leagueApiService.updateInvitation(invitation.id, true);
      if (res.success) {
        setSuccessMessage(res.message || 'Invitation acceptée');
        setTimeout(() => setSuccessMessage(''), 4000);
        loadReceived();
      } else {
        setError(res.error || "Erreur lors de l'acceptation de l'invitation");
      }
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'acceptation de l'invitation");
    }
  }, [loadReceived]);

  const handleDecline = useCallback(async (invitation: InvitationUI) => {
    try {
      const res = await leagueApiService.updateInvitation(invitation.id, false);
      if (res.success) {
        setSuccessMessage(res.message || 'Invitation refusée');
        setTimeout(() => setSuccessMessage(''), 3000);
        loadReceived();
      } else {
        setError(res.error || "Erreur lors du refus de l'invitation");
      }
    } catch (e: any) {
      setError(e?.message || "Erreur lors du refus de l'invitation");
    }
  }, [loadReceived]);

  return (
    <div className="leagues-section" data-section="invitations">
      {/* Messages */}
      {successMessage && (
        <div style={{
          background: 'var(--success-color)', color: 'white', padding: '0.75rem 1rem', marginBottom: '1rem',
          borderRadius: 'var(--border-radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>✅ {successMessage}</span>
          <button onClick={() => setSuccessMessage('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem' }}>×</button>
        </div>
      )}
      {error && (
        <div style={{
          background: 'var(--danger-color)', color: 'white', padding: '0.75rem 1rem', marginBottom: '1rem',
          borderRadius: 'var(--border-radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem' }}>×</button>
        </div>
      )}

      <div className="section-header">
        <h2>Mes Invitations</h2>
      </div>

      {/* Menu (onglets) */}
      <div className="leagues-tabs" role="tablist" aria-label="Menu des invitations">
        <button
          className={`tab-button ${activeTab === 'received' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'received'}
          onClick={() => setActiveTab('received')}
        >
          <span className="tab-content-wrapper">
            <span className="tab-title">Reçus</span>
            <span className="tab-badge">{invitations.length}</span>
          </span>
        </button>
      </div>

      {/* Contenu */}
      <div className="tab-content">
        {activeTab === 'received' && (
          <div className="invitations-list">
            {loading ? (
              <div className="empty-state">
                <span className="empty-icon">⏳</span>
                <h3>Chargement des invitations…</h3>
                <p>Merci de patienter</p>
              </div>
            ) : invitations.length > 0 ? (
              invitations.map(inv => (
                <InvitationCard key={inv.id} invitation={inv} onAccept={handleAccept} onDecline={handleDecline} />
              ))
            ) : (
              <div className="empty-state">
                <span className="empty-icon">📨</span>
                <h3>Aucune invitation reçue</h3>
                <p>Vos invitations apparaîtront ici</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

InvitationsSection.displayName = 'InvitationsSection';

export default InvitationsSection;

