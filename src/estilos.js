/* Estilos do app (tema: preto e amarelo da logo Matheu's Barber, latão e poste de barbeiro) */
// Cores do modo escuro (usadas no automático e no forçado)
const ESCURO = "color-scheme:dark;--toalha:#161616;--papel:#212121;--tinta:#EDEDED;--cinza:#A1A1A1;--linha:#363636;--realce:#282828;--trilha:#2F2F2F;" +
  "--enfase:#EDEDED;--enfase-tx:#161616;--enfase-link:#7A5710;" +
  "--btn-bg:#FFF406;--btn-tx:#000000;--btn-hover:#E0D600;--sel-borda:#FFF406;--sel-bg:#2E2C0A;" +
  "--acento:#FFF406;--ok-tx:#86D7A6;--poste-tx:#F4A89F;--azul-tx:#A8C3F2;--latao-tx:#E6C170;--grafico-servicos:#FFF406;" +
  "--ok-c:#1D3328;--poste-c:#3B2320;--azul-c:#1D2A40;--latao-c:#3A301A;" +
  "--ok-b:#2F5A43;--poste-b:#6A3A34;--azul-b:#34496E;--latao-b:#6A5630;";

export const CSS = `
.mf{color-scheme:light;--marca:#000000;--amarelo:#FFF406;--amarelo-tx:#000000;--toalha:#F4F4F4;--papel:#FFFFFF;--tinta:#1C1C1C;--cinza:#6B6B6B;--linha:#DBDBDB;
--latao:#B8892B;--latao-c:#F3E8CD;--poste:#C8372D;--poste-c:#F9E0DC;--azul:#2A4E8A;--azul-c:#E0E8F5;--ok:#2F7A4F;--ok-c:#DDEFE3;
--realce:#FAFAFA;--trilha:#E8E8E8;--enfase:#1C1C1C;--enfase-tx:#fff;--enfase-link:#FFF406;
--acento:#000000;--ok-tx:#276842;--poste-tx:#A92D24;--azul-tx:#2A4E8A;--latao-tx:#7A5710;--grafico-servicos:#1A1A1A;
--ok-b:#BFDCC9;--poste-b:#EFC1BA;--azul-b:#C3D2EA;--latao-b:#E6D3A5;
--btn-bg:#000000;--btn-tx:#FFFFFF;--btn-hover:#262626;--sel-borda:#000000;--sel-bg:#FFFBC2;
font-family:'Archivo',system-ui,-apple-system,sans-serif;color:var(--tinta);background:var(--toalha);min-height:100vh;display:flex;font-size:15px;line-height:1.45}
.mf *{box-sizing:border-box}
@media (prefers-color-scheme:dark){
  .mf:not([data-tema="claro"]){${ESCURO}}
}
.mf[data-tema="escuro"]{${ESCURO}}
.mf button{font:inherit;color:inherit;cursor:pointer}
.mf :focus-visible{outline:3px solid var(--latao);outline-offset:2px}
.mf h1,.mf h2,.mf h3,.mf .dsp{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;letter-spacing:.01em;margin:0;line-height:1.05}
.mf h1{font-size:34px;font-weight:800}
.mf h2{font-size:24px;font-weight:700}
.mf h3{font-size:19px;font-weight:700}
.mf p{margin:0}
.mf small,.mf .sub{color:var(--cinza);font-size:13px}

/* navegação */
.mf-rail{display:none}
.mf-main{flex:1;min-width:0;padding:0 0 96px}
.mf-top{position:sticky;top:0;z-index:20;background:var(--marca);color:#fff;display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top)) 12px 10px 16px}
.mf-top .nome{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-weight:800;font-size:22px;line-height:1}
.mf-top .loja{font-size:12px;opacity:.75}
.mf-top .sp{flex:1}
.mf-iconbtn{background:transparent;border:0;padding:8px;border-radius:10px;display:inline-flex}
.mf-top .mf-iconbtn{color:#fff}
.mf-iconbtn:hover{background:rgba(0,0,0,.06)}
.mf-top .mf-iconbtn:hover{background:rgba(255,255,255,.12)}
@media (prefers-reduced-motion:reduce){.mf-sheet{animation:none!important}}
.mf-logo{display:block;flex:none;height:40px;width:auto}
.mf-rail .mf-logo{height:56px}
.mf-loading .mf-logo{height:150px}
.mf-bottom{position:fixed;left:0;right:0;bottom:0;z-index:30;background:var(--papel);border-top:1px solid var(--linha);display:flex;padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
.mf-bottom button{flex:1;background:none;border:0;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;color:var(--cinza);padding:6px 0;border-radius:10px}
.mf-bottom button.on{color:var(--acento);font-weight:700}
.mf-bottom button.on svg{stroke-width:2.5}
.mf-wrap{max-width:1140px;margin:0 auto;padding:18px 16px}
@media (min-width:900px){
  .mf-rail{display:flex;flex-direction:column;gap:4px;width:230px;flex:none;background:var(--marca);color:#fff;padding:22px 14px;position:sticky;top:0;height:100vh}
  .mf-rail .marca{display:flex;gap:12px;align-items:center;padding:0 8px 22px}
  .mf-rail .nome{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-weight:800;font-size:26px;line-height:1}
  .mf-rail .loja{font-size:12px;opacity:.7}
  .mf-rail button{display:flex;align-items:center;gap:12px;background:none;border:0;color:#fff;opacity:.78;padding:11px 12px;border-radius:10px;text-align:left;font-size:15px}
  .mf-rail button:hover{background:#1F1F1F;opacity:1}
  .mf-rail button.on{background:var(--amarelo);color:var(--amarelo-tx);opacity:1;font-weight:700}
  .mf-rail .fim{margin-top:auto}
  .mf-top,.mf-bottom{display:none}
  .mf-main{padding-bottom:0}
  .mf-wrap{padding:30px 32px}
}

/* blocos */
.mf-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}
.mf-panel{background:var(--papel);border:1px solid var(--linha);border-radius:16px;padding:18px}
.mf-grid{display:grid;gap:14px}
@media (min-width:760px){.mf-g2{grid-template-columns:1fr 1fr}.mf-g3{grid-template-columns:repeat(3,1fr)}}
.mf-row{display:flex;align-items:center;gap:10px}
.mf-wrapr{flex-wrap:wrap}
.mf-between{justify-content:space-between}
.mf-stack{display:flex;flex-direction:column;gap:12px}
.mf-sep{height:1px;background:var(--linha);margin:14px 0}
.mf-muted{color:var(--cinza)}

/* botões */
.mf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:999px;border:1.5px solid var(--btn-bg);background:var(--btn-bg);color:var(--btn-tx)!important;padding:10px 18px;font-weight:600;white-space:nowrap}
.mf-btn:hover{background:var(--btn-hover)}
.mf-btn.alt{background:transparent;color:var(--acento)!important}
.mf-btn.alt:hover{background:var(--sel-bg)}
.mf-btn.poste,.mf-btn.poste:hover{background:var(--poste);border-color:var(--poste);color:#fff!important}
.mf-btn.latao,.mf-btn.latao:hover{background:var(--latao);border-color:var(--latao);color:#fff!important}
.mf-btn.sm{padding:6px 12px;font-size:13px}
.mf-btn.full{width:100%}
.mf-btn:disabled{opacity:.45;cursor:not-allowed}
.mf-link{background:none;border:0;color:var(--acento);font-weight:600;padding:4px;text-decoration:underline;text-underline-offset:3px}
.mf-link.perigo{color:var(--poste-tx)}

/* formulários */
.mf-field{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:600}
.mf-input{width:100%;font:inherit;font-size:16px;font-weight:400;padding:10px 12px;border:1.5px solid var(--linha);border-radius:10px;background:var(--papel);color:var(--tinta)}
.mf-input:focus{border-color:var(--acento);outline:none}
.mf-seg{display:flex;background:var(--trilha);border-radius:999px;padding:3px;gap:2px;overflow-x:auto}
.mf-seg button{flex:1;border:0;background:transparent;border-radius:999px;padding:8px 12px;font-size:14px;white-space:nowrap;color:inherit}
.mf-seg button.on{background:var(--papel);font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.15)}
.mf-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
.mf-chip{border:1.5px solid var(--linha);background:var(--papel);border-radius:999px;padding:6px 12px;font-size:13px;white-space:nowrap;color:inherit}
.mf-chip.on{background:var(--enfase);border-color:var(--enfase);color:var(--enfase-tx)}
.mf-toggle{display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer}
.mf-toggle input{width:18px;height:18px;accent-color:var(--acento)}

/* etiquetas */
.mf-tag{display:inline-flex;align-items:center;gap:4px;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:600;white-space:nowrap}
.mf-tag.ok{background:var(--ok-c);color:var(--ok-tx)}
.mf-tag.alerta{background:var(--latao-c);color:var(--latao-tx)}
.mf-tag.erro{background:var(--poste-c);color:var(--poste-tx)}
.mf-tag.neutro{background:var(--trilha);color:var(--cinza)}
.mf-tag.azul{background:var(--azul-c);color:var(--azul-tx)}

/* painel */
.mf-hero{background:var(--marca);color:#fff;border-radius:18px;padding:22px;position:relative;overflow:hidden}
.mf-hero .valor{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-weight:800;font-size:clamp(40px,11vw,64px);overflow-wrap:anywhere;line-height:.95;margin:6px 0 4px}
.mf-hero .barra{height:10px;border-radius:5px;background:rgba(255,255,255,.18);overflow:hidden;margin:14px 0 6px}
.mf-hero .barra i{display:block;height:100%;background:repeating-linear-gradient(-45deg,var(--poste) 0 6px,#fff 6px 11px,var(--azul) 11px 17px,#fff 17px 22px)}
.mf-hero .fontes{display:flex;gap:18px;flex-wrap:wrap;margin-top:14px;font-size:14px}
.mf-dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.mf-ledger{display:flex;flex-direction:column}
.mf-ledger>div{display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;border-bottom:1px dashed var(--linha);gap:10px}
.mf-ledger>div:last-child{border-bottom:0}
.mf-ledger b{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-size:22px;font-weight:700}

/* agenda */
.mf-weekbar{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.mf-week{border:1.5px solid var(--linha);background:var(--papel);color:inherit;border-radius:12px;padding:8px 12px;text-align:left;min-width:112px}
.mf-week b{display:block;font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-size:18px}
.mf-week small{font-size:12px}
.mf-week.on{border-color:var(--sel-borda);background:var(--amarelo);color:var(--amarelo-tx)}
.mf-week.on small{color:var(--amarelo-tx);opacity:.75}
.mf-days{display:grid;gap:6px}
.mf-day{background:var(--papel);color:inherit;border-radius:12px;padding:8px 2px;display:flex;flex-direction:column;align-items:center;border:1.5px solid transparent}
.mf-day b{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-size:22px;line-height:1}
.mf-day small{font-size:11px}
.mf-day.on{border-color:var(--sel-borda);background:var(--sel-bg)}
.mf-day.fora{opacity:.45}
.mf-day.hoje b{color:var(--poste-tx)}
.mf-agenda{display:grid;gap:8px}
.mf-col{display:flex;flex-direction:column;gap:5px;min-width:0}
.mf-colhead{padding:6px 4px 8px;border-bottom:2px solid var(--tinta);margin-bottom:4px;display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:0 8px}
.mf-colhead b{white-space:nowrap}
.mf-colhead b{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-size:20px}
.mf-colhead.hoje{border-color:var(--poste)}
.mf-colhead.fora{opacity:.45}
.mf-slot{position:relative;display:grid;grid-template-columns:46px 1fr;grid-template-rows:auto auto;align-items:center;column-gap:8px;text-align:left;min-height:46px;padding:6px 10px;border-radius:8px;border:1.5px solid var(--linha);background:var(--papel);color:inherit;width:100%}
.mf-slot .h{grid-row:1/3;font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-size:17px;font-weight:700;color:var(--cinza)}
.mf-slot .t{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mf-slot .s{font-size:12px;color:var(--cinza);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mf-slot .ic{position:absolute;right:8px;top:8px;color:var(--ok-tx)}
.mf-slot.livre{border-style:dashed;background:transparent}
.mf-slot.livre .t{color:var(--cinza);font-weight:400}
.mf-slot.livre:hover{background:var(--papel);border-color:var(--acento)}
.mf-slot.passado{opacity:.4}
.mf-slot.avulso{border-left:5px solid var(--acento)}
.mf-slot.pacote{background:var(--azul-c);border-color:var(--azul-b);border-left:5px solid var(--azul)}
.mf-slot.campanha{background:var(--latao-c);border-color:var(--latao-b);border-left:5px solid var(--latao)}
.mf-slot.bloqueio,.mf-slot.pausa{background:repeating-linear-gradient(45deg,var(--trilha) 0 6px,var(--realce) 6px 12px);border-color:var(--linha)}
.mf-slot.bloqueio .t,.mf-slot.pausa .t{color:var(--cinza)}
.mf-slot.oferta{border:0;background:repeating-linear-gradient(-45deg,var(--poste) 0 9px,var(--papel) 9px 16px,var(--azul) 16px 25px,var(--papel) 25px 32px)}
.mf-slot.oferta .h,.mf-slot.oferta .t,.mf-slot.oferta .s{background:var(--papel);border-radius:5px;padding:0 6px;justify-self:start;max-width:100%}
.mf-slot.oferta .h{color:var(--poste-tx);justify-self:stretch;text-align:center;padding:2px 0}
.mf-slot.oferta.encerrada{opacity:.4;filter:grayscale(1)}
.mf-slot.faltou .t{text-decoration:line-through;color:var(--poste-tx)}
.mf-slot.feito{opacity:.8;padding-right:26px}
.mf-legenda{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--cinza)}
.mf-legenda span{display:inline-flex;align-items:center;gap:6px}
.mf-legenda i{width:16px;height:12px;border-radius:3px;display:inline-block;border:1px solid var(--linha)}

/* listas */
.mf-list{display:flex;flex-direction:column}
.mf-item{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--linha);background:none;border-left:0;border-right:0;border-top:0;text-align:left;width:100%}
.mf-item:last-child{border-bottom:0}
.mf-item:hover{background:var(--realce)}
.mf-avatar{width:40px;height:40px;border-radius:50%;background:var(--marca);color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-weight:700;font-size:18px;flex:none}
.mf-grow{flex:1;min-width:0}
.mf-ellip{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mf-saldo{display:flex;gap:3px;margin-top:4px}
.mf-saldo i{width:16px;height:8px;border-radius:2px;background:var(--trilha)}
.mf-saldo i.u{background:var(--tinta)}
.mf-saldo i.r{background:var(--azul)}
.mf-code{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-weight:800;font-size:20px;color:var(--azul-tx)}
.mf-price{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-weight:800;font-size:34px;line-height:1}
.mf-strike{text-decoration:line-through;color:var(--cinza)}
.mf-slotpill{border:1.5px dashed var(--linha);background:var(--papel);color:inherit;border-radius:999px;padding:6px 6px 6px 12px;display:inline-flex;align-items:center;gap:8px;font-weight:600}
.mf-slotpill.of{border:1.5px solid var(--poste);background:var(--poste-c)}
.mf-empty{text-align:center;padding:30px 12px;color:var(--cinza)}
.mf-empty h3{color:var(--tinta);margin-bottom:6px}
.mf a.mf-btn,.mf a.mf-iconbtn{text-decoration:none}
.mf-banner .mf-grow{flex:1 1 220px}
.mf-banner{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--latao-c);border:1px solid var(--latao-b);border-radius:12px;padding:10px 14px;margin-bottom:16px;font-size:14px}

/* modal */
.mf-over{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:50;display:flex;align-items:flex-end;justify-content:center}
.mf-sheet{background:var(--toalha);width:100%;max-width:560px;max-height:92vh;max-height:92dvh;overscroll-behavior:contain;overflow:auto;border-radius:20px 20px 0 0;padding:18px 18px calc(22px + env(safe-area-inset-bottom));animation:mfup .22s ease-out}
@keyframes mfup{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}
@media (min-width:900px){.mf-over{align-items:center}.mf-sheet{border-radius:20px}}
.mf-sheethead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:14px}
.mf-picked{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--papel);border:1.5px solid var(--sel-borda);border-radius:12px;padding:10px 12px}
.mf-picked small{display:block}
.mf-opts{display:flex;flex-direction:column;gap:6px;max-height:230px;overflow:auto}
.mf-opt{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--papel);color:inherit;border:1.5px solid var(--linha);border-radius:10px;padding:9px 12px;text-align:left}
.mf-opt.on{border-color:var(--sel-borda);background:var(--sel-bg)}
.mf-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:60;background:var(--enfase);color:var(--enfase-tx);padding:8px 8px 8px 16px;border-radius:999px;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.2);max-width:92vw;display:flex;align-items:center;gap:10px;min-height:40px}
@media (min-width:900px){.mf-toast{bottom:24px}}
.mf-msg{white-space:pre-wrap;background:var(--papel);color:inherit;border:1px solid var(--linha);border-radius:10px;padding:12px;font-size:14px}
.mf-loading{min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:var(--marca);color:#fff;width:100%}

/* ===== novidades v2 ===== */
.mf-toast .mf-link{color:var(--enfase-link);padding:4px 10px}
.mf-toast .sem{padding-right:8px}
.mf-badge{position:absolute;top:2px;right:calc(50% - 22px);min-width:18px;height:18px;border-radius:9px;background:var(--poste);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px;line-height:1}
.mf-bottom button{position:relative}
.mf-top .mf-iconbtn{position:relative}
.mf-top .mf-badge{top:0;right:0}
.mf-rail button .mf-cont{margin-left:auto;background:var(--poste);color:#fff;border-radius:9px;font-size:11px;font-weight:700;padding:1px 7px}
.mf-rail button.on .mf-cont{color:#fff}
.mf-slot .fora{position:absolute;right:8px;bottom:6px;font-size:10px;color:var(--latao-tx);font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.mf-slot.pendente{border-color:var(--latao);box-shadow:inset 0 0 0 1px var(--latao)}
.mf-slot .pend{position:absolute;right:8px;top:7px;color:var(--latao)}
.mf-colhead button{background:none;border:0;padding:0;text-align:left}
.mf-daytools{display:flex;gap:8px;flex-wrap:wrap}
.mf-fechado{border:1.5px dashed var(--poste);background:var(--poste-c);color:var(--poste-tx);border-radius:10px;padding:10px;font-size:13px;font-weight:600;text-align:center}
.mf-pay{display:flex;flex-direction:column;gap:8px}
.mf-pay>div{display:grid;grid-template-columns:120px 1fr auto;gap:10px;align-items:center;font-size:14px}
.mf-pay .trilho{height:10px;border-radius:5px;background:var(--trilha);overflow:hidden}
.mf-pay .trilho i{display:block;height:100%;background:var(--btn-bg)}
.mf-quick{display:flex;flex-wrap:wrap;gap:6px}
.mf-quick button{border:1.5px solid var(--linha);background:var(--papel);color:inherit;border-radius:999px;padding:6px 12px;font-size:13px}
.mf-quick button.on{background:var(--amarelo);border-color:var(--sel-borda);color:var(--amarelo-tx);font-weight:600}
.mf-pend{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--linha);flex-wrap:wrap}
.mf-pend:last-child{border-bottom:0}
.mf-pend .quem{flex:1 1 180px;min-width:0}
.mf-hora{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-weight:700;font-size:20px;min-width:52px;color:var(--acento)}
.mf-mini{display:flex;flex-direction:column}
.mf-mini>div{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed var(--linha)}
.mf-mini>div:last-child{border-bottom:0}
.mf-next{background:var(--ok-c);border:1.5px solid var(--ok-b);border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:12px}
.mf-next .mf-hora{font-size:30px}
.mf-alerta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--poste-c);border:1px solid var(--poste-b);color:var(--poste-tx);border-radius:12px;padding:10px 14px;font-size:14px}
.mf-alerta .mf-grow{flex:1 1 200px}
.mf-banner.info{background:var(--azul-c);border-color:var(--azul-b)}
.mf-img{width:100%;max-width:300px;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.18);display:block;margin:0 auto}
.mf-dupe{background:var(--latao-c);border:1px solid var(--latao-b);border-radius:10px;padding:8px 10px;font-size:13px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.mf-pausa-ed{display:grid;gap:8px;background:var(--realce);border:1px solid var(--linha);border-radius:12px;padding:10px}
.mf-g-2-fixo{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mf-g-3-fixo{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
@media (max-width:420px){.mf-g-3-fixo{grid-template-columns:1fr 1fr}.mf-pay>div{grid-template-columns:96px 1fr auto}}
.mf-kpi{display:flex;flex-direction:column;gap:2px}
.mf-kpi b{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-size:28px;line-height:1}
.mf-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.mf-hero .falta{font-size:13px;color:rgba(255,255,255,.78);margin-top:2px}
.mf-sheet .mf-sheethead h2{overflow-wrap:anywhere}
body.mf-travado{overflow:hidden}
.mf-chips.quebra{flex-wrap:wrap;overflow:visible}
@media (min-width:900px){.mf-agenda .mf-slot{height:52px;min-height:0;overflow:hidden}.mf-agenda .mf-slot.oferta .t,.mf-agenda .mf-slot.oferta .s{line-height:1.25}}
`;
