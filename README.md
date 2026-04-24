# 📰 News RAG Bot — AI-Powered News Chatbot

A **Retrieval-Augmented Generation (RAG)** web application that fetches live news articles, stores them in a vector database, and allows users to ask questions using an AI model powered by **Google Gemini**.

---

## 🏗️ System Architecture

```
User Browser
     ↓
Frontend (HTML / CSS / JavaScript)
     ↓
FastAPI Backend
     ↓
HuggingFace Embeddings (all-MiniLM-L6-v2)
     ↓
ChromaDB (Vector Database)
     ↓
Google Gemini 2.5 Flash (LLM)
     ↓
Answer returned to Frontend
```

---

## 🛠️ Tech Stack

### Backend
| Tool | Purpose |
|------|---------|
| Python 3.10 | Core language |
| FastAPI | REST API framework |
| LangChain | RAG orchestration |
| Uvicorn | ASGI server |
| Requests | HTTP client |

### Frontend
| Tool | Purpose |
|------|---------|
| HTML | Structure |
| CSS | Styling |
| JavaScript | Interactivity |

### AI / ML
| Tool | Purpose |
|------|---------|
| HuggingFace sentence-transformers | Text embeddings |
| ChromaDB | Vector database |
| Google Gemini 2.5 Flash | LLM answer generation |
| LangChain | RAG pipeline |

### Infrastructure
| Tool | Purpose |
|------|---------|
| AWS EC2 (Ubuntu 22.04) | Cloud hosting |
| Nginx | Reverse proxy |
| systemd | Process management |
| GitHub | Version control |

---

## 📁 Project Structure

```
News-RAG/
│
├── backend/
│   ├── main.py                  # FastAPI application entry point
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # API keys (not in GitHub)
│   ├── routes/
│   │   ├── chat.py              # /ask route
│   │   └── ingest.py            # /ingest route
│   ├── services/
│   │   ├── news_fetcher.py      # NewsAPI integration
│   │   ├── embedder.py          # HuggingFace embeddings
│   │   ├── retriever.py         # ChromaDB semantic search
│   │   └── generator.py         # Gemini LLM answer generation
│   └── database/
│       └── chroma_store.py      # ChromaDB setup and config
│
├── frontend/
│   ├── index.html               # Main UI
│   ├── style.css                # Styling
│   └── app.js                   # Frontend logic
│
├── .gitignore
└── README.md
```

---

## ✨ Features

- 📰 **Live News Fetching** — Fetches latest articles from NewsAPI on any topic
- 🔍 **Semantic Search** — HuggingFace embeddings for intelligent article retrieval
- 🤖 **AI Answers** — Gemini 2.5 Flash generates grounded answers from articles
- 💬 **Chat Interface** — Clean HTML/JS chat UI with source display
- 🖼️ **Article Images** — Displays news images alongside sources
- 🔁 **Duplicate Prevention** — Avoids re-ingesting same articles
- ☁️ **EC2 Ready** — Deployable on AWS EC2 for 24/7 uptime

---

## ⚙️ Environment Variables

Create a `.env` file inside the `backend/` folder:

```
NEWS_API_KEY=your_newsapi_key
GEMINI_API_KEY=your_gemini_api_key
CHROMA_DIR=./chroma_db
```

> ⚠️ **Important:** Never push `.env` to GitHub. It is already listed in `.gitignore`.

### Get API Keys
- **NewsAPI** → https://newsapi.org (free)
- **Gemini API** → https://aistudio.google.com/apikey (free)

---

## 🚀 Local Installation

### Step 1 — Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/News-RAG.git
cd News-RAG
```

### Step 2 — Create Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / Mac
python3 -m venv venv
source venv/bin/activate
```

### Step 3 — Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Step 4 — Create `.env` File

```bash
cd backend
nano .env
```

Add your API keys and save.

---

## ▶️ Run the Application

### Start Backend

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend running at: `http://localhost:8000`

