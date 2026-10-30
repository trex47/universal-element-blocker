(() => {
  "use strict";

  const DEFAULT_SETTINGS = {
    rules: [
      {
        id: "default-ibit-ufabomb",
        type: "url",
        value: "ibit.ly/ufabomb",
        action: "remove"
      }
    ],
    disabledHosts: [],
    pickerEnabled: false
  };

  const URL_ATTRIBUTES = [
    "href",
    "src",
    "srcset",
    "action",
    "formaction",
    "poster",
    "data",
    "cite",
    "background",
    "data-src",
    "data-href",
    "onclick"
  ];

  const HIDDEN_ATTRIBUTE = "data-ueb-hidden";
  const PREVIOUS_DISPLAY_ATTRIBUTE = "data-ueb-previous-display";
  const PREVIOUS_PRIORITY_ATTRIBUTE = "data-ueb-previous-display-priority";
  const PICKER_CLASS = "ueb-delete-picker-target";
  let settings = DEFAULT_SETTINGS;
  let observer;
  let contextTarget;
  let pickerActive = false;
  let pickerTemporary = false;
  let pickerTarget;
  let pickerNotice;

  function normalizeSettings(value) {
    const rules = Array.isArray(value?.rules)
      ? value.rules.filter(
          (rule) =>
            rule &&
            (rule.type === "url" || rule.type === "selector") &&
            typeof rule.value === "string" &&
            rule.value.trim()
        )
      : DEFAULT_SETTINGS.rules;

    const disabledHosts = Array.isArray(value?.disabledHosts)
      ? value.disabledHosts.filter((host) => typeof host === "string")
      : [];

    return { rules, disabledHosts, pickerEnabled: value?.pickerEnabled === true };
  }

  function isEnabledForThisPage() {
    return !settings.disabledHosts.includes(location.hostname);
  }

  function applyAction(element, action) {
    if (!element.isConnected) return;

    if (action === "hide") {
      if (element.hasAttribute(HIDDEN_ATTRIBUTE)) return;
      element.setAttribute(PREVIOUS_DISPLAY_ATTRIBUTE, element.style.display);
      element.setAttribute(
        PREVIOUS_PRIORITY_ATTRIBUTE,
        element.style.getPropertyPriority("display")
      );
      element.setAttribute(HIDDEN_ATTRIBUTE, "");
      element.style.setProperty("display", "none", "important");
      return;
    }

    element.remove();
  }

  function matchesUrlRule(element, pattern) {
    const needle = pattern.trim().toLowerCase();
    if (!needle) return false;

    return URL_ATTRIBUTES.some((attribute) => {
      const value = element.getAttribute(attribute);
      return typeof value === "string" && value.toLowerCase().includes(needle);
    });
  }

  function isUniqueSelector(selector, documentNode) {
    try {
      return documentNode.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  }

  function createUniqueSelector(element) {
    const documentNode = element.ownerDocument;

    if (element.id) {
      const selector = `#${CSS.escape(element.id)}`;
      if (isUniqueSelector(selector, documentNode)) return selector;
    }

    for (const attribute of ["data-testid", "data-test", "data-id", "name"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;

      const selector = `${element.localName}[${attribute}=${JSON.stringify(value)}]`;
      if (isUniqueSelector(selector, documentNode)) return selector;
    }

    const segments = [];
    let current = element;

    while (current instanceof Element) {
      let segment = current.localName;
      const classes = [...current.classList].slice(0, 2);

      if (classes.length) {
        const classSelector = `${segment}.${classes.map(CSS.escape).join(".")}`;
        if (isUniqueSelector(classSelector, documentNode)) return classSelector;
        segment = classSelector;
      }

      const parent = current.parentElement;
      if (parent) {
        const sameTagSiblings = [...parent.children].filter(
          (child) => child.localName === current.localName
        );
        if (sameTagSiblings.length > 1) {
          segment += `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`;
        }
      }

      segments.unshift(segment);
      const selector = segments.join(" > ");
      if (isUniqueSelector(selector, documentNode)) return selector;

      current = parent;
    }

    return segments.join(" > ");
  }

  async function saveTargetRule(target, action) {
    if (!target?.selector) return { ok: false };

    const stored = await chrome.storage.local.get({ rules: DEFAULT_SETTINGS.rules });
    const rules = Array.isArray(stored.rules) ? stored.rules : DEFAULT_SETTINGS.rules;
    const alreadyExists = rules.some(
      (rule) =>
        rule.type === "selector" &&
        rule.value === target.selector &&
        rule.action === action
    );

    if (!alreadyExists) {
      rules.push({
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        type: "selector",
        value: target.selector,
        action
      });
      await chrome.storage.local.set({ rules });
    }

    if (target.element?.isConnected) applyAction(target.element, action);
    return { ok: true, selector: target.selector };
  }

  async function saveContextTargetRule(action) {
    return saveTargetRule(contextTarget, action);
  }

  function clearPickerHighlight() {
    pickerTarget?.classList.remove(PICKER_CLASS);
    pickerTarget = undefined;
  }

  function stopDeletePicker() {
    pickerActive = false;
    pickerTemporary = false;
    clearPickerHighlight();
    pickerNotice?.remove();
    pickerNotice = undefined;
    document.documentElement?.classList.remove("ueb-delete-picker-active");
  }

  function startDeletePicker(temporary = true) {
    if (!isEnabledForThisPage() || !document.documentElement) return;
    if (pickerActive) {
      if (!temporary) {
        pickerTemporary = false;
        if (pickerNotice) {
          pickerNotice.textContent =
            "โหมดลบ Active: คลิก element ที่ชี้เพื่อลบ · ปิดได้ในหน้าต่างส่วนขยาย";
        }
      }
      return;
    }
    pickerActive = true;
    pickerTemporary = temporary;
    const styleParent = document.head || document.documentElement;
    if (!styleParent.contains(pickerStyle)) styleParent.append(pickerStyle);
    pickerNotice = document.createElement("div");
    pickerNotice.textContent = temporary
      ? "โหมดลบ element: ชี้แล้วคลิกเพื่อลบ · Esc เพื่อยกเลิก"
      : "โหมดลบ Active: คลิก element ที่ชี้เพื่อลบ · ปิดได้ในหน้าต่างส่วนขยาย";
    pickerNotice.setAttribute("role", "status");
    pickerNotice.style.cssText =
      "position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%);padding:9px 14px;border-radius:8px;background:#b42318;color:#fff;font:600 13px/1.4 system-ui,sans-serif;box-shadow:0 2px 12px #0005;pointer-events:none";
    (document.documentElement || document).append(pickerNotice);
    document.documentElement?.classList.add("ueb-delete-picker-active");
  }

  function pickerElementFromEvent(event) {
    return event.composedPath().find(
      (node) => node instanceof Element && node !== pickerNotice && !pickerNotice?.contains(node)
    );
  }

  function handlePickerActivation(event) {
    if (!pickerActive) return;
    if (event.type === "click" && event.button !== 0) return;
    if (event.type === "auxclick" && event.button !== 1) return;

    let element = pickerElementFromEvent(event);
    if (!element || element === document.documentElement || element === document.body) return;

    // Remove a linked ad image together with its clickable link, so a blank
    // anchor cannot remain behind and still open the ad URL.
    if (element.localName === "img") {
      element = element.closest("a[href]") || element;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    const target = { element, selector: createUniqueSelector(element) };
    clearPickerHighlight();
    if (pickerTemporary) stopDeletePicker();
    void saveTargetRule(target, "remove").catch(() => {
      // Ignore storage failures; the page interaction was already cancelled.
    });
  }

  const pickerStyle = document.createElement("style");
  pickerStyle.textContent =
    `.${PICKER_CLASS}{outline:3px solid #e5484d!important;outline-offset:2px!important;cursor:crosshair!important}` +
    ".ueb-delete-picker-active{cursor:crosshair!important}";

  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.key.toLowerCase() === "q" && !event.repeat) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (pickerActive && pickerTemporary) stopDeletePicker();
      else if (!pickerActive) startDeletePicker(true);
      return;
    }

    if (pickerActive && pickerTemporary && event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      stopDeletePicker();
    }
  }, true);

  document.addEventListener("mouseover", (event) => {
    if (!pickerActive) return;
    const element = pickerElementFromEvent(event);
    if (!element || element === document.documentElement || element === document.body) return;
    if (element === pickerTarget || element.contains(pickerNotice)) return;
    clearPickerHighlight();
    pickerTarget = element;
    pickerTarget.classList.add(PICKER_CLASS);
  }, true);

  window.addEventListener("click", handlePickerActivation, true);
  window.addEventListener("auxclick", handlePickerActivation, true);

  function inspectElement(element) {
    if (!(element instanceof Element) || !element.isConnected) return;
    if (element.hasAttribute(HIDDEN_ATTRIBUTE)) return;

    for (const rule of settings.rules) {
      if (rule.type === "url" && matchesUrlRule(element, rule.value)) {
        applyAction(element, rule.action);
        return;
      }

      if (rule.type === "selector") {
        try {
          if (element.matches(rule.value)) {
            applyAction(element, rule.action);
            return;
          }
        } catch {
          // Invalid selectors are ignored; the popup prevents saving new ones.
        }
      }
    }
  }

  function inspectTree(root) {
    if (!isEnabledForThisPage()) return;

    if (root instanceof Element) inspectElement(root);
    root.querySelectorAll?.("*").forEach(inspectElement);
  }

  function restoreHiddenElements() {
    document.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`).forEach((element) => {
      const previousDisplay = element.getAttribute(PREVIOUS_DISPLAY_ATTRIBUTE) ?? "";
      const previousPriority = element.getAttribute(PREVIOUS_PRIORITY_ATTRIBUTE) ?? "";

      if (previousDisplay) {
        element.style.setProperty("display", previousDisplay, previousPriority);
      } else {
        element.style.removeProperty("display");
      }

      element.removeAttribute(HIDDEN_ATTRIBUTE);
      element.removeAttribute(PREVIOUS_DISPLAY_ATTRIBUTE);
      element.removeAttribute(PREVIOUS_PRIORITY_ATTRIBUTE);
    });
  }

  function startObserver() {
    if (!document.documentElement) return;
    observer?.disconnect();

    observer = new MutationObserver((mutations) => {
      if (!isEnabledForThisPage()) return;

      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          inspectElement(mutation.target);
          continue;
        }

        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) inspectTree(node);
        });
      }
    });

    const observeOptions = {
      childList: true,
      subtree: true,
      attributes: true
    };

    if (!settings.rules.some((rule) => rule.type === "selector")) {
      observeOptions.attributeFilter = URL_ATTRIBUTES;
    }

    observer.observe(document.documentElement, observeOptions);
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
    settings = normalizeSettings(stored);
    restoreHiddenElements();
    inspectTree(document);
    if (!isEnabledForThisPage()) stopDeletePicker();
    else if (settings.pickerEnabled) startDeletePicker(false);
    if (observer) startObserver();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes.rules && !changes.disabledHosts && !changes.pickerEnabled) return;
    if (changes.pickerEnabled && changes.pickerEnabled.newValue !== true) {
      stopDeletePicker();
    }
    void loadSettings();
  });

  document.addEventListener(
    "contextmenu",
    (event) => {
      const target = event.composedPath()[0];
      if (!(target instanceof Element)) {
        contextTarget = undefined;
        return;
      }

      contextTarget = {
        element: target,
        selector: createUniqueSelector(target)
      };
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!event.altKey || event.button !== 0 || !isEnabledForThisPage()) return;

      const element = event.composedPath().find((node) => node instanceof Element);
      if (!element) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      void saveTargetRule(
        {
          element,
          selector: createUniqueSelector(element)
        },
        "hide"
      ).catch(() => {
        // Ignore storage failures; the page interaction was already cancelled.
      });
    },
    true
  );

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "ueb-block-context-target") return false;
    if (message.action !== "hide" && message.action !== "remove") return false;

    saveContextTargetRule(message.action)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  });

  async function initialize() {
    await loadSettings();

    if (document.documentElement) {
      startObserver();
      return;
    }

    new MutationObserver((_, bootstrapObserver) => {
      if (!document.documentElement) return;
      bootstrapObserver.disconnect();
      inspectTree(document);
      startObserver();
    }).observe(document, { childList: true });
  }

  void initialize();
})();
