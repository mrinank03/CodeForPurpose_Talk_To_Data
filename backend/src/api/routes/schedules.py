import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.scheduler.metadata_db import get_db, NotebookSchedule
from src.scheduler.apscheduler_setup import add_job_to_scheduler, remove_job_from_scheduler

router = APIRouter()

class ScheduleCreate(BaseModel):
    notebook_id: str
    cron_expression: str
    recipient_emails: str
    timezone: str = "UTC"

class ScheduleResponse(ScheduleCreate):
    schedule_id: str
    enabled: bool

class ScheduleUpdate(BaseModel):
    cron_expression: Optional[str] = None
    recipient_emails: Optional[str] = None
    timezone: Optional[str] = None
    enabled: Optional[bool] = None

@router.post("/schedules", response_model=ScheduleResponse)
def create_schedule(req: ScheduleCreate, db: Session = Depends(get_db)):
    schedule_id = str(uuid.uuid4())
    schedule = NotebookSchedule(
        schedule_id=schedule_id,
        notebook_id=req.notebook_id,
        cron_expression=req.cron_expression,
        recipient_emails=req.recipient_emails,
        timezone=req.timezone,
        enabled=True
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    
    add_job_to_scheduler(schedule.schedule_id, schedule.notebook_id, schedule.cron_expression, schedule.recipient_emails)
    
    return {
        "schedule_id": schedule.schedule_id,
        "notebook_id": schedule.notebook_id,
        "cron_expression": schedule.cron_expression,
        "recipient_emails": schedule.recipient_emails,
        "timezone": schedule.timezone,
        "enabled": schedule.enabled
    }

@router.get("/schedules/notebook/{notebook_id}", response_model=List[ScheduleResponse])
def get_schedules_for_notebook(notebook_id: str, db: Session = Depends(get_db)):
    schedules = db.query(NotebookSchedule).filter(NotebookSchedule.notebook_id == notebook_id).all()
    return schedules

@router.put("/schedules/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(schedule_id: str, req: ScheduleUpdate, db: Session = Depends(get_db)):
    schedule = db.query(NotebookSchedule).filter(NotebookSchedule.schedule_id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
        
    if req.cron_expression is not None:
        schedule.cron_expression = req.cron_expression
    if req.recipient_emails is not None:
        schedule.recipient_emails = req.recipient_emails
    if req.timezone is not None:
        schedule.timezone = req.timezone
    if req.enabled is not None:
        schedule.enabled = req.enabled
        
    db.commit()
    db.refresh(schedule)
    
    # Update scheduler
    if schedule.enabled:
        add_job_to_scheduler(schedule.schedule_id, schedule.notebook_id, schedule.cron_expression, schedule.recipient_emails)
    else:
        remove_job_from_scheduler(schedule.schedule_id)
        
    return schedule

@router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: str, db: Session = Depends(get_db)):
    schedule = db.query(NotebookSchedule).filter(NotebookSchedule.schedule_id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
        
    db.delete(schedule)
    db.commit()
    
    remove_job_from_scheduler(schedule_id)
    return {"status": "deleted"}
