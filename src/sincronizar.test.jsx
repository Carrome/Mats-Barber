// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { useSincronia } from "./sincronizar.js";
import { baseVazia, lerCopiaAnterior } from "./dados.js";
import { gravarMarca, lerMarca } from "./sincronia.js";

vi.mock("./nuvem.js", () => ({
  lerNuvem: vi.fn(),
  versaoNuvem: vi.fn(),
  criarNuvem: vi.fn(),
  gravarNuvem: vi.fn(),
}));
import { criarNuvem, gravarNuvem, lerNuvem, versaoNuvem } from "./nuvem.js";

const comClientes = (n) => {
  const d = baseVazia();
  d.clientes = Array.from({ length: n }, (_, i) => ({ id: "c" + i, nome: "Cliente " + i }));
  return d;
};
const nomes = (d) => d.clientes.map((c) => c.nome);
const banco = (versao, dados) => ({ existe: true, versao, dados, em: "2026-09-25T12:00:00Z" });
const semRede = "Sem conexão com a internet.";
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Palco: o mínimo do App que o hook precisa (estado dos dados e um aviso).
let ctl;
let notify;
function Palco({ inicial, intervalo = 1e6 }) {
  const [db, setDb] = useState(inicial);
  const estado = useSincronia({ db, setDb, notify, atrasoEnvio: 20, intervalo });
  ctl.db = db;
  ctl.estado = estado;
  ctl.setDb = setDb;
  return null;
}
const montar = (inicial, props = {}) => render(<Palco inicial={inicial} {...props} />);
const mudar = (fn) => act(() => { ctl.setDb((d) => fn(structuredClone(d))); });
const novoCliente = (nome) => (d) => { d.clientes.push({ id: nome, nome }); return d; };
const disparar = (evento) => act(() => { window.dispatchEvent(new Event(evento)); });

beforeEach(() => {
  const m = new Map();
  vi.stubGlobal("localStorage", { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() });
  vi.clearAllMocks();
  ctl = {};
  notify = vi.fn();
  // Padrão: sem internet. Cada teste liga só o que precisa.
  versaoNuvem.mockResolvedValue({ versao: null, erro: semRede });
  lerNuvem.mockResolvedValue({ existe: false, versao: null, dados: null, em: null, erro: semRede });
  criarNuvem.mockResolvedValue({ ok: false, erro: semRede });
  gravarNuvem.mockResolvedValue({ ok: false, erro: semRede });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("primeira conexão do aparelho (sem marca)", () => {
  it("banco vazio e aparelho com dados: cria o banco com os dados do aparelho", async () => {
    lerNuvem.mockResolvedValue({ existe: false, versao: null, dados: null, em: null });
    criarNuvem.mockResolvedValue({ ok: true, versao: 1 });
    montar(comClientes(3));
    await waitFor(() => expect(lerMarca()).toMatchObject({ versao: 1, pendente: false }));
    expect(nomes(criarNuvem.mock.calls[0][0])).toEqual(["Cliente 0", "Cliente 1", "Cliente 2"]);
    expect(ctl.estado.fase).toBe("ok");
  });

  it("banco vazio e aparelho vazio: não cria banco vazio, fica aguardando", async () => {
    lerNuvem.mockResolvedValue({ existe: false, versao: null, dados: null, em: null });
    montar(baseVazia());
    await waitFor(() => expect(ctl.estado.fase).toBe("aguardando"));
    expect(criarNuvem).not.toHaveBeenCalled();
    expect(gravarNuvem).not.toHaveBeenCalled();
    expect(lerMarca()).toBe(null);
  });

  it("aparelho vazio e banco com dados: baixa, sem guardar cópia", async () => {
    lerNuvem.mockResolvedValue(banco(7, comClientes(40)));
    montar(baseVazia());
    await waitFor(() => expect(ctl.db.clientes).toHaveLength(40));
    expect(lerMarca()).toMatchObject({ versao: 7, pendente: false });
    expect(await lerCopiaAnterior(false)).toBe(null);
    expect(gravarNuvem).not.toHaveBeenCalled();
  });

  it("os dois com dados e o aparelho maior: os dados do aparelho sobem por cima do banco", async () => {
    lerNuvem.mockResolvedValue(banco(2, comClientes(1)));
    gravarNuvem.mockResolvedValue({ ok: true, versao: 3 });
    montar(comClientes(40));
    await waitFor(() => expect(lerMarca()).toMatchObject({ versao: 3, pendente: false }));
    expect(gravarNuvem.mock.calls[0][1]).toBe(2);
    expect(nomes(gravarNuvem.mock.calls[0][0])).toHaveLength(40);
    expect(ctl.db.clientes).toHaveLength(40);
  });

  it("os dois com dados e o banco maior: baixa e guarda os do aparelho como cópia anterior", async () => {
    lerNuvem.mockResolvedValue(banco(5, comClientes(40)));
    montar(comClientes(2));
    await waitFor(() => expect(ctl.db.clientes).toHaveLength(40));
    expect((await lerCopiaAnterior(false)).db.clientes).toHaveLength(2);
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Recuperar dados anteriores/));
    expect(gravarNuvem).not.toHaveBeenCalled();
  });
});

