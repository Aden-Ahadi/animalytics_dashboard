"""
Animalytics Dashboard API Server
Serves alert data and health summaries to web dashboard
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime
import requests
import base64

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.normpath(os.path.join(BASE_DIR, '..', 'data', 'alerts_data.json'))
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '').strip()
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-flash-lite-latest').strip()
GEMINI_FALLBACK_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash'
]
GEMINI_API_URL_TEMPLATE = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'


def call_gemini_with_fallback(gemini_request):
    """Call Gemini with model fallback for unavailable or rate-limited models."""
    candidate_models = [GEMINI_MODEL] + [m for m in GEMINI_FALLBACK_MODELS if m != GEMINI_MODEL]
    response = None
    model_used = None
    tried_models = []
    network_errors = []

    for model_name in candidate_models:
        model_used = model_name
        try:
            response = requests.post(
                GEMINI_API_URL_TEMPLATE.format(model=model_name),
                json=gemini_request,
                headers={"x-goog-api-key": GEMINI_API_KEY},
                timeout=30
            )
        except requests.exceptions.RequestException as exc:
            network_errors.append(f"{model_name}: {str(exc)}")
            continue

        tried_models.append(f"{model_name}:{response.status_code}")

        if response.status_code not in (404, 429):
            break

    if response is None:
        if network_errors:
            return {
                "success": False,
                "status_code": 503,
                "error": (
                    "Gemini is unreachable right now. Please check internet/DNS access on this machine "
                    "and try again."
                )
            }
        return {
            "success": False,
            "status_code": 500,
            "error": "Gemini request did not return a response."
        }

    if response.status_code == 200:
        return {
            "success": True,
            "status_code": 200,
            "model": model_used,
            "result": response.json()
        }

    if response.status_code in (404, 429):
        status_text = "model unavailable" if response.status_code == 404 else "quota/rate-limited"
        return {
            "success": False,
            "status_code": 500,
            "error": (
                "No available Gemini model succeeded (" + status_text + "). "
                "Tried: " + ", ".join(tried_models)
            )
        }

    try:
        gemini_error = response.json().get('error', {}).get('message', response.text)
    except Exception:
        gemini_error = response.text

    return {
        "success": False,
        "status_code": 500,
        "error": f"Gemini API error ({response.status_code}) on model '{model_used}': {gemini_error}"
    }


def extract_gemini_text(result_json):
    """Extract plain text response from Gemini result JSON."""
    candidates = result_json.get('candidates', [])
    if not candidates:
        return ""

    parts = candidates[0].get('content', {}).get('parts', [])
    text_parts = [part.get('text', '') for part in parts if isinstance(part, dict) and part.get('text')]
    return "\n".join(text_parts).strip()

def load_data():
    """Load alert data from JSON file"""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return {
        "critical_alerts": [],
        "early_warnings": [],
        "herd_summary": {
            "total": 247,
            "healthy": 240,
            "warning": 5,
            "critical": 2,
            "last_update": datetime.now().isoformat()
        },
        "cow_positions": [],
        "alert_history": []
    }

def save_data(data):
    """Save alert data to JSON file"""
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/')
def index():
    """Serve main dashboard page"""
    return send_from_directory('../frontend', 'index.html')

@app.route('/api/herd-status')
def get_herd_status():
    """Get current herd summary"""
    data = load_data()
    return jsonify(data['herd_summary'])

@app.route('/api/critical-alerts')
def get_critical_alerts():
    """Get all critical alerts (12h+ confirmed)"""
    data = load_data()
    return jsonify(data['critical_alerts'])

@app.route('/api/early-warnings')
def get_early_warnings():
    """Get all early warnings (3h+ detected)"""
    data = load_data()
    return jsonify(data['early_warnings'])

@app.route('/api/map-data')
def get_map_data():
    """Get cow positions and status for map"""
    data = load_data()
    return jsonify({
        "cows": data['cow_positions'],
        "workers": [
            {
                "id": "worker-1",
                "name": "Worker A",
                "lat": -6.7920,
                "lng": 39.2080,
                "status": "available"
            },
            {
                "id": "worker-2",
                "name": "Worker B",
                "lat": -6.7930,
                "lng": 39.2090,
                "status": "assigned",
                "assigned_to": "COW-123"
            },
            {
                "id": "worker-3",
                "name": "Worker C",
                "lat": -6.7910,
                "lng": 39.2070,
                "status": "available"
            }
        ]
    })

@app.route('/api/cow/<cow_id>')
def get_cow_details(cow_id):
    """Get detailed info for specific cow"""
    data = load_data()
    
    # Check if in critical alerts
    for alert in data['critical_alerts']:
        if alert['cow_id'] == cow_id:
            return jsonify(alert)
    
    # Check if in early warnings
    for alert in data['early_warnings']:
        if alert['cow_id'] == cow_id:
            return jsonify(alert)
    
    # Find in cow positions
    for cow in data['cow_positions']:
        if cow['cow_id'] == cow_id:
            return jsonify({
                "cow_id": cow_id,
                "status": cow['status'],
                "location": {"lat": cow['lat'], "lng": cow['lng']},
                "health_score": cow.get('health_score', 85),
                "last_update": datetime.now().isoformat()
            })
    
    return jsonify({"error": "Cow not found"}), 404

@app.route('/api/analytics')
def get_analytics():
    """Get analytics data"""
    data = load_data()
    approved_diseases = [
        'East_Coast_Fever',
        'Trypanosomiasis',
        'Foot_And_Mouth_Disease',
        'Mastitis',
        'Lameness_Hoof_Disease',
        'Heat_Stress'
    ]
    disease_aliases = {
        'FMD': 'Foot_And_Mouth_Disease',
        'Foot and Mouth Disease': 'Foot_And_Mouth_Disease',
        'Lameness': 'Lameness_Hoof_Disease',
        'Hoof_Disease': 'Lameness_Hoof_Disease',
        'HeatStress': 'Heat_Stress'
    }
    
    # Calculate herd status
    herd_summary = data.get('herd_summary') or {}
    healthy = herd_summary.get('healthy')
    warning = herd_summary.get('warning')
    critical = herd_summary.get('critical')

    # Fallback to derived values if summary is missing
    if healthy is None:
        healthy = len([a for a in data.get('animals', []) if a.get('status') == 'healthy'])
    if warning is None:
        warning = len(data.get('early_warnings', []))
    if critical is None:
        critical = len(data.get('critical_alerts', []))
    
    # Disease distribution (restricted to the approved catalog)
    disease_counts = {name: 0 for name in approved_diseases}
    for alert in data.get('critical_alerts', []) + data.get('early_warnings', []):
        raw_disease = (alert.get('disease') or '').strip()
        disease = disease_aliases.get(raw_disease, raw_disease)
        if disease in disease_counts:
            disease_counts[disease] += 1
    
    # Cost savings (mock calculation)
    early_treatments = len(data['early_warnings'])
    prevented_deaths = len(data['critical_alerts'])
    
    savings = {
        "early_treatments": early_treatments,
        "early_treatment_cost": early_treatments * 12,
        "late_treatment_cost": early_treatments * 50,
        "deaths_prevented": prevented_deaths,
        "death_cost_saved": prevented_deaths * 400,
        "total_saved": (early_treatments * (50 - 12)) + (prevented_deaths * 400)
    }
    
    return jsonify({
        "herd_status": {
            "healthy": healthy,
            "warning": warning,
            "critical": critical
        },
        "disease_distribution": disease_counts,
        "cost_savings": savings,
        "alert_history": data.get('alert_history', [])
    })

@app.route('/api/diagnose-photo', methods=['POST'])
def diagnose_photo():
    """Diagnose cow from uploaded photo using Gemini"""
    try:
        if not GEMINI_API_KEY:
            return jsonify({
                "success": False,
                "error": "Gemini API key not configured. Set GEMINI_API_KEY environment variable."
            }), 500

        # Get image data
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
        
        image_file = request.files['image']
        cow_id = request.form.get('cow_id', 'Unknown')
        mime_type = (image_file.mimetype or '').lower()

        if not mime_type.startswith('image/'):
            return jsonify({
                "success": False,
                "error": "Invalid file type. Please upload an image."
            }), 400
        
        # Read image as base64
        image_data = base64.b64encode(image_file.read()).decode('utf-8')
        
        # Prepare Gemini request
        prompt = """You are a veterinary AI assistant for East African cattle.
