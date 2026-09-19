# AeroInspect — Complete Project Guide

A complete guide from zero to a working AI aircraft-inspection platform. Covers every feature, every
design decision and the reason behind it, with the real code. It is self-contained: you can paste it
into any AI chat and ask questions about the project without sharing the repository.

`PROJECT_REPORT.md` covers the hackathon context and problem statement in detail. This guide covers
building, running, understanding and changing the code.

**Repository:** https://github.com/keerthishree20/aerospace-inspection

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Why](#2-tech-stack--why)
3. [Project Setup from Scratch](#3-project-setup-from-scratch)
4. [Core Ideas in Plain Words](#4-core-ideas-in-plain-words)
5. [Project Structure](#5-project-structure)
6. [Database Design](#6-database-design)
7. [Choosing the Detector: YOLO or OpenRouter](#7-choosing-the-detector-yolo-or-openrouter)
8. [Local Detection with YOLOv8](#8-local-detection-with-yolov8)
9. [Severity and Compliance Rules](#9-severity-and-compliance-rules)
10. [Repair Times and Recommendations](#10-repair-times-and-recommendations)
11. [The OpenRouter Vision Fallback](#11-the-openrouter-vision-fallback)
12. [Single Inspection](#12-single-inspection)
13. [Batch Inspection](#13-batch-inspection)
14. [Before/After Comparison](#14-beforeafter-comparison)
15. [The AI Inspector Chat](#15-the-ai-inspector-chat)
16. [History and Fleet Dashboard](#16-history-and-fleet-dashboard)
17. [Training the Model](#17-training-the-model)
18. [API Reference](#18-api-reference)
19. [Configuration](#19-configuration)
20. [Testing](#20-testing)
21. [Known Limitations](#21-known-limitations)
22. [Troubleshooting](#22-troubleshooting)
23. [Complete Feature Summary](#23-complete-feature-summary)

---

## 1. Project Overview

AeroInspect finds **structural defects in aircraft components from photos** and says whether the part
may fly. Upload a picture and you get:
- the defect type: crack, corrosion, dent, surface damage or fastener damage,
- a severity: low, medium or critical,
- a compliance status: **airworthy**, **conditional** or **grounded**,
- bounding boxes around the defect,
- an estimated repair time and a maintenance recommendation,
- a chat assistant for follow-up questions.

It also compares before and after photos of the same part, keeps a history, and shows a fleet dashboard.

### The problem
Manual visual inspection in aircraft maintenance (MRO) misses a share of defects, classifies severity
inconsistently, and takes a long time per component. Built for the **Edge AI for Intelligent
Inspection & Defect Detection** hackathon category.

**Status:** working backend and frontend; 24 automated tests; OpenRouter path verified live on
2026-09-18. The trained model confuses corrosion with cracks (section 21). Not deployed.

---

## 2. Tech Stack & Why

| Technology | Role | Why We Chose It |
|---|---|---|
| **YOLOv8m** (ultralytics) | Defect detection | fast object detection with boxes; runs locally, no API cost |
| **OpenRouter** free vision models | Fallback and chat | works without the 148 MB model file; free |
| **FastAPI** | Backend | async, typed, automatic docs |
| **SQLAlchemy async + SQLite** | Database | no server needed |
| **Pillow** | Images | open and convert uploads |
| **Next.js 16 (App Router), Tailwind v4** | Frontend | five pages |
| **Recharts** | Dashboard | fleet charts |
| **Kaggle (T4 GPU) + Roboflow** | Training | free GPU and datasets |

### Why a trained YOLO model instead of a general AI model?
A detector trained on real aircraft damage runs locally in about half a second, gives bounding boxes,
and costs nothing per image. The original plan was Gemini Vision; the build moved to YOLOv8.

---

## 3. Project Setup from Scratch

### Backend (Python 3.12; the system `python3` here is 3.6)
```bash
git clone https://github.com/keerthishree20/aerospace-inspection.git
cd aerospace-inspection/backend
python3.12 -m venv venv
venv/bin/pip install -r requirements.txt       # ultralytics pulls PyTorch: several GB
cp .env.example .env                           # add OPENROUTER_API_KEY
venv/bin/uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd ../frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev                                    # http://localhost:3000
```

Try it with the photos in `sample_images/`.

### The model file
`backend/models/best.pt` (about 148 MB) is **not in the repository** (`*.pt` is gitignored). Without it,
detection uses OpenRouter. Train your own with `training/train.ipynb` (section 17) or copy it in.

---

## 4. Core Ideas in Plain Words

| Idea | Meaning |
|---|---|
| **Object detection** | finding things in an image and drawing a box around each |
| **Class** | what was found: crack, corrosion, dent, surface_damage, fastener_damage |
| **Confidence** | how sure the model is, 0 to 1 |
| **Severity** | how serious the defect is: low, medium, critical |
| **Compliance** | may the part fly? airworthy, conditional, grounded |
| **MRO** | maintenance, repair and overhaul |
| **AMM / SRM** | aircraft maintenance manual / structural repair manual |
| **NDT** | non-destructive testing (eddy current, ultrasonic) |

---

## 5. Project Structure

```
backend/
  main.py                 app, CORS (localhost:3000), routers under /api
  database.py             async engine, session, init_db()
  models/inspection.py    the Inspection table
  models/best.pt          trained weights (not in git)
  routes/
    inspect.py            /inspect, /inspect/batch, /inspections, /inspections/{id}, /stats
    compare.py            /compare with _build_verdict()
    chat.py               /chat
  services/
    yolo_service.py       local YOLOv8 inference, severity, compliance, repair info
    gemini_service.py     OpenRouter vision fallback (named for the original Gemini plan)
  tests/                  conftest.py, test_rules.py, test_api.py
  requirements.txt  requirements-dev.txt  .env.example
frontend/
  app/page.tsx            Inspect + chat
  app/batch/page.tsx      Batch
  app/compare/page.tsx    Compare
  app/history/page.tsx    History
  app/dashboard/page.tsx  Dashboard
  components/Sidebar.tsx
training/train.ipynb      Kaggle notebook
sample_images/            corroded_bolt.jpg, corroded_steel_paint.jpg
PROJECT_REPORT.md
```

---

## 6. Database Design

One table, `inspections` (`backend/models/inspection.py`):

| Column | Purpose |
|---|---|
| `id` | primary key |
| `component_name` | defaults to "Unknown Component" |
| `image_filename` | uploaded file name |
| `defect_found` | "True" / "False" |
| `defect_type` | crack, corrosion, dent, surface_damage, fastener_damage, none |
| `severity` | low, medium, critical, none |
| `location` | where on the image |
| `confidence` | percent |
| `recommendation` | maintenance action |
| `compliance_status` | airworthy, conditional, grounded |
| `raw_response` | the detector's raw output |
| `created_at` | timestamp |

---

## 7. Choosing the Detector: YOLO or OpenRouter

```python
async def analyze_image(image_bytes: bytes) -> dict:
    if yolo_service.is_available():               # does models/best.pt exist?
        return yolo_service.analyze_image_yolo(image_bytes)
    return await analyze_image_ai(image_bytes)    # OpenRouter fallback
```

Both return the same fields, so the rest of the app never knows which one ran.

---

## 8. Local Detection with YOLOv8

```python
def analyze_image_yolo(image_bytes):
    model = _load_model()                                  # loaded once, on first use
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    results = model.predict(image, conf=0.25, verbose=False)
    boxes = results[0].boxes
    if boxes is None or len(boxes) == 0:
        return {"defect_found": False, "severity": "none", "compliance_status": "airworthy", ...}
    best_idx = int(boxes.conf.argmax())                    # the most confident detection decides
    class_name = CLASS_NAMES[int(boxes.cls[best_idx])]
    severity = _severity(float(boxes.conf[best_idx]), class_name)
    compliance = _compliance(severity)
    # every detection becomes a box, with coordinates as fractions of the image size
    bounding_boxes = [{"class": ..., "confidence": ..., "x1": x1 / w, "y1": y1 / h, "x2": x2 / w, "y2": y2 / h}, ...]
```

- Detections below 25% confidence are ignored.
- Box coordinates are **fractions** (0–1), so the frontend can draw them at any image size.
- Inference takes about 0.5–0.7 s per image on a CPU.

---

## 9. Severity and Compliance Rules

```python
def _severity(confidence, class_name):
    if class_name in ("crack", "corrosion") or confidence > 0.8:
        return "critical"
    if confidence > 0.5:
        return "medium"
    return "low"

def _compliance(severity):
    if severity == "critical":
        return "grounded"
    if severity == "medium":
        return "conditional"
    return "airworthy"
```

| Condition | Severity | Compliance |
|---|---|---|
| crack or corrosion, any confidence | critical | grounded |
| any defect above 80% confidence | critical | grounded |
| above 50% | medium | conditional |
| otherwise | low | airworthy |
| nothing found | none | airworthy |

### Why cracks and corrosion always ground the part
It is a deliberate flight-safety choice: these defects can grow and fail catastrophically, so the
cautious answer is to ground and inspect. The trade-off: a **low-confidence misdetection** also grounds
the part (section 21).

---

## 10. Repair Times and Recommendations

| Defect | Estimated repair | Recommendation |
|---|---|---|
| crack | 48–72 hours | ground immediately; NDT, structural repair or panel replacement per AMM |
| corrosion | 24–48 hours | treat per AMM; remove affected material, treat and reseal; schedule depot maintenance |
| dent | 8–16 hours | measure depth and area; within SRM limits monitor, otherwise repair or replace |
| surface_damage | 4–8 hours | clean, inspect, apply protective coating; monitor next inspection |
| fastener_damage | 2–4 hours | replace fasteners immediately; inspect surrounding structure |

These live in `REPAIR_TIMES` and `RECOMMENDATIONS` in `yolo_service.py`.

---

## 11. The OpenRouter Vision Fallback

`services/gemini_service.py` sends the image to a free vision model on OpenRouter with a prompt that
asks for exactly the same JSON fields, and says "compliance must be grounded if severity is critical".

### An ordered list of models
```python
OPENROUTER_MODELS = os.getenv("OPENROUTER_MODELS",
    "qwen/qwen3.8-27b:free,inclusionai/ling-3.0-flash-vl:free,google/gemma-4-31b-it:free").split(",")
OPENROUTER_MODEL = OPENROUTER_MODELS[0]
FALLBACK = {"models": OPENROUTER_MODELS}

response = await client.chat.completions.create(model=OPENROUTER_MODEL, extra_body=FALLBACK, ...)
```

### Why a list?
- The original `nvidia/nemotron-nano-12b-v2-vl:free` was **withdrawn from OpenRouter**, which broke the
  fallback and the chat until 2026-09-18.
- Free models are often **rate-limited** (429). OpenRouter's fallback routing tries the next model in
  the list automatically.

Verified live: the corroded bolt sample was correctly identified as **corrosion** (the YOLO model calls
it a crack). Language-model severity varies between runs (medium, then critical, on the same photo),
so treat it as advisory.

---

## 12. Single Inspection

`POST /api/inspect` (form: `file`, optional `component_name`):
1. read the image,
2. `analyze_image()` (YOLO or OpenRouter),
3. save an `Inspection` row,
4. return every field plus `bounding_boxes` and the new `id`.

The **Inspect** page (`/`) shows the photo with boxes drawn over it, the verdict badges, the
recommendation, and a chat box for that inspection.

---

## 13. Batch Inspection

`POST /api/inspect/batch` takes several files, inspects and saves each, and returns the list with
totals, including how many were grounded. The **Batch** page shows a summary table.

---

## 14. Before/After Comparison

`POST /api/compare` (form: `before_file`, `after_file`, `component_name`) inspects both photos and
builds a verdict:

```python
SEVERITY_RANK = {"none": 0, "low": 1, "medium": 2, "critical": 3}

if not before_found and not after_found:  verdict = "no_defect"
elif not before_found and after_found:    verdict = "new_defect"
elif before_found and not after_found:    verdict = "resolved"
else:
    if after_rank > before_rank:          verdict = "worsened"
    elif after_rank < before_rank:        verdict = "improved"
    elif area_change_pct > 15:            verdict = "worsened"     # defect box grew
    elif area_change_pct < -15:           verdict = "improved"     # defect box shrank
    else:                                 verdict = "stable"
```

Area change is measured on the **largest bounding box** in each photo. The **Compare** page shows both
images side by side with the verdict and summary.

---

## 15. The AI Inspector Chat

`POST /api/chat` with `inspection_id`, `message` and `history`:
- loads the inspection from the database,
- builds a system prompt with its details (component, defect, severity, location, confidence,
  recommendation, compliance, date),
- tells the model to use aerospace MRO terms, answer in 2–4 sentences, and **prioritise conservative
  recommendations on safety**,
- sends it through OpenRouter with the same model fallback list.

The chat always needs an OpenRouter key, even when YOLO does the detection.

---

## 16. History and Fleet Dashboard

- `GET /api/inspections` lists all inspections; the **History** page shows them with severity and
  compliance badges.
- `GET /api/stats` counts defect types, severities and compliance statuses; the **Dashboard** page draws
  them with Recharts.

```python
severities = {"low": 0, "medium": 0, "critical": 0, "none": 0}
compliance = {"airworthy": 0, "conditional": 0, "grounded": 0}
```

---

## 17. Training the Model

`training/train.ipynb` runs on Kaggle's free T4 GPU:
1. download aircraft-damage datasets through **Roboflow** (needs a Roboflow API key),
2. merge them into the five classes,
3. augment,
4. train **YOLOv8m**,
5. evaluate, and download `best.pt`.

Copy `best.pt` to `backend/models/best.pt` and restart the backend.

---

## 18. API Reference

All routes are under `/api`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/inspect` | inspect one image and save |
| POST | `/inspect/batch` | inspect several images |
| GET | `/inspections` | past inspections |
| GET | `/inspections/{id}` | one inspection |
| GET | `/stats` | dashboard totals |
| POST | `/compare` | before and after, with a verdict |
| POST | `/chat` | ask about an inspection |

Interactive docs: http://localhost:8000/docs

---

## 19. Configuration

`backend/.env`:

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | chat always; detection when `best.pt` is absent |
| `OPENROUTER_MODELS` | ordered list of free vision models to try |
| `DATABASE_URL` | default `sqlite+aiosqlite:///./aerospace.db` |

`frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000`.

---

## 20. Testing

```bash
cd backend
venv/bin/pip install -r requirements-dev.txt
venv/bin/python -m pytest              # 24 tests; no key, no network, no model weights
```

| File | Covers |
|---|---|
| `test_rules.py` | cracks and corrosion always critical; confidence scaling; severity→compliance; repair info for every class; every comparison verdict; area change; the model fallback list |
| `test_api.py` | inspect and list, stats, compare, and chat (checking the inspection's details reach the model) with analysis and the model stubbed |

---

## 21. Known Limitations

- **The current weights confuse corrosion with cracks.** On both sample photos, which show corrosion,
  the model says crack with confidence around 0.40–0.46. Because cracks are always critical, both come
  back grounded. The likely cause is too few corrosion examples. **Retrain with more**, and check
  per-class precision and recall before trusting a verdict.
- **Retraining needs a GPU and your Kaggle and Roboflow accounts.** Meanwhile, moving `best.pt` aside
  makes the app use the OpenRouter models, which identified the sample as corrosion.
- **AI severity varies between runs.**
- **Not deployed.**

---

## 22. Troubleshooting

| Problem | Fix |
|---|---|
| every inspection fails with an auth error | no `best.pt`, so OpenRouter is used, and the key is missing |
| 429 "rate-limited upstream" | free models are busy; the fallback list usually covers it; retry |
| the first inspection is slow | YOLO loads on first use |
| CORS errors | the frontend must be on `http://localhost:3000` |
| `ultralytics` fails to install | it pulls PyTorch: use Python 3.12 and have several GB free |
| dashboard empty | it reads past inspections; run some first |

---

## 23. Complete Feature Summary

### All Features Built

| # | Feature | Type | Key Files |
|---|---|---|---|
| 1 | YOLOv8m local defect detection | AI | `yolo_service.py` |
| 2 | Bounding boxes as image fractions | AI | `yolo_service.py` |
| 3 | Severity and compliance rules | Safety | `yolo_service.py` |
| 4 | Repair times and recommendations | Domain | `yolo_service.py` |
| 5 | OpenRouter vision fallback with model list | AI | `gemini_service.py` |
| 6 | Single inspection with saved record | Backend | `routes/inspect.py` |
| 7 | Batch inspection | Backend / Frontend | `routes/inspect.py`, `app/batch` |
| 8 | Before/after degradation verdict | Backend / Frontend | `routes/compare.py`, `app/compare` |
| 9 | AI inspector chat | AI | `routes/chat.py` |
| 10 | Inspection history | Frontend | `app/history` |
| 11 | Fleet dashboard | Frontend | `app/dashboard` |
| 12 | Kaggle training notebook | ML | `training/train.ipynb` |
| 13 | Rule and API tests | Testing | `backend/tests/` |

### Data Flow Architecture

```
Browser (Next.js :3000)
  ├── Inspect / Batch ──► POST /api/inspect(/batch)
  │       └── analyze_image()
  │             ├── best.pt present ──► YOLOv8m (conf ≥ 0.25) ──► top detection
  │             └── otherwise ──► OpenRouter free vision models (fallback list)
  │       └── _severity() ──► _compliance() ──► repair time + recommendation
  │       └── save Inspection (SQLite) ──► JSON with bounding boxes
  ├── Compare ──► POST /api/compare ──► two analyses ──► _build_verdict()
  ├── Chat ──► POST /api/chat ──► inspection details as context ──► OpenRouter
  ├── History ──► GET /api/inspections
  └── Dashboard ──► GET /api/stats ──► Recharts
```

### Tech Stack at a Glance

```
AI:        YOLOv8m (ultralytics, local), OpenRouter free vision models (fallback + chat)
Backend:   FastAPI + SQLAlchemy async + SQLite + Pillow
Frontend:  Next.js 16 + Tailwind v4 + Recharts
Training:  Kaggle T4 GPU + Roboflow datasets
Testing:   pytest with stubbed analysis and model
```
