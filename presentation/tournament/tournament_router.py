from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks

from application.league.league_command_model import LeagueUpdateModel
from application.tournament import TournamentQueryUseCase
from application.tournament.tournament_command_model import (
    TournamentCreateModel,
    TournamentCreateResponse,
    TournamentJoinResponse, TournamentStartResponse, TournamentUpdateResponse, TournamentUpdateModel,
    SchedulerSuccessfulyRunResponse,
)
from application.tournament.tournament_command_usecase import TournamentCommandUseCase
from application.tournament.tournament_bet_command_usecase import TournamentBetCommandUseCase
from application.tournament.tournament_bet_command_model import TournamentBetCreateModel, TournamentBetCreateResponse
from dependency_injections import current_user, tournament_command_usecase, tournament_query_usecase, tournament_scheduler, tournament_bet_command_usecase
from domain.scheduler.tournament_scheduler import TournamentScheduler
from domain.tournament.exception.tournament_exception import TournamentAlreadyStartedError, TournamentNotFoundError, \
    TournamentNameAlreadyExistsError, TournamentNotOwnerLeaguedError
from domain.user.exception.user_exception import UserNotFoundError
from domain.tournament_bet.exception.tournament_bet_exception import NotEnoughBTLError, BetAlreadyExistsError

router = APIRouter(tags=["tournament"])


@router.post(
    "/tournament/create",
    response_model=TournamentCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tournament(
    tournament_model: TournamentCreateModel,
    tournament_usecase: TournamentCommandUseCase = Depends(tournament_command_usecase),
    current_user: dict = Depends(current_user)
):
    try:
        return await tournament_usecase.create_tournament(tournament_model, current_user.get("email", ""))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la création du tournoi: {str(e)}"
        )


@router.post(
    "/tournament/{id}/join",
    response_model=TournamentJoinResponse,
    status_code=status.HTTP_200_OK,
)
async def join_tournament(
    id: int,
    tournament_usecase: TournamentCommandUseCase = Depends(tournament_command_usecase),
    current_user: dict = Depends(current_user)
):
    try:
        return await tournament_usecase.join_tournament(id, current_user.get("email", ""))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'inscription au tournoi: {str(e)}"
        )

@router.post(
    "/tournament/{id}/start",
    response_model=TournamentStartResponse,
    status_code=status.HTTP_200_OK,
    summary="Démarrer un tournoi"
)
async def start_tournament(
        id: int,
        tournament_usecase: TournamentCommandUseCase = Depends(tournament_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        return await tournament_usecase.start_tournament(
            tournament_id=id,
            email=current_user.get('email', '')
        )

    except UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    except TournamentNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except TournamentAlreadyStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors du démarrage du tournoi: {str(e)}"
        )

@router.get(
    "/tournament/{id}/stages",
    status_code=status.HTTP_200_OK,
    summary="Récupère les étapes d'un tournoi",
    response_model=dict,
)
async def get_tournament_stages(
        id: int,
        tournament_usecase: TournamentQueryUseCase = Depends(tournament_query_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        return await tournament_usecase.get_tournament_stages(id, current_user.get("email", ""))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except TournamentNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des étapes du tournoi: {str(e)}"
        )

@router.get(
    "/tournament/{id}/stage/{stage}/matches",
    status_code=status.HTTP_200_OK,
    summary="Récupère les matchs d'une étape de tournoi",
    response_model=dict,
)
async def get_tournament_stages(
        stage: str,
        id: int,
        tournament_usecase: TournamentQueryUseCase = Depends(tournament_query_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        return await tournament_usecase.get_stage_matches(id, stage, current_user.get("email", ""))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except TournamentNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des étapes du tournoi: {str(e)}"
        )


@router.post(
    "/tournament/{tournament_id}/match/{match_id}/bet",
    response_model=TournamentBetCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Parier sur un match de tournoi",
)
async def place_tournament_bet(
        tournament_id: int,
        match_id: int,
        bet: TournamentBetCreateModel,
        usecase: TournamentBetCommandUseCase = Depends(tournament_bet_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        return await usecase.place_bet(tournament_id, match_id, bet, current_user.get('email', ''))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except NotEnoughBTLError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except BetAlreadyExistsError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get(
    "/tournaments/my",
    status_code=status.HTTP_200_OK,
    summary="Récupère les tournois auxquels l'utilisateur est inscrit",
)
async def get_tournaments_registered(
        page: int = Query(1, ge=1, description="Numéro de page (commence à 1)"),
        page_size: int = Query(10, ge=1, le=100, description="Nombre d'éléments par page"),
        tournament_usecase: TournamentQueryUseCase = Depends(tournament_query_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        return await tournament_usecase.get_user_tournaments_in_progress(current_user.get("email", ""), page, page_size)
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except TournamentNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des tournois inscrits de l'utilisateur: {str(e)}"
        )

@router.get(
    "/tournaments/my/finished",
    status_code=status.HTTP_200_OK,
    summary="Récupère les tournois terminés de l'utilisateur",
)
async def get_tournaments_finished(
        page: int = Query(1, ge=1, description="Numéro de page (commence à 1)"),
        page_size: int = Query(10, ge=1, le=100, description="Nombre d'éléments par page"),
        tournament_usecase: TournamentQueryUseCase = Depends(tournament_query_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        return await tournament_usecase.get_tournaments_finished(current_user.get("email", ""), page, page_size)
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des tournois terminés de l'utilisateur: {str(e)}"
        )

@router.get(
    "/tournaments",
    status_code=status.HTTP_200_OK,
    summary="Récupère les tournois disponibles pour l'utilisateur",
)
async def get_available_public_tournaments(
        page: int = Query(1, ge=1, description="Numéro de page (commence à 1)"),
        page_size: int = Query(10, ge=1, le=100, description="Nombre d'éléments par page"),
        tournament_usecase: TournamentQueryUseCase = Depends(tournament_query_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        return await tournament_usecase.get_available_tournaments_public(current_user.get("email", ""), page, page_size)
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des tournois disponibles publics: {str(e)}"
        )

@router.put(
    "/tournament/{id}",
    response_model=TournamentUpdateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Update tournament",
)
async def update_tournament(
        id: int,
        update_tournament_model: TournamentUpdateModel,
        tournament_usecase: TournamentCommandUseCase = Depends(tournament_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        update_tournament_result = await tournament_usecase.update(update_tournament_model, id, current_user.get('email'))
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except TournamentNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except TournamentNameAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )
    except TournamentNotOwnerLeaguedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message
        )
    except TournamentAlreadyStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la modification du tournoi"
        )

    return update_tournament_result


async def process_tournaments_background(scheduler: TournamentScheduler):
    try:
        await scheduler.process_tournaments()
    except Exception as e:
        raise

@router.post(
    "/scheduler/run",
    response_model=SchedulerSuccessfulyRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Déclenche manuellement le scheduler des tournois"
)
async def run_tournament_scheduler(
        background_tasks: BackgroundTasks,
        scheduler: TournamentScheduler = Depends(tournament_scheduler),
):
    try:
        background_tasks.add_task(process_tournaments_background, scheduler)
        return SchedulerSuccessfulyRunResponse
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors du lancement du scheduler: {str(e)}"
        )
