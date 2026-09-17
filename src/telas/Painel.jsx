/* =====================================================================
   Painel: hoje, amanhã, faturamento, retorno de clientes e relatórios
   ===================================================================== */
import React, { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  AlertTriangle, Cake, ChevronLeft, ChevronRight, Clock, Download, FileSpreadsheet, MessageCircle, ShieldCheck, Wallet,
} from "lucide-react";
import {
  addDays, brl, cap, dataLonga, ddmm, ddmmaa, diasAteAniversario, entregarArquivo, gerarCsv, hojeYmd, inicioMes, MESES,
  momento, nomeMes, pad, parse, plural, primeiroNome, soma, whats, ymd, fimMesYmd, diffDias,
} from "../util.js";
import {
  atendeNoDia, capacidadeMes, clienteDe, diaFechado, faturamentoMes, infoPacote, infoRetorno, pendentes, recebidoNoDia,
  servicoDe, TIPOS_ATENDIMENTO, vagasLivres, campanhaDe,
} from "../regras.js";
import { useAgora, Tag } from "../componentes.jsx";
import { msgAniversario, msgRetorno } from "./Clientes.jsx";

const CORES = { Pacotes: "var(--azul-tx)", Serviços: "var(--grafico-servicos)", Campanhas: "var(--poste-tx)" };

