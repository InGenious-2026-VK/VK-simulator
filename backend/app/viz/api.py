"""HTTP routes for the visualisation window."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from . import lake
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
