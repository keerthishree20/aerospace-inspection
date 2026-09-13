# AeroInspect — Edge AI for Intelligent Aircraft Inspection

AI-powered aircraft component inspection platform that detects structural defects (cracks, corrosion, dents, surface damage, fastener damage) from photos using a custom-trained YOLOv8 model, and assesses airworthiness compliance automatically.

Built for the **Edge AI for Intelligent Inspection & Defect Detection** hackathon category.

## What it does

Upload a photo of an aircraft component and get back:
- Defect type and severity (low / medium / critical)
- Compliance status: **airworthy**, **conditional**, or **grounded**
- Bounding boxes showing exactly where the defect is
- Estimated repair time and a maintenance recommendation
- A chat assistant to ask follow-up questions about the result

## Features

| Page | What it does |
|---|---|
| **Inspect** | Upload a single image, run AI inspection, chat with an AI inspector about the result |
| **Batch** | Upload multiple images at once, get a summary table with grounded/airworthy counts |
| **Compare** | Upload "before" and "after" photos of the same component to track defect degradation over time |
| **History** | Table of all past inspections with severity/compliance badges |
| **Dashboard** | Fleet-wide stats — compliance distribution, severity breakdown, defect type charts |

## Tech Stack

- **Frontend:** Next.js 16 (App Router) + Tailwind CSS v4 + Recharts
- **Backend:** FastAPI + SQLAlchemy (async) + SQLite
- **AI/ML:** Custom-trained YOLOv8m model (local inference, no API calls) with an OpenRouter vision-model fallback if no trained model is present
- **Training:** Kaggle GPU (T4), dataset sourced via Roboflow

## Project Structure

```
aerospace-inspection/
├── backend/
│   ├── main.py                 # FastAPI app entrypoint
│   ├── database.py             # SQLAlchemy async engine/session
│   ├── models/
│   │   ├── inspection.py       # Inspection DB model
│   │   └── best.pt             # Trained YOLOv8 weights (drop-in)
│   ├── routes/
│   │   ├── inspect.py          # /api/inspect, /api/inspect/batch, /api/inspections, /api/stats
│   │   ├── compare.py          # /api/compare (degradation tracking)
│   │   └── chat.py             # /api/chat (AI inspector chatbot)
│   ├── services/
│   │   ├── yolo_service.py     # Local YOLOv8 inference
│   │   └── gemini_service.py   # OpenRouter vision fallback
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # Inspect page
│   │   ├── batch/page.tsx      # Batch inspection page
│   │   ├── compare/page.tsx    # Degradation tracking page
│   │   ├── history/page.tsx    # Inspection history page
│   │   └── dashboard/page.tsx  # Fleet dashboard with charts
│   └── components/
│       └── Sidebar.tsx         # Persistent navigation sidebar
├── training/
│   └── train.ipynb             # Kaggle notebook: dataset download, merge, YOLOv8m training
└── sample_images/              # Real test images for demoing the model
```

## Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:
```
OPENROUTER_API_KEY=your_key_here   # only needed as fallback if models/best.pt is absent
DATABASE_URL=sqlite+aiosqlite:///./aerospace.db
```

Run the server:
```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Run the dev server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Model

The app uses a YOLOv8m model trained on real aircraft damage photos (crack, corrosion, dent, surface_damage, fastener_damage classes). Training was run on Kaggle's free T4 GPU — see `training/train.ipynb` for the full pipeline (dataset download via Roboflow, merging, augmentation, training, evaluation).

To use your own trained weights, drop a `best.pt` file into `backend/models/`. If absent, the backend automatically falls back to an OpenRouter vision model (`nvidia/nemotron-nano-12b-v2-vl:free`) so the app still works without local inference.

### Current status of the trained model

The trained `best.pt` is 155 MB and is **not in this repository**; `*.pt` is gitignored. A fresh clone runs on the OpenRouter fallback until you train with `training/train.ipynb` or supply weights.

Checked against the local weights on 2026-09-13:

| Check | Result |
|---|---|
| Weights load | yes, YOLOv8 detection model, the five classes above |
| Inference on CPU | 0.5 to 0.7 s per image |
| `sample_images/corroded_bolt.jpg` | detected as **crack**, confidence 0.40 |
| `sample_images/corroded_steel_paint.jpg` | detected as **crack**, confidence 0.46 |

Both sample photos show corrosion, and the model labels both as cracks with low confidence. Because `yolo_service.py` rates any crack or corrosion as critical regardless of confidence, both come back **grounded**. The class confusion points to too few corrosion examples in the merged training data; retraining with more of them, and checking per-class precision and recall on the validation split, is the next step before trusting a verdict.
