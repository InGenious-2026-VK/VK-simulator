"""FastAPI app for FoodChainIQ.

All routes live under /api — see documentation/api/README.md and
documentation/api/openapi.yaml. Window by window:

  1 Home           /auth/*, /stats/public
  2 Data Lake      /datasets*, /groups*, /removal-requests*, /metadata/*, /selections
  3 Visualization  /visualizations/summary, /datasets/{id}/summary|geometry
  4 Simulation     /network, /presets, /simulation/context, /simulate, /simulations*
  Admin            /admin/*
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import errors
from .config import settings
from .db import SessionLocal, init_db
from .routers import (
    admin,
    auth,
    datasets,
    groups,
    metadata_routes,
    removal,
    selections,
    simulation,
)
from .seed import purge_removed, seed


@asynccontextmanager
async def lifespan(_: FastAPI):
    log = logging.getLogger("uvicorn.error")
    if settings.jwt_secret.startswith("dev-only") or settings.admin_password == "admin1234":
        log.warning(
            "FoodChainIQ is using development defaults for JWT_SECRET and/or ADMIN_PASSWORD. "
            "Set them (see .env.example) before exposing this server."
        )
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    init_db()
    db = SessionLocal()
    try:
        seed(db)
        purge_removed(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="FoodChainIQ API",
    version="1.0.0",
    description="Data lake, visualization and supply-chain disruption simulation for Östergötland. "
    "Baseline and demo data are synthetic.",
    lifespan=lifespan,
)
errors.install(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["*"],
    expose_headers=["Location"],
)

for module in (auth, groups, datasets, removal, metadata_routes, selections, simulation, admin):
    app.include_router(module.router, prefix="/api")