Analyze this photo and identify potential health issues.

Look for:
- East Coast Fever: swollen lymph nodes, lethargy, dull coat, fever signs
    - Trypanosomiasis (Nagana): anemia signs, weight loss, weakness, dullness
    - Foot and Mouth Disease (FMD): mouth lesions, drooling, hoof lesions
- Mastitis: udder swelling, redness, discoloration
    - Lameness / Hoof Disease: abnormal stance, hoof problems, reluctance to move
    - Heat Stress: elevated panting, shade-seeking, reduced activity in hot weather
- General condition: coat quality, body condition score, alertness, eye clarity

Provide a structured response:
1. Primary Diagnosis: [Disease name or "Healthy" or "Uncertain"]
2. Confidence: [0-100%]
3. Visible Symptoms: [List what you see]
4. Recommended Action: [Specific next steps for farmer]

Be concise, practical, and focus on actionable advice for farmers."""

        gemini_request = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_data
                        }
                    }
                ]
            }]
        }
        
        gemini_call = call_gemini_with_fallback(gemini_request)

        if not gemini_call['success']:
            return jsonify({
                "success": False,
                "error": gemini_call['error']
            }), gemini_call['status_code']

        diagnosis_text = extract_gemini_text(gemini_call['result'])

        if not diagnosis_text:
            return jsonify({
                "success": False,
                "error": "Gemini response was empty."
            }), 502

        return jsonify({
            "success": True,
            "cow_id": cow_id,
            "model": gemini_call['model'],
            "diagnosis": diagnosis_text,
            "timestamp": datetime.now().isoformat()
        })
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/gemini-chat', methods=['POST'])
def gemini_chat():
    """Chat with Gemini, optionally including an image in the current turn."""
    try:
        if not GEMINI_API_KEY:
            return jsonify({
                "success": False,
                "error": "Gemini API key not configured. Set GEMINI_API_KEY environment variable."
            }), 500

        payload = request.get_json(silent=True) or {}
        message = (payload.get('message') or '').strip()
        history = payload.get('history') or []
        cow_id = (payload.get('cow_id') or 'Unknown').strip()
        image_data = payload.get('image_data')
        image_mime_type = (payload.get('image_mime_type') or '').lower().strip()

        if not message and not image_data:
            return jsonify({
                "success": False,
                "error": "Please provide a message or an image."
            }), 400

        if image_data and not image_mime_type.startswith('image/'):
            return jsonify({
                "success": False,
                "error": "Invalid image MIME type."
            }), 400

        system_prompt = """You are a veterinary and farm-operations AI assistant for East African cattle farms.
