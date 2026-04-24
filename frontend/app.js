"use strict";

const API = "http://localhost:8000";

// ─── DOM refs ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const headerCount   = $("header-count");
const dbCount       = $("db-count");
const dbBarFill     = $("db-bar-fill");
const hintCount     = $("hint-count");
const countRange    = $("count-range");
const countVal      = $("count-val");
const topicInput    = $("topic-input");
const searchInput   = $("search-input");
const articlesGrid  = $("articles-grid");
const feedEmpty     = $("feed-empty");
const feedCountBadge= $("feed-count-badge");
const fetchBtn      = $("fetch-btn");
const chatArea      = $("chat-area");
const chatInput     = $("chat-input");
const sendBtn       = $("send-btn");
const clearChatBtn  = $("clear-chat-btn");
const loadingOverlay= $("loading-overlay");
const loadingText   = $("loading-text");
const loadingSub    = $("loading-sub");
const toastContainer= $("toast-container");
const tickerContent = $("ticker-content");

let currentCount = 0;

// ─── Range slider ────────────────────────────────────────────
countRange.addEventListener("input", () => {
  countVal.textContent = countRange.value;
});

// ─── Tab switching ───────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === tab)
  );
  $("panel-feed").classList.toggle("active", tab === "feed");
  $("panel-chat").classList.toggle("active", tab === "chat");
}

// ─── Quick topic chips ───────────────────────────────────────
document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    topicInput.value = chip.dataset.topic || chip.textContent.trim();
    fetchNews();
  });
});

// ─── Suggestion buttons ──────────────────────────────────────
function bindSuggestions() {
  document.querySelectorAll(".suggestion").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.q || btn.textContent.trim();
      chatInput.value = q;
      sendMessage();
    });
  });
}

// ─── Fetch news ──────────────────────────────────────────────
fetchBtn.addEventListener("click", fetchNews);

