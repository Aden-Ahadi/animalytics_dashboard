// Gemini AI Photo Diagnosis Integration

document.addEventListener('DOMContentLoaded', () => {
    const photoInput = document.getElementById('photo-input');
    const analyzeBtn = document.getElementById('analyze-photo-btn');
    
    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoSelect);
    }
    
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', analyzePhoto);
    }
});

function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        document.getElementById('preview-image').src = event.target.result;
        document.getElementById('upload-area').style.display = 'none';
        document.getElementById('photo-preview').style.display = 'block';
        document.getElementById('diagnosis-result').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

async function analyzePhoto() {
    const photoInput = document.getElementById('photo-input');
    const file = photoInput.files[0];
    
    if (!file) {
        alert('Please select a photo first');
        return;
    }
    
    // Show loading
    document.getElementById('diagnosis-loading').style.display = 'block';
    document.getElementById('diagnosis-result').style.display = 'none';
    
    try {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('cow_id', window.selectedCowId || 'Unknown');
        
        const response = await fetch(`${window.API_BASE}/diagnose-photo`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        // Hide loading
        document.getElementById('diagnosis-loading').style.display = 'none';
        
        if (result.success) {
            // Show result
            document.getElementById('diagnosis-text').textContent = result.diagnosis;
            document.getElementById('diagnosis-result').style.display = 'block';
        } else {
            alert('Error: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        document.getElementById('diagnosis-loading').style.display = 'none';
        alert('Error analyzing photo: ' + error.message);
    }
}
