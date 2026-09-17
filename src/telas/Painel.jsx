/* =====================================================================
   Painel: hoje, amanhã, faturamento, vendas por serviço, Comum × Flex e formas de pagamento
   ===================================================================== */
import React, { useMemo, useState } from "react";
import {
  Clock, Download, FileSpreadsheet, MessageCircle, ShieldCheck, Wallet,
} from "lucide-react";
import {
  addDays, brl, dataLonga, ddmm, ddmmaa, entregarArquivo, gerarCsv, hojeYmd,
  momento, nomeMes, parse, plural, primeiroNome, whats, ymd, diffDias,
} from "../util.js";
import {
  atendeNoDia, clienteDe, comumFlex, diaFechado, fatiasRosca, infoPacote, intervaloPeriodo,
  pendentes, PERIODOS, recebidoNoDia, resumoPeriodo, servicoDe, TIPOS_ATENDIMENTO, vendasPorServico,
} from "../regras.js";
import { useAgora, Seg } from "../componentes.jsx";
import { Rosca } from "./Rosca.jsx";

const TITULO_FATURAMENTO = { hoje: "Faturamento de hoje", semana: "Faturamento da semana", mes: "Faturamento do mês até agora", mesAnterior: "Faturamento do mês" };
const corComumFlex = (id) => (id === "flex" ? "var(--serie-flex)" : "var(--serie-comum)");
const atendimentos = (fatia) => `${fatia.qtd} atend.`;

