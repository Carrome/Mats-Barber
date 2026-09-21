import { describe, expect, it } from "vitest";
import { emailDe, traduzirErro } from "./nuvem.js";

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
});
