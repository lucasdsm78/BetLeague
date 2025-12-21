/**
 * Tournaments Section Component
 * Displays tournaments for subscribed users with creation capability
 */

import React, { useState, useCallback, memo } from 'react';
import CreateTournamentModal from './CreateTournamentModal';
import { useToast } from '../../hooks/useToast';
import './TournamentsSection.css';

const TournamentsSection: React.FC = memo(() => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { showInfo } = useToast();

  const handleOpenCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const handleTournamentCreated = useCallback(() => {
    showInfo('Tournoi créé', 'Votre tournoi a été créé avec succès !');
  }, [showInfo]);

  return (
    <div className="tournaments-section">
      <div className="tournaments-header">
        <div className="tournaments-header-content">
          <div className="tournaments-header-text">
            <h2 className="tournaments-title">🏆 Tournois</h2>
            <p className="tournaments-subtitle">
              Participez aux tournois exclusifs et devenez champion !
            </p>
          </div>
          <button
            className="btn-create-tournament-header"
            onClick={handleOpenCreateModal}
          >
            <span className="btn-icon">➕</span>
            Créer un tournoi
          </button>
        </div>
      </div>

      <div className="tournaments-content">
        {/* Tournament list will be displayed here */}
      </div>

      {/* Create Tournament Modal */}
      {isCreateModalOpen && (
        <CreateTournamentModal
          onClose={handleCloseCreateModal}
          onTournamentCreated={handleTournamentCreated}
        />
      )}
    </div>
  );
});

TournamentsSection.displayName = 'TournamentsSection';

export default TournamentsSection;
