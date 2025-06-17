from fastapi import APIRouter, Depends, HTTPException, status

from application.tournament.tournament_command_model import (
    TournamentCreateModel,
    TournamentCreateResponse,
    TournamentJoinResponse, TournamentStartResponse,
)
from application.tournament.tournament_command_usecase import TournamentCommandUseCase
from dependency_injections import current_user, tournament_command_usecase
from domain.tournament.exception.tournament_exception import TournamentAlreadyStartedError, TournamentNotFoundError
from domain.user.exception.user_exception import UserNotFoundError

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
