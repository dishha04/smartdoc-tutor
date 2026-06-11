import asyncio
from main import list_documents
from test_db import get_db

async def run():
    try:
        current_user = {"email": "test3@test.com", "user_id": "1038aa52-ad55-4a5d-9714-576176e4b3d5"}
        async for db in get_db():
            res = await list_documents(current_user, db)
            print("Documents returned:", res)
            break
    except Exception as e:
        import traceback
        traceback.print_exc()

import sys
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
asyncio.run(run())
