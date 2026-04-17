# Background scheduler that periodically re-syncs mirrored tables.
# Uses APScheduler. One global scheduler instance for the whole app.
# Each connector session registers its own sync job here.

import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from src.connectors.connector_registry import get as get_connector

logger = logging.getLogger(__name__)

# One scheduler for the entire app lifecycle
_scheduler = BackgroundScheduler()
_scheduler.start()


def _run_sync_for_session(session_id: str) -> None:
    # This function is called by the scheduler every 60 seconds for each active session.
    from src.connectors.mirror_manager import sync_table_if_changed

    connector = get_connector(session_id)
    if connector is None:
        return

    for table in connector.mirrored_tables:
        try:
            sync_table_if_changed(
                session_id,
                connector.db_type,
                connector.host,
                connector.port,
                connector.database,
                connector.username,
                connector.password,
                table,
            )
        except Exception as e:
            logger.error(f"Sync failed for session {session_id}, table {table}: {e}")

    connector.last_synced_at = datetime.utcnow().isoformat()


def register_sync_job(session_id: str) -> str:
    # Registers a recurring sync job for the given session.
    # Returns the job ID so it can be cancelled later.
    job = _scheduler.add_job(
        func=_run_sync_for_session,
        trigger=IntervalTrigger(seconds=60),
        args=[session_id],
        id=f"sync_{session_id}",
        replace_existing=True,
    )
    logger.info(f"Registered sync job {job.id} for session {session_id}")
    return job.id


def cancel_sync_job(session_id: str) -> None:
    job_id = f"sync_{session_id}"
    if _scheduler.get_job(job_id):
        _scheduler.remove_job(job_id)
        logger.info(f"Cancelled sync job {job_id}")
