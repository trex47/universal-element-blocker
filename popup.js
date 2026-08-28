(() => {
  "use strict";

  const DEFAULT_RULES = [
    {
      id: "default-ibit-ufabomb",
      type: "url",
      value: "ibit.ly/ufabomb",
      action: "remove"
    }
  ];

  const elements = {
    currentHost: document.querySelector("#current-host"),
    siteEnabled: document.querySelector("#site-enabled"),
    form: document.querySelector("#rule-form"),
    type: document.querySelector("#rule-type"),
    value: document.querySelector("#rule-value"),
    action: document.querySelector("#rule-action"),
    error: document.querySelector("#form-error"),
    list: document.querySelector("#rules-list"),
    empty: document.querySelector("#empty-state")
  };

  let currentHost = "";
  let rules = [];
  let disabledHosts = [];

  function makeId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  }

  function validateRule(type, value) {
    if (!value.trim()) return "กรุณากรอกค่าของกฎ";

    if (type === "selector") {
      try {
        document.querySelector(value);
      } catch {
        return "CSS selector ไม่ถูกต้อง";
      }
    }

    return "";
  }

  function renderRules() {
    elements.list.replaceChildren();
    elements.empty.hidden = rules.length > 0;

    for (const rule of rules) {
      const item = document.createElement("li");
      item.className = "rule";

      const description = document.createElement("div");
      const value = document.createElement("div");
      value.className = "rule-value";
      value.textContent = rule.value;

      const meta = document.createElement("div");
      meta.className = "rule-meta";
      meta.textContent = `${rule.type === "selector" ? "CSS selector" : "URL"} · ${
        rule.action === "hide" ? "ซ่อน" : "ลบ"
      }`;

      const button = document.createElement("button");
      button.className = "delete-rule";
      button.type = "button";
      button.textContent = "ลบ";
      button.dataset.ruleId = rule.id;
      button.setAttribute("aria-label", `ลบกฎ ${rule.value}`);

      description.append(value, meta);
      item.append(description, button);
      elements.list.append(item);
    }
  }

  async function saveRules() {
    await chrome.storage.local.set({ rules });
    renderRules();
  }

  async function initialize() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    try {
      currentHost = new URL(tab?.url ?? "").hostname;
    } catch {
      currentHost = "";
    }

    const stored = await chrome.storage.local.get({
      rules: DEFAULT_RULES,
      disabledHosts: []
    });

    rules = Array.isArray(stored.rules) ? stored.rules : DEFAULT_RULES;
    disabledHosts = Array.isArray(stored.disabledHosts) ? stored.disabledHosts : [];

    elements.currentHost.textContent = currentHost || "หน้านี้ Chrome ไม่อนุญาตให้แก้ไข";
    elements.siteEnabled.checked = Boolean(currentHost) && !disabledHosts.includes(currentHost);
    elements.siteEnabled.disabled = !currentHost;
    renderRules();
  }

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const type = elements.type.value;
    const value = elements.value.value.trim();
    const error = validateRule(type, value);
    elements.error.textContent = error;
    if (error) return;

    rules.push({ id: makeId(), type, value, action: elements.action.value });
    await saveRules();
    elements.form.reset();
    elements.value.focus();
  });

  elements.list.addEventListener("click", async (event) => {
    const button = event.target.closest(".delete-rule");
    if (!button) return;

    rules = rules.filter((rule) => rule.id !== button.dataset.ruleId);
    await saveRules();
  });

  elements.siteEnabled.addEventListener("change", async () => {
    if (!currentHost) return;

    const hosts = new Set(disabledHosts);
    if (elements.siteEnabled.checked) hosts.delete(currentHost);
    else hosts.add(currentHost);

    disabledHosts = [...hosts];
    await chrome.storage.local.set({ disabledHosts });
  });

  void initialize();
})();
