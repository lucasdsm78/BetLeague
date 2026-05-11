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
          l’architecture, les composants et les contenus propres à BetLeague sont protégés par le
          Code de la propriété intellectuelle et par le droit d’auteur. Ils demeurent la propriété
          exclusive de l’éditeur.
        </p>
        <p>
          L’Utilisateur dispose d’un droit d’usage personnel et non commercial des contenus mis à
          disposition, à des fins strictement individuelles et privées. À ce titre, il peut
          consulter le service, partager son propre parcours (classement personnel, captures
          d’écran de ses pronostics ou résultats) à titre privé ou sur les réseaux sociaux,
          uniquement à des fins non lucratives.
        </p>
        <p>
          Toute autre utilisation, notamment la reproduction, l’adaptation, l’extraction, la
          rediffusion ou l’exploitation commerciale, publicitaire ou de masse, est interdite sans
          accord exprès et préalable de l’éditeur. Toute infraction engage la responsabilité de
          l’Utilisateur.
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
          autorisées par la loi applicable, l’éditeur ne pourra être tenu responsable des dommages
          indirects, pertes de données, pertes d’usage ou conséquences liées à une indisponibilité
          temporaire du service.
        </p>
        <p>
          L’éditeur ne saurait être tenu pour responsable en cas de <strong>force majeure</strong>{' '}
          ou du fait imprévisible et insurmontable d’un tiers, notamment toute panne du réseau
          internet public, des opérateurs de télécommunication, des plateformes d’hébergement ou
          des fournisseurs de données sportives.
        </p>
        <p>
          L’éditeur décline toute responsabilité concernant les éventuels{' '}
          <strong>virus, logiciels malveillants ou dysfonctionnements</strong> pouvant affecter le
          matériel informatique ou mobile de l’Utilisateur à l’occasion de l’utilisation du service,
          étant précisé que l’Utilisateur est tenu de maintenir son équipement à jour et protégé.
        </p>
        <p>
          Les <strong>frais d’accès au service</strong> (équipement informatique ou mobile,
          abonnement internet, données mobiles, frais d’itinérance) restent à la charge exclusive
          de l’Utilisateur.
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

      <section className="legal-section">
        <h2>13. Cookies et traceurs</h2>
        <p>
          BetLeague peut utiliser des cookies et technologies similaires strictement nécessaires au
          fonctionnement du service, notamment pour assurer l’authentification, la sécurité des
          sessions, la mémorisation des préférences et la prévention des abus. Ces cookies sont
          exemptés de consentement préalable conformément aux recommandations de la CNIL.
        </p>
        <p>
          Si des cookies non strictement nécessaires (statistiques renforcées, mesure d’audience
          ou autres) venaient à être utilisés, un mécanisme de recueil du consentement préalable
          conforme aux exigences de la CNIL serait mis en place. L’utilisateur conserve la
          possibilité de configurer son navigateur pour refuser tout ou partie des cookies, étant
          précisé que cela peut affecter la disponibilité de certaines fonctionnalités.
        </p>
        <p>
          Les détails relatifs aux données collectées et à leur traitement figurent dans la{' '}
          <a href="/confidentialite">Politique de confidentialité</a>.
        </p>
      </section>

      <section className="legal-section">
        <h2>14. Liens hypertextes</h2>
        <p>
          Le service peut contenir des liens hypertextes pointant vers des sites ou services
          opérés par des tiers (par exemple, sites institutionnels, autorités compétentes,
          réseaux sociaux, prestataires techniques ou fournisseurs de données sportives).
        </p>
        <p>
          L’éditeur n’exerce aucun contrôle sur le contenu, la disponibilité, les pratiques ni les
          politiques de ces sites tiers. Le fait de cliquer sur un lien hypertexte fait sortir
          l’utilisateur du périmètre de BetLeague et l’éditeur ne peut être tenu responsable
          du contenu, des produits ou des services accessibles via ces liens, ni de tout dommage
          résultant directement ou indirectement de leur consultation.
        </p>
      </section>

      <section className="legal-section">
        <h2>15. Contenus publiés par l’utilisateur</h2>
        <p>
          Dans le cadre de son utilisation du service, l’utilisateur est susceptible de publier
          des contenus, notamment un pseudonyme, des noms de ligues, des invitations, des
          réactions ou tout autre élément rendu visible aux autres utilisateurs.
        </p>
        <ul>
          <li>
            L’utilisateur s’engage à publier des contenus respectueux des lois en vigueur et de
            la <strong>Netiquette</strong> : pas d’injures, pas de propos discriminatoires, pas
            d’incitation à la haine, à la violence ou à la fraude, pas de contenus à caractère
            sexuel, pas d’usurpation d’identité, pas de contenu contraire à l’ordre public.
          </li>
          <li>
            L’utilisateur garantit qu’il dispose des droits nécessaires sur les contenus qu’il
            publie et qu’ils ne portent pas atteinte aux droits de tiers (vie privée, droit à
            l’image, propriété intellectuelle, marque, etc.).
          </li>
          <li>
            L’utilisateur est seul responsable des contenus qu’il publie. Toute procédure
            engagée à l’encontre de l’éditeur du fait d’un contenu publié par un utilisateur
            sera prise en charge par ce dernier.
          </li>
        </ul>
        <p>
          En publiant un contenu sur le service, l’utilisateur concède à l’éditeur une{' '}
          <strong>licence non exclusive, gratuite, mondiale et pour la durée de protection
          légale des droits de propriété intellectuelle</strong> de reproduire, afficher,
          adapter techniquement et distribuer ce contenu, dans la stricte mesure nécessaire au
          fonctionnement du service (notamment pour rendre visibles les pseudos, classements
          et noms de ligues aux autres participants).
        </p>
        <p>
          L’éditeur se réserve le droit de modérer, refuser ou retirer à tout moment tout
          contenu qui contreviendrait aux présentes CGU ou à la loi, sans préavis ni
          justification, et de suspendre ou résilier le compte de l’utilisateur concerné.
        </p>
      </section>

      <section className="legal-section">
        <h2>16. Durée du contrat</h2>
        <p>
          Les présentes Conditions Générales d’Utilisation sont conclues pour une{' '}
          <strong>durée indéterminée</strong>. Le commencement de l’utilisation du service par
          l’utilisateur marque l’entrée en vigueur du contrat à son égard.
        </p>
        <p>
          L’utilisateur peut à tout moment mettre fin au contrat en demandant la suppression de
          son compte, conformément à la section consacrée à la suppression du compte. L’éditeur
          peut, de son côté, suspendre ou résilier le contrat en cas de manquement aux présentes
          CGU, conformément aux dispositions ci-dessus.
        </p>
      </section>

      <section className="legal-section legal-section--notice">
        <h2>17. Rappel essentiel</h2>
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

