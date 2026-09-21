import { describe, expect, it, vi, beforeEach } from "vitest";
import { emailDe, traduzirErro, entrar, sair, sessaoAtual } from "./nuvem.js";
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
