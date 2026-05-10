import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/legal.css';

interface LegalLinksProps {
  readonly compact?: boolean;
  readonly className?: string;
  readonly showDisclaimer?: boolean;
}

const LegalLinks = memo<LegalLinksProps>(({ compact = false, className = '', showDisclaimer = true }) => {
  return (
    <div className={`legal-links ${compact ? 'legal-links--compact' : ''} ${className}`.trim()}>
      <div className="legal-links__row" aria-label="Liens légaux">
        <Link to="/cgu" className="legal-links__link">CGU</Link>
        <span className="legal-links__separator" aria-hidden="true">•</span>
        <Link to="/confidentialite" className="legal-links__link">Confidentialité</Link>
      </div>

      {showDisclaimer && (
        <p className="legal-links__disclaimer">
          BetLeague est une application de divertissement 100 % gratuite. Les BTL sont des points
          fictifs, sans valeur monétaire, non transférables, non retirables et non convertibles.
          Aucun gain en argent ni bien matériel n’est attribué.
        </p>
      )}
    </div>
  );
});

LegalLinks.displayName = 'LegalLinks';

export default LegalLinks;

