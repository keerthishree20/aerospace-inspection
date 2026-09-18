"""The rules that turn a detection into a verdict. No model is loaded."""

import pytest

from routes.compare import _build_verdict
from services import yolo_service
from services.gemini_service import FALLBACK, OPENROUTER_MODELS

from .conftest import finding


# ---- severity and compliance ------------------------------------------------


@pytest.mark.parametrize("defect", ["crack", "corrosion"])
def test_cracks_and_corrosion_are_always_critical(defect):
    """A deliberate safety rule: these ground the part whatever the confidence."""
    assert yolo_service._severity(0.26, defect) == "critical"


@pytest.mark.parametrize("confidence, expected", [(0.9, "critical"), (0.6, "medium"), (0.3, "low")])
def test_other_defects_scale_with_confidence(confidence, expected):
    assert yolo_service._severity(confidence, "dent") == expected


@pytest.mark.parametrize("severity, compliance", [("critical", "grounded"), ("medium", "conditional"),
                                                  ("low", "airworthy"), ("none", "airworthy")])
def test_severity_maps_to_compliance(severity, compliance):
    assert yolo_service._compliance(severity) == compliance


def test_every_class_has_a_repair_time_and_recommendation():
    for name in yolo_service.CLASS_NAMES:
        assert yolo_service.REPAIR_TIMES[name]
        assert yolo_service.RECOMMENDATIONS[name]


# ---- before and after comparison -------------------------------------------


BOX_SMALL = [{"x1": 0, "y1": 0, "x2": 10, "y2": 10}]
BOX_LARGE = [{"x1": 0, "y1": 0, "x2": 20, "y2": 10}]


@pytest.mark.parametrize("before, after, verdict", [
    (finding(found=False), finding(found=False), "no_defect"),
    (finding(found=False), finding(), "new_defect"),
    (finding(), finding(found=False), "resolved"),
    (finding(severity="medium"), finding(severity="critical"), "worsened"),
    (finding(severity="critical"), finding(severity="low"), "improved"),
    (finding(boxes=BOX_SMALL), finding(boxes=BOX_LARGE), "worsened"),
    (finding(boxes=BOX_LARGE), finding(boxes=BOX_SMALL), "improved"),
    (finding(boxes=BOX_SMALL), finding(boxes=BOX_SMALL), "stable"),
])
def test_comparison_verdicts(before, after, verdict):
    assert _build_verdict(before, after)["verdict"] == verdict


def test_area_change_is_reported_as_a_percentage():
    assert _build_verdict(finding(boxes=BOX_SMALL), finding(boxes=BOX_LARGE))["area_change_pct"] == 100.0


# ---- the OpenRouter fallback list ------------------------------------------


def test_openrouter_is_given_every_fallback_model():
    assert OPENROUTER_MODELS, "at least one model must be configured"
    assert FALLBACK == {"models": OPENROUTER_MODELS}
    assert "nvidia/nemotron-nano-12b-v2-vl:free" not in OPENROUTER_MODELS  # withdrawn from OpenRouter
