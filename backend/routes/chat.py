from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.inspection import Inspection
from services.gemini_service import FALLBACK, OPENROUTER_MODEL
from openai import AsyncOpenAI
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# Same as in gemini_service: a missing key must not break the import, since
# the YOLO inspection path works without one.
client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY") or "OPENROUTER_API_KEY-not-set",
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    inspection_id: int
    message: str
    history: list[ChatMessage] = []


@router.post("/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Inspection).where(Inspection.id == req.inspection_id))
    inspection = result.scalar_one_or_none()

    if not inspection:
        return {"response": "Inspection not found."}

    system_prompt = f"""You are an expert aerospace MRO (Maintenance, Repair, Overhaul) engineer and safety inspector.

You are analyzing the following inspection result and answering questions about it:

Component: {inspection.component_name}
Defect Found: {inspection.defect_found}
Defect Type: {inspection.defect_type}
Severity: {inspection.severity}
Location: {inspection.location}
Confidence: {inspection.confidence}%
Recommendation: {inspection.recommendation}
Compliance Status: {inspection.compliance_status}
Inspection Date: {inspection.created_at}

Answer questions about this specific inspection. Be precise, professional, and use aerospace MRO terminology.
Keep responses concise (2-4 sentences). If asked about safety, always prioritize conservative recommendations."""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in req.history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": req.message})

    response = await client.chat.completions.create(
        model=OPENROUTER_MODEL,
        extra_body=FALLBACK,
        messages=messages,
    )

    return {"response": response.choices[0].message.content}
