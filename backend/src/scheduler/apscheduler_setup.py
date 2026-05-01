import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from datetime import datetime

from src.scheduler.metadata_db import SessionLocal, NotebookSchedule
from src.notebooks.headless_runner import run_scheduled_notebook

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

async def job_wrapper(schedule_id: str, notebook_id: str, recipient_emails: str):
    logger.info(f"Running scheduled notebook {notebook_id} for schedule {schedule_id}")
    db = SessionLocal()
    try:
        # Update last_run_at
        schedule = db.query(NotebookSchedule).filter(NotebookSchedule.schedule_id == schedule_id).first()
        if schedule:
            schedule.last_run_at = datetime.utcnow()
            db.commit()
            
        await run_scheduled_notebook(notebook_id, recipient_emails)
    except Exception as e:
        logger.error(f"Failed to run scheduled notebook {notebook_id}: {e}")
    finally:
        db.close()

def init_scheduler():
    db = SessionLocal()
    try:
        schedules = db.query(NotebookSchedule).filter(NotebookSchedule.enabled == True).all()
        for s in schedules:
            add_job_to_scheduler(s.schedule_id, s.notebook_id, s.cron_expression, s.recipient_emails)
            
        scheduler.start()
        logger.info("APScheduler started.")
    except Exception as e:
        logger.error(f"Error initializing APScheduler: {e}")
    finally:
        db.close()

def add_job_to_scheduler(schedule_id: str, notebook_id: str, cron_expr: str, recipient_emails: str):
    # APScheduler supports crontab style with from_crontab
    try:
        trigger = CronTrigger.from_crontab(cron_expr)
        scheduler.add_job(
            job_wrapper,
            trigger=trigger,
            id=schedule_id,
            args=[schedule_id, notebook_id, recipient_emails],
            replace_existing=True
        )
        logger.info(f"Added job {schedule_id} with cron {cron_expr}")
    except Exception as e:
        logger.error(f"Failed to add job {schedule_id}: {e}")

def remove_job_from_scheduler(schedule_id: str):
    if scheduler.get_job(schedule_id):
        scheduler.remove_job(schedule_id)
        logger.info(f"Removed job {schedule_id}")
