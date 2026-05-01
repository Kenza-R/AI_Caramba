import json
import os
import re
import anthropic
from dotenv import load_dotenv
from models import Figure

load_dotenv()

client = anthropic.Anthropic(
    api_key=os.environ["LAVA_API_KEY"],
    base_url="https://api.lava.so",
)

TOPICS = [
    ("Immigration", "🌍"),
    ("Economy", "📊"),
    ("Climate", "🌡️"),
    ("Healthcare", "🏥"),
    ("Foreign Policy", "🌐"),
    ("Social Issues", "⚖️"),
    ("Media & Free Speech", "📰"),
]

SYSTEM_PROMPT = """You are an expert political analyst specializing in ideological drift analysis.
You analyze public figures' tweets to identify shifts in political positions over time.
You are precise, evidence-based, and never fabricate positions not supported by the data.
Always return valid JSON exactly matching the requested schema."""


def _sample_tweets(tweets: list[dict], max_tweets: int = 600) -> str:
    """
    Sample tweets evenly across the full time range.
    Filters out retweets, keeps originals only.
    Returns a formatted string of [DATE] text lines.
    """
    originals = [t for t in tweets if not t["is_retweet"] and t.get("lang", "en") == "en"]
    originals.sort(key=lambda x: x["date"])

    if len(originals) > max_tweets:
        step = len(originals) // max_tweets
        originals = originals[::step][:max_tweets]

    lines = []
    for t in originals:
        date = t["date"][:10]
        text = t["text"].replace("\n", " ")[:300]
        lines.append(f"[{date}] {text}")

    return "\n".join(lines)


def _build_prompt(handle: str, user_info: dict, tweets: list[dict]) -> str:
    sample = _sample_tweets(tweets)
    earliest = min(t["date"][:7] for t in tweets) if tweets else "unknown"
    latest = max(t["date"][:7] for t in tweets) if tweets else "unknown"

    return f"""Analyze the ideological evolution of @{handle} based on their tweet history.

SUBJECT INFO:
- Name: {user_info.get("name", handle)}
- Bio: {user_info.get("bio", "N/A")}
- Tweet range in this sample: {earliest} to {latest}
- Total tweets fetched: {len(tweets)}

TWEET SAMPLE ({min(600, len(tweets))} tweets, sampled evenly across full time range):
{sample}

---
Based on this data, produce a JSON object with EXACTLY this structure. Return ONLY the JSON, no markdown, no explanation:

{{
  "id": "<handle lowercased, spaces as dashes>",
  "name": "<full display name>",
  "handle": "@{handle}",
  "bio": "<1-2 sentence factual bio>",
  "image": "",
  "driftScore": <float 0.0-10.0, overall ideological drift magnitude>,
  "shiftIntensity": "<stable|moderate|significant>",
  "currentPosition": "<Far Left|Left|Center-Left|Center|Center-Right|Right|Far Right>",
  "driftDirection": "<Leftward|Rightward|Stable|Volatile>",
  "biggestShift": "<topic name of biggest single shift>",
  "biggestShiftScore": <float 0.0-10.0>,
  "positionScore2022": <int 0-100, 0=far left, 50=center, 100=far right, for the START of the dataset>,
  "positionScoreNow": <int 0-100, current position>,
  "confidencePercent": <int 0-100, how confident based on data quality>,
  "topics": [
    {{
      "topic": "Immigration",
      "icon": "🌍",
      "stance": "<specific current stance description based on actual tweets, 1-2 sentences>",
      "score": <int -10 to 10, -10=far left, 0=center, 10=far right>,
      "trend": "<right|left|stable>"
    }},
    {{
      "topic": "Economy",
      "icon": "📊",
      "stance": "<specific stance>",
      "score": <int>,
      "trend": "<right|left|stable>"
    }},
    {{
      "topic": "Climate",
      "icon": "🌡️",
      "stance": "<specific stance>",
      "score": <int>,
      "trend": "<right|left|stable>"
    }},
    {{
      "topic": "Healthcare",
      "icon": "🏥",
      "stance": "<specific stance>",
      "score": <int>,
      "trend": "<right|left|stable>"
    }},
    {{
      "topic": "Foreign Policy",
      "icon": "🌐",
      "stance": "<specific stance>",
      "score": <int>,
      "trend": "<right|left|stable>"
    }},
    {{
      "topic": "Social Issues",
      "icon": "⚖️",
      "stance": "<specific stance>",
      "score": <int>,
      "trend": "<right|left|stable>"
    }},
    {{
      "topic": "Media & Free Speech",
      "icon": "📰",
      "stance": "<specific stance>",
      "score": <int>,
      "trend": "<right|left|stable>"
    }}
  ],
  "shiftEvents": [
    {{
      "id": "event_1",
      "date": "<Month YYYY, e.g. Oct 2022>",
      "topic": "<topic name>",
      "magnitude": <float 1.0-10.0>,
      "direction": "<right|left>",
      "before": "<what their stance was before this event, based on tweets>",
      "fissure": "<the specific event or period that triggered the shift — quote or reference actual tweets if possible>",
      "after": "<what their stance became after>",
      "news": [
        {{"headline": "<a real or plausible related headline>", "source": "<news source name>"}}
      ]
    }}
  ],
  "synthesis": "<3-4 paragraph analytical narrative. Describe the arc of their ideological journey, specific turning points visible in the tweets, and what drives their positions today. Be specific — cite actual tweet patterns, dates, and observable shifts. No vague language.>"
}}

RULES:
- shiftEvents: include 2-5 events minimum. Only include events with clear evidence in the tweets.
- If a topic has no relevant tweets, set stance to "Limited public commentary on this topic." and score to 0.
- positionScore2022 should reflect the EARLIEST tweets in the dataset, not necessarily 2022.
- confidencePercent should be lower if the person rarely tweets about politics.
- Return ONLY valid JSON. No markdown fences."""


def analyze_tweets(handle: str, user_info: dict, tweets: list[dict]) -> Figure:
    prompt = _build_prompt(handle, user_info, tweets)

    message = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown fences if Claude adds them despite instructions
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    data = json.loads(raw)
    return Figure(**data)
