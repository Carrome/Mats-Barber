/* =====================================================================
   Agenda: semana/dia, horários, agendar, ofertar, bloquear, remarcar,
   encaixe, fechar dia e pendências
   ===================================================================== */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CalendarClock, CalendarX, Check, ChevronLeft, ChevronRight, Clock, Coffee, MessageCircle, Plus, Repeat,
} from "lucide-react";
import {
  addDays, brl, cap, dataLonga, DIAS_CURTO, DIAS_LONGO, ddmm, diasDaSemana, horaValida, hojeYmd, inicioMes, momento,
  nomeMes, PAGAMENTOS, parse, primeiroNome, r2, segundaDe, semanasDoMes, uid, whats, ymd, iniciais, plural,
} from "../util.js";
import {
  atendeNoDia, campanhaDe, campanhaVale, clienteDe, diaFechado, horariosDe, horasDoDia, horasLivresNoDia, mapaAgenda,
  pacoteDe, pacotesUsaveis, pausaEm, pendentes, precoCampanha, rotuloDesconto, servicoDe, TIPOS_ATENDIMENTO,
} from "../regras.js";
import { BarraSaldo, Campo, ClientePicker, NumInput, Seg, Sheet, Tag, TextoBlur, useAgora, useLargo } from "../componentes.jsx";

const indiceSemana = (ref, dias, data) => {
  const i = semanasDoMes(ref, dias).findIndex((m) => ymd(m) === ymd(segundaDe(data)));
  return i >= 0 ? i : 0;
};

/* ---------------------------------------------------------------------
   Um horário na grade
   --------------------------------------------------------------------- */
function Slot({ db, ag, hora, pausa, passado, foraGrade, onClick }) {
  if (!ag) {
    if (pausa) {
      return (
        <button className={"mf-slot pausa" + (passado ? " passado" : "")} onClick={onClick} aria-label={`${hora} ${pausa.motivo}`}>
          <span className="h">{hora}</span><span className="t">{pausa.motivo || "Pausa"}</span>
        </button>
      );
    }
    return (
      <button className={"mf-slot livre" + (passado ? " passado" : "")} onClick={onClick} aria-label={`${hora} livre`}>
        <span className="h">{hora}</span><span className="t">{passado ? "Passou" : "Livre"}</span>
      </button>
    );
  }
  const cli = ag.clienteId && clienteDe(db, ag.clienteId);
  const camp = ag.campanhaId && campanhaDe(db, ag.campanhaId);
  let cls = ag.tipo, t = cli?.nome || "Cliente", s = servicoDe(db, ag.servicoId)?.nome;
  if (ag.tipo === "oferta") { t = passado ? "Não vendida" : camp?.nome || "Oferta"; s = brl(ag.valor); if (passado) cls += " encerrada"; }
  if (ag.tipo === "bloqueio") { t = ag.obs || "Bloqueado"; s = ""; }
  if (ag.tipo === "pacote") s = `${pacoteDe(db, ag.pacoteId)?.codigo || "Pacote"}${ag.deOferta ? " · Flex" : ""}`;
  if (ag.tipo === "campanha") s = camp?.nome;
  const pendente = passado && ag.status === "agendado" && TIPOS_ATENDIMENTO.includes(ag.tipo);
  if (ag.status === "concluido") cls += " feito";
  if (ag.status === "faltou") { cls += " faltou"; s = "Faltou"; }
  if (pendente) cls += " pendente";
  return (
    <button className={"mf-slot " + cls} onClick={onClick} title={pendente ? "Horário passou: marque como concluído ou falta" : undefined}>
      <span className="h">{hora}</span>
      <span className="t">{t}</span>
      {s && <span className="s">{s}</span>}
      {ag.status === "concluido" && <Check size={15} className="ic" />}
      {pendente && <Clock size={14} className="pend" aria-label="Pendente" />}
      {foraGrade && <span className="fora">encaixe</span>}
    </button>
  );
}

/* ---------------------------------------------------------------------
   Tela
   --------------------------------------------------------------------- */
