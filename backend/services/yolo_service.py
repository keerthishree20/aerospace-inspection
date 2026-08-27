import os
import io
import json
from pathlib import Path
from PIL import Image

MODEL_PATH = Path(__file__).parent.parent / "models" / "best.pt"

_model = None

def is_available() -> bool:
    return MODEL_PATH.exists()

def _load_model():
    global _model
    if _model is None:
        from ultralytics import YOLO
        _model = YOLO(str(MODEL_PATH))
    return _model

CLASS_NAMES = ["crack", "corrosion", "dent", "surface_damage", "fastener_damage"]

def _severity(confidence: float, class_name: str) -> str:
    if class_name in ("crack", "corrosion") or confidence > 0.8:
        return "critical"
    if confidence > 0.5:
        return "medium"
    return "low"

def _compliance(severity: str) -> str:
    if severity == "critical":
        return "grounded"
    if severity == "medium":
        return "conditional"
    return "airworthy"

REPAIR_TIMES = {
    "crack": "48-72 hours",
    "corrosion": "24-48 hours",
    "dent": "8-16 hours",
    "surface_damage": "4-8 hours",
    "fastener_damage": "2-4 hours",
}

RECOMMENDATIONS = {
    "crack": "Ground aircraft immediately. Perform NDT inspection, structural repair or panel replacement per AMM.",
    "corrosion": "Apply corrosion treatment per AMM. Remove affected material, treat and reseal. Schedule depot maintenance.",
    "dent": "Measure dent depth and area. If within limits per SRM, monitor. If exceeding limits, repair or replace panel.",
    "surface_damage": "Clean, inspect and apply protective coating. Monitor at next scheduled inspection.",
    "fastener_damage": "Replace damaged fasteners immediately. Inspect surrounding structure for stress damage.",
}

def analyze_image_yolo(image_bytes: bytes) -> dict:
    model = _load_model()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    results = model.predict(image, conf=0.25, verbose=False)
    boxes = results[0].boxes

    if boxes is None or len(boxes) == 0:
        return {
            "defect_found": False,
            "defect_type": "none",
            "severity": "none",
            "location": "No defects detected across the component surface",
            "confidence": 99,
            "recommendation": "Component is within acceptable limits. Continue scheduled maintenance.",
            "estimated_repair_time": "N/A",
            "compliance_status": "airworthy",
            "raw_response": "YOLO: no detections",
            "bounding_boxes": [],
        }

    # Pick the highest-confidence detection
    best_idx = int(boxes.conf.argmax())
    best_conf = float(boxes.conf[best_idx])
    best_cls = int(boxes.cls[best_idx])
    class_name = CLASS_NAMES[best_cls] if best_cls < len(CLASS_NAMES) else "surface_damage"

    severity = _severity(best_conf, class_name)
    compliance = _compliance(severity)

    # Build bounding boxes for all detections
    bounding_boxes = []
    w, h = image.size
    for i in range(len(boxes)):
        x1, y1, x2, y2 = boxes.xyxy[i].tolist()
        bounding_boxes.append({
            "class": CLASS_NAMES[int(boxes.cls[i])] if int(boxes.cls[i]) < len(CLASS_NAMES) else "surface_damage",
            "confidence": round(float(boxes.conf[i]) * 100, 1),
            "x1": round(x1 / w, 4),
            "y1": round(y1 / h, 4),
            "x2": round(x2 / w, 4),
            "y2": round(y2 / h, 4),
        })

    location = f"Detected at bounding box region ({int(boxes.xyxy[best_idx][0])},{int(boxes.xyxy[best_idx][1])}) — ({int(boxes.xyxy[best_idx][2])},{int(boxes.xyxy[best_idx][3])})"

    return {
        "defect_found": True,
        "defect_type": class_name,
        "severity": severity,
        "location": location,
        "confidence": round(best_conf * 100, 1),
        "recommendation": RECOMMENDATIONS.get(class_name, "Inspect and repair as required per AMM."),
        "estimated_repair_time": REPAIR_TIMES.get(class_name, "TBD"),
        "compliance_status": compliance,
        "raw_response": f"YOLO: {len(boxes)} detection(s)",
        "bounding_boxes": bounding_boxes,
    }
