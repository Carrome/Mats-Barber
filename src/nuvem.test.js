import { describe, expect, it, vi, beforeEach } from "vitest";
import { emailDe, traduzirErro, entrar, sair, sessaoAtual, lerNuvem, criarNuvem, gravarNuvem, versaoNuvem } from "./nuvem.js";
import { CODIGO_SYNC } from "./config.js";
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

describe("retrato da barbearia (funções do banco)", () => {
  // O app só fala com o banco por funções (sql/02-sem-login.sql). Cada teste
  // define a resposta que a função devolveria.
  const responde = (data, error = null) => { cliente.rpc = vi.fn().mockResolvedValue({ data, error }); };
  const explode = () => { cliente.rpc = vi.fn(() => { throw new Error("Failed to fetch"); }); };
  const semRede = { message: "Failed to fetch" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("versaoNuvem", () => {
    it("leva o código do app e devolve o número da versão", async () => {
      responde(7);
      expect(await versaoNuvem()).toEqual({ versao: 7 });
      expect(cliente.rpc).toHaveBeenCalledWith("mf_versao", { p_codigo: CODIGO_SYNC });
    });

    it("banco vazio devolve versão nula, sem erro", async () => {
      responde(null);
      const resultado = await versaoNuvem();
      expect(resultado).toEqual({ versao: null });
      expect("erro" in resultado).toBe(false);
    });

    it("falha de rede vira erro traduzido", async () => {
      responde(null, semRede);
      expect(await versaoNuvem()).toEqual({ versao: null, erro: "Sem conexão com a internet." });
    });

    it("trata exceção e devolve erro traduzido", async () => {
      explode();
      expect(await versaoNuvem()).toEqual({ versao: null, erro: "Sem conexão com a internet." });
    });
  });

  describe("lerNuvem", () => {
    it("devolve os dados quando a linha existe", async () => {
      responde([{ versao: 4, dados: { clientes: [] }, atualizado_em: "2026-09-20T12:00:00Z", atualizado_por: "Android-ab12" }]);
      expect(await lerNuvem()).toEqual({ existe: true, versao: 4, dados: { clientes: [] }, em: "2026-09-20T12:00:00Z" });
      expect(cliente.rpc).toHaveBeenCalledWith("mf_ler", { p_codigo: CODIGO_SYNC });
    });

    it("distingue ausência de falha: sem linha ainda, existe:false e sem campo erro", async () => {
      responde([]);
      const resultado = await lerNuvem();
      expect(resultado).toEqual({ existe: false, versao: null, dados: null, em: null });
      expect("erro" in resultado).toBe(false);
    });

    it("distingue ausência de falha: consulta com erro, existe:false com erro traduzido", async () => {
      responde(null, semRede);
      const resultado = await lerNuvem();
      expect(resultado.existe).toBe(false);
      expect(resultado.erro).toBe("Sem conexão com a internet.");
    });

    it("trata exceção e devolve existe:false com erro traduzido", async () => {
      explode();
      expect(await lerNuvem()).toEqual({ existe: false, versao: null, dados: null, em: null, erro: "Sem conexão com a internet." });
    });
  });

  describe("criarNuvem", () => {
    it("envia dados e origem com o código, e devolve a versão inicial", async () => {
      responde(1);
      const resultado = await criarNuvem({ clientes: [] }, "Android-ab12");
      expect(cliente.rpc).toHaveBeenCalledWith("mf_criar", { p_codigo: CODIGO_SYNC, p_dados: { clientes: [] }, p_origem: "Android-ab12" });
      expect(resultado).toEqual({ ok: true, versao: 1 });
    });

    it("outro aparelho criou antes: avisa que já existe, sem fingir sucesso", async () => {
      responde(null);
      expect(await criarNuvem({ clientes: [] }, "Android-ab12")).toEqual({ ok: false, existe: true });
    });

    it("devolve erro traduzido quando a chamada falha", async () => {
      responde(null, semRede);
      expect(await criarNuvem({ clientes: [] }, "Android-ab12")).toEqual({ ok: false, erro: "Sem conexão com a internet." });
    });

    it("trata exceção e devolve erro traduzido", async () => {
      explode();
      expect(await criarNuvem({ clientes: [] }, "Android-ab12")).toEqual({ ok: false, erro: "Sem conexão com a internet." });
    });
  });

  describe("gravarNuvem", () => {
    it("envia a versão base exata recebida", async () => {
      responde(4);
      await gravarNuvem({ clientes: [] }, 3, "iPhone-cd34");
      expect(cliente.rpc).toHaveBeenCalledWith("mf_gravar", { p_codigo: CODIGO_SYNC, p_dados: { clientes: [] }, p_base: 3, p_origem: "iPhone-cd34" });
    });

    it("relata conflito (sem gravar) quando o banco já passou da versão base", async () => {
      responde(null);
      expect(await gravarNuvem({ clientes: [] }, 3, "iPhone-cd34")).toEqual({ ok: false, conflito: true });
    });

    it("devolve a nova versão (definida pelo gatilho no servidor) quando a gravação é aceita", async () => {
      responde(9);
      expect(await gravarNuvem({ clientes: [] }, 8, "iPhone-cd34")).toEqual({ ok: true, versao: 9 });
    });

    it("devolve erro traduzido quando a chamada falha", async () => {
      responde(null, semRede);
      expect(await gravarNuvem({ clientes: [] }, 8, "iPhone-cd34")).toEqual({ ok: false, erro: "Sem conexão com a internet." });
    });

    it("trata exceção e devolve erro traduzido", async () => {
      explode();
      expect(await gravarNuvem({ clientes: [] }, 8, "iPhone-cd34")).toEqual({ ok: false, erro: "Sem conexão com a internet." });
    });
  });
});
