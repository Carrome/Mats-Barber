/* =====================================================================
   Ajustes: barbearia, serviços, agenda, pausas, retorno e dados
   ===================================================================== */
import React, { useEffect, useRef, useState } from "react";
import { CalendarX, Coffee, Download, FlaskConical, History, Moon, Plus, RotateCcw, ShieldCheck, Smartphone, Trash2, Upload } from "lucide-react";
import { brl, dataLonga, DIAS_CURTO, hojeYmd, PAGAMENTOS, uid, digitos } from "../util.js";
import { avisosAjustes, horariosDe } from "../regras.js";
import { baseVazia, criarDemo, lerCopiaAnterior, migrar } from "../dados.js";
import { Campo, NumInput, TextoBlur } from "../componentes.jsx";

const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
const ordenarDias = (dias) => [...dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));

export function Ajustes({ db, update, notify, ask, substituir, instalar, fazerBackup, persistido, modo = "real", trocarModo }) {
  const cfg = db.config;
  const arquivo = useRef(null);
  const [copia, setCopia] = useState(null);
  const emTeste = modo === "teste";
  useEffect(() => { lerCopiaAnterior(emTeste).then(setCopia); }, [emTeste, db]);
  const setCfg = (k, v) => update((d) => { d.config[k] = v; return d; });
  const setServ = (id, k, v) => update((d) => { const s = d.servicos.find((x) => x.id === id); if (s) s[k] = v; return d; });
  const emUso = (id) => db.agendamentos.some((a) => a.servicoId === id) || db.planos.some((p) => p.servicoId === id) || db.pacotes.some((p) => p.servicoId === id);
  const horas = horariosDe(cfg);
  const setPausa = (id, patch) => update((d) => { const p = d.config.pausas.find((x) => x.id === id); if (p) Object.assign(p, patch); return d; });
  const hoje = hojeYmd();
  const fechadosFuturos = (db.fechados || []).filter((f) => f.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));

  const importar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const obj = JSON.parse(r.result);
        if (!Array.isArray(obj.clientes) || !Array.isArray(obj.agendamentos)) throw new Error("formato");
        ask(`Substituir todos os dados atuais pelo backup (${obj.clientes.length} clientes, ${obj.agendamentos.length} horários)? Uma cópia dos dados atuais fica guardada neste aparelho.`, () => {
          substituir(migrar(obj), "Backup restaurado");
        });
      } catch (err) { notify("Arquivo inválido: escolha um backup do Mats Flex (.json)"); }
    };
    r.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="mf-wrap mf-stack" style={{ gap: 14, maxWidth: 780 }}>
      <div className="mf-head"><div><h1>Ajustes</h1><p className="sub">Preços, horários e seus dados.</p></div></div>

      {avisosAjustes(db).map((a) => a.id === "backup" && (
        <section key={a.id} className="mf-banner info" style={{ marginBottom: 0 }}>
          <ShieldCheck size={18} />
          <span className="mf-grow">{a.texto} Os dados ficam só neste aparelho: guarde uma cópia no WhatsApp ou Drive.</span>
          <button className="mf-btn sm" onClick={fazerBackup}><Download size={15} />Fazer backup</button>
        </section>
      ))}

      {instalar && (
        <section className="mf-banner"><Smartphone size={18} /><span className="mf-grow">Instale o Mats Flex na tela inicial para abrir como aplicativo, mesmo sem internet.</span><button className="mf-btn sm" onClick={instalar}>Instalar app</button></section>
      )}

      <section className="mf-panel mf-stack">
        <h3>Barbearia</h3>
        <div className="mf-grid mf-g2">
          <Campo label="Nome"><TextoBlur className="mf-input" value={cfg.nome} onCommit={(v) => setCfg("nome", v.trim() || "Barbearia")} /></Campo>
          <Campo label="Meta de faturamento mensal (R$)"><NumInput value={cfg.meta} onChange={(v) => setCfg("meta", v)} min={0} inteiro /></Campo>
          <Campo label="DDD padrão" dica="Completa números salvos sem DDD na hora de abrir o WhatsApp.">
            <input className="mf-input" inputMode="numeric" maxLength={2} placeholder="22" value={cfg.ddd || ""} onChange={(e) => setCfg("ddd", digitos(e.target.value).slice(0, 2))} />
          </Campo>
          <Campo label="Forma de pagamento mais comum" dica="Já vem marcada ao concluir um atendimento.">
            <select className="mf-input" value={cfg.pagamentoPadrao} onChange={(e) => setCfg("pagamentoPadrao", e.target.value)}>
              {PAGAMENTOS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Campo>
        </div>
      </section>

      <section className="mf-panel mf-stack">
        <h3>Serviços e preços</h3>
        {db.servicos.map((s) => (
          <div key={s.id} className="mf-row">
            <TextoBlur className="mf-input" value={s.nome} onCommit={(v) => setServ(s.id, "nome", v.trim() || "Serviço")} aria-label="Nome do serviço" />
            <NumInput style={{ maxWidth: 110 }} value={s.preco} onChange={(v) => setServ(s.id, "preco", v)} min={0} aria-label={`Preço de ${s.nome}`} />
            <button className="mf-iconbtn" disabled={emUso(s.id) || db.servicos.length <= 1} title={emUso(s.id) ? "Serviço em uso" : "Excluir"} aria-label={`Excluir ${s.nome}`}
              onClick={() => ask(`Excluir o serviço ${s.nome}?`, () => {
                update((d) => {
                  d.servicos = d.servicos.filter((x) => x.id !== s.id);
                  d.campanhas.forEach((c) => { c.servicoIds = (c.servicoIds || []).filter((x) => x !== s.id); });
                  return d;
                }, true);
                notify("Serviço excluído", true);
              })}><Trash2 size={18} color={emUso(s.id) ? "#CCCCCC" : "#C8372D"} /></button>
          </div>
        ))}
        <button className="mf-btn sm alt" style={{ alignSelf: "flex-start" }} onClick={() => update((d) => { d.servicos.push({ id: uid(), nome: "Novo serviço", preco: 30 }); return d; })}><Plus size={15} />Adicionar serviço</button>
        <small>Mudar um preço não altera atendimentos e pacotes já registrados. Serviços já usados não podem ser excluídos.</small>
      </section>

      <section className="mf-panel mf-stack">
        <h3>Agenda</h3>
        <div className="mf-g-3-fixo">
          <Campo label="Primeiro horário"><input className="mf-input" type="time" value={cfg.abertura} onChange={(e) => e.target.value && setCfg("abertura", e.target.value)} /></Campo>
          <Campo label="Duração (min)"><NumInput value={cfg.intervalo} onChange={(v) => setCfg("intervalo", v)} min={10} max={240} inteiro /></Campo>
          <Campo label="Horários por dia"><NumInput value={cfg.qtdHorarios} onChange={(v) => setCfg("qtdHorarios", v)} min={1} max={40} inteiro /></Campo>
        </div>
        <small>Horários: {horas[0]} até {horas[horas.length - 1]} ({horas.length}). Agendamentos que ficarem fora da nova grade continuam aparecendo na agenda, marcados como encaixe.</small>
        <Campo label="Dias de atendimento">
          <div className="mf-chips quebra">
            {ORDEM_DIAS.map((d) => (
              <button key={d} className={"mf-chip" + (cfg.dias.includes(d) ? " on" : "")} onClick={() => {
                const novo = cfg.dias.includes(d) ? cfg.dias.filter((x) => x !== d) : [...cfg.dias, d];
                if (novo.length) setCfg("dias", ordenarDias(novo));
              }}>{DIAS_CURTO[d]}</button>
            ))}
          </div>
        </Campo>
        <Campo label="Avisar vencimento de pacote com quantos dias de antecedência">
          <NumInput style={{ maxWidth: 120 }} value={cfg.alertaDias} onChange={(v) => setCfg("alertaDias", v)} min={0} max={60} inteiro />
        </Campo>
      </section>

      <section className="mf-panel mf-stack">
        <h3><Coffee size={18} style={{ verticalAlign: -3 }} /> Pausas fixas</h3>
        <p className="sub">Horários que se repetem toda semana, como sábado mais curto. Ficam bloqueados na agenda e não aparecem como vagas. O almoço agora é marcado dia a dia, em “opções do dia” na agenda.</p>
        {(cfg.pausas || []).map((p) => {
          const invalida = !p.de || !p.ate || p.ate <= p.de;
          const afetados = horas.filter((h) => h >= p.de && h < p.ate);
          return (
            <div key={p.id} className="mf-pausa-ed">
              <div className="mf-row">
                <TextoBlur className="mf-input" value={p.motivo} onCommit={(v) => setPausa(p.id, { motivo: v })} placeholder="Motivo" aria-label="Motivo da pausa" />
                <label className="mf-toggle" style={{ flex: "none" }}><input type="checkbox" checked={p.ativa !== false} onChange={(e) => setPausa(p.id, { ativa: e.target.checked })} />Ligada</label>
                <button className="mf-iconbtn" aria-label="Excluir pausa" onClick={() => { update((d) => { d.config.pausas = d.config.pausas.filter((x) => x.id !== p.id); return d; }, true); notify("Pausa excluída", true); }}><Trash2 size={18} color="#C8372D" /></button>
              </div>
              <div className="mf-g-2-fixo">
                <Campo label="De"><input className="mf-input" type="time" value={p.de} onChange={(e) => setPausa(p.id, { de: e.target.value })} /></Campo>
                <Campo label="Até (sem incluir)"><input className="mf-input" type="time" value={p.ate} onChange={(e) => setPausa(p.id, { ate: e.target.value })} /></Campo>
              </div>
              <div className="mf-chips quebra">
                {ORDEM_DIAS.filter((d) => cfg.dias.includes(d)).map((d) => (
                  <button key={d} className={"mf-chip" + (p.dias?.includes(d) ? " on" : "")} onClick={() => setPausa(p.id, { dias: p.dias?.includes(d) ? p.dias.filter((x) => x !== d) : ordenarDias([...(p.dias || []), d]) })}>{DIAS_CURTO[d]}</button>
                ))}
              </div>
              {invalida ? <small style={{ color: "var(--poste-tx)" }}>O horário final precisa ser depois do inicial.</small>
                : p.ativa === false ? <small>Desligada: não bloqueia nada.</small>
                : <small>Bloqueia {afetados.length ? afetados.join(", ") : "nenhum horário da grade"}{p.dias?.length ? "" : " (escolha os dias)"}.</small>}
            </div>
          );
        })}
        <button className="mf-btn sm alt" style={{ alignSelf: "flex-start" }} onClick={() => update((d) => { d.config.pausas = [...(d.config.pausas || []), { id: uid(), motivo: "Pausa", dias: [...d.config.dias], de: "12:00", ate: "13:00", ativa: true }]; return d; })}><Plus size={15} />Adicionar pausa</button>
      </section>

      <section className="mf-panel mf-stack">
        <h3><CalendarX size={18} style={{ verticalAlign: -3 }} /> Dias fechados</h3>
        {fechadosFuturos.length === 0 ? <p className="sub">Nenhum feriado ou folga marcado. Para fechar um dia, abra “opções do dia” na agenda.</p> : (
          <div className="mf-list">
            {fechadosFuturos.map((f) => (
              <div key={f.data} className="mf-item">
                <span className="mf-grow"><b>{dataLonga(f.data)}</b><br /><small>{f.motivo || "sem motivo"}</small></span>
                <button className="mf-btn sm alt" onClick={() => { update((d) => { d.fechados = d.fechados.filter((x) => x.data !== f.data); return d; }, true); notify("Dia reaberto", true); }}>Reabrir</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mf-panel mf-stack">
        <h3><Moon size={18} style={{ verticalAlign: -3 }} /> Aparência</h3>
        <div className="mf-seg" role="radiogroup" aria-label="Tema do app">
          {[["auto", "Automático"], ["claro", "Claro"], ["escuro", "Escuro"]].map(([v, label]) => (
            <button key={v} role="radio" aria-checked={(cfg.tema || "auto") === v} className={(cfg.tema || "auto") === v ? "on" : ""} onClick={() => setCfg("tema", v)}>{label}</button>
          ))}
        </div>
        <small>Automático segue o tema do aparelho.</small>
      </section>

      <section className="mf-panel mf-stack">
        <h3>Retorno de clientes</h3>
        <div className="mf-g-2-fixo">
          <Campo label="Retorno padrão (dias)" dica="Para quem veio só uma vez."><NumInput value={cfg.retornoPadrao} onChange={(v) => setCfg("retornoPadrao", v)} min={7} max={180} inteiro /></Campo>
          <Campo label="Tolerância (dias)" dica="Atraso aceito antes de sugerir chamar."><NumInput value={cfg.toleranciaRetorno} onChange={(v) => setCfg("toleranciaRetorno", v)} min={0} max={60} inteiro /></Campo>
        </div>
      </section>

      <section className="mf-panel mf-stack">
        <h3><FlaskConical size={18} style={{ verticalAlign: -3 }} /> Testar aplicativo</h3>
        {emTeste ? (<>
          <p className="sub">Você está no modo teste. Pode marcar, vender e apagar à vontade: nada daqui vai para o uso real, e o que fizer aqui continua guardado para a próxima vez.</p>
          <div className="mf-row mf-wrapr">
            <button className="mf-btn sm" onClick={() => trocarModo("real")}>Voltar ao uso real</button>
            <button className="mf-btn sm alt" onClick={() => ask("Recomeçar o teste com os dados de exemplo? O que foi feito no teste até agora é substituído. O uso real não é tocado.", () => substituir(criarDemo(), "Exemplo recomeçado"))}><RotateCcw size={15} />Recomeçar o exemplo</button>
          </div>
        </>) : (<>
          <p className="sub">Abre um app de mentira, com clientes e horários de exemplo, para aprender a usar sem medo. Seus dados reais ficam guardados do jeito que estão e voltam quando você sair do teste.</p>
          <button className="mf-btn sm alt" style={{ alignSelf: "flex-start" }} onClick={() => trocarModo("teste")}><FlaskConical size={15} />Testar aplicativo</button>
        </>)}
      </section>

      {!emTeste && (
      <section className="mf-panel mf-stack">
        <h3>Dados</h3>
        <p className="sub">
          Os dados ficam guardados só neste aparelho. Baixe um backup de vez em quando e mande para o seu WhatsApp ou Drive.
          {cfg.ultimoBackup ? ` Último backup: ${new Date(cfg.ultimoBackup).toLocaleDateString("pt-BR")}.` : " Nenhum backup feito ainda."}
        </p>
        {persistido !== null && (
          <small style={{ color: persistido ? "var(--ok-tx)" : "var(--latao-tx)" }}>
            <ShieldCheck size={14} style={{ verticalAlign: -2 }} /> {persistido ? "Armazenamento protegido: o navegador não apaga os dados sozinho." : "O navegador pode limpar os dados se faltar espaço. Instalar o app na tela inicial ajuda a proteger."}
          </small>
        )}
        <div className="mf-row mf-wrapr">
          <button className="mf-btn sm" onClick={fazerBackup}><Download size={15} />Fazer backup</button>
          <button className="mf-btn sm alt" onClick={() => arquivo.current?.click()}><Upload size={15} />Restaurar backup</button>
          <input ref={arquivo} type="file" accept="application/json,.json" hidden onChange={importar} />
        </div>
        {copia?.db && (
          <div className="mf-row mf-wrapr">
            <button className="mf-btn sm alt" onClick={() => ask(`Voltar para os dados guardados em ${new Date(copia.salvoEm).toLocaleString("pt-BR")} (${copia.db.clientes?.length || 0} clientes)? Os dados atuais viram a nova cópia.`, () => substituir(migrar(copia.db), "Dados anteriores recuperados"))}>
              <History size={15} />Recuperar dados anteriores
            </button>
            <small>Cópia automática de {new Date(copia.salvoEm).toLocaleString("pt-BR")}</small>
          </div>
        )}
        <div className="mf-sep" />
        <div className="mf-row mf-wrapr">
          <button className="mf-btn sm poste" onClick={() => ask("Apagar clientes, pacotes e agenda? Planos, campanhas e ajustes são mantidos. Uma cópia fica guardada.", () => {
            const v = baseVazia();
            substituir({ ...v, config: { ...db.config, ultimoBackup: db.config.ultimoBackup }, servicos: db.servicos, planos: db.planos, campanhas: db.campanhas }, "Dados apagados");
          })}><Trash2 size={15} />Começar do zero</button>
        </div>
      </section>
      )}
      <p className="sub" style={{ textAlign: "center" }}>Mats Flex · versão 2</p>
    </div>
  );
}
