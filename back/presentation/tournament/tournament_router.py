from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Request, Header
from fastapi import Path
from domain.user.model.user import User

from application.tournament import TournamentQueryUseCase
from application.tournament.tournament_command_model import (
    TournamentCreateModel,
    TournamentCreateResponse,
    TournamentJoinResponse, TournamentStartResponse, TournamentUpdateResponse, TournamentUpdateModel,
    SchedulerSuccessfulyRunResponse,
    TournamentPlayerDeletedResponse, TournamentInviteResponse, InvitationDeleteResponse, InvitationUpdateResponse
)
from application.tournament.tournament_command_usecase import TournamentCommandUseCase
from application.tournament_subscription.cancel.cancel_tournament_subscription_usecase import \
    CancelTournamentSubscriptionUseCase
from application.tournament_subscription.create.create_tournament_subscription_usecase import CreateTournamentSubscriptionUseCase
from application.tournament_subscription.query_tournament_subscription_usecase import TournamentSubscriptionQueryUseCase
from application.tournament_subscription.tournament_subscription_command_model import CheckoutSessionResponse, \
    CreateSubscriptionRequest, CancelSubscriptionResponse
from application.tournament_subscription.tournament_subscription_query_model import TournamentSubscriptionPlansResponse, \
    TournamentCurrentSubscriptionReadModel
from application.tournament_subscription.webhook.process_stripe_webhook import \
    ProcessStripeWebhookTournamentSubscriptionUseCase
from domain.tournament_subscription.exception.tournament_subscription_exception import TournamentSubscriptionInactiveError
from dependency_injections import current_user, tournament_command_usecase, tournament_query_usecase, \
    tournament_scheduler, create_tournament_subscription_use_case, cancel_tournament_subscription_use_case, \
    stripe_service, process_webhook_tournament_subscription_use_case, get_async_session, \
    tournament_subscription_query_use_case, require_scheduler_access, rate_limit_tournament_mutation
from domain.scheduler.tournament_scheduler import TournamentScheduler
from domain.services.stripe.stripe_service import StripeService
from domain.tournament.exception.tournament_exception import TournamentAlreadyStartedError, TournamentNotFoundError, \
    TournamentNameAlreadyExistsError, TournamentNotOwnerLeaguedError, TournamentPlayerFoundError, \
    TournamentMonthlyFreeCreationLimitReachedError, TournamentMaxPlayersError, TournamentSelfInvitationError, \
    UserNotInvitationTournamentError, TournamentNotEnoughPlayersError, TournamentFullError, UserAlreadyInTournamentError
from domain.user.exception.user_exception import UserNotFoundError

from application.tournament.tournament_query_model import TournamentCreatedResponse, TournamentCreationAccessResponse
from application.tournament.tournament_query_model import TournamentInvitationsResponse

from domain.invitation.exception.invitation_exception import InvitationFoundError, InvitationNotFoundError

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
    _rate_limited: bool = Depends(rate_limit_tournament_mutation),
):
    try:
        return await tournament_usecase.create_tournament(tournament_model, current_user.get("email", ""))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except TournamentNameAlreadyExistsError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except TournamentMonthlyFreeCreationLimitReachedError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "message": e.message,
                "code": e.code,
                "monthly_free_tournaments_limit": e.monthly_free_limit,
                "monthly_free_tournaments_used": e.monthly_free_used,
                "monthly_free_tournaments_remaining": e.monthly_free_remaining,
                "can_create_tournament": False,
                "requires_tournament_subscription": True,
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la création du tournoi"
        )