async function fetchNews() {
  const topic = topicInput.value.trim();
  const count = parseInt(countRange.value, 10);
  if (!topic) { showToast("Please enter a topic", "error"); return; }

  fetchBtn.disabled = true;
  fetchBtn.innerHTML = `<span class="spin-icon"></span> Ingesting...`;

  showLoading(`Fetching ${count} articles on "${topic}"`, "Connecting to NewsAPI...");
  animateSteps();

  try {
    const res = await fetch(`${API}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, count })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to ingest");
    showToast(`✓ ${data.message}`, "success");
    await refreshStats();
    await loadArticles();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    hideLoading();
    fetchBtn.disabled = false;
    fetchBtn.innerHTML = `
      <span class="btn-glow"></span>
      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/><path d="M1 11h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      Ingest Articles`;
  }
}

// ─── Stats ───────────────────────────────────────────────────
async function refreshStats() {
  try {
    const res  = await fetch(`${API}/stats`);
    const data = await res.json();
    const count = data.article_count || 0;
    currentCount = count;

    animateCounter(dbCount, count);
    headerCount.textContent = `${count} indexed`;
    hintCount.textContent   = count;

    // bar goes up to 500 as "full"
    const pct = Math.min(100, (count / 500) * 100).toFixed(1);
    dbBarFill.style.width = `${pct}%`;
  } catch {
    dbCount.textContent = "—";
  }
}

function animateCounter(el, target) {
  const start = parseInt(el.textContent) || 0;
  const steps = 30;
  const inc   = (target - start) / steps;
  let cur = start, s = 0;
  const id = setInterval(() => {
    s++;
    cur += inc;
    el.textContent = Math.round(cur);
    if (s >= steps) { el.textContent = target; clearInterval(id); }
  }, 20);
}

// ─── Load & render articles ───────────────────────────────────
searchInput.addEventListener("input", loadArticles);

async function loadArticles() {
  try {
    const search = searchInput.value.trim();
    const url = search
      ? `${API}/articles?search=${encodeURIComponent(search)}`
      : `${API}/articles`;
    const res  = await fetch(url);
    const data = await res.json();
    renderArticles(data.articles || [], data.total || 0);
  } catch (err) {
    console.error(err);
  }
}

function renderArticles(articles, total) {
  feedCountBadge.textContent = `${total} article${total !== 1 ? "s" : ""}`;

  if (!articles.length) {
    feedEmpty.style.display = "flex";
    articlesGrid.innerHTML  = "";
    return;
  }

  feedEmpty.style.display = "none";

  articlesGrid.innerHTML = articles.map((a, i) => {
    const imgHtml = a.image
      ? `<img class="article-img" src="${esc(a.image)}" alt="" loading="lazy"
             onerror="this.parentElement.innerHTML='<div class=\\'article-img-placeholder\\'>NO IMAGE</div>'">`
      : `<div class="article-img-placeholder">NO IMAGE</div>`;

    const date  = (a.date || "").slice(0, 10);
    const topic = esc(a.topic || "");

    return `
    <div class="article-card" style="animation-delay:${(i % 12) * 0.04}s">
      <div class="article-img-wrap">
        ${imgHtml}
        <div class="article-img-overlay"></div>
      </div>
      <div class="article-body">
        <div class="article-topic-row">
          <span class="article-topic">${topic}</span>
          <span class="article-date">${date}</span>
        </div>
        <div class="article-title">${esc(a.title || "Untitled")}</div>
        <div class="article-footer">
          <span class="article-source">${esc(a.source || "Unknown")}</span>
          ${a.link ? `<a class="article-link" href="${esc(a.link)}" target="_blank" rel="noopener">Read ↗</a>` : ""}
        </div>
      </div>
    </div>`;
  }).join("");

  updateTicker(articles);
}

// ─── Ticker ──────────────────────────────────────────────────
function updateTicker(articles) {
  if (!articles.length) return;
  const titles = articles
    .slice(0, 20)
    .map(a => a.title || "")
    .filter(Boolean)
    .join("  ·  ");
  const doubled = titles + "  ·  " + titles;
  tickerContent.textContent = doubled;
}

// ─── Chat ─────────────────────────────────────────────────────
sendBtn.addEventListener("click", sendMessage);
clearChatBtn.addEventListener("click", clearChat);

chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

async function sendMessage() {
  const query = chatInput.value.trim();
  if (!query) return;

  const welcome = $("chat-welcome");
  if (welcome) welcome.remove();

  appendUserMsg(query);
  chatInput.value = "";
  sendBtn.disabled = true;
  chatInput.disabled = true;

  const typingId = appendTyping();

  try {
    const res  = await fetch(`${API}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, top_k: 5 })
    });
    const data = await res.json();
    removeTyping(typingId);

    if (!res.ok) throw new Error(data.detail || "Request failed");
    appendAssistantMsg(data.answer, data.sources || []);
  } catch (err) {
    removeTyping(typingId);
    appendAssistantMsg(`⚠ ${err.message}`, []);
  } finally {
    sendBtn.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
}

function appendUserMsg(text) {
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const el  = document.createElement("div");
  el.className = "msg user";
  el.innerHTML = `
    <div class="msg-avatar">U</div>
    <div class="msg-body">
      <div class="bubble">${esc(text)}</div>
      <div class="msg-time">${now}</div>
    </div>`;
  chatArea.appendChild(el);
  scrollChat();
}

function appendAssistantMsg(text, sources) {
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const uid = "src-" + Date.now();

  const sourcesHtml = sources.length ? `
    <button class="sources-toggle" onclick="toggleSources('${uid}', this)">
      <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="4" height="4" rx="1" fill="currentColor"/><rect x="7" y="1" width="4" height="4" rx="1" fill="currentColor" opacity=".5"/><rect x="1" y="7" width="4" height="4" rx="1" fill="currentColor" opacity=".5"/><rect x="7" y="7" width="4" height="4" rx="1" fill="currentColor"/></svg>
      ${sources.length} source${sources.length > 1 ? "s" : ""} used
      <span id="arrow-${uid}">▾</span>
    </button>
    <div class="sources-panel" id="${uid}">
      ${sources.map(s => {
        const img = s.image
          ? `<img class="source-thumb" src="${esc(s.image)}" loading="lazy" onerror="this.outerHTML='<div class=\\'source-thumb-placeholder\\'>—</div>'">`
          : `<div class="source-thumb-placeholder">—</div>`;
        return `<div class="source-card">
          ${img}
          <div class="source-info">
            <div class="source-title">${esc(s.title || "Untitled")}</div>
            <div class="source-meta">${esc(s.source || "")} · ${(s.date || "").slice(0,10)}</div>
            ${s.link ? `<a class="source-link" href="${esc(s.link)}" target="_blank" rel="noopener">Read article ↗</a>` : ""}
          </div>
        </div>`;
      }).join("")}
    </div>` : "";

  const el = document.createElement("div");
  el.className = "msg assistant";
  el.innerHTML = `
    <div class="msg-avatar">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="currentColor" stroke-width="1"/><circle cx="7" cy="7" r="2" fill="currentColor"/></svg>
    </div>
    <div class="msg-body">
      <div class="bubble">${esc(text).replace(/\n/g, "<br>")}</div>
      <div class="msg-time">${now}</div>
      ${sourcesHtml}
    </div>`;
  chatArea.appendChild(el);
  scrollChat();
}

function toggleSources(uid, btn) {
  const panel = $(uid);
  const arrow = $(`arrow-${uid}`);
  const open  = panel.classList.toggle("open");
  if (arrow) arrow.textContent = open ? "▴" : "▾";
}

function appendTyping() {
  const id = "typing-" + Date.now();
  const el = document.createElement("div");
  el.className = "msg assistant";
  el.id = id;
  el.innerHTML = `
    <div class="msg-avatar">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="currentColor" stroke-width="1"/><circle cx="7" cy="7" r="2" fill="currentColor"/></svg>
    </div>
    <div class="typing-bubble">
      <span class="t-dot"></span>
      <span class="t-dot"></span>
      <span class="t-dot"></span>
    </div>`;
  chatArea.appendChild(el);
  scrollChat();
  return id;
}

function removeTyping(id) {
  const el = $(id);
  if (el) el.remove();
}

function scrollChat() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

function clearChat() {
  chatArea.innerHTML = `
    <div class="chat-welcome" id="chat-welcome">
      <div class="welcome-glyph">
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <path d="M30 5L55 17.5V42.5L30 55L5 42.5V17.5L30 5Z" stroke="currentColor" stroke-width="1.2" opacity="0.3"/>
          <path d="M30 15L45 22.5V37.5L30 45L15 37.5V22.5L30 15Z" stroke="currentColor" stroke-width="1" opacity="0.5"/>
          <circle cx="30" cy="30" r="8" stroke="currentColor" stroke-width="1.2" opacity="0.7"/>
          <circle cx="30" cy="30" r="3" fill="currentColor"/>
        </svg>
      </div>
      <h2 class="welcome-title">Ask the Intelligence</h2>
      <p class="welcome-sub">Powered by Retrieval-Augmented Generation — I search your indexed articles then synthesize with Gemini 2.5 Flash.</p>
      <div class="suggestions">
        <button class="suggestion" data-q="What are the latest AI breakthroughs?">Latest AI breakthroughs</button>
        <button class="suggestion" data-q="Summarize the most important news today">Summarize today's news</button>
        <button class="suggestion" data-q="What is happening in the stock market?">Stock market update</button>
        <button class="suggestion" data-q="Tell me about recent geopolitical events">Geopolitical events</button>
      </div>
    </div>`;
  bindSuggestions();
  showToast("Conversation cleared", "info");
}

// ─── Loading overlay ─────────────────────────────────────────
function showLoading(text, sub) {
  loadingText.textContent = text;
  loadingSub.textContent  = sub;
  loadingOverlay.classList.remove("hidden");
  resetSteps();
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
  resetSteps();
}

function resetSteps() {
  ["step-fetch","step-embed","step-store"].forEach(id => {
    const el = $(id);
    if (el) { el.classList.remove("active","done"); }
  });
}

function animateSteps() {
  const steps = ["step-fetch","step-embed","step-store"];
  const delays = [300, 1800, 3200];
  steps.forEach((id, i) => {
    setTimeout(() => {
      steps.slice(0, i).forEach(prev => {
        const el = $(prev);
        if (el) { el.classList.remove("active"); el.classList.add("done"); }
      });
      const el = $(id);
      if (el) el.classList.add("active");
      if (id === "step-fetch") loadingSub.textContent = "Fetching from NewsAPI...";
      if (id === "step-embed") loadingSub.textContent = "Generating MiniLM embeddings...";
      if (id === "step-store") loadingSub.textContent = "Writing to ChromaDB...";
    }, delays[i]);
  });
}

// ─── Toast ───────────────────────────────────────────────────
function showToast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s, transform 0.3s";
    el.style.opacity = "0";
    el.style.transform = "translateX(20px)";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ─── Escape HTML ─────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Init ────────────────────────────────────────────────────
async function init() {
  bindSuggestions();
  await refreshStats();
  await loadArticles();
}

init();