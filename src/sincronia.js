/* =====================================================================
   Marca de sincronia e a decisão de subir, baixar ou perguntar.

   A marca diz de qual versão do banco o estado do aparelho descende.
   Limpar o armazenamento leva os dados e a marca juntos, e é isso que
   torna a trava confiável: sem marca, a subida automática não existe.
   ===================================================================== */

export const MARCA_KEY = "matts-flex-sync-v1";

export function lerMarca() {
  try {
    const raw = window.localStorage.getItem(MARCA_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    return typeof m?.versao === "number" ? { versao: m.versao, origem: m.origem || "desconhecido" } : null;
  } catch (e) {
    return null;
  }
}

export function gravarMarca(versao, origem) {
  try {
    window.localStorage.setItem(MARCA_KEY, JSON.stringify({ versao, origem }));
  } catch (e) { /* armazenamento cheio: a próxima sincronização tenta de novo */ }
}

export function limparMarca() {
  try { window.localStorage.removeItem(MARCA_KEY); } catch (e) { /* ignora */ }
}

// Dados de exemplo contam como vazio: eles nascem sozinhos numa instalação
// nova (ver abrirDados em dados.js) e não podem valer mais que o banco.
export function ehVazio(db) {
  if (!db) return true;
  if (db.demo) return true;
  const n = (x) => (Array.isArray(x) ? x.length : 0);
  return n(db.clientes) === 0 && n(db.agendamentos) === 0 && n(db.pacotes) === 0;
}

export function decidirAcao({ marca, local, nuvem }) {
  if (marca) return "sincronizar";
  if (!nuvem.existe) return "criar";
  // Sem marca o aparelho não tem como provar que descende do banco.
  // Vazio (ou exemplo) baixa; com dados reais, quem decide é gente.
  return ehVazio(local) ? "baixar" : "perguntar";
}
