from abc import ABC, abstractmethod
from typing import List, Dict, Optional

from pydantic import BaseModel

from application.league.league_query_model import LeagueReadModel, InvitationReceivedReadModel, \
    LeagueInvitationReceivedSummary, UserSummaryLeagueDetail
from domain.invitation.model.invitation_status import InvitationStatus
from domain.invitation.repository.invitation_repository import InvitationRepository
from domain.league.exception.league_exception import LeagueParticipantNotFoundError, LeagueNotFoundError
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository


class LeagueQueryUseCase(ABC):

    @abstractmethod
    async def get_rank_by_league_id(self, email: str, league_id: int) -> List[Dict[str, any]]:
        raise NotImplementedError

    @abstractmethod
    async def get_league_by_id(self, league_id: int, email: str) -> Optional[LeagueReadModel]:
        raise NotImplementedError

    @abstractmethod
    def get_leagues(self, email: str) -> dict:
        raise NotImplementedError

    @abstractmethod
    def get_invitations(self, email: str, is_received: bool):
        raise NotImplementedError


class LeagueQueryUseCaseImpl(LeagueQueryUseCase, BaseModel):
    league_players_repository: LeaguePlayersRepository
    user_repository: UserRepository
    league_repository: LeagueRepository
    invitation_repository: InvitationRepository

    class Config:
        arbitrary_types_allowed = True

    async def get_rank_by_league_id(
            self,
            email: str,
            league_id: int
    ) -> List[Dict[str, any]]:
        user = await self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        participated = await self.league_players_repository.find_participation(
            league_id=league_id,
            user_id=user.id
        )
        if not participated:
            raise LeagueParticipantNotFoundError

        ranking = await self.league_players_repository.get_league_rank(league_id=league_id)
        return ranking

    async def get_league_by_id(
            self,
            league_id: int,
            email: str
    ) -> Optional[LeagueReadModel]:
        user = await self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        league = await self.league_repository.find_by_id(league_id)
        if not league:
            raise LeagueNotFoundError

        if league.is_private:
            participated = await self.league_players_repository.find_participation(
                league_id=league_id,
                user_id=user.id
            )
            if not participated:
                raise LeagueParticipantNotFoundError

        return LeagueReadModel.from_entity_get_by_id(league)


    def get_leagues(self, email: str) -> dict:
        try:
            user = self.user_repository.find_by_email(email)
            if not user:
                raise UserNotFoundError

            leagues = self.league_repository.find_leagues(user_id=user.id)

            return dict(
                leagues=list(map(lambda league: LeagueReadModel.from_entity_get_all(
                    league=league), leagues))
            )

        except Exception as e:
            raise

    def get_invitations(self, email: str, is_received: bool) -> List[InvitationReceivedReadModel]:
        try:
            user = self.user_repository.find_by_email(email)
            if not user:
                raise UserNotFoundError

            grouped_invitations = self.invitation_repository.find_invitations(
                user_id=user.id,
                status=InvitationStatus.pending,
                is_received=is_received
            )

            invitation_models = []

            for invitation in grouped_invitations.get("pending", []):
                league = self.league_repository.find_by_id(invitation.league_id)

                league_summary = LeagueInvitationReceivedSummary(
                    id=league.id,
                    name=league.name,
                    max_players=league.max_players,
                    start_date=league.start_date,
                    user_creator=UserSummaryLeagueDetail(
                        id=league.user.id,
                        pseudo=league.user.pseudo,
                    ),
                    nb_players_remaining=league.nb_players_remaining,
                    is_started=league.is_started
                )

                invitation_models.append(InvitationReceivedReadModel(
                    id=invitation.id,
                    league=league_summary,
                    status=invitation.status.value
                ))

            return invitation_models

        except Exception as e:
            raise e
