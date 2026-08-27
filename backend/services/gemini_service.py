import os
import json
import re
import base64
from openai import AsyncOpenAI
from PIL import Image
import io
from dotenv import load_dotenv

load_dotenv()

client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

INSPECTION_PROMPT = """
You are an expert aerospace MRO (Maintenance, Repair, Overhaul) engineer analyzing an aircraft component image.

Analyze this image for defects and return ONLY a valid JSON object with exactly these fields:

{
  "defect_found": true or false,
  "defect_type": "crack" | "corrosion" | "dent" | "discoloration" | "material_fatigue" | "none",
  "severity": "low" | "medium" | "critical" | "none",
  "location": "description of where the defect is on the component",
  "confidence": a number between 0 and 100,
  "recommendation": "specific maintenance action required",
  "estimated_repair_time": "estimated time in hours as a string",
  "compliance_status": "airworthy" | "conditional" | "grounded"
}

Rules:
- compliance_status must be "grounded" if severity is "critical"
- compliance_status must be "conditional" if severity is "medium"
- compliance_status must be "airworthy" if severity is "low" or "none"
- Be precise and professional in your analysis
- Return ONLY the JSON, no extra text
"""

async def analyze_image(image_bytes: bytes) -> dict:
    image = Image.open(io.BytesIO(image_bytes))

    img_buffer = io.BytesIO()
    fmt = image.format or "JPEG"
    image.save(img_buffer, format=fmt)
    img_b64 = base64.b64encode(img_buffer.getvalue()).decode("utf-8")
    mime = f"image/{fmt.lower()}"

    response = await client.chat.completions.create(
        model="nvidia/nemotron-nano-12b-v2-vl:free",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{img_b64}"}},
                    {"type": "text", "text": INSPECTION_PROMPT},
                ],
            }
        ],
    )

    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    result = json.loads(raw)
    result["raw_response"] = raw
    return result
