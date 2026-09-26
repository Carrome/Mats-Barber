// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decidirAcao, ehVazio, gravarMarca, lerMarca, limparMarca, MARCA_KEY, marcarPendente, origemAparelho, tamanho, textoSync,
} from "./sincronia.js";
import { baseVazia } from "./dados.js";

const comDados = () => {
  const d = baseVazia();
  d.clientes.push({ id: "c1", nome: "João", telefone: "" });
  d.agendamentos.push({ id: "a1", data: "2026-09-21", hora: "09:00", tipo: "avulso", valor: 45, status: "agendado" });
  return d;
};
const comClientes = (n) => {
  const d = baseVazia();
  d.clientes = Array.from({ length: n }, (_, i) => ({ id: "c" + i, nome: "Cliente " + i }));
  return d;
};
const exemplo = () => ({ ...comDados(), demo: true });

describe("ehVazio", () => {
  it("base recém-criada é vazia", () => {
    expect(ehVazio(baseVazia())).toBe(true);
  });

  it("nulo é vazio", () => {
    expect(ehVazio(null)).toBe(true);
  });

  it("dados de exemplo contam como vazio mesmo cheios de cliente", () => {
    expect(ehVazio(exemplo())).toBe(true);
  });

  it("dados reais não são vazios", () => {
    expect(ehVazio(comDados())).toBe(false);
  });
});

describe("tamanho", () => {
  it("soma clientes, horários e pacotes", () => {
    const d = comDados();
    d.pacotes.push({ id: "p1" });
    expect(tamanho(d)).toBe(3);
  });

  it("nulo tem tamanho zero", () => {
    expect(tamanho(null)).toBe(0);
  });
});

describe("decidirAcao", () => {
  it("com marca, segue a sincronização normal", () => {
    const acao = decidirAcao({ marca: { versao: 7, origem: "celular" }, local: comDados(), nuvem: { existe: true, versao: 7 } });
    expect(acao).toBe("sincronizar");
  });

  it("banco ainda não existe e aparelho com dados: cria a partir do aparelho", () => {
    const acao = decidirAcao({ marca: null, local: comDados(), nuvem: { existe: false, versao: null } });
    expect(acao).toBe("criar");
  });

  it("banco ainda não existe e aparelho vazio ou de exemplo: aguarda, nunca cria banco vazio", () => {
    for (const local of [null, baseVazia(), exemplo()]) {
      expect(decidirAcao({ marca: null, local, nuvem: { existe: false, versao: null } })).toBe("aguardar");
    }
  });

  // TRAVA PRINCIPAL
  it("aparelho limpo e banco com dados: só baixa", () => {
    const acao = decidirAcao({ marca: null, local: baseVazia(), nuvem: { existe: true, versao: 12, dados: comDados() } });
    expect(acao).toBe("baixar");
  });

  it("aparelho com dados de exemplo e banco com dados: só baixa", () => {
    const acao = decidirAcao({ marca: null, local: exemplo(), nuvem: { existe: true, versao: 12, dados: comDados() } });
    expect(acao).toBe("baixar");
  });

  it("aparelho sem dados nenhum e banco com dados: só baixa", () => {
    const acao = decidirAcao({ marca: null, local: null, nuvem: { existe: true, versao: 3, dados: comDados() } });
    expect(acao).toBe("baixar");
  });

  it("aparelho vazio nunca cria nem sobe, qualquer que seja o banco", () => {
    const bancos = [{ existe: false, versao: null }, { existe: true, versao: 2, dados: baseVazia() }, { existe: true, versao: 9, dados: comDados() }];
    for (const local of [null, baseVazia(), exemplo()]) {
      for (const nuvem of bancos) {
        expect(["criar", "subir"]).not.toContain(decidirAcao({ marca: null, local, nuvem }));
      }
    }
  });

  it("banco existe mas sem dados reais, e aparelho com dados: sobe", () => {
    const acao = decidirAcao({ marca: null, local: comDados(), nuvem: { existe: true, versao: 1, dados: baseVazia() } });
    expect(acao).toBe("subir");
  });

  // Os dados reais que já existem prevalecem: entre dois lados com dados, vence o maior.
  it("os dois com dados e o aparelho maior: sobe", () => {
    const acao = decidirAcao({ marca: null, local: comClientes(40), nuvem: { existe: true, versao: 2, dados: comClientes(3) } });
    expect(acao).toBe("subir");
  });

  it("os dois com dados e o banco maior: baixa", () => {
    const acao = decidirAcao({ marca: null, local: comClientes(3), nuvem: { existe: true, versao: 2, dados: comClientes(40) } });
    expect(acao).toBe("baixar");
  });

  it("empate fica com o banco", () => {
    const acao = decidirAcao({ marca: null, local: comClientes(5), nuvem: { existe: true, versao: 2, dados: comClientes(5) } });
    expect(acao).toBe("baixar");
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

  it("grava e lê de volta, sem pendência por padrão", () => {
    gravarMarca(5, "celular");
    expect(lerMarca()).toEqual({ versao: 5, origem: "celular", pendente: false });
  });

  it("marcarPendente liga a pendência sem mexer na versão", () => {
    gravarMarca(5, "celular");
    marcarPendente();
    expect(lerMarca()).toEqual({ versao: 5, origem: "celular", pendente: true });
  });

  it("marcarPendente sem marca não cria marca", () => {
    marcarPendente();
    expect(lerMarca()).toBe(null);
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

  it("o nome do aparelho é sorteado uma vez e fica o mesmo", () => {
    const nome = origemAparelho();
    expect(nome).toMatch(/^(iPhone|Android|Computador)-[a-z0-9]{4}$/);
    expect(origemAparelho()).toBe(nome);
  });
});

describe("textoSync", () => {
  it("diz a hora da última sincronização de hoje", () => {
    const d = new Date();
    d.setHours(14, 32, 0, 0);
    expect(textoSync({ fase: "ok", ultima: d.toISOString() })).toBe("Sincronizado às 14:32.");
  });

  it("de outro dia, diz a data também", () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(textoSync({ fase: "ok", ultima: d.toISOString() })).toBe("Sincronizado em 05/01/2026 às 09:07.");
  });

  it("cada fase tem uma frase própria", () => {
    expect(textoSync({ fase: "conectando" })).toBe("Conectando…");
    expect(textoSync({ fase: "enviando" })).toBe("Enviando alterações…");
    expect(textoSync({ fase: "pendente" })).toBe("Alterações esperando para enviar.");
    expect(textoSync({ fase: "sem-conexao" })).toBe("Sem conexão. As alterações são enviadas quando a internet voltar.");
    expect(textoSync({ fase: "aguardando" })).toBe("Aguardando os dados do outro celular.");
  });

  it("nenhuma frase cita o fornecedor", () => {
    for (const fase of ["conectando", "ok", "enviando", "pendente", "sem-conexao", "aguardando"]) {
      expect(textoSync({ fase, ultima: new Date().toISOString() })).not.toMatch(/supabase|nuvem gratuita/i);
    }
  });
});
