# Animalytics Farmer's Dashboard

Professional web dashboard for monitoring cattle health alerts and managing farm operations.

## Features

- **Home View**: Critical alerts, early warnings, herd status summary
- **Map View**: GPS visualization of all 247 cattle with color-coded health status
- **Analytics View**: Cost savings analysis, disease distribution, alert history
- **Worker Management**: Assign tasks, track worker locations, manage task queue
- **AI Photo Diagnosis**: Upload cow photos for instant AI diagnosis using Gemini
- **AI Assistant Chat**: Chat with Gemini, attach images, and get practical farm guidance

## Quick Start

### 1. Install Dependencies

```bash
pip install flask flask-cors requests
```

### 2. Start the API Server

```bash
cd backend
set GEMINI_API_KEY=your_real_google_ai_api_key  # Windows (current terminal)
python dashboard_api.py
```

Server starts on `http://localhost:5000`

### 3. Open Dashboard

Open your browser to: `http://localhost:5000`

## Architecture

```
Frontend (HTML/CSS/JS)
    ↓ HTTP requests
Backend API (Flask)
    ↓ reads
Data (alerts_data.json)
    ↑ written by
production_monitor.py (Edge AI system)
```

## API Endpoints

- `GET /api/herd-status` - Current herd summary
- `GET /api/critical-alerts` - All critical alerts (12h+ confirmed)
- `GET /api/early-warnings` - All early warnings (3h+ detected)
- `GET /api/map-data` - Cow positions and worker locations
- `GET /api/cow/<cow_id>` - Detailed cow information
- `GET /api/analytics` - Cost savings and disease statistics
- `POST /api/diagnose-photo` - AI photo diagnosis (Gemini)
- `POST /api/gemini-chat` - Gemini chat with optional image in each message
- `POST /api/assign-worker` - Assign worker to cow
- `POST /api/mark-treated` - Mark cow as treated

## Integration with Production Monitor

The dashboard reads alert data from `data/alerts_data.json`.

Your `production_monitor.py` should write alerts to this file:

```python
import json

# When alerts are generated
alert_data = {
    "critical_alerts": [...],
    "early_warnings": [...],
    "herd_summary": {...},
    "cow_positions": [...]
}

with open('../dashboard/data/alerts_data.json', 'w') as f:
    json.dump(alert_data, f, indent=2)
```

## Photo Diagnosis with Gemini

Upload a cow photo to get AI-powered diagnosis:

1. Click "Upload Photo for Diagnosis" on any cow
2. Select image file
3. Click "Analyze with AI"
4. Gemini analyzes for:
   - East Coast Fever symptoms
   - Mastitis indicators
   - Lameness issues
   - FMD signs
   - General health condition

## Gemini Assistant Chat

Use the Assistant tab to:

1. Ask free-form farm and cattle-health questions
2. Attach an image in the same chat message
3. Get practical action steps and follow-up guidance

The chat keeps recent conversation context and sends it to Gemini for more relevant responses.

## Dashboard Updates

- Auto-refreshes every 30 seconds
- Manual refresh: reload page
- Connection status indicator in header

## Design Philosophy

- Clean, professional interface (non-AI look)
- Alert-based (not live sensor streaming)
- Mobile-responsive
- Offline-capable (when integrated with production monitor)

## For Competition Demo

1. Start API server
2. Open dashboard
3. Show all 4 views
4. Demonstrate photo diagnosis
5. Show worker assignment
6. Highlight cost savings

## Troubleshooting

**Dashboard shows "No data":**

- Check `data/alerts_data.json` exists
- Verify API server is running on port 5000
- Check browser console for errors

**Photo diagnosis fails:**

- Set `GEMINI_API_KEY` before starting the server
- Check internet connection
- Ensure image is under 10MB

**Map not showing cows:**

- Verify cow_positions array has data
- Check browser console for canvas errors

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5 Canvas
- **Backend**: Flask (Python)
- **AI**: Google Gemini 1.5 Flash
- **Styling**: Custom CSS (professional, non-AI look)

---

**Built for Huawei Innovation Competition 2026**
