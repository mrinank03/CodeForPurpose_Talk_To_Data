from fastapi import APIRouter
from src.api.models import StoryRequest
from src.story.analyst_mode import run_story_mode

router = APIRouter()

@router.post("/story")
async def get_stories(req: StoryRequest):
    cards = await run_story_mode(req.session_id)
    return cards
