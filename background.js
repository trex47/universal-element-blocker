"use strict";

const MENU_ACTIONS = {
  "ueb-hide-element": "hide",
  "ueb-remove-element": "remove"
};

function createMenus() {
  chrome.contextMenus.create({
    id: "ueb-hide-element",
    title: "ซ่อน element นี้ทุกครั้ง",
    contexts: ["all"],
    documentUrlPatterns: ["http://*/*", "https://*/*", "file:///*"]
  });

  chrome.contextMenus.create({
    id: "ueb-remove-element",
    title: "ลบ element นี้ทุกครั้ง",
    contexts: ["all"],
    documentUrlPatterns: ["http://*/*", "https://*/*", "file:///*"]
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(createMenus);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const action = MENU_ACTIONS[info.menuItemId];
  if (!action || tab?.id === undefined) return;

  chrome.tabs
    .sendMessage(
      tab.id,
      { type: "ueb-block-context-target", action },
      { frameId: info.frameId ?? 0 }
    )
    .catch(() => {
      // Chrome-protected pages and file URLs without permission have no content script.
    });
});
