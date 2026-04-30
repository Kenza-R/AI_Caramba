import os
import asyncio
import traceback
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
            await api.pool.conn.execute("UPDATE accounts SET locks='{}'")
            await api.pool.conn.commit()
        except Exception:
            pass

        username = os.getenv("TW_USER_1", "")
        password = os.getenv("TW_PASS_1", "")
        email = os.getenv("TW_EMAIL_1", "")
        email_password = os.getenv("TW_EMAIL_PASS_1", "")
        cookies = os.getenv("TW_COOKIES_1", "")  # "auth_token=xxx; ct0=xxx"

        if not username:
            raise RuntimeError("TW_USER_1 not set in .env")

        try:
            if cookies:
                # Cookie-based auth — bypasses Cloudflare login challenge
                await api.pool.add_account(
                    username, password, email, email_password,
                    cookies=cookies,
                )
            else:
                await api.pool.add_account(username, password, email, email_password)
                await api.pool.login_all()
        except Exception:
            pass  # already in pool from a previous run (twscrape persists to SQLite)

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


async def fetch_user_tweets(handle: str, limit: int = 3000) -> list[dict]:
    api = await _get_api()

    try:
        user = await api.user_by_login(handle)
    except Exception as e:
        print(f"[scraper] user_by_login FAILED: {e}")
        traceback.print_exc()
        raise
    if user is None:
        raise ValueError(f"Twitter user @{handle} not found")

    tweets: list[dict] = []
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

    return tweets


async def get_user_info(handle: str) -> dict:
    api = await _get_api()
    try:
        user = await api.user_by_login(handle)
    except Exception as e:
        print(f"[scraper] get_user_info user_by_login FAILED: {e}")
        traceback.print_exc()
        raise
    if user is None:
        raise ValueError(f"Twitter user @{handle} not found")
    return {
        "name": user.displayname,
        "handle": f"@{user.username}",
        "bio": user.rawDescription or "",
        "followers": user.followersCount or 0,
        "tweet_count": user.statusesCount or 0,
    }
