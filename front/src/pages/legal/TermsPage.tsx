import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const TermsPage: React.FC = () => {
  return (
    <LegalPageLayout
      eyebrow="Cadre d’utilisation"
      title="Conditions Générales d’Utilisation"
      subtitle="BetLeague est une application de divertissement social autour des pronostics sportifs. Les BTL sont des points fictifs, sans valeur monétaire, utilisés uniquement pour jouer pour le plaisir."
      updatedAt="11 mai 2026"
    >
      <section className="legal-section legal-section--highlight">
        <h2>1. Nature du service</h2>
        <p>
          BetLeague propose des ligues privées et des fonctionnalités de pronostics sportifs à des fins
          exclusivement récréatives. L’application est conçue comme un service de divertissement entre
          amis, sans mise d’argent réelle, sans gain financier et sans attribution de lot matériel.
        </p>
        <ul>
          <li>Les BTL sont des points fictifs.</li>
          <li>Les BTL n’ont aucune valeur monétaire.</li>
          <li>Les BTL ne peuvent pas être retirés, transférés, échangés ou convertis.</li>
          <li>Aucun gain réel, aucune somme d’argent et aucun bien matériel ne sont attribués.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>2. Gratuité et absence d’enjeu financier</h2>
        <p>
          BetLeague doit être utilisé comme un jeu gratuit de pronostics. Les classements, ligues,
          tournois, tickets et résultats internes à l’application n’emportent aucun droit à une
          rémunération, un remboursement, une créance, un avoir ni un prix.
        </p>
        <p>
          L’utilisateur reconnaît expressément que BetLeague n’est pas un service de jeux d’argent et
          que l’ensemble des interactions repose sur des mécanismes ludiques sans valeur patrimoniale.
        </p>
      </section>

      <section className="legal-section">
        <h2>3. Compte utilisateur et âge minimum</h2>
        <p>
          Pour accéder à certaines fonctionnalités, vous devez créer un compte et fournir des
          informations exactes, à jour et complètes. Vous êtes responsable de la confidentialité de vos
          identifiants et des actions réalisées depuis votre compte.
        </p>
        <ul>
          <li>
            L’inscription est réservée aux personnes âgées d’au moins <strong>15 ans</strong>, âge
            à partir duquel la loi française permet au mineur de consentir seul au traitement de ses
            données personnelles dans les services de la société de l’information.
          </li>
          <li>Vous devez conserver un mot de passe fort et personnel.</li>
          <li>Vous devez informer BetLeague de toute utilisation non autorisée de votre compte.</li>
          <li>BetLeague peut suspendre ou supprimer un compte en cas d’abus, fraude ou détournement.</li>
        </ul>
        <p>
          En créant votre compte, vous déclarez avoir au moins 15 ans. Tout compte créé en
          contravention de cette règle pourra être suspendu ou supprimé, à la demande de
          l’utilisateur, de son représentant légal ou à l’initiative du service.
        </p>
      </section>

      <section className="legal-section">
        <h2>4. Utilisation autorisée</h2>
        <p>Vous vous engagez à utiliser l’application de manière loyale, sécurisée et conforme à sa finalité.</p>
        <ul>
          <li>Ne pas tenter d’exploiter une faille, contourner une sécurité ou perturber le service.</li>
          <li>Ne pas usurper l’identité d’un tiers ni publier de contenu trompeur, insultant ou illicite.</li>
          <li>Ne pas automatiser abusivement l’usage de l’application via scripts, bots ou scraping.</li>
          <li>Ne pas présenter BetLeague comme une plateforme d’argent réel ou de gains matériels.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>5. Ligues, tickets et classements</h2>
        <p>
          Les ligues, tickets, matchs, cotes affichées, scores, classements et notifications sont fournis
          à titre ludique et informatif pour l’expérience utilisateur. Malgré le soin apporté au service,
          des retards, interruptions, écarts de données ou erreurs ponctuelles peuvent survenir.
        </p>
        <p>
          Les résultats internes à BetLeague servent uniquement au fonctionnement du jeu et ne créent
          aucun droit à indemnisation ou compensation.
        </p>
      </section>

      <section className="legal-section">
        <h2>6. Données sportives et disponibilité</h2>
        <p>
          Certaines données de matchs peuvent provenir de prestataires tiers. BetLeague ne garantit pas
          une disponibilité continue, ni l’absence totale d’erreurs, ni l’instantanéité absolue des
          mises à jour. L’application peut faire l’objet de maintenance, d’évolution ou d’interruption.
        </p>
      </section>

      <section className="legal-section">
        <h2>7. Propriété intellectuelle</h2>
        <p>
          Les éléments de l’application, notamment l’interface, le design, les textes, le logo,
          l’architecture, les composants et les contenus propres à BetLeague sont protégés. Sauf accord
          exprès, toute reproduction, adaptation, extraction ou réutilisation est interdite.
        </p>
      </section>

      <section className="legal-section">
        <h2>8. Sécurité et modération</h2>
        <p>
          Afin de protéger les utilisateurs et l’intégrité de la plateforme, BetLeague peut mettre en
          place des mécanismes de sécurité, de limitation, de journalisation technique et de modération.
          En cas de comportement suspect, le service peut restreindre certains accès ou suspendre un
          compte.
        </p>
      </section>

      <section className="legal-section">
        <h2>9. Responsabilité</h2>
        <p>
          BetLeague est fourni « tel quel » dans une logique de divertissement. Dans les limites
          autorisées par la loi applicable, BetLeague ne pourra être tenu responsable des dommages
          indirects, pertes de données, pertes d’usage ou conséquences liées à une indisponibilité
          temporaire du service.
        </p>
      </section>

      <section className="legal-section">
        <h2>10. Suppression du compte</h2>
        <p>
          Vous pouvez à tout moment demander la suppression de votre compte depuis l’application ou
          en écrivant à <a href="mailto:contact@betleague.app">contact@betleague.app</a>.
        </p>
        <ul>
          <li>
            Les données identifiantes liées au compte (pseudo, email, préférences, contenus de jeu)
            sont supprimées dans un délai raisonnable après la demande.
          </li>
          <li>
            Certaines traces techniques (journaux de sécurité, événements anti-abus) peuvent être
            conservées plus longtemps lorsque cela est strictement nécessaire à la sécurité du
            service ou à la défense de droits.
          </li>
          <li>
            La suppression du compte met fin à votre accès aux ligues, classements, tickets et BTL
            associés. Les BTL n’ayant aucune valeur monétaire ni patrimoniale, leur suppression
            n’ouvre droit à aucune indemnisation.
          </li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>11. Évolution des CGU</h2>
        <p>
          Les présentes conditions peuvent être mises à jour pour refléter les évolutions du service,
          des fonctionnalités, des règles de sécurité ou des obligations légales. La date de mise à
          jour affichée en haut de page fait foi. En cas de modification substantielle, les
          utilisateurs sont informés par un moyen approprié (notification dans l’application, message
          au moment de la connexion ou information équivalente). La poursuite de l’utilisation du
          service après une telle information vaut acceptation des nouvelles conditions.
        </p>
      </section>

      <section className="legal-section">
        <h2>12. Droit applicable et juridiction</h2>
        <p>
          Les présentes conditions sont régies par le droit français. En cas de litige, et après une
          tentative de résolution amiable, les tribunaux français sont compétents, sous réserve des
          dispositions impératives applicables au consommateur.
        </p>
      </section>

      <section className="legal-section legal-section--notice">
        <h2>13. Rappel essentiel</h2>
        <p>
          BetLeague est un environnement de jeu gratuit et fictif. Les BTL servent uniquement à jouer
          pour le plaisir. Ils ne constituent ni une monnaie, ni un actif, ni un droit à une valeur, ni
          une récompense monétaire ou matérielle.
        </p>
      </section>
    </LegalPageLayout>
  );
};

export default TermsPage;

