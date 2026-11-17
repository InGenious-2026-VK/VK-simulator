"""HTTP routes for the visualisation window."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from . import lake
from .views import build_views
from .contract import ContractError

router = APIRouter(prefix="/api/viz", tags=["visualisation"])


@router.get("/datasets")
def datasets() -> list[dict]:
    try:
        return [lake.public_meta(d) for d in lake.list_datasets()]
    except ContractError as e:
        raise HTTPException(status_code=500, detail=str(e)) from None


@router.get("/datasets/{dataset_id}")
def dataset(dataset_id: str) -> dict:
    try:
        return lake.load_dataset(dataset_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown dataset '{dataset_id}'") from None
    except ContractError as e:
        raise HTTPException(status_code=500, detail=str(e)) from None


@router.get("/datasets/{dataset_id}/views")
def dataset_views(
    dataset_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
) -> dict:
    """One page of a dataset's views (see views.py), for the data overview's card stacks."""
    try:
        data = lake.load_dataset(dataset_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown dataset '{dataset_id}'") from None
    except ContractError as e:
        raise HTTPException(status_code=500, detail=str(e)) from None
    views = build_views(data)
    meta = {k: v for k, v in data.items() if k != "rows"}
    return {"dataset": meta, "total": len(views), "offset": offset, "views": views[offset : offset + limit]}
