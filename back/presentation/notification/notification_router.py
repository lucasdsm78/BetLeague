from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, status

from application.notification.notification_query_model import (
    NotificationListResponse,
    NotificationReadModel,
    UnreadCountResponse,
)
from application.notification.notification_command_model import MarkAllReadResponse
from application.notification.notification_query_usecase import NotificationQueryUseCase
from application.notification.notification_command_usecase import NotificationCommandUseCase
from dependency_injections import current_user, notification_query_usecase, notification_command_usecase

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


@router.get("", response_model=NotificationListResponse, status_code=status.HTTP_200_OK)
async def list_notifications(
    limit: int = 20,
    cursor: Optional[str] = None,
    user: dict = Depends(current_user),
    uc: NotificationQueryUseCase = Depends(notification_query_usecase),
):
    limit = min(max(limit, 1), 50)
    user_id = int(user["id"])

    items, next_cursor = await uc.list_for_user(user_id=user_id, limit=limit, cursor=cursor)
    logger.info("notification.http.list_succeeded", extra={"user_id": user_id, "limit": limit, "results_count": len(items), "has_next_cursor": bool(next_cursor)})
    return NotificationListResponse(
        items=[
            NotificationReadModel(
                id=n.id,
                user_id=n.user_id,
                type=str(n.type),
                title=n.title,
                message=n.message,
                data=dict(n.data),
                created_at=n.created_at,
                read_at=n.read_at,
            )
            for n in items
        ],
        next_cursor=next_cursor,
    )


@router.get("/unread-count", response_model=UnreadCountResponse, status_code=status.HTTP_200_OK)
async def unread_count(
    user: dict = Depends(current_user),
    uc: NotificationQueryUseCase = Depends(notification_query_usecase),
):
    user_id = int(user["id"])
    count = await uc.unread_count(user_id=user_id)
    logger.info("notification.http.unread_count_succeeded", extra={"user_id": user_id, "count": count})
    return UnreadCountResponse(count=count)


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    notification_id: int,
    user: dict = Depends(current_user),
    uc: NotificationCommandUseCase = Depends(notification_command_usecase),
):
    user_id = int(user["id"])
    await uc.mark_read(user_id=user_id, notification_id=notification_id)
    logger.info("notification.http.mark_read_succeeded", extra={"user_id": user_id, "notification_id": notification_id})


@router.post("/read-all", response_model=MarkAllReadResponse, status_code=status.HTTP_200_OK)
async def mark_all_read(
    user: dict = Depends(current_user),
    uc: NotificationCommandUseCase = Depends(notification_command_usecase),
):
    user_id = int(user["id"])
    updated = await uc.mark_all_read(user_id=user_id)
    logger.info("notification.http.mark_all_read_succeeded", extra={"user_id": user_id, "updated_count": updated})
    return MarkAllReadResponse(updated=updated)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: int,
    user: dict = Depends(current_user),
    uc: NotificationCommandUseCase = Depends(notification_command_usecase),
):
    user_id = int(user["id"])
    await uc.delete(user_id=user_id, notification_id=notification_id)
    logger.info("notification.http.delete_succeeded", extra={"user_id": user_id, "notification_id": notification_id})
