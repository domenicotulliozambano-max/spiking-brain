import json
import time
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from model_engine import engine

app = FastAPI(title="SpikingBrain Dedicated AI Studio", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

class GenerationRequest(BaseModel):
    prompt: str
    system_prompt: Optional[str] = "Sei SpikingBrain, un assistente IA avanzato basato su architettura neuromorfica a impulsi."
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 512

class ModelActionRequest(BaseModel):
    model_id: str

@app.get("/", response_class=HTMLResponse)
def get_index():
    # Return index.html with no-cache headers so browser never runs old cached script
    response = FileResponse(STATIC_DIR / "index.html")
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.get("/favicon.ico")
def get_favicon():
    return FileResponse(STATIC_DIR / "spiking_brain.ico")

@app.get("/api/system")
def get_system_status():
    return engine.get_system_info()

@app.get("/api/models")
def get_models():
    return engine.list_models()

@app.post("/api/models/download")
def download_model(req: ModelActionRequest):
    engine.download_model(req.model_id)
    return {"status": "started", "model_id": req.model_id}

@app.post("/api/models/load")
def load_model(req: ModelActionRequest):
    try:
        engine.load_model(req.model_id)
        return {"status": "loaded", "current_model": req.model_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
def chat_sse(req: GenerationRequest):
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Il testo non può essere vuoto.")
        
    def sse_generator():
        for chunk in engine.generate_stream(
            prompt=req.prompt,
            system_prompt=req.system_prompt or "",
            temperature=req.temperature or 0.7,
            max_tokens=req.max_tokens or 512
        ):
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: {\"done\": true}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@app.post("/api/chat-sync")
def chat_sync(req: GenerationRequest):
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Il testo non può essere vuoto.")
    
    full_text = ""
    last_metrics = {}
    for chunk in engine.generate_stream(
        prompt=req.prompt,
        system_prompt=req.system_prompt or "",
        temperature=req.temperature or 0.7,
        max_tokens=req.max_tokens or 512
    ):
        full_text += chunk.get("text", "")
        if "metrics" in chunk:
            last_metrics = chunk["metrics"]
            
    return {"text": full_text, "metrics": last_metrics}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
