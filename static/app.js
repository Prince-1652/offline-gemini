// State
let currentChatId = null;
let isStreaming = false;
let abortController = null;
let currentModel = 'llama3:8b';
let userName = localStorage.getItem('userName') || '';
let customInstructions = localStorage.getItem('customInstructions') || '';

// DOM Elements
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-sidebar');
const toggleBtnMobile = document.getElementById('toggle-sidebar-mobile');
const newChatBtn = document.getElementById('new-chat-btn');
const chatList = document.getElementById('chat-list');
const messagesContainer = document.getElementById('messages');
const welcomeMessage = document.getElementById('welcome-message');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatContainer = document.getElementById('chat-container');
const errorToast = document.getElementById('error-toast');
const modelSelectorBtn = document.getElementById('model-selector-btn');
const currentModelNameSpan = document.getElementById('current-model-name');
const modelList = document.getElementById('model-list');

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const userNameInput = document.getElementById('user-name');
const customInstructionsInput = document.getElementById('custom-instructions');

// Icons
const geminiIcon = `<img src="/static/icons/gemini.png" alt="AI" />`;
const trashIcon = `<img src="/static/icons/trash.svg" alt="Delete" />`;

// Event Listeners
toggleBtn.addEventListener('click', toggleSidebar);
toggleBtnMobile.addEventListener('click', toggleSidebar);
newChatBtn.addEventListener('click', startNewChat);

// Settings Modal Events
function closeSettings() {
    settingsModal.classList.add('hidden');
}

settingsBtn.addEventListener('click', () => {
    userNameInput.value = userName;
    customInstructionsInput.value = customInstructions;
    settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', closeSettings);
cancelSettingsBtn.addEventListener('click', closeSettings);

saveSettingsBtn.addEventListener('click', () => {
    userName = userNameInput.value.trim();
    customInstructions = customInstructionsInput.value.trim();
    localStorage.setItem('userName', userName);
    localStorage.setItem('customInstructions', customInstructions);
    closeSettings();
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        closeSettings();
    }
});

messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
    if (!isStreaming) {
        sendBtn.disabled = messageInput.value.trim() === '';
    }
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', () => {
    if (isStreaming) {
        if (abortController) abortController.abort();
    } else {
        sendMessage();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
    }
});

// Model Selector Events
modelSelectorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = modelList.classList.contains('hidden');
    if (isOpen) {
        modelList.classList.remove('hidden');
        modelSelectorBtn.classList.add('open');
    } else {
        modelList.classList.add('hidden');
        modelSelectorBtn.classList.remove('open');
    }
});

document.addEventListener('click', (e) => {
    if (!modelSelectorBtn.contains(e.target) && !modelList.contains(e.target)) {
        modelList.classList.add('hidden');
        modelSelectorBtn.classList.remove('open');
    }
});

// Functions
function toggleSidebar() {
    sidebar.classList.toggle('collapsed');
}

function showError(msg) {
    errorToast.textContent = msg;
    errorToast.classList.remove('hidden');
    setTimeout(() => {
        errorToast.classList.add('hidden');
    }, 3000);
}

// RESTORED: loadChats function
async function loadChats() {
    try {
        const res = await fetch('/chats');
        const chats = await res.json();
        renderChatList(chats);
    } catch (err) {
        showError('Failed to load chats');
    }
}

async function fetchModels() {
    try {
        const res = await fetch('/api/models');
        const data = await res.json();
        if (data.models && data.models.length > 0) {
            renderModelList(data.models);
        } else {
            modelList.innerHTML = '<div class="model-item loading-models">No models found</div>';
        }
    } catch (err) {
        console.error('Failed to fetch models', err);
        modelList.innerHTML = '<div class="model-item loading-models">Error loading models</div>';
    }
}

function renderModelList(models) {
    modelList.innerHTML = '';
    models.forEach(model => {
        const div = document.createElement('div');
        div.className = `model-item ${model === currentModel ? 'active' : ''}`;
        div.textContent = model;
        div.onclick = async () => {
            if (model !== currentModel) {
                const oldModel = currentModel;
                currentModel = model;
                currentModelNameSpan.textContent = model;

                // Update active class in list
                document.querySelectorAll('.model-item').forEach(item => {
                    item.classList.remove('active');
                });
                div.classList.add('active');

                modelList.classList.add('hidden');
                modelSelectorBtn.classList.remove('open');

                // Unload the old model
                try {
                    await fetch('/api/unload_model', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: oldModel })
                    });
                    console.log(`Unloaded model: ${oldModel}`);
                } catch (e) {
                    console.error('Error unloading model:', e);
                }
            } else {
                modelList.classList.add('hidden');
                modelSelectorBtn.classList.remove('open');
            }
        };
        modelList.appendChild(div);
    });
}

