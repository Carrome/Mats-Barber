/* =====================================================================
   Vagas (Mats Flex): ofertar horários livres e divulgar
   ===================================================================== */
import React, { useEffect, useMemo, useState } from "react";
import { Copy, Image as ImageIcon, Megaphone, MessageCircle, Share2, X, Download } from "lucide-react";
import { addDays, brl, dataLonga, DIAS_LONGO, ddmm, entregarArquivo, hojeYmd, momento, parse, plural, uid, whats, ymd, fimMesYmd } from "../util.js";
import { campanhaDe, campanhaVale, cheioDe, idsServicos, montarOferta, nomeServicos, primeiroCoberto, rotuloDesconto, totalOferta, vagasLivres } from "../regras.js";
import { Campo, Seg, SeletorServicos, Sheet, useAgora } from "../componentes.jsx";

export function Vagas({ db, update, notify }) {
  const agora = useAgora();
  const hoje = hojeYmd();
  const fimMes = fimMesYmd(new Date());
  const [periodo, setPeriodo] = useState("semana");
  const ate = periodo === "hoje" ? hoje : periodo === "semana" ? ymd(addDays(new Date(), 6)) : periodo === "mes" ? fimMes : ymd(addDays(new Date(), 30));
  const campanhas = db.campanhas.filter((c) => c.tipo === "vaga" && campanhaVale(c, hoje));
  const [campId, setCampId] = useState(campanhas[0]?.id || "");
  const [ids, setIds] = useState([]);
  const [msg, setMsg] = useState(null);
  const [story, setStory] = useState(null);
  const camp = campanhas.find((c) => c.id === campId) || campanhas[0];
  // serviços da próxima oferta; se a campanha não cobre nenhum deles, começa pelo primeiro que ela cobre
  const padrao = camp ? primeiroCoberto(db, camp) : undefined;
  const idsOferta = camp && montarOferta(db, camp, ids) ? ids : padrao ? [padrao] : [];
  const oferta = camp ? montarOferta(db, camp, idsOferta) : null;

  const livres = useMemo(() => vagasLivres(db, hoje, ate, agora), [db, hoje, ate, agora]);
  const porDia = livres.reduce((m, v) => { (m[v.data] = m[v.data] || []).push(v.hora); return m; }, {});
  const ofertadas = db.agendamentos.filter((a) => a.tipo === "oferta" && momento(a.data, a.hora) > agora && a.data <= ate)
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const ofPorDia = ofertadas.reduce((m, a) => { (m[a.data] = m[a.data] || []).push(a); return m; }, {});

  const ofertar = (lista) => {
    if (!oferta) return;
    let n = 0;
    update((d) => {
      lista.forEach(({ data, hora }) => {
        if (!d.agendamentos.some((a) => a.data === data && a.hora === hora)) {
          d.agendamentos.push({
            id: uid(), data, hora, tipo: "oferta", campanhaId: camp.id, servicoId: oferta.servicoId, valor: oferta.valor,
            adicionais: oferta.adicionais.map((x) => ({ ...x })), status: "agendado", pagamento: "", obs: "", criadoEm: new Date().toISOString(),
          });
          n++;
        }
      });
      return d;
    });
    notify(lista.length > 1 ? `${lista.length} vagas ofertadas` : "Vaga ofertada");
  };

  const mensagem = (data, lista) => {
    const nomesC = [...new Set(lista.map((a) => campanhaDe(db, a.campanhaId)?.nome).filter(Boolean))].join(" / ");
    const linhas = lista.map((a) => {
      const cheio = cheioDe(db, a), total = totalOferta(a);
      return `• ${a.hora} – ${nomeServicos(db, a)}${cheio > total ? ` de ~${brl(cheio)}~` : ""} por *${brl(total)}*`;
    }).join("\n");
    const quando = data === hoje ? "Hoje" : data === ymd(addDays(new Date(), 1)) ? "Amanhã" : dataLonga(data);
    return `✂️ *${nomesC || "Horário com desconto"}* – ${db.config.nome}\n${quando} (${ddmm(data)}) tenho horário com preço especial:\n${linhas}\n\nResponda esta mensagem para garantir o seu. Vale só para esses horários!`;
  };
  const copiar = async (texto) => {
    try { await navigator.clipboard.writeText(texto); notify("Mensagem copiada"); }
    catch (e) { setMsg(texto); }
  };

  return (
    <div className="mf-wrap mf-stack" style={{ gap: 16 }}>
      <div className="mf-head">
        <div>
          <h1>Vagas para vender</h1>
          <p className="sub">Horários livres da agenda a partir de agora. Oferte com desconto e divulgue no WhatsApp e nos stories.</p>
        </div>
        <Seg valor={periodo} onChange={setPeriodo} opcoes={[["hoje", "Hoje"], ["semana", "7 dias"], ["mes", "Até fim do mês"], ["30", "30 dias"]]} />
      </div>

      <section className="mf-panel mf-grid mf-g3" style={{ alignItems: "end" }}>
        <Campo label="Campanha">
          {campanhas.length === 0 ? <small>Nenhuma campanha de horário vago ativa. Crie uma em Planos &gt; Campanhas.</small> : (
            <select className="mf-input" value={camp?.id} onChange={(e) => setCampId(e.target.value)}>
              {campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome} ({rotuloDesconto(c, db)})</option>)}
            </select>
          )}
        </Campo>
        <Campo label="Serviços da oferta">
          {camp ? <SeletorServicos db={db} camp={camp} ids={idsOferta} onChange={setIds} mostrarPreco={false} /> : <small>Escolha uma campanha.</small>}
        </Campo>
        {oferta && (
          <div className="mf-row" style={{ gap: 14 }}>
            {oferta.cheio > oferta.total && <span className="mf-strike">{brl(oferta.cheio)}</span>}
            <span className="mf-price" style={{ color: "var(--poste-tx)" }}>{brl(oferta.total)}</span>
          </div>
        )}
      </section>

      {ofertadas.length > 0 && (
        <section className="mf-panel">
          <h3 style={{ marginBottom: 10 }}>Em oferta ({ofertadas.length})</h3>
          <div className="mf-stack">
            {Object.entries(ofPorDia).map(([data, lista]) => {
              const texto = mensagem(data, lista);
              return (
                <div key={data}>
                  <div className="mf-row mf-between mf-wrapr" style={{ marginBottom: 6, rowGap: 6 }}>
                    <b>{dataLonga(data)}</b>
                    <div className="mf-row mf-wrapr" style={{ gap: 6 }}>
                      <button className="mf-btn sm alt" onClick={() => setStory({ data })}><ImageIcon size={14} />Stories</button>
                      <button className="mf-btn sm alt" onClick={() => copiar(texto)}><Copy size={14} />Copiar</button>
                      <a className="mf-btn sm" href={whats("", texto)} target="_blank" rel="noreferrer"><MessageCircle size={14} />WhatsApp</a>
                    </div>
                  </div>
                  <div className="mf-row mf-wrapr" style={{ gap: 6 }}>
                    {lista.map((a) => (
                      <span key={a.id} className="mf-slotpill of" title={nomeServicos(db, a)}>{a.hora} <small>{brl(totalOferta(a))}</small>
                        <button className="mf-iconbtn" style={{ padding: 3 }} aria-label={`Retirar oferta das ${a.hora}`} onClick={() => {
                          update((dd) => { dd.agendamentos = dd.agendamentos.filter((x) => x.id !== a.id); return dd; }, true);
                          notify("Oferta retirada", true);
                        }}><X size={14} /></button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mf-panel">
        <h3 style={{ marginBottom: 10 }}>Livres ({livres.length})</h3>
        {livres.length === 0 ? (
          <div className="mf-empty"><h3>Agenda cheia</h3><p>Não há horário livre neste período.</p></div>
        ) : (
          <div className="mf-stack">
            {Object.entries(porDia).map(([data, horasD]) => (
              <div key={data}>
                <div className="mf-row mf-between" style={{ marginBottom: 6 }}>
                  <b>{dataLonga(data)} <small>({horasD.length})</small></b>
                  <button className="mf-btn sm poste" disabled={!oferta} onClick={() => ofertar(horasD.map((hora) => ({ data, hora })))}>
                    <Megaphone size={14} />Ofertar todas
                  </button>
                </div>
                <div className="mf-row mf-wrapr" style={{ gap: 6 }}>
                  {horasD.map((hora) => (
                    <span key={hora} className="mf-slotpill">{hora}
                      <button className="mf-btn sm alt" style={{ padding: "3px 10px" }} disabled={!oferta} onClick={() => ofertar([{ data, hora }])}>Ofertar</button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {msg && (
        <Sheet titulo="Mensagem para divulgar" sub="Seu navegador bloqueou a cópia automática. Selecione e copie o texto." onClose={() => setMsg(null)}>
          <div className="mf-msg" style={{ userSelect: "text" }}>{msg}</div>
        </Sheet>
      )}
      {/* a lista vem viva do db: trocar os serviços nos stories aparece na hora */}
      {story && <StorySheet db={db} update={update} notify={notify} data={story.data} lista={ofPorDia[story.data] || []} onClose={() => setStory(null)} />}
    </div>
  );
}

/* ---------------------------------------------------------------------
   Imagem 1080x1920 para stories do Instagram/WhatsApp
   --------------------------------------------------------------------- */
// Resolve com a imagem carregada, ou null se falhar (a arte sai sem ela)
const carregarImagem = (src) => new Promise((ok) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => ok(null);
  img.src = src;
});

// mais que isso os cartões ficam pequenos demais para ler no celular
export const MAX_STORY = 6;

// onde a imagem vai ser postada, e a chamada do rodapé em cada lugar
const REDES = [["whatsapp", "WhatsApp"], ["instagram", "Instagram"]];
const CHAMADA = { whatsapp: "ME CHAMA NO WHATSAPP", instagram: "ME CHAMA NO DIRECT" };

// `todos` são as ofertas do dia inteiro: o título sai delas, então não muda com a escolha
export async function desenharStory(db, data, lista, todos = lista, rede = "whatsapp") {
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const DISPLAY = "'Big Shoulders Display', 'Arial Narrow', Impact, sans-serif";
  const TEXTO = "Archivo, Arial, sans-serif";
  try {
    await Promise.all([document.fonts?.load(`800 120px 'Big Shoulders Display'`), document.fonts?.load(`600 40px Archivo`), document.fonts?.load(`700 40px Archivo`)]);
  } catch (e) { /* segue com fonte padrão */ }

  // fundo
  g.fillStyle = "#000000"; g.fillRect(0, 0, W, H);
  // logo da barbearia de fundo, o maior possível sem cortar (largura inteira) e suave para não atrapalhar a leitura
  const logo = await carregarImagem("icons/logo-grande.png");
  if (logo) {
    const lw = W, lh = Math.round((lw * logo.naturalHeight) / logo.naturalWidth);
    g.save(); g.globalAlpha = 0.16; g.drawImage(logo, 0, Math.round((H - lh) / 2), lw, lh); g.restore();
  }
  // listras diagonais do poste de barbeiro (tema Flex) dentro da área já recortada
  const CORES_POSTE = ["#C8372D", "#FFFFFF", "#2A4E8A", "#FFFFFF"];
  const listras = (x, y, w, h) => {
    for (let px = x - h * 2, i = 0; px < x + w + h * 2; px += 36, i++) {
      g.fillStyle = CORES_POSTE[i % 4];
      g.beginPath(); g.moveTo(px, y + h); g.lineTo(px + 36, y + h); g.lineTo(px + 36 + h, y); g.lineTo(px + h, y); g.closePath(); g.fill();
    }
  };
  const arredondado = (x, y, w, h, r) => {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  };
  const faixa = (y, h) => { g.save(); g.beginPath(); g.rect(0, y, W, h); g.clip(); listras(0, y, W, h); g.restore(); };
  faixa(0, 70); faixa(H - 70, 70);

  // centraliza e diminui a fonte até caber na largura
  const centro = (txt, y, font, cor) => {
    let tam = Number((/(\d+)px/.exec(font) || [])[1]) || 40;
    g.font = font;
    while (g.measureText(txt).width > W - 120 && tam > 20) { tam -= 4; g.font = font.replace(/\d+px/, `${tam}px`); }
    g.fillStyle = cor; g.textAlign = "center"; g.fillText(txt, W / 2, y);
  };
  const camps = [...new Set(todos.map((a) => campanhaDe(db, a.campanhaId)?.nome).filter(Boolean))];
  centro((db.config.nome || "").toUpperCase(), 190, `600 44px ${TEXTO}`, "#F3E8CD");
  centro((camps[0] || "HORÁRIO COM DESCONTO").toUpperCase(), 330, `800 150px ${DISPLAY}`, "#FFFFFF");
  const hoje = hojeYmd();
  const quando = data === hoje ? "HOJE" : data === ymd(addDays(new Date(), 1)) ? "AMANHÃ" : DIAS_LONGO[parse(data).getDay()].toUpperCase();
  centro(`${quando} · ${ddmm(data)}`, 440, `700 84px ${DISPLAY}`, "#FFF406");

  const itens = lista.slice(0, MAX_STORY);
  const alt = itens.length > 4 ? 150 : 190, gap = 26;
  const bloco = itens.length * alt + (itens.length - 1) * gap;
  const topo = Math.max(520, Math.round(520 + (H - 360 - 520 - bloco) / 2));
  // nome do serviço: negrito, centralizado no espaço livre entre o horário e o preço.
  // Nome comprido quebra em duas linhas antes de a letra diminuir.
  const nomeNoCartao = (txt, esq, dir, meio) => {
    const cabe = dir - esq;
    let tam = alt * 0.32;
    const fonte = () => { g.font = `700 ${tam}px ${TEXTO}`; };
    const larg = (linhas) => Math.max(...linhas.map((l) => g.measureText(l).width));
    fonte();
    let linhas = [txt];
    const palavras = txt.split(" ");
    // quebras possíveis: em qualquer espaço, menos logo depois de um "+" (em "Cabelo + Barba",
    // o "+" desce junto com a Barba)
    const quebras = palavras.slice(1).map((_, i) => [palavras.slice(0, i + 1).join(" "), palavras.slice(i + 1).join(" ")])
      .filter(([primeira]) => !primeira.endsWith("+"));
    if (larg(linhas) > cabe && quebras.length) {
      // a que deixa a linha mais larga o mais curta possível
      linhas = quebras.reduce((melhor, l) => (larg(l) < larg(melhor) ? l : melhor));
    }
    while (larg(linhas) > cabe && tam > alt * 0.18) { tam -= 2; fonte(); }
    const entre = tam * 1.05;
    g.fillStyle = "#1C1C1C"; g.textAlign = "center";
    linhas.forEach((l, i) => g.fillText(l, (esq + dir) / 2, meio + (i - (linhas.length - 1) / 2) * entre + tam * 0.36));
  };
  itens.forEach((a, i) => {
    const y = topo + i * (alt + gap);
    const total = totalOferta(a), cheio = cheioDe(db, a);
    const r = 28, x = 90, w = W - 180, borda = 12;
    // borda listrada do Flex e miolo branco por cima
    g.save(); arredondado(x, y, w, alt, r); g.clip(); listras(x, y, w, alt); g.restore();
    g.fillStyle = "#FFFFFF"; arredondado(x + borda, y + borda, w - borda * 2, alt - borda * 2, r - borda / 2); g.fill();
    g.textAlign = "left"; g.fillStyle = "#000000"; g.font = `800 ${alt * 0.56}px ${DISPLAY}`;
    g.fillText(a.hora, x + 40, y + alt * 0.68);
    const fimHora = x + 40 + g.measureText(a.hora).width;
    // o preço (e o antigo riscado, quando há) ocupa a direita: mede antes para o nome caber no meio
    const antigo = cheio > total ? brl(cheio) : "";
    g.font = `800 ${alt * 0.4}px ${DISPLAY}`;
    let larguraPreco = g.measureText(brl(total)).width;
    if (antigo) { g.font = `500 ${alt * 0.22}px ${TEXTO}`; larguraPreco = Math.max(larguraPreco, g.measureText(antigo).width); }
    nomeNoCartao(nomeServicos(db, a), fimHora + 24, x + w - 40 - larguraPreco - 24, y + alt / 2);
    g.textAlign = "right";
    if (antigo) {
      g.fillStyle = "#6B6B6B"; g.font = `500 ${alt * 0.22}px ${TEXTO}`;
      g.fillText(antigo, x + w - 40, y + alt * 0.34);
      const tw = g.measureText(antigo).width;
      g.fillRect(x + w - 40 - tw, y + alt * 0.34 - alt * 0.075, tw, 4);
    }
    g.fillStyle = "#141414"; g.font = `800 ${alt * 0.4}px ${DISPLAY}`;
    g.fillText(brl(total), x + w - 40, y + alt * 0.8);
  });

  centro(CHAMADA[rede] || CHAMADA.whatsapp, H - 250, `800 96px ${DISPLAY}`, "#FFFFFF");
  centro("e garanta o seu antes que acabe", H - 180, `500 44px ${TEXTO}`, "#F3E8CD");

  return new Promise((ok) => cv.toBlob((b) => ok(b), "image/png"));
}

export function StorySheet({ db, update, notify, data, lista, onClose }) {
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState("");
  // começa sem nenhum: ele marca um por um os que quer na imagem, até o limite
  const [ids, setIds] = useState([]);
  const [rede, setRede] = useState("whatsapp");
  const escolhidos = useMemo(() => lista.filter((a) => ids.includes(a.id)), [lista, ids]);
  const cheio = ids.length >= MAX_STORY;
  const alternar = (id) => setIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : xs.length >= MAX_STORY ? xs : [...xs, id]));
  // trocar os serviços de um horário muda a oferta de verdade: story, agenda e mensagem ficam iguais
  const trocarServicos = (a, camp, novos) => {
    const o = montarOferta(db, camp, novos);
    if (!o) return;
    update((d) => {
      const x = d.agendamentos.find((y) => y.id === a.id);
      if (x) Object.assign(x, { servicoId: o.servicoId, valor: o.valor, adicionais: o.adicionais.map((v) => ({ ...v })) });
      return d;
    });
  };
  useEffect(() => {
    let vivo = true, u = "";
    desenharStory(db, data, escolhidos, lista, rede).then((b) => {
      if (!vivo || !b) return;
      u = URL.createObjectURL(b);
      setBlob(b); setUrl(u);
    });
    return () => { vivo = false; if (u) URL.revokeObjectURL(u); };
  }, [db, data, escolhidos, rede]);
  const nome = `vagas-${data}${escolhidos[0] ? "-" + escolhidos[0].hora.replace(":", "h") : ""}.png`;
  return (
    <Sheet titulo="Imagem para stories" sub={`${plural(escolhidos.length, "horário", "horários")} de ${dataLonga(data).toLowerCase()}`} onClose={onClose}>
      <div className="mf-stack">
        <Seg opcoes={REDES} valor={rede} onChange={setRede} rotulo="Onde vai postar" />
        {lista.length > 0 && (
          <div>
            <small className="mf-muted">Escolha os horários da imagem ({escolhidos.length} de até {MAX_STORY})</small>
            <div className="mf-chips quebra" style={{ marginTop: 6 }}>
              {lista.map((a) => {
                const on = ids.includes(a.id);
                return (
                  <button key={a.id} type="button" className={"mf-chip" + (on ? " on" : "")} aria-pressed={on} disabled={!on && cheio} onClick={() => alternar(a.id)}>
                    {a.hora}
                  </button>
                );
              })}
            </div>
            {cheio && lista.length > MAX_STORY && <small className="mf-muted">Até {MAX_STORY} por imagem, para ficar legível. Tire um para trocar, ou faça outra imagem com os demais.</small>}
          </div>
        )}
        {escolhidos.length > 0 && (
          <div className="mf-stack" style={{ gap: 10 }}>
            <small className="mf-muted">Serviços de cada horário</small>
            {escolhidos.map((a) => {
              const camp = campanhaDe(db, a.campanhaId);
              return (
                <div key={a.id} className="mf-row" style={{ alignItems: "flex-start", gap: 10 }}>
                  <b style={{ minWidth: 46, paddingTop: 6 }}>{a.hora}</b>
                  <div className="mf-grow">
                    {camp
                      ? <SeletorServicos db={db} camp={camp} ids={idsServicos(a)} onChange={(novos) => trocarServicos(a, camp, novos)} rotulo={`Serviços das ${a.hora}`} />
                      : <small>{nomeServicos(db, a)}</small>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {url ?<img className="mf-img" src={url} alt="Prévia da imagem para stories" /> : <p className="sub" style={{ textAlign: "center" }}>Gerando imagem…</p>}
        <div className="mf-row">
          <button className="mf-btn mf-grow" disabled={!blob} onClick={async () => {
            const r = await entregarArquivo(nome, blob, "Vagas com desconto");
            if (r === "baixado") notify("Imagem salva");
            if (r === "erro") notify("Não foi possível salvar. Segure a imagem e salve.");
          }}><Share2 size={16} />Compartilhar / salvar</button>
        </div>
        <small className="mf-muted" style={{ textAlign: "center" }}>No celular, escolha Instagram ou WhatsApp. Se não abrir, segure a imagem e salve na galeria.</small>
      </div>
    </Sheet>
  );
}
