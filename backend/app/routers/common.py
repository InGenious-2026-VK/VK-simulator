"""Shared router helpers: pagination."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Query
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session


@dataclass
class Paging:
    page: int
    page_size: int


def page_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> Paging:
    return Paging(page, page_size)


def paginate(db: Session, query: Select, paging: Paging, serialize: Callable) -> dict:
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    rows = db.scalars(query.offset((paging.page - 1) * paging.page_size).limit(paging.page_size)).all()
    return {
        "items": [serialize(r) for r in rows],
        "page": paging.page,
        "page_size": paging.page_size,
        "total": total,
    }
