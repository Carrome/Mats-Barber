// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "./App.jsx";

vi.mock("./nuvem.js", () => ({
  sessaoAtual: vi.fn(),
  lerNuvem: vi.fn(),
  versaoNuvem: vi.fn(),
  criarNuvem: vi.fn(),
  gravarNuvem: vi.fn(),
  entrar: vi.fn(),
  sair: vi.fn(),
}));
import { criarNuvem, gravarNuvem, lerNuvem, sessaoAtual, versaoNuvem } from "./nuvem.js";

beforeEach(() => {
  const m = new Map();
  vi.stubGlobal("localStorage", { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("matchMedia", (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.clearAllMocks();
  // Padrão: banco sem resposta (sem rede). A sincronização tenta, não decide
  // nada e o app segue com o que está no aparelho. Assim nenhum teste alheio
  // à sincronização mexe no banco sem querer.
  sessaoAtual.mockResolvedValue(null);
  lerNuvem.mockResolvedValue({ existe: false, versao: null, dados: null, erro: "Sem conexão com a internet." });
  versaoNuvem.mockResolvedValue({ versao: null, erro: "Sem conexão com a internet." });
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
    const { baseVazia, MODO_KEY, STORE_KEY } = await import("./dados.js");
    const db = baseVazia();
    db.clientes = [{ id: "c1", nome: "Ana" }, { id: "c2", nome: "Bia" }, { id: "c3", nome: "Caio" }];
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    localStorage.setItem(MODO_KEY, "real"); // aparelho que já passou pela separação do modo teste
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

describe("portão de login e carga inicial", () => {
  // EXIGIR_LOGIN está desligado enquanto o banco não é configurado: o app abre
  // direto, com ou sem internet. Quando a constante voltar a true, este teste
  // volta a ser "sem sessão, mostra a tela de entrada e não o app".
  it("com o login desligado, abre o app sem pedir senha mesmo sem sessão", async () => {
    sessaoAtual.mockResolvedValue(null);
    render(<App />);
    // "banner" só existe no cabeçalho do app principal (Login não tem header)
    await waitFor(() => expect(screen.getByRole("banner")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /entrar/i })).toBe(null);
  });

  it("sem sessão e com dados reais, fala com o banco sem login e abre mesmo se a leitura falhar", async () => {
    const { baseVazia, MODO_KEY, STORE_KEY } = await import("./dados.js");
    const db = baseVazia();
    db.clientes = [{ id: "c1", nome: "Ana" }];
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    localStorage.setItem(MODO_KEY, "real"); // aparelho que já passou pela separação do modo teste
    // sessaoAtual e lerNuvem seguem o padrão do beforeEach: sem sessão, leitura com erro de rede.
    render(<App />);
    await waitFor(() => expect(screen.getByRole("banner")).toBeTruthy());
    // a sincronização tentou falar com o banco, mas o erro de leitura barrou qualquer decisão
    await waitFor(() => expect(lerNuvem).toHaveBeenCalled());
    expect(criarNuvem).not.toHaveBeenCalled();
  });

  it("no modo teste nunca fala com o banco", async () => {
    const { MODO_KEY } = await import("./dados.js");
    localStorage.setItem(MODO_KEY, "teste");
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Modo teste./)).toBeTruthy());
    await new Promise((r) => setTimeout(r, 0)); // dá chance a qualquer efeito pendente rodar
    for (const f of [lerNuvem, versaoNuvem, criarNuvem, gravarNuvem]) expect(f).not.toHaveBeenCalled();
  });

  it("Ajustes mostra o estado da sincronização", async () => {
    const { baseVazia, MODO_KEY, STORE_KEY } = await import("./dados.js");
    const db = baseVazia();
    db.clientes = [{ id: "c1", nome: "Ana" }];
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    localStorage.setItem(MODO_KEY, "real");
    render(<App />);
    fireEvent.click(within(await screen.findByRole("banner")).getByRole("button", { name: /^Ajustes/ }));
    expect(await screen.findByText(/Sem conexão\. As alterações são enviadas quando a internet voltar\./)).toBeTruthy();
    expect(screen.queryByText(/ficam guardados só neste aparelho/)).toBe(null);
  });
});

describe("modo teste", () => {
  const ler = async (qual) => {
    const { STORE_KEY, TESTE_KEY } = await import("./dados.js");
    const raw = localStorage.getItem(qual === "teste" ? TESTE_KEY : STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  };

  it("entra e sai do teste sem misturar nem perder nada dos dois lados", async () => {
    const { baseVazia, MODO_KEY, STORE_KEY } = await import("./dados.js");
    const real = baseVazia();
    real.clientes = [{ id: "c1", nome: "Ana, cliente de verdade" }];
    localStorage.setItem(STORE_KEY, JSON.stringify(real));
    localStorage.setItem(MODO_KEY, "real");
    render(<App />);
    const barra = await screen.findByRole("banner");

    fireEvent.click(within(barra).getByRole("button", { name: /^Ajustes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Testar aplicativo" }));
    await waitFor(() => expect(screen.getByText(/Modo teste\./)).toBeTruthy());
    const teste = await ler("teste");
    expect(teste.teste).toBe(true);
    expect(teste.clientes.length).toBeGreaterThan(10);
    expect((await ler("real")).clientes.map((c) => c.nome)).toEqual(["Ana, cliente de verdade"]);

    fireEvent.click(screen.getByRole("button", { name: "Voltar ao uso real" }));
    await waitFor(() => expect(screen.queryByText(/Modo teste\./)).toBe(null));
    expect((await ler("real")).clientes.map((c) => c.nome)).toEqual(["Ana, cliente de verdade"]);
    expect(localStorage.getItem(MODO_KEY)).toBe("real");

    // voltando ao teste, o que estava lá continua igual (não é gerado de novo)
    fireEvent.click(within(barra).getByRole("button", { name: /^Ajustes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Testar aplicativo" }));
    await waitFor(() => expect(screen.getByText(/Modo teste\./)).toBeTruthy());
    expect((await ler("teste")).clientes.map((c) => c.id)).toEqual(teste.clientes.map((c) => c.id));
  });

  it("o modo escolhido fica lembrado ao abrir o app de novo", async () => {
    render(<App />);
    fireEvent.click(within(await screen.findByRole("banner")).getByRole("button", { name: /^Ajustes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Testar aplicativo" }));
    await waitFor(() => expect(screen.getByText(/Modo teste\./)).toBeTruthy());
    cleanup();
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Modo teste\./)).toBeTruthy());
  });

  it("no teste não há backup nem restauração, para não trazer dado real para cá", async () => {
    const { MODO_KEY } = await import("./dados.js");
    localStorage.setItem(MODO_KEY, "teste");
    render(<App />);
    fireEvent.click(within(await screen.findByRole("banner")).getByRole("button", { name: /^Ajustes/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Recomeçar o exemplo/ })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Restaurar backup/ })).toBe(null);
  });
});
