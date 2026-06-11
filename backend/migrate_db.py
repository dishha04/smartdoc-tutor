import asyncio
from sqlalchemy import text
from db import engine

async def migrate():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))
            print("Successfully added name and created_at columns to users table.")
        except Exception as e:
            print(f"Migration failed (maybe already exists?): {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
