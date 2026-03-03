import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Optional
import os
import json
import time
import httpx
from datetime import datetime, timezone

app = FastAPI()

CHATS_DIR = "chats"
os.makedirs(CHATS_DIR, exist_ok=True)
os.makedirs("static", exist_ok=True)
os.makedirs("static/icons", exist_ok=True)
os.makedirs("templates", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3:8b"

class ChatMessage(BaseModel):
    content: str
    model: str = MODEL_NAME
    user_name: Optional[str] = None
    custom_instructions: Optional[str] = None

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/chats")
async def list_chats():
    chats = []
    for filename in os.listdir(CHATS_DIR):
        if filename.endswith(".json"):
            filepath = os.path.join(CHATS_DIR, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    chats.append({
                        "id": data.get("id"),
                        "title": data.get("title", "New Chat"),
                        "created_at": data.get("created_at", "")
                    })
            except Exception:
                pass
    chats.sort(key=lambda x: x["created_at"], reverse=True)
    return chats

@app.post("/new_chat")
async def create_chat():
    chat_id = f"chat-{int(time.time()*1000)}"
    chat_data = {
        "id": chat_id,
        "title": "New Chat",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "messages": []
    }
    filepath = os.path.join(CHATS_DIR, f"{chat_id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(chat_data, f, indent=2)
    return chat_data

@app.get("/chat/{chat_id}")
async def get_chat(chat_id: str):
    filepath = os.path.join(CHATS_DIR, f"{chat_id}.json")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Chat not found")
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

@app.delete("/chat/{chat_id}")
async def delete_chat(chat_id: str):
    filepath = os.path.join(CHATS_DIR, f"{chat_id}.json")
    if os.path.exists(filepath):
        os.remove(filepath)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Chat not found")

@app.get("/api/models")
async def get_models():
    """Fetch installed models from Ollama."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:11434/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = [model["name"] for model in data.get("models", [])]
                return {"models": models}
            else:
                return {"models": [], "error": f"Ollama returned status {response.status_code}"}
    except Exception as e:
        return {"models": [], "error": str(e)}

@app.post("/api/unload_model")
async def unload_model(body: dict):
    """Unload a model from memory by sending keep_alive: 0."""
    model_name = body.get("model")
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name is required")
    try:
        async with httpx.AsyncClient() as client:
            payload = {
                "model": model_name,
                "keep_alive": 0
            }
            response = await client.post("http://localhost:11434/api/generate", json=payload)
            if response.status_code == 200:
                return {"status": "success", "message": f"Model {model_name} unloaded successfully"}
            else:
                return {"status": "error", "message": f"Failed to unload model {model_name}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/chat/{chat_id}/message")
async def chat_message(chat_id: str, message: ChatMessage):
    filepath = os.path.join(CHATS_DIR, f"{chat_id}.json")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Chat not found")
    
    with open(filepath, "r", encoding="utf-8") as f:
        chat_data = json.load(f)

    if len(chat_data["messages"]) == 0:
        chat_data["title"] = message.content[:30] + ("..." if len(message.content) > 30 else "")
    
    chat_data["messages"].append({"role": "user", "content": message.content})
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(chat_data, f, indent=2)

    async def stream_generator():
        system_prompt = ""
        if os.path.exists("system_prompt.txt"):
            with open("system_prompt.txt", "r", encoding="utf-8") as sp_f:
                system_prompt = sp_f.read().strip()
                
        if message.user_name:
            system_prompt += f"\n\nThe user's name is {message.user_name}. Always refer to them by this name."
        if message.custom_instructions:
            system_prompt += f"\n\nObey the following custom instructions exactly:\n{message.custom_instructions}"

        prompt = ""
        for msg in chat_data["messages"]:
            prompt += f"{msg['role'].capitalize()}: {msg['content']}\n"
        prompt += "Assistant: "

        payload = {
            "model": message.model,
            "prompt": prompt,
            "stream": True
        }
        if system_prompt:
            payload["system"] = system_prompt
        
        assistant_content = ""
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", OLLAMA_URL, json=payload) as response:
                    if response.status_code != 200:
                        yield f"Error: Ollama returned status {response.status_code}"
                        return
                    
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                chunk = json.loads(line)
                                if "response" in chunk:
                                    token = chunk["response"]
                                    assistant_content += token
                                    yield token
                            except Exception:
                                pass
        except Exception as e:
            yield f"\n[Error connecting to Ollama: {str(e)}]"
        
        chat_data["messages"].append({"role": "assistant", "content": assistant_content})
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(chat_data, f, indent=2)

    return StreamingResponse(stream_generator(), media_type="text/plain")

def find_free_port(start_port=8000, max_port=8100):
    import socket
    for port in range(start_port, max_port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("Could not find a free port")

if __name__ == "__main__":
    port = find_free_port()
    print("\n" + "="*50)
    print("🚀 Starting Offline Chatbot Server...")
    print(f"🌐 Web UI available at: http://127.0.0.1:{port}")
    print("="*50 + "\n")
    uvicorn.run("main:app", host="127.0.0.1", port=port, log_level="warning")