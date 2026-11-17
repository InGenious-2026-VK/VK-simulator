"""The caller's own removal requests."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..access import audit
from ..datasets import serialize_removal
from ..db import get_db
from ..errors import ApiError, not_found
from ..orm import RemovalRequest, User, now
from ..security import current_user
from .common import page_params, paginate

router = APIRouter(tags=["Removal requests"])


@router.get("/removal-requests")
def my_requests(status: Optional[str] = None, paging=Depends(page_params),
                user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    q = select(RemovalRequest).where(RemovalRequest.requested_by_id == user.id)
    if status:
        q = q.where(RemovalRequest.status == status)
    return paginate(db, q.order_by(RemovalRequest.created_at.desc()), paging, serialize_removal)


def _mine(db: Session, user: User, request_id: str) -> RemovalRequest:
    rr = db.get(RemovalRequest, request_id)
    if rr is None or (rr.requested_by_id != user.id and user.role != "admin"):
        raise not_found("request", request_id)
    return rr


@router.get("/removal-requests/{request_id}")
def get_request(request_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return serialize_removal(_mine(db, user, request_id))


@router.post("/removal-requests/{request_id}/cancel")
def cancel_request(request_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    rr = _mine(db, user, request_id)
    if rr.requested_by_id != user.id:
        raise ApiError(403, "forbidden", "Only the requester can cancel.")
    if rr.status != "pending":
        raise ApiError(409, "not_pending", f"The request is already {rr.status}.")
    rr.status = "cancelled"
    rr.decided_at = now()
    audit(db, user, "removal.cancel", rr.dataset_id)
    db.commit()
    return serialize_removal(rr)