@router.get(
    "/tournaments/creation-access",
    response_model=TournamentCreationAccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Récupère l'état du quota mensuel de création de tournois",
)
async def get_tournament_creation_access(
        tournament_usecase: TournamentQueryUseCase = Depends(tournament_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        return await tournament_usecase.get_tournament_creation_access(current_user.get("email", ""))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la récupération du quota tournoi"
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
    _rate_limited: bool = Depends(rate_limit_tournament_mutation),
):
    try:
        return await tournament_usecase.join_tournament(id, current_user.get("email", ""))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except (TournamentFullError, UserAlreadyInTournamentError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
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
        _rate_limited: bool = Depends(rate_limit_tournament_mutation),
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
    except TournamentNotOwnerLeaguedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except TournamentNotEnoughPlayersError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
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
        current_user: dict = Depends(current_user),
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
    "/tournaments/my/match-options",
    status_code=status.HTTP_200_OK,
    summary="Récupère toutes les options de matchs tournoi d'un utilisateur en une seule lecture",
)
async def get_user_tournament_match_options(
        tournament_usecase: TournamentQueryUseCase = Depends(tournament_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        return await tournament_usecase.get_user_tournament_match_options(current_user.get("email", ""))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des options de matchs tournoi: {str(e)}"
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
        current_user: dict = Depends(current_user),
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

@router.get(
    "/tournaments/my/created",
    status_code=status.HTTP_200_OK,
    response_model=TournamentCreatedResponse,
    summary="Récupère les tournois créés par l'utilisateur",
)
async def get_tournaments_created(
        page: int = Query(1, ge=1, description="Numéro de page (commence à 1)"),
        page_size: int = Query(10, ge=1, le=100, description="Nombre d'éléments par page"),
        tournament_usecase: TournamentQueryUseCase = Depends(tournament_query_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        return await tournament_usecase.get_tournaments_created(int(current_user.get("id")), page, page_size)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne"
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
        _rate_limited: bool = Depends(rate_limit_tournament_mutation),
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
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Erreur lors de l'exécution background du scheduler tournoi")
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
        _authorized: bool = Depends(require_scheduler_access),
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


@router.get(
    "/subscription/plans",
    response_model=TournamentSubscriptionPlansResponse,
    status_code=status.HTTP_200_OK,
)
async def get_tournament_subscription_plans(
        use_case: TournamentSubscriptionQueryUseCase = Depends(tournament_subscription_query_use_case),
):
    return await use_case.get_available_plans()


@router.get(
    "/subscription/me",
    response_model=TournamentCurrentSubscriptionReadModel,
    status_code=status.HTTP_200_OK,
)
async def get_current_tournament_subscription(
        current_user: dict = Depends(current_user),
        use_case: TournamentSubscriptionQueryUseCase = Depends(tournament_subscription_query_use_case),
):
    try:
        return await use_case.get_current_subscription(current_user.get('email', ''))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la récupération de l'abonnement tournoi",
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
        _rate_limited: bool = Depends(rate_limit_tournament_mutation),
):
    try:
        result = await use_case.execute(current_user.get('email', ''), subscription_request)

        return result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la création de l'abonnement"
        )


@router.post(
    "/subscription/cancel",
    response_model=CancelSubscriptionResponse,
    status_code=status.HTTP_200_OK,
)
async def cancel_user_subscription(
        current_user: dict = Depends(current_user),
        tournament_subscription_cancel_use_case: CancelTournamentSubscriptionUseCase = Depends(cancel_tournament_subscription_use_case),
        _rate_limited: bool = Depends(rate_limit_tournament_mutation),
):
    try:
        result = await tournament_subscription_cancel_use_case.execute(current_user.get('email', ''))

        return result
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except TournamentSubscriptionInactiveError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de l'annulation de l'abonnement tournoi",
        )

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

@router.delete(
    "/tournament/{id}/player/me",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Delete player connected to a tournament",
    response_model=TournamentPlayerDeletedResponse
)
async def leave_tournament(
        id: int,
        tournament_command_usecase: TournamentCommandUseCase = Depends(tournament_command_usecase),
        current_user: dict = Depends(current_user),
        _rate_limited: bool = Depends(rate_limit_tournament_mutation),
):
    try:
        delete_tournament_player = await tournament_command_usecase.leave_tournament(
            id,
            current_user.get('id', '')
        )
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except TournamentNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except TournamentAlreadyStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return delete_tournament_player


@router.get(
    "/tournament/{tournament_id}/invitations",
    response_model=TournamentInvitationsResponse,
    status_code=status.HTTP_200_OK,
    summary="Liste les invitations envoyées pour un tournoi du créateur connecté",
)
async def get_tournament_invitations(
        tournament_id: int = Path(..., gt=0),
        tournament_usecase: TournamentQueryUseCase = Depends(tournament_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        return await tournament_usecase.get_tournament_invitations(
            tournament_id=tournament_id,
            email=current_user.get('email', ''),
        )
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except TournamentNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except TournamentNotOwnerLeaguedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la récupération des invitations du tournoi",
        )

@router.post(
    "/tournament/{tournament_id}/{user_id}/invite",
    response_model=TournamentInviteResponse,
    summary="Invite un utilisateur à rejoindre un tournoi privé",
    status_code=status.HTTP_200_OK
)
async def invite_user_to_tournament(
        tournament_id: int = Path(..., gt=0),
        user_id: int = Path(..., gt=0),
        tournament_command_usecase: TournamentCommandUseCase = Depends(tournament_command_usecase),
        current_user: dict = Depends(current_user),
        _rate_limited: bool = Depends(rate_limit_tournament_mutation),
):
    try:
        invitation = await tournament_command_usecase.invite_user(tournament_id, user_id, current_user.get('email', ''))

    except TournamentNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except TournamentNotOwnerLeaguedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message,
        )

    except TournamentAlreadyStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message,
        )

    except TournamentSelfInvitationError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )

    except TournamentPlayerFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )

    except TournamentMaxPlayersError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )

    except InvitationFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return invitation

@router.delete(
    "/tournament/invitation/{invitation_id}",
    response_model=InvitationDeleteResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Delete invitation to a tournament",
)
async def delete_invitation(
        invitation_id: int = Path(..., gt=0),
        tournament_command_usecase: TournamentCommandUseCase = Depends(tournament_command_usecase),
        current_user: dict = Depends(current_user),
        _rate_limited: bool = Depends(rate_limit_tournament_mutation),
):
    try:
        delete_invitation_result = await tournament_command_usecase.delete_invitation(invitation_id, int(current_user.get('id')))
    except InvitationNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la suppression d'une l'invitation à un tournoi"
        )

    return delete_invitation_result


@router.put(
    "/tournament/invitation/{action}",
    response_model=InvitationUpdateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Update tournament invitation status",
)
async def update_tournament_invitation(
        invitation_id: int,
        action: bool,
        tournament_command_usecase: TournamentCommandUseCase = Depends(tournament_command_usecase),
        current_user: dict = Depends(current_user),
        _rate_limited: bool = Depends(rate_limit_tournament_mutation)
):
    try:
        return await tournament_command_usecase.update_invitation(
            invitation_id,
            action,
            current_user.get('email', ''),
        )
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except InvitationNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UserNotInvitationTournamentError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except TournamentNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except TournamentAlreadyStartedError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except TournamentMaxPlayersError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la modification du status de l'invitation tournoi"
        )

