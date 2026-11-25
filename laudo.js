/* Guia Laudo do Talhão: resumo de um talhão (ou da seleção) no estilo de laudo – saúde do solo, fertilidade,
   biologia, nematoides, nutrição foliar, produtividade e tabela completa */
(function(){
  const $ = id => document.getElementById(id);
  const P = $("painel-laudo"); if (!P) return;
  const esc = s => String(s === null || s === undefined ? "" : s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const txt = v => v === null || v === undefined ? "" : String(v);
  const normB = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();            /* como na guia Biológica */
  const normN = s => normB(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
  const f2 = new Intl.NumberFormat("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});
  const fmtV = v => Math.abs(v) >= 100 ? v.toLocaleString("pt-BR", {maximumFractionDigits:0}) : Math.abs(v) >= 10 ? v.toLocaleString("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1}) : f2.format(v);
  const pct = (n, t) => t ? Math.round(100 * n / t) + "%" : "–";
  const r2 = v => Math.round(v * 100) / 100, r4 = v => Math.round(v * 10000) / 10000;
  let dados = window.__dadosVNS || {cab:[], linhas:[]}, modo = "ah";

  /* ---------- Referências (as mesmas das guias Biológica, Foliar e Nematoides) ---------- */
  const COR6 = [{nome:"Muito baixo",bg:"#FF0000"},{nome:"Baixo",bg:"#FFC000"},{nome:"Médio",bg:"#FFFF00"},{nome:"Adequado",bg:"#92D050"},{nome:"Alto",bg:"#00B050"},{nome:"Muito alto",bg:"#0070C0"}];
  const CORM = [{nome:"Muito baixo",bg:"#0070C0"},{nome:"Baixo",bg:"#00B050"},{nome:"Médio",bg:"#92D050"},{nome:"Adequado",bg:"#FFFF00"},{nome:"Alto",bg:"#FFC000"},{nome:"Muito alto",bg:"#FF0000"}];
  const CORI = [{nome:"Muito baixo",bg:"#F8696B"},{nome:"Baixo",bg:"#F4B084"},{nome:"Médio",bg:"#FFE699"},{nome:"Alto",bg:"#A9D08E"},{nome:"Muito alto",bg:"#70AD47"}];
  const CORF = [{nome:"Baixo",bg:"#FF7C80"},{nome:"Médio",bg:"#FFE699"},{nome:"Adequado",bg:"#70AD47"},{nome:"Elevado",bg:"#4472C4"}];
  const CORN = [{nome:"Baixo",bg:"#70AD47"},{nome:"Médio",bg:"#FFE699"},{nome:"Alto",bg:"#F8696B"}];
  const RE_IND = /^(iqs|ciclagem|armaz|suprimento)/;
  const FAIXAS_SOLO = [
    [RE_IND, [0.2,0.4,0.6,0.8], CORI], [/^p\s*\(/, [8,15,21,35,50]], [/^k\s*\(\s*mg/, [40,60,80,120,150]], [/^k\s*\(\s*cmol/, [0.1,0.15,0.21,0.31,0.38]],
    [/^ca\s*\(/, [0.5,2,3.5,5,6.5]], [/^mg\s*\(/, [0.2,0.5,1,1.5,2]], [/^s\s*\(/, [5,7,10,15,20]], [/^mn\b/, [2,3.5,5,10,50]], [/^zn\b/, [0.4,0.8,1.6,3.2,6.4]],
    [/^cu\b/, [0.2,0.4,0.8,1.6,3.2]], [/^b\s*\(/, [0.25,0.5,0.75,1,1.25]], [/^ph\b/, [4.4,4.8,5.5,5.8,6.5]], [/^ctc\b/, [4,6,7,8,9]], [/^v\s*\(?\s*%/, [20,40,60,70,90]], [/^m\s*%/, [1,5,10,20,40], CORM]];
  const ESCALAS = {solo:undefined, m:CORM, indice:CORI};
  function refSolo(nome){
    const r = window.VNS_REF && window.VNS_REF.biologica; let tab = FAIXAS_SOLO;
    if (Array.isArray(r) && r.length){ try { tab = r.map(x => [new RegExp(x.padrao, "i"), x.limites, ESCALAS[x.escala]]); } catch(e){} }
    const f = tab.find(([re]) => re.test(normB(nome))); if (!f) return null;
    const cores = f[2] || COR6;
    return {lim:f[1], cores, fn:(v,l) => { v = r2(v); const i = l.findIndex(x => v <= x); return i < 0 ? l.length : i; }, inv: cores === CORM, ind: cores === CORI};
  }
  const FAIXAS_FOL = [[/^n$/, [38.7,48.4,55.6]], [/^p$/, [2.4,3.6,4.5]], [/^k$/, [19.3,24.8,30.3]], [/^ca$/, [6.4,11.3,14.9]], [/^mg$/, [3.6,4,5.1]], [/^s$/, [2.2,3,3.7]],
    [/^b$/, [36.1,46.4,61.9]], [/^cu$/, [7.3,10.1,13.4]], [/^fe$/, [91.4,130.5,156.7]], [/^mn$/, [42.5,58.9,78.5]], [/^zn$/, [30.9,42.9,59.5]]];
  function refFol(nome){
    const r = window.VNS_REF && window.VNS_REF.foliar; let tab = FAIXAS_FOL;
    if (Array.isArray(r) && r.length){ try { tab = r.map(x => [new RegExp(x.padrao, "i"), x.limites]); } catch(e){} }
    const f = tab.find(([re]) => re.test(normB(nome))); if (!f) return null;
    return {lim:f[1], cores:CORF, fn:(v,l) => { v = r2(v); const i = l.findIndex(x => v < x); return i < 0 ? l.length : i; }};
  }
  function refNem(especie, cisto, raiz){
    let l = null;
    if (/^Meloidogyne/i.test(especie)) l = raiz ? [6,12] : [150,300];
    else if (/^Pratylenchus/i.test(especie)) l = raiz ? [80,160] : [50,100];
    else if (/^Heterodera\s+glycines/i.test(especie)) l = cisto ? (/vi[aá]vel$/i.test(cisto) && !/invi/i.test(cisto) ? [2,5] : null) : (raiz ? null : [75,200]);
    return l ? {lim:l, cores:CORN, fn:(v,x) => v <= x[0] ? 0 : v <= x[1] ? 1 : 2} : null;
  }
  /* Saúde do Solo (diagrama Embrapa) */
  function saudeSolo(c, a){ c = r2(c); a = r2(a); const d = r4(a - c), s = r4(c + a);
    if (s <= 0.8 && (Math.abs(d) <= 0.2 || Math.max(c, a) <= 0.4)) return 0; if (d >= 0.2 && c <= 0.6 && a >= 0.4) return 1;
    if (r4(Math.abs(c - 0.5) + Math.abs(a - 0.5)) <= 0.2) return 2; if (-d >= 0.2 && a <= 0.6 && c >= 0.4) return 3; return 4; }
  const SAUDE = ["Doente","Adoecendo","Intermediário","Recuperando","Saudável"], CORS = ["#F8696B","#F4B084","#FFE699","#A9D08E","#70AD47"];
  const TXT_SAUDE = [
    "Ciclagem e armazenamento de nutrientes baixos. O carbono orgânico do solo está estável, mas em nível baixo.",
    "O solo ainda armazena nutrientes, mas a ciclagem está baixa: sinal de carbono orgânico do solo em declínio.",
    "Ciclagem e armazenamento de nutrientes em nível médio, com carbono orgânico do solo estável.",
    "A ciclagem de nutrientes já está alta e o armazenamento ainda é baixo: o carbono orgânico do solo está aumentando.",
    "Ciclagem e armazenamento de nutrientes elevados, com carbono orgânico do solo estável."];

  /* ---------- Estrutura das colunas ---------- */
  let E = {};
  function estrutura(){
    const cab = dados.cab.map(String), achar = re => cab.findIndex(h => re.test(h));
    const attrs = new Map();   /* nome -> {nome, grupo, AH, R} */
    const add = (grupo, nome, am, j, extra) => { const k = grupo + "|" + nome; if (!attrs.has(k)) attrs.set(k, Object.assign({grupo, nome, AH:-1, R:-1}, extra || {})); attrs.get(k)[am] = j; };
    const reNem = /^\s*(AH|R)\s*-\s*(.+?)\s*\(\s*(Ra[ií]z\s*\/\s*g|Solo\s*100\s*cc)\s*\)\s*$/i;
    cab.forEach((h,j) => {
      let m = reNem.exec(h);
      if (m){ const am = m[1].toUpperCase(), raiz = /ra/i.test(m[3]), nome = m[2].trim(); const mc = /^(.*?)\s*-\s*(Cisto\s+\S+)$/i.exec(nome);
        add(raiz ? "nem_raiz" : "nem_solo", nome, am, j, {especie: mc ? mc[1].trim() : nome, cisto: mc ? mc[2] : null, raiz}); return; }
      m = /^\s*(AH|R)\s*-\s*(.+)$/i.exec(h); if (!m) return;
      const am = m[1].toUpperCase(), nome = m[2].trim();
      if (/-\s*foliar$/i.test(nome)) add("foliar", nome.replace(/\s*-\s*foliar$/i, ""), am, j);
      else if (/-\s*gr[ãa]o$/i.test(nome)) add("grao", nome.replace(/\s*-\s*gr[ãa]o$/i, ""), am, j);
      else if (/^(produtividade|pmg)$/i.test(nome)) add("prod", nome, am, j);
      else if (/^(argila|p\s*\(|k\s*\(|ca\s*\(|mg\s*\(|ctc|v\s*\(|m%|s\s*\(|mn|zn|cu|b\s*\(|ph|mos|arilsulf|betaglic|iqs|ciclagem|armaz|suprimento)/i.test(nome)) add("solo", nome, am, j);
      else add("outros", nome, am, j);
    });
    return {cEst:achar(/estado/i), cCli:achar(/cliente/i), cFaz:achar(/fazenda/i), cTal:achar(/talh/i), cPad:achar(/padr/i), cMun:cab.findIndex(h => normN(h) === "municipio"), attrs:[...attrs.values()]};
  }

  /* ---------- Filtros ---------- */
  const IDS = ["ld-estado","ld-cliente","ld-talhao","ld-padrao"];
  const colsF = () => [E.cEst, E.cCli, E.cTal, E.cPad];
  function filtradas(ate){ const f = colsF().map((c,k) => [c, $(IDS[k]).value]).slice(0, ate); return dados.linhas.filter(l => f.every(([c,v]) => !v || c < 0 || txt(l.v[c]) === v)); }
  const valoresCol = (col, linhas) => col < 0 ? [] : [...new Set(linhas.map(l => txt(l.v[col])).filter(Boolean))].sort((a,b) => a.localeCompare(b, "pt-BR", {numeric:true}));
  function montarFiltros(){
    E = estrutura();
    colsF().forEach((c,k) => { const sel = $(IDS[k]), atual = sel.value, ops = valoresCol(c, k === 0 ? dados.linhas : filtradas(k));
      sel.innerHTML = '<option value="">Todos</option>' + ops.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join(""); sel.value = ops.includes(atual) ? atual : ""; sel.disabled = c < 0; });
  }
  IDS.forEach(id => $(id).addEventListener("change", () => { montarFiltros(); render(); }));
  P.querySelectorAll(".modo button").forEach(b => b.addEventListener("click", () => { modo = b.dataset.modo; P.querySelectorAll(".modo button").forEach(x => x.setAttribute("aria-checked", x === b)); render(); }));
  const ams = () => modo === "ambas" ? ["AH","R"] : [modo.toUpperCase()];
  const num = v => typeof v === "number" && isFinite(v) ? v : null;
  const media = (linhas, col) => { if (col < 0) return null; const n = linhas.map(l => num(l.v[col])).filter(v => v !== null); return n.length ? n.reduce((a,b) => a + b, 0) / n.length : null; };

  /* ---------- Desenho ---------- */
  function arco(cx,cy,r,a0,a1,cor,esp){ const p = a => [cx + r*Math.cos(a), cy - r*Math.sin(a)]; const [x0,y0] = p(a0), [x1,y1] = p(a1); return `<path d="M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}" fill="none" stroke="${cor}" stroke-width="${esp}"/>`; }
  function medidor(cores, k, w, rot, corTxt){
    const n = cores.length, cx = w/2, cy = w*0.52, r = w*0.4, esp = w*0.09; let h = "";
    cores.forEach((c,i) => h += arco(cx,cy,r, Math.PI - i*Math.PI/n, Math.PI - (i+1)*Math.PI/n + 0.02, c, esp));
    if (k !== null){ const a = Math.PI - (k + 0.5)*Math.PI/n; h += `<line x1="${cx}" y1="${cy}" x2="${cx + (r - esp*0.2)*Math.cos(a)}" y2="${cy - (r - esp*0.2)*Math.sin(a)}" stroke="${corTxt}" stroke-width="${w*0.025}" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="${w*0.04}" fill="${corTxt}"/>`; }
    if (rot) h += `<text x="${cx}" y="${cy + w*0.13}" text-anchor="middle" font-size="${w*0.075}" fill="${corTxt}">${rot}</text>`;
    return h;
  }
  function item(nome, vals, ref){   /* vals: {AH, R} médias */
    const vs = ams().map(am => [am, vals[am]]).filter(([,v]) => v !== null && v !== undefined);
    if (!vs.length) return "";
    const maxEsc = ref ? ref.lim[ref.lim.length - 1] * 1.35 : Math.max(...vs.map(([,v]) => Math.abs(v))) * 1.25 || 1;
    const L = vs.map(([am,v]) => { const k = ref ? ref.fn(v, ref.lim) : null; return {am, v, k, cor: k === null ? "#9AA59D" : ref.cores[k].bg}; });
    const dois = vs.length > 1;
    return `<div class="ld-item"><div class="ld-item-t"><b>${nome}</b>${ref ? `<span class="ld-ajuda" title="Limites: ${ref.lim.map(fmtV).join(" / ")}">?</span>` : ""}</div>
      <div class="ld-item-s">${L.map(l => `<span class="ld-st" style="--c:${l.cor}">${dois ? l.am + " " : ""}${l.k === null ? "sem referência" : ref.cores[l.k].nome.toLowerCase()} (${fmtV(l.v)})</span>`).join(" ")}</div>
      ${L.map(l => `<div class="ld-bl">${dois ? `<span class="ld-bl-am">${l.am}</span>` : ""}<div class="ld-trilho"><i style="width:${Math.max(1.5, Math.min(100, 100 * Math.abs(l.v) / maxEsc))}%;background:${l.cor}"></i>${(ref ? ref.lim : []).map(x => `<b style="left:${Math.min(100, 100 * x / maxEsc)}%"></b>`).join("")}</div></div>`).join("")}</div>`;
  }
  function donut(itens, tam){
    const t = itens.reduce((s,x) => s + x[1], 0); if (!t) return ""; let a = -Math.PI/2, h = "";
    itens.forEach(([n,v,c]) => { if (!v) return; const da = 2*Math.PI*v/t, p = q => `${(60 + 52*Math.cos(q)).toFixed(2)} ${(60 + 52*Math.sin(q)).toFixed(2)}`;
      h += da >= 2*Math.PI - 1e-6 ? `<circle cx="60" cy="60" r="52" fill="none" stroke="${c}" stroke-width="18"/>` : `<path d="M${p(a)} A52 52 0 ${da > Math.PI ? 1 : 0} 1 ${p(a+da)}" fill="none" stroke="${c}" stroke-width="18"><title>${n}: ${pct(v,t)}</title></path>`; a += da; });
    return `<svg viewBox="0 0 120 120" style="width:${tam}px;height:${tam}px">${h}</svg>`;
  }
  const legDonut = itens => { const t = itens.reduce((s,x) => s + x[1], 0); return `<ul class="ld-leg">${itens.map(([n,v,c]) => `<li><i style="background:${c}"></i>${n}<b>${pct(v,t)}</b></li>`).join("")}</ul>`; };
  const sec = (tit, desc) => `<div class="ld-sec"><h2>${tit}</h2><p>${desc}</p></div>`;

  let ultimo = null;
  function render(){
    const vazio = $("ld-vazio"), cont = $("ld-folha");
    const msg = m => { vazio.textContent = m; vazio.hidden = false; cont.hidden = true; ultimo = null; };
    if (!dados.linhas.length) return msg("Importe uma planilha ou escolha uma base salva na guia Dados.");
    const linhas = filtradas(4);
    if (!linhas.length) return msg("Nenhuma linha corresponde aos filtros escolhidos.");
    vazio.hidden = true; cont.hidden = false;
    const M = {}; E.attrs.forEach(a => M[a.grupo + "|" + a.nome] = {AH:media(linhas, a.AH), R:media(linhas, a.R)});
    const val = (g, n) => M[g + "|" + n] || {AH:null, R:null};
    const achaA = (g, re) => E.attrs.find(a => a.grupo === g && re.test(a.nome));
    const vA = (g, re) => { const a = achaA(g, re); return a ? val(g, a.nome) : {AH:null, R:null}; };
    ultimo = {linhas, M};

    /* identificação */
    const um = (c) => { const v = valoresCol(c, linhas); return v.length === 1 ? v[0] : v.length ? `${v.length} selecionados` : "–"; };
    $("ld-id").innerHTML = [["Cliente",E.cCli],["Fazenda",E.cFaz],["Talhão",E.cTal],["Padrão",E.cPad],["Município",E.cMun]].map(([n,c]) => `<div><small>${n}</small><b>${esc(c >= 0 ? um(c) : "–")}</b></div>`).join("") +
      `<div><small>Pontos amostrais</small><b>${linhas.length}</b></div>`;
    $("ld-aviso-sel").hidden = !(E.cTal >= 0 && valoresCol(E.cTal, linhas).length > 1 || E.cPad >= 0 && valoresCol(E.cPad, linhas).length > 1);

    /* saúde do solo */
    const cic = vA("solo", /^ciclagem/i), arm = vA("solo", /^armaz/i), iqs = vA("solo", /^iqs\s*fert/i);
    const base = modo === "r" ? "R" : "AH", kS = cic[base] !== null && arm[base] !== null ? saudeSolo(cic[base], arm[base]) : null;
    $("ld-gauge").innerHTML = medidor(CORS, kS, 220, "", "#1B2620") + `<text x="18" y="128" font-size="11" fill="#F4F1E4">Doente</text><text x="202" y="128" font-size="11" text-anchor="end" fill="#F4F1E4">Saudável</text>`;
    $("ld-gauge").querySelectorAll("line,circle").forEach(x => { x.setAttribute("stroke", "#FFFFFF"); if (x.tagName === "circle") x.setAttribute("fill", "#FFFFFF"); });
    $("ld-classe").textContent = kS === null ? "– sem Ciclagem e Armazenamento" : `– ${SAUDE[kS]}${modo === "ambas" ? " (área homogênea)" : modo === "r" ? " (reboleira)" : ""}`;
    $("ld-texto").textContent = kS === null ? "As colunas de Ciclagem e Armazenamento de nutrientes não têm valores nos pontos filtrados." : TXT_SAUDE[kS];
    const kpi = (n, o) => o[ams()[0]] === null ? "" : `<div><small>${n}</small><b>${ams().map(am => o[am] === null ? "–" : f2.format(o[am])).join(" | ")}</b>${modo === "ambas" ? "<span>AH | R</span>" : ""}</div>`;
    const kR = modo === "ambas" && cic.R !== null && arm.R !== null ? saudeSolo(cic.R, arm.R) : null;
    $("ld-hero-k").innerHTML = kpi("IQS Fertbio", iqs) + kpi("Ciclagem", cic) + kpi("Armazenamento", arm) + (kR !== null ? `<div><small>Reboleira</small><b>${SAUDE[kR]}</b><span>classe na R</span></div>` : "");

    /* quatro indicadores */
    const aval = am => {
      const r = {fortes:{fert:[],bio:[],san:[],nut:[]}, fracos:{fert:[],bio:[],san:[],nut:[]}, k:{}, det:{}};
      let bons = 0, n = 0;
      E.attrs.filter(a => a.grupo === "solo").forEach(a => { const ref = refSolo(a.nome), v = val("solo", a.nome)[am]; if (!ref || ref.ind || v === null) return;
        const k = ref.fn(v, ref.lim); n++; if (ref.inv ? k <= 2 : k >= 3) bons++;
        if (ref.inv ? k <= 1 : k >= 4) r.fortes.fert.push(`${a.nome} ${ref.cores[k].nome.toLowerCase()}`);
        if (ref.inv ? k >= 4 : k <= 1) r.fracos.fert.push(`${a.nome} ${ref.cores[k].nome.toLowerCase()}`); });
      r.k.fert = n ? (bons/n >= 0.75 ? 2 : bons/n >= 0.5 ? 1 : 0) : null; r.det.fert = n ? `${bons} de ${n} atributos ok` : "sem dados";
      const ib = vA("solo", /^iqs\s*biol/i)[am] !== null ? vA("solo", /^iqs\s*biol/i)[am] : iqs[am];
      const cls5 = v => { v = r2(v); const i = [0.2,0.4,0.6,0.8].findIndex(x => v <= x); return i < 0 ? 4 : i; };
      r.k.bio = ib === null ? null : (cls5(ib) >= 3 ? 2 : cls5(ib) === 2 ? 1 : 0); r.det.bio = ib === null ? "sem dados" : `IQS ${f2.format(ib)}`;
      [/^ciclagem/i, /^armaz/i, /^suprimento/i, /^iqs\s*biol/i].forEach(re => { const a = achaA("solo", re); if (!a) return; const v = val("solo", a.nome)[am]; if (v === null) return;
        const k = cls5(v); if (k >= 4) r.fortes.bio.push(`${a.nome} muito alto`); else if (k <= 2) r.fracos.bio.push(`${a.nome} ${CORI[k].nome.toLowerCase()}`); });
      let pior = -1;
      E.attrs.filter(a => a.grupo === "nem_raiz" || a.grupo === "nem_solo").forEach(a => { const ref = refNem(a.especie, a.cisto, a.raiz), v = val(a.grupo, a.nome)[am]; if (!ref || v === null) return;
        const k = ref.fn(v, ref.lim); pior = Math.max(pior, k); if (k >= 1) r.fracos.san.push(`${a.nome} ${CORN[k].nome.toLowerCase()} (${a.raiz ? "raiz" : "solo"})`); });
      r.k.san = pior < 0 ? null : 2 - pior; r.det.san = pior < 0 ? "sem dados" : "";
      if (pior === 0) r.fortes.san.push("Nenhum nematoide acima do nível de dano");
      const nd = E.attrs.filter(a => a.grupo === "nem_solo" && !a.cisto && !/vida\s*livre|ovos/i.test(a.nome) && val(a.grupo, a.nome)[am] === 0).map(a => a.nome);
      if (nd.length) r.fortes.san.push(`Não detectados no solo: ${nd.join(", ")}`);
      let fb = 0, fn = 0; const grp = {Adequados:[], Elevados:[], Baixos:[], Médios:[]};
      E.attrs.filter(a => a.grupo === "foliar").forEach(a => { const ref = refFol(a.nome), v = val("foliar", a.nome)[am]; if (!ref || v === null) return;
        const k = ref.fn(v, ref.lim); fn++; if (k >= 2) fb++; grp[["Baixos","Médios","Adequados","Elevados"][k]].push(a.nome); });
      r.k.nut = fn ? (fb/fn >= 0.75 ? 2 : fb/fn >= 0.5 ? 1 : 0) : null; r.det.nut = fn ? `${fb} de ${fn} nutrientes ok` : "sem dados";
      if (grp.Adequados.length) r.fortes.nut.push(grp.Adequados.length === fn ? "Todos os nutrientes adequados" : `Adequados: ${grp.Adequados.join(", ")}`);
      if (grp.Elevados.length) r.fortes.nut.push(`Elevados: ${grp.Elevados.join(", ")}`);
      if (grp.Baixos.length) r.fracos.nut.push(`Baixos: ${grp.Baixos.join(", ")}`);
      if (grp.Médios.length) r.fracos.nut.push(`Médios: ${grp.Médios.join(", ")}`);
      return r;
    };
    const A = aval(base), AR = modo === "ambas" ? aval("R") : null;
    const CK = ["#F8696B","#FFD966","#70AD47"], ROTK = ["ruim","regular","bom"];
    $("ld-sub").innerHTML = [["fert","Fertilidade"],["bio","Biologia"],["san","Sanidade"],["nut","Nutrição"]].map(([id,n]) => {
      const ex = AR ? AR.fracos[id].filter(x => !A.fracos[id].includes(x)) : [];
      const fr = A.fracos[id].concat(ex.length ? [`<i>Na reboleira:</i> ${esc(ex.slice(0,3).join("; "))}${ex.length > 3 ? ` e mais ${ex.length - 3}` : ""}`] : []);
      const lista = (arr, vazio, html) => `<ul>${(arr.length ? arr : [vazio]).map(x => `<li${arr.length ? "" : ' class="ld-vazio"'}>${html ? x : esc(x)}</li>`).join("")}</ul>`;
      return `<div class="ld-ind"><h3>${n}</h3><svg viewBox="0 0 120 84" class="ld-mini">${medidor(CK, A.k[id], 120, A.k[id] === null ? "sem dados" : ROTK[A.k[id]], "#1B2620")}</svg>
        <small class="ld-det">${esc(A.det[id] || "")}</small>
        <div class="ld-pf"><span>pontos fortes</span>${lista(A.fortes[id], "Sem pontos fortes")}</div>
        <div class="ld-pf ld-fr"><span>pontos fracos</span>${lista(fr.map((x,i) => i < A.fracos[id].length ? esc(x) : x), "Sem pontos fracos", true)}</div></div>`;
    }).join("");

    /* resumo da microbiologia B4A (quando houver laudo do mesmo talhão e padrão) */
    const tal = E.cTal >= 0 ? valoresCol(E.cTal, linhas) : [], pad = E.cPad >= 0 ? valoresCol(E.cPad, linhas) : [], cli = E.cCli >= 0 ? valoresCol(E.cCli, linhas) : [];
    const LB = (window.vnsLaudosB4A || []).filter(L => (!cli.length || cli.map(normN).includes(normN(L.cliente))) && tal.map(normN).includes(normN(L.talhao)) && pad.map(normN).includes(normN(L.padrao)) && ams().includes(L.amostra || "AH"));
    $("ld-b4a").innerHTML = LB.length ? sec("Microbiologia do solo (B4A)", "Resumo do laudo de microbiologia do mesmo talhão e padrão. Detalhes na guia Microbiologia do Solo (B4A).") +
      `<div class="ld-b4a">${LB.map(L => { const d = L.dados || {}; return `<div class="ld-b4a-c"><small>${esc(L.identificacao)} · ${esc(L.padrao || "")} · ${esc(L.amostra || "AH")}</small><b>Índice B4A ${esc(d.indice || "–")}</b>
        <span>${[["doencas","Doenças"],["nutrientes","Nutrientes"],["emissoes","Emissões"],["estresse","Estresse"]].map(([k,n]) => `${n}: <b>${esc((d.sub || {})[k] || "–")}</b>`).join(" · ")}</span></div>`; }).join("")}</div>` : "";

    /* fertilidade */
    const solo = E.attrs.filter(a => a.grupo === "solo");
    const grupoSolo = [["Macronutrientes", /^(p\s*\(|k\s*\(\s*mg|ca\s*\(|mg\s*\(|s\s*\()/i], ["Micronutrientes", /^(mn|zn|cu|b\s*\()/i], ["Acidez e CTC", /^(ph|ctc|v\s*\(|m%)/i], ["Outros", /^(argila|mos)/i]];
    const colunas = grupoSolo.map(([t,re]) => { const it = solo.filter(a => re.test(a.nome)).map(a => item(esc(a.nome), val("solo", a.nome), refSolo(a.nome))).join(""); return it ? `<div class="ld-col"><h3>${t}</h3>${it}</div>` : ""; }).join("");
    const ctc = am => { const g = re => vA("solo", re)[am]; const K = g(/^k\s*\(\s*cmol/i), Ca = g(/^ca\s*\(/i), Mg = g(/^mg\s*\(/i), T = g(/^ctc/i);
      return [K,Ca,Mg,T].some(v => v === null) ? null : [["Ca",Ca,"#1F3D2B"],["Mg",Mg,"#4E8A63"],["K",K,"#C9A227"],["H + Al",Math.max(0, T - Ca - Mg - K),"#D9DED6"]]; };
    const dCtc = ams().map(am => [am, ctc(am)]).filter(([,c]) => c);
    $("ld-solo").innerHTML = colunas ? sec("Fertilidade do solo", "Atributos químicos comparados com as Referências Grower de análise de solo (as mesmas da guia Análise Biológica).") +
      `<div class="ld-sec-c"><div class="ld-cols">${colunas}</div>${dCtc.length ? `<div class="ld-donut-box"><h3>Ocupação da CTC</h3>${dCtc.map(([am,c]) => `<div class="ld-dn">${donut(c, dCtc.length > 1 ? 110 : 140)}<span>${dCtc.length > 1 ? am : ""}</span>${legDonut(c)}</div>`).join("")}</div>` : ""}</div>` : "";

    /* biologia */
    const bio = [["Índices de qualidade", /^iqs/i], ["Funções do solo", /^(ciclagem|armaz|suprimento)/i], ["Enzimas", /^(arilsulf|betaglic)/i]];
    const colB = bio.map(([t,re]) => { const it = solo.filter(a => re.test(a.nome)).map(a => item(esc(a.nome), val("solo", a.nome), refSolo(a.nome))).join(""); return it ? `<div class="ld-col"><h3>${t}</h3>${it}${t === "Enzimas" ? '<p class="nota">Sem referência cadastrada: a barra mostra só o valor.</p>' : ""}</div>` : ""; }).join("");
    $("ld-bio").innerHTML = colB ? sec("Biologia do solo", "Índices de qualidade (IQS Fertbio) e enzimas. Cores pela referência Embrapa (0 a 1).") + `<div class="ld-sec-c"><div class="ld-cols">${colB}</div></div>` : "";

    /* nematoides */
    const NI = it => /^(Pratylenchus|Meloidogyne|Helicotylenchus|Rotylenchulus|Heterodera|Criconemella)/i.test(it) ? `<i>${esc(it.replace(/\s+spp\.$/, ""))}</i>${/\s+spp\.$/.test(it) ? " spp." : ""}` : esc(it);
    const colN = (g, t) => { const at = E.attrs.filter(a => a.grupo === g && !a.cisto);
      const nd = at.filter(a => ams().every(am => val(g, a.nome)[am] === 0)).map(a => a.nome);
      const it = at.filter(a => !nd.includes(a.nome)).map(a => item(NI(a.nome), val(g, a.nome), refNem(a.especie, null, a.raiz))).join("");
      return it || nd.length ? `<div class="ld-col"><h3>${t}</h3>${it}${nd.length ? `<div class="ld-nd">Não detectados<br><span>${nd.map(NI).join(", ")}</span></div>` : ""}</div>` : ""; };
    const cist = E.attrs.filter(a => a.cisto).map(a => item(`Cistos ${esc(a.cisto.replace(/^cisto\s+/i, ""))}s de <i>H. glycines</i>`, val(a.grupo, a.nome), refNem(a.especie, a.cisto, false))).join("");
    const comp = am => E.attrs.filter(a => a.grupo === "nem_solo" && !a.cisto && !/vida\s*livre|ovos/i.test(a.nome)).map((a,i) => [NI(a.nome), val("nem_solo", a.nome)[am] || 0, ["#8E3B46","#C9A227","#4E8A63","#2F6E9E","#A597CC","#6B7A70"][i % 6]]).filter(x => x[1] > 0);
    const dNem = ams().map(am => [am, comp(am)]).filter(([,c]) => c.length);
    const nemHtml = colN("nem_raiz", "Raiz (nº/g)") + colN("nem_solo", "Solo (nº/100 cc)") + (cist ? `<div class="ld-col"><h3>Cistos</h3>${cist}</div>` : "");
    $("ld-nem").innerHTML = nemHtml ? sec("Sanidade – nematoides", "Populações na raiz e no solo comparadas com os níveis de dano usados na guia Análise de nematoides.") +
      `<div class="ld-sec-c"><div class="ld-cols">${nemHtml}</div>${dNem.length ? `<div class="ld-donut-box"><h3>Composição no solo</h3>${dNem.map(([am,c]) => `<div class="ld-dn">${donut(c, dNem.length > 1 ? 110 : 140)}<span>${dNem.length > 1 ? am : ""}</span>${legDonut(c)}</div>`).join("")}</div>` : ""}</div>` : "";

    /* foliar */
    const fol = E.attrs.filter(a => a.grupo === "foliar"), comRef = fol.filter(a => refFol(a.nome)), semRef = fol.filter(a => !refFol(a.nome));
    const macro = comRef.filter(a => /^(n|p|k|ca|mg|s)$/i.test(a.nome)), micro = comRef.filter(a => !/^(n|p|k|ca|mg|s)$/i.test(a.nome));
    const colF = (t, lst, ref) => { const it = lst.map(a => item(esc(a.nome), val("foliar", a.nome), ref ? refFol(a.nome) : null)).join(""); return it ? `<div class="ld-col"><h3>${t}</h3>${it}</div>` : ""; };
    const folHtml = colF("Macronutrientes", macro, true) + colF("Micronutrientes", micro, true) + colF("Sem referência", semRef, false);
    $("ld-fol").innerHTML = folHtml ? sec("Nutrição foliar", "Níveis críticos foliares para soja – Safra 24/25 (Grower), os mesmos da guia Análise Foliar.") + `<div class="ld-sec-c"><div class="ld-cols">${folHtml}</div></div>` : "";

    /* produtividade */
    const prods = E.attrs.filter(a => a.grupo === "prod");
    const pk = prods.map(a => { const v = val("prod", a.nome); if (ams().every(am => v[am] === null)) return "";
      const dif = v.AH && v.R !== null ? 100 * (v.R - v.AH) / v.AH : null;
      return `<div class="ld-pk"><small>${esc(a.nome)}</small><div class="ld-pk-v">${ams().map(am => v[am] === null ? "" : `<div><b>${fmtV(v[am])}</b><span>${am === "AH" ? "Área homogênea" : "Reboleira"}</span></div>`).join("")}</div>
        ${modo === "ambas" && dif !== null ? `<div class="ld-pk-d ${dif < 0 ? "neg" : ""}">Reboleira ${dif < 0 ? "" : "+"}${f2.format(dif).replace(/,00$/, "")}% em relação à área homogênea</div>` : ""}</div>`; }).join("");
    $("ld-prod").innerHTML = pk ? sec("Produtividade e PMG", "Resultado de colheita e diferença entre área homogênea e reboleira.") + `<div class="ld-sec-c"><div class="ld-prod">${pk}</div></div>` : "";

    tabela();
  }

  /* ---------- Tabela completa ---------- */
  let ordem = "grupo";
  const NOME_G = {solo:"Solo", nem_raiz:"Nematoides – raiz", nem_solo:"Nematoides – solo", foliar:"Foliar", grao:"Grãos", prod:"Produtividade", outros:"Outros"};
  const ORD_G = ["solo","nem_raiz","nem_solo","foliar","grao","prod","outros"];
  function linhasTab(){
    if (!ultimo) return [];
    return E.attrs.map(a => {
      const v = ultimo.M[a.grupo + "|" + a.nome], ref = a.grupo === "solo" ? refSolo(a.nome) : a.grupo === "foliar" ? refFol(a.nome) : a.grupo.startsWith("nem") ? refNem(a.especie, a.cisto, a.raiz) : null;
      const cls = {}; let alerta = 0;
      ams().forEach(am => { if (v[am] === null || !ref) return; const k = ref.fn(v[am], ref.lim); cls[am] = ref.cores[k];
        if (a.grupo === "foliar" ? k === 0 : a.grupo.startsWith("nem") ? k === 2 : (ref.inv ? k >= 4 : k <= 1)) alerta = 1; });
      return {g:a.grupo, nome:a.nome, v, cls, alerta, tem: ams().some(am => v[am] !== null)};
    }).filter(l => l.tem);
  }
  function tabela(){
    const q = normN($("ld-busca").value);
    let L = linhasTab().filter(l => !q || normN(NOME_G[l.g] + " " + l.nome).includes(q));
    L.sort((a,b) => ordem === "az" ? a.nome.localeCompare(b.nome, "pt-BR") : ordem === "alerta" ? (b.alerta - a.alerta) || (ORD_G.indexOf(a.g) - ORD_G.indexOf(b.g)) : ORD_G.indexOf(a.g) - ORD_G.indexOf(b.g));
    const dois = ams().length > 1, cl = c => ["#FF0000","#0070C0","#00B050","#4472C4"].includes(c.bg) ? "#fff" : "#1B2620";
    let h = `<thead><tr><th>Grupo</th><th>Atributo</th>${ams().map(am => `<th class="n">${dois ? am : "Valor"}</th><th>Classe${dois ? " " + am : ""}</th>`).join("")}</tr></thead><tbody>`;
    L.forEach(l => { h += `<tr${l.alerta ? ' class="ld-alerta"' : ""}><td>${NOME_G[l.g]}</td><td>${esc(l.nome)}</td>${ams().map(am => { const v = l.v[am], c = l.cls[am];
      return `<td class="n">${v === null ? "–" : fmtV(v)}</td><td>${c ? `<span class="ld-chip" style="background:${c.bg};color:${cl(c)}">${c.nome}</span>` : v === null ? "" : '<span class="ld-sr">sem referência</span>'}</td>`; }).join("")}</tr>`; });
    $("ld-tab").innerHTML = h + "</tbody>";
    $("ld-tab-n").textContent = `Mostrando ${L.length} atributos (médias dos pontos filtrados)${q ? " com a busca" : ""}. Linhas destacadas = alerta (classe ruim em alguma amostra).`;
  }
  $("ld-busca").addEventListener("input", tabela);
  $("ld-ord").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; ordem = b.dataset.o; $("ld-ord").querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", x === b)); tabela(); });

  /* ---------- Exportação ---------- */
  const dlP = (window.claude && typeof window.claude.use === "function") ? window.claude.use("downloads").catch(() => null) : Promise.resolve(undefined);
  function avisar(m, erro){ const a = $("aviso"); a.textContent = m; a.className = "aviso" + (erro ? " erro" : ""); a.hidden = false; clearTimeout(avisar.t); avisar.t = setTimeout(() => a.hidden = true, 3500); }
  async function salvar(nome, blob){
    const dl = await dlP;
    if (dl){ try{ await dl.save({filename:nome, data:blob}); } catch(e){ if (e && e.code === "declined") return; avisar("Não foi possível salvar o arquivo aqui.", true); } return; }
    if (window.claude) return avisar("Exportação indisponível nesta visualização.", true);
    const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  $("ld-xls").addEventListener("click", async () => {
    if (!ultimo) return; if (typeof XLSX === "undefined") return avisar("A biblioteca do Excel não carregou. Recarregue a página.", true);
    const L = linhasTab(), aoa = [["Grupo","Atributo", ...ams().flatMap(am => [`Média ${am}`, `Classe ${am}`])], ...L.map(l => [NOME_G[l.g], l.nome, ...ams().flatMap(am => [l.v[am] === null ? null : r2(l.v[am]), l.cls[am] ? l.cls[am].nome : ""])])];
    const filtros = ["Estado","Cliente","Talhão","Padrão"].map((n,k) => [n, $(IDS[k]).value || "Todos"]);
    const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = [{wch:20},{wch:36},{wch:12},{wch:14},{wch:12},{wch:14}];
    XLSX.utils.book_append_sheet(wb, ws, "Atributos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Laudo do Talhão – Resultados VNS"], [], ...filtros, ["Pontos amostrais", ultimo.linhas.length], ["Gerado em", new Date().toLocaleDateString("pt-BR")]]), "Filtros");
    await salvar(`laudo_talhao_${new Date().toISOString().slice(0,10)}.xlsx`, new Blob([XLSX.write(wb, {bookType:"xlsx", type:"array"})]));
  });
  $("ld-pdf").addEventListener("click", () => { if (!ultimo) return; document.body.classList.add("imprimindo-laudo"); setTimeout(() => { window.print(); }, 50); });
  window.addEventListener("afterprint", () => document.body.classList.remove("imprimindo-laudo"));

  document.addEventListener("dados-atualizados", e => { dados = e.detail; montarFiltros(); render(); });
  document.addEventListener("b4a-atualizados", () => { if (dados.linhas.length) render(); });
  montarFiltros(); render();
  if (location.hash === "#laudo") $("guia-laudo").click();
})();
