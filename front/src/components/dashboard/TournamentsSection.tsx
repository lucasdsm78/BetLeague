/**
 * Tournaments Section Component
 * Displays tournaments for subscribed users
 */

import React, { memo } from 'react';
import './TournamentsSection.css';

const TournamentsSection: React.FC = memo(() => {
  return (
    <div className="tournaments-section">
      <div className="tournaments-header">
        <h2 className="tournaments-title">🏆 Tournois</h2>
        <p className="tournaments-subtitle">
          Participez aux tournois exclusifs et devenez champion !
        </p>
      </div>

      <div className="tournaments-coming-soon">
        <div className="coming-soon-icon">🚧</div>
        <h3>Bientôt disponible</h3>
        <p>
          Les tournois seront bientôt disponibles. Restez connecté pour être parmi
          les premiers à participer aux compétitions !
        </p>
      </div>
    </div>
  );
});

TournamentsSection.displayName = 'TournamentsSection';

export default TournamentsSection;
