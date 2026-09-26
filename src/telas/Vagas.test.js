// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { desenharStory } from "./Vagas.jsx";
import { baseVazia } from "../dados.js";

// canvas simulado: registra cada desenho e o globalAlpha no momento dele
let chamadas;
function contextoFalso() {
  const ctx = { globalAlpha: 1, fillStyle: "", font: "", textAlign: "" };
  const registra = (nome) => (...args) => { chamadas.push({ nome, args, alpha: ctx.globalAlpha, cor: ctx.fillStyle }); };
  for (const m of ["fillRect", "fillText", "drawImage", "beginPath", "moveTo", "lineTo", "arcTo", "closePath", "fill", "rect", "clip"]) ctx[m] = registra(m);
  ctx.save = () => { ctx._pilha = [...(ctx._pilha || []), ctx.globalAlpha]; };
  ctx.restore = () => { ctx.globalAlpha = ctx._pilha.pop(); };
  ctx.measureText = () => ({ width: 100 });
  return ctx;
}

beforeEach(() => {
  chamadas = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => contextoFalso());
  HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new Blob(["x"], { type: "image/png" })); };
  // imagens carregam na hora
  vi.stubGlobal("Image", class { set src(v) { this._src = v; this.naturalWidth = 1334; this.naturalHeight = 1179; setTimeout(() => this.onload?.()); } get src() { return this._src; } });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("imagem para stories", () => {
  it("desenha a logo da barbearia no fundo, suave e antes dos textos", async () => {
    const db = baseVazia();
    const lista = [{ id: "a1", data: "2026-09-18", hora: "10:00", tipo: "oferta", campanhaId: "mattsflex", servicoId: "corte", valor: 35 }];
    const blob = await desenharStory(db, "2026-09-18", lista);
    expect(blob).toBeTruthy();

    const logo = chamadas.findIndex((c) => c.nome === "drawImage" && /logo-grande\.png$/.test(c.args[0].src));
    expect(logo, "a logo não foi desenhada").toBeGreaterThan(-1);
    expect(chamadas[logo].alpha).toBeGreaterThan(0);
    expect(chamadas[logo].alpha).toBeLessThanOrEqual(0.25);
    // o maior possível sem cortar: largura inteira da imagem (1080), mantendo a proporção
    const [, x, y, w, h] = chamadas[logo].args;
    expect([x, w]).toEqual([0, 1080]);
    expect(h).toBe(Math.round((1080 * 1179) / 1334));
    expect(y).toBe(Math.round((1920 - h) / 2));
    const primeiroTexto = chamadas.findIndex((c) => c.nome === "fillText");
    expect(logo).toBeLessThan(primeiroTexto);
    // o que vem depois da logo volta a ser opaco
    expect(chamadas[primeiroTexto].alpha).toBe(1);
  });

  it("cartões de horário têm borda listrada do Flex (vermelho, branco e azul) e horário em preto", async () => {
    const lista = [{ id: "a1", data: "2026-09-18", hora: "10:00", tipo: "oferta", campanhaId: "mattsflex", servicoId: "corte", valor: 35 }];
    await desenharStory(baseVazia(), "2026-09-18", lista);
    const hora = chamadas.findIndex((c) => c.nome === "fillText" && c.args[0] === "10:00");
    expect(hora).toBeGreaterThan(-1);
    expect(chamadas[hora].cor).toBe("#000000");
    // entre o título do dia e o horário: listras do cartão e o miolo branco por cima delas
    const inicioCartao = chamadas.map((c) => c.nome === "fillText").lastIndexOf(true, hora - 1);
    const doCartao = chamadas.slice(inicioCartao + 1, hora).filter((c) => c.nome === "fill").map((c) => c.cor);
    expect(doCartao).toContain("#C8372D");
    expect(doCartao).toContain("#2A4E8A");
    expect(doCartao.lastIndexOf("#FFFFFF")).toBe(doCartao.length - 1);
    expect(doCartao.filter((c) => c === "#FFFFFF").length).toBeGreaterThan(1);
  });

  it("nunca desenha mais que 6 horários, nem aviso de horários sobrando", async () => {
    const lista = Array.from({ length: 9 }, (_, i) => ({ id: `a${i}`, data: "2026-09-18", hora: `${String(9 + i).padStart(2, "0")}:00`, tipo: "oferta", campanhaId: "mattsflex", servicoId: "corte", valor: 35 }));
    await desenharStory(baseVazia(), "2026-09-18", lista);
    const horas = chamadas.filter((c) => c.nome === "fillText" && /^\d\d:00$/.test(c.args[0])).map((c) => c.args[0]);
    expect(horas).toEqual(["09:00", "10:00", "11:00", "12:00", "13:00", "14:00"]);
    expect(chamadas.some((c) => c.nome === "fillText" && /horário/.test(c.args[0]))).toBe(false);
  });

  it("o rodapé chama no WhatsApp por padrão e no Direct na versão do Instagram", async () => {
    const lista = [{ id: "a1", data: "2026-09-18", hora: "10:00", tipo: "oferta", campanhaId: "mattsflex", servicoId: "corte", valor: 35 }];
    const textos = () => chamadas.filter((c) => c.nome === "fillText").map((c) => c.args[0]);
    await desenharStory(baseVazia(), "2026-09-18", lista);
    expect(textos()).toContain("ME CHAMA NO WHATSAPP");
    expect(textos()).not.toContain("ME CHAMA NO DIRECT");
    chamadas = [];
    await desenharStory(baseVazia(), "2026-09-18", lista, lista, "instagram");
    expect(textos()).toContain("ME CHAMA NO DIRECT");
    expect(textos()).not.toContain("ME CHAMA NO WHATSAPP");
    expect(textos()).toContain("e garanta o seu antes que acabe");
  });

  it("se a logo não carregar, a imagem é gerada mesmo assim", async () => {
    vi.stubGlobal("Image", class { set src(v) { this._src = v; setTimeout(() => this.onerror?.()); } get src() { return this._src; } });
    const blob = await desenharStory(baseVazia(), "2026-09-18", []);
    expect(blob).toBeTruthy();
    expect(chamadas.some((c) => c.nome === "drawImage")).toBe(false);
  });
});
