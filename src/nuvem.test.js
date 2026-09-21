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
  // Imita a cadeia do Supabase a partir das linhas que a tabela devolveria.
  // Os três jeitos de terminar a cadeia — await direto (o que gravarNuvem
  // faz depois do .select(), sem singularizar), .maybeSingle() e .single()
  // — resolvem formatos DIFERENTES a partir das mesmas linhas, do jeito que
  // o cliente de verdade resolve. É isso que dá dentes ao mock para
  // flagrar um .maybeSingle()/.single() removido por engano: antes, os três
  // caminhos resolviam sempre o mesmo objeto fixo, e trocar de método não
  // mudava nada que um teste pudesse perceber (ver "fidelidade do
  // construtorMock" abaixo).
  function construtorMock({ linhas = [], erro = null } = {}) {
    // .single() exige exatamente uma linha: zero ou mais de uma viram erro.
    const singularizar = () => {
      if (erro) return { data: null, error: erro };
      if (linhas.length === 1) return { data: linhas[0], error: null };
      return { data: null, error: { message: "Nenhuma linha, ou mais de uma." } };
    };
    // .maybeSingle() é igual, mas trata zero linhas como sucesso vazio.
    const singularizarOuVazio = () => {
      if (erro) return { data: null, error: erro };
      if (linhas.length === 0) return { data: null, error: null };
      if (linhas.length === 1) return { data: linhas[0], error: null };
      return { data: null, error: { message: "Mais de uma linha." } };
    };
    // Await direto na cadeia (sem singularizar): as linhas voltam como array.
    const bruto = () => (erro ? { data: null, error: erro } : { data: linhas, error: null });

    const construtor = {
      select: vi.fn(() => construtor),
      insert: vi.fn(() => construtor),
      update: vi.fn(() => construtor),
      eq: vi.fn(() => construtor),
      maybeSingle: vi.fn(() => Promise.resolve(singularizarOuVazio())),
      single: vi.fn(() => Promise.resolve(singularizar())),
      then: (resolve, reject) => Promise.resolve(bruto()).then(resolve, reject),
    };
    return construtor;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fidelidade do construtorMock", () => {
    // Estes dois testes não chamam lerNuvem/criarNuvem: eles provam que o
    // mock em si tem dentes para pegar a regressão apontada na revisão —
    // um .maybeSingle() ou .single() removido por engano do código real.
    it("await direto e .maybeSingle() resolvem formatos diferentes para zero linhas", async () => {
      const construtor = construtorMock({ linhas: [] });
      const semSingularizar = await construtor.select("versao, dados, atualizado_em");
      const comMaybeSingle = await construtor.select("versao, dados, atualizado_em").maybeSingle();
      // Sem singularizar (o que sobraria se .maybeSingle() fosse removido de
      // lerNuvem), zero linhas voltam como array — "truthy" em JS. O teste
      // "sem linha ainda" de lerNuvem só funciona porque .maybeSingle()
      // vira null nesse caso; se virasse array, aquele teste quebraria.
      expect(semSingularizar).toEqual({ data: [], error: null });
      expect(comMaybeSingle).toEqual({ data: null, error: null });
    });

    it("await direto e .single() resolvem formatos diferentes para zero linhas", async () => {
      const construtor = construtorMock({ linhas: [] });
      const semSingularizar = await construtor.insert({}).select("versao");
      const comSingle = await construtor.insert({}).select("versao").single();
      // Sem singularizar, zero linhas voltam como sucesso vazio; criarNuvem
      // devolveria {ok:true, versao:undefined} em vez de reportar a falha
      // real do insert. Com .single(), zero linhas viram erro.
      expect(semSingularizar).toEqual({ data: [], error: null });
      expect(comSingle.data).toBeNull();
      expect(comSingle.error).toBeTruthy();
    });
  });

  describe("lerNuvem", () => {
    it("devolve os dados quando a linha existe", async () => {
      const registro = { versao: 4, dados: { clientes: [] }, atualizado_em: "2026-09-20T12:00:00Z" };
      cliente.from = vi.fn().mockReturnValue(construtorMock({ linhas: [registro] }));
      const resultado = await lerNuvem();
      expect(resultado).toEqual({ existe: true, versao: 4, dados: { clientes: [] }, em: "2026-09-20T12:00:00Z" });
    });

    it("distingue ausência de falha: sem linha ainda, existe:false e sem campo erro", async () => {
      cliente.from = vi.fn().mockReturnValue(construtorMock({ linhas: [] }));
      const resultado = await lerNuvem();
      expect(resultado).toEqual({ existe: false, versao: null, dados: null, em: null });
      expect("erro" in resultado).toBe(false);
    });

    it("distingue ausência de falha: consulta com erro, existe:false com erro traduzido", async () => {
      cliente.from = vi.fn().mockReturnValue(construtorMock({ erro: { message: "Failed to fetch" } }));
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
      const construtor = construtorMock({ linhas: [{ versao: 1 }] });
      cliente.from = vi.fn().mockReturnValue(construtor);
      const resultado = await criarNuvem({ clientes: [] }, "recepcao");
      expect(construtor.insert).toHaveBeenCalledWith({ dono: "abc-123", dados: { clientes: [] }, atualizado_por: "recepcao" });
      expect(resultado).toEqual({ ok: true, versao: 1 });
    });

    it("devolve erro traduzido quando a inserção falha", async () => {
      cliente.auth.getSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: "abc-123" } } } });
      cliente.from = vi.fn().mockReturnValue(construtorMock({ erro: { message: "Failed to fetch" } }));
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
      const construtor = construtorMock({ linhas: [{ versao: 5 }] });
      cliente.from = vi.fn().mockReturnValue(construtor);
      await gravarNuvem({ clientes: [] }, 3, "recepcao");
      expect(cliente.from).toHaveBeenCalledWith("barbearia");
      expect(construtor.update).toHaveBeenCalledWith({ dados: { clientes: [] }, atualizado_por: "recepcao" });
      expect(construtor.eq).toHaveBeenCalledWith("versao", 3);
    });

    it("relata conflito (sem gravar) quando nenhuma linha volta da condição de versão", async () => {
      cliente.from = vi.fn().mockReturnValue(construtorMock({ linhas: [] }));
      const resultado = await gravarNuvem({ clientes: [] }, 3, "recepcao");
      expect(resultado).toEqual({ ok: false, conflito: true });
    });

    it("devolve a nova versão (definida pelo gatilho no servidor) quando a gravação é aceita", async () => {
      cliente.from = vi.fn().mockReturnValue(construtorMock({ linhas: [{ versao: 9 }] }));
      const resultado = await gravarNuvem({ clientes: [] }, 8, "recepcao");
      expect(resultado).toEqual({ ok: true, versao: 9 });
    });

    it("devolve erro traduzido quando a consulta falha", async () => {
      cliente.from = vi.fn().mockReturnValue(construtorMock({ erro: { message: "Failed to fetch" } }));
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
