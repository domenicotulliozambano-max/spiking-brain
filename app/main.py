import json
import asyncio
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
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
async def get_index():
    return FileResponse(STATIC_DIR / "index.html")

@app.get("/favicon.ico")
async def get_favicon():
    return FileResponse(STATIC_DIR / "spiking_brain.ico")

@app.get("/api/system")
async def get_system_status():
    return engine.get_system_info()

@app.get("/api/models")
async def get_models():
    return engine.list_models()

@app.post("/api/models/download")
async def download_model(req: ModelActionRequest):
    engine.download_model(req.model_id)
    return {"status": "started", "model_id": req.model_id}

@app.post("/api/models/load")
async def load_model(req: ModelActionRequest):
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, engine.load_model, req.model_id)
        return {"status": "loaded", "current_model": req.model_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat_sse(req: GenerationRequest):
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Il prompt non può essere vuoto.")
        
    async def sse_generator():
        def get_all_chunks():
            return list(engine.generate_stream(
                prompt=req.prompt,
                system_prompt=req.system_prompt or "",
                temperature=req.temperature or 0.7,
                max_tokens=req.max_tokens or 512
            ))
            
        loop = asyncio.get_event_loop()
        chunks = await loop.run_in_executor(None, get_all_chunks)
        
        for c in chunks:
            yield f"data: {json.dumps(c)}\n\n"
            await asyncio.sleep(0.01)
            
        yield "data: {\"done\": true}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            prompt = payload.get("prompt", "")
            if not prompt:
                continue

            for chunk in engine.generate_stream(
                prompt=prompt,
                system_prompt=payload.get("system_prompt", ""),
                temperature=float(payload.get("temperature", 0.7)),
                max_tokens=int(payload.get("max_tokens", 512))
            ):
                await websocket.send_json(chunk)
                await asyncio.sleep(0.01)
                
            await websocket.send_json({"done": True})
    except:
        pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
