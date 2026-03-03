# Offline Gemini – Local Ollama Chat Interface

A fully offline **Gemini-style AI chat interface** built using:

* **FastAPI** (Backend)
* **Ollama** (Local LLM Runtime)
* **Streaming responses**
* **Model switching**
* **Persistent chat history**
* **Modern dark UI**

This project provides a local, privacy-focused AI chat experience without any external API calls.

---

## Features

* Real-time streaming responses
* Dynamic model selection (from installed Ollama models)
* Chat history saved locally
* Custom user name + instructions
* Model unloading support
* Clean Gemini-inspired interface
* 100% offline

---

## Tech Stack

Backend:

* FastAPI
* Uvicorn
* HTTPX
* Pydantic

Frontend:

* HTML
* CSS
* Vanilla JavaScript
* Highlight.js (for code blocks)

---

## Project Structure

```
offline-gemini/
│
├── main.py
├── requirements.txt
├── system_prompt.txt
│
├── templates/
│   └── index.html
│
├── static/
│   ├── app.js
│   ├── style.css
│   └── icons/
│
└── chats/  (auto-created)
```

---

## Requirements

* Python 3.9+
* Ollama installed
* At least one Ollama model installed (example: llama3)

---

## Installation

### 1. Clone the repository

```
git clone https://github.com/YOUR_USERNAME/offline-gemini.git
cd offline-gemini
```

### 2. Create virtual environment (recommended)

```
python -m venv venv
```

Activate it:

Windows:

```
venv\Scripts\activate
```

Mac/Linux:

```
source venv/bin/activate
```

### 3. Install dependencies

```
pip install -r requirements.txt
```

---

## Install & Run Ollama

Download Ollama from:
https://ollama.com

Start Ollama(In command prompt):

```
ollama serve
```

Install a model (example):

```
ollama pull llama3:8b
```

---

## Run the Application

```
python main.py
```

It will automatically find a free port and print:

```
Web UI available at: http://127.0.0.1:PORT
```

Open that link in your browser.

---

## How It Works

* Frontend sends messages to FastAPI
* FastAPI builds prompt history
* Sends streaming request to Ollama
* Streams tokens back to browser
* Saves conversation locally as JSON

All conversations are stored inside:

```
/chats/
```

---

## Customization

You can modify assistant behavior inside:

```
system_prompt.txt
```

You can:

* Change personality
* Change tone
* Adjust formatting rules

---

## Model Switching

Click the model selector at bottom of UI.

When switching:

* Previous model is unloaded from memory
* New model is activated
* Saves RAM usage

---

## Privacy

* No external APIs
* No telemetry
* No cloud dependency
* Fully offline

---

## Future Improvements

* Docker support
* Authentication
* Multi-user mode
* Desktop packaging
* Mobile UI optimization

---

## License

Private project.
Modify and use as needed.
