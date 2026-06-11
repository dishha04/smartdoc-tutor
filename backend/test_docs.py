import asyncio
from db import get_db, engine
from models.database import DocumentDB
from sqlalchemy.future import select

async def main():
    try:
        async for session in get_db():
            result = await session.execute(select(DocumentDB))
            docs = result.scalars().all()
            print("Documents in DB:")
            for d in docs:
                print(d.doc_id, d.filename)
            break
    except Exception as e:
        import traceback
        traceback.print_exc()

import sys
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
asyncio.run(main())
