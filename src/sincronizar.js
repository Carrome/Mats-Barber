/* =====================================================================
   Sincronização do uso real com o banco, sem login.
   Uma operação de rede por vez; o que sobe é sempre o retrato inteiro.
   Colisão: vale quem gravou primeiro, e o lado que perde fica guardado.
   Regras: docs/superpowers/specs/2026-09-25-sincronizacao-sem-login-design.md
   ===================================================================== */
import { useEffect, useRef, useState } from "react";
import { abrirReal, guardarCopiaAnterior } from "./dados.js";
import { criarNuvem, gravarNuvem, lerNuvem, versaoNuvem } from "./nuvem.js";
import { decidirAcao, ehVazio, gravarMarca, lerMarca, limparMarca, marcarPendente, origemAparelho } from "./sincronia.js";

const AVISO_BAIXOU = "Atualizado com o outro celular";
const AVISO_PERDEU = "O outro celular salvou antes. O que estava neste aparelho ficou em Ajustes, em “Recuperar dados anteriores”.";

// fase: conectando | ok | enviando | pendente | sem-conexao | aguardando
// ultima: quando o banco respondeu pela última vez (ISO)
export function useSincronia({ db, setDb, notify, atrasoEnvio = 3000, intervalo = 30000 }) {
  const ativo = !!db && !db.teste;
  const [estado, setEstado] = useState({ fase: "conectando", ultima: null });
  const dbRef = useRef(db);
  dbRef.current = db;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const base = useRef(null);      // último retrato que o banco conhece (ou o carregado ao abrir)
  const ocupado = useRef(false);  // uma operação de rede por vez
  const timer = useRef(null);
  const eraAtivo = useRef(false);
  const origem = useRef(null);

  const quem = () => origem.current || (origem.current = origemAparelho());
  // Lido na hora, não no render: um timer antigo nunca envia os dados do modo teste.
  const podeAgir = () => !!dbRef.current && !dbRef.current.teste;
  const fase = (f, respondeu) => setEstado((e) => ({ fase: f, ultima: respondeu ? new Date().toISOString() : e.ultima }));
  const temLocal = () => !!lerMarca()?.pendente || dbRef.current !== base.current;

  // Aplica o que veio do banco. Se havia algo local ainda não enviado, vale o
  // banco e o local vira a cópia anterior, recuperável em Ajustes.
  async function baixar(n, perdeu) {
    if (!podeAgir()) return;
    if (perdeu) await guardarCopiaAnterior(dbRef.current);
    const novo = abrirReal(n.dados);
    base.current = novo;
    gravarMarca(n.versao, quem(), false);
    setDb(novo);
    notifyRef.current?.(perdeu ? AVISO_PERDEU : AVISO_BAIXOU);
    fase("ok", true);
  }

  // O banco aceitou `enviado`. Se algo mudou enquanto a rede respondia, segue pendente.
  function aceito(enviado, versao) {
    base.current = enviado;
    const mudouDepois = dbRef.current !== enviado;
    gravarMarca(versao, quem(), mudouDepois);
    if (mudouDepois) {
      fase("pendente", true);
      agendarEnvio();
    } else fase("ok", true);
  }

  async function enviar() {
    const marca = lerMarca();
    if (!marca || !podeAgir()) return;
    const enviado = dbRef.current;
    fase("enviando");
    const r = await gravarNuvem(enviado, marca.versao, quem());
    if (r.ok) return aceito(enviado, r.versao);
    if (!r.conflito) return fase("sem-conexao");
    // o banco passou na frente: vale o que chegou primeiro
    const n = await lerNuvem();
    if (n.erro || !n.existe) return fase("sem-conexao");
    await baixar(n, true);
  }

  // Primeira conexão deste aparelho (sem marca): ver decidirAcao.
  async function primeira() {
    const n = await lerNuvem();
    if (n.erro) return fase("sem-conexao");
    if (!podeAgir()) return;
    const local = dbRef.current;
    const acao = decidirAcao({ marca: null, local, nuvem: n });
    if (acao === "aguardar") return fase("aguardando", true);
    if (acao === "baixar") return baixar(n, !ehVazio(local));
    const r = acao === "criar" ? await criarNuvem(local, quem()) : await gravarNuvem(local, n.versao, quem());
    if (r.ok) return aceito(local, r.versao);
    // outro aparelho gravou antes: a próxima conferência decide de novo
    fase(r.erro ? "sem-conexao" : "aguardando");
  }

  // Ao abrir, ao voltar para o app, ao recuperar a rede e de tempos em tempos.
  async function conferir() {
    if (ocupado.current || !podeAgir()) return;
    ocupado.current = true;
    try {
      const marca = lerMarca();
      if (!marca) return await primeira();
      const v = await versaoNuvem();
      if (v.erro) return fase("sem-conexao");
      if (v.versao === marca.versao) return temLocal() ? await enviar() : fase("ok", true);
      if (v.versao == null) { // a linha sumiu do banco: recomeça como aparelho novo
        limparMarca();
        return await primeira();
      }
      const n = await lerNuvem();
      if (n.erro || !n.existe) return fase("sem-conexao");
      await baixar(n, temLocal());
    } finally {
      ocupado.current = false;
    }
  }

  function agendarEnvio(ms = atrasoEnvio) {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!podeAgir()) return;
      if (ocupado.current) return agendarEnvio();
      ocupado.current = true;
      try {
        await enviar();
      } finally {
        ocupado.current = false;
      }
    }, ms);
  }

  // Alteração local: marca pendente e envia depois de um tempo parado.
  useEffect(() => {
    if (!ativo) {
      eraAtivo.current = false;
      clearTimeout(timer.current);
      return;
    }
    if (!eraAtivo.current) { // abriu agora, ou voltou do modo teste
      eraAtivo.current = true;
      base.current = db;
      conferir();
      return;
    }
    // veio do banco, ou a primeira conexão ainda não aconteceu (ela decide sozinha)
    if (db === base.current || !lerMarca()) return;
    marcarPendente();
    fase("pendente");
    agendarEnvio();
  }, [db, ativo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ativo) return undefined;
    const aoMudarVisibilidade = () => {
      if (document.visibilityState !== "hidden") conferir();
      else if (lerMarca()?.pendente) agendarEnvio(0); // saindo do app: tenta enviar já
    };
    const aoConectar = () => conferir();
    const t = setInterval(() => { if (document.visibilityState !== "hidden") conferir(); }, intervalo);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    window.addEventListener("online", aoConectar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener("online", aoConectar);
    };
  }, [ativo, intervalo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timer.current), []);

  return estado;
}