export function Painel({ db, notify, abrir, fazerBackup }) {
  const agora = useAgora();
  const [ref, setRef] = useState(inicioMes(new Date()));
  const cfg = db.config;
  const key = ymd(ref).slice(0, 7);
  const f = useMemo(() => faturamentoMes(db, key), [db, key]);
  const hoje = hojeYmd();
  const ehAtual = key === hoje.slice(0, 7);
  const ultimo = fimMesYmd(ref);

  const diario = useMemo(() => {
    const n = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => {
      const data = `${key}-${pad(i + 1)}`;
      const feitos = db.agendamentos.filter((a) => a.data === data && a.status === "concluido");
      return {
        dia: String(i + 1),
        Pacotes: soma(db.pacotes.filter((p) => !p.cancelado && p.dataCompra === data), (p) => p.valorPago),
        Serviços: soma(feitos.filter((a) => a.tipo === "avulso"), (a) => a.valor),
        Campanhas: soma(feitos.filter((a) => a.tipo === "campanha"), (a) => a.valor),
      };
    });
  }, [db, key, ref]);

  const historico = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(ref.getFullYear(), ref.getMonth() - 5 + i, 1);
    const r = faturamentoMes(db, ymd(d).slice(0, 7));
    return { mes: MESES[d.getMonth()].slice(0, 3), Pacotes: r.pacotes, Serviços: r.servicos, Campanhas: r.campanhas };
  }), [db, ref]);

  const ags = db.agendamentos.filter((a) => a.data.startsWith(key));
  const capacidade = capacidadeMes(db, key);
  const ocupados = ags.filter((a) => TIPOS_ATENDIMENTO.includes(a.tipo)).length;
  const ocupacao = capacidade ? Math.min(1, ocupados / capacidade) : 0;
  const livres = ehAtual ? vagasLivres(db, hoje, ultimo, agora).length : null;

  const ofertas = ags.filter((a) => a.tipo === "oferta");
  const ofAbertas = ofertas.filter((a) => momento(a.data, a.hora) > agora).length;
  const ofPerdidas = ofertas.length - ofAbertas;
  const ofVendidas = ags.filter((a) => a.deOferta || (a.tipo === "campanha" && campanhaDe(db, a.campanhaId)?.tipo === "vaga")).length;
  const taxa = ofVendidas + ofPerdidas ? ofVendidas / (ofVendidas + ofPerdidas) : 0;

  const infos = db.pacotes.map((p) => ({ p, i: infoPacote(db, p) }));
  const ativos = infos.filter((x) => x.i.status === "Ativo" || x.i.status === "Vence em breve");
  const aAtender = soma(ativos, (x) => x.p.qtd - x.i.usados);
  const atencao = infos.filter((x) => (x.i.status === "Vence em breve" || x.i.status === "Vencido") && x.i.saldo > 0 && x.i.dias > -30)
    .sort((a, b) => a.i.dias - b.i.dias).slice(0, 6);

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

  const retornos = useMemo(() => db.clientes.map((c) => ({ c, r: infoRetorno(db, c, hoje) })), [db, hoje]);
  const paraChamar = retornos.filter((x) => x.r.situacao === "Chamar").sort((a, b) => b.r.atraso - a.r.atraso);
  const aniversarios = db.clientes.map((c) => ({ c, d: diasAteAniversario(c.aniversario, hoje) })).filter((x) => x.d !== null && x.d <= 7).sort((a, b) => a.d - b.d);

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

      {ehAtual && (
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
      )}

      <div className="mf-row mf-between">
        <button className="mf-iconbtn" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))} aria-label="Mês anterior"><ChevronLeft /></button>
        <div style={{ textAlign: "center" }}>
          <h2>{cap(nomeMes(ref))}</h2>
          <button className="mf-link" style={{ fontSize: 13 }} onClick={exportarCsv}><FileSpreadsheet size={14} style={{ verticalAlign: -2 }} /> Exportar planilha do mês</button>
        </div>
        <button className="mf-iconbtn" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))} aria-label="Próximo mês"><ChevronRight /></button>
      </div>

      <section className="mf-hero">
        <p style={{ opacity: 0.8 }}>{ehAtual ? "Faturamento do mês até agora" : "Faturamento do mês"}</p>
        <div className="valor">{brl(f.total)}</div>
        <p style={{ opacity: 0.8 }}>{f.previsto > 0 ? `Mais ${brl(f.previsto)} em horários já marcados` : "Nenhum valor previsto em horários marcados"}</p>
        {meta > 0 && (<>
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

      <section className="mf-panel">
        <div className="mf-row mf-between mf-wrapr" style={{ marginBottom: 8 }}>
          <h3>Faturamento por dia</h3>
          <div className="mf-legenda">{Object.entries(CORES).map(([k, c]) => <span key={k}><i style={{ background: c, border: 0 }} />{k}</span>)}</div>
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={diario} margin={{ top: 6, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--linha)" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} interval={2} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v) => brl(v)} labelFormatter={(l) => `Dia ${l}`} cursor={{ fill: "rgba(31,58,50,.06)" }} />
              {Object.entries(CORES).map(([k, c]) => <Bar key={k} dataKey={k} stackId="a" fill={c} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mf-grid mf-g3">
        <section className="mf-panel">
          <h3>Atendimentos</h3>
          <div className="mf-ledger">
            <div><span>Concluídos</span><b>{f.atendimentos}</b></div>
            <div><span>Faltas</span><b style={{ color: f.faltas ? "#C8372D" : undefined }}>{f.faltas}</b></div>
            <div><span>Ticket médio</span><b>{brl(f.ticket)}</b></div>
            <div><span>Ocupação da agenda</span><b>{Math.round(ocupacao * 100)}%</b></div>
            {livres !== null && (
              <div><button className="mf-link" onClick={() => abrir.aba("vagas")}>Vagas livres até o fim do mês</button><b>{livres}</b></div>
            )}
          </div>
        </section>
        <section className="mf-panel">
          <h3>Vagas com desconto</h3>
          <div className="mf-ledger">
            <div><span>Vendidas</span><b>{ofVendidas}</b></div>
            <div><span>Em oferta agora</span><b>{ofAbertas}</b></div>
            <div><span>Não vendidas</span><b>{ofPerdidas}</b></div>
            <div><span>Taxa de venda</span><b>{Math.round(taxa * 100)}%</b></div>
          </div>
        </section>
        <section className="mf-panel">
          <h3>Pacotes</h3>
          <div className="mf-ledger">
            <div><span>Vendidos no mês</span><b>{f.qtdPacotes}</b></div>
            <div><span>Ativos</span><b>{ativos.length}</b></div>
            <div><span>Cortes ainda a atender</span><b>{aAtender}</b></div>
            <div><button className="mf-link" onClick={() => abrir.aba("planos", "vendas")}>Ver pacotes vendidos</button><b /></div>
          </div>
        </section>
      </div>

      <div className="mf-grid mf-g2">
        <section className="mf-panel">
          <div className="mf-row mf-between" style={{ marginBottom: 6 }}>
            <h3>Clientes para chamar</h3>
            <button className="mf-link" onClick={() => abrir.aba("clientes")}>Ver clientes</button>
          </div>
          {paraChamar.length === 0 ? <p className="sub">Ninguém atrasado. Todo mundo em dia ou já marcado.</p> : (
            <div className="mf-list">
              {paraChamar.slice(0, 5).map(({ c, r }) => (
                <div key={c.id} className="mf-item">
                  <button className="mf-grow" style={{ background: "none", border: 0, textAlign: "left", padding: 0, minWidth: 0 }} onClick={() => abrir.cliente(c.id)}>
                    <b className="mf-ellip" style={{ display: "block" }}>{c.nome}</b>
                    <small>{r.semVisita} dias sem vir{r.perfil ? `, costuma vir ${r.perfil}` : ""}</small>
                  </button>
                  {c.telefone && <a className="mf-btn sm alt" href={whats(c.telefone, msgRetorno(db, c, r), cfg.ddd)} target="_blank" rel="noreferrer"><MessageCircle size={15} />Chamar</a>}
                </div>
              ))}
              {paraChamar.length > 5 && <small style={{ paddingTop: 8 }}>e mais {paraChamar.length - 5} na tela Clientes.</small>}
            </div>
          )}
          {aniversarios.length > 0 && (<>
            <div className="mf-sep" />
            <h3 style={{ marginBottom: 4 }}><Cake size={17} style={{ verticalAlign: -2 }} /> Aniversários da semana</h3>
            <div className="mf-list">
              {aniversarios.map(({ c, d }) => (
                <div key={c.id} className="mf-item">
                  <button className="mf-grow" style={{ background: "none", border: 0, textAlign: "left", padding: 0 }} onClick={() => abrir.cliente(c.id)}>
                    <b>{c.nome}</b><br /><small>{d === 0 ? "hoje!" : d === 1 ? "amanhã" : `em ${d} dias`} ({c.aniversario})</small>
                  </button>
                  {c.telefone && <a className="mf-btn sm alt" href={whats(c.telefone, msgAniversario(db, c), cfg.ddd)} target="_blank" rel="noreferrer"><MessageCircle size={15} />Parabéns</a>}
                </div>
              ))}
            </div>
          </>)}
        </section>
        <section className="mf-panel">
          <h3 style={{ marginBottom: 6 }}>Pacotes que precisam de atenção</h3>
          {atencao.length === 0 ? <p className="sub">Nenhum pacote vencendo com cortes sobrando.</p> : (
            <div className="mf-list">
              {atencao.map(({ p, i }) => {
                const c = clienteDe(db, p.clienteId);
                const msg = `Olá, ${primeiroNome(c?.nome)}! Seu pacote ${p.planoNome} (${p.codigo}) ainda tem ${i.saldo} corte(s) e ${i.dias >= 0 ? `vence em ${ddmmaa(i.vence)}` : `venceu em ${ddmmaa(i.vence)}`}. Quer marcar seu horário?`;
                return (
                  <div key={p.id} className="mf-item">
                    <AlertTriangle size={18} color={i.dias < 0 ? "#C8372D" : "#B8892B"} />
                    <button className="mf-grow" style={{ background: "none", border: 0, textAlign: "left", padding: 0 }} onClick={() => abrir.pacote(p.id)}>
                      <b className="mf-ellip" style={{ display: "block" }}>{c?.nome}</b>
                      <small>{p.codigo}, {i.saldo} corte(s), {i.dias >= 0 ? `vence em ${i.dias} dia(s)` : "vencido"}</small>
                    </button>
                    {c?.telefone && <a className="mf-btn sm alt" href={whats(c.telefone, msg, cfg.ddd)} target="_blank" rel="noreferrer"><MessageCircle size={15} />Avisar</a>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="mf-grid mf-g2">
        <section className="mf-panel">
          <h3 style={{ marginBottom: 10 }}><Wallet size={17} style={{ verticalAlign: -2 }} /> Recebido por forma de pagamento</h3>
          {totalPag === 0 ? <p className="sub">Nada recebido neste mês ainda.</p> : (
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
        <section className="mf-panel">
          <h3 style={{ marginBottom: 8 }}>Últimos 6 meses</h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historico} margin={{ top: 6, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--linha)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => brl(v)} cursor={{ fill: "rgba(31,58,50,.06)" }} />
                {Object.entries(CORES).map(([k, c]) => <Bar key={k} dataKey={k} stackId="a" fill={c} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
