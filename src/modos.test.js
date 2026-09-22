// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  abrirReal, abrirTeste, baseVazia, carregar, criarDemo, guardarCopiaAnterior, lerCopiaAnterior, lerModo,
  MODO_KEY, salvar, separarTeste, STORE_KEY, TESTE_KEY,
} from "./dados.js";

let m;
beforeEach(() => {
  m = new Map();
  vi.stubGlobal("localStorage", { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() });
});
afterEach(() => vi.unstubAllGlobals());

const ler = (k) => JSON.parse(m.get(k));
const real = (clientes) => ({ ...baseVazia(), clientes });

describe("cada lado grava só no próprio lugar", () => {
  it("dados reais vão para a chave de sempre", async () => {
    await salvar(abrirReal(real([{ id: "c1", nome: "Ana" }])));
    expect(ler(STORE_KEY).clientes[0].nome).toBe("Ana");
    expect(m.has(TESTE_KEY)).toBe(false);
  });

  it("dados de teste nunca tocam a chave real", async () => {
    await salvar(abrirTeste(null));
    expect(m.has(STORE_KEY)).toBe(false);
    expect(ler(TESTE_KEY).teste).toBe(true);
  });

  it("o nome da chave real não muda: renomear apagaria os dados do aparelho", () => {
    expect(STORE_KEY).toBe("matts-flex-app-v1");
    expect(TESTE_KEY).not.toBe(STORE_KEY);
  });

  it("a cópia automática também é separada por lado", async () => {
    await guardarCopiaAnterior(abrirReal(real([{ id: "c1", nome: "Ana" }])));
    await guardarCopiaAnterior(abrirTeste(null));
    expect((await lerCopiaAnterior(false)).db.clientes[0].nome).toBe("Ana");
    expect((await lerCopiaAnterior(true)).db.teste).toBe(true);
  });
});

describe("abrir cada lado", () => {
  it("uso real começa vazio numa instalação nova", () => {
    const db = abrirReal(null);
    expect(db).toMatchObject({ teste: false, demo: false, clientes: [], agendamentos: [] });
  });

  it("modo teste começa com o exemplo", () => {
    const db = abrirTeste(null);
    expect(db.teste).toBe(true);
    expect(db.clientes.length).toBeGreaterThan(10);
  });

  it("o que foi feito no teste fica, mesmo de uma versão antiga", () => {
    const antigo = { ...criarDemo(), versao: 1, clientes: [{ id: "x", nome: "Cliente que ele criou" }] };
    expect(abrirTeste(antigo).clientes.map((c) => c.nome)).toEqual(["Cliente que ele criou"]);
  });
});

describe("primeira abertura desta versão", () => {
  it("o que estava no aparelho vai para o teste e o uso real começa vazio, com os ajustes", async () => {
    const antes = { ...criarDemo(), config: { ...criarDemo().config, nome: "Barbearia do Matheus", meta: 9000 } };
    m.set(STORE_KEY, JSON.stringify(antes));
    await separarTeste();
    const clientesAntes = antes.clientes.length;
    expect(ler(TESTE_KEY).clientes.length).toBe(clientesAntes);
    expect(ler(STORE_KEY)).toMatchObject({ clientes: [], agendamentos: [], pacotes: [] });
    expect(ler(STORE_KEY).config).toMatchObject({ nome: "Barbearia do Matheus", meta: 9000 });
    expect(await lerModo()).toBe("real");
  });

  it("nada se perde: o original também fica como cópia automática do uso real", async () => {
    m.set(STORE_KEY, JSON.stringify(real([{ id: "c1", nome: "Ana" }])));
    await separarTeste();
    expect((await lerCopiaAnterior(false)).db.clientes[0].nome).toBe("Ana");
  });

  it("pausas do exemplo não vão para o uso real", async () => {
    m.set(STORE_KEY, JSON.stringify(criarDemo()));
    await separarTeste();
    expect(ler(STORE_KEY).config.pausas).toEqual([]);
  });

  it("roda uma vez só: depois disso não mexe em mais nada", async () => {
    m.set(STORE_KEY, JSON.stringify(real([{ id: "c1", nome: "Ana" }])));
    await separarTeste();
    await salvar(abrirReal(real([{ id: "c2", nome: "Bruno, cliente de verdade" }])));
    await separarTeste();
    expect(ler(STORE_KEY).clientes[0].nome).toBe("Bruno, cliente de verdade");
  });

  it("instalação nova não cria nada no teste", async () => {
    await separarTeste();
    expect(m.has(TESTE_KEY)).toBe(false);
    expect(m.get(MODO_KEY)).toBe("real");
  });

  it("carregar lê o lado pedido", async () => {
    m.set(STORE_KEY, JSON.stringify(real([{ id: "c1", nome: "Ana" }])));
    m.set(TESTE_KEY, JSON.stringify({ ...real([{ id: "t1", nome: "Teste" }]), teste: true }));
    expect((await carregar(false)).clientes[0].nome).toBe("Ana");
    expect((await carregar(true)).clientes[0].nome).toBe("Teste");
  });
});

describe("separação e conversão de horário juntas", () => {
  it("o uso real também passa para hora em hora, não só o teste", async () => {
    m.set(STORE_KEY, JSON.stringify({ ...real([]), versao: 4, config: { ...baseVazia().config, intervalo: 45, qtdHorarios: 15 } }));
    await separarTeste();
    expect(abrirReal(await carregar(false)).config).toMatchObject({ intervalo: 60, qtdHorarios: 11 });
    expect(abrirTeste(await carregar(true)).config).toMatchObject({ intervalo: 60, qtdHorarios: 11 });
  });
});
