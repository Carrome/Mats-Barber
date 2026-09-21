// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decidirAcao, ehVazio, gravarMarca, lerMarca, limparMarca, MARCA_KEY } from "./sincronia.js";
import { baseVazia } from "./dados.js";

const comDados = () => {
  const d = baseVazia();
  d.clientes.push({ id: "c1", nome: "João", telefone: "" });
  d.agendamentos.push({ id: "a1", data: "2026-09-21", hora: "09:00", tipo: "avulso", valor: 45, status: "agendado" });
  return d;
};

describe("ehVazio", () => {
  it("base recém-criada é vazia", () => {
    expect(ehVazio(baseVazia())).toBe(true);
  });

  it("nulo é vazio", () => {
    expect(ehVazio(null)).toBe(true);
  });

  it("dados de exemplo contam como vazio mesmo cheios de cliente", () => {
    const d = comDados();
    d.demo = true;
    expect(ehVazio(d)).toBe(true);
  });

  it("dados reais não são vazios", () => {
    expect(ehVazio(comDados())).toBe(false);
  });
});

describe("decidirAcao", () => {
  it("com marca, segue a sincronização normal", () => {
    const acao = decidirAcao({ marca: { versao: 7, origem: "celular" }, local: comDados(), nuvem: { existe: true, versao: 7 } });
    expect(acao).toBe("sincronizar");
  });

  it("banco ainda não existe: cria a partir do aparelho", () => {
    const acao = decidirAcao({ marca: null, local: comDados(), nuvem: { existe: false, versao: null } });
    expect(acao).toBe("criar");
  });

  // TRAVA PRINCIPAL
  it("aparelho limpo e banco com dados: só baixa", () => {
    const acao = decidirAcao({ marca: null, local: baseVazia(), nuvem: { existe: true, versao: 12 } });
    expect(acao).toBe("baixar");
  });

  it("aparelho com dados de exemplo e banco com dados: só baixa", () => {
    const d = comDados();
    d.demo = true;
    const acao = decidirAcao({ marca: null, local: d, nuvem: { existe: true, versao: 12 } });
    expect(acao).toBe("baixar");
  });

  it("aparelho sem dados nenhum e banco com dados: só baixa", () => {
    const acao = decidirAcao({ marca: null, local: null, nuvem: { existe: true, versao: 3 } });
    expect(acao).toBe("baixar");
  });

  it("os dois lados com dados reais e sem marca: pergunta, nunca decide sozinho", () => {
    const acao = decidirAcao({ marca: null, local: comDados(), nuvem: { existe: true, versao: 4 } });
    expect(acao).toBe("perguntar");
  });

  it("nunca devolve subir quando não há marca e o banco tem dados", () => {
    for (const local of [null, baseVazia(), comDados()]) {
      const acao = decidirAcao({ marca: null, local, nuvem: { existe: true, versao: 9 } });
      expect(acao).not.toBe("subir");
    }
  });
});

describe("marca de sincronia", () => {
  beforeEach(() => {
    const m = new Map();
    vi.stubGlobal("localStorage", { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("começa sem marca", () => {
    expect(lerMarca()).toBe(null);
  });

  it("grava e lê de volta", () => {
    gravarMarca(5, "celular");
    expect(lerMarca()).toEqual({ versao: 5, origem: "celular" });
  });

  it("limpar apaga", () => {
    gravarMarca(5, "celular");
    limparMarca();
    expect(lerMarca()).toBe(null);
  });

  it("marca corrompida é tratada como ausente", () => {
    window.localStorage.setItem(MARCA_KEY, "{isso não é json");
    expect(lerMarca()).toBe(null);
  });

  it("não usa a mesma chave dos dados do app", () => {
    expect(MARCA_KEY).not.toBe("matts-flex-app-v1");
  });
});
