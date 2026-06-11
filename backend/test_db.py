import asyncio
from db import get_db, engine
from models.database import UserDB
from sqlalchemy.future import select

async def main():
    try:
        async for session in get_db():
            print("Session acquired!")
            result = await session.execute(select(UserDB))
            print("Query executed!")
            print("Users:", result.scalars().all())
            break
    except Exception as e:
        print("DB ERROR:", repr(e))

asyncio.run(main())
