"""
Remove the retired `submissions` storage bucket.

The rows that pointed at these files went with 005_drop_legacy_domain.sql, so
whatever is left here is unreachable. Supabase rejects direct deletes from
storage.objects, which is why this cannot live in the migration.

    backend/.venv/bin/python -m app.scripts.drop_legacy_bucket [--dry-run]

Safe to re-run: a bucket that is already gone is reported and skipped.
"""

import sys

from supabase import Client

from app.db.supabase import get_supabase

BUCKET = "submissions"


def list_files(db: Client, bucket: str, prefix: str = "", depth: int = 0) -> list[str]:
    """Storage lists one level at a time; a folder comes back with no `id`."""
    paths: list[str] = []
    for entry in db.storage.from_(bucket).list(prefix):
        path = f"{prefix}/{entry['name']}" if prefix else entry["name"]
        if entry.get("id") is None:
            if depth < 8:
                paths += list_files(db, bucket, path, depth + 1)
        else:
            paths.append(path)
    return paths


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    db = get_supabase()

    if not any(bucket.id == BUCKET for bucket in db.storage.list_buckets()):
        print(f"Bucket {BUCKET!r} is already gone — nothing to do.")
        return 0

    files = list_files(db, BUCKET)
    print(f"Bucket {BUCKET!r} holds {len(files)} file(s).")
    if dry_run:
        for path in files:
            print(f"  would delete {path}")
        return 0

    if files:
        db.storage.from_(BUCKET).remove(files)
        print(f"Deleted {len(files)} file(s).")
    db.storage.delete_bucket(BUCKET)
    print(f"Deleted bucket {BUCKET!r}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
