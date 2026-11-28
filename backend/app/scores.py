"""Dataset quality scores (issue #33).

Two scores per dataset version, both computed from `dataset_run_usage`:

- usage:    number of stored simulation runs that used the version.
- feedback: sum of the ratings users gave those runs
            (up +2, meh -0.5, down -2). Datasets that were only drawn on the
            map (role "reference") did not shape the result, so they get no
            feedback points.

Runs by platform admins are never recorded in `dataset_run_usage`, so they
do not count. Scores are kept per version; the API shows the current
version's scores, so they start again from zero when a new version replaces
the old one.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .orm import Dataset, DatasetRunUsage, SimulationRun, User

POINTS = {"up": 2.0, "meh": -0.5, "down": -2.0}
RATINGS = tuple(POINTS)


def record_usage(db: Session, user: User, run: SimulationRun, datasets: list[dict]) -> None:
    """Records the datasets a run used. Admin runs do not count."""
    if user.role == "admin":
        return
    seen: set[str] = set()
    for d in datasets:
        if d["id"] in seen:
            continue
        seen.add(d["id"])
        db.add(DatasetRunUsage(run_id=run.id, dataset_id=d["id"], version=d["version"],
                               role=d.get("role") or "reference"))


def version_scores(db: Session, dataset_id: str, version: int) -> dict:
    """Scores of one dataset version."""
    where = (DatasetRunUsage.dataset_id == dataset_id, DatasetRunUsage.version == version)
    usage = db.scalar(select(func.count()).select_from(DatasetRunUsage).where(*where)) or 0
    rows = db.execute(
        select(SimulationRun.feedback, func.count())
        .join(DatasetRunUsage, DatasetRunUsage.run_id == SimulationRun.id)
        .where(*where, DatasetRunUsage.role != "reference", SimulationRun.feedback.is_not(None))
        .group_by(SimulationRun.feedback)
    ).all()
    ratings = {r: 0 for r in RATINGS}
    for rating, n in rows:
        if rating in ratings:
            ratings[rating] = n
    feedback = sum(POINTS[r] * n for r, n in ratings.items())
    return {"version": version, "usage": usage, "feedback": feedback, "ratings": ratings}


def dataset_scores(db: Session, ds: Dataset) -> dict:
    """Scores shown for a dataset: those of its current version."""
    return version_scores(db, ds.id, ds.version)
