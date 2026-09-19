// Elements
const messagesContainer = document.getElementById('messages-container');
const chatForm = document.getElementById('chat-form');
const promptInput = document.getElementById('prompt-input');
const btnSend = document.getElementById('btn-send');
const brainIcon = document.getElementById('brain-icon');
const activeModelName = document.getElementById('active-model-name');
const modelsContainer = document.getElementById('models-container');

// Telemetry Elements
const txtDevice = document.getElementById('txt-device');
const txtRam = document.getElementById('txt-ram');
const txtSparsity = document.getElementById('txt-sparsity');
const barSparsity = document.getElementById('bar-sparsity');
const txtSpeed = document.getElementById('txt-speed');
const txtSpikes = document.getElementById('txt-spikes');
const btnRefresh = document.getElementById('btn-refresh');

// Settings
const sliderTemp = document.getElementById('slider-temp');
const valTemp = document.getElementById('val-temp');
const sliderTokens = document.getElementById('slider-tokens');
const valTokens = document.getElementById('val-tokens');

sliderTemp.addEventListener('input', () => valTemp.textContent = sliderTemp.value);
sliderTokens.addEventListener('input', () => valTokens.textContent = sliderTokens.value);

// Auto resize textarea
promptInput.addEventListener('input', () => {
  promptInput.style.height = 'auto';
  promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
});

promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});

// Quick chips
document.querySelectorAll('.quick-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    promptInput.value = chip.textContent.trim().replace(/^[^\w\s]+/, '').trim();
    promptInput.focus();
  });
});

// WebSocket Chat
let ws = null;
let currentAssistantMessageDiv = null;
let isGenerating = false;

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(${protocol}///ws/chat);

  ws.onopen = () => {
    console.log('WebSocket connesso con SpikingBrain Studio.');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.done) {
      finishGeneration();
      return;
    }

    if (data.error) {
      appendErrorMessage(data.error);
      finishGeneration();
      return;
    }

    if (data.text && currentAssistantMessageDiv) {
      const textElem = currentAssistantMessageDiv.querySelector('.msg-content');
      textElem.textContent += data.text;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    if (data.metrics) {
      updateLiveMetrics(data.metrics);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnesso, riconnessione in 2 secondi...');
    setTimeout(initWebSocket, 2000);
  };
}

initWebSocket();

function appendUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'flex justify-end';
  div.innerHTML = 
    <div class="bg-emerald-600/90 text-white rounded-2xl p-4 max-w-2xl text-sm shadow-md leading-relaxed">
      
    </div>
  ;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createAssistantMessage() {
  const div = document.createElement('div');
  div.className = 'flex space-x-4 max-w-3xl';
  div.innerHTML = 
    <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-1">
      <i class="fa-solid fa-brain"></i>
    </div>
    <div class="bg-gray-800/80 border border-gray-700/60 rounded-2xl p-4 text-sm text-gray-200 shadow-md flex-1">
      <div class="msg-content whitespace-pre-wrap leading-relaxed font-sans"></div>
    </div>
  ;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return div;
}

function appendErrorMessage(err) {
  const div = document.createElement('div');
  div.className = 'flex space-x-4 max-w-3xl';
  div.innerHTML = 
    <div class="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0 mt-1">
      <i class="fa-solid fa-circle-exclamation"></i>
    </div>
    <div class="bg-red-900/30 border border-red-700/50 rounded-2xl p-4 text-sm text-red-200 shadow-md flex-1">
      <p class="font-bold mb-1">Errore di Generazione:</p>
      <p></p>
    </div>
  ;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateLiveMetrics(metrics) {
  if (metrics.tokens_per_sec !== undefined) {
    txtSpeed.textContent = ${metrics.tokens_per_sec} tok/s;
  }
  if (metrics.sparsity_percent !== undefined) {
    txtSparsity.textContent = ${metrics.sparsity_percent}%;
    barSparsity.style.width = ${metrics.sparsity_percent}%;
  }
  if (metrics.spikes_fired !== undefined) {
    txtSpikes.textContent = metrics.spikes_fired.toLocaleString();
  }
}

function finishGeneration() {
  isGenerating = false;
  btnSend.disabled = false;
  brainIcon.classList.remove('spiking-active');
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt || isGenerating) return;

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    appendErrorMessage('Connessione al server assente. Riprova tra un istante.');
    return;
  }

  isGenerating = true;
  btnSend.disabled = true;
  brainIcon.classList.add('spiking-active');

  appendUserMessage(prompt);
  promptInput.value = '';
  promptInput.style.height = 'auto';

  currentAssistantMessageDiv = createAssistantMessage();

  ws.send(JSON.stringify({
    prompt: prompt,
    temperature: parseFloat(sliderTemp.value),
    max_tokens: parseInt(sliderTokens.value)
  }));
});

