import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const PrivacyPage: React.FC = () => {
  return (
    <LegalPageLayout
      eyebrow="Protection des données"
      title="Politique de confidentialité"
      subtitle="Cette page explique quelles données peuvent être traitées par BetLeague, pourquoi elles le sont et comment elles sont protégées dans le cadre d’une application de divertissement social 100 % gratuit."
      updatedAt="11 mai 2026"
    >
      <section className="legal-section legal-section--highlight">
        <h2>1. Ce que nous collectons</h2>
        <p>Selon votre utilisation du service, BetLeague peut traiter :</p>
        <ul>
          <li>des données de compte : pseudo, email, identifiants techniques liés à l’authentification ;</li>
          <li>des données d’usage : ligues créées, invitations, tickets, préférences et notifications ;</li>
          <li>des données techniques : journaux de sécurité, informations de session, traces d’erreurs ;</li>
          <li>des données nécessaires au bon fonctionnement mobile et web, comme les tokens de notification push si vous les activez.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>2. Finalités du traitement</h2>
        <p>Les données sont utilisées uniquement pour :</p>
        <ul>
          <li>créer et sécuriser votre compte ;</li>
          <li>faire fonctionner les ligues, tickets, classements et notifications ;</li>
          <li>améliorer la stabilité, les performances et la sécurité de l’application ;</li>
          <li>prévenir les abus, fraudes techniques et usages non autorisés.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>3. Pas de valeur financière</h2>
        <p>
          Les données liées aux BTL, classements et performances de jeu ne correspondent à aucun solde
          monétaire ni portefeuille. Elles servent uniquement à l’expérience ludique interne de
          BetLeague.
        </p>
      </section>

      <section className="legal-section">
        <h2>4. Base d’utilisation</h2>
        <p>
          Le traitement des données est limité à ce qui est nécessaire au fonctionnement du service,
          à la sécurisation de la plateforme et à l’exécution des fonctionnalités demandées par
          l’utilisateur.
        </p>
      </section>

      <section className="legal-section">
        <h2>5. Destinataires</h2>
        <p>
          Les données ne sont accessibles qu’aux composants techniques nécessaires au fonctionnement de
          BetLeague et, le cas échéant, à des prestataires techniques strictement utiles à
          l’hébergement, à la sécurité, aux notifications ou aux données sportives.
        </p>
      </section>

      <section className="legal-section">
        <h2>6. Durée de conservation</h2>
        <p>
          Les données sont conservées pendant la durée nécessaire à la gestion du compte, à l’exécution
          des fonctionnalités et au respect des impératifs de sécurité. Certaines traces techniques
          peuvent être conservées plus longtemps lorsqu’elles sont utiles à l’audit, à la prévention des
          abus ou à l’analyse d’incidents.
        </p>
      </section>

      <section className="legal-section">
        <h2>7. Sécurité</h2>
        <p>
          BetLeague met en œuvre des mesures techniques et organisationnelles pour protéger les données :
          contrôle d’accès, journalisation, chiffrement en transit, gestion sécurisée des sessions,
          protection des secrets et réduction de l’exposition publique des services internes.
        </p>
      </section>

      <section className="legal-section">
        <h2>8. Vos choix</h2>
        <p>
          Vous pouvez à tout moment gérer certaines préférences depuis l’application, notamment les
          notifications lorsque cette fonctionnalité est disponible. Vous pouvez aussi demander la
          suppression de votre compte selon les modalités prévues par le service.
        </p>
      </section>

      <section className="legal-section legal-section--notice">
        <h2>9. Transparence</h2>
        <p>
          BetLeague cherche à maintenir une présentation claire : application gratuite, points fictifs,
          aucun gain réel, aucune conversion possible, aucune récompense matérielle. Cette transparence
          vaut aussi pour la manière dont les données liées à l’expérience de jeu sont traitées.
        </p>
      </section>
    </LegalPageLayout>
  );
};

export default PrivacyPage;

