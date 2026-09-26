/* =====================================================================
   Planos (pacotes pré-pagos), campanhas, vendas e detalhe de pacote
   ===================================================================== */
import React, { useState } from "react";
import { CalendarPlus, MessageCircle, Pencil, Plus, Ticket } from "lucide-react";
import { brl, ddmm, ddmmaa, hojeYmd, plural, primeiroNome, r2, soma, uid, whats, addDays, parse, ymd } from "../util.js";
import {
  campanhaCobre, campanhaVale, clienteDe, infoPacote, precoCampanha, precoPlano, rotuloDesconto, rotuloPagamento, servicoDe, TOM_STATUS, venceEm,
} from "../regras.js";
import { montarPacote } from "../dados.js";
import { BarraSaldo, Campo, ClientePicker, FormaPagamento, NumInput, Seg, Sheet, Tag } from "../componentes.jsx";

export function Planos({ db, update, notify, ask, abrir, sub, setSub }) {
  const [plano, setPlano] = useState(null);
  const [camp, setCamp] = useState(null);
  const [filtro, setFiltro] = useState("Todos");
  const hoje = hojeYmd();

  const infos = db.pacotes.map((p) => ({ p, i: infoPacote(db, p) })).sort((a, b) => b.p.dataCompra.localeCompare(a.p.dataCompra));
  const filtros = ["Todos", "Ativo", "Vence em breve", "Vencido", "Concluído", "Cancelado"];
  const visiveis = infos.filter((x) => filtro === "Todos" || x.i.status === filtro);

  return (
    <div className="mf-wrap mf-stack" style={{ gap: 14 }}>
      <div className="mf-head">
        <div><h1>Planos e campanhas</h1><p className="sub">Crie pacotes pré-pagos e promoções, e acompanhe as vendas.</p></div>
        <button className="mf-btn latao" onClick={() => abrir.venda(null)}><Ticket size={17} />Vender plano</button>
      </div>
      <Seg valor={sub} onChange={setSub} opcoes={[["planos", `Planos (${db.planos.length})`], ["campanhas", `Campanhas (${db.campanhas.length})`], ["vendas", `Vendidos (${db.pacotes.length})`]]} />

      {sub === "planos" && (
        <div className="mf-grid mf-g2">
          {db.planos.map((p) => {
            const s = servicoDe(db, p.servicoId);
            const cheio = p.qtd * (s?.preco || 0);
            const preco = precoPlano(db, p);
            const vendidos = db.pacotes.filter((x) => x.planoId === p.id && !x.cancelado);
            return (
              <section key={p.id} className="mf-panel mf-stack" style={{ gap: 10, opacity: p.ativo ? 1 : 0.6 }}>
                <div className="mf-row mf-between">
                  <div><h2>{p.nome}</h2><small>Código {p.sigla}, {p.qtd} × {s?.nome || "serviço removido"}, validade {p.validadeDias} dias</small></div>
                  <Tag tom={p.ativo ? "ok" : "neutro"}>{p.ativo ? "À venda" : "Pausado"}</Tag>
                </div>
                {p.descricao && <p>{p.descricao}</p>}
                <div className="mf-row mf-wrapr" style={{ gap: 12, alignItems: "baseline" }}>
                  <span className="mf-price">{brl(preco)}</span>
                  <span className="mf-strike">{brl(cheio)}</span>
                  <Tag tom="azul">cliente economiza {brl(cheio - preco)}</Tag>
                  {p.somenteVagas && <Tag tom="alerta">só em horário Flex</Tag>}
                </div>
                <div className="mf-sep" style={{ margin: "2px 0" }} />
                <div className="mf-row mf-between">
                  <small>{vendidos.length} vendido(s), {brl(soma(vendidos, (x) => x.valorPago))} no total</small>
                  <button className="mf-btn sm alt" onClick={() => setPlano(p)}><Pencil size={14} />Editar</button>
                </div>
              </section>
            );
          })}
          <button className="mf-panel mf-empty" style={{ borderStyle: "dashed", cursor: "pointer" }} onClick={() => setPlano({})}>
            <Plus size={26} /><h3>Criar plano</h3><p>Pacote de cortes pagos adiantado</p>
          </button>
        </div>
      )}

      {sub === "campanhas" && (
        <div className="mf-grid mf-g2">
          {db.campanhas.map((c) => {
            const vendas = db.agendamentos.filter((a) => a.campanhaId === c.id && (a.tipo === "campanha" || (a.tipo === "pacote" && a.deOferta)));
            const vigente = campanhaVale(c, hoje);
            const exemplo = db.servicos.find((s) => campanhaCobre(c, s.id)) || db.servicos[0];
            const porServico = c.descontoTipo === "porServico";
            return (
              <section key={c.id} className="mf-panel mf-stack" style={{ gap: 10 }}>
                <div className="mf-row mf-between">
                  <div><h2>{c.nome}</h2><small>{c.tipo === "vaga" ? "Desconto em horário vago" : porServico ? "Desconto nos serviços da agenda" : `Desconto em ${c.servicoIds?.length ? c.servicoIds.map((id) => servicoDe(db, id)?.nome).filter(Boolean).join(", ") : "todos os serviços"}`}</small></div>
                  <Tag tom={vigente ? "ok" : "neutro"}>{vigente ? "Ativa" : c.ativa ? "Fora do período" : "Pausada"}</Tag>
                </div>
                {c.descricao && <p>{c.descricao}</p>}
                <div className="mf-row mf-wrapr" style={{ alignItems: "baseline", gap: 10 }}>
                  <span className={porServico ? "" : "mf-price"} style={{ color: "var(--poste-tx)", fontWeight: 700 }}>{rotuloDesconto(c, db)}</span>
                  {exemplo && !porServico && <small>{exemplo.nome}: {brl(exemplo.preco)} → {brl(precoCampanha(c, exemplo.preco, exemplo.id))}</small>}
                </div>
                <small>{c.inicio ? `de ${ddmmaa(c.inicio)}` : "sem início definido"}{c.fim ? ` até ${ddmmaa(c.fim)}` : ", sem data para acabar"}</small>
                <div className="mf-sep" style={{ margin: "2px 0" }} />
                <div className="mf-row mf-between mf-wrapr">
                  <small>{vendas.length} venda(s), {brl(soma(vendas.filter((a) => a.status === "concluido" && a.tipo === "campanha"), (a) => a.valor))} recebido</small>
                  <div className="mf-row">
                    <label className="mf-toggle"><input type="checkbox" checked={c.ativa} onChange={(e) => update((d) => { d.campanhas.find((x) => x.id === c.id).ativa = e.target.checked; return d; })} />Ativa</label>
                    <button className="mf-btn sm alt" onClick={() => setCamp(c)}><Pencil size={14} />Editar</button>
                  </div>
                </div>
              </section>
            );
          })}
          <button className="mf-panel mf-empty" style={{ borderStyle: "dashed", cursor: "pointer" }} onClick={() => setCamp({})}>
            <Plus size={26} /><h3>Criar campanha</h3><p>Desconto em horários vagos ou em serviços</p>
          </button>
        </div>
      )}

      {sub === "vendas" && (
        <section className="mf-panel mf-stack" style={{ gap: 10 }}>
          <div className="mf-chips">
            {filtros.map((f) => <button key={f} className={"mf-chip" + (filtro === f ? " on" : "")} onClick={() => setFiltro(f)}>{f} ({f === "Todos" ? infos.length : infos.filter((x) => x.i.status === f).length})</button>)}
          </div>
          {visiveis.length === 0 ? (
            <div className="mf-empty"><h3>Nenhum pacote aqui</h3><p>Use “Vender plano” para registrar a primeira venda.</p></div>
          ) : (
            <div className="mf-list">
              {visiveis.map(({ p, i }) => {
                const c = clienteDe(db, p.clienteId);
                return (
                  <button key={p.id} className="mf-item" onClick={() => abrir.pacote(p.id)}>
                    <span className="mf-code" style={{ width: 64 }}>{p.codigo}</span>
                    <div className="mf-grow">
                      <b className="mf-ellip" style={{ display: "block" }}>{c?.nome}</b>
                      <small>{p.planoNome}, comprado {ddmm(p.dataCompra)}, vence {ddmm(i.vence)}</small>
                      <BarraSaldo qtd={p.qtd} usados={i.usados} reservados={i.reservados} />
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Tag tom={TOM_STATUS[i.status]}>{i.status}</Tag>
                      <div className="sub" style={{ marginTop: 4 }}>{brl(p.valorPago)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {plano && <PlanoForm db={db} update={update} notify={notify} ask={ask} plano={plano} onClose={() => setPlano(null)} />}
      {camp && <CampanhaForm db={db} update={update} notify={notify} ask={ask} camp={camp} onClose={() => setCamp(null)} />}
    </div>
  );
}

function PlanoForm({ db, update, notify, ask, plano, onClose }) {
  const [f, setF] = useState({ nome: "", sigla: "", servicoId: db.servicos[0]?.id, qtd: 3, descontoPorUso: 10, validadeDias: 45, ativo: true, somenteVagas: false, descricao: "", ...plano });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setN = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const s = servicoDe(db, f.servicoId);
  const num = { ...f, qtd: Number(f.qtd) || 0, descontoPorUso: Number(f.descontoPorUso) || 0, validadeDias: Number(f.validadeDias) || 0 };
  const sigla = (f.sigla || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const siglaUsada = db.planos.some((p) => p.id !== plano.id && (p.sigla || "").toUpperCase() === sigla);
  const ok = f.nome.trim() && sigla && !siglaUsada && num.qtd > 0 && num.qtd <= 30 && num.validadeDias > 0 && s && num.descontoPorUso < (s?.preco || 0);
  const vendidos = plano.id ? db.pacotes.filter((p) => p.planoId === plano.id).length : 0;
  const salvarP = () => {
    const dados = { ...num, nome: f.nome.trim(), sigla };
    update((d) => {
      const x = plano.id && d.planos.find((p) => p.id === plano.id);
      if (x) Object.assign(x, dados);
      else d.planos.push({ ...dados, id: uid() });
      return d;
    });
    notify(plano.id ? "Plano atualizado" : "Plano criado");
    onClose();
  };
  return (
    <Sheet titulo={plano.id ? "Editar plano" : "Novo plano"} sub={vendidos ? "Mudanças valem só para as próximas vendas. Pacotes já vendidos mantêm preço e validade." : undefined} onClose={onClose}>
      <div className="mf-stack">
        <div className="mf-grid" style={{ gridTemplateColumns: "1fr 110px" }}>
          <Campo label="Nome do plano"><input className="mf-input" value={f.nome} onChange={set("nome")} placeholder="Mats Flex 10" autoFocus={!plano.id} /></Campo>
          <Campo label="Código"><input className="mf-input" value={f.sigla} onChange={set("sigla")} placeholder="F10" maxLength={4} disabled={!!vendidos} /></Campo>
        </div>
        {siglaUsada && <small style={{ color: "var(--poste-tx)" }}>Já existe um plano com esse código.</small>}
        <Campo label="Serviço incluído">
          <select className="mf-input" value={f.servicoId} onChange={set("servicoId")}>
            {db.servicos.map((x) => <option key={x.id} value={x.id}>{x.nome} ({brl(x.preco)})</option>)}
          </select>
        </Campo>
        <div className="mf-g-3-fixo">
          <Campo label="Quantidade"><NumInput value={f.qtd} onChange={setN("qtd")} min={1} max={30} inteiro /></Campo>
          <Campo label="Desconto/uso (R$)"><NumInput value={f.descontoPorUso} onChange={setN("descontoPorUso")} min={0} /></Campo>
          <Campo label="Validade (dias)"><NumInput value={f.validadeDias} onChange={setN("validadeDias")} min={1} max={730} inteiro /></Campo>
        </div>
        {s && num.descontoPorUso >= s.preco && <small style={{ color: "var(--poste-tx)" }}>O desconto por uso precisa ser menor que o preço do serviço.</small>}
        <Campo label="Descrição para o cliente"><textarea className="mf-input" rows={2} value={f.descricao} onChange={set("descricao")} /></Campo>
        <label className="mf-toggle"><input type="checkbox" checked={f.ativo} onChange={set("ativo")} />Disponível para venda</label>
        <label className="mf-toggle"><input type="checkbox" checked={!!f.somenteVagas} onChange={set("somenteVagas")} />Só pode ser usado em horários Flex (vagas ociosas)</label>
        <div className="mf-panel mf-row mf-between" style={{ padding: 12 }}>
          <span className="sub">Preço do plano</span>
          <span className="mf-row"><span className="mf-strike">{brl(num.qtd * (s?.preco || 0))}</span><span className="mf-price" style={{ fontSize: 28 }}>{brl(precoPlano(db, num))}</span></span>
        </div>
        <button className="mf-btn full" disabled={!ok} onClick={salvarP}>{plano.id ? "Salvar plano" : "Criar plano"}</button>
        {plano.id && !vendidos && (
          <button className="mf-link perigo" onClick={() => ask(`Excluir o plano ${plano.nome}?`, () => {
            update((d) => { d.planos = d.planos.filter((p) => p.id !== plano.id); return d; }, true);
            notify("Plano excluído", true); onClose();
          })}>Excluir plano</button>
        )}
      </div>
    </Sheet>
  );
}

function CampanhaForm({ db, update, notify, ask, camp, onClose }) {
  const [f, setF] = useState({ nome: "", tipo: "vaga", descontoTipo: "pct", descontoPct: 20, descontoValor: 10, descontos: {}, servicoIds: [], inicio: hojeYmd(), fim: "", ativa: true, descricao: "", ...camp });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setN = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const setDesc = (id) => (v) => setF((x) => ({ ...x, descontos: { ...x.descontos, [id]: v } }));
  const pct = Number(f.descontoPct) || 0;
  const val = Number(f.descontoValor) || 0;
  const porServico = f.descontoTipo === "porServico";
  // só os serviços com desconto de verdade ficam gravados
  const descontos = Object.fromEntries(Object.entries(f.descontos || {}).filter(([, v]) => Number(v) > 0).map(([id, v]) => [id, r2(v)]));
  const descontoOk = porServico ? Object.keys(descontos).length > 0 : f.descontoTipo === "pct" ? pct > 0 && pct < 100 : val > 0;
  const ok = f.nome.trim() && descontoOk && (!f.fim || !f.inicio || f.fim >= f.inicio);
  const usada = camp.id && db.agendamentos.some((a) => a.campanhaId === camp.id);
  const toggleServ = (id) => setF({ ...f, servicoIds: f.servicoIds.includes(id) ? f.servicoIds.filter((x) => x !== id) : [...f.servicoIds, id] });
  const previa = { ...f, descontoPct: pct, descontoValor: val, descontos };
  const salvarC = () => {
    const dados = { ...f, nome: f.nome.trim(), descontoPct: pct, descontoValor: r2(val), descontos };
    update((d) => {
      const x = camp.id && d.campanhas.find((c) => c.id === camp.id);
      if (x) Object.assign(x, dados);
      else d.campanhas.push({ ...dados, id: uid() });
      return d;
    });
    notify(camp.id ? "Campanha atualizada" : "Campanha criada");
    onClose();
  };
  const servsPrevia = porServico || (f.tipo === "servico" && f.servicoIds.length) ? db.servicos.filter((s) => campanhaCobre(previa, s.id)) : db.servicos;
  return (
    <Sheet titulo={camp.id ? "Editar campanha" : "Nova campanha"} onClose={onClose}>
      <div className="mf-stack">
        <Campo label="Nome da campanha"><input className="mf-input" value={f.nome} onChange={set("nome")} placeholder="Ex.: Mats Flex manhã" autoFocus={!camp.id} /></Campo>
        <Campo label="Onde o desconto vale">
          <Seg valor={f.tipo} onChange={(v) => setF({ ...f, tipo: v })} opcoes={[["vaga", "Horários vagos"], ["servico", "Serviços na agenda"]]} />
        </Campo>
        <p className="sub">{f.tipo === "vaga" ? "Você escolhe quais horários vagos ofertar. Eles aparecem listrados na agenda até alguém comprar." : "O desconto pode ser escolhido na hora de agendar qualquer cliente, nos serviços marcados abaixo."}</p>
        {f.tipo === "servico" && !porServico && (
          <Campo label="Serviços com desconto" dica="Nenhum marcado = vale para todos.">
            <div className="mf-chips">
              {db.servicos.map((s) => <button key={s.id} type="button" className={"mf-chip" + (f.servicoIds.includes(s.id) ? " on" : "")} onClick={() => toggleServ(s.id)}>{s.nome}</button>)}
            </div>
          </Campo>
        )}
        <Campo label="Tipo de desconto">
          <Seg valor={f.descontoTipo} onChange={(v) => setF({ ...f, descontoTipo: v })} opcoes={[["pct", "Porcentagem"], ["valor", "R$ a menos"], ["preco", "Preço fixo"], ["porServico", "Por serviço"]]} />
        </Campo>
        {porServico && (
          <Campo label="Desconto em cada serviço (R$)" dica="Em branco ou 0 = sem desconto. Um serviço sem desconto ainda pode entrar numa oferta pelo preço cheio.">
            <div className="mf-stack" style={{ gap: 6 }}>
              {db.servicos.map((s) => (
                <div key={s.id} className="mf-row mf-between">
                  <span className="mf-grow">{s.nome} <small className="mf-muted">({brl(s.preco)})</small></span>
                  <NumInput style={{ maxWidth: 110 }} value={f.descontos?.[s.id] ?? null} onChange={setDesc(s.id)} min={0} placeholder="0" aria-label={`Desconto em ${s.nome}`} />
                </div>
              ))}
            </div>
          </Campo>
        )}
        <div className="mf-g-3-fixo">
          {porServico ? null : f.descontoTipo === "pct"
            ? <Campo label="Desconto (%)"><NumInput value={f.descontoPct} onChange={setN("descontoPct")} min={1} max={99} inteiro /></Campo>
            : <Campo label={f.descontoTipo === "valor" ? "Desconto (R$)" : "Preço (R$)"}><NumInput value={f.descontoValor} onChange={setN("descontoValor")} min={0} /></Campo>}
          <Campo label="Começa em"><input className="mf-input" type="date" value={f.inicio} onChange={set("inicio")} /></Campo>
          <Campo label="Termina em"><input className="mf-input" type="date" value={f.fim} onChange={set("fim")} /></Campo>
        </div>
        {f.fim && f.inicio && f.fim < f.inicio && <small style={{ color: "var(--poste-tx)" }}>A data de término é antes do início.</small>}
        <div className="mf-panel" style={{ padding: 12 }}>
          <small>Como fica o preço:</small>
          <div className="mf-ledger">
            {servsPrevia.map((s) => <div key={s.id}><span>{s.nome}</span><span><span className="mf-strike">{brl(s.preco)}</span> <b style={{ fontSize: 18 }}>{brl(precoCampanha(previa, s.preco, s.id))}</b></span></div>)}
          </div>
        </div>
        <Campo label="Descrição"><textarea className="mf-input" rows={2} value={f.descricao} onChange={set("descricao")} /></Campo>
        <label className="mf-toggle"><input type="checkbox" checked={f.ativa} onChange={set("ativa")} />Campanha ativa</label>
        <button className="mf-btn full" disabled={!ok} onClick={salvarC}>{camp.id ? "Salvar campanha" : "Criar campanha"}</button>
        {camp.id && !usada && (
          <button className="mf-link perigo" onClick={() => ask(`Excluir a campanha ${camp.nome}?`, () => {
            update((d) => { d.campanhas = d.campanhas.filter((c) => c.id !== camp.id); return d; }, true);
            notify("Campanha excluída", true); onClose();
          })}>Excluir campanha</button>
        )}
        {camp.id && usada && <small className="mf-muted">Campanhas já usadas não podem ser excluídas, só pausadas.</small>}
      </div>
    </Sheet>
  );
}

export function VendaForm({ db, update, notify, clienteInicial, onClose }) {
  const ativos = db.planos.filter((p) => p.ativo);
  const [clienteId, setClienteId] = useState(clienteInicial || null);
  const [planoId, setPlanoId] = useState(ativos[0]?.id);
  const [data, setData] = useState(hojeYmd());
  const [pag, setPag] = useState(db.config.pagamentoPadrao || "Pix");
  const [emDinheiro, setEmDinheiro] = useState(0);
  const plano = db.planos.find((p) => p.id === planoId);
  const [feito, setFeito] = useState(null);
  if (feito) {
    const c = clienteDe(db, feito.clienteId);
    const msg = `Olá, ${primeiroNome(c?.nome)}! Seu ${feito.planoNome} está ativo. Código: ${feito.codigo}. São ${feito.qtd} atendimento(s) válidos até ${ddmmaa(venceEm(feito))}${feito.somenteVagas ? ", usados nos horários Flex que eu divulgo" : ""}. É só me chamar para marcar!`;
    return (
      <Sheet titulo="Venda registrada" onClose={onClose}>
        <div className="mf-stack" style={{ alignItems: "center", textAlign: "center" }}>
          <p className="sub">Passe este código para o cliente</p>
          <div className="mf-code" style={{ fontSize: 64 }}>{feito.codigo}</div>
          <p><b>{c?.nome}</b>, {feito.planoNome}, {brl(feito.valorPago)}</p>
          {c?.telefone
            ? <a className="mf-btn full" href={whats(c.telefone, msg, db.config.ddd)} target="_blank" rel="noreferrer"><MessageCircle size={17} />Enviar comprovante no WhatsApp</a>
            : <small>Cliente sem telefone cadastrado.</small>}
          <button className="mf-btn alt full" onClick={onClose}>Fechar</button>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet titulo="Vender plano" onClose={onClose}>
      <div className="mf-stack">
        <Campo label="Cliente"><ClientePicker db={db} update={update} valor={clienteId} onChange={setClienteId} /></Campo>
        <Campo label="Plano">
          {ativos.length === 0 ? <small>Nenhum plano à venda. Crie um em Planos.</small> : (
            <div className="mf-opts">
              {ativos.map((p) => (
                <button type="button" key={p.id} className={"mf-opt" + (planoId === p.id ? " on" : "")} onClick={() => setPlanoId(p.id)}>
                  <span><b>{p.nome}</b><br /><small>{p.qtd} × {servicoDe(db, p.servicoId)?.nome}, {p.validadeDias} dias{p.somenteVagas ? ", horário Flex" : ""}</small></span>
                  <b>{brl(precoPlano(db, p))}</b>
                </button>
              ))}
            </div>
          )}
        </Campo>
        <div className="mf-grid mf-g2">
          <Campo label="Data da compra"><input className="mf-input" type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
        </div>
        <Campo label="Pagamento">
          <FormaPagamento pagamento={pag} emDinheiro={emDinheiro} total={plano ? precoPlano(db, plano) : 0}
            onChange={({ pagamento, emDinheiro: v }) => { setPag(pagamento); setEmDinheiro(v); }} />
        </Campo>
        {plano && data && (
          <div className="mf-panel mf-row mf-between" style={{ padding: 12 }}>
            <span className="sub">Vence em {ddmmaa(ymd(addDays(parse(data), plano.validadeDias)))}</span>
            <span className="mf-price" style={{ fontSize: 28 }}>{brl(precoPlano(db, plano))}</span>
          </div>
        )}
        <button className="mf-btn latao full" disabled={!clienteId || !plano || !data} onClick={() => {
          const novo = montarPacote(db, { clienteId, planoId, dataCompra: data, pagamento: pag, emDinheiro });
          update((d) => { d.pacotes.push(novo); return d; });
          setFeito(novo);
          notify("Venda registrada");
        }}>Registrar venda</button>
      </div>
    </Sheet>
  );
}

export function PacoteDetalhe({ db, update, notify, ask, abrir, pacote, onClose }) {
  const c = clienteDe(db, pacote.clienteId);
  const i = infoPacote(db, pacote);
  const futuros = i.ags.filter((a) => a.status === "agendado");
  const msgSaldo = `Olá, ${primeiroNome(c?.nome)}! Resumo do seu ${pacote.planoNome} (${pacote.codigo}): ${i.usados} usado(s), ${i.saldo} disponível(is)${futuros.length ? `, ${futuros.length} já marcado(s)` : ""}. Válido até ${ddmmaa(i.vence)}.`;
  const estender = (dias) => {
    update((d) => { const p = d.pacotes.find((x) => x.id === pacote.id); p.extraDias = (Number(p.extraDias) || 0) + dias; return d; }, true);
    notify(`Validade estendida em ${dias} dias`, true);
  };
  return (
    <Sheet titulo={`${pacote.codigo}, ${pacote.planoNome}`} sub={c?.nome} onClose={onClose}>
      <div className="mf-stack">
        <div className="mf-row mf-between"><Tag tom={TOM_STATUS[i.status]}>{i.status}</Tag><span className="mf-price" style={{ fontSize: 26 }}>{brl(pacote.valorPago)}</span></div>
        <BarraSaldo qtd={pacote.qtd} usados={i.usados} reservados={i.reservados} />
        <div className="mf-panel mf-ledger">
          <div><span>Cliente</span>{c ? <button className="mf-link" onClick={() => abrir.cliente(c.id)}>{c.nome}</button> : <span>—</span>}</div>
          <div><span>Comprado em</span><span>{ddmmaa(pacote.dataCompra)} ({rotuloPagamento(pacote.pagamento, pacote.emDinheiro, pacote.valorPago) || "pagamento não informado"})</span></div>
          <div><span>Vence em</span><span>{ddmmaa(i.vence)}{i.dias >= 0 ? ` (${i.dias} dias)` : ""}{pacote.extraDias ? ` · +${pacote.extraDias}d de cortesia` : ""}</span></div>
          <div><span>Usados</span><b>{i.usados}</b></div>
          <div><span>Marcados</span><b>{i.reservados}</b></div>
          <div><span>Disponíveis</span><b>{i.saldo}</b></div>
          <div><span>Economia do cliente</span><span>{brl(pacote.economia)}</span></div>
        </div>
        {c?.telefone && <a className="mf-btn sm alt" style={{ alignSelf: "flex-start" }} href={whats(c.telefone, msgSaldo, db.config.ddd)} target="_blank" rel="noreferrer"><MessageCircle size={14} />Enviar saldo no WhatsApp</a>}
        {!pacote.cancelado && i.status !== "Concluído" && (
          <Campo label="Estender validade (cortesia)">
            <div className="mf-quick">
              {[7, 15, 30].map((n) => <button type="button" key={n} onClick={() => estender(n)}><CalendarPlus size={13} style={{ verticalAlign: -2 }} /> +{n} dias</button>)}
            </div>
          </Campo>
        )}
        <h3>Usos</h3>
        {i.ags.length === 0 ? <small>Ainda não usado. Para usar, agende o cliente escolhendo “Pacote” ou venda uma vaga Flex para ele.</small> : (
          <div className="mf-list mf-panel" style={{ padding: "0 12px" }}>
            {[...i.ags].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)).map((a) => (
              <button key={a.id} className="mf-item" onClick={() => abrir.horario(a.data, a.hora)}>
                <div className="mf-grow">{ddmmaa(a.data)} às {a.hora}{a.deOferta ? " · Flex" : ""}</div>
                <Tag tom={a.status === "concluido" ? "ok" : a.status === "faltou" ? "erro" : "neutro"}>{a.status === "concluido" ? "Concluído" : a.status === "faltou" ? "Faltou" : "Agendado"}</Tag>
              </button>
            ))}
          </div>
        )}
        {!pacote.cancelado ? (
          <button className="mf-link perigo" onClick={() => ask(`Cancelar o pacote ${pacote.codigo}? O valor sai do faturamento${futuros.length ? ` e ${plural(futuros.length, "horário marcado é desmarcado", "horários marcados são desmarcados")}` : ""}.`, () => {
            update((d) => {
              d.pacotes.find((p) => p.id === pacote.id).cancelado = true;
              const ids = new Set(futuros.map((a) => a.id));
              d.agendamentos = d.agendamentos.flatMap((a) => {
                if (!ids.has(a.id)) return [a];
                // horário Flex vendido com pacote volta a ser oferta; os demais são liberados
                return a.deOferta ? [{ ...a, tipo: "oferta", clienteId: null, pacoteId: null, deOferta: false, valor: a.valorOferta ?? 0 }] : [];
              });
              return d;
            }, true);
            notify("Pacote cancelado", true);
          })}>Cancelar pacote</button>
        ) : (
          <button className="mf-link" onClick={() => { update((d) => { d.pacotes.find((p) => p.id === pacote.id).cancelado = false; return d; }); notify("Pacote reativado"); }}>Reativar pacote</button>
        )}
      </div>
    </Sheet>
  );
}