Give BRIEF, practical, field-friendly advice. Keep responses to 2-3 sentences maximum unless asked for more detail.
Use plain text formatting (no markdown, no ** for bold).
When images are provided, analyze visible health clues and clearly state uncertainty.
If no cattle are visible, state that and ask for a better photo.
When useful, provide: Assessment, Confidence Level, Immediate Actions.
Avoid making definitive diagnoses from weak visual evidence alone.
Be direct and conversational - speak to a busy farmer, not a textbook."""

        contents = []
        for turn in history[-8:]:
            role = turn.get('role')
            text = (turn.get('text') or '').strip()
            if role in ('user', 'model') and text:
                contents.append({
                    "role": role,
                    "parts": [{"text": text}]
                })

        current_parts = []
        if cow_id and cow_id != 'Unknown':
            current_parts.append({"text": f"Cow context: {cow_id}"})
        if message:
            current_parts.append({"text": message})
        if image_data:
            current_parts.append({
                "inline_data": {
                    "mime_type": image_mime_type,
                    "data": image_data
                }
            })

        gemini_request = {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": contents + [{
                "role": "user",
                "parts": current_parts
            }]
        }

        gemini_call = call_gemini_with_fallback(gemini_request)

        if not gemini_call['success']:
            return jsonify({
                "success": False,
                "error": gemini_call['error']
            }), gemini_call['status_code']

        reply_text = extract_gemini_text(gemini_call['result'])
        if not reply_text:
            return jsonify({
                "success": False,
                "error": "Gemini response was empty."
            }), 502

        return jsonify({
            "success": True,
            "model": gemini_call['model'],
            "reply": reply_text,
            "timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/assign-worker', methods=['POST'])
def assign_worker():
    """Assign worker to a cow alert"""
    data = request.json
    worker_id = data.get('worker_id')
    cow_id = data.get('cow_id')
    
    # In real system, this would update worker assignments
    # For demo, just return success
    return jsonify({
        "success": True,
        "message": f"Worker {worker_id} assigned to {cow_id}",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/mark-treated', methods=['POST'])
def mark_treated():
    """Mark a cow as treated"""
    data = request.json
    cow_id = data.get('cow_id')
    
    # Load current data
    alert_data = load_data()
    
    # Remove from critical alerts
    alert_data['critical_alerts'] = [
        a for a in alert_data['critical_alerts'] 
        if a['cow_id'] != cow_id
    ]
    
    # Remove from early warnings
    alert_data['early_warnings'] = [
        a for a in alert_data['early_warnings'] 
        if a['cow_id'] != cow_id
    ]
    
    # Update herd summary
    alert_data['herd_summary']['critical'] = len(alert_data['critical_alerts'])
    alert_data['herd_summary']['warning'] = len(alert_data['early_warnings'])
    alert_data['herd_summary']['healthy'] = (
        alert_data['herd_summary']['total'] - 
        alert_data['herd_summary']['critical'] - 
        alert_data['herd_summary']['warning']
    )
    
    save_data(alert_data)
    
    return jsonify({
        "success": True,
        "message": f"{cow_id} marked as treated",
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("=" * 70)
    print("ANIMALYTICS DASHBOARD API SERVER")
    print("=" * 70)
    print("Dashboard: http://localhost:5000")
    print("API Endpoints:")
    print("  GET  /api/herd-status")
    print("  GET  /api/critical-alerts")
    print("  GET  /api/early-warnings")
    print("  GET  /api/map-data")
    print("  GET  /api/analytics")
    print("  POST /api/diagnose-photo")
    print("  POST /api/gemini-chat")
    print("=" * 70)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