// Fetch system info and models
async function refreshState() {
  try {
    const sysRes = await fetch('/api/system');
    const sysData = await sysRes.json();
    
    txtDevice.innerHTML = <i class="fa-solid fa-microchip text-cyan-400 mr-1.5"></i> ;
    txtRam.innerHTML = <i class="fa-solid fa-memory text-purple-400 mr-1.5"></i>  /  GB;

    const modelsRes = await fetch('/api/models');
    const models = await modelsRes.json();
    renderModels(models, sysData.current_model);
  } catch (err) {
    console.error('Errore refresh:', err);
  }
}

function renderModels(models, currentModelId) {
  modelsContainer.innerHTML = '';
  models.forEach(m => {
    const isCurrent = m.id === currentModelId;
    if (isCurrent) {
      activeModelName.textContent = m.name;
    }

    const card = document.createElement('div');
    card.className = p-3 rounded-xl border text-xs transition ;
    
    let actionBtn = '';
    if (m.id === 'simulation-demo') {
      actionBtn = isCurrent ? '<span class="text-[10px] text-emerald-400 font-semibold">Attivo</span>' : <button onclick="loadModel('')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-white text-[10px]">Attiva</button>;
    } else if (m.downloaded) {
      actionBtn = isCurrent ? '<span class="text-[10px] text-emerald-400 font-semibold">In Uso</span>' : <button onclick="loadModel('')" class="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 rounded text-white text-[10px]">Carica</button>;
    } else {
      actionBtn = <button onclick="downloadModel('')" class="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-200 text-[10px]"><i class="fa-solid fa-download mr-1"></i>Scarica ()</button>;
    }

    card.innerHTML = 
      <div class="flex justify-between items-start mb-1">
        <span class="font-bold text-gray-200"></span>
        
      </div>
      <p class="text-gray-400 text-[11px] mb-2 leading-relaxed"></p>
      <div class="flex items-center text-[10px] text-gray-500 space-x-2">
        <span>Dimensione: </span>
        <span>•</span>
        <span></span>
      </div>
    ;
    modelsContainer.appendChild(card);
  });
}

async function loadModel(modelId) {
  try {
    activeModelName.textContent = 'Caricamento in corso...';
    const res = await fetch('/api/models/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId })
    });
    const data = await res.json();
    if (res.ok) {
      refreshState();
    } else {
      alert('Errore caricamento: ' + data.detail);
      refreshState();
    }
  } catch (e) {
    alert('Errore: ' + e.message);
    refreshState();
  }
}

async function downloadModel(modelId) {
  try {
    await fetch('/api/models/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId })
    });
    alert('Download avviato in background da ModelScope! Puoi monitorare la cartella dei modelli.');
    setTimeout(refreshState, 3000);
  } catch (e) {
    alert('Errore avvio download: ' + e.message);
  }
}

btnRefresh.addEventListener('click', refreshState);
refreshState();

// Synaptic Background Canvas Animation
const canvas = document.getElementById('brain-canvas');
const ctx = canvas.getContext('2d');
let width, height, nodes = [];

function resizeCanvas() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

for (let i = 0; i < 45; i++) {
  nodes.push({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    radius: Math.random() * 2 + 1
  });
}

function animateCanvas() {
  ctx.clearRect(0, 0, width, height);
  
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    n.x += n.vx;
    n.y += n.vy;
    if (n.x < 0 || n.x > width) n.vx *= -1;
    if (n.y < 0 || n.y > height) n.vy *= -1;

    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
    ctx.fillStyle = isGenerating ? '#34d399' : '#06b6d4';
    ctx.fill();

    for (let j = i + 1; j < nodes.length; j++) {
      const n2 = nodes[j];
      const dist = Math.hypot(n.x - n2.x, n.y - n2.y);
      if (dist < 130) {
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.strokeStyle = isGenerating 
          ? gba(52, 211, 153, )
          : gba(6, 182, 212, );
        ctx.lineWidth = isGenerating ? 1.5 : 0.8;
        ctx.stroke();
      }
    }
  }
  requestAnimationFrame(animateCanvas);
}
animateCanvas();
