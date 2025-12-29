from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Request, Header

from application.tournament import TournamentQueryUseCase
from application.tournament.tournament_command_model import (
    TournamentCreateModel,
    TournamentCreateResponse,
    TournamentJoinResponse, TournamentStartResponse, TournamentUpdateResponse, TournamentUpdateModel,
    SchedulerSuccessfulyRunResponse,
)
from application.tournament.tournament_command_usecase import TournamentCommandUseCase
from application.tournament_subscription.cancel.cancel_tournament_subscription_usecase import \
    CancelTournamentSubscriptionUseCase
from application.tournament_subscription.create.create_tournament_subscription_usecase import CreateTournamentSubscriptionUseCase
from application.tournament_subscription.tournament_subscription_command_model import CheckoutSessionResponse, \
    CreateSubscriptionRequest
from application.tournament_subscription.webhook.process_stripe_webhook import \
    ProcessStripeWebhookTournamentSubscriptionUseCase
from dependency_injections import current_user, tournament_command_usecase, tournament_query_usecase, \
    tournament_scheduler, create_tournament_subscription_use_case, cancel_tournament_subscription_use_case, \
    stripe_service, process_webhook_tournament_subscription_use_case, get_async_session, \
    verify_tournament_subscription
from domain.scheduler.tournament_scheduler import TournamentScheduler
from domain.services.stripe.stripe_service import StripeService
from domain.tournament.exception.tournament_exception import TournamentAlreadyStartedError, TournamentNotFoundError, \
    TournamentNameAlreadyExistsError, TournamentNotOwnerLeaguedError
from domain.user.exception.user_exception import UserNotFoundError

router = APIRouter(prefix="/api", tags=["tournament"])


@router.post(
    "/tournament/create",
    response_model=TournamentCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tournament(
    tournament_model: TournamentCreateModel,
    tournament_usecase: TournamentCommandUseCase = Depends(tournament_command_usecase),
    current_user: dict = Depends(current_user),
    _: None = Depends(verify_tournament_subscription)
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
    current_user: dict = Depends(current_user),
    _: None = Depends(verify_tournament_subscription)
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
        current_user: dict = Depends(current_user),
        _: None = Depends(verify_tournament_subscription)
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
    "/tournament/{id}",
    status_code=status.HTTP_200_OK,
    summary="Récupère les détails d'un tournoi",
)
async def get_tournament_details(
        id: int,
        tournament_usecase: TournamentQueryUseCase = Depends(tournament_query_usecase),
        current_user: dict = Depends(current_user),
        _: None = Depends(verify_tournament_subscription)
):
    try:
        return await tournament_usecase.get_tournament_details(id, current_user.get("email", ""))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except TournamentNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération du tournoi: {str(e)}"
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
        current_user: dict = Depends(current_user),
        _: None = Depends(verify_tournament_subscription)
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
        current_user: dict = Depends(current_user),
        _: None = Depends(verify_tournament_subscription)
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

@router.get(
    "/tournaments/my",
    status_code=status.HTTP_200_OK,
    summary="Récupère les tournois auxquels l'utilisateur est inscrit",
)
async def get_tournaments_registered(
        page: int = Query(1, ge=1, description="Numéro de page (commence à 1)"),
        page_size: int = Query(10, ge=1, le=100, description="Nombre d'éléments par page"),
        tournament_usecase: TournamentQueryUseCase = Depends(tournament_query_usecase),
        current_user: dict = Depends(current_user),
        _: None = Depends(verify_tournament_subscription)
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
        current_user: dict = Depends(current_user),
        _: None = Depends(verify_tournament_subscription)
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
    "/tournaments/my/created",
    status_code=status.HTTP_200_OK,
    summary="Récupère les tournois créés par l'utilisateur",
)
async def get_tournaments_created(
        page: int = Query(1, ge=1, description="Numéro de page (commence à 1)"),
        page_size: int = Query(10, ge=1, le=100, description="Nombre d'éléments par page"),
        tournament_usecase: TournamentQueryUseCase = Depends(tournament_query_usecase),
        current_user: dict = Depends(current_user),
        _: None = Depends(verify_tournament_subscription)
):
    try:
        return await tournament_usecase.get_tournaments_created(current_user.get("email", ""), page, page_size)
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des tournois créés par l'utilisateur: {str(e)}"
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
        current_user: dict = Depends(current_user),
        _: None = Depends(verify_tournament_subscription)
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
        current_user: dict = Depends(current_user),
        _: None = Depends(verify_tournament_subscription)
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
        _: None = Depends(verify_tournament_subscription),
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


@router.post(
    "/subscription/create-intent",
    response_model=CheckoutSessionResponse,
    status_code=status.HTTP_200_OK,
)
async def create_tournament_subscription_checkout(
        subscription_request: CreateSubscriptionRequest,
        current_user: dict = Depends(current_user),
        use_case: CreateTournamentSubscriptionUseCase = Depends(create_tournament_subscription_use_case),
):
    try:
        result = await use_case.execute(current_user.get('email', ''), subscription_request)

        return result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la création de l'abonnement"
        )


@router.post(
    "/subscription/cancel",
    status_code=status.HTTP_200_OK,
)
async def cancel_user_subscription(
        current_user: dict = Depends(current_user),
        tournament_subscription_cancel_use_case: CancelTournamentSubscriptionUseCase = Depends(cancel_tournament_subscription_use_case),
):
    try:
        result = await tournament_subscription_cancel_use_case.execute(current_user.get('email', ''))

        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post(
    "/subscription/webhook",
    status_code=status.HTTP_200_OK,
)
async def stripe_webhook(
        request: Request,
        use_case: ProcessStripeWebhookTournamentSubscriptionUseCase = Depends(process_webhook_tournament_subscription_use_case),
        stripe_service: StripeService = Depends(stripe_service),
        stripe_signature: str = Header(None, alias="stripe-signature")
):
    try:
        payload = await request.body()

        event = stripe_service.verify_webhook(payload, stripe_signature)

        await use_case.execute(event["type"], event["data"]["object"])

        return {"status": "success"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erreur webhook")
