const messagesContainer = document.getElementById('messages-container');
const promptInput = document.getElementById('prompt-input');
const btnSend = document.getElementById('btn-send');
const statusIndicator = document.getElementById('status-indicator');
const brainIcon = document.getElementById('brain-icon');
const activeModelName = document.getElementById('active-model-name');
const modelsContainer = document.getElementById('models-container');

const txtDevice = document.getElementById('txt-device');
const txtRam = document.getElementById('txt-ram');
const txtSparsity = document.getElementById('txt-sparsity');
const barSparsity = document.getElementById('bar-sparsity');
const txtSpeed = document.getElementById('txt-speed');
const txtSpikes = document.getElementById('txt-spikes');

let isGenerating = false;

promptInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 180) + 'px';
});

promptInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitChat();
  }
});

function setPrompt(text) {
  promptInput.value = text;
  promptInput.focus();
  promptInput.style.height = 'auto';
  promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px';
}

function insertSampleText() {
  setPrompt("Valuta questo brano di romanzo:\n\nLa pioggia batteva forte contro i vetri dello studio. Marco fissava il sigillo di ceralacca sulla busta, con le dita che tremavano. Erano passati dieci anni dall'ultima volta che aveva visto quella grafia. 'Se stai leggendo questo,' diceva la lettera, 'significa che hanno trovato anche me.' Spezzo il sigillo con un respiro profondo.");
}