export function Agenda({ db, update, notify, ask, abrir, dataInicial }) {
  const largo = useLargo();
  const agora = useAgora();
  const inicial = dataInicial ? parse(dataInicial) : new Date();
  const [ref, setRef] = useState(inicioMes(inicial));
  const [semIdx, setSemIdx] = useState(() => indiceSemana(inicioMes(inicial), db.config.dias, inicial));
  const [diaSel, setDiaSel] = useState(ymd(inicial));
  const [slot, setSlot] = useState(null);
  const [diaAberto, setDiaAberto] = useState(null);
  const semanas = useMemo(() => semanasDoMes(ref, db.config.dias), [ref, db.config.dias]);
  const idx = Math.max(0, Math.min(semIdx, semanas.length - 1));
  const dias = semanas.length ? diasDaSemana(semanas[idx], db.config.dias) : [];
  const diaAtivo = dias.find((d) => ymd(d) === diaSel) ? diaSel : dias[0] && ymd(dias[0]);
  const grade = horariosDe(db.config);
  const mapa = useMemo(() => mapaAgenda(db), [db]);
  const hoje = hojeYmd();
  const rolou = useRef(false);

  const mudarMes = (delta) => {
    const n = new Date(ref.getFullYear(), ref.getMonth() + delta, 1);
    setRef(n);
    setSemIdx(0);
    const primeiro = semanasDoMes(n, db.config.dias)[0];
    const d0 = primeiro && diasDaSemana(primeiro, db.config.dias).find((d) => d.getMonth() === n.getMonth());
    if (d0) setDiaSel(ymd(d0));
  };
  const irPara = (data) => {
    const d = parse(data);
    const r = inicioMes(d);
    setRef(r);
    setSemIdx(indiceSemana(r, db.config.dias, d));
    setDiaSel(data);
  };
  const passoDia = (delta) => {
    let d = parse(diaAtivo || hoje);
    for (let i = 0; i < 8; i++) { d = addDays(d, delta); if (db.config.dias.includes(d.getDay())) break; }
    irPara(ymd(d));
  };

  // No celular, rola até o próximo horário quando abre o dia de hoje
  useEffect(() => {
    if (largo || rolou.current || diaAtivo !== hoje) return;
    rolou.current = true;
    const t = setTimeout(() => {
      const el = document.querySelector("[data-proximo='1']");
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.7) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 250);
    return () => clearTimeout(t);
  }, [diaAtivo, hoje, largo]);

  const resumo = (lista) => {
    let at = 0, lv = 0, of = 0;
    lista.forEach((d) => {
      const s = ymd(d);
      const fechado = diaFechado(db, s);
      horasDoDia(db, s, grade).forEach((h) => {
        const a = mapa.get(`${s} ${h}`);
        if (!a) { if (!fechado && grade.includes(h) && !pausaEm(db.config, s, h)) lv++; }
        else if (a.tipo === "oferta") { of++; lv++; }
        else if (a.tipo !== "bloqueio") at++;
      });
    });
    return { at, lv, of };
  };
  const rs = resumo(dias);
  const visiveis = largo ? dias : dias.filter((d) => ymd(d) === diaAtivo);
  const qtdPend = pendentes(db, agora).length;

  return (
    <div className="mf-wrap mf-stack" style={{ gap: 14 }}>
      <div className="mf-row mf-between mf-wrapr" style={{ rowGap: 4 }}>
        <div className="mf-row" style={{ gap: 2 }}>
          <button className="mf-iconbtn" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><ChevronLeft /></button>
          <h1 style={{ fontSize: "clamp(20px, 5.6vw, 30px)", whiteSpace: "nowrap" }}>{cap(nomeMes(ref))}</h1>
          <button className="mf-iconbtn" onClick={() => mudarMes(1)} aria-label="Próximo mês"><ChevronRight /></button>
        </div>
        <div className="mf-row">
          <input className="mf-input" type="date" aria-label="Ir para a data" style={{ width: 150, padding: "6px 10px" }}
            value={diaAtivo || ""} onChange={(e) => e.target.value && irPara(e.target.value)} />
          <button className="mf-btn alt sm" onClick={() => irPara(hoje)}>Hoje</button>
        </div>
      </div>

      {qtdPend > 0 && (
        <div className="mf-alerta">
          <Clock size={18} />
          <span className="mf-grow">{plural(qtdPend, "atendimento já passou e está sem fechar", "atendimentos já passaram e estão sem fechar")}.</span>
          <button className="mf-btn sm poste" onClick={abrir.pendencias}>Fechar agora</button>
        </div>
      )}

      <div className="mf-weekbar" role="tablist" aria-label="Semanas do mês">
        {semanas.map((s, i) => {
          const ds = diasDaSemana(s, db.config.dias);
          return (
            <button key={ymd(s)} role="tab" aria-selected={i === idx} className={"mf-week" + (i === idx ? " on" : "")} onClick={() => {
              setSemIdx(i);
              const dentro = ds.find((d) => d.getMonth() === ref.getMonth()) || ds[0];
              if (dentro) setDiaSel(ymd(dentro));
            }}>
              <b>Semana {i + 1}</b>
              <small>{ddmm(ymd(ds[0]))} a {ddmm(ymd(ds[ds.length - 1]))}</small>
            </button>
          );
        })}
      </div>

      <div className="mf-row mf-wrapr mf-between">
        <p className="sub">{rs.at} atendimentos, {rs.lv} horários livres{rs.of ? `, ${rs.of} em oferta` : ""} nesta semana</p>
        <div className="mf-legenda">
          <span><i style={{ borderLeft: "4px solid #1F3A32" }} />Normal</span>
          <span><i style={{ background: "#E0E8F5", borderLeft: "4px solid #2A4E8A" }} />Pacote</span>
          <span><i style={{ background: "#F3E8CD", borderLeft: "4px solid #B8892B" }} />Campanha</span>
          <span><i style={{ background: "repeating-linear-gradient(-45deg,#C8372D 0 3px,#fff 3px 5px,#2A4E8A 5px 8px,#fff 8px 10px)" }} />Vaga em oferta</span>
          <span><i style={{ background: "repeating-linear-gradient(45deg,#DDE1DD 0 3px,#F2F3F2 3px 6px)" }} />Pausa/bloqueio</span>
        </div>
      </div>

      {!largo && (
        <div className="mf-row" style={{ gap: 4 }}>
          <button className="mf-iconbtn" style={{ padding: 4 }} onClick={() => passoDia(-1)} aria-label="Dia anterior"><ChevronLeft size={20} /></button>
          <div className="mf-days mf-grow" style={{ gridTemplateColumns: `repeat(${dias.length || 1}, minmax(0,1fr))` }}>
            {dias.map((d) => {
              const s = ymd(d);
              const fechado = diaFechado(db, s);
              return (
                <button key={s} className={"mf-day" + (s === diaAtivo ? " on" : "") + (d.getMonth() !== ref.getMonth() || fechado ? " fora" : "") + (s === hoje ? " hoje" : "")} onClick={() => setDiaSel(s)}>
                  <small>{DIAS_CURTO[d.getDay()]}</small><b>{d.getDate()}</b>
                </button>
              );
            })}
          </div>
          <button className="mf-iconbtn" style={{ padding: 4 }} onClick={() => passoDia(1)} aria-label="Próximo dia"><ChevronRight size={20} /></button>
        </div>
      )}

      <div className="mf-agenda" style={{ gridTemplateColumns: `repeat(${visiveis.length || 1}, minmax(0,1fr))` }}>
        {visiveis.map((d) => {
          const s = ymd(d);
          const r = resumo([d]);
          const fechado = diaFechado(db, s);
          const horas = horasDoDia(db, s, grade).filter((h) => !fechado || mapa.get(`${s} ${h}`));
          const proxima = s === hoje ? horas.find((h) => momento(s, h) > agora) : null;
          return (
            <div key={s} className="mf-col">
              <div className={"mf-colhead" + (s === hoje ? " hoje" : "") + (d.getMonth() !== ref.getMonth() ? " fora" : "")}>
                <b>{largo ? DIAS_CURTO[d.getDay()] : DIAS_LONGO[d.getDay()]} {ddmm(s)}</b>
                <small>{plural(r.at, "marcado", "marcados")} · <button className="mf-link" style={{ padding: 0, fontSize: 12 }} onClick={() => setDiaAberto(s)}>opções do dia</button></small>
              </div>
              {fechado && <div className="mf-fechado"><CalendarX size={15} style={{ verticalAlign: -3 }} /> Fechado: {fechado.motivo || "sem motivo"}</div>}
              {horas.map((h) => (
                <div key={h} data-proximo={h === proxima ? "1" : undefined}>
                  <Slot db={db} hora={h} ag={mapa.get(`${s} ${h}`)} pausa={pausaEm(db.config, s, h)} passado={momento(s, h) < agora}
                    foraGrade={!grade.includes(h)} onClick={() => setSlot({ data: s, hora: h })} />
                </div>
              ))}
              {fechado && horas.length === 0 && <small className="mf-muted" style={{ textAlign: "center" }}>Nenhum atendimento neste dia.</small>}
            </div>
          );
        })}
      </div>

      {slot && <SlotSheet db={db} update={update} notify={notify} ask={ask} abrir={abrir} {...slot} onClose={() => setSlot(null)} />}
      {diaAberto && (
        <DiaSheet db={db} update={update} notify={notify} ask={ask} data={diaAberto} onClose={() => setDiaAberto(null)}
          onEncaixe={(hora) => { const data = diaAberto; setDiaAberto(null); setSlot({ data, hora }); }} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   Janela de um horário
   --------------------------------------------------------------------- */
export function SlotSheet({ db, update, notify, ask, abrir, data, hora, onClose }) {
  const ag = db.agendamentos.find((a) => a.data === data && a.hora === hora);
  const pausa = !ag && pausaEm(db.config, data, hora);
  const fechado = diaFechado(db, data);
  const [mesmoAssim, setMesmoAssim] = useState(false);
  const titulo = `${dataLonga(data)} às ${hora}`;
  let corpo;
  if (ag) corpo = <DetalheAgendamento db={db} update={update} notify={notify} ask={ask} abrir={abrir} ag={ag} onClose={onClose} />;
  else if ((pausa || fechado) && !mesmoAssim) {
    corpo = (
      <div className="mf-stack">
        <div className="mf-panel mf-row">
          {fechado ? <CalendarX size={22} /> : <Coffee size={22} />}
          <div className="mf-grow">
            <b>{fechado ? `Dia fechado: ${fechado.motivo || "sem motivo"}` : pausa.motivo || "Pausa"}</b>
            <p className="sub">{fechado ? "Reabra o dia em “opções do dia”." : `Pausa fixa de ${pausa.de} a ${pausa.ate}. Para mudar, vá em Ajustes > Pausas.`}</p>
          </div>
        </div>
        <button className="mf-btn alt full" onClick={() => setMesmoAssim(true)}>Atender neste horário mesmo assim</button>
      </div>
    );
  } else corpo = <NovoNoHorario db={db} update={update} notify={notify} data={data} hora={hora} onClose={onClose} />;
  return <Sheet titulo={titulo} onClose={onClose}>{corpo}</Sheet>;
}

/* ---------------------------------------------------------------------
   Novo agendamento / oferta / bloqueio
   --------------------------------------------------------------------- */
function NovoNoHorario({ db, update, notify, data, hora, onClose }) {
  const [modo, setModo] = useState("agendar");
  const [clienteId, setClienteId] = useState(null);
  const [servicoId, setServicoId] = useState(db.servicos[0]?.id);
  const [forma, setForma] = useState("avulso");
  const [pacoteId, setPacoteId] = useState(null);
  const vagas = db.campanhas.filter((c) => c.tipo === "vaga" && campanhaVale(c, data));
  const [campVaga, setCampVaga] = useState(vagas[0]?.id || "");
  const [campServ, setCampServ] = useState("");
  const [motivo, setMotivo] = useState("Compromisso");
  const [valorManual, setValorManual] = useState(null);
  const [repetir, setRepetir] = useState(0);
  const [vezes, setVezes] = useState(2);
  const serv = servicoDe(db, servicoId);
  const passado = momento(data, hora) < new Date();

  const pacotesCli = pacotesUsaveis(db, clienteId, data);
  const campsServ = db.campanhas.filter((c) => c.tipo === "servico" && campanhaVale(c, data) && (!c.servicoIds?.length || c.servicoIds.includes(servicoId)));
  const campS = campsServ.find((c) => c.id === campServ);
  const campV = vagas.find((c) => c.id === campVaga);

  let valor = serv?.preco || 0;
  if (modo === "agendar" && forma === "pacote") valor = 0;
  if (modo === "agendar" && forma === "campanha") valor = campS ? precoCampanha(campS, valor) : valor;
  if (modo === "ofertar") valor = campV ? precoCampanha(campV, valor) : valor;
  if (valorManual !== null && modo !== "bloquear" && forma !== "pacote") valor = r2(valorManual);

  const podeSalvar = modo === "bloquear" || (modo === "ofertar" && campV && serv) ||
    (modo === "agendar" && clienteId && ((forma === "avulso" && serv) || (forma === "pacote" && pacoteId) || (forma === "campanha" && campS && serv)));

  const salvarAg = () => {
    if (db.agendamentos.some((a) => a.data === data && a.hora === hora)) { notify("Este horário acabou de ser ocupado"); onClose(); return; }
    const base = { id: uid(), data, hora, status: "agendado", pagamento: "", obs: "", criadoEm: new Date().toISOString() };
    let novo;
    if (modo === "bloquear") novo = { ...base, tipo: "bloqueio", valor: 0, obs: motivo || "Bloqueado" };
    else if (modo === "ofertar") novo = { ...base, tipo: "oferta", campanhaId: campVaga, servicoId, valor };
    else if (forma === "pacote") {
      const p = pacoteDe(db, pacoteId);
      novo = { ...base, tipo: "pacote", clienteId, pacoteId, servicoId: p.servicoId, valor: 0 };
    } else if (forma === "campanha") novo = { ...base, tipo: "campanha", clienteId, campanhaId: campServ, servicoId, valor };
    else novo = { ...base, tipo: "avulso", clienteId, servicoId, valor };

    // Repetição (clientes que vêm a cada 15/30 dias)
    const extras = [];
    let pulados = 0;
    if (modo === "agendar" && forma !== "pacote" && repetir > 0) {
      for (let i = 1; i <= vezes; i++) {
        const d2 = ymd(addDays(parse(data), repetir * i));
        const livre = atendeNoDia(db, d2) && !diaFechado(db, d2) && !pausaEm(db.config, d2, hora) && !db.agendamentos.some((a) => a.data === d2 && a.hora === hora);
        const campOk = forma !== "campanha" || campanhaVale(campS, d2);
        if (livre && campOk) extras.push({ ...novo, id: uid(), data: d2 });
        else pulados++;
      }
    }
    update((dd) => { dd.agendamentos.push(novo, ...extras); return dd; });
    let msg = modo === "bloquear" ? "Horário bloqueado" : modo === "ofertar" ? "Vaga ofertada" : "Horário agendado";
    if (extras.length) msg += ` + ${extras.length} repetição(ões)`;
    if (pulados) msg += `, ${pulados} data(s) ocupada(s) puladas`;
    notify(msg);
    onClose();
  };

  return (
    <div className="mf-stack">
      <Seg valor={modo} onChange={(m) => { setModo(m); setValorManual(null); }} opcoes={[["agendar", "Agendar"], ["ofertar", "Ofertar vaga"], ["bloquear", "Bloquear"]]} />
      {passado && modo !== "bloquear" && <small className="mf-muted">Este horário já passou. Útil para registrar um atendimento que não foi anotado.</small>}
      {modo === "agendar" && (<>
        <Campo label="Cliente"><ClientePicker db={db} update={update} valor={clienteId} onChange={(id) => { setClienteId(id); setPacoteId(null); }} /></Campo>
        <Campo label="Como vai pagar">
          <Seg valor={forma} onChange={(f) => { setForma(f); setValorManual(null); }} opcoes={[["avulso", "Preço normal"], ["pacote", `Pacote${pacotesCli.length ? ` (${pacotesCli.length})` : ""}`], ["campanha", "Campanha"]]} />
        </Campo>
        {forma !== "pacote" && (
          <Campo label="Serviço">
            <select className="mf-input" value={servicoId} onChange={(e) => { setServicoId(e.target.value); setValorManual(null); }}>
              {db.servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} ({brl(s.preco)})</option>)}
            </select>
          </Campo>
        )}
        {forma === "pacote" && (
          <Campo label="Pacote do cliente">
            {!clienteId ? <small>Escolha o cliente primeiro.</small> : pacotesCli.length === 0 ? <small>Este cliente não tem pacote com saldo válido para esta data.</small> : (
              <div className="mf-opts">
                {pacotesCli.map(({ p, i, plano }) => (
                  <button type="button" key={p.id} className={"mf-opt" + (pacoteId === p.id ? " on" : "")} onClick={() => setPacoteId(p.id)}>
                    <span>
                      <span className="mf-code" style={{ fontSize: 17 }}>{p.codigo}</span> {p.planoNome}<br />
                      <small>{i.saldo} disponível(is), vence {ddmm(i.vence)}</small>
                      {(p.somenteVagas ?? plano?.somenteVagas) && <><br /><Tag tom="alerta">Só em horário Flex</Tag></>}
                    </span>
                    {pacoteId === p.id && <Check size={18} />}
                  </button>
                ))}
              </div>
            )}
          </Campo>
        )}
        {forma === "campanha" && (
          <Campo label="Campanha">
            {campsServ.length === 0 ? <small>Nenhuma campanha ativa para este serviço. Crie uma em Planos.</small> : (
              <select className="mf-input" value={campServ} onChange={(e) => setCampServ(e.target.value)}>
                <option value="">Escolha…</option>
                {campsServ.map((c) => <option key={c.id} value={c.id}>{c.nome} ({rotuloDesconto(c)})</option>)}
              </select>
            )}
          </Campo>
        )}
        {forma !== "pacote" && (
          <Campo label="Repetir este horário" dica={repetir ? "Datas ocupadas, fechadas ou fora do atendimento são puladas." : undefined}>
            <div className="mf-row mf-wrapr">
              <Seg valor={repetir} onChange={setRepetir} opcoes={[[0, "Não"], [7, "7 dias"], [15, "15 dias"], [30, "30 dias"]]} />
              {repetir > 0 && (
                <label className="mf-row" style={{ fontWeight: 400, fontSize: 14 }}>
                  <Repeat size={15} />mais
                  <NumInput style={{ width: 64 }} value={vezes} onChange={setVezes} min={1} max={8} inteiro aria-label="Quantas repetições" />vezes
                </label>
              )}
            </div>
          </Campo>
        )}
      </>)}
      {modo === "ofertar" && (<>
        <p className="sub">A vaga aparece listrada na agenda e na tela Vagas, pronta para divulgar. Quando alguém comprar, é só abrir o horário e vender.</p>
        <Campo label="Campanha de vaga">
          {vagas.length === 0 ? <small>Nenhuma campanha de horário vago ativa. Crie uma em Planos.</small> : (
            <select className="mf-input" value={campVaga} onChange={(e) => setCampVaga(e.target.value)}>
              {vagas.map((c) => <option key={c.id} value={c.id}>{c.nome} ({rotuloDesconto(c)})</option>)}
            </select>
          )}
        </Campo>
        <Campo label="Serviço">
          <select className="mf-input" value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
            {db.servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Campo>
      </>)}
      {modo === "bloquear" && (
        <Campo label="Motivo" dica="Para almoço ou horários que se repetem toda semana, use Ajustes > Pausas.">
          <input className="mf-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Compromisso, médico, folga…" />
        </Campo>
      )}
      {modo !== "bloquear" && (
        <div className="mf-panel" style={{ padding: 12 }}>
          <div className="mf-row mf-between">
            <span className="sub">Valor</span>
            <span className="mf-row">
              {valor !== (serv?.preco || 0) && forma !== "pacote" && <span className="mf-strike">{brl(serv?.preco)}</span>}
              <span className="mf-price" style={{ fontSize: 28 }}>{modo === "agendar" && forma === "pacote" ? "Já pago" : brl(valor)}</span>
            </span>
          </div>
          {!(modo === "agendar" && forma === "pacote") && (
            valorManual === null
              ? <button type="button" className="mf-link" style={{ fontSize: 13 }} onClick={() => setValorManual(valor)}>Ajustar valor</button>
              : <div className="mf-row" style={{ marginTop: 8 }}><span className="sub">R$</span><NumInput value={valorManual} onChange={setValorManual} min={0} style={{ maxWidth: 120 }} aria-label="Valor" /><button type="button" className="mf-link" onClick={() => setValorManual(null)}>Voltar ao preço</button></div>
          )}
        </div>
      )}
      <button className={"mf-btn full" + (modo === "ofertar" ? " poste" : "")} disabled={!podeSalvar} onClick={salvarAg}>
        {modo === "bloquear" ? "Bloquear horário" : modo === "ofertar" ? "Ofertar vaga" : "Agendar horário"}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Detalhe de um horário ocupado
   --------------------------------------------------------------------- */
const TXT_STATUS = { agendado: "Agendado", concluido: "Concluído", faltou: "Faltou" };

function DetalheAgendamento({ db, update, notify, ask, abrir, ag, onClose }) {
  const [clienteId, setClienteId] = useState(null);
  const [comoPagou, setComoPagou] = useState("oferta");
  const [pacoteId, setPacoteId] = useState(null);
  const [remarcar, setRemarcar] = useState(false);
  const cfg = db.config;
  const cli = ag.clienteId && clienteDe(db, ag.clienteId);
  const serv = servicoDe(db, ag.servicoId);
  const camp = ag.campanhaId && campanhaDe(db, ag.campanhaId);
  const pac = ag.pacoteId && pacoteDe(db, ag.pacoteId);
  const mudar = (patch) => update((d) => { const a = d.agendamentos.find((x) => x.id === ag.id); if (a) Object.assign(a, patch); return d; });
  const remover = (msg) => { update((d) => { d.agendamentos = d.agendamentos.filter((x) => x.id !== ag.id); return d; }, true); notify(msg, true); onClose(); };

  if (remarcar) return <Remarcar db={db} update={update} notify={notify} ag={ag} onVoltar={() => setRemarcar(false)} onClose={onClose} />;

  if (ag.tipo === "bloqueio") {
    return (
      <div className="mf-stack">
        <p>Horário bloqueado: <b>{ag.obs || "sem motivo"}</b></p>
        <button className="mf-btn full" onClick={() => remover("Horário liberado")}>Liberar horário</button>
      </div>
    );
  }

  if (ag.tipo === "oferta") {
    const passou = momento(ag.data, ag.hora) < new Date();
    const pacs = pacotesUsaveis(db, clienteId, ag.data);
    const ok = clienteId && (comoPagou === "oferta" || pacoteId);
    return (
      <div className="mf-stack">
        <div className="mf-panel mf-row mf-between">
          <div><b>{camp?.nome || "Vaga em oferta"}</b><p className="sub">{serv?.nome}{passou ? ", horário já passou sem venda" : ""}</p></div>
          <span className="mf-row">
            {serv && serv.preco !== ag.valor && <span className="mf-strike">{brl(serv.preco)}</span>}
            <span className="mf-price" style={{ fontSize: 28, color: "#C8372D" }}>{brl(ag.valor)}</span>
          </span>
        </div>
        <Campo label="Quem comprou a vaga?"><ClientePicker db={db} update={update} valor={clienteId} onChange={(id) => { setClienteId(id); setPacoteId(null); setComoPagou("oferta"); }} /></Campo>
        {clienteId && pacs.length > 0 && (
          <Campo label="Como pagou">
            <Seg valor={comoPagou} onChange={setComoPagou} opcoes={[["oferta", `Preço da vaga (${brl(ag.valor)})`], ["pacote", "Pacote Flex"]]} />
          </Campo>
        )}
        {comoPagou === "pacote" && (
          <div className="mf-opts">
            {pacs.map(({ p, i }) => (
              <button type="button" key={p.id} className={"mf-opt" + (pacoteId === p.id ? " on" : "")} onClick={() => setPacoteId(p.id)}>
                <span><span className="mf-code" style={{ fontSize: 17 }}>{p.codigo}</span> {p.planoNome}<br /><small>{i.saldo} disponível(is), vence {ddmm(i.vence)}</small></span>
                {pacoteId === p.id && <Check size={18} />}
              </button>
            ))}
          </div>
        )}
        <button className="mf-btn poste full" disabled={!ok} onClick={() => {
          if (comoPagou === "pacote") {
            const p = pacoteDe(db, pacoteId);
            mudar({ tipo: "pacote", clienteId, pacoteId, servicoId: p.servicoId, valorOferta: ag.valor, valor: 0, deOferta: true });
          } else mudar({ tipo: "campanha", clienteId, deOferta: true, valorOferta: ag.valor });
          notify("Vaga vendida");
          onClose();
        }}>Vender vaga</button>
        <button className="mf-link perigo" onClick={() => remover("Oferta retirada")}>Retirar oferta e liberar horário</button>
      </div>
    );
  }

  const tipoLabel = ag.tipo === "pacote" ? `Pacote ${pac?.codigo || ""}${ag.deOferta ? " (horário Flex)" : ""}` : ag.tipo === "campanha" ? `Campanha ${camp?.nome || ""}` : "Preço normal";
  const editavel = ag.tipo !== "pacote";
  const passou = momento(ag.data, ag.hora) < new Date();
  const infoPac = pac && db.pacotes.length ? pac : null;
  return (
    <div className="mf-stack">
      <div className="mf-panel">
        <div className="mf-row">
          <div className="mf-avatar">{iniciais(cli?.nome)}</div>
          <button className="mf-grow" style={{ background: "none", border: 0, textAlign: "left", padding: 0 }} onClick={() => cli && abrir.cliente(cli.id)}>
            <b>{cli?.nome || "Cliente removido"}</b>
            <p className="sub">{cli?.telefone || "Sem telefone"}{cli ? " · ver ficha" : ""}</p>
          </button>
          {cli?.telefone && (
            <a className="mf-iconbtn" href={whats(cli.telefone, `Olá, ${primeiroNome(cli.nome)}! Passando para confirmar seu horário na ${cfg.nome}: ${dataLonga(ag.data).toLowerCase()} às ${ag.hora}. Posso contar com você?`, cfg.ddd)}
              target="_blank" rel="noreferrer" aria-label="Confirmar pelo WhatsApp"><MessageCircle /></a>
          )}
        </div>
        <div className="mf-sep" />
        <div className="mf-ledger">
          <div>
            <span>Serviço</span>
            {editavel ? (
              <select className="mf-input" style={{ maxWidth: 210, padding: "6px 10px" }} value={ag.servicoId} onChange={(e) => {
                const s = servicoDe(db, e.target.value);
                mudar({ servicoId: e.target.value, valor: ag.tipo === "campanha" ? precoCampanha(camp, s?.preco || 0) : s?.preco || 0 });
              }}>
                {db.servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            ) : <span>{serv?.nome}</span>}
          </div>
          <div><span>Forma</span><span>{tipoLabel}</span></div>
          <div>
            <span>Valor</span>
            {editavel ? <span className="mf-row" style={{ gap: 6 }}><small>R$</small><NumInput style={{ maxWidth: 110, padding: "6px 10px" }} value={ag.valor} min={0} onChange={(v) => mudar({ valor: r2(v) })} aria-label="Valor" /></span> : <b>Já pago</b>}
          </div>
        </div>
        {infoPac && <BarraSaldo qtd={pac.qtd} usados={db.agendamentos.filter((a) => a.pacoteId === pac.id && a.tipo === "pacote" && a.status !== "agendado").length} reservados={db.agendamentos.filter((a) => a.pacoteId === pac.id && a.tipo === "pacote" && a.status === "agendado").length} />}
      </div>
      <Campo label="Situação">
        <Seg valor={ag.status} onChange={(s) => mudar({ status: s, pagamento: s === "concluido" && editavel && !ag.pagamento ? cfg.pagamentoPadrao || "" : ag.pagamento })}
          opcoes={[["agendado", "Agendado"], ["concluido", "Concluído"], ["faltou", "Faltou"]]} />
      </Campo>
      {passou && ag.status === "agendado" && <small style={{ color: "#7A5710" }}>O horário já passou. Marque se foi concluído ou se o cliente faltou.</small>}
      {editavel && ag.status === "concluido" && (
        <Campo label="Pagamento">
          <div className="mf-quick">
            {PAGAMENTOS.map((p) => <button type="button" key={p} className={ag.pagamento === p ? "on" : ""} onClick={() => mudar({ pagamento: p })}>{p}</button>)}
          </div>
        </Campo>
      )}
      {ag.tipo === "pacote" && ag.status === "faltou" && <small>Falta em horário de pacote conta como corte usado.</small>}
      <Campo label="Observação"><TextoBlur className="mf-input" value={ag.obs} onCommit={(v) => mudar({ obs: v })} placeholder="Ex.: pediu para aparar a sobrancelha" /></Campo>
      <div className="mf-row">
        <button className="mf-btn alt" onClick={() => setRemarcar(true)}><CalendarClock size={16} />Remarcar</button>
        <button className="mf-btn mf-grow" onClick={onClose}>Pronto</button>
      </div>
      <button className="mf-link perigo" onClick={() => {
        if (ag.deOferta) {
          mudar({ tipo: "oferta", clienteId: null, pacoteId: null, status: "agendado", deOferta: false, pagamento: "", valor: ag.valorOferta ?? ag.valor, servicoId: ag.servicoId });
          notify("Venda desfeita, vaga voltou para oferta");
          onClose();
        } else ask(`Cancelar o horário de ${cli?.nome || "cliente"} (${ddmm(ag.data)} às ${ag.hora})?`, () => remover("Agendamento cancelado"));
      }}>{ag.deOferta ? "Desfazer venda da vaga" : "Cancelar agendamento"}</button>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Remarcar
   --------------------------------------------------------------------- */
function Remarcar({ db, update, notify, ag, onVoltar, onClose }) {
  const [data, setData] = useState(ag.data < hojeYmd() ? hojeYmd() : ag.data);
  const [outra, setOutra] = useState("");
  const livres = data ? horasLivresNoDia(db, data, ag.id) : [];
  const fechado = data && diaFechado(db, data);
  const atende = data && atendeNoDia(db, data);
  const pac = ag.pacoteId && pacoteDe(db, ag.pacoteId);
  const venc = pac && pacotesUsaveis(db, pac.clienteId, data).find((x) => x.p.id === pac.id);
  const ocupadoOutra = horaValida(outra) && db.agendamentos.some((a) => a.id !== ag.id && a.data === data && a.hora === outra);
  const mover = (hora) => {
    update((d) => { const a = d.agendamentos.find((x) => x.id === ag.id); if (a) Object.assign(a, { data, hora, status: "agendado", pagamento: "" }); return d; }, true);
    notify(`Remarcado para ${ddmm(data)} às ${hora}`, true);
    onClose();
  };
  return (
    <div className="mf-stack">
      <p className="sub">Horário atual: {dataLonga(ag.data)} às {ag.hora}</p>
      <Campo label="Nova data"><input className="mf-input" type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
      {data && !atende && <small style={{ color: "#7A5710" }}>A barbearia normalmente não atende neste dia da semana.</small>}
      {fechado && <small style={{ color: "#C8372D" }}>Dia marcado como fechado: {fechado.motivo}.</small>}
      {pac && data && !venc && <small style={{ color: "#C8372D" }}>Atenção: o pacote {pac.codigo} não vale nesta data (vencido ou sem saldo).</small>}
      <Campo label="Horários livres">
        {livres.length === 0 ? <small>Nenhum horário livre da grade nesta data.</small> : (
          <div className="mf-quick">{livres.map((h) => <button type="button" key={h} onClick={() => mover(h)}>{h}</button>)}</div>
        )}
      </Campo>
      <Campo label="Outro horário (encaixe)">
        <div className="mf-row">
          <input className="mf-input" type="time" value={outra} onChange={(e) => setOutra(e.target.value)} style={{ maxWidth: 140 }} />
          <button className="mf-btn sm" disabled={!horaValida(outra) || ocupadoOutra || !data} onClick={() => mover(outra)}>Mover</button>
        </div>
      </Campo>
      {ocupadoOutra && <small style={{ color: "#C8372D" }}>Já existe algo marcado às {outra}.</small>}
      <button className="mf-btn alt full" onClick={onVoltar}>Voltar</button>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Opções do dia: lembretes, encaixe, fechar/reabrir
   --------------------------------------------------------------------- */
function DiaSheet({ db, update, notify, ask, data, onClose, onEncaixe }) {
  const cfg = db.config;
  const fechado = diaFechado(db, data);
  const [hora, setHora] = useState("");
  const [motivo, setMotivo] = useState("Feriado");
  const ags = db.agendamentos.filter((a) => a.data === data && TIPOS_ATENDIMENTO.includes(a.tipo)).sort((a, b) => a.hora.localeCompare(b.hora));
  const ofertas = db.agendamentos.filter((a) => a.data === data && a.tipo === "oferta");
  const ocupada = horaValida(hora) && db.agendamentos.some((a) => a.data === data && a.hora === hora);
  const futuro = data >= hojeYmd();

  const fechar = () => {
    const faz = () => {
      update((d) => {
        d.fechados = (d.fechados || []).filter((f) => f.data !== data).concat({ data, motivo: motivo.trim() });
        d.agendamentos = d.agendamentos.filter((a) => !(a.data === data && a.tipo === "oferta"));
        return d;
      }, true);
      notify("Dia fechado", true);
      onClose();
    };
    if (ags.filter((a) => a.status === "agendado").length) ask(`Este dia tem ${plural(ags.filter((a) => a.status === "agendado").length, "cliente marcado", "clientes marcados")}. Eles continuam na agenda para você remarcar. Fechar mesmo assim?`, faz);
    else faz();
  };

  return (
    <Sheet titulo={dataLonga(data)} sub={fechado ? `Fechado: ${fechado.motivo || "sem motivo"}` : `${plural(ags.length, "atendimento", "atendimentos")}`} onClose={onClose}>
      <div className="mf-stack">
        {ags.length > 0 && (
          <section className="mf-panel" style={{ padding: "4px 12px" }}>
            <div className="mf-mini">
              {ags.map((a) => {
                const c = clienteDe(db, a.clienteId);
                const msg = `Olá, ${primeiroNome(c?.nome)}! Lembrete do seu horário na ${cfg.nome}: ${dataLonga(data).toLowerCase()} às ${a.hora}. Te espero!`;
                return (
                  <div key={a.id}>
                    <span className="mf-hora">{a.hora}</span>
                    <span className="mf-grow mf-ellip"><b>{c?.nome || "Cliente"}</b><br /><small>{servicoDe(db, a.servicoId)?.nome}</small></span>
                    <Tag tom={a.status === "concluido" ? "ok" : a.status === "faltou" ? "erro" : "neutro"}>{TXT_STATUS[a.status]}</Tag>
                    {a.status === "agendado" && futuro && c?.telefone && <a className="mf-btn sm alt" href={whats(c.telefone, msg, cfg.ddd)} target="_blank" rel="noreferrer"><MessageCircle size={14} />Lembrar</a>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {!fechado && (
          <section className="mf-panel mf-stack" style={{ gap: 8 }}>
            <h3><Plus size={17} style={{ verticalAlign: -3 }} /> Encaixe</h3>
            <p className="sub">Marque um atendimento fora dos horários da grade.</p>
            <div className="mf-row">
              <input className="mf-input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ maxWidth: 140 }} aria-label="Horário do encaixe" />
              <button className="mf-btn sm" disabled={!horaValida(hora) || ocupada} onClick={() => onEncaixe(hora)}>Continuar</button>
            </div>
            {ocupada && <small style={{ color: "#C8372D" }}>Já existe algo às {hora}. Abra o horário na agenda.</small>}
          </section>
        )}

        <section className="mf-panel mf-stack" style={{ gap: 8 }}>
          {fechado ? (<>
            <h3>Dia fechado</h3>
            <p className="sub">Motivo: {fechado.motivo || "sem motivo"}</p>
            <button className="mf-btn alt" onClick={() => {
              update((d) => { d.fechados = d.fechados.filter((f) => f.data !== data); return d; }, true);
              notify("Dia reaberto", true);
              onClose();
            }}>Reabrir dia</button>
          </>) : (<>
            <h3><CalendarX size={17} style={{ verticalAlign: -3 }} /> Fechar o dia</h3>
            <p className="sub">Feriado, folga ou curso. Os horários somem das vagas livres{ofertas.length ? ` e ${plural(ofertas.length, "oferta é retirada", "ofertas são retiradas")}` : ""}.</p>
            <div className="mf-row">
              <input className="mf-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo" />
              <button className="mf-btn sm poste" onClick={fechar}>Fechar dia</button>
            </div>
            {ags.some((a) => a.status === "agendado") && <small style={{ color: "#7A5710" }}><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> Há clientes marcados neste dia.</small>}
          </>)}
        </section>
      </div>
    </Sheet>
  );
}

/* ---------------------------------------------------------------------
   Pendências: atendimentos que já passaram e não foram fechados
   --------------------------------------------------------------------- */
export function PendenciasSheet({ db, update, notify, ask, onClose }) {
  const cfg = db.config;
  const lista = pendentes(db);
  const [pags, setPags] = useState({});
  const pagDe = (a) => pags[a.id] ?? cfg.pagamentoPadrao ?? "Pix";
  const fecharUm = (a, status) => {
    update((d) => {
      const x = d.agendamentos.find((y) => y.id === a.id);
      if (x) Object.assign(x, { status, pagamento: status === "concluido" && x.tipo !== "pacote" ? pagDe(a) : x.pagamento });
      return d;
    });
  };
  const porDia = lista.reduce((m, a) => { (m[a.data] = m[a.data] || []).push(a); return m; }, {});
  return (
    <Sheet titulo="Fechar atendimentos" sub={lista.length ? `${plural(lista.length, "horário passou", "horários passaram")} sem ser marcado` : "Tudo em dia"} onClose={onClose}>
      {lista.length === 0 ? (
        <div className="mf-empty"><Check size={30} /><h3>Nenhuma pendência</h3><p>Todos os atendimentos passados já foram fechados.</p></div>
      ) : (
        <div className="mf-stack">
          {Object.entries(porDia).map(([data, ags]) => (
            <section key={data} className="mf-panel" style={{ padding: "8px 12px" }}>
              <b>{dataLonga(data)}</b>
              {ags.sort((a, b) => a.hora.localeCompare(b.hora)).map((a) => {
                const c = clienteDe(db, a.clienteId);
                return (
                  <div key={a.id} className="mf-pend">
                    <span className="mf-hora">{a.hora}</span>
                    <span className="quem"><b className="mf-ellip" style={{ display: "block" }}>{c?.nome || "Cliente"}</b><small>{servicoDe(db, a.servicoId)?.nome} · {a.tipo === "pacote" ? "pacote" : brl(a.valor)}</small></span>
                    {a.tipo !== "pacote" && (
                      <select className="mf-input" style={{ width: "auto", padding: "6px 8px", fontSize: 14 }} value={pagDe(a)} onChange={(e) => setPags({ ...pags, [a.id]: e.target.value })} aria-label="Forma de pagamento">
                        {PAGAMENTOS.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    )}
                    <button className="mf-btn sm" onClick={() => fecharUm(a, "concluido")}><Check size={14} />Feito</button>
                    <button className="mf-btn sm alt" onClick={() => fecharUm(a, "faltou")}>Faltou</button>
                  </div>
                );
              })}
            </section>
          ))}
          <button className="mf-btn alt full" onClick={() => ask(`Marcar os ${lista.length} atendimentos como concluídos? Os que não são de pacote ficam com o pagamento escolhido em cada linha.`, () => {
            update((d) => {
              const ids = new Set(lista.map((a) => a.id));
              d.agendamentos.forEach((x) => {
                if (ids.has(x.id)) { x.status = "concluido"; if (x.tipo !== "pacote") x.pagamento = pagDe(x); }
              });
              return d;
            }, true);
            notify("Atendimentos fechados", true);
          })}>Marcar todos como concluídos</button>
        </div>
      )}
    </Sheet>
  );
}
