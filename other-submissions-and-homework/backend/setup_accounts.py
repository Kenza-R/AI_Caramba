"""
One-time setup: add and verify Twitter accounts for twscrape.

Usage:
    python setup_accounts.py

This reads from .env and tries to log in each account.
Run this once before starting the server to pre-authenticate sessions.
"""

import asyncio
from dotenv import load_dotenv
import os
import twscrape

load_dotenv()


async def main():
    api = twscrape.API()

    added = 0
    for i in range(1, 6):
        username = os.getenv(f"TW_USER_{i}")
        password = os.getenv(f"TW_PASS_{i}")
        email = os.getenv(f"TW_EMAIL_{i}")
        email_password = os.getenv(f"TW_EMAIL_PASS_{i}", "")
        if username and password and email:
            print(f"Adding account: @{username}")
            await api.pool.add_account(username, password, email, email_password)
            added += 1

    if added == 0:
        print("No accounts found in .env — copy .env.example to .env and fill in credentials.")
        return

    print(f"\nLogging in {added} account(s)...")
    await api.pool.login_all()

    accounts = await api.pool.get_all()
    for acc in accounts:
        status = "✓ active" if acc.active else "✗ failed"
        print(f"  @{acc.username}: {status}")

    active = sum(1 for a in accounts if a.active)
    print(f"\n{active}/{len(accounts)} accounts ready.")

    if active == 0:
        print("\nAll logins failed. Common causes:")
        print("  - Wrong password or email")
        print("  - Account requires email verification — check inbox")
        print("  - Twitter rate-limited the login attempts — wait 15 min and retry")


if __name__ == "__main__":
    asyncio.run(main())
