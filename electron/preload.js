// Minimal, contextIsolated preload. The renderer is a normal web app and needs
// no privileged bridge today; this exists so we never enable nodeIntegration.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("escapeFromDX", {
  isDesktop: true,
  version: "0.1.0",
});
