(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const fmt1 = new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1});
  let dados = window.__dadosVNS || {cab:[], linhas:[]};
  let E = {cEst:-1, cCli:-1, cTal:-1, cPad:-1, cards:[]};
  let graficos = [];

  /* Guias */
  const guias = [...document.querySelectorAll(".guia")];
  function ativar(alvo){
    guias.forEach(g => {
      const on = g.dataset.alvo === alvo;
      g.setAttribute("aria-selected", on); g.tabIndex = on ? 0 : -1;
      $(g.getAttribute("aria-controls")).hidden = !on;
    });
    if (alvo === "nematoides") renderizar();
  }
  guias.forEach((g,i) => {
    g.addEventListener("click", () => ativar(g.dataset.alvo));
    g.addEventListener("keydown", e => {
      const fw = e.key === "ArrowDown" || e.key === "ArrowRight", bw = e.key === "ArrowUp" || e.key === "ArrowLeft";
      if (!fw && !bw) return; e.preventDefault();
      const n = guias[(i + (fw ? 1 : guias.length - 1)) % guias.length];
      n.focus(); ativar(n.dataset.alvo);
    });
  });

  /* Estrutura das colunas de nematoides (lida pelos cabeçalhos) */
  function estrutura(){
    const achar = re => dados.cab.findIndex(h => re.test(h));
    const cards = new Map();
    const re = /^\s*(AH|R)\s*-\s*(.+?)\s*\(\s*(Ra[ií]z\s*\/\s*g|Solo\s*100\s*cc)\s*\)\s*$/i;
    dados.cab.forEach((h,j) => {
      const m = re.exec(h); if (!m) return;
      const tipo = m[1].toUpperCase(), nome = m[2].trim(), solo = /solo/i.test(m[3]);
      let chave = nome, especie = nome, cisto = false;
      let rotulo = solo ? "Solo (nº/100 cc)" : "Raiz (nº/g)";
      const mc = /^(.*?)\s*-\s*Cisto\s+(vi[aá]vel|invi[aá]vel)$/i.exec(nome);
      if (mc){ especie = mc[1].trim(); chave = "Cistos de " + especie; cisto = true;
        rotulo = (/^in/i.test(mc[2]) ? "Cistos inviáveis" : "Cistos viáveis") + " (nº/100 cc de solo)"; }
      if (!cards.has(chave)) cards.set(chave, {especie, cisto, graficos:new Map()});
      const g = cards.get(chave).graficos;
      if (!g.has(rotulo)) g.set(rotulo, {rotulo, AH:-1, R:-1});
      g.get(rotulo)[tipo] = j;
    });
    return {cEst:achar(/estado/i), cCli:achar(/cliente/i), cTal:achar(/talh/i), cPad:achar(/padr/i), cards:[...cards.values()]};
  }

  /* Filtros */
  const txt = v => v === null || v === undefined ? "" : String(v);
  function valores(col, linhas){
    if (col < 0) return [];
    const s = new Set(); linhas.forEach(l => { const k = txt(l.v[col]); if (k) s.add(k); });
    return [...s].sort((a,b) => a.localeCompare(b, "pt-BR", {numeric:true}));
  }
  function preencher(sel, opts, atual){
    sel.innerHTML = '<option value="">Todos</option>' + opts.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
    sel.value = opts.includes(atual) ? atual : "";
  }
  function linhasFiltradas(ate){
    const f = [[E.cEst, $("f-estado").value], [E.cCli, $("f-cliente").value], [E.cTal, $("f-talhao").value], [E.cPad, $("f-padrao").value]].slice(0, ate);
    return dados.linhas.filter(l => f.every(([c,v]) => !v || c < 0 || txt(l.v[c]) === v));
  }
  function montarFiltros(){
    E = estrutura();
    const fe = $("f-estado"), fc = $("f-cliente"), ft = $("f-talhao"), fp = $("f-padrao");
    preencher(fe, valores(E.cEst, dados.linhas), fe.value);
    preencher(fc, valores(E.cCli, linhasFiltradas(1)), fc.value);
    preencher(ft, valores(E.cTal, linhasFiltradas(2)), ft.value);
    preencher(fp, valores(E.cPad, linhasFiltradas(3)), fp.value);
    fe.disabled = E.cEst < 0; fc.disabled = E.cCli < 0; ft.disabled = E.cTal < 0; fp.disabled = E.cPad < 0;
  }
  ["f-estado","f-cliente","f-talhao","f-padrao"].forEach(id => $(id).addEventListener("change", () => { montarFiltros(); renderizar(); }));

  /* Grupos do eixo X: talhão + padrão (na ordem da planilha) */
  function grupos(linhas){
    const multiCli = E.cCli >= 0 && new Set(linhas.map(l => txt(l.v[E.cCli]))).size > 1;
    const g = new Map();
    for (const l of linhas){
      const cli = E.cCli >= 0 ? txt(l.v[E.cCli]) : "", tal = E.cTal >= 0 ? txt(l.v[E.cTal]) : "", pad = E.cPad >= 0 ? txt(l.v[E.cPad]) : "";
      const k = cli + "|" + tal + "|" + pad;
      if (!g.has(k)) g.set(k, {rot: multiCli ? [tal + " " + pad, cli] : [tal || "Sem talhão", pad], linhas:[]});
      g.get(k).linhas.push(l);
    }
    return [...g.values()];
  }
  function media(linhas, col){
    const n = linhas.map(l => l.v[col]).filter(v => typeof v === "number" && isFinite(v));
    return n.length ? n.reduce((a,b) => a + b, 0) / n.length : null;
  }
  function titulo(c){
    const e = c.especie;
    const cient = /^[A-Z][a-z]+(\s+(spp\.|[a-z]+))?$/.test(e) && !/^Ovos$/i.test(e);
    let t = esc(e);
    if (cient){ const spp = /\s+spp\.$/.test(e); t = `<em>${esc(e.replace(/\s+spp\.$/, ""))}</em>${spp ? " spp." : ""}`; }
    return c.cisto ? "Cistos de " + t : t;
  }

  /* Níveis de referência (tabela de níveis populacionais) */
  function limites(c, g){
    const e = c.especie, raiz = /^Raiz/i.test(g.rotulo);
    if (/^Meloidogyne/i.test(e)) return raiz ? [6,12] : [150,300];
    if (/^Pratylenchus/i.test(e)) return raiz ? [80,160] : [50,100];
    if (/^Heterodera\s+glycines/i.test(e)){ if (c.cisto) return [2,5]; return raiz ? null : [75,200]; }
    return null;
  }
  function fonteRef(c){
    if (/^Heterodera\s+glycines/i.test(c.especie)) return '<p class="fonte-ref">' + (c.cisto ? "Níveis" : "Níveis no solo") + ' adaptados de Asmus &amp; Andrade (1999), Garcia et al. (1999) e Inomoto et al. (2010).</p>';
    if (/^(Meloidogyne|Pratylenchus)/i.test(c.especie)) return '<p class="fonte-ref">Níveis adaptados de Stephen Koenning (Universidade da Carolina do Norte, EUA, 2007).</p>';
    return "";
  }
  function faixasDe(lim){
    const escuro = getComputedStyle(document.documentElement).colorScheme === "dark";
    const fx = [
      {de:0, ate:lim[0], nome:"Baixo", fundo:"rgba(146,208,80,.32)", txt: escuro ? "#A9DC72" : "#3D7A16"},
      {de:lim[0], ate:lim[1], nome:"Médio", fundo:"rgba(255,192,0,.32)", txt: escuro ? "#FFD34D" : "#8A6200"},
      {de:lim[1], ate:Infinity, nome:"Alto", fundo:"rgba(255,0,0,.20)", txt: escuro ? "#FF8A80" : "#B00000"}
    ];
    return { id:"faixas", beforeDatasetsDraw(ch){
      const ctx = ch.ctx, a = ch.chartArea, y = ch.scales.y; ctx.save();
      ctx.font = '600 11px "Barlow", system-ui, Arial, sans-serif'; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      for (const f of fx){
        const yTop = Math.max(a.top, y.getPixelForValue(Math.min(f.ate, y.max)));
        const yBot = Math.min(a.bottom, y.getPixelForValue(Math.max(f.de, y.min)));
        if (yBot - yTop <= 0) continue;
        ctx.fillStyle = f.fundo; ctx.fillRect(a.left, yTop, a.right - a.left, yBot - yTop);
        if (yBot - yTop >= 14){ ctx.fillStyle = f.txt; ctx.fillText(f.nome, a.right + 5, (yTop + yBot) / 2); }
      }
      ctx.restore();
    }};
  }

  /* Gráficos */
  function renderizar(){
    if ($("painel-nematoides").hidden) return;
    graficos.forEach(g => g.destroy()); graficos = [];
    const box = $("cartoes"), nota = $("nem-nota");
    const msg = m => { box.innerHTML = `<div class="msg">${m}</div>`; nota.textContent = ""; };
    if (typeof Chart === "undefined") return msg("A biblioteca de gráficos não carregou. Verifique a conexão e recarregue a página.");
    if (!dados.linhas.length) return msg("Importe uma planilha na guia Dados para gerar os gráficos.");
    if (!E.cards.length) return msg("Nenhuma coluna de nematoide encontrada. Os cabeçalhos devem seguir o padrão “AH - Espécie (Raiz /g)” e “R - Espécie (Solo 100 cc)”.");
    const linhas = linhasFiltradas(4);
    if (!linhas.length) return msg("Nenhuma linha corresponde aos filtros escolhidos.");
    const G = grupos(linhas);
    nota.textContent = `Cada barra é a média dos pontos do talhão e padrão. ${linhas.length} pontos considerados em ${G.length} ${G.length === 1 ? "grupo" : "grupos"}.`;

    box.innerHTML = E.cards.map((c,i) => `<article class="cartao"><div class="cartao-topo"><h2>${titulo(c)}</h2><div class="acoes exp"><button type="button" class="btn btn-mini" data-img="${i}">${ICO_IMG}Imagem</button><button type="button" class="btn btn-mini" data-xls="${i}">${ICO_XLS}Excel</button></div></div><div class="graficos">${
      [...c.graficos.values()].map((g,k) => `<figure><figcaption>${esc(g.rotulo)}</figcaption><div class="area"><canvas id="cv-${i}-${k}" role="img" aria-label="${esc(c.especie + ", " + g.rotulo)}: área homogênea e reboleira por talhão e padrão"></canvas></div></figure>`).join("")
    }</div>${fonteRef(c)}</article>`).join("");

    const cs = getComputedStyle(document.documentElement);
    const cor = n => cs.getPropertyValue(n).trim();
    const cTexto = cor("--text"), cMuted = cor("--muted"), cLinha = cor("--line-2"), cAH = cor("--bar-ah"), cR = cor("--bar-r");
    const fonte = '"Barlow", system-ui, Arial, sans-serif';
    const semMov = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rotulos = { id:"rotulos", afterDatasetsDraw(ch){
      const ctx = ch.ctx; ctx.save();
      ctx.font = `600 11px ${fonte}`; ctx.fillStyle = cTexto; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ch.data.datasets.forEach((d,i) => { const m = ch.getDatasetMeta(i); if (m.hidden) return;
        m.data.forEach((b,j) => { const v = d.data[j]; if (v === null || v === undefined) return; ctx.fillText(fmt1.format(v), b.x, b.y - 3); }); });
      ctx.restore();
    }};

    E.cards.forEach((c,i) => [...c.graficos.values()].forEach((g,k) => {
      const ds = [];
      const lim = limites(c, g);
      const base = {borderRadius:3, categoryPercentage:Math.min(.72, .16 * G.length), barPercentage:.9};
      if (g.AH >= 0) ds.push({...base, label:"Área homogênea (AH)", data:G.map(x => media(x.linhas, g.AH)), backgroundColor:cAH});
      if (g.R >= 0) ds.push({...base, label:"Reboleira (R)", data:G.map(x => media(x.linhas, g.R)), backgroundColor:cR});
      graficos.push(new Chart($(`cv-${i}-${k}`), {
        type:"bar",
        data:{labels:G.map(x => x.rot), datasets:ds},
        options:{
          responsive:true, maintainAspectRatio:false, animation: semMov ? false : {duration:350},
          devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
          layout:{padding:{top:16, right: lim ? 46 : 0}},
          plugins:{legend:{display:false}, tooltip:{callbacks:{title:it => [].concat(it[0].label).join(" "), label:t => `${t.dataset.label}: ${fmt1.format(t.parsed.y)}`}}},
          scales:{
            x:{grid:{display:false}, ticks:{color:cMuted, font:{family:fonte, size:12}}},
            y:{beginAtZero:true, grace:"14%", suggestedMax: lim ? lim[1] * 1.3 : undefined, grid:{color:cLinha}, border:{display:false}, ticks:{color:cMuted, font:{family:fonte, size:11.5}, callback:v => fmt1.format(v)}}
          }
        },
        plugins: lim ? [faixasDe(lim), rotulos] : [rotulos]
      }));
    }));
  }

  /* Exportação: imagem (PNG) e Excel (.xlsx) */
  const ICO_IMG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>';
  const ICO_XLS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>';
  const dlP = (window.claude && typeof window.claude.use === "function") ? window.claude.use("downloads").catch(() => null) : Promise.resolve(undefined);
  dlP.then(d => { if (window.claude && !d) document.body.classList.add("sem-export"); });

  function avisar(m, erro){
    const a = $("aviso"); a.textContent = m; a.className = "aviso" + (erro ? " erro" : ""); a.hidden = false;
    clearTimeout(avisar.t); avisar.t = setTimeout(() => a.hidden = true, 3500);
  }
  async function salvar(nome, blob){
    const dl = await dlP;
    if (dl){
      try{ await dl.save({filename:nome, data:blob}); }
      catch(e){
        if (e && e.code === "declined") return;
        if (e && e.code === "rate_limited") return avisar("Já há um arquivo aguardando confirmação. Tente de novo em instantes.", true);
        avisar("Não foi possível salvar o arquivo aqui.", true);
      }
      return;
    }
    if (window.claude) return avisar("Exportação indisponível nesta visualização.", true);
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  const slug = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
  const hoje = () => new Date().toISOString().slice(0,10);
  const arred = v => v === null ? null : Math.round(v * 100) / 100;
  const nivel = (v, lim) => (v === null || !lim) ? "" : (v <= lim[0] ? "Baixo" : v <= lim[1] ? "Médio" : "Alto");
  function textoFiltros(){
    return [["Estado","f-estado"],["Cliente","f-cliente"],["Talhão","f-talhao"],["Padrão","f-padrao"]].map(([n,id]) => `${n}: ${$(id).value || "Todos"}`).join(", ");
  }
  function fonteTexto(c){ const d = document.createElement("div"); d.innerHTML = fonteRef(c); return d.textContent.trim(); }
  function partesTitulo(c){
    const e = c.especie, out = [];
    const cient = /^[A-Z][a-z]+(\s+(spp\.|[a-z]+))?$/.test(e) && !/^Ovos$/i.test(e);
    if (c.cisto) out.push({t:"Cistos de ", it:false});
    if (cient){ const spp = /\s+spp\.$/.test(e); out.push({t:e.replace(/\s+spp\.$/, ""), it:true}); if (spp) out.push({t:" spp.", it:false}); }
    else out.push({t:e, it:false});
    return out;
  }
  const nomeCartao = c => (c.cisto ? "Cistos de " : "") + c.especie;

  async function imagemCartao(i){
    const c = E.cards[i]; if (!c) return;
    const gs = [...c.graficos.values()];
    const chs = gs.map((g,k) => graficos.find(x => x.canvas.id === `cv-${i}-${k}`));
    if (chs.some(x => !x)) return;
    const cs = getComputedStyle(document.documentElement), cor = n => cs.getPropertyValue(n).trim();
    const f = '"Barlow", system-ui, Arial, sans-serif', fT = '"Barlow Semi Condensed", "Barlow", Arial, sans-serif';
    const s = 2, pad = 28, gap = 28;
    const cw = chs.map(ch => ch.canvas.clientWidth), chH = Math.max(...chs.map(ch => ch.canvas.clientHeight));
    const ref = fonteTexto(c);
    const W = Math.max(720, pad * 2 + cw.reduce((a,b) => a + b, 0) + gap * (chs.length - 1));
    const H = pad + 28 + 30 + 20 + chH + (ref ? 34 : 6) + pad;
    const cv = document.createElement("canvas"); cv.width = W * s; cv.height = H * s;
    const ctx = cv.getContext("2d"); ctx.scale(s, s);
    ctx.fillStyle = cor("--surface"); ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "middle";
    let y = pad;
    ctx.fillStyle = cor("--ouro"); ctx.fillRect(pad, y, 4, 28);
    let x = pad + 14;
    ctx.fillStyle = cor("--text");
    for (const p of partesTitulo(c)){ ctx.font = `${p.it ? "italic " : ""}600 22px ${fT}`; ctx.fillText(p.t, x, y + 14); x += ctx.measureText(p.t).width; }
    ctx.font = `500 13px ${f}`;
    let lx = W - pad;
    for (const [t, c2] of [["Reboleira (R)", cor("--bar-r")], ["Área homogênea (AH)", cor("--bar-ah")]]){
      lx -= ctx.measureText(t).width; ctx.fillStyle = cor("--text"); ctx.fillText(t, lx, y + 14);
      lx -= 20; ctx.fillStyle = c2; ctx.fillRect(lx, y + 7, 14, 14); lx -= 22;
    }
    y += 28 + 14;
    ctx.font = `400 12.5px ${f}`; ctx.fillStyle = cor("--muted");
    ctx.fillText(textoFiltros() + ". Barras: média dos pontos de cada talhão e padrão.", pad, y);
    y += 16 + 12;
    let gx = pad;
    chs.forEach((ch,k) => {
      ctx.font = `500 13px ${f}`; ctx.fillStyle = cor("--muted"); ctx.fillText(gs[k].rotulo, gx, y);
      ctx.drawImage(ch.canvas, gx, y + 12, cw[k], ch.canvas.clientHeight);
      gx += cw[k] + gap;
    });
    y += 12 + chH;
    if (ref){ ctx.font = `400 12px ${f}`; ctx.fillStyle = cor("--muted"); ctx.fillText(ref, pad, y + 20); }
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    if (blob) await salvar(`nematoides_${slug(nomeCartao(c))}_${hoje()}.png`, blob);
  }

  function tabelaCartao(c, G){
    const cFaz = dados.cab.findIndex(h => /fazenda/i.test(h));
    const meta = [["Estado",E.cEst],["Cliente",E.cCli],["Fazenda",cFaz],["Talhão",E.cTal],["Padrão",E.cPad]].filter(([,col]) => col >= 0);
    const gs = [...c.graficos.values()];
    const cab = meta.map(m => m[0]).concat("Nº de pontos");
    gs.forEach(g => { cab.push(`${g.rotulo} - AH`, `${g.rotulo} - R`); if (limites(c,g)) cab.push(`${g.rotulo} - Nível AH`, `${g.rotulo} - Nível R`); });
    const rows = G.map(x => {
      const l0 = x.linhas[0], r = meta.map(([,col]) => l0.v[col]);
      r.push(x.linhas.length);
      gs.forEach(g => {
        const lim = limites(c,g);
        const ah = g.AH >= 0 ? media(x.linhas, g.AH) : null, rr = g.R >= 0 ? media(x.linhas, g.R) : null;
        r.push(arred(ah), arred(rr)); if (lim) r.push(nivel(ah, lim), nivel(rr, lim));
      });
      return r;
    });
    return [cab, ...rows];
  }
  function abaXlsx(aoa){
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = aoa[0].map((h,j) => ({wch: Math.max(10, ...aoa.map(r => String(r[j] ?? "").length + 2))}));
    return ws;
  }
  async function excel(indices){
    if (typeof XLSX === "undefined") return avisar("A biblioteca do Excel não carregou. Recarregue a página.", true);
    const linhas = linhasFiltradas(4);
    if (!linhas.length) return avisar("Nenhuma linha corresponde aos filtros.", true);
    const G = grupos(linhas), wb = XLSX.utils.book_new(), usados = new Set();
    indices.forEach(i => {
      const c = E.cards[i];
      let nome = nomeCartao(c).replace(/[\[\]:*?\/\\]/g, "").slice(0, 31), n = 2;
      while (usados.has(nome)) nome = nomeCartao(c).slice(0, 28) + " " + n++;
      usados.add(nome);
      XLSX.utils.book_append_sheet(wb, abaXlsx(tabelaCartao(c, G)), nome);
    });
    const info = [["Filtro","Valor"], ...[["Estado","f-estado"],["Cliente","f-cliente"],["Talhão","f-talhao"],["Padrão","f-padrao"]].map(([n,id]) => [n, $(id).value || "Todos"]),
      [], ["Valores: média dos pontos de cada talhão e padrão. AH = área homogênea; R = reboleira."], ["Planilha de origem: " + ($("nome-arquivo").textContent || "")]];
    const refs = [...new Set(indices.map(i => fonteTexto(E.cards[i])).filter(Boolean))];
    refs.forEach(r => info.push([r]));
    const wsI = XLSX.utils.aoa_to_sheet(info); wsI["!cols"] = [{wch:14},{wch:24}];
    XLSX.utils.book_append_sheet(wb, wsI, "Filtros");
    const buf = XLSX.write(wb, {bookType:"xlsx", type:"array"});
    const nome = indices.length === 1 ? `nematoides_${slug(nomeCartao(E.cards[indices[0]]))}_${hoje()}.xlsx` : `analise_nematoides_${hoje()}.xlsx`;
    await salvar(nome, new Blob([buf]));
  }
  async function ocupado(btn, fn){ btn.classList.add("ocupado"); try{ await fn(); } finally { btn.classList.remove("ocupado"); } }
  $("cartoes").addEventListener("click", e => {
    const b = e.target.closest("button[data-img],button[data-xls]"); if (!b) return;
    if (b.dataset.img !== undefined) ocupado(b, () => imagemCartao(+b.dataset.img));
    else ocupado(b, () => excel([+b.dataset.xls]));
  });
  $("exp-todos").addEventListener("click", e => {
    if (!E.cards.length) return avisar("Nenhuma coluna de nematoide encontrada.", true);
    ocupado(e.currentTarget, () => excel(E.cards.map((_,i) => i)));
  });

  document.addEventListener("dados-atualizados", e => { dados = e.detail; montarFiltros(); renderizar(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderizar);
  new MutationObserver(renderizar).observe(document.documentElement, {attributes:true, attributeFilter:["data-theme"]});

  montarFiltros();
  if (location.hash === "#nematoides") ativar("nematoides");
})();
