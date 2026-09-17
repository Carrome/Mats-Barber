/* =====================================================================
   Matts Flex – app principal
   Estrutura:
     util.js        datas, formatos, WhatsApp, arquivos
     regras.js      regras de negócio (pacotes, campanhas, agenda, retorno)
     dados.js       armazenamento, migração e dados de exemplo
     estilos.js     CSS
     componentes.jsx  peças reutilizáveis (janela, campos, busca de cliente)
     telas/*.jsx    Painel, Agenda, Vagas, Clientes, Planos, Ajustes
   ===================================================================== */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, LayoutDashboard, RefreshCw, Settings, Sparkles, Ticket, Users, AlertTriangle } from "lucide-react";
import { CSS } from "./estilos.js";
import { entregarArquivo, hojeYmd } from "./util.js";
import { pendentes } from "./regras.js";
import { abrirDados, baseVazia, carregar, criarDemo, guardarCopiaAnterior, migrar, salvar, STORE_KEY } from "./dados.js";
import { Sheet } from "./componentes.jsx";
import { Painel } from "./telas/Painel.jsx";
import { Agenda, PendenciasSheet, SlotSheet } from "./telas/Agenda.jsx";
import { Vagas } from "./telas/Vagas.jsx";
import { Clientes, ClienteDetalhe } from "./telas/Clientes.jsx";
import { PacoteDetalhe, Planos, VendaForm } from "./telas/Planos.jsx";
import { Ajustes } from "./telas/Ajustes.jsx";

