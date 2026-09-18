import os
import sys
import tempfile
from pathlib import Path

import pytest

# The database engine is created when `database` is imported, and load_dotenv
# never overrides a variable that is already set, so pick the test database
# before anything imports the app.
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tempfile.mkdtemp(prefix='aero-test-')}/test.db"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from models.inspection import Base  # noqa: E402
from database import engine  # noqa: E402
from routes import compare, inspect  # noqa: E402


def finding(defect_type="corrosion", severity="critical", compliance="grounded", boxes=None, found=True):
    return {
        "defect_found": found,
        "defect_type": defect_type if found else "none",
        "severity": severity if found else "none",
        "location": "centre panel",
        "confidence": 90,
        "recommendation": "Inspect per AMM.",
        "estimated_repair_time": "24-48 hours",
        "compliance_status": compliance if found else "airworthy",
        "bounding_boxes": boxes or [],
        "raw_response": "stub",
    }


@pytest.fixture
def client():
    """A client on an empty database. Tests replace analyze_image as they need."""
    import asyncio

    async def reset():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(reset())
    with TestClient(main.app) as c:
        yield c


@pytest.fixture
def stub_analysis(monkeypatch):
    """Make every image analysis return the next result from a queue."""
    queue = []

    async def fake(image_bytes):
        return queue.pop(0)

    monkeypatch.setattr(inspect, "analyze_image", fake)
    monkeypatch.setattr(compare, "analyze_image", fake)
    return queue
