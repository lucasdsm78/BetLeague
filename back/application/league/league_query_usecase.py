import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Optional

from pydantic import BaseModel

from application.logging_utils import hash_identifier
from application.league.league_query_model import LeagueReadModel, InvitationReceivedReadModel, LeaguesListResponse, \
    LeagueInvitationReceivedSummary, UserSummaryLeagueDetail, LeagueBalancesBulkResponse, InvitationsReceivedResponse, \
    TournamentInvitationReceivedSummary, LeagueInvitationsSentResponse, LeagueInvitationSentReadModel, \
    InvitationsSentResponse, InvitationSentReadModel
from application.user.user_query_model import UserSummaryReadModel
from domain.invitation.model.invitation_status import InvitationStatus
from domain.invitation.repository.invitation_repository import InvitationRepository
from domain.league.exception.league_exception import LeagueParticipantNotFoundError, LeagueNotFoundError, UserNotOwnerLeaguedError
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository


logger = logging.getLogger(__name__)


class LeagueQueryUseCase(ABC):

    @abstractmethod
    async def get_rank_by_league_id(self, email: str, league_id: int) -> List[Dict[str, any]]:
        raise NotImplementedError

    @abstractmethod
    async def get_league_by_id(self, league_id: int, email: str) -> Optional[LeagueReadModel]:
        raise NotImplementedError

    @abstractmethod
    async def get_leagues(self, email: str, page: int = 1, page_size: int = 10) -> LeaguesListResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_created_leagues(self, email: str, page: int = 1, page_size: int = 10) -> LeaguesListResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_participated_leagues(self, email: str, page: int = 1, page_size: int = 10) -> LeaguesListResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_invitations(self, email: str, is_received: bool, status=None, page: int = 1, page_size: int = 20):
        raise NotImplementedError

    @abstractmethod
    async def get_invitation_counts(self, email: str, is_received: bool) -> dict:
        raise NotImplementedError

    @abstractmethod
    async def get_leagues_balances(self, email: str, league_ids: List[int]) -> LeagueBalancesBulkResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_my_leagues(self, email: str, page: int = 1, page_size: int = 10) -> LeaguesListResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_league_invitations(self, league_id: int, email: str) -> LeagueInvitationsSentResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_sent_invitations(
            self,
            email: str,
            status: InvitationStatus | None = None,
            page: int = 1,
            page_size: int = 20,
    ) -> InvitationsSentResponse:
        raise NotImplementedError


