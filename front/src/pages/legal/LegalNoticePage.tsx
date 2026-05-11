import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const LegalNoticePage: React.FC = () => {
  return (
    <LegalPageLayout
      eyebrow="Informations légales"
      title="Mentions légales"
      subtitle="BetLeague est un service de communication au public en ligne édité à titre non professionnel, conformément à l'article 6 III 2° de la loi pour la confiance dans l'économie numérique."
      updatedAt="11 mai 2026"
    >
      <section className="legal-section legal-section--highlight">
        <h2>Éditeur</h2>
        <p>
          Service de communication au public en ligne édité à titre non professionnel.
        </p>
        <p>
          Conformément à l'article 6 III 2° de la loi n° 2004-575 du 21 juin 2004 pour la confiance
          dans l'économie numérique, l'éditeur a choisi de préserver son anonymat. Son identité a
          été communiquée à l'hébergeur conformément aux dispositions légales applicables.
        </p>
      </section>

      <section className="legal-section">
        <h2>Contact</h2>
        <p>
          Pour toute question relative au service, à son fonctionnement ou à la présente publication,
          un email peut être adressé à :{' '}
          <a href="mailto:contact@betleague.app">contact@betleague.app</a>.
        </p>
      </section>

      <section className="legal-section">
        <h2>Hébergeur</h2>
        <p>
          OVH SAS — 2 rue Kellermann, 59100 Roubaix — France — +33 9 72 10 10 07
        </p>
      </section>

      <section className="legal-section">
        <h2>Directeur de publication</h2>
        <p>L'éditeur du service.</p>
      </section>

      <section className="legal-section legal-section--notice">
        <h2>Statut du service</h2>
        <p>
          BetLeague est une application de divertissement social 100 % gratuite. Les BTL sont des
          points fictifs sans valeur monétaire, non transférables, non retirables et non
          convertibles. Aucun gain en argent ni bien matériel n'est attribué dans le cadre de
          l'application.
        </p>
      </section>
    </LegalPageLayout>
  );
};

export default LegalNoticePage;
