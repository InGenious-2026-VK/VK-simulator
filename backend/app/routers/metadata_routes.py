"""Standard metadata file: template + validation."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import JSONResponse

from ..metadata import TEMPLATE, parse_metadata, validate_metadata
from ..orm import User
from ..security import current_user

router = APIRouter(tags=["Metadata"])


@router.get("/metadata/template")
def template(_: User = Depends(current_user)):
    return JSONResponse(TEMPLATE, headers={"Content-Disposition": 'attachment; filename="metadata.json"'})


@router.post("/metadata/validate")
async def validate(request: Request, metadata: Optional[UploadFile] = File(None),
                   _: User = Depends(current_user)) -> dict:
    if metadata is not None:
        _, errors = parse_metadata(await metadata.read())
    else:
        try:
            body = await request.json()
        except ValueError:
            return {"valid": False, "errors": [{"path": "/", "message": "body is not valid JSON"}]}
        errors = validate_metadata(body)
    return {"valid": not errors, "errors": errors}
