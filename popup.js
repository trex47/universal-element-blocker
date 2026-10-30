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
  const DEFAULT_SHORTCUT = {
    key: "q",
    altKey: true,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false
  };

  const elements = {
    currentHost: document.querySelector("#current-host"),
    siteEnabled: document.querySelector("#site-enabled"),
    pickerEnabled: document.querySelector("#picker-enabled"),
    pickerStatus: document.querySelector("#picker-status"),
    exportRules: document.querySelector("#export-rules"),
    importRules: document.querySelector("#import-rules"),
    importFile: document.querySelector("#import-file"),
    importStatus: document.querySelector("#import-status"),
    pickerShortcut: document.querySelector("#picker-shortcut"),
    changeShortcut: document.querySelector("#change-shortcut"),
    shortcutStatus: document.querySelector("#shortcut-status"),
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
  let pickerEnabled = false;
  let pickerShortcut = DEFAULT_SHORTCUT;
  let capturingShortcut = false;

  function makeId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  }

  function normalizeShortcut(value) {
    if (!value || typeof value.key !== "string" || !value.key.trim()) return DEFAULT_SHORTCUT;
    return {
      key: value.key,
      altKey: value.altKey === true,
      ctrlKey: value.ctrlKey === true,
      shiftKey: value.shiftKey === true,
      metaKey: value.metaKey === true
    };
  }

  function formatShortcut(shortcut) {
    const parts = [];
    if (shortcut.ctrlKey) parts.push("Ctrl");
    if (shortcut.altKey) parts.push("Alt");
    if (shortcut.shiftKey) parts.push("Shift");
    if (shortcut.metaKey) parts.push("Meta");
    parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
    return parts.join(" + ");
  }

  function renderShortcut() {
    elements.pickerShortcut.value = formatShortcut(pickerShortcut);
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

  function ruleSignature(rule) {
    return JSON.stringify([rule.type, rule.value, rule.action]);
  }

  function parseImportedRules(value) {
    const imported = Array.isArray(value) ? value : value?.rules;
    if (!Array.isArray(imported)) throw new Error("ไม่พบรายการกฎในไฟล์ JSON");

    const valid = [];
    for (const candidate of imported) {
      if (
        !candidate ||
        !["url", "selector"].includes(candidate.type) ||
        typeof candidate.value !== "string" ||
        !candidate.value.trim() ||
        !["remove", "hide"].includes(candidate.action)
      ) continue;

      const rule = {
        id: typeof candidate.id === "string" && candidate.id ? candidate.id : makeId(),
        type: candidate.type,
        value: candidate.value.trim(),
        action: candidate.action
      };

      if (rule.type === "selector") {
        try {
          document.querySelector(rule.value);
        } catch {
          continue;
        }
      }

      valid.push(rule);
    }

    if (imported.length && !valid.length) throw new Error("ไม่พบกฎที่ถูกต้องในไฟล์");
    return valid;
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
      disabledHosts: [],
      pickerEnabled: false
    });

    rules = Array.isArray(stored.rules) ? stored.rules : DEFAULT_RULES;
    disabledHosts = Array.isArray(stored.disabledHosts) ? stored.disabledHosts : [];
    pickerEnabled = stored.pickerEnabled === true;
    pickerShortcut = normalizeShortcut(stored.pickerShortcut);

    elements.currentHost.textContent = currentHost || "หน้านี้ Chrome ไม่อนุญาตให้แก้ไข";
    elements.siteEnabled.checked = Boolean(currentHost) && !disabledHosts.includes(currentHost);
    elements.siteEnabled.disabled = !currentHost;
    elements.pickerEnabled.checked = pickerEnabled;
    elements.pickerStatus.textContent = pickerEnabled ? "Active" : "Inactive";
    renderShortcut();
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

  elements.pickerEnabled.addEventListener("change", async () => {
    pickerEnabled = elements.pickerEnabled.checked;
    elements.pickerStatus.textContent = pickerEnabled ? "Active" : "Inactive";
    await chrome.storage.local.set({ pickerEnabled });
  });

  elements.changeShortcut.addEventListener("click", () => {
    capturingShortcut = true;
    elements.changeShortcut.textContent = "ยกเลิก";
    elements.pickerShortcut.value = "กดคีย์ลัด...";
    elements.shortcutStatus.textContent = "กด modifier เช่น Alt/Ctrl/Shift พร้อมกับอีกหนึ่งปุ่ม";
  });

  elements.changeShortcut.addEventListener("keydown", (event) => {
    if (!capturingShortcut) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      capturingShortcut = false;
      elements.changeShortcut.textContent = "เปลี่ยนคีย์ลัด";
      renderShortcut();
      elements.shortcutStatus.textContent = "ยกเลิกการเปลี่ยนคีย์ลัดแล้ว";
      return;
    }

    if (["Alt", "Control", "Shift", "Meta"].includes(event.key)) {
      elements.shortcutStatus.textContent = "กด modifier พร้อมกับอีกหนึ่งปุ่ม";
      return;
    }

    if (!event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
      elements.shortcutStatus.textContent = "ต้องใช้ modifier อย่างน้อยหนึ่งปุ่ม (Alt, Ctrl, Shift หรือ Meta)";
      return;
    }

    pickerShortcut = {
      key: event.key.toLowerCase(),
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    };
    capturingShortcut = false;
    renderShortcut();
    elements.changeShortcut.textContent = "เปลี่ยนคีย์ลัด";
    elements.shortcutStatus.textContent = "บันทึกคีย์ลัดแล้ว";
    void chrome.storage.local.set({ pickerShortcut });
  });

  elements.exportRules.addEventListener("click", () => {
    const data = {
      format: "universal-element-blocker-rules",
      version: 2,
      exportedAt: new Date().toISOString(),
      rules,
      settings: {
        disabledHosts,
        pickerEnabled,
        pickerShortcut
      }
    };
    const blobUrl = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "element-blocker-rules.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  });

  elements.importRules.addEventListener("click", () => {
    elements.importStatus.textContent = "";
    elements.importFile.click();
  });

  elements.importFile.addEventListener("change", async () => {
    const file = elements.importFile.files?.[0];
    elements.importFile.value = "";
    if (!file) return;

    try {
      const data = JSON.parse(await file.text());
      const importedRules = parseImportedRules(data);
      const signatures = new Set(rules.map(ruleSignature));
      const ids = new Set(rules.map((rule) => rule.id));
      let added = 0;

      for (const rule of importedRules) {
        if (signatures.has(ruleSignature(rule))) continue;
        if (ids.has(rule.id)) rule.id = makeId();
        rules.push(rule);
        signatures.add(ruleSignature(rule));
        ids.add(rule.id);
        added += 1;
      }

      const updates = { rules };
      const importedSettings = data && !Array.isArray(data) ? data.settings : undefined;
      if (importedSettings && typeof importedSettings === "object") {
        if (Array.isArray(importedSettings.disabledHosts)) {
          disabledHosts = importedSettings.disabledHosts.filter((host) => typeof host === "string");
          updates.disabledHosts = disabledHosts;
        }
        if (typeof importedSettings.pickerEnabled === "boolean") {
          pickerEnabled = importedSettings.pickerEnabled;
          updates.pickerEnabled = pickerEnabled;
        }
        if (importedSettings.pickerShortcut && typeof importedSettings.pickerShortcut.key === "string") {
          pickerShortcut = normalizeShortcut(importedSettings.pickerShortcut);
          updates.pickerShortcut = pickerShortcut;
        }
      }

      await chrome.storage.local.set(updates);
      renderRules();
      elements.pickerEnabled.checked = pickerEnabled;
      elements.pickerStatus.textContent = pickerEnabled ? "Active" : "Inactive";
      elements.siteEnabled.checked = Boolean(currentHost) && !disabledHosts.includes(currentHost);
      renderShortcut();
      const settingsNote = importedSettings ? " และการตั้งค่า" : "";
      elements.importStatus.textContent = `นำเข้า ${added} กฎ${settingsNote} แล้ว`;
    } catch (error) {
      elements.importStatus.textContent = error instanceof Error
        ? error.message
        : "อ่านไฟล์ไม่สำเร็จ";
    }
  });

  void initialize();
})();