function clearChat() {
  messagesContainer.innerHTML = '';
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function appendUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'flex justify-end';
  const bubble = document.createElement('div');
  bubble.className = 'bg-emerald-600 text-white rounded-2xl p-4 max-w-2xl text-sm shadow-md leading-relaxed whitespace-pre-wrap font-sans';
  bubble.textContent = text;
  div.appendChild(bubble);
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createAssistantMessage() {
  const div = document.createElement('div');
  div.className = 'flex space-x-4 max-w-3xl';
  const icon = document.createElement('div');
  icon.className = 'w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-1 shadow';
  icon.innerHTML = '<i class="fa-solid fa-brain"></i>';
  const body = document.createElement('div');
  body.className = 'bg-gray-800/90 border border-gray-700/60 rounded-2xl p-5 text-sm text-gray-200 shadow-xl flex-1 leading-relaxed';
  const content = document.createElement('div');
  content.className = 'msg-content whitespace-pre-wrap leading-relaxed font-sans';
  body.appendChild(content);
  div.appendChild(icon);
  div.appendChild(body);
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return div;
}

function updateMetrics(m) {
  if (!m) return;
  if (m.tokens_per_sec !== undefined) txtSpeed.textContent = m.tokens_per_sec + ' tok/s';
  if (m.sparsity_percent !== undefined) {
    txtSparsity.textContent = m.sparsity_percent + '%';
    barSparsity.style.width = m.sparsity_percent + '%';
  }
  if (m.spikes_fired !== undefined) txtSpikes.textContent = Number(m.spikes_fired).toLocaleString();
}

async function submitChat() {
  const prompt = promptInput.value.trim();
  if (!prompt || isGenerating) return;
  isGenerating = true;
  btnSend.disabled = true;
  statusIndicator.classList.remove('hidden');
  brainIcon.classList.add('spiking-active');
  appendUserMessage(prompt);
  promptInput.value = '';
  promptInput.style.height = 'auto';
  const assistantDiv = createAssistantMessage();
  const textElem = assistantDiv.querySelector('.msg-content');
  const payload = {
    prompt: prompt,
    temperature: parseFloat(document.getElementById('slider-temp').value),
    max_tokens: parseInt(document.getElementById('slider-tokens').value)
  };
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.done) break;
              if (data.text) {
                textElem.textContent += data.text;
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
              }
              if (data.metrics) updateMetrics(data.metrics);
            } catch(e) {}
          }
        }
      }
    } else {
      const syncRes = await fetch('/api/chat-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const syncData = await syncRes.json();
      textElem.textContent = syncData.text || 'Nessuna risposta generata.';
      if (syncData.metrics) updateMetrics(syncData.metrics);
    }
  } catch (err) {
    console.error('Chat error:', err);
    try {
      const syncRes = await fetch('/api/chat-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const syncData = await syncRes.json();
      textElem.textContent = syncData.text;
      if (syncData.metrics) updateMetrics(syncData.metrics);
    } catch (e2) {
      textElem.innerHTML = '<span class="text-red-400 font-bold">Errore: </span>' + escapeHtml(err.message);
    }
  } finally {
    isGenerating = false;
    btnSend.disabled = false;
    statusIndicator.classList.add('hidden');
    brainIcon.classList.remove('spiking-active');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

async function refreshState() {
  try {
    const sysRes = await fetch('/api/system');
    const sys = await sysRes.json();
    txtDevice.innerHTML = '<i class="fa-solid fa-microchip text-cyan-400 mr-1.5"></i> ' + sys.device.toUpperCase();
    txtRam.innerHTML = '<i class="fa-solid fa-memory text-purple-400 mr-1.5"></i> ' + sys.free_ram_gb + ' / ' + sys.total_ram_gb + ' GB';
    const modRes = await fetch('/api/models');
    const models = await modRes.json();
    renderModels(models, sys.current_model);
  } catch(e) {
    console.error('Refresh error:', e);
  }
}

function renderModels(models, currentId) {
  modelsContainer.innerHTML = '';
  models.forEach(m => {
    const isCurrent = m.id === currentId;
    if (isCurrent) activeModelName.textContent = m.name;
    const card = document.createElement('div');
    card.className = 'p-3 rounded-xl border text-xs transition ' + (isCurrent ? 'bg-emerald-950/40 border-emerald-500/50' : 'bg-gray-800/40 border-gray-700/50');
    let actionBtn = '';
    if (m.id === 'simulation-demo') {
      actionBtn = isCurrent ? '<span class="text-[10px] text-emerald-400 font-bold">Attivo</span>' : '<button data-load="' + m.id + '" class="btn-action px-2 py-1 bg-emerald-600 rounded text-white text-[10px]">Attiva</button>';
    } else if (m.downloaded) {
      actionBtn = isCurrent ? '<span class="text-[10px] text-emerald-400 font-bold">In Uso</span>' : '<button data-load="' + m.id + '" class="btn-action px-2 py-1 bg-cyan-600 rounded text-white text-[10px]">Carica</button>';
    } else {
      actionBtn = '<button data-download="' + m.id + '" class="btn-action px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-200 text-[10px]"><i class="fa-solid fa-download mr-1"></i>Scarica</button>';
    }
    card.innerHTML = '<div class="flex justify-between items-start mb-1"><span class="font-bold text-gray-200">' + m.name + '</span>' + actionBtn + '</div><p class="text-gray-400 text-[11px] mb-2 leading-relaxed">' + m.description + '</p><div class="flex items-center text-[10px] text-gray-500 space-x-2"><span>' + m.size + '</span><span>?</span><span>' + m.recommended_device + '</span></div>';
    modelsContainer.appendChild(card);
  });
}

modelsContainer.addEventListener('click', function(e) {
  const btn = e.target.closest('.btn-action');
  if (!btn) return;
  if (btn.dataset.load) loadModel(btn.dataset.load);
  if (btn.dataset.download) downloadModel(btn.dataset.download);
});

async function loadModel(modelId) {
  activeModelName.textContent = 'Caricamento pesi in memoria...';
  try {
    const res = await fetch('/api/models/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId })
    });
    const d = await res.json();
    if (res.ok) refreshState();
    else alert('Errore: ' + (d.detail || 'Impossibile caricare il modello'));
  } catch(e) {
    alert('Errore: ' + e.message);
  }
}

async function downloadModel(modelId) {
  try {
    await fetch('/api/models/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId })
    });
    alert('Download avviato in background da ModelScope!');
    setTimeout(refreshState, 3000);
  } catch(e) {
    alert('Errore download: ' + e.message);
  }
}

const canvas = document.getElementById('brain-canvas');
const ctx = canvas.getContext('2d');
let width, height, nodes = [];

function resizeCanvas() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

for (let i = 0; i < 40; i++) {
  nodes.push({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    radius: Math.random() * 2 + 1
  });
}

function animate() {
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
        ctx.strokeStyle = isGenerating ? 'rgba(52, 211, 153, ' + (0.4 * (1 - dist / 130)) + ')' : 'rgba(6, 182, 212, ' + (0.18 * (1 - dist / 130)) + ')';
        ctx.lineWidth = isGenerating ? 1.5 : 0.8;
        ctx.stroke();
      }
    }
  }
  requestAnimationFrame(animate);
}
animate();

refreshState();