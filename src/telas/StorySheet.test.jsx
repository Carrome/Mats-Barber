// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StorySheet } from "./Vagas.jsx";
import { baseVazia } from "../dados.js";

// o que foi desenhado em cada imagem gerada
let desenhos;
beforeEach(() => {
  desenhos = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
    const atual = [];
    desenhos.push(atual);
    return new Proxy({ measureText: () => ({ width: 100 }) }, {
      get: (t, k) => (k in t ? t[k] : k === "fillText" ? (txt) => atual.push(txt) : () => {}),
      set: () => true,
    });
  });
  HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new Blob(["x"], { type: "image/png" })); };
  vi.stubGlobal("Image", class { set src(v) { setTimeout(() => this.onerror?.()); } });
  URL.createObjectURL = () => "blob:x";
  URL.revokeObjectURL = () => {};
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const lista = Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, data: "2026-09-18", hora: `${String(9 + i).padStart(2, "0")}:00`, tipo: "oferta", campanhaId: "mattsflex", servicoId: "corte", valor: 35 }));
const abrir = (l = lista) => render(<StorySheet db={baseVazia()} notify={() => {}} data="2026-09-18" lista={l} onClose={() => {}} />);
// última imagem que terminou de ser desenhada (o rodapé é o último texto, igual nas duas redes)
const ultima = () => desenhos.filter((d) => d.includes("e garanta o seu antes que acabe")).at(-1) || [];
const horasDaUltima = () => ultima().filter((t) => /^\d\d:00$/.test(t));
const chip = (h) => screen.getByRole("button", { name: h });

const marcar = (...hs) => hs.forEach((h) => fireEvent.click(chip(h)));

describe("escolher os horários da imagem de stories", () => {
  it("abre sem nenhum horário marcado: a imagem já aparece, esperando ele escolher", async () => {
    abrir();
    await waitFor(() => expect(ultima()).toContain("MATS FLEX"));
    expect(horasDaUltima()).toEqual([]);
    expect(ultima()).not.toContain("HORÁRIO COM DESCONTO");
    screen.getByAltText("Prévia da imagem para stories");
    lista.forEach((a) => expect(chip(a.hora).getAttribute("aria-pressed")).toBe("false"));
    expect(screen.getByRole("button", { name: /Compartilhar/ }).disabled).toBe(false);
  });

  it("marcando 6, os outros travam; tirando um, libera outro, e a imagem sai só com os escolhidos", async () => {
    abrir();
    marcar("16:00", "10:00", "11:00", "12:00", "13:00", "14:00");
    expect(chip("15:00").disabled).toBe(true);
    screen.getByText(/Até 6 por imagem/);
    marcar("10:00");
    expect(chip("15:00").disabled).toBe(false);
    marcar("09:00");
    expect(chip("15:00").disabled).toBe(true);
    await waitFor(() => expect(horasDaUltima()).toEqual(["09:00", "11:00", "12:00", "13:00", "14:00", "16:00"]));
  });

  it("desmarcando todos, a imagem volta sem horário e com o nome da campanha", async () => {
    abrir(lista.slice(0, 2));
    marcar("09:00", "10:00");
    await waitFor(() => expect(horasDaUltima()).toEqual(["09:00", "10:00"]));
    marcar("09:00", "10:00");
    await waitFor(() => expect(horasDaUltima()).toEqual([]));
    expect(ultima()).toContain("MATS FLEX");
  });

  it("com um horário só, ele também escolhe", async () => {
    abrir(lista.slice(0, 1));
    marcar("09:00");
    await waitFor(() => expect(horasDaUltima()).toEqual(["09:00"]));
  });
});

describe("versão para WhatsApp ou Instagram", () => {
  const rede = (nome) => screen.getByRole("radio", { name: nome });

  it("abre na versão do WhatsApp, com os dois botões acima da escolha dos horários", async () => {
    abrir();
    expect(rede("WhatsApp").getAttribute("aria-checked")).toBe("true");
    expect(rede("Instagram").getAttribute("aria-checked")).toBe("false");
    await waitFor(() => expect(ultima()).toContain("ME CHAMA NO WHATSAPP"));
    const escolha = screen.getByText(/Escolha os horários da imagem/);
    const botoes = screen.getByRole("radiogroup", { name: "Onde vai postar" });
    expect(botoes.compareDocumentPosition(escolha) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("no Instagram a frase vira Direct e os horários escolhidos continuam marcados; voltar restaura", async () => {
    abrir();
    marcar("09:00", "11:00");
    fireEvent.click(rede("Instagram"));
    expect(rede("Instagram").getAttribute("aria-checked")).toBe("true");
    await waitFor(() => expect(ultima()).toContain("ME CHAMA NO DIRECT"));
    expect(ultima()).not.toContain("ME CHAMA NO WHATSAPP");
    expect(horasDaUltima()).toEqual(["09:00", "11:00"]);
    expect(chip("09:00").getAttribute("aria-pressed")).toBe("true");
    expect(chip("11:00").getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(rede("WhatsApp"));
    await waitFor(() => expect(ultima()).toContain("ME CHAMA NO WHATSAPP"));
    expect(horasDaUltima()).toEqual(["09:00", "11:00"]);
  });
});
