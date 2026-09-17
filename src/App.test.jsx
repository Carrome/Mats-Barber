// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App from "./App.jsx";

beforeEach(() => {
  const m = new Map();
  vi.stubGlobal("localStorage", { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("matchMedia", (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const nomesDaBarra = (barra) => within(barra).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
const dinheiroNoPainel = (container) => /R\$\s*\d/.test(container.querySelector(".mf-main").textContent);

describe("barra superior", () => {
  it("não tem o botão de vender plano em nenhuma aba (a venda fica na tela Planos)", async () => {
    render(<App />);
    const barra = await screen.findByRole("banner");
    for (const aba of ["Painel", "Agenda", "Vagas", "Clientes", "Planos"]) {
      fireEvent.click(screen.getAllByRole("button", { name: new RegExp(`^${aba}`) })[0]);
      expect(nomesDaBarra(barra), aba).not.toContain("Vender plano");
    }
    expect(screen.getAllByRole("button", { name: /Vender plano/ }).length).toBeGreaterThan(0);
  });
});

describe("botão de esconder valores na barra superior", () => {
  it("fica à esquerda de Ajustes e esconde os valores do painel", async () => {
    const { container } = render(<App />);
    const barra = await screen.findByRole("banner");
    const nomes = nomesDaBarra(barra);
    expect(nomes.indexOf("Esconder valores")).toBe(nomes.indexOf("Ajustes") - 1);

    expect(dinheiroNoPainel(container)).toBe(true);
    fireEvent.click(within(barra).getByRole("button", { name: "Esconder valores" }));
    expect(dinheiroNoPainel(container)).toBe(false);
    expect(within(barra).getByRole("button", { name: "Mostrar valores" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("aparece em todas as abas, sempre à esquerda de Ajustes", async () => {
    render(<App />);
    const barra = await screen.findByRole("banner");
    for (const aba of ["Agenda", "Vagas", "Clientes", "Planos", "Painel"]) {
      fireEvent.click(screen.getAllByRole("button", { name: new RegExp(`^${aba}`) })[0]);
      expect(nomesDaBarra(barra), aba).toEqual(["Esconder valores", "Ajustes"]);
    }
  });

  it("a escolha feita em outra aba vale ao voltar para o painel", async () => {
    const { container } = render(<App />);
    const barra = await screen.findByRole("banner");
    fireEvent.click(screen.getAllByRole("button", { name: /^Agenda/ })[0]);
    fireEvent.click(within(barra).getByRole("button", { name: "Esconder valores" }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Painel/ })[0]);
    expect(dinheiroNoPainel(container)).toBe(false);
  });

  it("a escolha fica lembrada ao abrir o app de novo", async () => {
    render(<App />);
    fireEvent.click(within(await screen.findByRole("banner")).getByRole("button", { name: "Esconder valores" }));
    cleanup();
    const { container } = render(<App />);
    const barra = await screen.findByRole("banner");
    expect(within(barra).getByRole("button", { name: "Mostrar valores" })).toBeTruthy();
    expect(dinheiroNoPainel(container)).toBe(false);
  });
});

describe("aviso de backup", () => {
  async function abrirComDadosReaisSemBackup() {
    const { baseVazia, STORE_KEY } = await import("./dados.js");
    const db = baseVazia();
    db.clientes = [{ id: "c1", nome: "Ana" }, { id: "c2", nome: "Bia" }, { id: "c3", nome: "Caio" }];
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    return render(<App />);
  }

  it("não fica no painel; o ícone de ajustes mostra 1 aviso", async () => {
    const { container } = await abrirComDadosReaisSemBackup();
    const barra = await screen.findByRole("banner");
    expect(container.querySelector(".mf-main").textContent).not.toMatch(/backup/i);
    const ajustes = within(barra).getByRole("button", { name: /^Ajustes/ });
    expect(ajustes.getAttribute("aria-label")).toBe("Ajustes (1 aviso)");
    expect(ajustes.textContent).toBe("1");
    // menu lateral do computador (escondido pelo CSS em tela pequena, então vai pela classe)
    const ajustesMenu = [...container.querySelectorAll("nav.mf-rail button")].find((b) => b.textContent.startsWith("Ajustes"));
    expect(ajustesMenu.textContent).toBe("Ajustes1");
  });

  it("o aviso aparece na tela de ajustes com o botão de fazer backup", async () => {
    await abrirComDadosReaisSemBackup();
    const barra = await screen.findByRole("banner");
    fireEvent.click(within(barra).getByRole("button", { name: /^Ajustes/ }));
    const aviso = screen.getByText(/Você ainda não fez nenhum backup\./).closest(".mf-banner");
    expect(within(aviso).getByRole("button", { name: /Fazer backup/ })).toBeTruthy();
  });

  it("sem avisos, o ícone de ajustes não mostra número", async () => {
    render(<App />);
    const barra = await screen.findByRole("banner");
    const ajustes = within(barra).getByRole("button", { name: "Ajustes" });
    expect(ajustes.textContent).toBe("");
  });
});
