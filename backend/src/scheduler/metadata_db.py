import os
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Text, LargeBinary
from sqlalchemy.orm import declarative_base, sessionmaker

DATA_DB_DIR = os.getenv("DATA_DB_DIR", "./data_dbs/")
os.makedirs(DATA_DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DB_DIR, "system_metadata.db")

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class NotebookSchedule(Base):
    __tablename__ = "notebook_schedules"

    schedule_id = Column(String, primary_key=True, index=True)
    notebook_id = Column(String, index=True)
    cron_expression = Column(String) # e.g., "0 9 * * *"
    recipient_emails = Column(String) # comma-separated
    timezone = Column(String, default="UTC")
    enabled = Column(Boolean, default=True)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class EncryptedCredentials(Base):
    __tablename__ = "encrypted_credentials"

    connection_id = Column(String, primary_key=True, index=True) # Usually matches session_id
    session_id = Column(String, index=True)
    db_type = Column(String)
    encrypted_blob = Column(LargeBinary) # JSON dumped and encrypted
    created_at = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
