from fastapi import APIRouter, UploadFile, File, Form
from routes.inspect import analyze_image

router = APIRouter()

SEVERITY_RANK = {"none": 0, "low": 1, "medium": 2, "critical": 3}


def _largest_box_area(boxes: list) -> float:
    if not boxes:
        return 0.0
    return max((b["x2"] - b["x1"]) * (b["y2"] - b["y1"]) for b in boxes)


def _build_verdict(before: dict, after: dict) -> dict:
    before_found = before.get("defect_found", False)
    after_found = after.get("defect_found", False)

    before_area = _largest_box_area(before.get("bounding_boxes", []))
    after_area = _largest_box_area(after.get("bounding_boxes", []))
    area_change_pct = None
    if before_area > 0:
        area_change_pct = round(((after_area - before_area) / before_area) * 100, 1)
    elif after_area > 0:
        area_change_pct = 100.0

    if not before_found and not after_found:
        verdict, summary = "no_defect", "No defects detected in either image. Component remains healthy."
    elif not before_found and after_found:
        verdict, summary = "new_defect", f"A new {after.get('defect_type')} defect has appeared since the last inspection."
    elif before_found and not after_found:
        verdict, summary = "resolved", "The previously detected defect is no longer visible — likely repaired."
    else:
        before_rank = SEVERITY_RANK.get(before.get("severity"), 0)
        after_rank = SEVERITY_RANK.get(after.get("severity"), 0)
        if after_rank > before_rank:
            verdict, summary = "worsened", f"Severity escalated from {before.get('severity')} to {after.get('severity')}. Immediate attention recommended."
        elif after_rank < before_rank:
            verdict, summary = "improved", f"Severity reduced from {before.get('severity')} to {after.get('severity')} — likely after partial repair."
        elif area_change_pct is not None and area_change_pct > 15:
            verdict, summary = "worsened", f"Defect area has grown by {area_change_pct}% since the last inspection. Monitor closely."
        elif area_change_pct is not None and area_change_pct < -15:
            verdict, summary = "improved", f"Defect area has shrunk by {abs(area_change_pct)}% since the last inspection."
        else:
            verdict, summary = "stable", "Defect severity and size are essentially unchanged between inspections."

    return {
        "verdict": verdict,
        "summary": summary,
        "area_change_pct": area_change_pct,
        "severity_before": before.get("severity"),
        "severity_after": after.get("severity"),
    }


@router.post("/compare")
async def compare_images(
    before_file: UploadFile = File(...),
    after_file: UploadFile = File(...),
    component_name: str = Form(default="Unknown Component"),
):
    before_bytes = await before_file.read()
    after_bytes = await after_file.read()

    before_result = await analyze_image(before_bytes)
    after_result = await analyze_image(after_bytes)

    comparison = _build_verdict(before_result, after_result)

    return {
        "component_name": component_name,
        "before": before_result,
        "after": after_result,
        "comparison": comparison,
    }
