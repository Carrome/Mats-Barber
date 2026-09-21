/* =====================================================================
   Acesso ao banco: sessão e leitura/gravação do retrato da barbearia
   ===================================================================== */
import { createClient } from "@supabase/supabase-js";
import { DOMINIO_LOGIN, SUPABASE_KEY, SUPABASE_URL } from "./config.js";

export const cliente = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// O Matheus digita só "mats". O formato de e-mail é exigência do login,
// não um endereço de verdade: ninguém envia nada para cá.
export function emailDe(usuario) {
  const u = String(usuario || "").trim().toLowerCase();
  return u.includes("@") ? u : `${u}@${DOMINIO_LOGIN}`;
}

// Mensagens próprias: as originais vêm em inglês e citam o fornecedor.
export function traduzirErro(erro) {
  const m = String(erro?.message || "");
  if (/invalid login credentials/i.test(m)) return "Usuário ou senha incorretos.";
  if (/failed to fetch|network|fetch failed|load failed/i.test(m)) return "Sem conexão com a internet.";
  if (/email not confirmed/i.test(m)) return "Esta conta ainda não foi liberada.";
  if (/rate limit|too many/i.test(m)) return "Muitas tentativas seguidas. Espere um minuto.";
  return "Não foi possível entrar agora. Tente de novo.";
}

export async function entrar(usuario, senha) {
  try {
    const { error } = await cliente.auth.signInWithPassword({ email: emailDe(usuario), password: senha });
    return error ? { ok: false, erro: traduzirErro(error) } : { ok: true };
  } catch (e) {
    return { ok: false, erro: traduzirErro(e) };
  }
}

export async function sair() {
  try { await cliente.auth.signOut(); } catch (e) { /* offline: a sessão local some no reload */ }
}

// Lê a sessão guardada no aparelho. Funciona sem internet, e é isso que
// deixa o app abrir offline para quem já entrou alguma vez.
export async function sessaoAtual() {
  try {
    const { data } = await cliente.auth.getSession();
    return data?.session || null;
  } catch (e) {
    return null;
  }
}

const TABELA = "barbearia";

export async function lerNuvem() {
  const vazio = { existe: false, versao: null, dados: null, em: null };
  try {
    const { data, error } = await cliente.from(TABELA).select("versao, dados, atualizado_em").maybeSingle();
    if (error) return { ...vazio, erro: traduzirErro(error) };
    if (!data) return vazio;
    return { existe: true, versao: data.versao, dados: data.dados, em: data.atualizado_em };
  } catch (e) {
    return { ...vazio, erro: traduzirErro(e) };
  }
}

export async function criarNuvem(dados, origem) {
  try {
    const sessao = await sessaoAtual();
    if (!sessao) return { ok: false, erro: "Sessão encerrada." };
    const { data, error } = await cliente.from(TABELA)
      .insert({ dono: sessao.user.id, dados, atualizado_por: origem })
      .select("versao").single();
    return error ? { ok: false, erro: traduzirErro(error) } : { ok: true, versao: data.versao };
  } catch (e) {
    return { ok: false, erro: traduzirErro(e) };
  }
}

// A gravação declara de qual versão partiu. Se o banco já passou dessa
// versão, nada é alterado e devolvemos conflito: quem está atrasado baixa
// antes de insistir. O número novo quem escolhe é o gatilho, no servidor.
export async function gravarNuvem(dados, versaoBase, origem) {
  try {
    const { data, error } = await cliente.from(TABELA)
      .update({ dados, atualizado_por: origem })
      .eq("versao", versaoBase)
      .select("versao");
    if (error) return { ok: false, erro: traduzirErro(error) };
    if (!data || data.length === 0) return { ok: false, conflito: true };
    return { ok: true, versao: data[0].versao };
  } catch (e) {
    return { ok: false, erro: traduzirErro(e) };
  }
}
