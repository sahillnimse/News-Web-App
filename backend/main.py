import os
import warnings
import logging
from typing import Optional, List
from hashlib import md5

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from langchain_core.documents import Document
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

warnings.filterwarnings("ignore")
logging.getLogger("sentence_transformers").setLevel(logging.ERROR)

load_dotenv()

# ─────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
CHROMA_DIR = os.getenv("CHROMA_DIR", "./chroma_db")

if not NEWS_API_KEY:
    raise ValueError("NEWS_API_KEY is missing in .env")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is missing in .env")

# ─────────────────────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="News RAG API",
    version="2.0.0",
    description="FastAPI backend for News RAG frontend"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────
class IngestRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    count: int = Field(default=20, ge=1, le=100)

class AskRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=10)

# ─────────────────────────────────────────────────────────────
# Embeddings / Vector Store / LLM
# ─────────────────────────────────────────────────────────────
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs={"device": "cpu"}
)

vectorstore = Chroma(
    collection_name="news",
    embedding_function=embeddings,
    persist_directory=CHROMA_DIR
)

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=GEMINI_API_KEY,
    temperature=0.3,
    max_output_tokens=700
)

prompt_template = ChatPromptTemplate.from_template("""
You are a helpful and factual news assistant.

Use the retrieved news articles below to answer the user's question.

Rules:
- Answer only from the provided context.
- If the context is weak or partially relevant, say that clearly.
- Keep the answer clear and structured.
- Mention the main sources naturally in the answer.
- Do not invent facts.

Retrieved Context:
{context}

User Question:
{question}

Answer:
""")

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────
def make_doc_id(url: str, title: str) -> str:
    base = (url or title or "").strip().lower()
    return md5(base.encode("utf-8")).hexdigest()

def fetch_news(topic: str, count: int) -> List[dict]:
    url = "https://newsapi.org/v2/everything"
    params = {
        "q": topic,
        "pageSize": count,
        "sortBy": "publishedAt",
        "language": "en",
        "apiKey": NEWS_API_KEY,
    }

    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"News API request failed: {str(e)}")

    if data.get("status") != "ok":
        raise HTTPException(
            status_code=400,
            detail=data.get("message", "Failed to fetch news")
        )

    return data.get("articles", [])

def build_documents(topic: str, articles: List[dict]):
    docs = []
    ids = []

    for article in articles:
        title = article.get("title", "") or ""
        source = article.get("source", {}).get("name", "Unknown") or "Unknown"
        published_at = article.get("publishedAt", "") or ""
        description = article.get("description", "") or ""
        content = article.get("content", "") or ""
        url = article.get("url", "") or ""
        image = article.get("urlToImage", "") or ""

        page_content = f"""
Title: {title}
Source: {source}
Date: {published_at}
Description: {description}
Content: {content}
URL: {url}
""".strip()

        metadata = {
            "topic": topic,
            "title": title,
            "source": source,
            "date": published_at,
            "link": url,
            "image": image
        }

        doc_id = make_doc_id(url=url, title=title)

        docs.append(Document(page_content=page_content, metadata=metadata))
        ids.append(doc_id)

    return docs, ids

def ingest_news(topic: str, count: int) -> int:
    articles = fetch_news(topic, count)
    if not articles:
        return 0

    docs, ids = build_documents(topic, articles)

    existing = set(vectorstore.get()["ids"] or [])
    new_docs = []
    new_ids = []

    for doc, doc_id in zip(docs, ids):
        if doc_id not in existing:
            new_docs.append(doc)
            new_ids.append(doc_id)

    if new_docs:
        vectorstore.add_documents(new_docs, ids=new_ids)

    return len(new_docs)

def retrieve_docs(query: str, top_k: int = 5):
    results = vectorstore.similarity_search_with_score(query, k=top_k)
    retrieved = []

    for doc, score in results:
        retrieved.append({
            "content": doc.page_content,
            "meta": doc.metadata,
            "score": score
        })

    return retrieved

def generate_answer(query: str, retrieved_docs: list):
    if not retrieved_docs:
        return "No relevant articles found. Please fetch news first.", []

    context = "\n\n---\n\n".join(doc["content"] for doc in retrieved_docs)
    sources = [doc["meta"] for doc in retrieved_docs]

    try:
        prompt = prompt_template.format_messages(
            context=context,
            question=query
        )
        response = llm.invoke(prompt)
        answer_text = response.content if hasattr(response, "content") else str(response)
        return answer_text, sources
    except Exception as e:
        return f"Error generating answer: {str(e)}", sources

def get_all_articles(search: str = ""):
    data = vectorstore.get(include=["metadatas"])
    metadatas = data.get("metadatas") or []

    cleaned = []
    seen_links = set()

    for m in metadatas:
        link = m.get("link", "")
        if link and link in seen_links:
            continue
        if link:
            seen_links.add(link)
        cleaned.append(m)

    if search:
        s = search.lower().strip()
        cleaned = [
            m for m in cleaned
            if s in (m.get("title", "").lower())
            or s in (m.get("source", "").lower())
            or s in (m.get("topic", "").lower())
        ]

    cleaned.sort(key=lambda x: x.get("date", ""), reverse=True)
    return cleaned

# ─────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "News RAG API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/stats")
def stats():
    count = vectorstore._collection.count()
    return {"article_count": count}

@app.post("/ingest")
def ingest(body: IngestRequest):
    added = ingest_news(body.topic, body.count)
    return {
        "success": True,
        "message": f"Ingested {added} new articles for '{body.topic}'",
        "count": added
    }

@app.get("/articles")
def articles(search: str = Query(default="")):
    items = get_all_articles(search=search)
    return {
        "articles": items[:100],
        "total": len(items)
    }

@app.post("/ask")
def ask(body: AskRequest):
    article_count = vectorstore._collection.count()
    if article_count == 0:
        raise HTTPException(
            status_code=400,
            detail="No articles in database. Please fetch news first."
        )

    docs = retrieve_docs(body.query, top_k=body.top_k)
    answer, sources = generate_answer(body.query, docs)

    return {
        "answer": answer,
        "sources": sources
    }

# ─────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)