const NAV = [
  ["painel", "Painel", LayoutDashboard],
  ["agenda", "Agenda", CalendarDays],
  ["vagas", "Vagas", Sparkles],
  ["clientes", "Clientes", Users],
  ["planos", "Planos", Ticket],
];
const ABAS = ["painel", "agenda", "vagas", "clientes", "planos", "ajustes"];
const clonar = (x) => (typeof structuredClone === "function" ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

export default function App() {
  const [db, setDb] = useState(null);
  const [aba, setAba] = useState(() => {
    try { const a = new URLSearchParams(window.location.search).get("aba"); return ABAS.includes(a) ? a : "painel"; }
    catch (e) { return "painel"; }
  });
  const [subPlanos, setSubPlanos] = useState("planos");
  const [agendaData, setAgendaData] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [venda, setVenda] = useState(null);
  const [pacoteVer, setPacoteVer] = useState(null);
  const [clienteVer, setClienteVer] = useState(null);
  const [horario, setHorario] = useState(null);
  const [pendAberto, setPendAberto] = useState(false);
  const [instalarEvt, setInstalarEvt] = useState(null);
  const [persistido, setPersistido] = useState(null);
  const [erroSalvar, setErroSalvar] = useState(false);
  const [novaVersao, setNovaVersao] = useState(false);
  const timer = useRef(null);
  const desfazerRef = useRef(null);
  const dbRef = useRef(null);
  dbRef.current = db;

  /* ---------- carregar, instalar, proteger dados ---------- */
  useEffect(() => {
    let vivo = true;
    carregar().then((d) => { if (vivo) setDb(abrirDados(d)); });
    const h = (e) => { e.preventDefault(); setInstalarEvt(e); };
    const instalado = () => setInstalarEvt(null);
    const versao = () => setNovaVersao(true);
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", instalado);
    window.addEventListener("mf-nova-versao", versao);
    try {
      navigator.storage?.persisted?.().then((p) => {
        if (p) setPersistido(true);
        else navigator.storage.persist?.().then((ok) => vivo && setPersistido(!!ok)).catch(() => {});
      }).catch(() => {});
    } catch (e) { /* navegador sem suporte */ }
    return () => {
      vivo = false;
      window.removeEventListener("beforeinstallprompt", h);
      window.removeEventListener("appinstalled", instalado);
      window.removeEventListener("mf-nova-versao", versao);
    };
  }, []);

  /* ---------- salvar (com atraso curto) e ao sair do app ---------- */
  useEffect(() => {
    if (!db) return;
    const t = setTimeout(() => salvar(db).then((ok) => setErroSalvar(!ok)), 300);
    return () => clearTimeout(t);
  }, [db]);
  useEffect(() => {
    const flush = () => { if (dbRef.current) salvar(dbRef.current); };
    const vis = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", flush);
    // outra aba aberta mexeu nos dados: recarrega
    const outra = (e) => {
      if (e.key !== STORE_KEY || !e.newValue) return;
      try { setDb(migrar(JSON.parse(e.newValue))); } catch (err) { /* ignora */ }
    };
    window.addEventListener("storage", outra);
    return () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("pagehide", flush); window.removeEventListener("storage", outra); };
  }, []);

  /* ---------- ações globais ---------- */
  // update(fn, desfazivel): fn recebe uma cópia dos dados e devolve a nova versão
  const update = useCallback((fn, desfazivel) => {
    setDb((prev) => {
      const next = fn(clonar(prev));
      desfazerRef.current = desfazivel ? prev : null;
      return next;
    });
  }, []);
  const notify = useCallback((msg, desfazer) => {
    setToast({ msg, desfazer: !!desfazer });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), desfazer ? 6000 : 2600);
  }, []);
  const desfazer = () => {
    if (desfazerRef.current) {
      setDb(desfazerRef.current);
      desfazerRef.current = null;
      notify("Desfeito");
    } else setToast(null);
  };
  const ask = useCallback((msg, sim) => setConfirmar({ msg, sim }), []);
  const substituir = useCallback((novo, msg) => {
    const atual = dbRef.current;
    if (atual) guardarCopiaAnterior(atual);
    desfazerRef.current = atual;
    setDb(novo);
    setClienteVer(null); setPacoteVer(null); setHorario(null); setVenda(null);
    if (msg) notify(msg, true);
  }, [notify]);

  const go = useCallback((a, sub) => {
    setAba(a);
    setAgendaData(null);
    if (sub) setSubPlanos(sub);
    window.scrollTo?.(0, 0);
  }, []);
  const abrir = useMemo(() => ({
    venda: (clienteId) => setVenda({ cliente: clienteId || null }),
    pacote: (id) => setPacoteVer(id),
    cliente: (id) => setClienteVer(id),
    horario: (data, hora) => setHorario({ data, hora }),
    pendencias: () => setPendAberto(true),
    agenda: (data) => { setClienteVer(null); setAba("agenda"); setAgendaData(data || null); window.scrollTo?.(0, 0); },
    aba: (a, sub) => go(a, sub),
  }), [go]);

  const fazerBackup = useCallback(async () => {
    const atual = dbRef.current;
    const blob = new Blob([JSON.stringify(atual, null, 2)], { type: "application/json" });
    const r = await entregarArquivo(`matts-flex-backup-${hojeYmd()}.json`, blob, "Backup Matts Flex");
    if (r === "compartilhado" || r === "baixado") {
      update((d) => { d.config.ultimoBackup = new Date().toISOString(); return d; });
      notify(r === "baixado" ? "Backup baixado. Guarde o arquivo no Drive ou WhatsApp." : "Backup enviado");
    } else if (r === "erro") notify("Não foi possível gerar o backup neste navegador");
  }, [update, notify]);

  const ios = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone);
  const instalar = instalarEvt ? async () => { instalarEvt.prompt(); try { await instalarEvt.userChoice; } catch (e) { /* */ } setInstalarEvt(null); } : null;

  if (!db) {
    return (
      <div className="mf"><style>{CSS}</style>
        <div className="mf-loading"><img className="mf-logo" src="icons/logo.png" alt="Matheu's Barber" /><span className="dsp" style={{ fontSize: 28 }}>Matts Flex</span></div>
      </div>
    );
  }

  const props = { db, update, notify, ask, abrir };
  const pacoteSel = pacoteVer && db.pacotes.find((p) => p.id === pacoteVer);
  const clienteSel = clienteVer && db.clientes.find((c) => c.id === clienteVer);
  const qtdPend = pendentes(db).length;

  const tema = db.config.tema === "claro" || db.config.tema === "escuro" ? db.config.tema : undefined;
  return (
    <div className="mf" data-tema={tema}>
      <style>{CSS}</style>
      <nav className="mf-rail" aria-label="Menu principal">
        <div className="marca"><img className="mf-logo" src="icons/logo.png" alt="" /><div><div className="nome">Matts Flex</div><div className="loja">{db.config.nome}</div></div></div>
        {NAV.map(([id, label, Icon]) => (
          <button key={id} className={aba === id ? "on" : ""} onClick={() => go(id)} aria-current={aba === id ? "page" : undefined}>
            <Icon size={19} />{label}{id === "agenda" && qtdPend > 0 && <span className="mf-cont" aria-label={`${qtdPend} pendentes`}>{qtdPend}</span>}
          </button>
        ))}
        <button className={"fim" + (aba === "ajustes" ? " on" : "")} onClick={() => go("ajustes")}><Settings size={19} />Ajustes</button>
      </nav>

      <main className="mf-main">
        <header className="mf-top">
          <img className="mf-logo" src="icons/logo.png" alt="" />
          <div style={{ minWidth: 0 }}><div className="nome">Matts Flex</div><div className="loja mf-ellip">{db.config.nome}</div></div>
          <div className="sp" />
          <button className="mf-iconbtn" onClick={() => setVenda({ cliente: null })} aria-label="Vender plano"><Ticket size={21} /></button>
          <button className="mf-iconbtn" onClick={() => go("ajustes")} aria-label="Ajustes"><Settings size={21} /></button>
        </header>

        {(db.demo || novaVersao || erroSalvar) && (
          <div className="mf-wrap mf-stack" style={{ paddingBottom: 0, gap: 8 }}>
            {erroSalvar && (
              <div className="mf-alerta"><AlertTriangle size={18} /><span className="mf-grow">Não foi possível salvar neste aparelho (memória cheia ou modo anônimo). Faça um backup agora.</span><button className="mf-btn sm poste" onClick={fazerBackup}>Backup</button></div>
            )}
            {novaVersao && (
              <div className="mf-banner info" style={{ marginBottom: 0 }}><RefreshCw size={18} /><span className="mf-grow">Nova versão do Matts Flex instalada.</span><button className="mf-btn sm" onClick={() => window.location.reload()}>Atualizar</button></div>
            )}
            {db.demo && (
              <div className="mf-banner" style={{ marginBottom: 0 }}>
                <span className="mf-grow">Você está vendo dados de exemplo para testar o app.</span>
                <button className="mf-btn sm" onClick={() => ask("Apagar os dados de exemplo e começar do zero? Serviços, planos e campanhas são mantidos.", () => {
                  const v = baseVazia();
                  substituir({ ...v, config: { ...db.config, pausas: [] }, servicos: db.servicos, planos: db.planos, campanhas: db.campanhas }, "Pronto para começar");
                })}>Começar do zero</button>
                <button className="mf-link" onClick={() => update((d) => { d.demo = false; return d; })}>Continuar com eles</button>
              </div>
            )}
          </div>
        )}

        {aba === "painel" && <Painel {...props} fazerBackup={fazerBackup} />}
        {aba === "agenda" && <Agenda key={agendaData || "hoje"} {...props} dataInicial={agendaData} />}
        {aba === "vagas" && <Vagas {...props} />}
        {aba === "clientes" && <Clientes {...props} />}
        {aba === "planos" && <Planos {...props} sub={subPlanos} setSub={setSubPlanos} />}
        {aba === "ajustes" && (
          <Ajustes {...props} substituir={substituir} fazerBackup={fazerBackup} persistido={persistido}
            instalar={instalar || (ios && !standalone ? () => notify("No iPhone: toque em Compartilhar e depois em “Adicionar à Tela de Início”") : null)} />
        )}
      </main>

      <nav className="mf-bottom" aria-label="Menu">
        {NAV.map(([id, label, Icon]) => (
          <button key={id} className={aba === id ? "on" : ""} onClick={() => go(id)} aria-current={aba === id ? "page" : undefined}>
            <Icon size={22} />{label}
            {id === "agenda" && qtdPend > 0 && <span className="mf-badge" aria-label={`${qtdPend} pendentes`}>{qtdPend > 99 ? "99+" : qtdPend}</span>}
          </button>
        ))}
      </nav>

      {clienteSel && <ClienteDetalhe {...props} cliente={clienteSel} onClose={() => setClienteVer(null)} />}
      {venda && <VendaForm {...props} clienteInicial={venda.cliente} onClose={() => setVenda(null)} />}
      {pacoteSel && <PacoteDetalhe {...props} pacote={pacoteSel} onClose={() => setPacoteVer(null)} />}
      {horario && <SlotSheet {...props} data={horario.data} hora={horario.hora} onClose={() => setHorario(null)} />}
      {pendAberto && <PendenciasSheet {...props} onClose={() => setPendAberto(false)} />}
      {confirmar && (
        <Sheet titulo="Tem certeza?" onClose={() => setConfirmar(null)}>
          <div className="mf-stack">
            <p>{confirmar.msg}</p>
            <div className="mf-row">
              <button className="mf-btn alt" onClick={() => setConfirmar(null)}>Voltar</button>
              <button className="mf-btn poste" onClick={() => { const f = confirmar.sim; setConfirmar(null); f(); }}>Confirmar</button>
            </div>
          </div>
        </Sheet>
      )}
      {toast && (
        <div className="mf-toast" role="status">
          <span className={toast.desfazer ? "" : "sem"}>{toast.msg}</span>
          {toast.desfazer && <button className="mf-link" onClick={desfazer}>Desfazer</button>}
        </div>
      )}
    </div>
  );
}
