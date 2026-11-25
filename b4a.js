/* Guia Microbiologia do Solo (B4A): laudos BioScan importados por planilha, filtrados por Estado, Cliente, Talhão, Padrão e AH/R */
(function(){
  const $ = id => document.getElementById(id);
  const P = $("painel-b4a"); if (!P) return;
  const esc = s => String(s === null || s === undefined ? "" : s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const semAcento = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const norm = s => semAcento(s).replace(/\s+/g, " ").trim().toLowerCase();
  const fp = v => v.toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2}) + "%";
  let laudos = [], erroCarga = null, modo = "ah";

  /* ---------- Estrutura do laudo B4A (BioScan) ---------- */
  const ST = {"ruim":{c:"#F0337A",n:0}, "regular":{c:"#FFB547",n:1}, "ótimo":{c:"#13BF8A",n:2},
              "alto risco":{c:"#F0337A",n:0}, "risco médio":{c:"#FFB547",n:1}, "baixo risco":{c:"#13BF8A",n:2}};
  const LARG = [18, 48, 92];   /* preenchimento da barra pelo status, como no laudo (os limites numéricos são do laboratório) */
  const SECOES = [
    {tit:"Promotores de crescimento", desc:"Bactérias e fungos benéficos que promovem o desenvolvimento das plantas e aumentam sua resistência.", grupos:[
      {tit:"Bactérias benéficas", itens:["Bradyrhizobium","Rhizobium","Azospirillum","Bacillus","Pseudomonas"], donut:{k:"bac", rot:["Controladores","Promotores"], cores:["#2EC4D6","#9FE3D3"]}},
      {tit:"Fungos benéficos", itens:["Trichoderma","Metarhizium","Hirsutella","Glomus"], donut:{k:"fun", rot:["Micorrizas","Controladores","Promotores"], cores:["#2E9E86","#2EC4D6","#9FE3D3"]}}]},
    {tit:"Doenças", desc:"Avaliação de patógenos presentes no solo e microrganismos controladores biológicos que combatem doenças de plantas.", grupos:[
      {tit:"Controladores", itens:["Trichoderma","Beauveria"]},
      {tit:"Patógenos", itens:["Fusarium","Macrophomina","Colletotrichum","Alternaria"]},
      {tit:"Controladores de pragas e nematoides", itens:["Predadores de nematoides","Parasitas de adultos","Parasitas de ovos","Parasitas de insetos"]}]},
    {tit:"Nutrientes", desc:"Microrganismos envolvidos nos ciclos biogeoquímicos e na disponibilização de nutrientes essenciais para as plantas.", grupos:[
      {tit:"Tipos de fertilizantes adequados à microbiota", itens:["Fertilizantes orgânicos","Fertilizantes minerais"]},
      {tit:"Organismos disponibilizadores de nutrientes", itens:["Oxidadores do enxofre","Produtores de sideróforos"]},
      {tit:"Organismos que atuam no ciclo do nitrogênio", itens:["Fixadores de nitrogênio de vida livre","Fixadores de nitrogênio noduladores","Nitrificadores a nitrato","Ácido linoleico","Degradadores de alantoína"]},
      {tit:"Organismos que levam à lixiviação de nitrogênio", itens:["Desnitrificadores aeróbicos","Desnitrificadores anaeróbicos","Nitrificadores a nitrito"]},
      {tit:"Organismos que disponibilizam fósforo", itens:["Produtores de fosfatase ácida","Produtores de fosfatase alcalina","Produtores de exopolifosfatases","Produtores de fosfatase inorgânica","Produtores de ácidos orgânicos","Produtores de fitase"]}]},
    {tit:"Emissões", desc:"Microrganismos relacionados ao ciclo do carbono, incluindo organismos sequestradores e emissores que afetam as emissões de GEE.", grupos:[
      {tit:"Organismos que atuam no ciclo do carbono", itens:["Sequestradores de carbono","Emissores de carbono"]}]},
    {tit:"Estresse", desc:"Organismos que auxiliam as plantas em condições adversas e contribuem para a remediação e agregação do solo.", grupos:[
      {tit:"Organismos que remediam o solo", itens:["Produtores de fitohormônios","Produtores de exopolissacarídeos","Produtores de ACC-deaminase","Degradadores de agroquímicos"]},
      {tit:"Indicadores de estresse", itens:["Anaeróbicos","Formadores de endósporos"]}]}
  ];
  const ITENS = [...new Set(SECOES.flatMap(s => s.grupos.flatMap(g => g.itens)))];
  const GENEROS = /^(Bradyrhizobium|Rhizobium|Azospirillum|Bacillus|Pseudomonas|Trichoderma|Metarhizium|Hirsutella|Glomus|Beauveria|Fusarium|Macrophomina|Colletotrichum|Alternaria)$/;
  const nomeIt = n => GENEROS.test(n) ? `<i>${n}</i>` : n;
  const CATS = [["doencas","doenças"],["nutrientes","nutrientes"],["emissoes","emissões"],["estresse","estresse"]];
  const NOTAS = ["C-","C","C+","B-","B","B+","A-","A","A+"];
  const SUBF = {"ruim":0.17, "regular":0.5, "bom":0.83};

  /* ---------- Carga dos laudos ---------- */
  async function carregar(){
    const sb = window.vnsSB; if (!sb) return;
    const {data, error} = await sb.from("laudos_b4a").select("id,identificacao,estado,cliente,fazenda,talhao,padrao,amostra,safra,dados,criado_em").order("criado_em");
    if (error){ erroCarga = /relation|does not exist|schema cache/i.test(error.message || "") ? "A tabela de laudos B4A ainda não foi criada no banco (arquivo b4a.sql)." : "Erro ao carregar os laudos: " + (error.message || ""); laudos = []; }
    else { erroCarga = null; laudos = data || []; }
    window.vnsLaudosB4A = laudos;
    document.dispatchEvent(new CustomEvent("b4a-atualizados"));
    montarFiltros(); render();
  }
  document.addEventListener("vns-sessao", e => {
    const papel = e.detail && e.detail.papel;
    P.querySelectorAll(".bq-equipe").forEach(b => b.hidden = !(papel === "admin" || papel === "equipe"));
    carregar();
  });

  /* ---------- Filtros ---------- */
  const IDS = [["bq-estado","estado"],["bq-cliente","cliente"],["bq-talhao","talhao"],["bq-padrao","padrao"]];
  function filtrados(ate){
    const f = IDS.slice(0, ate).map(([id,k]) => [k, $(id).value]);
    return laudos.filter(L => f.every(([k,v]) => !v || (L[k] || "") === v));
  }
  function montarFiltros(){
    IDS.forEach(([id,k],i) => {
      const sel = $(id), atual = sel.value, ops = [...new Set(filtrados(i).map(L => L[k]).filter(Boolean))].sort((a,b) => a.localeCompare(b, "pt-BR", {numeric:true}));
      sel.innerHTML = '<option value="">Todos</option>' + ops.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
      sel.value = ops.includes(atual) ? atual : "";
    });
  }
  IDS.forEach(([id]) => $(id).addEventListener("change", () => { montarFiltros(); render(); }));
  P.querySelectorAll(".modo button").forEach(b => b.addEventListener("click", () => {
    modo = b.dataset.modo; P.querySelectorAll(".modo button").forEach(x => x.setAttribute("aria-checked", x === b)); render();
  }));
  const selecionados = () => { const ams = modo === "ambas" ? ["AH","R"] : [modo.toUpperCase()]; return filtrados(4).filter(L => ams.includes(L.amostra || "AH")); };
  const rot = (L, S) => { const pads = new Set(S.map(x => x.padrao)), tals = new Set(S.map(x => x.talhao)), clis = new Set(S.map(x => x.cliente));
    return [clis.size > 1 && L.cliente, tals.size > 1 && L.talhao, (pads.size > 1 || S.length > 1) && L.padrao, L.amostra || "AH"].filter(Boolean).join(" · "); };
  const CORL = ["#1F3D2B","#B8901C","#6E9C7E","#2F6E9E","#8E3B46","#5B4A8B"];

  /* ---------- Desenho ---------- */
  function arco(cx,cy,r,a0,a1,cor,esp){ const p = a => [cx + r*Math.cos(a), cy - r*Math.sin(a)]; const [x0,y0] = p(a0), [x1,y1] = p(a1);
    return `<path d="M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}" fill="none" stroke="${cor}" stroke-width="${esp}" stroke-linecap="round"/>`; }
  function medidor(frac, w, cores, rotE, rotD, txt, cor){
    const cx = w/2, cy = w*0.55, r = w*0.38, esp = w*0.06, n = cores.length; let h = "";
    cores.forEach((c,i) => h += arco(cx,cy,r, Math.PI - i*Math.PI/n, Math.PI - (i+1)*Math.PI/n + 0.03, c, esp));
    if (frac !== null){ const a = Math.PI*(1 - frac); h += `<line x1="${cx}" y1="${cy}" x2="${cx + r*0.8*Math.cos(a)}" y2="${cy - r*0.8*Math.sin(a)}" stroke="${cor}" stroke-width="${w*0.03}" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="${w*0.045}" fill="${cor}"/>`; }
    if (rotE) h += `<text x="${cx - r - esp}" y="${cy + w*0.1}" font-size="${w*0.065}" fill="${cor}" font-family="Georgia,serif">${rotE}</text><text x="${cx + r + esp}" y="${cy + w*0.1}" text-anchor="end" font-size="${w*0.065}" fill="${cor}" font-family="Georgia,serif">${rotD}</text>`;
    if (txt) h += `<text x="${cx}" y="${cy + w*0.22}" text-anchor="middle" font-size="${w*0.16}" fill="${cor}" font-family="Georgia,serif">${esc(txt)}</text>`;
    return `<svg viewBox="0 0 ${w} ${w*0.8}">${h}</svg>`;
  }
  const C4 = ["#F0337A","#FFC24B","#E9D44A","#13BF8A"];
  function barra(par, rotL, cor){
    const am = rotL ? `<span class="bq-am" style="color:${cor}">${esc(rotL)}</span>` : "";
    if (!par) return `<div class="bq-l">${am}<span class="bq-nd-i">não detectado</span></div>`;
    const [st, v] = par, s = ST[st] || {c:"#9AA59D", n:1};
    return `<div class="bq-l">${am}<div class="bq-lc"><span class="bq-st">${esc(st)}${v !== null && v !== undefined ? ` (${fp(v)})` : ""}</span>
      <div class="bq-tr"><i style="width:${LARG[s.n]}%;background:${s.c}"></i><b style="left:25%"></b><b style="left:50%"></b><b style="left:75%"></b></div></div></div>`;
  }
  function donut(vals, cores, tam){
    const t = (vals || []).reduce((a,b) => a + (b || 0), 0); if (!t) return "";
    let a = -Math.PI/2, h = "";
    vals.forEach((v,i) => { if (!v) return; const da = 2*Math.PI*v/t, p = q => `${(60 + 48*Math.cos(q)).toFixed(2)} ${(60 + 48*Math.sin(q)).toFixed(2)}`;
      h += da >= 2*Math.PI - 1e-6 ? `<circle cx="60" cy="60" r="48" fill="none" stroke="${cores[i]}" stroke-width="22"/>` : `<path d="M${p(a)} A48 48 0 ${da > Math.PI ? 1 : 0} 1 ${p(a+da)}" fill="none" stroke="${cores[i]}" stroke-width="22"><title>${fp(100*v/t)}</title></path>`; a += da; });
    return `<svg viewBox="0 0 120 120" style="width:${tam}px;height:${tam}px">${h}</svg>`;
  }

  function render(){
    const vazio = $("bq-vazio"), cont = $("bq-conteudo"), S = selecionados(), varios = S.length > 1;
    const msg = m => { vazio.innerHTML = m; vazio.hidden = false; cont.hidden = true; $("bq-nota").textContent = ""; };
    if (erroCarga) return msg(esc(erroCarga));
    if (!window.vnsSB) return msg("Entre no app para ver os laudos.");
    if (!laudos.length) return msg('Nenhum laudo B4A importado ainda. Use <b>Baixar modelo</b>, preencha uma linha por laudo e clique em <b>Importar laudos</b>.');
    if (!S.length) return msg("Nenhum laudo B4A para os filtros escolhidos.");
    vazio.hidden = true; cont.hidden = false;
    const D = L => L.dados || {}, L0 = S[0];
    $("bq-nota").textContent = `${S.length} ${S.length === 1 ? "laudo" : "laudos"} nos filtros.`;

    $("bq-id").innerHTML = S.map((L,i) => `<div class="bq-idl">${varios ? `<span class="bq-tag" style="background:${CORL[i % CORL.length]}">${esc(rot(L,S))}</span>` : "<span></span>"}
      <div><small>Identificação</small><b>${esc(L.identificacao)}</b></div><div><small>Talhão · Padrão</small><b>${esc(L.talhao || "–")} · ${esc(L.padrao || "–")}</b></div>
      <div><small>Amostra</small><b>${(L.amostra || "AH") === "R" ? "Reboleira" : "Área homogênea"}</b></div><div><small>Cultura</small><b>${esc(D(L).cultura || "–")}</b></div>
      <div><small>Data de coleta</small><b>${esc(D(L).coleta || "–")}</b></div><div><small>Serviço</small><b>${esc(D(L).servico || "–")}</b></div></div>`).join("");

    $("bq-hero").innerHTML = `<div class="bq-hero-g">${S.map(L => { const k = NOTAS.indexOf(D(L).indice); return `<div class="bq-g">${medidor(k >= 0 ? k/8 : null, 200, ["#F0337A","#FFC24B","#E9D44A","#13BF8A","#2EC4D6"], "C-", "A+", D(L).indice || "–", "#FFFFFF")}${varios ? `<span>${esc(rot(L,S))}</span>` : ""}</div>`; }).join("")}</div>
      <div class="bq-hero-t"><h2>Índice B4A de saúde do solo</h2><p>${esc(D(L0).textoIndice || "")}</p>${varios ? `<p class="bq-hero-s">${S.map(L => `<b>${esc(rot(L,S))}</b> ${esc(D(L).indice || "–")}`).join(" · ")}</p>` : ""}</div>`;

    $("bq-sub").innerHTML = CATS.map(([k,n]) => {
      const lista = (arr, vazio) => `<ul>${(arr && arr.length ? arr : [vazio]).map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
      const blocos = (varios ? S : [L0]).map((L,i) => `${varios ? `<div class="bq-pf-tag" style="color:${CORL[i % CORL.length]}">${esc(rot(L,S))}</div>` : ""}
        <div class="bq-pf"><span>pontos fortes ↑</span>${lista((D(L).fortes || {})[k], `Sem pontos fortes relacionados a ${n}`)}</div>
        <div class="bq-pf bq-fr"><span>pontos fracos ↓</span>${lista((D(L).fracos || {})[k], `Sem pontos fracos relacionados a ${n}`)}</div>`).join("");
      return `<div class="bq-cat"><h3>${n}</h3><div class="bq-cat-g">${S.map(L => { const v = (D(L).sub || {})[k]; return `<div>${medidor(v in SUBF ? SUBF[v] : null, 90, C4, "", "", "", "#1B2620")}<span>${varios ? esc(rot(L,S)) + ": " : ""}${esc(v || "–")}</span></div>`; }).join("")}</div>${blocos}</div>`;
    }).join("");

    $("bq-secoes").innerHTML = SECOES.map(sec => `<div class="bq-sec"><h2>${sec.tit}</h2><p>${sec.desc}</p></div>
      <div class="bq-grupos bq-g${Math.min(sec.grupos.length, 3)}">${sec.grupos.map(g => {
        const det = g.itens.filter(it => S.some(L => (D(L).itens || {})[it])), nd = g.itens.filter(it => S.every(L => !(D(L).itens || {})[it]));
        const itens = det.map(it => `<div class="bq-item"><div class="bq-it"><b>${nomeIt(it)}</b></div>${S.map((L,i) => barra((D(L).itens || {})[it], varios ? rot(L,S) : "", CORL[i % CORL.length])).join("")}</div>`).join("");
        const temDn = g.donut && S.some(L => (D(L).donuts || {})[g.donut.k]);
        const dn = temDn ? `<div class="bq-dn">${S.map(L => `<div>${donut((D(L).donuts || {})[g.donut.k], g.donut.cores, varios ? 90 : 130)}${varios ? `<span>${esc(rot(L,S))}</span>` : ""}</div>`).join("")}
          <ul class="bq-leg">${g.donut.rot.map((r,i) => `<li><i style="background:${g.donut.cores[i]}"></i>${r}</li>`).join("")}</ul></div>` : "";
        return `<div class="bq-grupo"><h3>${g.tit}</h3><div class="${temDn ? "bq-com-dn" : ""}"><div>${itens}${nd.length ? `<div class="bq-nd">Não detectados<br><span>${nd.map(nomeIt).join(", ")}</span></div>` : ""}</div>${dn}</div></div>`;
      }).join("")}</div>`).join("");

    if (varios){
      let h = `<div class="bq-sec bq-sec-ouro"><h2>Comparação entre laudos</h2><p>Todos os itens lado a lado; linhas com status diferente entre os laudos ficam destacadas.</p></div>
        <div class="grade bq-grade"><table class="tab-bio bq-tab"><thead><tr><th>Seção</th><th>Item</th>${S.map((L,i) => `<th><span class="bq-tag" style="background:${CORL[i % CORL.length]}">${esc(rot(L,S))}</span></th>`).join("")}</tr></thead><tbody>`;
      const vistos = new Set();
      SECOES.forEach(sec => sec.grupos.forEach(g => g.itens.forEach(it => { if (vistos.has(it)) return; vistos.add(it);
        const sts = S.map(L => { const p = (D(L).itens || {})[it]; return p ? p[0] : "nd"; }), dif = new Set(sts).size > 1;
        h += `<tr${dif ? ' class="bq-dif"' : ""}><td>${sec.tit}</td><td>${nomeIt(it)}</td>${S.map(L => { const p = (D(L).itens || {})[it];
          return `<td>${p ? `<span class="bq-chip" style="background:${(ST[p[0]] || {c:"#9AA59D"}).c}">${esc(p[0])}</span> ${p[1] !== null && p[1] !== undefined ? fp(p[1]) : ""}` : '<span class="bq-nd-i">não detectado</span>'}</td>`; }).join("")}</tr>`;
      })));
      $("bq-comp").innerHTML = h + "</tbody></table></div>";
    } else $("bq-comp").innerHTML = "";

    const tab = (tit, k) => `<div class="bq-btab"><h3>${tit}</h3>${S.map((L,i) => { const b = (D(L).bio || {})[k] || {lista:[]};
      return `${varios ? `<div class="bq-tag" style="background:${CORL[i % CORL.length]};display:inline-block;margin-top:6px">${esc(rot(L,S))}</div>` : ""}
        <div class="bq-busca"><input type="search" placeholder="Digite o nome do organismo…" data-k="${k}" data-i="${i}">
        <div class="seletor" data-k="${k}" data-i="${i}"><button type="button" data-o="pct" aria-checked="true">Porcentagem</button><button type="button" data-o="az" aria-checked="false">Alfabética</button></div></div>
        <p class="nota" data-n="${k}${i}"></p>
        <div class="bq-tt-box"><table class="bq-tt"><thead><tr><th>Posição</th><th>Organismo</th><th class="n">Porcentagem</th></tr></thead><tbody data-k="${k}" data-i="${i}"></tbody></table></div>`; }).join("")}</div>`;
    $("bq-bio").innerHTML = tab("Bactérias", "bact") + tab("Fungos", "fung");
    P.querySelectorAll("#bq-bio tbody").forEach(tb => linhasBio(tb.dataset.k, +tb.dataset.i));
  }
  const ordBio = {};
  function linhasBio(k, i){
    const L = selecionados()[i]; if (!L) return;
    const b = ((L.dados || {}).bio || {})[k] || {lista:[]}, q = norm((P.querySelector(`#bq-bio input[data-k="${k}"][data-i="${i}"]`) || {}).value || "");
    let lista = (b.lista || []).map((x,j) => [x[0], x[1], j + 1]).filter(x => !q || norm(x[0]).includes(q));
    if (ordBio[k + i] === "az") lista.sort((a,c) => a[0].localeCompare(c[0], "pt-BR"));
    const mostra = lista.slice(0, 200);
    P.querySelector(`#bq-bio tbody[data-k="${k}"][data-i="${i}"]`).innerHTML = mostra.length ? mostra.map(x => `<tr><td>#${x[2]}</td><td><i>${esc(x[0])}</i></td><td class="n">${fp(x[1])}</td></tr>`).join("") : '<tr><td colspan="3" class="bq-nd-i">Sem organismos na lista.</td></tr>';
    const n = P.querySelector(`[data-n="${k}${i}"]`); if (n) n.textContent = `Mostrando ${mostra.length} de ${b.total || (b.lista || []).length} organismos${q ? " (busca)" : ""}`;
  }
  P.addEventListener("input", e => { const inp = e.target.closest("#bq-bio input[type=search]"); if (inp) linhasBio(inp.dataset.k, +inp.dataset.i); });
  P.addEventListener("click", e => { const b = e.target.closest("#bq-bio .seletor button"); if (!b) return; const s = b.parentNode;
    ordBio[s.dataset.k + s.dataset.i] = b.dataset.o; s.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", x === b)); linhasBio(s.dataset.k, +s.dataset.i); });

  /* ---------- Planilha-modelo e importação ---------- */
  const dlP = (window.claude && typeof window.claude.use === "function") ? window.claude.use("downloads").catch(() => null) : Promise.resolve(undefined);
  function avisar(m, erro){ const a = $("aviso"); a.textContent = m; a.className = "aviso" + (erro ? " erro" : ""); a.hidden = false; clearTimeout(avisar.t); avisar.t = setTimeout(() => a.hidden = true, 4500); }
  async function salvar(nome, blob){
    const dl = await dlP;
    if (dl){ try{ await dl.save({filename:nome, data:blob}); } catch(e){ if (e && e.code === "declined") return; avisar(e && e.code === "rate_limited" ? "Já há um arquivo aguardando confirmação. Tente de novo em instantes." : "Não foi possível salvar o arquivo aqui.", true); } return; }
    if (window.claude) return avisar("Exportação indisponível nesta visualização.", true);
    const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  const COL_ID = ["Identificação","Nome cliente","Estado","Fazenda","Talhão","Padrão","Amostra (AH/R)","Safra","Cultura","Data de coleta","Serviço","Índice B4A","Texto do índice","Doenças","Nutrientes","Emissões","Estresse"];
  const COL_PF = CATS.flatMap(([k,n]) => [`Pontos fortes – ${n}`, `Pontos fracos – ${n}`]);
  const COL_DN = ["Bactérias – Controladores (%)","Bactérias – Promotores (%)","Fungos – Micorrizas (%)","Fungos – Controladores (%)","Fungos – Promotores (%)","Total de bactérias","Total de fungos"];
  const COL_IT = ITENS.flatMap(it => [`${it} – status`, `${it} – %`]);
  $("bq-modelo").addEventListener("click", async () => {
    if (typeof XLSX === "undefined") return avisar("A biblioteca do Excel não carregou. Recarregue a página.", true);
    const wb = XLSX.utils.book_new(), cab = [...COL_ID, ...COL_PF, ...COL_DN, ...COL_IT];
    const ws = XLSX.utils.aoa_to_sheet([cab]); ws["!cols"] = cab.map(c => ({wch: Math.min(40, Math.max(12, c.length + 2))}));
    XLSX.utils.book_append_sheet(wb, ws, "Laudos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Identificação","Amostra (AH/R)","Grupo (Bactérias/Fungos)","Organismo","Porcentagem"]]), "Biodiversidade");
    const inst = [["Como preencher"], [],
      ["Laudos", "Uma linha por laudo. Identificação, Nome cliente, Talhão e Padrão iguais aos da guia Dados. Amostra: AH ou R."],
      ["Índice B4A", "C-, C, C+, B-, B, B+, A-, A ou A+"],
      ["Doenças … Estresse", "bom, regular ou ruim"],
      ["Pontos fortes/fracos", "Textos do laudo separados por ponto e vírgula (;)"],
      ["<item> – status", "ruim, regular, ótimo, baixo risco, risco médio, alto risco. Deixe em branco (ou “não detectado”) quando o laudo listar o item em “Não detectados”."],
      ["<item> – %", "Porcentagem do laudo (ex.: 3,49)"],
      ["Bactérias/Fungos (%)", "Proporções dos gráficos de rosca (opcional)"],
      ["Biodiversidade", "Uma linha por organismo da tabela taxonômica (opcional): identificação do laudo, amostra, grupo, organismo e %."]];
    const wi = XLSX.utils.aoa_to_sheet(inst); wi["!cols"] = [{wch:24},{wch:110}]; XLSX.utils.book_append_sheet(wb, wi, "Instruções");
    await salvar("modelo_laudos_b4a.xlsx", new Blob([XLSX.write(wb, {bookType:"xlsx", type:"array"})]));
  });

  const STATUS = {"ruim":"ruim","regular":"regular","otimo":"ótimo","baixo risco":"baixo risco","risco baixo":"baixo risco","risco medio":"risco médio","medio risco":"risco médio","alto risco":"alto risco","risco alto":"alto risco"};
  const numPct = v => { if (v === null || v === undefined || v === "") return null; if (typeof v === "number") return v < 1 && v > 0 && String(v).length > 4 ? v * 100 : v;
    const n = parseFloat(String(v).replace("%", "").replace(/\./g, "").replace(",", ".")); return isFinite(n) ? n : null; };
  const lista = v => String(v || "").split(";").map(s => s.trim()).filter(Boolean);
  function lerLinhas(ws){
    const aoa = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:null, blankrows:false}); if (!aoa.length) return [];
    const cab = aoa[0].map(h => norm(String(h || "").replace(/[–—]/g, "-")));
    return aoa.slice(1).map(r => { const o = {}; cab.forEach((h,j) => o[h] = r[j]); return o; });
  }
  const pega = (o, nome) => o[norm(nome.replace(/[–—]/g, "-"))];
  function converter(wb){
    const nomeAba = wb.SheetNames.find(n => norm(n) === "laudos") || wb.SheetNames[0];
    const linhas = lerLinhas(wb.Sheets[nomeAba]).filter(o => pega(o, "Identificação"));
    const bioAba = wb.SheetNames.find(n => norm(n) === "biodiversidade");
    const bio = bioAba ? lerLinhas(wb.Sheets[bioAba]) : [];
    const erros = [], out = [];
    linhas.forEach((o, idx) => {
      const id = String(pega(o, "Identificação")).trim(), am = String(pega(o, "Amostra (AH/R)") || "AH").trim().toUpperCase() === "R" ? "R" : "AH";
      const itens = {};
      ITENS.forEach(it => { const st = norm(pega(o, `${it} – status`)); const pc = numPct(pega(o, `${it} – %`));
        if (!st || st === "nao detectado" || st === "nd"){ itens[it] = null; return; }
        if (!STATUS[st]){ erros.push(`Linha ${idx + 2}: status “${pega(o, `${it} – status`)}” não reconhecido em ${it}.`); itens[it] = null; return; }
        itens[it] = [STATUS[st], pc]; });
      const sub = {}; CATS.forEach(([k,n]) => { const v = norm(pega(o, n)); sub[k] = ["bom","regular","ruim"].includes(v) ? v : null; });
      const fortes = {}, fracos = {}; CATS.forEach(([k,n]) => { fortes[k] = lista(pega(o, `Pontos fortes – ${n}`)); fracos[k] = lista(pega(o, `Pontos fracos – ${n}`)); });
      const dn = COL_DN.slice(0,5).map(c => numPct(pega(o, c)));
      const b = k => { const ls = bio.filter(x => String(pega(x, "Identificação") || "").trim() === id && (String(pega(x, "Amostra (AH/R)") || "AH").trim().toUpperCase() === "R" ? "R" : "AH") === am && norm(pega(x, "Grupo (Bactérias/Fungos)")).startsWith(k))
        .map(x => [String(pega(x, "Organismo") || "").trim(), numPct(pega(x, "Porcentagem")) || 0]).filter(x => x[0]).sort((a,c) => c[1] - a[1]); return ls; };
      const indice = String(pega(o, "Índice B4A") || "").trim().toUpperCase().replace("−", "-");
      if (indice && !NOTAS.includes(indice)) erros.push(`Linha ${idx + 2}: índice “${indice}” não reconhecido.`);
      out.push({identificacao:id, cliente:String(pega(o, "Nome cliente") || "").trim(), estado:String(pega(o, "Estado") || "").trim(), fazenda:String(pega(o, "Fazenda") || "").trim(),
        talhao:String(pega(o, "Talhão") || "").trim(), padrao:String(pega(o, "Padrão") || "").trim(), amostra:am, safra:String(pega(o, "Safra") || "").trim(),
        dados:{cultura:pega(o, "Cultura") || "", coleta: dataTxt(pega(o, "Data de coleta")), servico:pega(o, "Serviço") || "", indice: NOTAS.includes(indice) ? indice : "",
          textoIndice:pega(o, "Texto do índice") || "", sub, fortes, fracos, itens,
          donuts:{bac: dn[0] !== null || dn[1] !== null ? [dn[0] || 0, dn[1] || 0] : null, fun: dn.slice(2).some(v => v !== null) ? dn.slice(2).map(v => v || 0) : null},
          bio:{bact:{total: numPct(pega(o, "Total de bactérias")) || null, lista:b("bact")}, fung:{total: numPct(pega(o, "Total de fungos")) || null, lista:b("fung")}}}});
    });
    return {laudos:out, erros};
  }
  const dataTxt = v => v instanceof Date ? v.toLocaleDateString("pt-BR") : (typeof v === "number" && v > 20000 && v < 80000 ? new Date(Math.round((v - 25569) * 864e5)).toLocaleDateString("pt-BR", {timeZone:"UTC"}) : String(v || ""));
  $("bq-entrada").addEventListener("change", e => {
    const arq = e.target.files[0]; e.target.value = ""; if (!arq) return;
    if (typeof XLSX === "undefined") return avisar("A biblioteca do Excel não carregou. Recarregue a página.", true);
    const rd = new FileReader();
    rd.onload = async ev => {
      let r; try { r = converter(XLSX.read(new Uint8Array(ev.target.result), {type:"array", cellDates:true})); } catch(err){ return avisar("Não foi possível ler a planilha.", true); }
      if (!r.laudos.length) return avisar("Nenhum laudo encontrado na planilha (a coluna Identificação está vazia?).", true);
      const txt = `Importar ${r.laudos.length} ${r.laudos.length === 1 ? "laudo" : "laudos"} B4A?` + (r.erros.length ? `\n\nAtenção:\n${r.erros.slice(0,8).join("\n")}${r.erros.length > 8 ? `\n… e mais ${r.erros.length - 8}` : ""}` : "") + "\n\nLaudos já salvos com a mesma identificação, cliente e amostra serão substituídos.";
      if (!confirm(txt)) return;
      const {data, error} = await window.vnsSB.rpc("salvar_laudos_b4a", {p_laudos: r.laudos});
      if (error) return avisar("Erro ao salvar os laudos: " + (error.message || ""), true);
      avisar(`${data || r.laudos.length} ${r.laudos.length === 1 ? "laudo salvo" : "laudos salvos"}.`);
      carregar();
    };
    rd.readAsArrayBuffer(arq);
  });
  $("bq-excel").addEventListener("click", async () => {
    const S = selecionados(); if (!S.length) return;
    if (typeof XLSX === "undefined") return avisar("A biblioteca do Excel não carregou. Recarregue a página.", true);
    const aoa = [["Seção","Item", ...S.flatMap(L => [`${rot(L,S) || L.identificacao} – status`, `${rot(L,S) || L.identificacao} – %`])]];
    const vistos = new Set();
    SECOES.forEach(sec => sec.grupos.forEach(g => g.itens.forEach(it => { if (vistos.has(it)) return; vistos.add(it);
      aoa.push([sec.tit, it, ...S.flatMap(L => { const p = ((L.dados || {}).itens || {})[it]; return p ? [p[0], p[1]] : ["não detectado", null]; })]); })));
    const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = aoa[0].map((c,j) => ({wch: j < 2 ? 34 : 18}));
    XLSX.utils.book_append_sheet(wb, ws, "Itens");
    const info = [["Laudo","Talhão","Padrão","Amostra","Índice B4A","Doenças","Nutrientes","Emissões","Estresse"], ...S.map(L => [L.identificacao, L.talhao, L.padrao, L.amostra, (L.dados || {}).indice, ...CATS.map(([k]) => ((L.dados || {}).sub || {})[k])])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), "Resumo");
    await salvar(`microbiologia_b4a_${new Date().toISOString().slice(0,10)}.xlsx`, new Blob([XLSX.write(wb, {bookType:"xlsx", type:"array"})]));
  });

  if (window.vnsPerfil){ document.dispatchEvent(new CustomEvent("vns-sessao", {detail:window.vnsPerfil})); }
  montarFiltros(); render();
  if (location.hash === "#b4a") $("guia-b4a").click();
})();
