import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CSS } from "./estilos.js";

/* Contraste WCAG: texto normal precisa de 4.5:1; elementos gráficos (bordas, barras) de 3:1 */
function luminancia(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

function tokensDoBloco(seletor) {
  const ini = CSS.indexOf(seletor + "{");
  if (ini < 0) throw new Error(`Bloco ${seletor} não encontrado`);
  const corpo = CSS.slice(ini + seletor.length + 1, CSS.indexOf("}", ini));
  return Object.fromEntries([...corpo.matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{3,6})\b/g)].map((m) => [m[1], m[2]]));
}

const claro = tokensDoBloco(".mf");
const escuro = { ...claro, ...tokensDoBloco('.mf[data-tema="escuro"]') };
const temas = { claro, escuro };

// [texto, fundo] — tokens com "--" ou cores fixas
const TEXTO = [
  ["--tinta", "--papel"], ["--tinta", "--toalha"], ["--cinza", "--papel"], ["--cinza", "--toalha"],
  ["--acento", "--papel"], ["--acento", "--toalha"], ["--acento", "--ok-c"],
  ["--tinta", "--ok-c"], ["--tinta", "--poste-c"], ["--tinta", "--azul-c"], ["--tinta", "--latao-c"],
  ["--ok-tx", "--ok-c"], ["--poste-tx", "--poste-c"], ["--azul-tx", "--azul-c"], ["--latao-tx", "--latao-c"],
  ["--ok-tx", "--papel"], ["--poste-tx", "--papel"], ["--azul-tx", "--papel"], ["--latao-tx", "--papel"],
  ["--enfase-tx", "--enfase"], ["--enfase-link", "--enfase"],
  ["#FFFFFF", "--marca"], ["#FFFFFF", "--poste"],
  ["--btn-tx", "--btn-bg"], ["--amarelo-tx", "--amarelo"], ["--tinta", "--sel-bg"], ["--acento", "--sel-bg"],
];
// botões e seleções precisam se destacar do fundo da página (3:1)
const GRAFICO = [["--grafico-servicos", "--papel"], ["--acento", "--papel"], ["--btn-bg", "--papel"], ["--btn-bg", "--toalha"], ["--sel-borda", "--papel"]];

const cor = (tema, v) => (v.startsWith("--") ? tema[v] : v);

describe("tema de cores", () => {
  for (const [nome, tema] of Object.entries(temas)) {
    it.each(TEXTO)(`${nome}: texto %s sobre %s é legível (4.5:1)`, (t, f) => {
      expect(cor(tema, t), `token ${t} ausente`).toBeTruthy();
      expect(cor(tema, f), `token ${f} ausente`).toBeTruthy();
      expect(contraste(cor(tema, t), cor(tema, f))).toBeGreaterThanOrEqual(4.5);
    });
    it.each(GRAFICO)(`${nome}: elemento %s sobre %s é visível (3:1)`, (t, f) => {
      expect(cor(tema, t), `token ${t} ausente`).toBeTruthy();
      expect(contraste(cor(tema, t), cor(tema, f))).toBeGreaterThanOrEqual(3);
    });
  }

  const NEUTROS = ["--toalha", "--papel", "--tinta", "--cinza", "--linha", "--realce", "--trilha", "--enfase", "--enfase-tx"];
  for (const [nome, tema] of Object.entries(temas)) {
    it.each(NEUTROS)(`${nome}: %s é cinza puro, sem tom verde`, (t) => {
      let h = tema[t].replace("#", "");
      if (h.length === 3) h = [...h].map((c) => c + c).join("");
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      expect([g - r, b - r]).toEqual([0, 0]);
    });
  }

  it("sombras e fundo escurecido não usam o verde antigo", () => {
    expect(CSS).not.toContain("rgba(24,32,29");
  });

  it("o modo escuro automático e o forçado usam as mesmas cores", () => {
    const media = CSS.match(/@media \(prefers-color-scheme:dark\)\{\s*\.mf:not\(\[data-tema="claro"\]\)\{([^}]*)\}/);
    const forcado = CSS.match(/\.mf\[data-tema="escuro"\]\{([^}]*)\}/);
    expect(media?.[1].trim()).toBe(forcado?.[1].trim());
  });

  it("preto de fundo (marca) não é usado como cor de texto (some no escuro)", () => {
    expect(CSS).not.toMatch(/[;{]color:var\(--marca\)/);
  });

  it("fundos e textos do tema não usam branco fixo onde o fundo muda com o tema", () => {
    expect(CSS).not.toMatch(/\.mf-slot\.oferta \.h,[^{]*\{background:#fff/);
  });

  it("telas não usam as cores fixas de aviso/erro/gráfico que quebram no escuro", () => {
    const dir = path.resolve(__dirname, "telas");
    const proibidas = [/color: "#7A5710"/, /color: "#C8372D"/, /color: persistido \? "#2F7A4F"/, /stroke="#E3E7E3"/, /Serviços: "#1F3A32"/];
    for (const arq of fs.readdirSync(dir).filter((f) => f.endsWith(".jsx"))) {
      const txt = fs.readFileSync(path.join(dir, arq), "utf8");
      for (const re of proibidas) expect(txt, `${arq} usa ${re}`).not.toMatch(re);
    }
  });
});
