// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { desenharStory } from "./Vagas.jsx";
import { baseVazia } from "../dados.js";

// canvas simulado: registra cada desenho, o globalAlpha, a fonte e o alinhamento no momento dele
let chamadas;
let medir; // largura de um texto na fonte atual
function contextoFalso() {
  const ctx = { globalAlpha: 1, fillStyle: "", font: "", textAlign: "" };
  const registra = (nome) => (...args) => { chamadas.push({ nome, args, alpha: ctx.globalAlpha, cor: ctx.fillStyle, fonte: ctx.font, alinhamento: ctx.textAlign }); };
  for (const m of ["fillRect", "fillText", "drawImage", "beginPath", "moveTo", "lineTo", "arcTo", "closePath", "fill", "rect", "clip"]) ctx[m] = registra(m);
  ctx.save = () => { ctx._pilha = [...(ctx._pilha || []), ctx.globalAlpha]; };
  ctx.restore = () => { ctx.globalAlpha = ctx._pilha.pop(); };
  ctx.measureText = (txt) => ({ width: medir(txt, ctx.font) });
  return ctx;
}
const tamanhoDa = (fonte) => Number(/([\d.]+)px/.exec(fonte)[1]);
// larguras parecidas com as de verdade: a fonte dos números é estreita, a do texto é mais larga
const medirParecido = (txt, fonte) => txt.length * tamanhoDa(fonte) * (/Big Shoulders/.test(fonte) ? 0.4 : 0.55);

beforeEach(() => {
  chamadas = [];
  medir = () => 100;
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

  it("o nome do serviço sai em negrito, maior e centralizado entre o horário e o preço", async () => {
    const lista = [{ id: "a1", data: "2026-09-18", hora: "10:00", tipo: "oferta", campanhaId: "mattsflex", servicoId: "corte", valor: 35 }];
    await desenharStory(baseVazia(), "2026-09-18", lista);
    const texto = (t) => chamadas.find((c) => c.nome === "fillText" && c.args[0] === t);
    const nome = texto("Cabelo");
    expect(nome.fonte).toMatch(/^700 .*Archivo/);
    expect(tamanhoDa(nome.fonte)).toBeGreaterThan(190 * 0.24); // era 24% da altura do cartão
    expect(nome.alinhamento).toBe("center");
    // tudo mede 100 aqui: o horário termina a 100 do começo do cartão e o preço começa a 100 do fim,
    // então o meio do espaço livre é o meio da imagem
    expect(nome.args[1]).toBe(540);
    // na altura, fica no meio do cartão (a linha de base um pouco abaixo do meio)
    const topoCartao = texto("10:00").args[2] - 190 * 0.68;
    expect(nome.args[2]).toBeGreaterThan(topoCartao + 190 * 0.5);
    expect(nome.args[2]).toBeLessThan(topoCartao + 190 * 0.7);
  });

  it("nome de serviço comprido quebra em duas linhas centralizadas em vez de encolher a letra", async () => {
    medir = medirParecido;
    const lista = [{ id: "a1", data: "2026-09-18", hora: "10:00", tipo: "oferta", campanhaId: "mattsflex", servicoId: "cabelo-feminino", valor: 35 }];
    await desenharStory(baseVazia(), "2026-09-18", lista);
    const linha1 = chamadas.find((c) => c.nome === "fillText" && c.args[0] === "Cabelo");
    const linha2 = chamadas.find((c) => c.nome === "fillText" && c.args[0] === "feminino");
    expect(linha1 && linha2, "não quebrou em duas linhas").toBeTruthy();
    expect(linha1.args[1]).toBe(linha2.args[1]);
    expect(linha1.args[2]).toBeLessThan(linha2.args[2]);
    expect(tamanhoDa(linha1.fonte)).toBeCloseTo(190 * 0.32);
    expect(linha1.alinhamento).toBe("center");
  });

  it("oferta com combo mostra os serviços juntos, o total e o preço cheio riscado", async () => {
    const lista = [{ id: "a1", data: "2026-09-18", hora: "10:00", tipo: "oferta", campanhaId: "mattsflex", servicoId: "corte", valor: 30, adicionais: [{ servicoId: "barba", valor: 20 }] }];
    await desenharStory(baseVazia(), "2026-09-18", lista);
    const textos = chamadas.filter((c) => c.nome === "fillText").map((c) => c.args[0]);
    expect(textos).toContain("Cabelo + Barba");
    expect(textos).toContain("R$ 50,00");
    expect(textos).toContain("R$ 70,00");
  });

  it("combo comprido quebra antes do +, nunca deixando o + no fim da linha", async () => {
    medir = medirParecido;
    const lista = [{ id: "a1", data: "2026-09-18", hora: "10:00", tipo: "oferta", campanhaId: "mattsflex", servicoId: "corte", valor: 30, adicionais: [{ servicoId: "barba", valor: 20 }] }];
    await desenharStory(baseVazia(), "2026-09-18", lista);
    const textos = chamadas.filter((c) => c.nome === "fillText").map((c) => c.args[0]);
    expect(textos).toContain("Cabelo");
    expect(textos).toContain("+ Barba");
    expect(textos.some((t) => /\+$/.test(t))).toBe(false);
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