export function Painel({ db, notify, abrir, fazerBackup }) {
  const agora = useAgora();
  const [periodo, setPeriodo] = useState("hoje");
  const cfg = db.config;
  const hoje = hojeYmd();
  const P = useMemo(() => intervaloPeriodo(periodo, parse(hoje)), [periodo, hoje]);
  const f = useMemo(() => resumoPeriodo(db, P.inicio, P.fim), [db, P]);
  const mensal = periodo === "mes" || periodo === "mesAnterior";
  const ehAtual = periodo === "mes";
  const ref = parse(P.inicio);
  const key = P.inicio.slice(0, 7);
  const ultimo = P.fim;
  const vendas = useMemo(() => vendasPorServico(db, P.inicio, P.fim), [db, P]);
  const cf = useMemo(() => comumFlex(db, P.inicio, P.fim), [db, P]);
  const itensCF = [{ id: "comum", nome: "Comum", ...cf.comum }, { id: "flex", nome: "Flex", ...cf.flex }];
  // cor fixa por serviço (ordem do cadastro), igual em qualquer período
  const corServico = (id) => { const i = db.servicos.findIndex((s) => s.id === id); return i >= 0 && i < 8 ? `var(--serie-${i + 1})` : "var(--serie-outros)"; };

  const ags = db.agendamentos.filter((a) => a.data >= P.inicio && a.data <= P.fim);
  const meta = Number(cfg.meta) || 0;
  const pct = meta ? Math.min(1, f.total / meta) : 0;
  let diasRestantes = 0;
  if (ehAtual) for (let d = parse(hoje); ymd(d) <= ultimo; d = addDays(d, 1)) if (atendeNoDia(db, ymd(d)) && !diaFechado(db, ymd(d))) diasRestantes++;
  const falta = Math.max(0, meta - f.total - f.previsto);

  // Hoje e próximo dia de atendimento
  const pend = pendentes(db, agora);
  const agsDia = (data) => db.agendamentos.filter((a) => a.data === data && TIPOS_ATENDIMENTO.includes(a.tipo)).sort((a, b) => a.hora.localeCompare(b.hora));
  const deHoje = agsDia(hoje);
  const proximo = deHoje.find((a) => a.status === "agendado" && momento(a.data, a.hora) > agora);
  const recebidoHoje = recebidoNoDia(db, hoje);
  let amanha = null;
  for (let i = 1; i <= 7; i++) { const d = ymd(addDays(new Date(), i)); if (atendeNoDia(db, d) && !diaFechado(db, d)) { amanha = d; break; } }
  const deAmanha = amanha ? agsDia(amanha).filter((a) => a.status === "agendado") : [];

  const backupDias = cfg.ultimoBackup ? diffDias(hoje, cfg.ultimoBackup.slice(0, 10)) : null;
  const pedirBackup = !db.demo && db.clientes.length >= 3 && (backupDias === null || backupDias >= 7);

  const exportarCsv = async () => {
    const linhas = [["Data", "Hora", "Cliente", "Telefone", "Serviço", "Tipo", "Situação", "Pagamento", "Valor (R$)", "Observação"]];
    ags.filter((a) => a.tipo !== "bloqueio").sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)).forEach((a) => {
      const c = clienteDe(db, a.clienteId);
      const tipo = { avulso: "Preço normal", pacote: "Pacote", campanha: "Campanha", oferta: "Vaga em oferta" }[a.tipo] || a.tipo;
      const sit = a.tipo === "oferta" ? (momento(a.data, a.hora) < agora ? "Não vendida" : "Em oferta") : { agendado: "Agendado", concluido: "Concluído", faltou: "Faltou" }[a.status];
      linhas.push([ddmmaa(a.data), a.hora, c?.nome || "", c?.telefone || "", servicoDe(db, a.servicoId)?.nome || "", tipo, sit, a.pagamento || "", a.tipo === "pacote" ? 0 : Number(a.valor) || 0, a.obs || ""]);
    });
    linhas.push([]);
    linhas.push(["Pacotes vendidos no mês"]);
    linhas.push(["Data", "Código", "Cliente", "Plano", "Pagamento", "Valor (R$)", "Situação"]);
    db.pacotes.filter((p) => p.dataCompra.startsWith(key)).forEach((p) => {
      linhas.push([ddmmaa(p.dataCompra), p.codigo, clienteDe(db, p.clienteId)?.nome || "", p.planoNome, p.pagamento || "", Number(p.valorPago) || 0, infoPacote(db, p).status]);
    });
    linhas.push([]);
    linhas.push(["Resumo"]);
    linhas.push(["Faturamento total", f.total]);
    linhas.push(["Pacotes", f.pacotes]); linhas.push(["Serviços", f.servicos]); linhas.push(["Campanhas", f.campanhas]);
    Object.entries(f.porPagamento).filter(([, v]) => v > 0).forEach(([k, v]) => linhas.push([k, v]));
    const r = await entregarArquivo(`matts-flex-${key}.csv`, gerarCsv(linhas), `Relatório ${nomeMes(ref)}`);
    if (r === "baixado") notify("Relatório baixado");
    if (r === "erro") notify("Não foi possível gerar o arquivo");
  };

  const totalPag = Object.values(f.porPagamento).reduce((t, v) => t + v, 0);

  return (
    <div className="mf-wrap mf-stack" style={{ gap: 16 }}>
      {pend.length > 0 && (
        <div className="mf-alerta">
          <Clock size={18} />
          <span className="mf-grow"><b>{plural(pend.length, "atendimento sem fechar", "atendimentos sem fechar")}.</b> Marque se foram feitos para o faturamento ficar certo.</span>
          <button className="mf-btn sm poste" onClick={abrir.pendencias}>Fechar agora</button>
        </div>
      )}
      {pedirBackup && (
        <div className="mf-banner info" style={{ marginBottom: 0 }}>
          <ShieldCheck size={18} />
          <span className="mf-grow">{backupDias === null ? "Você ainda não fez nenhum backup." : `Último backup há ${backupDias} dias.`} Os dados ficam só neste aparelho: guarde uma cópia no WhatsApp ou Drive.</span>
          <button className="mf-btn sm" onClick={fazerBackup}><Download size={15} />Fazer backup</button>
        </div>
      )}

      <div className="mf-grid mf-g2">
          <section className="mf-panel mf-stack" style={{ gap: 10 }}>
            <div className="mf-row mf-between">
              <h3>Hoje, {ddmm(hoje)}</h3>
              <button className="mf-link" onClick={() => abrir.agenda(hoje)}>Abrir agenda</button>
            </div>
            {diaFechado(db, hoje) ? <p className="sub">Dia fechado: {diaFechado(db, hoje).motivo}</p> : !atendeNoDia(db, hoje) ? <p className="sub">Hoje não é dia de atendimento.</p> : null}
            {proximo ? (
              <button className="mf-next" style={{ textAlign: "left", width: "100%" }} onClick={() => abrir.horario(proximo.data, proximo.hora)}>
                <span className="mf-hora">{proximo.hora}</span>
                <span className="mf-grow"><small>Próximo cliente</small><br /><b>{clienteDe(db, proximo.clienteId)?.nome || "Cliente"}</b> · {servicoDe(db, proximo.servicoId)?.nome}</span>
              </button>
            ) : deHoje.length > 0 && <p className="sub">Sem mais clientes marcados para hoje.</p>}
            <div className="mf-kpis">
              <div className="mf-kpi"><small>Marcados</small><b>{deHoje.length}</b></div>
              <div className="mf-kpi"><small>Concluídos</small><b>{deHoje.filter((a) => a.status === "concluido").length}</b></div>
              <div className="mf-kpi"><small>Recebido</small><b>{brl(recebidoHoje.total)}</b></div>
            </div>
            {recebidoHoje.total > 0 && <small>{Object.entries(recebidoHoje.porPagamento).map(([k, v]) => `${k} ${brl(v)}`).join(" · ")}</small>}
          </section>

          <section className="mf-panel mf-stack" style={{ gap: 8 }}>
            <div className="mf-row mf-between">
              <h3>{amanha ? `Lembrar: ${dataLonga(amanha).toLowerCase()}` : "Próximos dias"}</h3>
              {amanha && <button className="mf-link" onClick={() => abrir.agenda(amanha)}>Ver dia</button>}
            </div>
            {deAmanha.length === 0 ? <p className="sub">{amanha ? "Ninguém marcado ainda." : "Nenhum dia de atendimento nos próximos 7 dias."}</p> : (
              <div className="mf-mini">
                {deAmanha.slice(0, 6).map((a) => {
                  const c = clienteDe(db, a.clienteId);
                  const msg = `Olá, ${primeiroNome(c?.nome)}! Lembrete do seu horário na ${cfg.nome}: ${dataLonga(a.data).toLowerCase()} às ${a.hora}. Posso confirmar?`;
                  return (
                    <div key={a.id}>
                      <span className="mf-hora" style={{ fontSize: 18 }}>{a.hora}</span>
                      <span className="mf-grow mf-ellip">{c?.nome || "Cliente"}</span>
                      {c?.telefone && <a className="mf-btn sm alt" href={whats(c.telefone, msg, cfg.ddd)} target="_blank" rel="noreferrer"><MessageCircle size={14} />Lembrar</a>}
                    </div>
                  );
                })}
                {deAmanha.length > 6 && <small>e mais {deAmanha.length - 6}…</small>}
              </div>
            )}
          </section>
        </div>

      <div className="mf-periodo">
        <div>
          <h2>{P.rotulo}</h2>
          {mensal && <button className="mf-link" style={{ fontSize: 13, paddingLeft: 0 }} onClick={exportarCsv}><FileSpreadsheet size={14} style={{ verticalAlign: -2 }} /> Exportar planilha do mês</button>}
        </div>
        <Seg valor={periodo} onChange={setPeriodo} opcoes={PERIODOS} />
      </div>

      <section className="mf-hero">
        <p style={{ opacity: 0.8 }}>{TITULO_FATURAMENTO[periodo]}</p>
        <div className="valor">{brl(f.total)}</div>
        <p style={{ opacity: 0.8 }}>{f.previsto > 0 ? `Mais ${brl(f.previsto)} em horários já marcados` : "Nenhum valor previsto em horários marcados"}</p>
        {meta > 0 && mensal && (<>
          <div className="barra"><i style={{ width: `${pct * 100}%` }} /></div>
          <small style={{ color: "rgba(255,255,255,.78)" }}>{Math.round(pct * 100)}% da meta de {brl(meta)}</small>
          {ehAtual && falta > 0 && diasRestantes > 0 && <p className="falta">Faltam {brl(falta)} além do que já está marcado: cerca de {brl(falta / diasRestantes)} por dia de atendimento restante ({diasRestantes}).</p>}
          {ehAtual && f.total + f.previsto >= meta && <p className="falta">Com os horários marcados, a meta do mês fica batida.</p>}
        </>)}
        <div className="fontes">
          <span><i className="mf-dot" style={{ background: "#8FB0E6" }} />Pacotes {brl(f.pacotes)}</span>
          <span><i className="mf-dot" style={{ background: "#fff" }} />Serviços {brl(f.servicos)}</span>
          <span><i className="mf-dot" style={{ background: "#F08A80" }} />Campanhas {brl(f.campanhas)}</span>
        </div>
      </section>

      <div className="mf-grid mf-g2">
        <section className="mf-panel">
          <h3>Vendas por serviço</h3>
          {vendas.length === 0 ? <p className="sub">Nenhum atendimento concluído neste período.</p> : (
            <Rosca lado titulo="Em R$" fatias={fatiasRosca(vendas, "valor")} cor={corServico} formatar={brl} detalhe={atendimentos} />
          )}
        </section>
        <section className="mf-panel">
          <h3>Comum × Flex</h3>
          {vendas.length === 0 ? <p className="sub">Nenhum atendimento concluído neste período.</p> : (
            <Rosca lado titulo="Em R$" fatias={fatiasRosca(itensCF, "valor")} cor={corComumFlex} formatar={brl} detalhe={atendimentos} />
          )}
        </section>
      </div>
      <section className="mf-panel">
        <h3 style={{ marginBottom: 10 }}><Wallet size={17} style={{ verticalAlign: -2 }} /> Recebido por forma de pagamento</h3>
        {totalPag === 0 ? <p className="sub">Nada recebido neste período.</p> : (
          <div className="mf-pay">
            {Object.entries(f.porPagamento).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <span className="trilho"><i style={{ width: `${(v / totalPag) * 100}%`, background: k === "Não informado" ? "#BDBDBD" : undefined }} /></span>
                <b>{brl(v)}</b>
              </div>
            ))}
          </div>
        )}
        {f.porPagamento["Não informado"] > 0 && <small style={{ display: "block", marginTop: 8 }}>“Não informado” são atendimentos concluídos sem a forma de pagamento marcada.</small>}
      </section>
    </div>
  );
}
