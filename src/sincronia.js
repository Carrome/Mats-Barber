/* =====================================================================
   Marca de sincronia e as decisões puras da sincronização.

   A marca diz de qual versão do banco o estado do aparelho descende, e se
   há alteração local que ainda não chegou lá. Limpar o armazenamento leva
   os dados e a marca juntos, e é isso que torna a trava confiável: sem
   marca, a subida automática não existe.
   ===================================================================== */

export const MARCA_KEY = "matts-flex-sync-v1";
export const APARELHO_KEY = "matts-flex-aparelho-v1";

export function lerMarca() {
  try {
    const raw = window.localStorage.getItem(MARCA_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    return typeof m?.versao === "number" ? { versao: m.versao, origem: m.origem || "desconhecido", pendente: !!m.pendente } : null;
  } catch (e) {
    return null;
  }
}

// pendente: há alteração local ainda não enviada. Fica gravado para
// sobreviver ao app fechado antes do envio.
export function gravarMarca(versao, origem, pendente = false) {
  try {
    window.localStorage.setItem(MARCA_KEY, JSON.stringify({ versao, origem, pendente: !!pendente }));
  } catch (e) { /* armazenamento cheio: a próxima sincronização tenta de novo */ }
}

export function marcarPendente() {
  const m = lerMarca();
  if (m && !m.pendente) gravarMarca(m.versao, m.origem, true);
}

export function limparMarca() {
  try { window.localStorage.removeItem(MARCA_KEY); } catch (e) { /* ignora */ }
}

// Nome do aparelho no histórico do banco: o tipo e 4 letras sorteadas uma vez.
export function origemAparelho() {
  try {
    let id = window.localStorage.getItem(APARELHO_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
      window.localStorage.setItem(APARELHO_KEY, id);
    }
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    const tipo = /iphone|ipad|ipod/i.test(ua) ? "iPhone" : /android/i.test(ua) ? "Android" : "Computador";
    return `${tipo}-${id}`;
  } catch (e) {
    return "desconhecido";
  }
}

// Dados de exemplo contam como vazio: eles nascem sozinhos numa instalação
// nova (ver abrirDados em dados.js) e não podem valer mais que o banco.
export function ehVazio(db) {
  if (!db) return true;
  if (db.demo) return true;
  const n = (x) => (Array.isArray(x) ? x.length : 0);
  return n(db.clientes) === 0 && n(db.agendamentos) === 0 && n(db.pacotes) === 0;
}

export function tamanho(db) {
  const n = (x) => (Array.isArray(x) ? x.length : 0);
  return db ? n(db.clientes) + n(db.agendamentos) + n(db.pacotes) : 0;
}

// Primeira conexão de um aparelho (sem marca). Os dados reais que já existem
// prevalecem: aparelho vazio nunca cria nem sobe, e entre dois lados com
// dados vence o maior, com empate para o banco. Quem perde fica guardado
// (cópia anterior no aparelho, histórico no banco).
export function decidirAcao({ marca, local, nuvem }) {
  if (marca) return "sincronizar";
  if (!nuvem.existe) return ehVazio(local) ? "aguardar" : "criar";
  if (ehVazio(local)) return "baixar";
  if (ehVazio(nuvem.dados)) return "subir";
  return tamanho(local) > tamanho(nuvem.dados) ? "subir" : "baixar";
}

// Linha de estado em Ajustes.
export function textoSync({ fase, ultima } = {}) {
  if (fase === "enviando") return "Enviando alterações…";
  if (fase === "pendente") return "Alterações esperando para enviar.";
  if (fase === "sem-conexao") return "Sem conexão. As alterações são enviadas quando a internet voltar.";
  if (fase === "aguardando") return "Aguardando os dados do outro celular.";
  if (fase === "conectando" || !ultima) return "Conectando…";
  const d = new Date(ultima);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return `Sincronizado às ${hora}.`;
  return `Sincronizado em ${d.toLocaleDateString("pt-BR")} às ${hora}.`;
}
