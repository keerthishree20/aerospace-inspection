from fastapi import APIRouter, UploadFile, File, Form, Depends
from typing import List
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.inspection import Inspection
from services.gemini_service import analyze_image as analyze_image_ai
from services import yolo_service

async def analyze_image(image_bytes: bytes) -> dict:
    if yolo_service.is_available():
        return yolo_service.analyze_image_yolo(image_bytes)
    return await analyze_image_ai(image_bytes)

router = APIRouter()

@router.post("/inspect")
async def inspect_component(
    file: UploadFile = File(...),
    component_name: str = Form(default="Unknown Component"),
    db: AsyncSession = Depends(get_db)
):
    image_bytes = await file.read()

    result = await analyze_image(image_bytes)

    inspection = Inspection(
        component_name=component_name,
        image_filename=file.filename,
        defect_found=str(result.get("defect_found", False)),
        defect_type=result.get("defect_type", "none"),
        severity=result.get("severity", "none"),
        location=result.get("location", ""),
        confidence=result.get("confidence", 0),
        recommendation=result.get("recommendation", ""),
        compliance_status=result.get("compliance_status", "airworthy"),
        raw_response=result.get("raw_response", ""),
    )

    db.add(inspection)
    await db.commit()
    await db.refresh(inspection)

    return {
        "id": inspection.id,
        "component_name": inspection.component_name,
        "defect_found": result.get("defect_found"),
        "defect_type": result.get("defect_type"),
        "severity": result.get("severity"),
        "location": result.get("location"),
        "confidence": result.get("confidence"),
        "recommendation": result.get("recommendation"),
        "estimated_repair_time": result.get("estimated_repair_time"),
        "compliance_status": result.get("compliance_status"),
        "bounding_boxes": result.get("bounding_boxes", []),
        "created_at": str(inspection.created_at),
    }


@router.post("/inspect/batch")
async def inspect_batch(
    files: List[UploadFile] = File(...),
    component_name: str = Form(default="Unknown Component"),
    db: AsyncSession = Depends(get_db)
):
    results = []
    for file in files:
        image_bytes = await file.read()
        result = await analyze_image(image_bytes)

        inspection = Inspection(
            component_name=component_name,
            image_filename=file.filename,
            defect_found=str(result.get("defect_found", False)),
            defect_type=result.get("defect_type", "none"),
            severity=result.get("severity", "none"),
            location=result.get("location", ""),
            confidence=result.get("confidence", 0),
            recommendation=result.get("recommendation", ""),
            compliance_status=result.get("compliance_status", "airworthy"),
            raw_response=result.get("raw_response", ""),
        )
        db.add(inspection)
        await db.commit()
        await db.refresh(inspection)

        results.append({
            "id": inspection.id,
            "component_name": inspection.component_name,
            "image_filename": file.filename,
            "defect_found": result.get("defect_found"),
            "defect_type": result.get("defect_type"),
            "severity": result.get("severity"),
            "location": result.get("location"),
            "confidence": result.get("confidence"),
            "recommendation": result.get("recommendation"),
            "estimated_repair_time": result.get("estimated_repair_time"),
            "compliance_status": result.get("compliance_status"),
            "bounding_boxes": result.get("bounding_boxes", []),
            "created_at": str(inspection.created_at),
        })

    return {
        "total": len(results),
        "grounded_count": sum(1 for r in results if r["compliance_status"] == "grounded"),
        "results": results,
    }


@router.get("/inspections")
async def get_inspections(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Inspection).order_by(Inspection.created_at.desc()))
    inspections = result.scalars().all()
    return [
        {
            "id": i.id,
            "component_name": i.component_name,
            "image_filename": i.image_filename,
            "defect_type": i.defect_type,
            "severity": i.severity,
            "compliance_status": i.compliance_status,
            "confidence": i.confidence,
            "recommendation": i.recommendation,
            "created_at": str(i.created_at),
        }
        for i in inspections
    ]


@router.get("/inspections/{inspection_id}")
async def get_inspection(inspection_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Inspection).where(Inspection.id == inspection_id))
    inspection = result.scalar_one_or_none()
    if not inspection:
        return JSONResponse(status_code=404, content={"error": "Inspection not found"})
    return {
        "id": inspection.id,
        "component_name": inspection.component_name,
        "image_filename": inspection.image_filename,
        "defect_found": inspection.defect_found,
        "defect_type": inspection.defect_type,
        "severity": inspection.severity,
        "location": inspection.location,
        "confidence": inspection.confidence,
        "recommendation": inspection.recommendation,
        "compliance_status": inspection.compliance_status,
        "created_at": str(inspection.created_at),
    }


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Inspection))
    inspections = result.scalars().all()
    total = len(inspections)
    defect_types = {}
    severities = {"low": 0, "medium": 0, "critical": 0, "none": 0}
    compliance = {"airworthy": 0, "conditional": 0, "grounded": 0}

    for i in inspections:
        defect_types[i.defect_type] = defect_types.get(i.defect_type, 0) + 1
        if i.severity in severities:
            severities[i.severity] += 1
        if i.compliance_status in compliance:
            compliance[i.compliance_status] += 1

    return {
        "total_inspections": total,
        "defect_types": defect_types,
        "severities": severities,
        "compliance": compliance,
    }
