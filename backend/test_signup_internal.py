import asyncio
from main import signup
from models.user import UserCreate
from test_db import get_db

async def run():
    try:
        user = UserCreate(email="test3@test.com", password="password123")
        async for db in get_db():
            res = await signup(user, db)
            print("Signup returned:", res)
            break
    except Exception as e:
        import traceback
        traceback.print_exc()

import sys
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
asyncio.run(run())
