import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// Injeta a lista de arquivos gerados no service worker (funciona offline desde a 1ª visita)
function precacheSW() {
  let outDir = "dist";
  return {
    name: "matts-flex-precache",
    apply: "build",
    configResolved(c) { outDir = c.build.outDir; },
    writeBundle(_, bundle) {
      // sem repetir arquivos: Cache.addAll recusa listas com itens duplicados
      const arquivos = [...new Set(Object.keys(bundle).filter((f) => !f.endsWith(".map")).map((f) => "./" + f))]
        .filter((f) => !["./index.html", "./sw.js"].includes(f));
      const icones = fs.existsSync(path.resolve(outDir, "icons"))
        ? fs.readdirSync(path.resolve(outDir, "icons")).map((f) => `./icons/${f}`)
        : [];
      const lista = [...new Set([...arquivos, ...icones])];
      const sw = path.resolve(outDir, "sw.js");
      const txt = fs.readFileSync(sw, "utf8").replace("/*ARQUIVOS*/", lista.map((f) => JSON.stringify(f)).join(", "));
      fs.writeFileSync(sw, txt.replace('"matts-flex-v1"', `"matts-flex-${Date.now()}"`));
    },
  };
}

// base "./" permite publicar em qualquer pasta (GitHub Pages, Netlify, Vercel)
export default defineConfig({
  plugins: [react(), precacheSW()],
  base: "./",
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // bibliotecas em arquivos separados: atualizações do app baixam menos
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
          if (id.includes("lucide-react")) return "icones";
          return "graficos";
        },
      },
    },
  },
});
