import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

from src.data.session_store import init_db
from src.api.routes import upload, query, story, sessions, connectors

load_dotenv()

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="DataLens", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS setup — supports comma-separated origins for local + production
allowed_origins_raw = os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup_event():
    init_db()
    # Ensure the data directory exists for mirrors
    os.makedirs(os.getenv("DATA_DB_DIR", "./data_dbs/"), exist_ok=True)

# Health check
@app.get("/health")
def health_check():
    return {"status": "ok"}

# Include routers
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(query.router, prefix="/api", tags=["Query"])
app.include_router(story.router, prefix="/api", tags=["Story"])
app.include_router(sessions.router, prefix="/api", tags=["Sessions"])
app.include_router(connectors.router, prefix="/api", tags=["Connectors"])

# Global exception handler to ensure CORS headers are sent even on crashes
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )

