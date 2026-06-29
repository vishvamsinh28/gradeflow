from typing import Any

from supabase import Client


def log_audit(
    db: Client,
    *,
    owner_id: str,
    actor_id: str | None,
    entity_type: str,
    entity_id: str | None,
    action: str,
    details: dict[str, Any] | None = None,
) -> None:
    db.table("audit_logs").insert(
        {
            "owner_id": owner_id,
            "actor_id": actor_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "details": details or {},
        }
    ).execute()
