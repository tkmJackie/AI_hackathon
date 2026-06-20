const customerMessages = document.getElementById("customerMessages");
const agentMessages = document.getElementById("agentMessages");

const customerForm = document.getElementById("customerForm");
const agentForm = document.getElementById("agentForm");

const customerInput = document.getElementById("customerInput");
const agentInput = document.getElementById("agentInput");

const customerSendButton = document.getElementById("customerSendButton");
const agentSendButton = document.getElementById("agentSendButton");

const resetButton = document.getElementById("resetButton");
const quickChips = document.querySelectorAll(".quick-chip");

const STORAGE_KEY = "soft-cs-one-page-history";

init();

function init() {
  renderAll();

  customerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSend("customer");
  });

  agentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSend("agent");
  });

  resetButton.addEventListener("click", () => {
    if (!confirm("会話をリセットしますか？")) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    renderAll();
  });

  quickChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const target = chip.dataset.target;
      const text = chip.dataset.text || "";

      if (target === "customer") {
        customerInput.value = text;
        customerInput.focus();
      }

      if (target === "agent") {
        agentInput.value = text;
        agentInput.focus();
      }
    });
  });
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

function renderAll() {
  const messages = loadMessages().sort((a, b) => a.createdAt - b.createdAt);

  renderPanel(customerMessages, messages, "customer");
  renderPanel(agentMessages, messages, "agent");
}

function renderPanel(container, messages, viewerRole) {
  container.innerHTML = "";

  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <p>まだ会話はありません。</p>
      <p>左右どちらかから、強めの言葉を送信してみてください。</p>
    `;
    container.appendChild(empty);
    return;
  }

  messages.forEach((message) => {
    const isSelf = message.from === viewerRole;

    const row = document.createElement("div");
    row.className = `message-row ${isSelf ? "self" : "other"}`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const text = document.createElement("div");
    text.className = "message-text";

    const badge = document.createElement("div");

    if (isSelf) {
      meta.textContent = "自分が送信した原文";
      text.textContent = message.original;
      badge.className = "original-badge";
      badge.textContent = "原文表示";
    } else {
      meta.textContent =
        message.from === "customer"
          ? "お客さまから受信"
          : "従業員から受信";

      text.textContent = message.softened;
      badge.className = "ai-badge";
      badge.textContent = "AIで柔らかく変換";
    }

    bubble.appendChild(meta);
    bubble.appendChild(text);
    bubble.appendChild(badge);
    row.appendChild(bubble);
    container.appendChild(row);
  });

  container.scrollTop = container.scrollHeight;
}

async function handleSend(from) {
  const input = from === "customer" ? customerInput : agentInput;
  const button = from === "customer" ? customerSendButton : agentSendButton;

  const original = input.value.trim();

  if (!original) {
    alert("メッセージを入力してください。");
    return;
  }

  setSending(button, true);

  try {
    const softened = await softenMessage(original, from);

    const message = {
      id: crypto.randomUUID(),
      from,
      original,
      softened,
      createdAt: Date.now()
    };

    const messages = loadMessages();
    messages.push(message);
    saveMessages(messages);

    input.value = "";
    renderAll();
  } catch (error) {
    console.error(error);
    alert(error.message || "送信に失敗しました。");
  } finally {
    setSending(button, false);
  }
}

async function softenMessage(text, from) {
  const direction =
    from === "customer" ? "customer_to_agent" : "agent_to_customer";

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

function setSending(button, isSending) {
  button.disabled = isSending;
  button.textContent = isSending ? "AI変換中..." : getDefaultButtonText(button);
}

function getDefaultButtonText(button) {
  if (button.id === "customerSendButton") {
    return "お客さまとして送信";
  }

  return "従業員として送信";
}