### Start Frontend

Open a new terminal:

```bash
cd frontend
python -m http.server 5500
```

Open in browser: `http://localhost:5500`

---

## 🔌 API Endpoints

### Health Check
```
GET /
```

### Fetch & Ingest News
```
POST /ingest

{
  "topic": "artificial intelligence",
  "count": 20
}
```

### Get Stored Articles
```
GET /articles
```

### Ask AI a Question
```
POST /ask

{
  "query": "What is happening in AI?",
  "top_k": 5
}
```

---

## 🔄 How RAG Pipeline Works

```
1. User asks a question
        ↓
2. Question converted to embedding (HuggingFace)
        ↓
3. ChromaDB finds semantically similar articles
        ↓
4. Top articles sent as context to Gemini
        ↓
5. Gemini generates grounded answer with sources
        ↓
6. Answer + Sources returned to frontend
```

---

## ☁️ AWS EC2 Deployment

### Production Architecture

```
Browser
   ↓
Nginx (Port 80)
   ↓
FastAPI via Uvicorn (Port 8000)
   ↓
ChromaDB (Local)
   ↓
Gemini API
```

### Step 1 — Launch EC2 Instance

```
OS: Ubuntu 22.04 LTS
Instance: t2.medium (recommended)
Storage: 20GB
Open Ports: 22, 80, 443, 8000
```

### Step 2 — Connect to EC2

```bash
ssh -i "your-key.pem" ubuntu@your-ec2-public-ip
```

### Step 3 — Setup Server

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3 python3-pip python3-venv git -y
```

### Step 4 — Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/News-RAG.git
cd News-RAG
```

### Step 5 — Setup Python Environment

```bash
python3 -m venv venv
source venv/bin/activate
cd backend
pip install -r requirements.txt
```

### Step 6 — Create `.env` on EC2

```bash
nano .env
```

Add your API keys.

### Step 7 — Run Backend

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Step 8 — Run Frontend

```bash
cd ../frontend
python3 -m http.server 5500
```

---

## 🔁 Keep App Running 24/7

### Using systemd

```bash
sudo nano /etc/systemd/system/ragapp.service
```

Paste:

```ini
[Unit]
Description=News RAG Bot
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/News-RAG/backend
Environment="PATH=/home/ubuntu/News-RAG/venv/bin"
ExecStart=/home/ubuntu/News-RAG/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ragapp
sudo systemctl start ragapp
sudo systemctl status ragapp
```

### Using Screen (Quick Option)

```bash
sudo apt install screen -y
screen -S ragapp
uvicorn main:app --host 0.0.0.0 --port 8000
# Press Ctrl+A then D to detach
```

---

## 🔒 Security Notes

- `.env` is ignored by Git via `.gitignore`
- API keys are never stored in the repository
- ChromaDB data folder is excluded from Git
- CORS is enabled for frontend-backend communication

---

## 🔧 Useful Commands

| Command | Purpose |
|---------|---------|
| `sudo systemctl status ragapp` | Check app status |
| `sudo systemctl restart ragapp` | Restart app |
| `sudo systemctl stop ragapp` | Stop app |
| `sudo journalctl -u ragapp -f` | View live logs |
| `git pull && sudo systemctl restart ragapp` | Update app |
| `screen -r ragapp` | Reattach screen session |

---

## 🚀 Future Improvements

- Docker containerization
- HTTPS with SSL certificate
- Background news scheduler (auto-refresh)
- Streaming responses
- Logging and monitoring system
- Multi-language support

---

## 👤 Author

**Sahil Nimse**
- GitHub: [Sahil Nimse](https://github.com/sahillnimse)
- LinkedIn: [Sahil Nimse](https://www.linkedin.com/in/sahillnimse)
- Portfolio: [Sahil Nimse](https://sahil-nimse-7d6psr4.gamma.site/)

---

## 📄 License

This project is intended for educational and development use.