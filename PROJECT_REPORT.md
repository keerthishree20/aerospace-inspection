# AeroInspect — Complete Project Report

**Project:** AeroInspect — Edge AI for Intelligent Aircraft Inspection  
**Category:** Edge AI for Intelligent Inspection & Defect Detection (Hackathon)  
**Date:** June 28, 2026  
**Team:** KeerthiShree TS  

---

## 1. Executive Summary

AeroInspect is an AI-powered aircraft component inspection platform that detects structural defects in aircraft parts from photos using a custom-trained YOLOv8 deep learning model. The system runs entirely offline (no cloud API required for inference), produces real-time bounding box overlays on detected defects, classifies severity, and determines airworthiness compliance automatically.

The platform replaces time-consuming manual visual inspection with instant AI-driven analysis, giving maintenance engineers actionable results in seconds.

---

## 2. Problem Statement

Aircraft maintenance engineers inspect thousands of components manually during every MRO (Maintenance, Repair & Overhaul) cycle. This process is:

- **Slow** — each component requires human expert review
- **Error-prone** — fatigue and inconsistency affect human inspection accuracy
- **Expensive** — delays ground aircraft, increasing operational costs
- **Not scalable** — fleet sizes are growing faster than qualified inspectors

AeroInspect automates visual defect detection, classifies severity, and determines airworthiness compliance instantly from a single photo.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER BROWSER                         │
│              Next.js Frontend (:3000)                   │
│   Inspect │ Batch │ Compare │ History │ Dashboard       │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP REST API
                      ▼
┌─────────────────────────────────────────────────────────┐
│              FastAPI Backend (:8000)                    │
│                                                         │
│  /api/inspect      → Single image inspection            │
│  /api/inspect/batch→ Multi-image inspection             │
│  /api/compare      → Before/after comparison            │
│  /api/chat         → AI chatbot                         │
│  /api/inspections  → History log                        │
│  /api/stats        → Fleet statistics                   │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐       ┌──────────────────────────┐
│  YOLOv8m Model   │       │    SQLite Database        │
│  (best.pt 149MB) │       │  (inspection history)     │
│  Local inference │       │  aiosqlite async ORM      │
│  No internet     │       │                          │
└──────────────────┘       └──────────────────────────┘
           │
           │ (fallback if best.pt missing)
           ▼
