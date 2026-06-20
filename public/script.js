const params = new URLSearchParams(location.search);
const role = params.get("role") === "agent" ? "agent" : "customer";
const room = params.get("room") || "demo";

const roleBadge = document.getElementById("roleBadge");
const roomLabel = document.getElementById("roomLabel");
const chatTitle = document.getElementById("chatTitle");
const chatSubTitle = document.getElementById("chatSubTitle");
const messageList = document.getElementById("messageList");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const resetButton = document.getElementById("resetButton");
const openCustomerLink = document.getElementById("openCustomerLink");
const openAgentLink = document.getElementById("openAgentLink");
const quickChips = document.querySelectorAll(".quick-chip");

const channel = new BroadcastChannel(`soft-cs-${room}`);
const STORAGE_KEY = `soft-cs-history-${room}`;

const ROLE_LABEL = {
  customer: "お客さま画面",
  agent: "従業員画面"
};

init();

function init() {
  setupHeader();
  renderMessages(loadMessages());

  chatForm.addEventListener("submit", handleSend);
  resetButton.addEventListener("click", handleReset);

  quickChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      messageInput.value = chip.dataset.quick || "";
      messageInput.focus();
    });
  });

  channel.onmessage = (event) => {
    const data = event.data;

    if (data.type === "new-message") {
      const messages = loadMessages();
      if (!messages.some((m) => m.id === data.message.id)) {
        messages.push(data.message);
        saveMessages(messages);
      }
      renderMessages(loadMessages());
    }

    if (data.type === "reset") {
      localStorage.removeItem(STORAGE_KEY);
      renderMessages([]);
    }
  };

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      renderMessages(loadMessages());
    }
  });
}

function setupHeader() {
  roleBadge.textContent = ROLE_LABEL[role];
  roleBadge.className = `role-badge ${role}`;
  roomLabel.textContent = room;

  if (role === "customer") {
    chatTitle.textContent = "お客さまチャット";
    chatSubTitle.textContent =
      "あなたの送信文はそのまま表示され、従業員側には柔らかく変換された文が届きます。";
  } else {
    chatTitle.textContent = "従業員チャット";
    chatSubTitle.textContent =
      "あなたの送信文はそのまま表示され、お客さま側には柔らかく変換された文が届きます。";
  }

  openCustomerLink.href = `${location.pathname}?role=customer&room=${encodeURIComponent(room)}`;
  openAgentLink.href = `${location.pathname}?role=agent&room=${encodeURIComponent(room)}`;
}

function loadMessages() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveMessages(messages) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

function renderMessages(messages) {
  messageList.innerHTML = "";

  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <p>まだメッセージはありません。</p>
      <p>別タブでお客さま画面・従業員画面を開いて送信してみてください。</p>
    `;
    messageList.appendChild(empty);
    return;
  }

  messages
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((message) => {
      const isSelf = message.from === role;
      const row = document.createElement("div");
      row.className = `message-row ${isSelf ? "self" : "other"}`;

      const bubble = document.createElement("div");
      bubble.className = "message-bubble";

      const meta = document.createElement("div");
      meta.className = "message-meta";

      const text = document.createElement("div");
      text.className = "message-text";

      if (isSelf) {
        meta.textContent = "あなたが送信";
        text.textContent = message.original;
      } else {
        meta.textContent =
          message.from === "customer"
            ? "お客さまから受信"
            : "従業員から受信";

        text.textContent = message.softened;

        const aiBadge = document.createElement("div");
        aiBadge.className = "ai-badge";
        aiBadge.textContent = "AIで柔らかく変換";
        bubble.appendChild(aiBadge);
      }

      bubble.prepend(text);
      bubble.prepend(meta);
      row.appendChild(bubble);
      messageList.appendChild(row);
    });

  messageList.scrollTop = messageList.scrollHeight;
}

async function handleSend(event) {
  event.preventDefault();

  const original = messageInput.value.trim();
  if (!original) {
    alert("メッセージを入力してください。");
    return;
  }

  setSending(true);

  try {
    const softened = await softenMessage(original);

    const message = {
      id: crypto.randomUUID(),
      room,
      from: role,
      original,
      softened,
      createdAt: Date.now()
    };

    const messages = loadMessages();
    messages.push(message);
    saveMessages(messages);
    renderMessages(messages);

    channel.postMessage({
      type: "new-message",
      message
    });

    messageInput.value = "";
    messageInput.focus();
  } catch (error) {
    console.error(error);
    alert(error.message || "送信に失敗しました。");
  } finally {
    setSending(false);
  }
}

async function softenMessage(text) {
  const direction =
    role === "customer" ? "customer_to_agent" : "agent_to_customer";

  const response = await fetch("/api/soften", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text,
      direction
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "AI変換に失敗しました。");
  }

  return data.result;
}

function handleReset() {
  if (!confirm("このルームの会話をリセットしますか？")) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  renderMessages([]);

  channel.postMessage({
    type: "reset"
  });
}

function setSending(isSending) {
  sendButton.disabled = isSending;
  sendButton.textContent = isSending ? "変換して送信中..." : "送信する";
}
