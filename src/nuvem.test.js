import { describe, expect, it, vi, beforeEach } from "vitest";
import { emailDe, traduzirErro, entrar, sair, sessaoAtual, lerNuvem, criarNuvem, gravarNuvem } from "./nuvem.js";
import { cliente } from "./nuvem.js";

describe("endereço interno do login", () => {
  it("completa o usuário com o domínio de publicação", () => {
    expect(emailDe("mats")).toBe("mats@mats-barber.vercel.app");
  });

  it("ignora espaços e maiúsculas digitados sem querer", () => {
    expect(emailDe("  MATS ")).toBe("mats@mats-barber.vercel.app");
  });

  it("se alguém digitar o endereço inteiro, não duplica o domínio", () => {
    expect(emailDe("mats@mats-barber.vercel.app")).toBe("mats@mats-barber.vercel.app");
  });
});

describe("mensagens de erro", () => {
  it("credencial errada vira português comum", () => {
    expect(traduzirErro({ message: "Invalid login credentials" })).toBe("Usuário ou senha incorretos.");
  });

  it("falha de rede avisa que é a internet", () => {
    expect(traduzirErro({ message: "Failed to fetch" })).toBe("Sem conexão com a internet.");
  });

  it("nenhuma mensagem entrega o nome do fornecedor", () => {
    const casos = [{ message: "Invalid login credentials" }, { message: "Failed to fetch" }, { message: "algo muito estranho" }, null];
    for (const c of casos) {
      const txt = traduzirErro(c);
      expect(txt).not.toMatch(/supabase/i);
      expect(txt).not.toMatch(/[a-z]+\.co\b/i);
      expect(txt.length).toBeGreaterThan(0);
    }
  });

  it("Safari: Load failed vira português comum", () => {
    expect(traduzirErro({ message: "TypeError: Load failed" })).toBe("Sem conexão com a internet.");
  });
});

describe("autenticação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("entrar chama signInWithPassword com o endereço construído", async () => {
    cliente.auth.signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    await entrar("mats", "senha123");
    expect(cliente.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "mats@mats-barber.vercel.app",
      password: "senha123",
    });
  });

  it("entrar retorna ok: true no sucesso", async () => {
    cliente.auth.signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    const result = await entrar("mats", "senha123");
    expect(result).toEqual({ ok: true });
  });

  it("entrar retorna ok: false com erro traduzido na falha", async () => {
    cliente.auth.signInWithPassword = vi.fn().mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const result = await entrar("mats", "errada");
    expect(result).toEqual({ ok: false, erro: "Usuário ou senha incorretos." });
  });

  it("entrar trata exceção e retorna com erro traduzido", async () => {
    cliente.auth.signInWithPassword = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    const result = await entrar("mats", "senha");
    expect(result).toEqual({ ok: false, erro: "Sem conexão com a internet." });
  });

  it("sair nunca rejeita, mesmo quando signOut rejeita", async () => {
    cliente.auth.signOut = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = sair();
    await expect(result).resolves.toBeUndefined();
  });

  it("sessaoAtual retorna a sessão quando existe", async () => {
    const sessaoMock = { user: { id: "123", email: "mats@mats-barber.vercel.app" } };
    cliente.auth.getSession = vi.fn().mockResolvedValue({ data: { session: sessaoMock } });
    const result = await sessaoAtual();
    expect(result).toEqual(sessaoMock);
  });

  it("sessaoAtual retorna null quando não há sessão", async () => {
    cliente.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null } });
    const result = await sessaoAtual();
    expect(result).toBeNull();
  });

  it("sessaoAtual retorna null quando getSession rejeita", async () => {
    cliente.auth.getSession = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await sessaoAtual();
    expect(result).toBeNull();
  });
});