// Fixed: Only one loadChat function
async function loadChat(chatId) {
    if (isStreaming) return;
    try {
        const res = await fetch(`/chat/${chatId}`);
        if (!res.ok) throw new Error();
        const chat = await res.json();

        currentChatId = chat.id;
        if (chat.messages && chat.messages.length > 0) {
            welcomeMessage.style.transition = '';
            welcomeMessage.classList.add('hide-welcome');
        } else {
            showWelcomeAnimation();
        }
        messagesContainer.innerHTML = '';

        chat.messages.forEach(msg => {
            appendMessage(msg.role, msg.content);
        });

        loadChats();
        scrollToBottom();
    } catch (err) {
        showError('Failed to load chat');
    }
}

function renderChatList(chats) {
    chatList.innerHTML = '';
    chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        div.onclick = () => loadChat(chat.id);

        const titleSpan = document.createElement('span');
        titleSpan.className = 'chat-title';
        titleSpan.textContent = chat.title || 'New Chat';

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = trashIcon;
        delBtn.onclick = async (e) => {
            e.stopPropagation();
            await deleteChat(chat.id, div);
        };

        div.appendChild(titleSpan);
        div.appendChild(delBtn);
        chatList.appendChild(div);
    });
}

function showWelcomeAnimation() {
    welcomeMessage.style.transition = 'none';
    welcomeMessage.classList.add('hide-welcome');
    void welcomeMessage.offsetWidth; // Force reflow
    welcomeMessage.style.transition = ''; // Restore CSS transition
    welcomeMessage.classList.remove('hide-welcome');
}

async function startNewChat() {
    if (isStreaming) return;
    try {
        const res = await fetch('/new_chat', { method: 'POST' });
        if (!res.ok) throw new Error('Server error creating chat');
        const chat = await res.json();
        currentChatId = chat.id;
        messagesContainer.innerHTML = '';
        showWelcomeAnimation();
        messageInput.value = '';
        messageInput.style.height = 'auto';
        loadChats();
    } catch (err) {
        console.error("Error in startNewChat:", err);
        showError('Failed to create new chat');
    }
}

async function deleteChat(chatId, element) {
    if (isStreaming) return;
    try {
        element.style.opacity = '0';
        setTimeout(() => element.remove(), 300);

        await fetch(`/chat/${chatId}`, { method: 'DELETE' });

        if (currentChatId === chatId) {
            currentChatId = null;
            messagesContainer.innerHTML = '';
            showWelcomeAnimation();
        }
    } catch (err) {
        showError('Failed to delete chat');
    }
}

function appendMessage(role, content) {
    const div = document.createElement('div');
    div.className = `message ${role}`;

    if (role === 'assistant') {
        div.innerHTML = `
            <div class="assistant-icon-wrapper">${geminiIcon}</div>
            <div class="message-content"></div>
        `;
        if (content) {
            div.querySelector('.message-content').innerHTML = formatContent(content);
        }
    } else {
        div.innerHTML = `<div class="message-content">${formatContent(content)}</div>`;
    }

    messagesContainer.appendChild(div);
    return div.querySelector('.message-content');
}