┌──────────────────────────┐
│  OpenRouter Vision API   │
│  nvidia/nemotron-nano    │
│  12b-v2-vl:free          │
└──────────────────────────┘
```

---

## 4. AI Model Details

| Property | Value |
|---|---|
| Architecture | YOLOv8m (medium variant) |
| Parameters | ~25.8 million |
| Weight file | `backend/models/best.pt` |
| File size | 149 MB |
| Training platform | Kaggle (T4 GPU) |
| Training time | ~12 hours |
| Dataset source | Roboflow (aircraft surface defect datasets) |
| Inference type | Local edge inference |
| Confidence threshold | 0.25 |
| Input | RGB images (any resolution) |
| Output | Bounding boxes with class + confidence scores |

### 4.1 Detectable Defect Classes

| Class | Severity | Compliance | Repair Time | Action |
|---|---|---|---|---|
| `crack` | Critical | Grounded | 48–72 hours | Immediate NDT + structural repair per AMM |
| `corrosion` | Critical | Grounded | 24–48 hours | Corrosion treatment, depot maintenance |
| `dent` | Medium | Conditional | 8–16 hours | Measure depth; repair if outside SRM limits |
| `surface_damage` | Low | Airworthy | 4–8 hours | Clean, inspect, apply protective coating |
| `fastener_damage` | Low–Medium | Conditional | 2–4 hours | Replace fasteners, inspect surrounding structure |

### 4.2 Severity → Compliance Logic

```
confidence > 0.8 OR class in (crack, corrosion)  →  critical  →  grounded
confidence > 0.5                                  →  medium    →  conditional
otherwise                                         →  low       →  airworthy
```

### 4.3 Training Pipeline

The model was trained using the Kaggle notebook at `training/train.ipynb`:

1. **Dataset download** — Roboflow API downloads aircraft defect datasets
2. **Dataset merge** — Images and labels merged into a unified YOLOv8 directory structure
3. **Augmentation** — Handled by Ultralytics built-in augmentation pipeline
4. **Training** — YOLOv8m trained for 30 epochs on T4 GPU
5. **Export** — `best.pt` (best validation mAP checkpoint) saved as output

---

## 5. Backend

### 5.1 Technology Stack

| Component | Technology | Version |
|---|---|---|
| Web framework | FastAPI | 0.136.3 |
| ASGI server | Uvicorn | 0.49.0 |
| ORM | SQLAlchemy (async) | 2.0.50 |
| Database driver | aiosqlite | 0.22.1 |
| ML inference | Ultralytics (YOLO) | 8.4.67 |
| Image processing | Pillow | 12.2.0 |
| AI fallback | OpenAI SDK (OpenRouter) | 2.41.1 |
| Environment | python-dotenv | 1.2.2 |
| File uploads | python-multipart | 0.0.32 |

### 5.2 API Endpoints

#### `POST /api/inspect`
Single image inspection. Returns defect type, severity, compliance status, repair time, recommendation, and bounding boxes.

**Request:** `multipart/form-data` — `file` (image), `component_name` (string)

**Response:**
```json
{
  "id": 1,
  "component_name": "Left Wing Panel",
  "defect_found": true,
  "defect_type": "crack",
  "severity": "critical",
  "confidence": 87.3,
  "compliance_status": "grounded",
  "estimated_repair_time": "48-72 hours",
  "recommendation": "Ground aircraft immediately. Perform NDT inspection...",
  "bounding_boxes": [
    { "class": "crack", "confidence": 87.3, "x1": 0.12, "y1": 0.34, "x2": 0.45, "y2": 0.67 }
  ],
  "created_at": "2026-06-28 10:30:00"
}
```

#### `POST /api/inspect/batch`
Upload multiple images at once. Returns summary with grounded count + individual results for each image.

#### `POST /api/compare`
Upload "before" and "after" photos of the same component. Returns degradation verdict.

**Verdicts:** `worsened` | `improved` | `stable` | `resolved` | `new_defect` | `no_defect`

**Degradation logic:**
- Severity rank comparison (none=0, low=1, medium=2, critical=3)
- Bounding box area change percentage (>15% growth = worsened, >15% shrink = improved)

#### `POST /api/chat`
AI chatbot endpoint. Takes a message + previous inspection context, returns maintenance advice.

#### `GET /api/inspections`
Full paginated history of all past inspections ordered by date descending.

#### `GET /api/stats`
Fleet-wide aggregated statistics: total inspections, defect type breakdown, severity distribution, compliance distribution.

### 5.3 Database Schema

```sql
CREATE TABLE inspections (
    id               INTEGER PRIMARY KEY,
    component_name   TEXT,
    image_filename   TEXT,
    defect_found     TEXT,
    defect_type      TEXT,
    severity         TEXT,
    location         TEXT,
    confidence       REAL,
    recommendation   TEXT,
    compliance_status TEXT,
    raw_response     TEXT,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5.4 File Structure

```
backend/
├── main.py                  # FastAPI app, CORS, router registration
├── database.py              # SQLAlchemy async engine + session factory
├── requirements.txt         # Python dependencies
├── .env                     # Environment variables
├── aerospace.db             # SQLite database (auto-created)
├── models/
│   ├── inspection.py        # SQLAlchemy ORM model
│   └── best.pt              # YOLOv8m trained weights (149 MB)
├── routes/
│   ├── inspect.py           # /inspect, /inspect/batch, /inspections, /stats
│   ├── compare.py           # /compare (degradation tracking)
│   └── chat.py              # /chat (AI inspector chatbot)
└── services/
    ├── yolo_service.py      # Local YOLOv8 inference logic
    └── gemini_service.py    # OpenRouter vision fallback
```

---

## 6. Frontend

### 6.1 Technology Stack

| Component | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.9 |
| UI library | React | 19.2.4 |
| Styling | Tailwind CSS | v4 |
| Charts | Recharts | 3.8.1 |
| Language | TypeScript | — |

### 6.2 Pages

#### `/` — Inspect Page
- Image upload with drag-and-drop
- Component name input
- AI inspection trigger
- Results card: defect type, severity badge, compliance status, repair time, recommendation
- Bounding box overlay drawn on the uploaded image using canvas coordinates
- Chat assistant panel — ask follow-up questions about the result

#### `/batch` — Batch Inspection
- Multi-file upload (select multiple images)
- Runs inspection on all images in sequence
- Summary bar: total images, grounded count
- Results table: filename, defect type, severity badge, confidence %, compliance, repair time

#### `/compare` — Degradation Tracking
- Two upload panels: Before / After
- Runs YOLO on both images independently
- Displays side-by-side results with bounding box overlays
- Verdict banner: color-coded by outcome (red=worsened, green=improved, amber=stable)
- Shows defect area change percentage

#### `/history` — Inspection History
- Table of all past inspections (from SQLite)
- Columns: ID, component name, file, defect type, severity, compliance, confidence, date
- Color-coded severity and compliance badges

#### `/dashboard` — Fleet Dashboard
- Stat cards: total inspections, grounded count, critical defects, airworthy count
- Donut chart: compliance distribution (airworthy / conditional / grounded)
- Bar chart: severity breakdown (low / medium / critical)
- Bar chart: defect type frequency
- Line chart: inspections over time
- All charts powered by Recharts with aerospace color theme

### 6.3 UI Design

- **Theme:** Dark aerospace (slate-950 background, slate-900 cards, slate-800 borders)
- **Accent:** Cyan-to-blue gradient for primary actions
- **Severity colors:** emerald (low), amber (medium), red (critical)
- **Sidebar:** Persistent left navigation (w-60), SVG icons, active route highlighting
- **Status badge:** Pulsing emerald dot — "YOLOv8 Model Active · Local inference · No API calls"

### 6.4 File Structure

```
frontend/
├── app/
│   ├── layout.tsx           # Root layout with Sidebar
│   ├── page.tsx             # Inspect page (330 lines)
│   ├── globals.css          # Tailwind v4 import + theme fonts
│   ├── batch/page.tsx       # Batch inspection (199 lines)
│   ├── compare/page.tsx     # Degradation tracking (211 lines)
│   ├── history/page.tsx     # Inspection history (101 lines)
│   └── dashboard/page.tsx   # Fleet dashboard (238 lines)
├── components/
│   └── Sidebar.tsx          # Navigation sidebar (100 lines)
├── next.config.ts           # Turbopack cache disabled
├── package.json
└── .env.local               # NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 7. Codebase Metrics

| Layer | Files | Lines of Code |
|---|---|---|
| Backend routes | 3 | 313 |
| Backend services | 2 | 179 |
| Frontend pages | 5 | 1,079 |
| Frontend components | 1 | 100 |
| Config / setup | 4 | ~50 |
| **Total** | **15** | **~1,721** |

---

## 8. Setup & Running

### Prerequisites
- Python 3.10+
- Node.js 18+
- `backend/models/best.pt` (trained model weights)

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:
```
OPENROUTER_API_KEY=your_key_here
DATABASE_URL=sqlite+aiosqlite:///./aerospace.db
```

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

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 9. Key Technical Decisions

| Decision | Reason |
|---|---|
| YOLOv8m over YOLOv8s | Better accuracy for small defect detection; still fast enough for real-time inference |
| Local inference over cloud API | No latency, no cost per call, works offline on an air-gapped maintenance floor |
| SQLite over PostgreSQL | Zero-setup, portable, sufficient for single-station inspection kiosk use case |
| SQLAlchemy async | Non-blocking I/O — backend handles concurrent inspections without stalling |
| Tailwind CSS v4 | Latest cascade layer model; CSS `@import "tailwindcss"` instead of PostCSS plugin |
| Turbopack cache disabled | Next.js 16 Turbopack filesystem cache caused stale CSS after hot reload; disabled via `turbopackFileSystemCacheForDev: false` |
| Fallback to OpenRouter | Allows the app to run in demo mode even without the 149 MB model file |

---

## 10. Challenges & Solutions

| Challenge | Solution |
|---|---|
| Roboflow dataset version not found | Used `project.versions()[-1].version` to auto-detect latest available version |
| Kaggle browser session dying during training | Used "Save & Run All (Commit)" to run as a proper background job |
| Disk full during `pip install ultralytics` | Freed ~10 GB by deleting extracted Kaggle output zip before installing |
| Dark theme not rendering (white background) | Removed unlayered plain CSS from `globals.css` that overrode Tailwind v4's layered utility classes |
| Stale CSS after process restart | Discovered Turbopack filesystem cache (enabled by default in Next.js 16.1.0+); disabled via config |
| Wrong app on port 3000 | ResumeCraft project's zombie process grabbed port 3000; killed with `fuser -k 3000/tcp` |
| Model not detecting whole-aircraft photos | Domain mismatch — model trained on close-up MRO surface photos; works on close-up defect images |

---

## 11. Sample Test Images

Located in `sample_images/`:

| File | Description | Detection Result |
|---|---|---|
| `corroded_bolt.jpg` | Close-up corrosion on metal fastener | crack — 40.1% confidence |
| `corroded_steel_paint.jpg` | Corroded steel surface with paint flaking | crack — 45.9% confidence |

---

## 12. Future Enhancements

| Feature | Impact | Effort |
|---|---|---|
| PDF report export | High — printable inspection certificate | Medium |
| Live camera inspection | High — real-time defect detection from webcam | Medium |
| Component lifecycle tracker | High — per-part inspection timeline | Medium |
| Priority repair queue | Medium — rank defects by urgency | Low |
| CSV export for history | Medium — spreadsheet integration | Low |
| Email/Slack alerts on critical finds | Medium — automated notifications | Low |
| Confidence heatmap overlay | Medium — visual explainability | High |

---

## 13. Conclusion

AeroInspect demonstrates that Edge AI can be practically applied to aviation maintenance — running a 25.8M parameter neural network entirely on a local server, detecting 5 classes of structural defects in real time, with a full-stack web interface for maintenance crews. The system is production-ready at the prototype level, with a clean REST API, persistent inspection history, and a professional aerospace-themed UI.

---

*Generated: 2026-06-28 | Project path: `/home/harikishan/KEERTHISHREE/dev/aerospace-inspection/`*
