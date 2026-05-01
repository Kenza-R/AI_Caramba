import os
import asyncio
from collections.abc import AsyncIterator, Callable
from dotenv import load_dotenv
import twscrape

load_dotenv()

_api: twscrape.API | None = None
_setup_lock = asyncio.Lock()


async def _get_api() -> twscrape.API:
    global _api
    async with _setup_lock:
        if _api is not None:
            return _api

        api = twscrape.API()

        # Clear stale rate-limit locks from previous sessions on startup
        try:
            await api.pool.reset_locks()
        except Exception:
            pass

        username = os.getenv("TW_USER_1", "")
        password = os.getenv("TW_PASS_1", "")
        email = os.getenv("TW_EMAIL_1", "")
        email_password = os.getenv("TW_EMAIL_PASS_1", "")
        cookies = os.getenv("TW_COOKIES_1", "")

        if not username:
            raise RuntimeError("TW_USER_1 not set in .env")

        try:
            if cookies:
                await api.pool.add_account(username, password, email, email_password, cookies=cookies)
            else:
                await api.pool.add_account(username, password, email, email_password)
                await api.pool.login_all()
        except Exception:
            pass  # already in pool

        accounts = await api.pool.get_all()
        active = [a for a in accounts if a.active]
        if not active:
            raise RuntimeError(
                "No active Twitter accounts. "
                "Set TW_COOKIES_1 in .env with 'auth_token=xxx; ct0=xxx' from your browser."
            )

        _api = api
        return _api


async def resolve_handle(query: str) -> str:
    return query.lstrip("@").strip()


async def _clear_locks() -> None:
    """Clear per-queue rate-limit locks so the account is immediately usable."""
    api = await _get_api()
    try:
        await api.pool.reset_locks()
    except Exception:
        pass


async def get_user_info(handle: str) -> dict:
    await _clear_locks()
    api = await _get_api()
    user = await api.user_by_login(handle)
    if user is None:
        raise ValueError(f"Twitter user @{handle} not found")
    return {
        "name": user.displayname,
        "handle": f"@{user.username}",
        "bio": user.rawDescription or "",
        "followers": user.followersCount or 0,
        "tweet_count": user.statusesCount or 0,
    }


async def fetch_user_tweets(
    handle: str,
    limit: int = 3000,
    on_progress: Callable[[int], None] | None = None,
) -> list[dict]:
    """
    Fetch up to `limit` tweets from a user's timeline.

    on_progress(n) is called each time a new tweet is fetched, so the
    caller can update a live progress counter.

    If rate-limited mid-scrape, returns whatever was collected so far
    (minimum MIN_TWEETS_FOR_ANALYSIS) rather than failing the whole job.
    """
    MIN_TWEETS_FOR_ANALYSIS = 50

    api = await _get_api()

    user = await api.user_by_login(handle)
    if user is None:
        raise ValueError(f"Twitter user @{handle} not found")

    tweets: list[dict] = []
    try:
        async for tweet in api.user_tweets(user.id, limit=limit):
            tweets.append({
                "id": str(tweet.id),
                "date": tweet.date.isoformat(),
                "text": tweet.rawContent,
                "likes": tweet.likeCount or 0,
                "retweets": tweet.retweetCount or 0,
                "replies": tweet.replyCount or 0,
                "views": tweet.viewCount or 0,
                "is_retweet": tweet.retweetedTweet is not None,
                "lang": tweet.lang or "en",
            })
            if on_progress:
                on_progress(len(tweets))
    except Exception as exc:
        # Mid-scrape failure — return what we have if it's enough
        if len(tweets) >= MIN_TWEETS_FOR_ANALYSIS:
            print(f"[scraper] stopped at {len(tweets)} tweets due to: {exc} — continuing with partial data")
        else:
            raise

    return tweets