function formatContent(text) {
    let formatted = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Code blocks
    formatted = formatted.replace(/```([\w-]*)\s*([\s\S]*?)```/g, function (match, lang, code) {
        let displayLang = lang ? lang.trim() : 'plaintext';
        let unescapedCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        let highlightedCode = unescapedCode;

        if (window.hljs) {
            try {
                if (displayLang && displayLang !== 'plaintext' && hljs.getLanguage(displayLang)) {
                    highlightedCode = hljs.highlight(unescapedCode, { language: displayLang, ignoreIllegals: true }).value;
                } else {
                    const auto = hljs.highlightAuto(unescapedCode);
                    highlightedCode = auto.value;
                    if (displayLang === 'plaintext' && auto.language) {
                        displayLang = auto.language;
                    }
                }
            } catch (e) {
                console.error(e);
                highlightedCode = code; // Fallback
            }
        } else {
            highlightedCode = code; // Fallback
        }

        return `<div class="code-container">
            <div class="code-header">
                <span class="code-language">${displayLang === 'plaintext' ? 'Code' : displayLang}</span>
                <button class="copy-button" onclick="copyCode(this)">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                    <span>Copy</span>
                </button>
            </div>
            <div class="code-content" data-raw-code="${encodeURIComponent(unescapedCode)}"><pre><code class="hljs ${displayLang}">${highlightedCode}</code></pre></div>
        </div>`;
    });

    // Unclosed Code block (active streaming state)
    if (formatted.includes('```')) {
        formatted = formatted.replace(/```([\w-]*)\s*([\s\S]*)$/, function (match, lang, code) {
            let displayLang = lang ? lang.trim() : 'plaintext';
            let unescapedCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            let highlightedCode = unescapedCode;

            if (window.hljs) {
                try {
                    if (displayLang && displayLang !== 'plaintext' && hljs.getLanguage(displayLang)) {
                        highlightedCode = hljs.highlight(unescapedCode, { language: displayLang, ignoreIllegals: true }).value;
                    } else {
                        // For unclosed blocks, fallback to plaintext styling to avoid flicker, or just use code
                        highlightedCode = code;
                    }
                } catch (e) {
                    highlightedCode = code;
                }
            } else {
                highlightedCode = code;
            }

            return `<div class="code-container">
            <div class="code-header">
                <span class="code-language">${displayLang === 'plaintext' ? 'Code' : displayLang}</span>
                <span class="code-language" style="color:#ff400b; text-transform:lowercase;">typing...</span>
            </div>
            <div class="code-content"><pre><code class="hljs ${displayLang}">${highlightedCode}</code></pre></div>
        </div>`;
        });
    }

    // Inline code
    formatted = formatted.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

    formatted = formatted.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
    return formatted;
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || isStreaming) return;

    if (!currentChatId) {
        const res = await fetch('/new_chat', { method: 'POST' });
        const chat = await res.json();
        currentChatId = chat.id;
        welcomeMessage.classList.remove('hide-welcome');
    }

    welcomeMessage.classList.add('hide-welcome');
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Switch to stop icon, disabled flag stays false to allow click
    sendBtn.innerHTML = `<img src="/static/icons/stop.svg" class="icon" alt="Stop" />`;
    messageInput.disabled = true;
    isStreaming = true;
    abortController = new AbortController();

    appendMessage('user', content);
    scrollToBottom();

    const assistantMsgContent = appendMessage('assistant', '');

    // --> INJECT THINKING ANIMATION HERE <--
    assistantMsgContent.innerHTML = '<span class="thinking-text">Thinking...</span>';
    scrollToBottom();

    try {
        const payload = {
            content: content,
            model: currentModel
        };
        // include optional settings in the payload
        if (userName) payload.user_name = userName;
        if (customInstructions) payload.custom_instructions = customInstructions;

        const res = await fetch(`/chat/${currentChatId}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: abortController.signal
        });

        if (!res.ok) throw new Error('API Error');

        let fullText = '';
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;

            // This naturally overwrites the "Thinking..." text on the first loop
            assistantMsgContent.innerHTML = formatContent(fullText) + '<span class="blinking-cursor"></span>';
            scrollToBottom();
        }

        assistantMsgContent.innerHTML = formatContent(fullText);
        loadChats();

    } catch (err) {
        if (err.name === 'AbortError') {
            // Streaming stopped by user
            const currentContent = assistantMsgContent.innerHTML.replace('<span class="blinking-cursor"></span>', '');
            assistantMsgContent.innerHTML = currentContent;
        } else {
            showError('Failed to send message');
            assistantMsgContent.innerHTML = '<span style="color:var(--danger)">An error occurred. Make sure Ollama is running.</span>';
        }
    } finally {
        isStreaming = false;
        abortController = null;
        messageInput.disabled = false;
        messageInput.focus();
        sendBtn.innerHTML = `<img src="/static/icons/send.svg" class="icon" alt="Send" />`;
        sendBtn.disabled = messageInput.value.trim() === '';
    }
}


window.copyCode = function (button) {
    const codeContainer = button.closest('.code-container');
    const codeContent = codeContainer.querySelector('.code-content');

    let textToCopy = '';
    if (codeContent.hasAttribute('data-raw-code')) {
        textToCopy = decodeURIComponent(codeContent.getAttribute('data-raw-code'));
    } else {
        const codeElement = codeContainer.querySelector('code');
        textToCopy = codeElement.textContent;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
        const span = button.querySelector('span');
        const originalText = span.textContent;
        span.textContent = 'Copied!';
        button.classList.add('copied');

        setTimeout(() => {
            span.textContent = originalText;
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
};

// Init
loadChats();
fetchModels();