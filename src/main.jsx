import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service worker: deixa o app instalável e funcionando offline
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const jaTinha = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW não registrado", e));
    // quando uma versão nova assume, avisa o app para oferecer "Atualizar"
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (jaTinha) window.dispatchEvent(new Event("mf-nova-versao"));
    });
  });
}
