# AeroInspect — Complete Project Guide

## Table of Contents
1. [What is AeroInspect?](#what-is-aeroinspect)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [Architecture](#architecture)
5. [Database Schema](#database-schema)
6. [Backend Deep Dive](#backend-deep-dive)
7. [Frontend Deep Dive](#frontend-deep-dive)
8. [API Reference](#api-reference)
9. [The Model and Retraining It](#the-model-and-retraining-it)
10. [Known Limitations](#known-limitations)
11. [Troubleshooting](#troubleshooting)

`PROJECT_REPORT.md` covers the problem, the hackathon context and the design decisions. This guide
covers running, understanding and changing the code.

---

## What is AeroInspect?

A web platform for inspecting aircraft components from photos. Upload a picture and it returns:
- the defect type: crack, corrosion, dent, surface damage or fastener damage,
- a severity: low, medium or critical,
- a compliance status: **airworthy**, **conditional** or **grounded**,
- bounding boxes around the defect,
- an estimated repair time and a maintenance recommendation.

It also compares before and after photos of one component, keeps an inspection history, shows a
fleet dashboard, and has a chat assistant for follow-up questions.

Detection runs on a custom-trained YOLOv8m model on the local machine. When no trained weights are
present, it falls back to a free vision model through OpenRouter.

---

## Quick Start

### Backend
The system `python3` here is 3.6, so use 3.12.

```bash
cd backend
python3.12 -m venv venv
venv/bin/pip install -r requirements.txt
```

Create `backend/.env`:
```
OPENROUTER_API_KEY=your_key_here
DATABASE_URL=sqlite+aiosqlite:///./aerospace.db
```

The OpenRouter key is needed for the chat assistant always, and for detection when `best.pt` is
absent.

```bash
venv/bin/uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev                  # http://localhost:3000
```

Try it with the photos in `sample_images/`.

---

## Core Concepts

### Object detection
YOLOv8 finds objects in an image and returns a class, a confidence from 0 to 1, and a bounding box
for each. Here the classes are the five defect types.

### Severity rule (`services/yolo_service.py`)
| condition | severity |
|---|---|
| class is crack or corrosion, or confidence above 0.8 | critical |
| confidence above 0.5 | medium |
| otherwise | low |

### Compliance rule
| severity | compliance |
|---|---|
| critical | grounded |
| medium | conditional |
| low or none | airworthy |

Every crack or corrosion detection is grounded, whatever its confidence. That is the cautious choice
for flight safety, and it also means a low-confidence misdetection grounds the part.

### Degradation verdict (`routes/compare.py`)
Comparing a before and an after photo produces one of: `no_defect`, `new_defect`, `resolved`,
`worsened`, `improved` or `stable`. It compares severity rank first, then the change in the largest
bounding box's area.

---

## Architecture

```
  Browser (Next.js 16, :3000)
   /  Inspect + chat     /batch     /compare     /history     /dashboard
         │ fetch NEXT_PUBLIC_API_URL
         ▼
  FastAPI (:8000)  main.py, CORS allows http://localhost:3000
   routes/inspect.py  ── analyze_image():
   routes/compare.py        models/best.pt present? ── yolo_service (local YOLOv8)
   routes/chat.py           otherwise              ── gemini_service (OpenRouter vision)
         │                  chat always            ── OpenRouter text
         ▼
  SQLite  aerospace.db   (SQLAlchemy async)
```

`services/gemini_service.py` is named for the original plan to use Gemini. It calls OpenRouter with
an ordered list of free vision models from `OPENROUTER_MODELS`, by default
`qwen/qwen3.8-27b:free`, then `inclusionai/ling-3.0-flash-vl:free`, then
`google/gemma-4-31b-it:free`. OpenRouter moves to the next one when a model is rate-limited or gone.
The original `nvidia/nemotron-nano-12b-v2-vl:free` was withdrawn, which broke chat and the fallback
inspection until 2026-09-18.

---

## Database Schema

One table, `inspections`, defined in `backend/models/inspection.py`:

| column | purpose |
|---|---|
| `id` | primary key |
| `component_name` | defaults to "Unknown Component" |
| `image_filename` | the uploaded file's name |
| `defect_found`, `defect_type`, `severity`, `location`, `confidence` | the detection |
| `recommendation`, `compliance_status` | the verdict |
| `raw_response` | the full result as JSON |
| `created_at` | timestamp |

---

## Backend Deep Dive

| file | purpose |
|---|---|
| `main.py` | the app, CORS, router mounting under `/api` |
| `database.py` | async engine and session |
| `routes/inspect.py` | single and batch inspection, history, stats |
| `routes/compare.py` | before and after comparison with `_build_verdict()` |
| `routes/chat.py` | the inspector chatbot, given the inspection's details as context |
| `services/yolo_service.py` | `is_available()`, lazy `_load_model()`, `analyze_image_yolo()`, severity, compliance, repair times, recommendations |
| `services/gemini_service.py` | the OpenRouter vision fallback, prompted to return the same JSON fields |

To change the rules, edit `_severity()`, `_compliance()`, `REPAIR_TIMES` and `RECOMMENDATIONS` in
`yolo_service.py`. The fallback's rules live in its prompt in `gemini_service.py`, so keep both in
step.

---

## Frontend Deep Dive

Next.js 16 with the App Router, Tailwind CSS v4 and Recharts.

| route | page |
|---|---|
| `/` | **Inspect.** Upload one image, see the result with bounding boxes, chat about it |
| `/batch` | upload several images and get a summary table with grounded and airworthy counts |
| `/compare` | before and after photos of the same component |
| `/history` | every past inspection with severity and compliance badges |
| `/dashboard` | fleet-wide compliance, severity and defect-type charts |

`components/Sidebar.tsx` is the persistent navigation.

---

## API Reference

All routes are under `/api`.

| method | path | purpose |
|---|---|---|
| `POST` | `/inspect` | inspect one image and save the result |
| `POST` | `/inspect/batch` | inspect several images |
| `GET` | `/inspections` | list past inspections |
| `GET` | `/inspections/{id}` | one inspection |
| `GET` | `/stats` | dashboard aggregates |
| `POST` | `/compare` | before and after images, returns both results and a verdict |
| `POST` | `/chat` | ask the assistant about an inspection |

Interactive docs are at http://localhost:8000/docs.

---

## The Model and Retraining It

`training/train.ipynb` is a Kaggle notebook. It downloads datasets through Roboflow, merges them into
the five classes, applies augmentation, trains YOLOv8m on a free T4 GPU, and evaluates it.

The trained `best.pt` is about 155 MB and is **not in the repository**, because `*.pt` is
gitignored. To use it, place it at `backend/models/best.pt` and restart the backend. Without it,
detection goes through OpenRouter.

To retrain:
1. Open `training/train.ipynb` on Kaggle with a GPU enabled.
2. Add a Roboflow API key where the notebook asks for one.
3. Run all cells and download `best.pt` from the output.
4. Copy it to `backend/models/best.pt`.

---

## Known Limitations

- **The current weights confuse corrosion with cracks.** On both sample photos, which show corrosion,
  the model says crack with confidence around 0.4 to 0.5. Because cracks are always critical, both
  come back grounded. The likely cause is too few corrosion examples. Retrain with more, and check
  per-class precision and recall before trusting a verdict.
- **Retraining needs a GPU and your Kaggle and Roboflow accounts**, so it cannot be done from the
  code alone. Until then, the OpenRouter fallback identified the corroded bolt sample as corrosion in
  live checks on 2026-09-18. To use it instead of the weights, move `backend/models/best.pt` aside.
- **Fallback verdicts vary between runs.** Two live runs on the same photo returned medium, then
  critical, severity. A language model is not deterministic, so treat its severity as advisory.
- **The chat assistant needs an OpenRouter key** even when local detection is used.
- **Not deployed.**

### Tests
`backend/tests/` has 24 tests: the severity and compliance rules, every comparison verdict, and the
inspect, stats, compare and chat routes with the image analysis and chat model stubbed. No key, no
network, no model weights:

```bash
cd backend
venv/bin/pip install -r requirements-dev.txt
venv/bin/python -m pytest
```

---

## Troubleshooting

### Every inspection fails with an authentication error
There is no `best.pt`, so the backend is using OpenRouter, and `OPENROUTER_API_KEY` is missing or
wrong in `backend/.env`.

### The first inspection is slow
The YOLO model loads on first use. Later inspections take about half a second each on a CPU.

### CORS errors in the browser
The backend allows only `http://localhost:3000`. Open the frontend on that address, or add yours to
`allow_origins` in `main.py`.

### `ultralytics` fails to install
It pulls in PyTorch, which is large. Make sure you are using Python 3.12 in the venv and have a few
gigabytes of free disk space.

### Charts on the dashboard are empty
They read from past inspections. Run a few inspections first.
