(function () {
  const currentScript = document.currentScript ||
    [...document.querySelectorAll('script')]
    .find(s => s.src.includes('chatbot.js'));

  const API_KEY = new URL(currentScript.src).searchParams.get('key');
  const SESSION_ID = parseInt(10000*Math.random())
  const BACKEND_URL = "http://127.0.0.1:5000/chat";
  let conversationHistory = [];
  let isOpen = false;

  // ── Inject styles ──────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #chatbot-btn {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #1a73e8;
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.22);
      font-size: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      transition: background 0.2s, transform 0.2s;
    }
    #chatbot-btn:hover { background: #1558b0; transform: scale(1.07); }

    #chatbot-window {
      position: fixed;
      bottom: 96px;
      right: 28px;
      width: 340px;
      max-height: 500px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      display: flex;
      flex-direction: column;
      z-index: 99998;
      overflow: hidden;
      font-family: 'Segoe UI', Arial, sans-serif;
      transition: opacity 0.2s, transform 0.2s;
      opacity: 0;
      transform: translateY(12px) scale(0.98);
      pointer-events: none;
    }
    #chatbot-window.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }

    #chatbot-header {
      background: #1a73e8;
      color: #fff;
      padding: 14px 18px;
      font-weight: 600;
      font-size: 15px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #chatbot-header span { display: flex; align-items: center; gap: 8px; }
    #chatbot-header .dot {
      width: 9px; height: 9px;
      background: #4cff91;
      border-radius: 50%;
      display: inline-block;
    }
    #chatbot-close {
      background: none;
      border: none;
      color: #fff;
      font-size: 20px;
      cursor: pointer;
      line-height: 1;
      padding: 0;
    }

    #chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 14px 14px 6px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f4f6fb;
    }
    .cb-msg {
      max-width: 82%;
      padding: 9px 13px;
      border-radius: 12px;
      font-size: 13.5px;
      line-height: 1.5;
      word-wrap: break-word;
    }
    .cb-msg.bot {
      background: #fff;
      color: #222;
      align-self: flex-start;
      border-bottom-left-radius: 3px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    .cb-msg.user {
      background: #1a73e8;
      color: #fff;
      align-self: flex-end;
      border-bottom-right-radius: 3px;
    }
    .cb-msg.typing { color: #888; font-style: italic; }

    #chatbot-input-row {
      display: flex;
      padding: 10px 12px;
      background: #fff;
      border-top: 1px solid #e8eaf0;
      gap: 8px;
    }
    #chatbot-input {
      flex: 1;
      border: 1px solid #dde1ee;
      border-radius: 20px;
      padding: 8px 14px;
      font-size: 13.5px;
      outline: none;
      transition: border 0.2s;
      resize: none;
    }
    #chatbot-input:focus { border-color: #1a73e8; }
    #chatbot-send {
      background: #1a73e8;
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
    }
    #chatbot-send:hover { background: #1558b0; }
    #chatbot-send:disabled { background: #a0b4d6; cursor: not-allowed; }
  `;
  document.head.appendChild(style);

  // ── Build HTML ─────────────────────────────────────────────────
  document.body.insertAdjacentHTML("beforeend", `
    <button id="chatbot-btn" title="Chat with us">💬</button>
    <div id="chatbot-window">
      <div id="chatbot-header">
        <span><span class="dot"></span> Novena Support</span>
        <button id="chatbot-close" title="Close">×</button>
      </div>
      <div id="chatbot-messages"></div>
      <div id="chatbot-input-row">
        <input id="chatbot-input" type="text" placeholder="Type a message…" autocomplete="off" />
        <button id="chatbot-send">➤</button>
      </div>
    </div>
  `);

  // ── References ─────────────────────────────────────────────────
  const btn       = document.getElementById("chatbot-btn");
  const win       = document.getElementById("chatbot-window");
  const closeBtn  = document.getElementById("chatbot-close");
  const messages  = document.getElementById("chatbot-messages");
  const input     = document.getElementById("chatbot-input");
  const sendBtn   = document.getElementById("chatbot-send");

  // ── Helpers ────────────────────────────────────────────────────
  function addMessage(text, role) {
    const div = document.createElement("div");
    div.className = `cb-msg ${role}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function toggleChat() {
    isOpen = !isOpen;
    win.classList.toggle("open", isOpen);
    btn.textContent = isOpen ? "✕" : "💬";
    if (isOpen && conversationHistory.length === 0) {
      addMessage("I can find actual 3BHK deals in Andheri under ₹50k in 30 sec. Want that?", "bot");
    }
    if (isOpen) input.focus();
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    sendBtn.disabled = true;
    addMessage(text, "user");
    conversationHistory.push({ role: "user", content: text });

    const typingDiv = addMessage("Typing…", "bot typing");

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            messages: conversationHistory,
            api_key: API_KEY,
            session_id: SESSION_ID
      }),
      });
      const data = await res.json();
      const reply = data.reply || "Sorry, I couldn't get a response.";
      typingDiv.remove();
      addMessage(reply, "bot");
      conversationHistory.push({ role: "assistant", content: reply });
    } catch (err) {
      typingDiv.remove();
      addMessage("⚠️ Could not reach the server. Make sure the backend is running.", "bot");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // ── Events ─────────────────────────────────────────────────────
  btn.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);
  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
})();
