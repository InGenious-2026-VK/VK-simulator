"""HTTP routes for the data overview window (between Data Lake and Visualization).

All routes need a signed-in user and only return datasets that user may see.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..orm import User
from ..security import current_user
from . import lake
from .views import build_views

router = APIRouter(prefix="/viz", tags=["Data overview"])


@router.get("/selections/{selection_id}/datasets")
def selection_datasets(selection_id: str, user: User = Depends(current_user),
                       db: Session = Depends(get_db)) -> dict:
    """The selected datasets that can be charted, plus the skipped ones and why."""
    return lake.selection_datasets(db, user, selection_id)


@router.get("/datasets/{dataset_id}")
def dataset(dataset_id: str, version: Optional[int] = None, user: User = Depends(current_user),
            db: Session = Depends(get_db)) -> dict:
    """One dataset: title, chart type, unit, source... plus `rows`, the data to draw."""
    return lake.load_visible(db, user, dataset_id, version)


@router.get("/datasets/{dataset_id}/views")
def dataset_views(
    dataset_id: str,
    version: Optional[int] = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """One page of a dataset's views (see views.py), for the overview's card stacks."""
    data = lake.load_visible(db, user, dataset_id, version)
    views = build_views(data)
    meta = {k: v for k, v in data.items() if k != "rows"}
    return {"dataset": meta, "total": len(views), "offset": offset, "views": views[offset : offset + limit]}