describe("retrato da barbearia", () => {
  // Imita a cadeia do Supabase: cada método encadeável devolve o próprio
  // objeto, que também é "thenable" para responder a um await direto — é
  // o que gravarNuvem faz logo após o .select(), sem chamar .single().
  function construtorMock(resultado) {
    const construtor = {
      select: vi.fn(() => construtor),
      insert: vi.fn(() => construtor),
      update: vi.fn(() => construtor),
      eq: vi.fn(() => construtor),
      maybeSingle: vi.fn().mockResolvedValue(resultado),
      single: vi.fn().mockResolvedValue(resultado),
      then: (resolve, reject) => Promise.resolve(resultado).then(resolve, reject),
    };
    return construtor;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("lerNuvem", () => {
    it("devolve os dados quando a linha existe", async () => {
      const registro = { versao: 4, dados: { clientes: [] }, atualizado_em: "2026-09-20T12:00:00Z" };
      cliente.from = vi.fn().mockReturnValue(construtorMock({ data: registro, error: null }));
      const resultado = await lerNuvem();
      expect(resultado).toEqual({ existe: true, versao: 4, dados: { clientes: [] }, em: "2026-09-20T12:00:00Z" });
    });

    it("distingue ausência de falha: sem linha ainda, existe:false e sem campo erro", async () => {
      cliente.from = vi.fn().mockReturnValue(construtorMock({ data: null, error: null }));
      const resultado = await lerNuvem();
      expect(resultado).toEqual({ existe: false, versao: null, dados: null, em: null });
      expect("erro" in resultado).toBe(false);
    });

    it("distingue ausência de falha: consulta com erro, existe:false com erro traduzido", async () => {
      cliente.from = vi.fn().mockReturnValue(construtorMock({ data: null, error: { message: "Failed to fetch" } }));
      const resultado = await lerNuvem();
      expect(resultado.existe).toBe(false);
      expect(resultado.erro).toBe("Sem conexão com a internet.");
    });

    it("trata exceção e devolve existe:false com erro traduzido", async () => {
      cliente.from = vi.fn(() => { throw new Error("Failed to fetch"); });
      const resultado = await lerNuvem();
      expect(resultado).toEqual({ existe: false, versao: null, dados: null, em: null, erro: "Sem conexão com a internet." });
    });
  });

  describe("criarNuvem", () => {
    it("recusa quando não há sessão, sem lançar", async () => {
      cliente.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null } });
      const resultado = await criarNuvem({ clientes: [] }, "recepcao");
      expect(resultado).toEqual({ ok: false, erro: "Sessão encerrada." });
    });

    it("grava dono e origem, devolvendo a versão inicial", async () => {
      cliente.auth.getSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: "abc-123" } } } });
      const construtor = construtorMock({ data: { versao: 1 }, error: null });
      cliente.from = vi.fn().mockReturnValue(construtor);
      const resultado = await criarNuvem({ clientes: [] }, "recepcao");
      expect(construtor.insert).toHaveBeenCalledWith({ dono: "abc-123", dados: { clientes: [] }, atualizado_por: "recepcao" });
      expect(resultado).toEqual({ ok: true, versao: 1 });
    });

    it("devolve erro traduzido quando a inserção falha", async () => {
      cliente.auth.getSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: "abc-123" } } } });
      cliente.from = vi.fn().mockReturnValue(construtorMock({ data: null, error: { message: "Failed to fetch" } }));
      const resultado = await criarNuvem({ clientes: [] }, "recepcao");
      expect(resultado).toEqual({ ok: false, erro: "Sem conexão com a internet." });
    });

    it("trata exceção e devolve erro traduzido", async () => {
      cliente.auth.getSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: "abc-123" } } } });
      cliente.from = vi.fn(() => { throw new Error("Failed to fetch"); });
      const resultado = await criarNuvem({ clientes: [] }, "recepcao");
      expect(resultado).toEqual({ ok: false, erro: "Sem conexão com a internet." });
    });
  });

  describe("gravarNuvem", () => {
    it("inclui a condição de versão (.eq) com o valor base exato recebido", async () => {
      const construtor = construtorMock({ data: [{ versao: 5 }], error: null });
      cliente.from = vi.fn().mockReturnValue(construtor);
      await gravarNuvem({ clientes: [] }, 3, "recepcao");
      expect(cliente.from).toHaveBeenCalledWith("barbearia");
      expect(construtor.update).toHaveBeenCalledWith({ dados: { clientes: [] }, atualizado_por: "recepcao" });
      expect(construtor.eq).toHaveBeenCalledWith("versao", 3);
    });

    it("relata conflito (sem gravar) quando nenhuma linha volta da condição de versão", async () => {
      cliente.from = vi.fn().mockReturnValue(construtorMock({ data: [], error: null }));
      const resultado = await gravarNuvem({ clientes: [] }, 3, "recepcao");
      expect(resultado).toEqual({ ok: false, conflito: true });
    });

    it("devolve a nova versão (definida pelo gatilho no servidor) quando a gravação é aceita", async () => {
      cliente.from = vi.fn().mockReturnValue(construtorMock({ data: [{ versao: 9 }], error: null }));
      const resultado = await gravarNuvem({ clientes: [] }, 8, "recepcao");
      expect(resultado).toEqual({ ok: true, versao: 9 });
    });

    it("devolve erro traduzido quando a consulta falha", async () => {
      cliente.from = vi.fn().mockReturnValue(construtorMock({ data: null, error: { message: "Failed to fetch" } }));
      const resultado = await gravarNuvem({ clientes: [] }, 8, "recepcao");
      expect(resultado).toEqual({ ok: false, erro: "Sem conexão com a internet." });
    });

    it("trata exceção e devolve erro traduzido", async () => {
      cliente.from = vi.fn(() => { throw new Error("Failed to fetch"); });
      const resultado = await gravarNuvem({ clientes: [] }, 8, "recepcao");
      expect(resultado).toEqual({ ok: false, erro: "Sem conexão com a internet." });
    });
  });
});
