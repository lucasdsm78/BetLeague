from __future__ import annotations

import os


def load_nats_subjects(*, subject_prefix: str | None = None) -> list[str]:
    """Liste explicite de subjects JetStream pour BetLeague.

    Objectif:
    - éviter le wildcard `{prefix}.>` qui empêche une DLQ dans un stream séparé
    - garder une config simple et explicite (audit-friendly)

    Override possible via env:
      NATS_STREAM_SUBJECTS="betleague.league.* , betleague.ticket.*"

    Notes:
    - la DLQ (si stream séparé) utilise `{prefix}.dlq.>` et n'est volontairement pas dans cette liste.
    """
    if subject_prefix is None:
        subject_prefix = os.getenv("NATS_SUBJECT_PREFIX", "betleague")

    raw = os.getenv("NATS_STREAM_SUBJECTS", "").strip()
    if raw:
        parts = [p.strip() for p in raw.replace(";", ",").split(",")]
        return [p for p in parts if p]

    # Par défaut: on couvre uniquement les domains connus.
    return [
        f"{subject_prefix}.league.*",
        f"{subject_prefix}.ticket.*",
        f"{subject_prefix}.match.*",
    ]

