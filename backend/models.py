from pydantic import BaseModel
from typing import Optional, Literal


class NewsItem(BaseModel):
    headline: str
    source: str


class ShiftEvent(BaseModel):
    id: str
    date: str
    topic: str
    magnitude: float
    direction: Literal["right", "left"]
    before: str
    fissure: str
    after: str
    news: list[NewsItem] = []


class TopicStance(BaseModel):
    topic: str
    icon: str
    stance: str
    score: int
    trend: Literal["right", "left", "stable"]


class Figure(BaseModel):
    id: str
    name: str
    handle: str
    bio: str
    image: str = ""
    driftScore: float
    shiftIntensity: Literal["stable", "moderate", "significant"]
    currentPosition: str
    driftDirection: str
    biggestShift: str
    biggestShiftScore: float
    positionScore2022: int
    positionScoreNow: int
    confidencePercent: int
    topics: list[TopicStance]
    shiftEvents: list[ShiftEvent]
    synthesis: str


class AnalysisJob(BaseModel):
    job_id: str
    status: Literal["queued", "scraping", "analyzing", "done", "error"]
    step: int = 0
    tweet_count: int = 0
    result: Optional[Figure] = None
    error: Optional[str] = None
