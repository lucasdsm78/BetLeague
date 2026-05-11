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
        <h2>1. Responsable du traitement</h2>
        <p>
          Le traitement des données personnelles dans le cadre de BetLeague est mis en œuvre par
          l'éditeur du service, agissant à titre non professionnel au sens de l'article 6 III 2°
          de la loi pour la confiance dans l'économie numérique. L'identité de l'éditeur est
          connue de l'hébergeur conformément aux dispositions légales applicables.
        </p>
        <p>
          Pour toute question relative à la protection de vos données, vous pouvez écrire à :{' '}
          <a href="mailto:contact@betleague.app">contact@betleague.app</a>.
        </p>
      </section>

      <section className="legal-section legal-section--highlight">
        <h2>2. Ce que nous collectons</h2>
        <p>Selon votre utilisation du service, BetLeague peut traiter :</p>
        <ul>
          <li>des données de compte : pseudo, email, identifiants techniques liés à l’authentification ;</li>
          <li>des données d’usage : ligues créées, invitations, tickets, préférences et notifications ;</li>
          <li>des données techniques : journaux de sécurité, informations de session, traces d’erreurs ;</li>
          <li>des données nécessaires au bon fonctionnement mobile et web, comme les tokens de notification push si vous les activez.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>3. Finalités du traitement</h2>
        <p>Les données sont utilisées uniquement pour :</p>
        <ul>
          <li>créer et sécuriser votre compte ;</li>
          <li>faire fonctionner les ligues, tickets, classements et notifications ;</li>
          <li>améliorer la stabilité, les performances et la sécurité de l’application ;</li>
          <li>prévenir les abus, fraudes techniques et usages non autorisés.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>4. Pas de valeur financière</h2>
        <p>
          Les données liées aux BTL, classements et performances de jeu ne correspondent à aucun solde
          monétaire ni portefeuille. Elles servent uniquement à l’expérience ludique interne de
          BetLeague.
        </p>
      </section>

      <section className="legal-section">
        <h2>5. Bases légales du traitement</h2>
        <p>
          Les traitements reposent sur les bases légales suivantes, prévues par le règlement général
          sur la protection des données (RGPD) :
        </p>
        <ul>
          <li>
            <strong>Exécution des conditions d’utilisation</strong> pour les données nécessaires à la
            création du compte, au fonctionnement des ligues, tickets, classements et notifications ;
          </li>
          <li>
            <strong>Intérêt légitime</strong> pour la sécurité de la plateforme, la prévention des
            abus et la journalisation technique ;
          </li>
          <li>
            <strong>Consentement</strong> pour les fonctionnalités optionnelles comme les
            notifications push, que vous pouvez retirer à tout moment ;
          </li>
          <li>
            <strong>Obligation légale</strong> lorsque la conservation de certaines traces techniques
            est nécessaire à la défense ou à la prévention d’incidents.
          </li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>6. Destinataires</h2>
        <p>
          Les données ne sont accessibles qu’aux composants techniques nécessaires au fonctionnement de
          BetLeague et, le cas échéant, à des prestataires techniques strictement utiles à
          l’hébergement, à la sécurité, aux notifications ou aux données sportives.
        </p>
      </section>

      <section className="legal-section">
        <h2>7. Transferts hors Union européenne</h2>
        <p>
          Certains services techniques utilisés pour le bon fonctionnement de BetLeague (notamment les
          services de notifications push fournis par Apple ou Google) peuvent impliquer un transfert
          de données vers des pays situés hors de l’Union européenne. Ces transferts sont encadrés par
          les garanties prévues par le RGPD, en particulier les clauses contractuelles types adoptées
          par la Commission européenne.
        </p>
      </section>

      <section className="legal-section">
        <h2>8. Durée de conservation</h2>
        <p>
          Les données sont conservées pendant la durée nécessaire à la gestion du compte, à l’exécution
          des fonctionnalités et au respect des impératifs de sécurité.
        </p>
        <ul>
          <li>Données de compte : pendant toute la durée d’utilisation du compte.</li>
          <li>
            Après suppression d’un compte, les données identifiantes sont supprimées dans un délai
            raisonnable, sauf obligation légale de conservation.
          </li>
          <li>
            Journaux de sécurité et traces techniques : conservés jusqu’à douze mois lorsque cela est
            nécessaire pour la prévention des abus, l’audit et l’analyse d’incidents.
          </li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>9. Sécurité</h2>
        <p>
          BetLeague met en œuvre des mesures techniques et organisationnelles pour protéger les données :
          contrôle d’accès, journalisation, chiffrement en transit, gestion sécurisée des sessions,
          protection des secrets et réduction de l’exposition publique des services internes.
        </p>
      </section>

      <section className="legal-section legal-section--highlight">
        <h2>10. Vos droits</h2>
        <p>
          Conformément aux articles 15 à 22 du RGPD, vous disposez des droits suivants sur vos
          données personnelles :
        </p>
        <ul>
          <li><strong>Droit d’accès</strong> à vos données ;</li>
          <li><strong>Droit de rectification</strong> des données inexactes ou incomplètes ;</li>
          <li><strong>Droit à l’effacement</strong> de vos données (« droit à l’oubli ») ;</li>
          <li><strong>Droit à la limitation</strong> du traitement ;</li>
          <li><strong>Droit à la portabilité</strong> de vos données ;</li>
          <li><strong>Droit d’opposition</strong> au traitement de vos données ;</li>
          <li><strong>Droit de retirer votre consentement</strong> à tout moment, sans que cela remette en cause la licéité du traitement effectué avant ce retrait.</li>
        </ul>
        <p>
          Pour exercer ces droits, vous pouvez écrire à{' '}
          <a href="mailto:contact@betleague.app">contact@betleague.app</a>. Une réponse vous sera
          adressée dans le délai d’un mois, conformément au RGPD. Il pourra vous être demandé une
          information permettant de confirmer votre identité afin d’éviter toute usurpation.
        </p>
      </section>

      <section className="legal-section">
        <h2>11. Réclamation auprès de la CNIL</h2>
        <p>
          Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés, vous
          disposez du droit d’introduire une réclamation auprès de la Commission nationale de
          l’informatique et des libertés (CNIL) :{' '}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>.
        </p>
      </section>

      <section className="legal-section legal-section--highlight">
        <h2>12. Protection des mineurs</h2>
        <p>
          BetLeague est destiné à un public âgé d’au moins 15 ans, âge à partir duquel la loi
          française permet au mineur de consentir seul au traitement de ses données personnelles dans
          le cadre des services de la société de l’information.
        </p>
        <p>
          Les mineurs âgés de moins de 15 ans ne sont pas autorisés à créer un compte BetLeague. Si
          vous êtes parent ou représentant légal et constatez qu’un mineur de moins de 15 ans a créé
          un compte, vous pouvez écrire à{' '}
          <a href="mailto:contact@betleague.app">contact@betleague.app</a> pour demander sa
          suppression.
        </p>
        <p>
          BetLeague étant un service de divertissement gratuit fondé sur des points fictifs sans
          valeur monétaire, aucune transaction financière ni attribution de lot n’est proposée aux
          utilisateurs, qu’ils soient majeurs ou mineurs.
        </p>
      </section>

      <section className="legal-section">
        <h2>13. Vos choix</h2>
        <p>
          Vous pouvez à tout moment gérer certaines préférences depuis l’application, notamment les
          notifications lorsque cette fonctionnalité est disponible. Vous pouvez aussi demander la
          suppression de votre compte selon les modalités prévues par le service.
        </p>
      </section>

      <section className="legal-section legal-section--notice">
        <h2>14. Transparence</h2>
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