class LeagueQueryUseCaseImpl(LeagueQueryUseCase, BaseModel):
    league_players_repository: LeaguePlayersRepository
    user_repository: UserRepository
    league_repository: LeagueRepository
    invitation_repository: InvitationRepository

    class Config:
        arbitrary_types_allowed = True

    @staticmethod
    def _extract_email_value(raw_email) -> str:
        return raw_email.value if hasattr(raw_email, 'value') else str(raw_email)

    @staticmethod
    def _extract_current_players_count(league) -> Optional[int]:
        if league is None:
            return None

        current_players = getattr(league, 'current_players', None)
        if current_players is not None:
            return max(int(current_players), 0)

        current_players_count = getattr(league, 'current_players_count', None)
        if current_players_count is not None:
            return max(int(current_players_count), 0)

        max_players = getattr(league, 'max_players', None)
        nb_players_remaining = getattr(league, 'nb_players_remaining', None)
        if max_players is not None and nb_players_remaining is not None:
            return max(int(max_players) - int(nb_players_remaining), 0)

        return None

    @staticmethod
    def _extract_min_players(league) -> Optional[int]:
        min_players = getattr(league, 'min_players', None)
        if min_players is None:
            return None
        return int(min_players)

    async def _hydrate_current_players_count(self, league) -> None:
        if league is None or getattr(league, 'id', None) is None:
            return
        count_one = getattr(self.league_players_repository, 'count_players', None)
        if not callable(count_one):
            return
        league.current_players_count = await count_one(int(league.id))

    async def _hydrate_current_players_count_for_many(self, leagues: List) -> List:
        if not leagues:
            return leagues

        leagues_by_id = {
            int(league.id): league
            for league in leagues
            if league is not None and getattr(league, 'id', None) is not None
        }
        if not leagues_by_id:
            return leagues

        count_many = getattr(self.league_players_repository, 'count_players_by_league_ids', None)
        if callable(count_many):
            counts_by_league_id = await count_many(list(leagues_by_id.keys()))
            for league_id, league in leagues_by_id.items():
                league.current_players_count = int(counts_by_league_id.get(league_id, 0))
            return leagues

        for league in leagues_by_id.values():
            await self._hydrate_current_players_count(league)
        return leagues

    async def get_rank_by_league_id(
            self,
            email: str,
            league_id: int
    ) -> List[Dict[str, any]]:
        user = await self.user_repository.find_by_email(email)
        if not user:
            logger.warning("league.query.rank_rejected", extra={"league_id": league_id, "email_hash": hash_identifier(email), "reason": "user_missing"})
            raise UserNotFoundError

        participated = await self.league_players_repository.find_participation(
            league_id=league_id,
            user_id=user.id
        )
        if not participated:
            logger.warning("league.query.rank_rejected", extra={"league_id": league_id, "user_id": user.id, "reason": "not_participant"})
            raise LeagueParticipantNotFoundError

        ranking = await self.league_players_repository.get_league_rank(league_id=league_id)
        logger.info("league.query.rank_loaded", extra={"league_id": league_id, "user_id": user.id, "users_count": len(ranking)})
        return ranking

    async def get_league_by_id(
            self,
            league_id: int,
            email: str
    ) -> Optional[LeagueReadModel]:
        user = await self.user_repository.find_by_email(email)
        if not user:
            logger.warning("league.query.by_id_rejected", extra={"league_id": league_id, "email_hash": hash_identifier(email), "reason": "user_missing"})
            raise UserNotFoundError

        league = await self.league_repository.find_by_id(league_id)
        if not league:
            logger.warning("league.query.by_id_rejected", extra={"league_id": league_id, "user_id": user.id, "reason": "league_missing"})
            raise LeagueNotFoundError

        if league.is_private:
            participated = await self.league_players_repository.find_participation(
                league_id=league_id,
                user_id=user.id
            )
            if not participated:
                logger.warning("league.query.by_id_rejected", extra={"league_id": league_id, "user_id": user.id, "reason": "private_forbidden"})
                raise LeagueParticipantNotFoundError

        await self._hydrate_current_players_count(league)

        logger.info("league.query.by_id_loaded", extra={"league_id": league_id, "user_id": user.id, "is_private": league.is_private})
        return LeagueReadModel.from_entity_get_by_id(league)


    async def get_leagues(self, email: str, page: int = 1, page_size: int = 10) -> LeaguesListResponse:
        user = await self.user_repository.find_by_email(email)
        if not user:
            logger.warning("league.query.list_rejected", extra={"email_hash": hash_identifier(email), "reason": "user_missing"})
            raise UserNotFoundError

        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 1
        if page_size > 50:
            page_size = 50

        total = await self.league_repository.count_leagues(user_id=user.id)
        total_pages = (total + page_size - 1) // page_size if page_size else 1
        if page > max(total_pages, 1):
            page = max(total_pages, 1)

        leagues = await self.league_repository.find_leagues(user_id=user.id, page=page, limit=page_size)
        await self._hydrate_current_players_count_for_many(leagues)

        logger.info("league.query.list_loaded", extra={"user_id": user.id, "page": page, "page_size": page_size, "total": total, "results_count": len(leagues)})

        return LeaguesListResponse(
            leagues=[LeagueReadModel.from_entity_get_all(league=l) for l in leagues],
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        )

    async def get_created_leagues(self, email: str, page: int = 1, page_size: int = 10) -> LeaguesListResponse:
        user = await self.user_repository.find_by_email(email)
        if not user:
            logger.warning("league.query.created_rejected", extra={"email_hash": hash_identifier(email), "reason": "user_missing"})
            raise UserNotFoundError

        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 1
        if page_size > 50:
            page_size = 50

        total = await self.league_repository.count_created_leagues(user_id=user.id)
        total_pages = (total + page_size - 1) // page_size if page_size else 1
        if page > max(total_pages, 1):
            page = max(total_pages, 1)

        created_leagues = await self.league_repository.find_created_leagues(user_id=user.id, page=page, limit=page_size)
        await self._hydrate_current_players_count_for_many(created_leagues)

        logger.info("league.query.created_loaded", extra={"user_id": user.id, "page": page, "page_size": page_size, "total": total, "results_count": len(created_leagues)})

        return LeaguesListResponse(
            leagues=[LeagueReadModel.from_entity_get_all(league=l) for l in created_leagues],
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        )

    async def get_participated_leagues(self, email: str, page: int = 1, page_size: int = 10) -> LeaguesListResponse:
        user = await self.user_repository.find_by_email(email)
        if not user:
            logger.warning("league.query.participated_rejected", extra={"email_hash": hash_identifier(email), "reason": "user_missing"})
            raise UserNotFoundError

        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 1
        if page_size > 50:
            page_size = 50

        total = await self.league_repository.count_participated_leagues(user_id=user.id)
        total_pages = (total + page_size - 1) // page_size if page_size else 1
        if page > max(total_pages, 1):
            page = max(total_pages, 1)

        participated_leagues = await self.league_repository.find_participated_leagues(user_id=user.id, page=page, limit=page_size)
        await self._hydrate_current_players_count_for_many(participated_leagues)

        logger.info("league.query.participated_loaded", extra={"user_id": user.id, "page": page, "page_size": page_size, "total": total, "results_count": len(participated_leagues)})

        return LeaguesListResponse(
            leagues=[LeagueReadModel.from_entity_get_all(league=l) for l in participated_leagues],
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        )

    async def get_invitations(
        self,
        email: str,
        is_received: bool,
        status: InvitationStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> "InvitationsReceivedResponse":
        try:
            user = await self.user_repository.find_by_email(email)
            if not user:
                logger.warning("league.query.invitations_rejected", extra={"email_hash": hash_identifier(email), "reason": "user_missing"})
                raise UserNotFoundError

            total = await self.invitation_repository.count_received_invitations(
                user_id=user.id,
                status=status,
            )

            db_invitations = await self.invitation_repository.find_received_invitations(
                user_id=user.id,
                status=status,
                page=page,
                page_size=page_size,
            )

            result = InvitationsReceivedResponse(
                total=total, page=page, page_size=page_size
            )

            if not db_invitations:
                logger.info("league.query.invitations_loaded", extra={"user_id": user.id, "is_received": is_received, "status": getattr(status, 'value', status), "total": total, "results_count": 0})
                return result

            await self._hydrate_current_players_count_for_many([
                db_inv.league for db_inv in db_invitations
                if db_inv.league_id and db_inv.league is not None
            ])

            for db_inv in db_invitations:
                if db_inv.league_id and db_inv.league is not None:
                    league = db_inv.league
                    league_summary = LeagueInvitationReceivedSummary(
                        id=league.id,
                        name=league.name,
                        max_players=league.max_players,
                        min_players=self._extract_min_players(league),
                        start_date=league.start_date,
                        user_creator=UserSummaryLeagueDetail(
                            id=league.user.id,
                            pseudo=league.user.pseudo,
                        ),
                        nb_players_remaining=league.nb_players_remaining,
                        current_players_count=self._extract_current_players_count(league),
                        is_started=league.is_started
                    )

                    result.invitations.append(InvitationReceivedReadModel(
                        id=db_inv.id,
                        type='league',
                        league=league_summary,
                        status=db_inv.status
                    ))
                    continue

                if db_inv.tournament_id and db_inv.tournament is not None:
                    tournament = db_inv.tournament
                    tournament_summary = TournamentInvitationReceivedSummary(
                        id=tournament.id,
                        name=tournament.name,
                        max_players=tournament.max_players,
                        current_players=tournament.current_players,
                        start_date=tournament.start_date,
                        end_date=tournament.end_date,
                        is_private=tournament.is_private,
                        status=tournament.status,
                        user_creator=UserSummaryLeagueDetail(
                            id=tournament.user.id,
                            pseudo=tournament.user.pseudo,
                        ),
                    )

                    result.invitations.append(InvitationReceivedReadModel(
                        id=db_inv.id,
                        type='tournament',
                        tournament=tournament_summary,
                        status=db_inv.status,
                    ))

            logger.info("league.query.invitations_loaded", extra={"user_id": user.id, "is_received": is_received, "status": getattr(status, 'value', status), "total": total, "results_count": len(result.invitations)})
            return result

        except Exception:
            logger.exception("league.query.invitations_failed")
            raise

    async def get_invitation_counts(self, email: str, is_received: bool) -> dict:
        user = await self.user_repository.find_by_email(email)
        if not user:
            logger.warning("league.query.invitation_counts_rejected", extra={"email_hash": hash_identifier(email), "reason": "user_missing"})
            raise UserNotFoundError
        counts = await self.invitation_repository.count_by_status(user.id, is_received)
        logger.info("league.query.invitation_counts_loaded", extra={"user_id": user.id, "is_received": is_received})
        return counts

    async def get_leagues_balances(self, email: str, league_ids: List[int]) -> LeagueBalancesBulkResponse:
        user = await self.user_repository.find_by_email(email)
        if not user:
            logger.warning("league.query.balances_rejected", extra={"email_hash": hash_identifier(email), "reason": "user_missing"})
            raise UserNotFoundError

        ids = [int(i) for i in league_ids if isinstance(i, int) and i > 0]
        ids = list(dict.fromkeys(ids))
        if not ids:
            logger.info("league.query.balances_loaded", extra={"user_id": user.id, "requested_count": 0, "results_count": 0})
            return LeagueBalancesBulkResponse(balances={}, not_found=[], forbidden=[])

        leagues = await self.league_repository.find_all_by_ids(ids)
        existing_ids = {int(l.id) for l in leagues}
        not_found = [i for i in ids if i not in existing_ids]

        balances = await self.league_players_repository.get_balances_by_league_ids(user.id, list(existing_ids))
        participated_ids = set(balances.keys())
        forbidden = [i for i in ids if (i in existing_ids and i not in participated_ids)]

        logger.info("league.query.balances_loaded", extra={"user_id": user.id, "requested_count": len(ids), "results_count": len(balances), "not_found_count": len(not_found), "forbidden_count": len(forbidden)})

        return LeagueBalancesBulkResponse(
            balances=balances,
            not_found=not_found,
            forbidden=forbidden,
        )

    async def get_my_leagues(self, email: str, page: int = 1, page_size: int = 10) -> LeaguesListResponse:
        user = await self.user_repository.find_by_email(email)
        if not user:
            logger.warning("league.query.mine_rejected", extra={"email_hash": hash_identifier(email), "reason": "user_missing"})
            raise UserNotFoundError

        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 1
        if page_size > 50:
            page_size = 50

        total = await self.league_repository.count_my_leagues(user_id=user.id)
        total_pages = (total + page_size - 1) // page_size if page_size else 1
        if page > max(total_pages, 1):
            page = max(total_pages, 1)

        leagues = await self.league_repository.find_my_leagues(user_id=user.id, page=page, limit=page_size)
        await self._hydrate_current_players_count_for_many(leagues)

        logger.info("league.query.mine_loaded", extra={"user_id": user.id, "page": page, "page_size": page_size, "total": total, "results_count": len(leagues)})

        return LeaguesListResponse(
            leagues=[LeagueReadModel.from_entity_get_all(league=l) for l in leagues],
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        )

    async def get_league_invitations(self, league_id: int, email: str) -> LeagueInvitationsSentResponse:
        user = await self.user_repository.find_by_email(email)
        if not user:
            logger.warning("league.query.sent_for_league_rejected", extra={"league_id": league_id, "email_hash": hash_identifier(email), "reason": "user_missing"})
            raise UserNotFoundError

        league = await self.league_repository.find_by_id(league_id)
        if not league:
            logger.warning("league.query.sent_for_league_rejected", extra={"league_id": league_id, "user_id": user.id, "reason": "league_missing"})
            raise LeagueNotFoundError

        if league.user.id != user.id:
            logger.warning("league.query.sent_for_league_rejected", extra={"league_id": league_id, "user_id": user.id, "reason": "forbidden"})
            raise UserNotOwnerLeaguedError

        invitations = await self.invitation_repository.find_league_invitations_sent_by_owner(
            league_id=league_id,
            owner_user_id=user.id,
        )

        logger.info("league.query.sent_for_league_loaded", extra={"league_id": league_id, "user_id": user.id, "results_count": len(invitations)})

        return LeagueInvitationsSentResponse(
            league_id=league_id,
            invitations=[
                LeagueInvitationSentReadModel(
                    id=invitation.id,
                    status=invitation.status,
                    created_at=invitation.created_at,
                    user=UserSummaryReadModel(
                        id=invitation.user.id,
                        email=self._extract_email_value(invitation.user.email),
                        pseudo=invitation.user.pseudo,
                    ),
                )
                for invitation in invitations
            ],
        )

    async def get_sent_invitations(
            self,
            email: str,
            status: InvitationStatus | None = None,
            page: int = 1,
            page_size: int = 20,
    ) -> InvitationsSentResponse:
        user = await self.user_repository.find_by_email(email)
        if not user:
            logger.warning("league.query.sent_rejected", extra={"email_hash": hash_identifier(email), "reason": "user_missing"})
            raise UserNotFoundError

        total = await self.invitation_repository.count_sent_invitations(
            user_id=user.id,
            status=status,
        )

        db_invitations = await self.invitation_repository.find_sent_invitations(
            user_id=user.id,
            status=status,
            page=page,
            page_size=page_size,
        )

        result = InvitationsSentResponse(
            total=total,
            page=page,
            page_size=page_size,
        )

        if not db_invitations:
            logger.info("league.query.sent_loaded", extra={"user_id": user.id, "status": getattr(status, 'value', status), "total": total, "results_count": 0})
            return result

        await self._hydrate_current_players_count_for_many([
            db_inv.league for db_inv in db_invitations
            if db_inv.league_id and db_inv.league is not None
        ])

        for db_inv in db_invitations:
            common_payload = {
                'id': db_inv.id,
                'status': db_inv.status,
                'created_at': db_inv.created_at,
                'user': UserSummaryReadModel(
                    id=db_inv.user.id,
                    email=self._extract_email_value(db_inv.user.email),
                    pseudo=db_inv.user.pseudo,
                ),
            }

            if db_inv.league_id and db_inv.league is not None:
                league = db_inv.league
                result.invitations.append(InvitationSentReadModel(
                    type='league',
                    league=LeagueInvitationReceivedSummary(
                        id=league.id,
                        name=league.name,
                        max_players=league.max_players,
                        min_players=self._extract_min_players(league),
                        start_date=league.start_date,
                        nb_players_remaining=league.nb_players_remaining,
                        current_players_count=self._extract_current_players_count(league),
                        is_started=league.is_started,
                        user_creator=UserSummaryLeagueDetail(
                            id=user.id,
                            pseudo=user.pseudo,
                        ),
                    ),
                    tournament=None,
                    **common_payload,
                ))
                continue

            if db_inv.tournament_id and db_inv.tournament is not None:
                tournament = db_inv.tournament
                result.invitations.append(InvitationSentReadModel(
                    type='tournament',
                    league=None,
                    tournament=TournamentInvitationReceivedSummary(
                        id=tournament.id,
                        name=tournament.name,
                        max_players=tournament.max_players,
                        current_players=tournament.current_players,
                        start_date=tournament.start_date,
                        end_date=tournament.end_date,
                        is_private=tournament.is_private,
                        status=tournament.status,
                        user_creator=UserSummaryLeagueDetail(
                            id=user.id,
                            pseudo=user.pseudo,
                        ),
                    ),
                    **common_payload,
                ))

        logger.info("league.query.sent_loaded", extra={"user_id": user.id, "status": getattr(status, 'value', status), "total": total, "results_count": len(result.invitations)})
        return result

