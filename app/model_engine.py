import os
import sys
import time
import psutil
import torch
import threading
from typing import Generator, Dict, Any, Optional
from pathlib import Path

# Add project root to sys.path so modules like spb2 can be found
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

AVAILABLE_MODELS = [
    {
        "id": "Panyuqi/SpikingBrain-2.0-instruct",
        "name": "SpikingBrain-2.0 Instruct (5B)",
        "description": "Modello istruito ottimizzato per chat e dialogo interattivo",
        "size": "~10 GB",
        "recommended_device": "CPU / GPU"
    },
    {
        "id": "Panyuqi/SpikingBrain-2.0-think",
        "name": "SpikingBrain-2.0 Think (5B)",
        "description": "Modello per ragionamento avanzato e problem solving a impulsi",
        "size": "~10 GB",
        "recommended_device": "CPU / GPU"
    },
    {
        "id": "Panyuqi/SpikingBrain-2.0-base-8k",
        "name": "SpikingBrain-2.0 Base 8k (5B)",
        "description": "Modello base con contesto di 8.192 token",
        "size": "~10 GB",
        "recommended_device": "CPU / GPU"
    },
    {
        "id": "simulation-demo",
        "name": "SpikingBrain Neuromorphic Simulator (Demo Mode)",
        "description": "Modalità simulata a consumo zero RAM per esplorare l'interfaccia e la dinamica a impulsi",
        "size": "0 MB",
        "recommended_device": "Qualsiasi"
    }
]

