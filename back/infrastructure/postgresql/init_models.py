from infrastructure.postgresql.user.db_user import DBUser  # noqa: F401
from infrastructure.postgresql.league.db_league import DBLeague  # noqa: F401
from infrastructure.postgresql.league.db_league_players import DBLeaguePlayers  # noqa: F401
from infrastructure.postgresql.invitation.db_invitation import DBInvitation  # noqa: F401
from infrastructure.postgresql.match.db_match import DBMatch  # noqa: F401
from infrastructure.postgresql.ticket.db_ticket import DBTicket  # noqa: F401
from infrastructure.postgresql.ticket.db_match_choices import DBMatchChoices  # noqa: F401
from infrastructure.postgresql.purchase.db_pack import DBPack  # noqa: F401
from infrastructure.postgresql.purchase.db_purchase import DBPurchase  # noqa: F401

from infrastructure.postgresql.tournament.db_tournament import DBTournament  # noqa: F401
from infrastructure.postgresql.tournament.db_tournament_stage import DBTournamentStage  # noqa: F401
from infrastructure.postgresql.tournament.db_tournament_player import DBTournamentPlayer  # noqa: F401
from infrastructure.postgresql.tournament.db_tournament_match import DBTournamentMatch  # noqa: F401
from infrastructure.postgresql.tournament_subscription.db_tournament_subscription import DBTournamentSubscription  # noqa: F401
from infrastructure.postgresql.notification.db_notification import DBNotification  # noqa: F401
from infrastructure.postgresql.outbox.db_outbox_message import DBOutboxMessage  # noqa: F401


def init_models() -> None:
    return
