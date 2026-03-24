// Gemini Assistant Chat Interface

const assistantState = {
    history: [],
    imageFile: null,
    sending: false
};

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('assistant-chat-input');
    const sendBtn = document.getElementById('assistant-send-btn');
    const attachBtn = document.getElementById('assistant-attach-btn');
    const clearImageBtn = document.getElementById('assistant-clear-image-btn');
    const imageInput = document.getElementById('assistant-image-input');
    const clearChatBtn = document.getElementById('assistant-clear-chat-btn');

    if (!chatInput || !sendBtn || !attachBtn || !clearImageBtn || !imageInput) {
        return;
    }

    sendBtn.addEventListener('click', sendAssistantMessage);

    chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendAssistantMessage();
        }
    });

    attachBtn.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setAssistantStatus('Please choose a valid image file.');
            imageInput.value = '';
            return;
        }

        assistantState.imageFile = file;
        document.getElementById('assistant-image-name').textContent = file.name;
        setAssistantStatus('Image attached. You can now send your message.');
    });

    clearImageBtn.addEventListener('click', () => {
        clearAssistantImage();
        setAssistantStatus('Image removed.');
    });

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearAssistantChat);
    }
});

async function sendAssistantMessage() {
    if (assistantState.sending) return;

    const inputEl = document.getElementById('assistant-chat-input');
    const message = (inputEl.value || '').trim();

    if (!message && !assistantState.imageFile) {
        setAssistantStatus('Type a message or attach an image first.');
        return;
    }

    const userMessage = message || 'Please analyze this uploaded image.';
    const imageUrl = assistantState.imageFile ? URL.createObjectURL(assistantState.imageFile) : null;

    appendAssistantMessage('user', userMessage, '', imageUrl);
    inputEl.value = '';
    setAssistantSending(true);
    setAssistantStatus('Gemini is thinking...');

    try {
        const payload = {
            message,
            cow_id: window.selectedCowId || 'Unknown',
            history: assistantState.history.slice(-12)
        };

        if (assistantState.imageFile) {
            payload.image_data = await fileToBase64(assistantState.imageFile);
            payload.image_mime_type = assistantState.imageFile.type;
        }

        const response = await fetch(`${window.API_BASE}/gemini-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            const errorText = result.error || 'Failed to get AI response.';
            appendAssistantMessage('model', `Error: ${errorText}`);
            setAssistantStatus('Request failed. Please try again.');
            return;
        }

        assistantState.history.push({ role: 'user', text: userMessage });
        assistantState.history.push({ role: 'model', text: result.reply });

        appendAssistantMessage('model', result.reply);
        setAssistantStatus('Response received.');
        clearAssistantImage();
    } catch (error) {
        appendAssistantMessage('model', `Error: ${error.message}`);
        setAssistantStatus('Network or server error.');
    } finally {
        setAssistantSending(false);
    }
}

function formatTextWithBold(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
}

function appendAssistantMessage(role, text, meta = '', imageUrl = null) {
    const logEl = document.getElementById('assistant-chat-log');
    if (!logEl) return;

    const messageEl = document.createElement('div');
    messageEl.className = role === 'user'
        ? 'assistant-message assistant-user'
        : 'assistant-message assistant-bot';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'assistant-avatar';
    avatarEl.innerHTML = role === 'user'
        ? '<i class="fa-solid fa-user"></i>'
        : '<i class="fa-solid fa-robot"></i>';

    const wrapEl = document.createElement('div');
    wrapEl.className = 'assistant-bubble-wrap';

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'assistant-bubble';
    bubbleEl.innerHTML = formatTextWithBold(text);

    if (imageUrl) {
        const imageEl = document.createElement('img');
        imageEl.src = imageUrl;
        imageEl.className = 'assistant-bubble-image';
        bubbleEl.appendChild(imageEl);
    }

    const metaEl = document.createElement('div');
    metaEl.className = 'assistant-message-meta';
    const roleText = role === 'user' ? 'You' : 'Farm AI';
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    metaEl.textContent = meta ? `${roleText} · ${stamp} · ${meta}` : `${roleText} · ${stamp}`;

    wrapEl.appendChild(bubbleEl);
    wrapEl.appendChild(metaEl);

    if (role === 'user') {
        messageEl.appendChild(wrapEl);
        messageEl.appendChild(avatarEl);
    } else {
        messageEl.appendChild(avatarEl);
        messageEl.appendChild(wrapEl);
    }

    logEl.appendChild(messageEl);
    logEl.scrollTop = logEl.scrollHeight;
}

function clearAssistantChat() {
    const logEl = document.getElementById('assistant-chat-log');
    if (!logEl) return;

    assistantState.history = [];
    logEl.innerHTML = `
        <div class="assistant-message assistant-bot">
            <div class="assistant-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="assistant-bubble-wrap">
                <div class="assistant-bubble">Chat cleared. Ask a new question whenever you are ready.</div>
                <div class="assistant-message-meta">Farm AI · just now</div>
            </div>
        </div>
    `;
    setAssistantStatus('Conversation cleared.');
}

function setAssistantStatus(text) {
    const statusEl = document.getElementById('assistant-chat-status');
    if (statusEl) {
        statusEl.textContent = text;
    }
}

function setAssistantSending(sending) {
    assistantState.sending = sending;

    const sendBtn = document.getElementById('assistant-send-btn');
    const inputEl = document.getElementById('assistant-chat-input');
    const attachBtn = document.getElementById('assistant-attach-btn');
    const clearBtn = document.getElementById('assistant-clear-image-btn');

    if (sendBtn) sendBtn.disabled = sending;
    if (inputEl) inputEl.disabled = sending;
    if (attachBtn) attachBtn.disabled = sending;
    if (clearBtn) clearBtn.disabled = sending;
}

function clearAssistantImage() {
    assistantState.imageFile = null;

    const imageInput = document.getElementById('assistant-image-input');
    const imageName = document.getElementById('assistant-image-name');

    if (imageInput) imageInput.value = '';
    if (imageName) imageName.textContent = 'No image selected';
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = reader.result || '';
            const commaIndex = result.indexOf(',');
            if (commaIndex < 0) {
                reject(new Error('Could not read image data.'));
                return;
            }
            resolve(result.slice(commaIndex + 1));
        };

        reader.onerror = () => {
            reject(new Error('Failed to read image file.'));
        };

        reader.readAsDataURL(file);
    });
}