describe("uso de todo dia (aparelho com marca)", () => {
  beforeEach(() => {
    gravarMarca(3, "Android-aaaa");
    versaoNuvem.mockResolvedValue({ versao: 3 });
  });

  it("alteração local sobe depois do atraso, partindo da versão da marca", async () => {
    gravarNuvem.mockResolvedValue({ ok: true, versao: 4 });
    montar(comClientes(2));
    await waitFor(() => expect(ctl.estado.fase).toBe("ok"));
    mudar(novoCliente("Novo"));
    expect(lerMarca().pendente).toBe(true);
    await waitFor(() => expect(lerMarca()).toMatchObject({ versao: 4, pendente: false }));
    expect(gravarNuvem).toHaveBeenCalledTimes(1);
    expect(gravarNuvem.mock.calls[0][1]).toBe(3);
    expect(nomes(gravarNuvem.mock.calls[0][0])).toContain("Novo");
  });

  it("banco à frente e nada pendente: baixa na conferência seguinte", async () => {
    montar(comClientes(2));
    await waitFor(() => expect(ctl.estado.fase).toBe("ok"));
    versaoNuvem.mockResolvedValue({ versao: 6 });
    lerNuvem.mockResolvedValue(banco(6, comClientes(5)));
    disparar("online");
    await waitFor(() => expect(ctl.db.clientes).toHaveLength(5));
    expect(lerMarca()).toMatchObject({ versao: 6, pendente: false });
    expect(notify).toHaveBeenCalledWith("Atualizado com o outro celular");
    expect(await lerCopiaAnterior(false)).toBe(null);
    expect(gravarNuvem).not.toHaveBeenCalled();
  });

  it("colisão: o outro celular gravou antes; vale o banco e o local vira cópia anterior", async () => {
    gravarNuvem.mockResolvedValue({ ok: false, conflito: true });
    lerNuvem.mockResolvedValue(banco(5, comClientes(9)));
    montar(comClientes(2));
    await waitFor(() => expect(ctl.estado.fase).toBe("ok"));
    mudar(novoCliente("Novo"));
    await waitFor(() => expect(ctl.db.clientes).toHaveLength(9));
    expect(nomes((await lerCopiaAnterior(false)).db)).toContain("Novo");
    expect(lerMarca()).toMatchObject({ versao: 5, pendente: false });
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/outro celular salvou antes/));
  });

  it("sem internet a alteração fica pendente e sobe quando a conexão volta", async () => {
    montar(comClientes(2));
    await waitFor(() => expect(ctl.estado.fase).toBe("ok"));
    mudar(novoCliente("Novo"));
    await waitFor(() => expect(ctl.estado.fase).toBe("sem-conexao"));
    expect(lerMarca().pendente).toBe(true);
    gravarNuvem.mockResolvedValue({ ok: true, versao: 4 });
    disparar("online");
    await waitFor(() => expect(lerMarca()).toMatchObject({ versao: 4, pendente: false }));
    expect(nomes(gravarNuvem.mock.calls.at(-1)[0])).toContain("Novo");
  });

  it("alteração que ficou pendente quando o app fechou sobe ao abrir", async () => {
    gravarMarca(3, "Android-aaaa", true);
    gravarNuvem.mockResolvedValue({ ok: true, versao: 4 });
    montar(comClientes(2));
    await waitFor(() => expect(lerMarca()).toMatchObject({ versao: 4, pendente: false }));
    expect(gravarNuvem.mock.calls[0][1]).toBe(3);
  });

  it("alteração feita durante o envio não se perde: fica pendente e sobe em seguida", async () => {
    let liberar;
    gravarNuvem
      .mockImplementationOnce(() => new Promise((r) => { liberar = () => r({ ok: true, versao: 4 }); }))
      .mockResolvedValueOnce({ ok: true, versao: 5 });
    montar(comClientes(2));
    await waitFor(() => expect(ctl.estado.fase).toBe("ok"));
    mudar(novoCliente("Primeiro"));
    await waitFor(() => expect(gravarNuvem).toHaveBeenCalledTimes(1));
    mudar(novoCliente("Segundo"));
    await act(async () => { liberar(); });
    // se o app fechar agora, a marca ainda lembra que o "Segundo" não subiu
    expect(lerMarca()).toMatchObject({ versao: 4, pendente: true });
    await waitFor(() => expect(lerMarca()).toMatchObject({ versao: 5, pendente: false }));
    expect(gravarNuvem.mock.calls[1][1]).toBe(4);
    expect(nomes(gravarNuvem.mock.calls[1][0])).toEqual(expect.arrayContaining(["Primeiro", "Segundo"]));
  });

  it("envio agendado não manda nada se o app entrou no modo teste antes da hora", async () => {
    gravarNuvem.mockResolvedValue({ ok: true, versao: 4 });
    montar(comClientes(2));
    await waitFor(() => expect(ctl.estado.fase).toBe("ok"));
    mudar(novoCliente("Novo"));
    mudar(() => ({ ...comClientes(40), teste: true, demo: true }));
    await act(() => esperar(80));
    expect(gravarNuvem).not.toHaveBeenCalled();
  });

  it("confere o banco de tempos em tempos com o app aberto", async () => {
    montar(comClientes(2), { intervalo: 30 });
    await waitFor(() => expect(versaoNuvem.mock.calls.length).toBeGreaterThanOrEqual(3));
  });
});

describe("modo teste", () => {
  it("nunca fala com o banco, nem com alteração nem com a internet voltando", async () => {
    gravarMarca(3, "Android-aaaa");
    montar({ ...comClientes(2), teste: true, demo: true });
    mudar(novoCliente("Novo"));
    disparar("online");
    await act(() => esperar(80));
    for (const f of [lerNuvem, versaoNuvem, criarNuvem, gravarNuvem]) expect(f).not.toHaveBeenCalled();
    expect(lerMarca()).toMatchObject({ versao: 3, pendente: false });
  });
});
