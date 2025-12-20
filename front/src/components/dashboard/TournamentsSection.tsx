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
    </div>
  );
});

TournamentsSection.displayName = 'TournamentsSection';

export default TournamentsSection;