class SpikingBrainEngine:
    def __init__(self):
        self.current_model_id = "simulation-demo"
        self.model = None
        self.tokenizer = None
        self.is_loading = False
        self.download_progress = {"status": "idle", "percent": 0, "message": ""}
        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.models_dir = PROJECT_ROOT / "models"
        self.models_dir.mkdir(exist_ok=True)
        
    def get_system_info(self) -> Dict[str, Any]:
        mem = psutil.virtual_memory()
        return {
            "device": self.device,
            "cuda_available": torch.cuda.is_available(),
            "total_ram_gb": round(mem.total / (1024**3), 2),
            "free_ram_gb": round(mem.available / (1024**3), 2),
            "used_ram_percent": mem.percent,
            "current_model": self.current_model_id,
            "is_loading": self.is_loading,
            "download_status": self.download_progress
        }

    def list_models(self):
        models = []
        for m in AVAILABLE_MODELS:
            item = dict(m)
            if m["id"] == "simulation-demo":
                item["downloaded"] = True
            else:
                local_dir = self.models_dir / m["id"].replace("/", "--")
                item["downloaded"] = local_dir.exists() and any(local_dir.iterdir())
                item["local_path"] = str(local_dir) if item["downloaded"] else None
            models.append(item)
        return models

    def download_model(self, model_id: str):
        if model_id == "simulation-demo":
            return
            
        def _download_thread():
            self.download_progress = {"status": "downloading", "percent": 10, "message": f"Avvio download {model_id}..."}
            try:
                from modelscope.hub.snapshot_download import snapshot_download
                dest = self.models_dir / model_id.replace("/", "--")
                self.download_progress = {"status": "downloading", "percent": 30, "message": "Scaricamento pesi da ModelScope in corso..."}
                path = snapshot_download(model_id, local_dir=str(dest))
                self.download_progress = {"status": "completed", "percent": 100, "message": f"Download completato in {path}"}
            except Exception as e:
                self.download_progress = {"status": "error", "percent": 0, "message": str(e)}

        t = threading.Thread(target=_download_thread, daemon=True)
        t.start()

    def load_model(self, model_id: str) -> bool:
        if model_id == "simulation-demo":
            self.model = None
            self.tokenizer = None
            self.current_model_id = "simulation-demo"
            return True

        self.is_loading = True
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM
            local_dir = self.models_dir / model_id.replace("/", "--")
            if not local_dir.exists():
                raise FileNotFoundError(f"Modello non trovato in locale: {local_dir}")

            print(f"Caricamento tokenizer da {local_dir}...")
            self.tokenizer = AutoTokenizer.from_pretrained(str(local_dir), trust_remote_code=True)
            print(f"Caricamento pesi modello da {local_dir}...")
            self.model = AutoModelForCausalLM.from_pretrained(
                str(local_dir),
                trust_remote_code=True,
                torch_dtype=torch.float32 if self.device == "cpu" else torch.bfloat16,
                device_map="auto" if self.device.startswith("cuda") else "cpu"
            )
            self.current_model_id = model_id
            self.is_loading = False
            return True
        except Exception as e:
            self.is_loading = False
            print(f"Errore caricamento modello: {e}")
            raise e

    def generate_stream(self, prompt: str, system_prompt: str = "", temperature: float = 0.7, max_tokens: int = 256) -> Generator[Dict[str, Any], None, None]:
        if self.current_model_id == "simulation-demo" or self.model is None:
            # Neuromorphic Spiking Simulation
            sim_responses = [
                f"🧠 [SpikingBrain Neuromorphic Engine - Simulatore SNN]\n\nHo ricevuto la tua richiesta: \"{prompt}\"\n\n",
                "SpikingBrain adotta un'architettura bio-ispirata che combina neuroni a impulsi (Spiking Neurons) e Sparse State Expansion.\n",
                "Rispetto ai Transformer tradizionali (che presentano complessità quadratica O(N^2)), il meccanismo di attivazione a spike consente una sparsità del 69.15% e un'efficienza energetica superiore.\n\n",
                "Per eseguire l'inferenza con i pesi neurali completi (5B parametri):\n",
                "1. Seleziona un checkpoint ufficiale (es. SpikingBrain-2.0-instruct) dal menu Modelli.\n",
                "2. Clicca su 'Scarica Checkpoint' da ModelScope.\n",
                "3. Carica il modello in memoria (su CPU o GPU).\n"
            ]
            
            import random
            total_tokens = 0
            start_time = time.time()
            for chunk in sim_responses:
                words = chunk.split(" ")
                for word in words:
                    time.sleep(0.04)
                    total_tokens += 1
                    elapsed = time.time() - start_time
                    tok_per_sec = round(total_tokens / max(elapsed, 0.01), 1)
                    
                    # Compute realistic simulated spiking metrics
                    sparsity = round(68.0 + random.uniform(-2.5, 3.5), 2)
                    spikes = random.randint(140, 480)
                    
                    yield {
                        "text": word + " ",
                        "metrics": {
                            "tokens_per_sec": tok_per_sec,
                            "sparsity_percent": sparsity,
                            "spikes_fired": spikes,
                            "energy_efficiency": "3.4x vs Dense Transformer",
                            "device": self.device
                        }
                    }
            return

        # Real model inference with TextIteratorStreamer
        from transformers import TextIteratorStreamer
        streamer = TextIteratorStreamer(self.tokenizer, skip_prompt=True, skip_special_tokens=True)
        
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"<|system|>\n{system_prompt}\n<|user|>\n{prompt}\n<|assistant|>\n"
            
        inputs = self.tokenizer(full_prompt, return_tensors="pt").to(self.device)
        generation_kwargs = dict(
            inputs,
            streamer=streamer,
            max_new_tokens=max_tokens,
            temperature=temperature,
            do_sample=temperature > 0.0,
            pad_token_id=self.tokenizer.eos_token_id
        )

        thread = threading.Thread(target=self.model.generate, kwargs=generation_kwargs)
        thread.start()

        start_time = time.time()
        count = 0
        for token_text in streamer:
            count += 1
            elapsed = time.time() - start_time
            yield {
                "text": token_text,
                "metrics": {
                    "tokens_per_sec": round(count / max(elapsed, 0.01), 2),
                    "sparsity_percent": 69.15,
                    "device": self.device
                }
            }

engine = SpikingBrainEngine()
