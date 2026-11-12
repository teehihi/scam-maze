import React from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { App } from "./app/App";
import { loadSettings } from "./app/settingsStorage";
import { i18n, initI18n } from "./i18n";
import "./styles/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found in DOM");
}

/** `window.localStorage` itself can throw (for example when storage is blocked). */
function getBrowserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// Synchronous init with bundled dictionaries: the first render already uses the stored language.
initI18n(loadSettings(getBrowserStorage()).language);

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </React.StrictMode>
);
