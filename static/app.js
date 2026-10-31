// THEME
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme',theme);
  document.getElementById('themeIcon').textContent=theme==='light'?'🌙':'☀️';
  document.getElementById('themeLabel').textContent=theme==='light'?'Oscuro':'Claro';
  localStorage.setItem('theme',theme);
}
function toggleTheme(){
  const current=document.documentElement.getAttribute('data-theme')||'dark';
  applyTheme(current==='dark'?'light':'dark');
  // Rebuild charts and heatmaps with new theme colors
  if(stats.trends){renderTrendChart();renderVolumeChart()}
  if(stats.endings)renderEndingsSection();
  if(stats.position_frequency){renderPositionGrids();renderHeatmap()}
  if(stats.by_category)renderRadarChart();
  if(allSorteos.length)renderScatterChart();
}
(function(){const saved=localStorage.getItem('theme');if(saved)applyTheme(saved)})();

// STATE
let allSorteos=[], stats={}, currentPage=1;
const PER_PAGE=50;
let currentPrize='primero', currentStatsPrize='primero';
let useML=false;
let trendChartInstance=null, volumeChartInstance=null, endingsTrendChartInstance=null;

const CAT_LABELS={dominical:'Dominical',miercolito:'Miercolito',gordito:'Gordito del Zodiaco',extraordinario:'Extraordinario',extraordinaria:'Extraordinaria',zodiaco:'Zodiaco',extraordonario:'Extraordonario'};
function catLabel(k){return CAT_LABELS[k]||k.charAt(0).toUpperCase()+k.slice(1)}
function formatDate(d){if(!d)return'—';return new Date(d+'T00:00:00').toLocaleDateString('es-PA',{year:'numeric',month:'short',day:'numeric'})}

// TOAST
function showToast(msg,ms=2500){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),ms)}

// COPY
function copyNumber(num){navigator.clipboard.writeText(num).then(()=>{showToast('Copiado: '+num);document.querySelectorAll(`.copy-btn[data-num="${num}"]`).forEach(b=>{b.classList.add('copied');b.textContent='OK';setTimeout(()=>{b.classList.remove('copied');b.textContent='Copiar'},1500)})})}

// INIT
document.addEventListener('DOMContentLoaded',async()=>{initTabs();await loadData()});

// Keyboard navigation helper for tablists
function initTablistKeyboard(container){
  const tabs=Array.from(container.querySelectorAll('[role="tab"]'));
  if(!tabs.length)return;
  container.addEventListener('keydown',e=>{
    const cur=tabs.indexOf(document.activeElement);
    if(cur<0)return;
    let next=-1;
    if(e.key==='ArrowRight'||e.key==='ArrowDown'){next=(cur+1)%tabs.length;e.preventDefault();}
    else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){next=(cur-1+tabs.length)%tabs.length;e.preventDefault();}
    else if(e.key==='Home'){next=0;e.preventDefault();}
    else if(e.key==='End'){next=tabs.length-1;e.preventDefault();}
    if(next>=0){tabs[next].focus();tabs[next].click();}
  });
  // Only first tab in set should be in tab order
  tabs.forEach((t,i)=>t.setAttribute('tabindex',i===0?'0':'-1'));
}

function activateNavTab(tab){
  const navTabs=document.getElementById('navTabs');
  navTabs.querySelectorAll('.nav-tab').forEach(t=>{
    t.classList.remove('active');
    t.setAttribute('aria-selected','false');
    t.setAttribute('tabindex','-1');
  });
  tab.classList.add('active');
  tab.setAttribute('aria-selected','true');
  tab.setAttribute('tabindex','0');
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.getElementById('sec-'+tab.dataset.tab).classList.add('active');
  if(tab.dataset.tab==='precision') loadBacktesting();
  if(tab.dataset.tab==='seguimiento') loadSeguimiento();
  if(tab.dataset.tab==='gaps') loadGaps();
  triggerReveals();
}

function initTabs(){
  const navTabs=document.getElementById('navTabs');
  navTabs.querySelectorAll('.nav-tab').forEach(tab=>{
    tab.addEventListener('click',()=>activateNavTab(tab));
  });
  initTablistKeyboard(navTabs);

  // Prize tabs keyboard nav
  document.querySelectorAll('.prize-tabs').forEach(pt=>initTablistKeyboard(pt));

  // Cat tabs keyboard nav
  const catTabs=document.getElementById('recoCatTabs');
  if(catTabs)initTablistKeyboard(catTabs);
}

function skelCard(lines=3){
  const ls=Array.from({length:lines},(_,i)=>`<div class="skel-line ${i===0?'thick w60':i%2===0?'w80':'w40'}"></div>`).join('');
  return`<div class="skeleton">${ls}</div>`;
}
function showSkeletons(){
  document.getElementById('loader').style.display='none';
  document.getElementById('content').style.display='block';
  // Fill key containers with skeletons
  const recoEl=document.getElementById('recoContainer');
  if(recoEl)recoEl.innerHTML=`<div class="skel-grid">${skelCard(4)+skelCard(4)+skelCard(4)+skelCard(4)}</div>`;
  const statEl=document.getElementById('statCounters');
  if(statEl)statEl.innerHTML=`<div class="skel-grid">${skelCard(2)+skelCard(2)+skelCard(2)+skelCard(2)}</div>`;
  const decEl=document.getElementById('decenaContainer');
  if(decEl)decEl.innerHTML=`<div class="skel-grid">${skelCard(5)+skelCard(5)}</div>`;
}

async function loadData(){
  showSkeletons();
  // Phase 1: Load sorteos fast (lightweight endpoint)
  try{
    const sRes=await fetch('/api/sorteos?all=true');
    const sData=await sRes.json();
    allSorteos=sData.data||sData;
    renderQuick();
  }catch(e){console.error('Error loading sorteos:',e)}
  // Phase 2: Load stats (heavy ML computation — may take >60s on first load)
  const loadStats=async(attempt=1)=>{
    try{
      const stRes=await fetch('/api/stats',{signal:AbortSignal.timeout(180000)});
      stats=await stRes.json();
      renderFull();
    }catch(e){
      if(attempt<3){console.warn(`Stats attempt ${attempt} failed, retrying...`);return loadStats(attempt+1);}
      console.error('Error loading stats:',e);
    }
  };
  await loadStats();
  triggerReveals();
}

function renderQuick(){
  // Immediate renders that only need sorteos data
  renderLastUpdate();renderSorteos();renderPagination();
  renderScatterChart();initFilters();
}

function renderFull(){
  // Full renders once stats are available
  renderLastUpdate();buildCategoryUI();renderStatCounters();
  renderRecommendations('all');renderDecenas();renderStatsForPrize('primero');renderSeriesLetras();renderFormatos();
  renderRadarChart();renderScatterChart();
  renderPositionGrids();renderHeatmap();renderTrendChart();renderVolumeChart();
  renderEndingsSection();renderMonthlySection();renderFavorites();initSimCats();renderDashboard();
  initRecoCatTabs();initPrizeTabs();initStatsPrizeTabs();
}

// LAST UPDATE
function renderLastUpdate(){
  const lu=stats.last_update||(allSorteos[0]&&allSorteos[0].fecha)||'';
  if(lu){
    document.getElementById('lastUpdate').textContent='Última actualización: '+formatDate(lu);
    document.getElementById('footerText').innerHTML=`Lotería de Panamá — Análisis Estadístico © 2026 &nbsp;·&nbsp; ${allSorteos.length.toLocaleString()} sorteos históricos &nbsp;·&nbsp; Actualizado: ${formatDate(lu)}`;
  }
}

// CATEGORY UI
function buildCategoryUI(){
  const cats=[...new Set(allSorteos.map(s=>s.cat).filter(Boolean))];
  const tc=document.getElementById('recoCatTabs');
  cats.forEach(c=>{const b=document.createElement('button');b.className='cat-tab';b.dataset.cat=c;b.textContent=catLabel(c);tc.appendChild(b)});
  const sel=document.getElementById('catFilter');
  cats.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=catLabel(c);sel.appendChild(o)});
}

// STAT COUNTERS
function renderStatCounters(){
  const cats={};allSorteos.forEach(s=>{cats[s.cat]=(cats[s.cat]||0)+1});
  let h=`<div class="stat-card"><div class="stat-value">${allSorteos.length.toLocaleString()}</div><div class="stat-label">Total Sorteos</div></div>`;
  for(const[cat,count]of Object.entries(cats))h+=`<div class="stat-card"><div class="stat-value">${count.toLocaleString()}</div><div class="stat-label">${catLabel(cat)}</div></div>`;
  document.getElementById('statCounters').innerHTML=h;
}

// TABLE + PAGINATION
function getFilteredSorteos(){
  const q=document.getElementById('searchInput').value.trim(),cat=document.getElementById('catFilter').value,df=document.getElementById('dateFrom').value,dt=document.getElementById('dateTo').value;
  let d=allSorteos;
  if(cat!=='all')d=d.filter(s=>s.cat===cat);
  if(q)d=d.filter(s=>[s.primero,s.segundo,s.tercero].some(n=>(n||'').includes(q)));
  if(df)d=d.filter(s=>s.fecha>=df);if(dt)d=d.filter(s=>s.fecha<=dt);
  return d;
}
function renderSorteos(){
  const data=getFilteredSorteos(),start=(currentPage-1)*PER_PAGE,page=data.slice(start,start+PER_PAGE);
  document.getElementById('sorteosBody').innerHTML=page.map(s=>`<tr>
    <td>${formatDate(s.fecha)}</td><td><span class="cat-pill cat-${s.cat}">${catLabel(s.cat)}</span></td>
    <td class="num-cell">${(s.primero||'')}</td><td class="num-cell">${(s.segundo||'')}</td><td class="num-cell">${(s.tercero||'')}</td>
    <td>${s.letra||'—'}</td><td>${s.serie||'—'}</td><td>${s.folio||'—'}</td></tr>`).join('');
  renderPagination();
}
function renderPagination(){
  const total=getFilteredSorteos().length,tp=Math.ceil(total/PER_PAGE);
  if(tp<=1){document.getElementById('pagination').innerHTML='';return}
  let h=`<button class="page-btn" onclick="goPage(1)" ${currentPage===1?'disabled':''}>«</button><button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;
  let s=Math.max(1,currentPage-3),e=Math.min(tp,currentPage+3);
  if(s>1)h+='<span class="page-info">…</span>';
  for(let i=s;i<=e;i++)h+=`<button class="page-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
  if(e<tp)h+='<span class="page-info">…</span>';
  h+=`<button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage>=tp?'disabled':''}>›</button><button class="page-btn" onclick="goPage(${tp})" ${currentPage>=tp?'disabled':''}>»</button>`;
  h+=`<span class="page-info">${total.toLocaleString()} resultados</span>`;
  document.getElementById('pagination').innerHTML=h;
}
function goPage(p){const t=getFilteredSorteos().length,tp=Math.ceil(t/PER_PAGE);currentPage=Math.max(1,Math.min(p,tp));renderSorteos();document.querySelector('.table-wrap').scrollTop=0}

// FILTERS
function initFilters(){
  const h=()=>{currentPage=1;renderSorteos()};
  ['searchInput','catFilter','dateFrom','dateTo'].forEach(id=>document.getElementById(id).addEventListener(id==='searchInput'?'input':'change',h));
}

// CSV EXPORT
function exportCSV(){
  const data=getFilteredSorteos();
  let csv='Fecha,Categoria,1er Premio,2do Premio,3er Premio,Letras,Serie,Folio\n';
  data.forEach(s=>{csv+=`${s.fecha},${s.cat},${(s.primero||'')},${(s.segundo||'')},${(s.tercero||'')},${s.letra||''},${s.serie||''},${s.folio||''}\n`});
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`sorteos_panama_${new Date().toISOString().slice(0,10)}.csv`;a.click();
  showToast(`CSV exportado: ${data.length} registros`);
}

// AUTO-UPDATE
async function runUpdate(){
  const btn=document.getElementById('updateBtn');
  btn.disabled=true;btn.textContent='↻ Actualizando…';
  try{
    let token=sessionStorage.getItem('updateToken');
    if(!token){token=prompt('Token de actualización (ACTUALIZAR_TOKEN):');}
    if(!token){btn.disabled=false;btn.textContent='↻ Actualizar datos';return;}
    const res=await fetch('/api/actualizar',{method:'POST',headers:{'X-Update-Token':token}});
    const data=await res.json();
    if(res.status===401){sessionStorage.removeItem('updateToken');}
    else{sessionStorage.setItem('updateToken',token);}
    if(data.ok){
      showToast(data.ml_retrained===false?'Datos actualizados (el modelo ML no se pudo reentrenar)':'Datos actualizados correctamente',3000);
      await loadData();
    }else{showToast('Error: '+(data.error||'desconocido'),4000)}
  }catch(e){showToast('Error de conexión',3000)}
  btn.disabled=false;btn.textContent='↻ Actualizar datos';
}

// PRIZE TABS
function _setAriaTab(container,active){
  container.querySelectorAll('[role="tab"]').forEach(t=>{
    t.classList.remove('active');
    t.setAttribute('aria-selected','false');
    t.setAttribute('tabindex','-1');
  });
  active.classList.add('active');
  active.setAttribute('aria-selected','true');
  active.setAttribute('tabindex','0');
}
function initPrizeTabs(){
  const wrap=document.getElementById('prizeTabs');
  wrap.querySelectorAll('.prize-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      _setAriaTab(wrap,tab);currentPrize=tab.dataset.prize;
      renderRecommendations(document.querySelector('#recoCatTabs .cat-tab.active').dataset.cat);
    });
  });
}
function initStatsPrizeTabs(){
  const wrap=document.getElementById('statsPrizeTabs');
  wrap.querySelectorAll('.prize-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      _setAriaTab(wrap,tab);renderStatsForPrize(tab.dataset.prize);triggerReveals();
    });
  });
}
function initRecoCatTabs(){
  const wrap=document.getElementById('recoCatTabs');
  wrap.querySelectorAll('.cat-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      _setAriaTab(wrap,tab);renderRecommendations(tab.dataset.cat);
    });
  });
}

// ML TOGGLE
function toggleML(){
  useML=!useML;
  document.querySelectorAll('.ml-toggle').forEach(b=>{
    b.classList.toggle('active',useML);
    b.textContent=useML?'🤖 ML Activo':'📊 Estadístico';
    b.setAttribute('aria-pressed',String(useML));
  });
  renderRecommendations(document.querySelector('#recoCatTabs .cat-tab.active').dataset.cat);
  renderEndingsSection();
  // Show ML info badge
  const info=stats.ml_info||{};
  if(useML&&info.trained)showToast(`ML: ${info.train_samples} muestras · Entrenado: ${info.train_date}`,3000);
}

// RECOMMENDATIONS
function renderRecommendations(cat){
  const container=document.getElementById('recoContainer');
  let recos;
  if(useML){
    // ML recommendations
    if(cat==='all'){
      const mlp=stats.ml_prizes&&stats.ml_prizes[currentPrize];
      recos=mlp||stats.ml_recommendations||[];
    }else{
      recos=(stats.by_category&&stats.by_category[cat]&&stats.by_category[cat].ml_recommendations)||[];
    }
  }else{
    // Statistical recommendations
    const pd=stats.prizes&&stats.prizes[currentPrize];
    if(cat==='all')recos=(pd&&pd.recommendations)||stats.recommendations||[];
    else recos=(currentPrize==='primero'&&stats.by_category&&stats.by_category[cat])?stats.by_category[cat].recommendations||[]:[];
  }
  if(!recos.length){container.innerHTML='<p style="color:var(--text-muted);text-align:center;padding:40px;">No hay suficientes datos para esta combinación.</p>';return}
  const pl={primero:'1er Premio',segundo:'2do Premio',tercero:'3er Premio'}[currentPrize];
  const method=useML?'🤖 Machine Learning':'📊 Estadístico';
  const ranks=['1ro','2do','3ro','4to','5to'];
  container.innerHTML=`<div style="margin-bottom:12px;font-size:0.8rem;color:var(--text-muted);">Recomendaciones para <strong style="color:var(--gold-300)">${pl}</strong> — <span style="color:${useML?'var(--accent-green)':'var(--gold-400)'};">${method}</span></div>
    <div class="reco-grid">${recos.map((r,i)=>`<div class="reco-card"${useML?' style="border-color:rgba(52,211,153,0.3);"':''}>
      <button class="copy-btn" data-num="${r.number}" onclick="copyNumber('${r.number}')">Copiar</button>
      <div class="reco-rank">${ranks[i]||(i+1)+'to'} Recomendado</div>
      <div class="reco-number">${r.number}</div>
      <div class="reco-confidence"><div class="conf-bar"><div class="conf-bar-fill" style="width:${Math.min(r.confidence,100)}%;${useML?'background:linear-gradient(90deg,var(--accent-green),#6ee7b7);':''}"></div></div>${r.confidence}%</div>
    </div>`).join('')}</div>`;
  requestAnimationFrame(()=>{container.querySelectorAll('.conf-bar-fill').forEach(b=>{const w=b.style.width;b.style.width='0%';requestAnimationFrame(()=>{b.style.width=w})})});
}

// DECENA RECOMMENDATION
function renderDecenas(){
  const dr=stats.decena_recomendada||{};
  const cats=Object.keys(dr);
  if(!cats.length){document.getElementById('decenaContainer').innerHTML='<p style="color:var(--text-muted);text-align:center;padding:40px;">No hay suficientes datos para análisis de decenas.</p>';return}
  const methodLabel={triple:'Patrón de 3 sorteos',pair:'Patrón de 2 sorteos',fallback:'Frecuencia general'};
  let h='<div class="decena-grid">';
  cats.forEach(cat=>{
    const d=dr[cat];
    const dist=d.follower_distribution||{};
    const maxDist=Math.max(...Object.values(dist),1);
    h+=`<div class="card reveal decena-card">
      <div class="card-header"><div class="card-title">${catLabel(cat)}</div><span class="card-badge badge-gold">${methodLabel[d.method]||d.method}</span></div>
      <div class="decena-body">
        <div class="triangle-wrap">
          <svg viewBox="0 0 200 190" class="triangle-svg">
            <!-- Outer triangle -->
            <polygon points="100,10 15,175 185,175" fill="none" stroke="var(--accent-cold)" stroke-width="3"/>
            <!-- Inner triangle -->
            <polygon points="100,50 45,155 155,155" fill="rgba(212,175,55,0.15)" stroke="var(--gold-400)" stroke-width="2.5"/>
            <!-- Inner filled triangle for recommended -->
            <polygon points="100,80 70,140 130,140" fill="rgba(212,175,55,0.3)" stroke="var(--gold-300)" stroke-width="2"/>
            <!-- Last 3 decenas at corners -->
            <circle cx="100" cy="10" r="18" fill="var(--accent-cold)"/>
            <text x="100" y="16" text-anchor="middle" fill="#fff" font-size="18" font-weight="700" font-family="var(--font-mono)">${d.last_3[2]}</text>
            <circle cx="15" cy="175" r="18" fill="var(--accent-cold)"/>
            <text x="15" y="181" text-anchor="middle" fill="#fff" font-size="18" font-weight="700" font-family="var(--font-mono)">${d.last_3[0]}</text>
            <circle cx="185" cy="175" r="18" fill="var(--accent-cold)"/>
            <text x="185" y="181" text-anchor="middle" fill="#fff" font-size="18" font-weight="700" font-family="var(--font-mono)">${d.last_3[1]}</text>
            <!-- Recommended in center -->
            <circle cx="100" cy="120" r="24" fill="var(--gold-400)"/>
            <text x="100" y="128" text-anchor="middle" fill="var(--bg-deep)" font-size="24" font-weight="900" font-family="var(--font-mono)">${d.recommended}</text>
          </svg>
          <div class="triangle-label">DECENAS</div>
        </div>
        <div class="decena-info">
          <div class="decena-main">
            <div class="decena-rec-label">Decena recomendada</div>
            <div class="decena-rec-number">${d.recommended}</div>
            <div class="decena-confidence">${d.confidence}% confianza · ${d.match_count} coincidencias</div>
          </div>
          <div class="decena-last3">
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;">Últimos 3 sorteos:</div>
            ${d.last_3.map((dec,i)=>`<div class="decena-last3-row"><span class="decena-fecha">${formatDate(d.last_3_fechas[i])}</span><span class="decena-val">${dec}</span></div>`).join('')}
          </div>
          <div class="decena-dist">
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;">Distribución:</div>
            ${Object.entries(dist).map(([digit,count])=>`<div class="bar-row" style="gap:6px;"><span class="bar-label" style="width:20px;font-size:0.75rem;">${digit}</span><div class="bar-track" style="height:20px;"><div class="bar-fill ${digit===d.recommended?'gold':'green'}" style="width:${(count/maxDist*100).toFixed(1)}%">${count||''}</div></div></div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  });
  h+='</div>';
  document.getElementById('decenaContainer').innerHTML=h;
  triggerReveals();
}

// STATS FOR PRIZE
function renderStatsForPrize(prize){
  const pd=(stats.prizes&&stats.prizes[prize])||{};
  const df=pd.digit_frequency||stats.digit_frequency||{};
  const ldp=pd.last_digit_pairs||stats.last_digit_pairs||{};
  const hc=pd.hot_cold||stats.hot_cold||{hot:[],cold:[]};
  const dMax=Math.max(...Object.values(df),1);
  document.getElementById('digitChart').innerHTML=Object.entries(df).map(([d,c])=>`<div class="bar-row"><span class="bar-label">${d}</span><div class="bar-track"><div class="bar-fill gold" style="width:${(c/dMax*100).toFixed(1)}%">${c}</div></div></div>`).join('');
  const ent=Object.entries(ldp).slice(0,12),eMax=Math.max(...ent.map(e=>e[1]),1);
  document.getElementById('endingsChart').innerHTML=ent.map(([n,c])=>`<div class="bar-row"><span class="bar-label">${n}</span><div class="bar-track"><div class="bar-fill green" style="width:${(c/eMax*100).toFixed(1)}%">${c}</div></div></div>`).join('');
  const hMax=Math.max(...hc.hot.map(h=>h.count),1),cMax=Math.max(...hc.cold.map(h=>h.count),1);
  document.getElementById('hotChart').innerHTML=hc.hot.map(h=>`<div class="bar-row"><span class="bar-label">${h.number}</span><div class="bar-track"><div class="bar-fill hot" style="width:${(h.count/hMax*100).toFixed(1)}%">${h.count}</div></div></div>`).join('');
  document.getElementById('coldChart').innerHTML=hc.cold.map(h=>`<div class="bar-row"><span class="bar-label">${h.number}</span><div class="bar-track"><div class="bar-fill cold" style="width:${(h.count/cMax*100).toFixed(1)}%">${h.count}</div></div></div>`).join('');
}
function renderSeriesLetras(){
  const sf=stats.series_folio||{},series=sf.series||[],letras=stats.letras||[];
  const sMax=Math.max(...series.map(s=>s.count),1);
  document.getElementById('seriesChart').innerHTML=series.map(s=>`<div class="bar-row"><span class="bar-label">${s.value}</span><div class="bar-track"><div class="bar-fill gold" style="width:${(s.count/sMax*100).toFixed(1)}%">${s.count}</div></div></div>`).join('');
  const lMax=Math.max(...letras.map(l=>l.count),1);
  document.getElementById('letrasChart').innerHTML=letras.map(l=>`<div class="bar-row"><span class="bar-label">${l.letra}</span><div class="bar-track"><div class="bar-fill green" style="width:${(l.count/lMax*100).toFixed(1)}%">${l.count}</div></div></div>`).join('');
}

// ==================== OTHER PRIZE FORMATS (2 and 5 digits) ====================
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderFormatos(){
  const el=document.getElementById('formatosGrid');if(!el)return;
  const f=stats.formatos||{};
  const names={'2':'2 cifras','5':'5 cifras'},posNames={'2':['Decenas','Unidades'],'5':['Dec. millar','Millares','Centenas','Decenas','Unidades']};
  const prizeNames={primero:'1ro',segundo:'2do',tercero:'3ro'};
  el.innerHTML=['2','5'].map(w=>{
    const d=f[w];
    if(!d||!d.total)return`<div><h4 class="card-title">${names[w]}</h4><p class="section-subtitle">Sin premios de este formato.</p></div>`;
    const cats=Object.entries(d.by_category||{}).map(([c,n])=>`${esc(c)} (${n})`).join(', ');
    const prizes=Object.entries(d.by_prize||{}).map(([p,n])=>`${prizeNames[p]||esc(p)}: ${n}`).join(' · ');
    const range=d.date_range?`${esc(d.date_range.from)} → ${esc(d.date_range.to)}`:'';
    const grids=(d.position_frequency||[]).map((pos,idx)=>{
      const max=Math.max(...Object.values(pos),1);
      const cells=Object.entries(pos).map(([dg,c])=>{const i=c/max;return`<div class="pos-cell" style="background:rgba(212,175,55,${(i*0.6+0.05).toFixed(2)});color:${i>0.5?(isLight()?'#fff':'var(--bg-deep)'):'var(--text-primary)'}" title="${posNames[w][idx]}: dígito ${dg} — ${c} veces">${dg}<br><small style="font-size:0.6rem;opacity:0.7">${c}</small></div>`}).join('');
      return`<div style="margin-top:0.75rem"><small class="section-subtitle">${posNames[w][idx]}</small><div class="pos-grid">${cells}</div></div>`;
    }).join('');
    const hot=(d.hot_cold&&d.hot_cold.hot)||[],hMax=Math.max(...hot.map(h=>h.count),1);
    const hotBars=hot.map(h=>`<div class="bar-row"><span class="bar-label">${esc(h.number)}</span><div class="bar-track"><div class="bar-fill hot" style="width:${(h.count/hMax*100).toFixed(1)}%">${h.count}</div></div></div>`).join('');
    return`<div aria-label="Estadísticas de premios de ${names[w]}">
      <h4 class="card-title">${names[w]} — ${d.total} premios</h4>
      <p class="section-subtitle">${cats}<br>${prizes}<br>${range}</p>
      ${grids}
      <h4 class="card-title" style="margin-top:1rem">Más frecuentes</h4>
      <div class="bar-chart" role="img" aria-label="Números de ${names[w]} más frecuentes">${hotBars}</div>
    </div>`;
  }).join('');
}

// ==================== RADAR & SCATTER CHARTS ====================
let radarChartInstance=null, scatterChartInstance=null;

function renderRadarChart(){
  const byCat=stats.by_category||{};
  const mainCats=['dominical','miercolito','gordito'];
  const available=mainCats.filter(c=>byCat[c]&&byCat[c].digit_frequency);
  if(!available.length)return;
  const labels=['0','1','2','3','4','5','6','7','8','9'];
  const catColors={dominical:['#ffd700','rgba(255,215,0,0.15)'],miercolito:['#34d399','rgba(52,211,153,0.15)'],gordito:['#ff4d4d','rgba(255,77,77,0.15)']};
  const datasets=available.map(cat=>{
    const df=byCat[cat].digit_frequency;
    const total=Object.values(df).reduce((a,b)=>a+b,0)||1;
    return{
      label:catLabel(cat),data:labels.map(d=>(df[d]||0)/total*100),
      borderColor:catColors[cat]?catColors[cat][0]:'#c084fc',backgroundColor:catColors[cat]?catColors[cat][1]:'rgba(192,132,252,0.15)',
      borderWidth:2,pointRadius:4,pointHoverRadius:7,pointBackgroundColor:catColors[cat]?catColors[cat][0]:'#c084fc',
    };
  });
  const ctx=document.getElementById('radarChart').getContext('2d');
  if(radarChartInstance)radarChartInstance.destroy();
  const light=isLight();
  radarChartInstance=new Chart(ctx,{
    type:'radar',data:{labels:labels.map(d=>'Dígito '+d),datasets},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{color:light?'#5c554a':'#8a8693',font:{family:'DM Sans',size:11},boxWidth:12,padding:16}},
        tooltip:{backgroundColor:light?'#fff':'#111118',borderColor:light?'rgba(139,105,20,0.2)':'#d4af3740',borderWidth:1,titleColor:light?'#1a1612':'#f0ece2',bodyColor:light?'#5c554a':'#8a8693',
          callbacks:{label:function(c){return c.dataset.label+': '+c.raw.toFixed(1)+'%'}}}},
      scales:{r:{angleLines:{color:light?'rgba(139,105,20,0.1)':'rgba(212,175,55,0.08)'},grid:{color:light?'rgba(139,105,20,0.1)':'rgba(212,175,55,0.08)'},
        pointLabels:{color:light?'#5c554a':'#8a8693',font:{family:'DM Sans',size:11}},
        ticks:{display:false},beginAtZero:true}},
    },
  });
}

function renderScatterChart(){
  if(!allSorteos.length)return;
  const points=allSorteos.slice(0,500).filter(s=>(s.primero||'').length===4&&(s.segundo||'').length===4).map(s=>({x:parseInt(s.primero)||0,y:parseInt(s.segundo)||0}));
  if(!points.length)return;
  const ctx=document.getElementById('scatterChart').getContext('2d');
  if(scatterChartInstance)scatterChartInstance.destroy();
  const light=isLight();
  scatterChartInstance=new Chart(ctx,{
    type:'scatter',data:{datasets:[{
      label:'1er vs 2do Premio',data:points,
      backgroundColor:light?'rgba(184,134,11,0.35)':'rgba(255,215,0,0.3)',
      borderColor:light?'rgba(184,134,11,0.6)':'rgba(255,215,0,0.5)',
      borderWidth:1,pointRadius:3,pointHoverRadius:6,
    }]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        tooltip:{backgroundColor:light?'#fff':'#111118',borderColor:light?'rgba(139,105,20,0.2)':'#d4af3740',borderWidth:1,titleColor:light?'#1a1612':'#f0ece2',bodyColor:light?'#5c554a':'#8a8693',
          callbacks:{label:function(c){return'1ro: '+String(c.raw.x).padStart(4,'0')+' — 2do: '+String(c.raw.y).padStart(4,'0')}}}},
      scales:{
        x:{title:{display:true,text:'1er Premio',color:light?'#5c554a':'#8a8693',font:{family:'DM Sans',size:12}},ticks:{color:light?'#9a9189':'#4a4656',font:{family:'JetBrains Mono',size:10}},grid:{color:light?'rgba(139,105,20,0.08)':'rgba(212,175,55,0.06)'}},
        y:{title:{display:true,text:'2do Premio',color:light?'#5c554a':'#8a8693',font:{family:'DM Sans',size:12}},ticks:{color:light?'#9a9189':'#4a4656',font:{family:'JetBrains Mono',size:10}},grid:{color:light?'rgba(139,105,20,0.08)':'rgba(212,175,55,0.06)'}},
      },
    },
  });
}

// ==================== ENDINGS SECTION ====================
function renderEndingsSection(){
  const ed=stats.endings||{};
  // Recommendations — ML or Statistical
  const recos=useML?(stats.ml_endings||[]):(ed.recommendations||[]);
  const isEnding=!useML; // statistical uses 'ending' key, ML uses 'ending' key too
  const ranks=['1ro','2do','3ro','4to','5to','6to','7mo','8vo','9no','10mo'];
  const method=useML?'🤖 Machine Learning':'📊 Estadístico';
  document.getElementById('endingsRecoContainer').innerHTML=`
    <div style="margin-bottom:12px;font-size:0.8rem;color:var(--text-muted);">Terminaciones recomendadas — <span style="color:${useML?'var(--accent-green)':'var(--gold-400)'};">${method}</span></div>
    <div class="reco-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));">${recos.map((r,i)=>`<div class="reco-card" style="padding:20px 16px;${useML?'border-color:rgba(52,211,153,0.3);':''}">
      <button class="copy-btn" data-num="${r.ending}" onclick="copyNumber('${r.ending}')">Copiar</button>
      <div class="reco-rank">${ranks[i]||(i+1)+'to'} Terminación</div>
      <div class="reco-number" style="font-size:2.2rem;">${r.ending}</div>
      <div class="reco-confidence"><div class="conf-bar"><div class="conf-bar-fill" style="width:${Math.min(r.confidence,100)}%;${useML?'background:linear-gradient(90deg,var(--accent-green),#6ee7b7);':''}"></div></div>${r.confidence}%</div>
    </div>`).join('')}</div>`;
  requestAnimationFrame(()=>{document.getElementById('endingsRecoContainer').querySelectorAll('.conf-bar-fill').forEach(b=>{const w=b.style.width;b.style.width='0%';requestAnimationFrame(()=>{b.style.width=w})})});

  // Hot/Cold
  const hc=ed.hot_cold||{hot:[],cold:[]};
  const hMax=Math.max(...hc.hot.map(h=>h.count),1),cMax=Math.max(...hc.cold.map(h=>h.count),1);
  document.getElementById('endingsHotChart').innerHTML=hc.hot.map(h=>`<div class="bar-row"><span class="bar-label">${h.ending}</span><div class="bar-track"><div class="bar-fill hot" style="width:${(h.count/hMax*100).toFixed(1)}%">${h.count}</div></div></div>`).join('');
  document.getElementById('endingsColdChart').innerHTML=hc.cold.map(h=>`<div class="bar-row"><span class="bar-label">${h.ending}</span><div class="bar-track"><div class="bar-fill cold" style="width:${(h.count/cMax*100).toFixed(1)}%">${h.count}</div></div></div>`).join('');

  // By prize
  const bp=ed.by_prize||{};
  renderPrizeEndings('endP1Chart',bp.primero||[],'gold');
  renderPrizeEndings('endP2Chart',bp.segundo||[],'green');
  renderPrizeEndings('endP3Chart',bp.tercero||[],'purple');

  // Heatmap 10x10
  renderEndingsHeatmap(ed.frequency||{});

  // Trend chart
  renderEndingsTrendChart(ed.trends||[]);
}

function renderPrizeEndings(id,data,cls){
  const max=Math.max(...data.map(d=>d.count),1);
  document.getElementById(id).innerHTML=data.slice(0,10).map(d=>`<div class="bar-row"><span class="bar-label">${d.ending}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${(d.count/max*100).toFixed(1)}%">${d.count}</div></div></div>`).join('');
}

function renderEndingsHeatmap(freq){
  const vals=Object.values(freq);const max=Math.max(...vals,1);
  let h='<div style="display:flex;gap:4px;margin-bottom:6px;padding-left:28px;">';
  for(let c=0;c<10;c++)h+=`<div style="flex:1;text-align:center;font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted);">x${c}</div>`;
  h+='</div>';
  for(let r=0;r<10;r++){
    h+=`<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">`;
    h+=`<div style="width:24px;text-align:right;font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted);">${r}x</div>`;
    for(let c=0;c<10;c++){
      const key=String(r)+String(c);const v=freq[key]||0;const i=v/max;
      const bg=`rgba(212,175,55,${(i*0.65+0.04).toFixed(2)})`;
      const col=i>0.4?(isLight()?'#fff':'#0a0a0f'):(isLight()?'#1a1612':'#f0ece2');
      h+=`<div class="ending-cell" style="flex:1;background:${bg};color:${col}" title="${key}: ${v} veces">${key}<br><small style="font-size:0.55rem;opacity:0.7">${v}</small></div>`;
    }
    h+='</div>';
  }
  document.getElementById('endingsHeatmap').innerHTML=h;
}

const ENDING_COLORS=['#ffd700','#ff4d4d','#4dabff','#34d399','#c084fc','#ff9f43','#ee5a6f','#0abde3','#10ac84','#f368e0'];

function renderEndingsTrendChart(trends){
  if(!trends.length)return;
  const labels=trends.map(t=>t.month);
  const endings=Object.keys(trends[0].endings||{});
  const datasets=endings.map((e,i)=>({
    label:e,data:trends.map(t=>(t.endings||{})[e]||0),
    borderColor:ENDING_COLORS[i%10],backgroundColor:ENDING_COLORS[i%10]+'20',
    tension:0.4,borderWidth:2,pointRadius:3,pointHoverRadius:6,
  }));
  const ctx=document.getElementById('endingsTrendChart').getContext('2d');
  if(endingsTrendChartInstance)endingsTrendChartInstance.destroy();
  endingsTrendChartInstance=new Chart(ctx,{type:'line',data:{labels,datasets},options:chartOpts()});
}

// POSITION ANALYSIS
function renderPositionGrids(){
  const pf=stats.position_frequency||[];const posLabels=['Millares','Centenas','Decenas','Unidades'];
  document.getElementById('positionGrids').innerHTML=pf.map((pos,idx)=>{
    const max=Math.max(...Object.values(pos),1);
    const cells=Object.entries(pos).map(([d,c])=>{const i=c/max;return`<div class="pos-cell" style="background:rgba(212,175,55,${(i*0.6+0.05).toFixed(2)});color:${i>0.5?(isLight()?'#fff':'var(--bg-deep)'):'var(--text-primary)'}" title="${posLabels[idx]}: dígito ${d} — ${c} veces">${d}<br><small style="font-size:0.6rem;opacity:0.7">${c}</small></div>`}).join('');
    return`<div class="card reveal"><div class="card-header"><div class="card-title">${posLabels[idx]}</div><span class="card-badge badge-gold">Pos ${idx+1}</span></div><div class="pos-grid">${cells}</div></div>`;
  }).join('');
}
function renderHeatmap(){
  const pf=stats.position_frequency||[];if(!pf.length)return;
  const posLabels=['Millares','Centenas','Decenas','Unidades'];let allMax=0;
  pf.forEach(p=>{Object.values(p).forEach(v=>{if(v>allMax)allMax=v})});
  let h='<table style="width:100%;border-collapse:collapse;"><thead><tr><th style="padding:10px;color:var(--text-muted);font-size:0.72rem;"></th>';
  for(let d=0;d<10;d++)h+=`<th style="padding:10px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:0.82rem;">${d}</th>`;
  h+='</tr></thead><tbody>';
  pf.forEach((pos,idx)=>{h+=`<tr><td style="padding:10px;color:var(--text-secondary);font-size:0.82rem;font-weight:600;">${posLabels[idx]}</td>`;
    for(let d=0;d<10;d++){const v=pos[String(d)]||0;const i=v/(allMax||1);h+=`<td style="padding:10px;text-align:center;font-family:var(--font-mono);font-size:0.85rem;font-weight:600;background:rgba(${Math.round(212*i)},${Math.round(175*i)},${Math.round(55*i)},${(i*0.5+0.03).toFixed(2)});border-radius:8px;color:${i>0.4?(isLight()?'#fff':'#0a0a0f'):(isLight()?'#1a1612':'#f0ece2')};cursor:default;" title="${posLabels[idx]} dígito ${d}: ${v}">${v}</td>`}h+='</tr>'});
  h+='</tbody></table>';document.getElementById('heatmap').innerHTML=h;
}

// TREND CHARTS
const DIGIT_COLORS=['#ffd700','#ff4d4d','#4dabff','#34d399','#c084fc','#ff9f43','#ee5a6f','#0abde3','#10ac84','#f368e0'];
function isLight(){return document.documentElement.getAttribute('data-theme')==='light'}
function chartOpts(legend=true){const light=isLight();const textCol=light?'#5c554a':'#8a8693';const mutedCol=light?'#9a9189':'#4a4656';const gridCol=light?'rgba(139,105,20,0.1)':'rgba(212,175,55,0.06)';const tipBg=light?'#ffffff':'#111118';const tipBorder=light?'rgba(139,105,20,0.2)':'#d4af3740';const tipTitle=light?'#1a1612':'#f0ece2';return{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:legend,position:'bottom',labels:{color:textCol,font:{family:'DM Sans',size:11},boxWidth:12,padding:16}},tooltip:{backgroundColor:tipBg,borderColor:tipBorder,borderWidth:1,titleColor:tipTitle,bodyColor:textCol}},scales:{x:{ticks:{color:mutedCol,font:{family:'DM Sans',size:10}},grid:{color:gridCol}},y:{ticks:{color:mutedCol,font:{family:'JetBrains Mono',size:10}},grid:{color:gridCol}}}}}
function renderTrendChart(){
  const t=stats.trends||[];if(!t.length)return;
  const ds=[];for(let d=0;d<10;d++)ds.push({label:'Dígito '+d,data:t.map(x=>x.digits[String(d)]||0),borderColor:DIGIT_COLORS[d],backgroundColor:DIGIT_COLORS[d]+'20',tension:0.4,borderWidth:2,pointRadius:3,pointHoverRadius:6});
  const ctx=document.getElementById('trendChart').getContext('2d');
  if(trendChartInstance)trendChartInstance.destroy();
  trendChartInstance=new Chart(ctx,{type:'line',data:{labels:t.map(x=>x.month),datasets:ds},options:chartOpts()});
}
function renderVolumeChart(){
  const t=stats.trends||[];if(!t.length)return;
  const data=t.map(x=>x.sorteos);
  const ctx=document.getElementById('volumeChart').getContext('2d');
  if(volumeChartInstance)volumeChartInstance.destroy();
  volumeChartInstance=new Chart(ctx,{type:'bar',data:{labels:t.map(x=>x.month),datasets:[{label:'Sorteos por mes',data,backgroundColor:data.map((_,i)=>`rgba(${Math.round(212-50*i/data.length)},${Math.round(175-30*i/data.length)},${Math.round(55+100*i/data.length)},0.7)`),borderColor:'rgba(212,175,55,0.3)',borderWidth:1,borderRadius:6}]},options:chartOpts(false)});
}

// DASHBOARD SUMMARY
function renderDashboard(){
  if(!allSorteos||!allSorteos.length||!stats)return;
  const last=allSorteos[0];
  const recs=stats.recommendations||[];
  const mlRecs=stats.ml_recommendations||[];
  const topRec=recs[0];
  const topML=mlRecs[0];

  // Hot decena: most frequent last-2-digit ending from current year draws
  const hotDecena=(()=>{
    const year=new Date().getFullYear().toString();
    const counter={};
    (allSorteos||[]).forEach(s=>{
      if(!s.fecha||!s.fecha.startsWith(year))return;
      ['primero','segundo','tercero'].forEach(p=>{
        const n=s[p]||'';
        if(!n)return;
        const ending=n.slice(-2);
        counter[ending]=(counter[ending]||0)+1;
      });
    });
    let best='00',bestC=0;
    Object.entries(counter).forEach(([e,c])=>{if(c>bestC){bestC=c;best=e;}});
    return {ending:best,count:bestC};
  })();

  let h=`<div class="stat-cards">
    <div class="stat-card">
      <div class="stat-label">Último Sorteo</div>
      <div style="font-size:0.85rem;color:var(--gold-300);font-weight:600;text-transform:capitalize;">${last.cat||last.tipo}</div>
      <div style="font-size:0.8rem;color:var(--text-muted);">${last.fecha}</div>
      <div style="display:flex;gap:8px;margin-top:6px;font-family:'JetBrains Mono';font-size:0.9rem;">
        <span style="color:var(--gold-400);" title="1er Premio">${(last.primero||'')}</span>
        <span style="color:#4ade80;" title="2do Premio">${(last.segundo||'')}</span>
        <span style="color:#c084fc;" title="3er Premio">${(last.tercero||'')}</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Top Recomendación</div>
      <div style="font-family:'JetBrains Mono';font-size:1.6rem;font-weight:700;color:var(--gold-400);">${topRec?topRec.number:'—'}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);">📊 Estadístico · ${topRec?topRec.confidence+'%':'—'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Top ML</div>
      <div style="font-family:'JetBrains Mono';font-size:1.6rem;font-weight:700;color:#4ade80;">${topML?topML.number:'—'}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);">🤖 Machine Learning · ${topML?topML.confidence+'%':'—'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Terminación Más Caliente</div>
      <div style="font-family:'JetBrains Mono';font-size:2rem;font-weight:700;color:#ff4d4d;">${hotDecena.ending}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);">${hotDecena.count} veces en ${new Date().getFullYear()}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Sorteos</div>
      <div style="font-size:1.6rem;font-weight:700;color:var(--text-primary);">${stats.total_sorteos?.toLocaleString()||'—'}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);">Desde 1919</div>
    </div>
  </div>`;
  document.getElementById('dashboardSummary').innerHTML=h;
}

// COMPARADOR
let compNumbers=[];
function addCompNumber(){
  const input=document.getElementById('compInput');
  const num=input.value.trim().padStart(4,'0');
  if(!/^\d{4}$/.test(num)){showToast('Ingresa un número de 4 dígitos',3000);return;}
  if(compNumbers.includes(num)){showToast(`${num} ya está en la lista`,2000);return;}
  if(compNumbers.length>=5){showToast('Máximo 5 números',2000);return;}
  compNumbers.push(num);
  input.value='';
  renderCompTags();
  runComparison();
}
function removeCompNumber(num){
  compNumbers=compNumbers.filter(n=>n!==num);
  renderCompTags();
  if(compNumbers.length)runComparison();
  else document.getElementById('compResults').innerHTML='';
}
function clearCompNumbers(){
  compNumbers=[];
  renderCompTags();
  document.getElementById('compResults').innerHTML='';
}
function renderCompTags(){
  const COMP_COLORS=['#ffd700','#4ade80','#c084fc','#4dabff','#ff9f43'];
  document.getElementById('compTags').innerHTML=compNumbers.map((n,i)=>
    `<span style="display:inline-flex;align-items:center;gap:6px;background:${COMP_COLORS[i]}20;border:1px solid ${COMP_COLORS[i]};color:${COMP_COLORS[i]};padding:4px 12px;border-radius:20px;font-family:'JetBrains Mono';font-weight:600;">${n} <button onclick="removeCompNumber('${n}')" style="background:none;border:none;color:inherit;cursor:pointer;font-size:1rem;line-height:1;">✕</button></span>`
  ).join('');
}
let compChartInstance=null;
async function runComparison(){
  if(!compNumbers.length)return;
  const url=`/api/comparar?numeros=${compNumbers.join(',')}`;
  document.getElementById('compResults').innerHTML='<div class="loader-wrap" style="padding:40px;"><div class="spinner"></div><p>Comparando...</p></div>';
  try{
    const res=await fetch(url);
    const d=await res.json();
    if(d.error){showToast(d.error,3000);return;}
    renderCompResults(d);
  }catch(e){showToast('Error en comparación',3000);}
}
function renderCompResults(d){
  const COMP_COLORS=['#ffd700','#4ade80','#c084fc','#4dabff','#ff9f43'];
  const nums=d.numbers||[];
  if(!nums.length)return;

  // Summary table
  let h=`<div class="card reveal" style="margin-top:20px;">
    <div class="card-header"><h3 class="card-title">Comparación</h3><span class="card-badge badge-gold">${nums.length} números</span></div>
    <div style="overflow-x:auto;">
    <table class="heatmap-table" role="table">
      <thead><tr><th>Métrica</th>`;
  nums.forEach((n,i)=>{h+=`<th style="color:${COMP_COLORS[i]};font-family:'JetBrains Mono';">${n.number}</th>`;});
  h+='</tr></thead><tbody>';

  // Rows
  const rows=[
    {label:'Aciertos Exactos',key:'total_exact'},
    {label:'1er Premio',fn:n=>n.exact.primero},
    {label:'2do Premio',fn:n=>n.exact.segundo},
    {label:'3er Premio',fn:n=>n.exact.tercero},
    {label:'Coincid. Terminación',key:'ending_matches'},
    {label:'Frecuencia %',key:'frequency_pct',fmt:v=>v+'%'},
    {label:'Última Aparición',key:'last_appearance',fmt:v=>v||'Nunca'},
    {label:'Gap (sorteos)',key:'gap',fmt:v=>v!==null?v:'—'},
    {label:'Mejor Mes',fn:n=>`${n.best_month} (${n.best_month_count})`},
  ];

  rows.forEach(r=>{
    h+=`<tr><td style="font-weight:600;white-space:nowrap;">${r.label}</td>`;
    nums.forEach((n,i)=>{
      let v=r.fn?r.fn(n):(n[r.key]??'—');
      if(r.fmt)v=r.fmt(v);
      // Highlight best
      let style='text-align:center;font-family:"JetBrains Mono";';
      h+=`<td style="${style}">${v}</td>`;
    });
    h+='</tr>';
  });
  h+='</tbody></table></div></div>';

  // Monthly distribution chart
  h+=`<div class="card reveal" style="margin-top:20px;">
    <div class="card-header"><h3 class="card-title">Distribución Mensual</h3><span class="card-badge badge-green">Por Mes</span></div>
    <div class="chart-container"><canvas id="compMonthlyChart" role="img" aria-label="Distribución mensual comparativa"></canvas></div>
  </div>`;

  document.getElementById('compResults').innerHTML=h;
  triggerReveals();

  // Render monthly chart
  const MONTHS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const datasets=nums.map((n,i)=>({
    label:n.number,
    data:MONTHS.map(m=>n.monthly[m]||0),
    backgroundColor:COMP_COLORS[i]+'60',
    borderColor:COMP_COLORS[i],
    borderWidth:2,
    borderRadius:4,
  }));
  const ctx=document.getElementById('compMonthlyChart');
  if(ctx){
    if(compChartInstance)compChartInstance.destroy();
    compChartInstance=new Chart(ctx.getContext('2d'),{type:'bar',data:{labels:MONTHS,datasets},options:chartOpts()});
  }
}

// GAPS ANALYSIS
async function loadGaps(){
  const container=document.getElementById('gapsContent');
  if(!container)return;
  if(container.dataset.loaded==='1'){return;}
  container.innerHTML='<div class="loader-wrap" style="padding:40px;"><div class="spinner"></div><p>Calculando gaps...</p></div>';
  try{
    const res=await fetch('/api/gaps');
    const d=await res.json();
    renderGaps(d);
    container.dataset.loaded='1';
  }catch(e){container.innerHTML='<p style="color:#f87171;">Error cargando gaps</p>';}
}
function renderGaps(d){
  const ov=d.overdue_numbers||[];
  const ot=d.ontime_numbers||[];
  const ovEnd=d.overdue_endings||[];

  let h=`<div class="grid-2" style="margin-bottom:20px;">
    <div class="stat-card"><div class="stat-value">${d.total_sorteos?.toLocaleString()}</div><div class="stat-label">Sorteos Analizados</div></div>
    <div class="stat-card"><div class="stat-value" style="color:#f87171;">${ov.length}</div><div class="stat-label">Números "Vencidos"</div></div>
  </div>`;

  // Overdue numbers
  h+=`<div class="card reveal">
    <div class="card-header"><h3 class="card-title">Números Vencidos</h3><span class="card-badge badge-hot">Ratio > 1</span></div>
    <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:12px;">Números frecuentes (5+ apariciones) cuyo gap actual supera su promedio histórico. <strong>Ratio</strong> = gap actual ÷ gap promedio.</p>
    <div style="overflow-x:auto;">
    <table class="heatmap-table" role="table">
      <thead><tr><th>Número</th><th>Gap Actual</th><th>Gap Promedio</th><th>Ratio</th><th>Total</th><th>Estado</th></tr></thead><tbody>`;
  ov.forEach(g=>{
    const severity=g.ratio>=2?'#ef4444':g.ratio>=1.5?'#f97316':'#eab308';
    const bar=Math.min(g.ratio/3*100,100);
    h+=`<tr>
      <td style="font-family:'JetBrains Mono';font-weight:700;color:var(--gold-400);">${g.number}</td>
      <td style="text-align:center;font-family:'JetBrains Mono';">${g.gap}</td>
      <td style="text-align:center;font-family:'JetBrains Mono';">${g.avg_gap}</td>
      <td style="text-align:center;"><span style="background:${severity}30;color:${severity};padding:2px 8px;border-radius:8px;font-weight:700;font-family:'JetBrains Mono';">${g.ratio}x</span></td>
      <td style="text-align:center;">${g.count}</td>
      <td><div style="background:var(--surface-2);border-radius:4px;height:8px;width:80px;"><div style="background:${severity};height:100%;border-radius:4px;width:${bar}%;"></div></div></td>
    </tr>`;
  });
  h+='</tbody></table></div></div>';

  // Overdue endings
  h+=`<div class="card reveal" style="margin-top:20px;">
    <div class="card-header"><h3 class="card-title">Terminaciones Vencidas</h3><span class="card-badge badge-hot">Ratio > 1</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;">`;
  ovEnd.forEach(e=>{
    const severity=e.ratio>=2?'#ef4444':e.ratio>=1.5?'#f97316':'#eab308';
    h+=`<div style="background:var(--surface-2);padding:10px 16px;border-radius:12px;text-align:center;min-width:80px;border-left:3px solid ${severity};">
      <div style="font-family:'JetBrains Mono';font-size:1.3rem;font-weight:700;color:var(--text-primary);">${e.ending}</div>
      <div style="font-size:0.7rem;color:var(--text-muted);">Gap: ${e.gap}</div>
      <div style="font-size:0.75rem;font-weight:600;color:${severity};">${e.ratio}x</div>
    </div>`;
  });
  h+='</div></div>';

  // On-time numbers (recently appeared)
  h+=`<div class="card reveal" style="margin-top:20px;">
    <div class="card-header"><h3 class="card-title">Números Recientes</h3><span class="card-badge badge-green">Ratio ≤ 1</span></div>
    <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:12px;">Números frecuentes que aparecieron recientemente (dentro de su ciclo promedio).</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">`;
  ot.slice(0,20).forEach(g=>{
    h+=`<span style="background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);padding:6px 12px;border-radius:10px;font-family:'JetBrains Mono';font-size:0.85rem;">
      ${g.number} <small style="color:var(--text-muted);">gap:${g.gap} · ${g.ratio}x</small>
    </span>`;
  });
  h+='</div></div>';

  document.getElementById('gapsContent').innerHTML=h;
  triggerReveals();
}

// MONTHLY RECOMMENDATION
let monthlyProfileChartInstance=null;
function renderMonthlySection(){
  const mr=stats.monthly_reco;if(!mr)return;

  // --- Target month hero card ---
  const target=mr.target_month_name;
  const recs=mr.recommendations||[];
  let h=`<div class="card reveal" style="border:2px solid var(--gold-400);">
    <div class="card-header">
      <h3 class="card-title">📅 ${target} ${mr.target_year}</h3>
      <span class="card-badge badge-gold">${mr.target_draws_historical} sorteos históricos</span>
    </div>
    <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:16px;">
      Basado en <strong style="color:var(--gold-300)">${mr.target_numbers_historical.toLocaleString()}</strong> números que salieron en <strong style="color:var(--gold-300)">${target}</strong> desde 1995.
    </p>`;
  if(recs.length){
    h+='<div class="reco-grid">';
    recs.forEach((r,i)=>{
      const rank=i===0?'1RO':i===1?'2DO':i===2?'3RO':`${i+1}TO`;
      h+=`<div class="reco-card">
        <div class="reco-rank">${rank} RECOMENDADO</div>
        <div class="reco-number">${r.number}</div>
        <div class="reco-bar-wrap"><div class="reco-bar" style="width:${r.confidence}%"></div></div>
        <div class="reco-confidence">${r.confidence}%</div>
      </div>`;
    });
    h+='</div>';
  }
  h+='</div>';
  document.getElementById('monthlyTarget').innerHTML=h;

  // --- Digit advantage table ---
  const adv=mr.digit_advantage||[];
  if(adv.length===4){
    let t=`<div style="overflow-x:auto;"><table class="heatmap-table" role="table">
      <thead><tr><th>Pos</th>`;
    for(let d=0;d<10;d++)t+=`<th>${d}</th>`;
    t+='</tr></thead><tbody>';
    for(let pos=0;pos<4;pos++){
      t+=`<tr><td style="font-weight:700;">P${pos+1}</td>`;
      for(let d=0;d<10;d++){
        const v=adv[pos][String(d)]||0;
        const color=v>0?`rgba(74,222,128,${Math.min(Math.abs(v)/5,1)*0.7})`
                       :v<0?`rgba(248,113,113,${Math.min(Math.abs(v)/5,1)*0.7})`
                       :'transparent';
        const sign=v>0?'+':'';
        t+=`<td style="background:${color};text-align:center;font-family:'JetBrains Mono';font-size:0.8rem;">${sign}${v}</td>`;
      }
      t+='</tr>';
    }
    t+='</tbody></table></div>';
    document.getElementById('monthlyAdvantage').innerHTML=t;
  }

  // --- Profile chart: top digit per month (stacked bar) ---
  const profiles=mr.monthly_profiles||[];
  if(profiles.length===12){
    const labels=profiles.map(p=>p.name.substring(0,3));
    const datasets=[];
    for(let d=0;d<10;d++){
      datasets.push({
        label:'Dígito '+d,
        data:profiles.map(p=>{
          if(!p.position_freq||!p.position_freq.length)return 0;
          // Average across 4 positions
          let sum=0;
          p.position_freq.forEach(pf=>{sum+=(pf[String(d)]||0);});
          return Math.round(sum/4*10)/10;
        }),
        backgroundColor:DIGIT_COLORS[d]+'99',
        borderColor:DIGIT_COLORS[d],
        borderWidth:1,
        borderRadius:3,
      });
    }
    const ctx=document.getElementById('monthlyProfileChart').getContext('2d');
    if(monthlyProfileChartInstance)monthlyProfileChartInstance.destroy();
    const opts=chartOpts();
    opts.scales.x.stacked=true;opts.scales.y.stacked=true;
    opts.plugins.legend.display=true;
    monthlyProfileChartInstance=new Chart(ctx,{type:'bar',data:{labels,datasets},options:opts});
  }

  // --- Monthly detail cards ---
  let cards='';
  profiles.forEach(p=>{
    const isTarget=p.month===mr.target_month;
    const border=isTarget?'border:2px solid var(--gold-400);':'';
    const badge=isTarget?'<span class="card-badge badge-gold">Próximo</span>':'';
    cards+=`<div class="card reveal" style="${border}">
      <div class="card-header"><h3 class="card-title">${p.name}</h3>${badge}</div>
      <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:8px;">
        ${p.draws} sorteos · ${p.numbers.toLocaleString()} números
      </div>`;
    if(p.hot&&p.hot.length){
      cards+='<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">Top números:</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
      p.hot.slice(0,5).forEach(n=>{
        cards+=`<span style="background:var(--surface-2);padding:2px 8px;border-radius:8px;font-family:'JetBrains Mono';font-size:0.85rem;">${n.number} <small style="color:var(--text-muted);">(${n.count})</small></span>`;
      });
      cards+='</div>';
    }
    if(p.top_endings&&p.top_endings.length){
      cards+='<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;margin-bottom:4px;">Top terminaciones:</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
      p.top_endings.slice(0,5).forEach(e=>{
        cards+=`<span style="background:var(--surface-2);padding:2px 8px;border-radius:8px;font-family:'JetBrains Mono';font-size:0.85rem;">${e.ending} <small style="color:var(--text-muted);">(${e.count})</small></span>`;
      });
      cards+='</div>';
    }
    cards+='</div>';
  });
  document.getElementById('monthlyCards').innerHTML=cards;
}

// SIMULADOR
function initSimCats(){
  const sel=document.getElementById('simCat');if(!sel||!stats)return;
  const cats=Object.keys(stats.by_category||{});
  sel.innerHTML='<option value="">Todas</option>';
  cats.forEach(c=>{sel.innerHTML+=`<option value="${c}">${c}</option>`;});
}
let simChartInstance=null;
async function runSimulation(){
  const num=document.getElementById('simNumero').value.trim().padStart(4,'0');
  if(!/^\d{4}$/.test(num)){showToast('Ingresa un número de 4 dígitos',3000);return;}
  const cat=document.getElementById('simCat').value;
  const from=document.getElementById('simFrom').value;
  const to=document.getElementById('simTo').value;
  let url=`/api/simulador?numero=${num}`;
  if(cat)url+=`&cat=${cat}`;
  if(from)url+=`&from=${from}`;
  if(to)url+=`&to=${to}`;

  document.getElementById('simResults').innerHTML='<div class="loader-wrap" style="padding:40px;"><div class="spinner"></div><p>Buscando...</p></div>';
  try{
    const res=await fetch(url);
    const d=await res.json();
    if(d.error){showToast(d.error,3000);document.getElementById('simResults').innerHTML='';return;}
    renderSimResults(d);
  }catch(e){showToast('Error en simulación',3000);console.error(e);}
}

function renderSimResults(d){
  const ex=d.exact;const en=d.ending;
  const hasExact=ex.total>0;

  let h=`<div class="stat-cards" style="margin-top:20px;">
    <div class="stat-card"><div class="stat-value" style="font-family:'JetBrains Mono';font-size:2rem;color:var(--gold-400);">${d.numero}</div><div class="stat-label">Número buscado</div></div>
    <div class="stat-card"><div class="stat-value">${d.total_sorteos.toLocaleString()}</div><div class="stat-label">Sorteos analizados</div></div>
    <div class="stat-card"><div class="stat-value" style="color:${hasExact?'#4ade80':'var(--text-muted)'};">${ex.total}</div><div class="stat-label">Veces que salió (exacto)</div></div>
    <div class="stat-card"><div class="stat-value">${en.total}</div><div class="stat-label">Coincidencia terminación (${d.terminacion})</div></div>
  </div>`;

  // Detail cards
  h+='<div class="grid-3" style="margin-top:20px;">';

  // Exact matches breakdown
  h+=`<div class="card reveal">
    <div class="card-header"><h3 class="card-title">Aciertos Exactos</h3><span class="card-badge ${hasExact?'badge-hot':'badge-cold'}">${ex.total}</span></div>
    <div style="display:flex;justify-content:space-around;padding:12px 0;">
      <div style="text-align:center;"><div style="font-size:1.8rem;font-weight:700;color:var(--gold-400);">${ex.primero}</div><div style="font-size:0.75rem;color:var(--text-muted);">1er Premio</div></div>
      <div style="text-align:center;"><div style="font-size:1.8rem;font-weight:700;color:#4ade80;">${ex.segundo}</div><div style="font-size:0.75rem;color:var(--text-muted);">2do Premio</div></div>
      <div style="text-align:center;"><div style="font-size:1.8rem;font-weight:700;color:#c084fc;">${ex.tercero}</div><div style="font-size:0.75rem;color:var(--text-muted);">3er Premio</div></div>
    </div>
    <div style="font-size:0.85rem;color:var(--text-secondary);text-align:center;">Frecuencia: ${ex.frequency_pct}% de sorteos</div>
  </div>`;

  // Ending matches
  h+=`<div class="card reveal">
    <div class="card-header"><h3 class="card-title">Terminación "${d.terminacion}"</h3><span class="card-badge badge-green">${en.total}</span></div>
    <div style="display:flex;justify-content:space-around;padding:12px 0;">
      <div style="text-align:center;"><div style="font-size:1.8rem;font-weight:700;color:var(--gold-400);">${en.primero}</div><div style="font-size:0.75rem;color:var(--text-muted);">1er Premio</div></div>
      <div style="text-align:center;"><div style="font-size:1.8rem;font-weight:700;color:#4ade80;">${en.segundo}</div><div style="font-size:0.75rem;color:var(--text-muted);">2do Premio</div></div>
      <div style="text-align:center;"><div style="font-size:1.8rem;font-weight:700;color:#c084fc;">${en.tercero}</div><div style="font-size:0.75rem;color:var(--text-muted);">3er Premio</div></div>
    </div>
    <div style="font-size:0.85rem;color:var(--text-secondary);text-align:center;">Frecuencia: ${en.frequency_pct}% de sorteos</div>
  </div>`;

  // Gap & last appearance
  h+=`<div class="card reveal">
    <div class="card-header"><h3 class="card-title">Última Aparición</h3><span class="card-badge badge-purple">Gap</span></div>
    <div style="text-align:center;padding:12px 0;">
      <div style="font-size:1.1rem;color:var(--gold-300);font-weight:600;">${ex.last_appearance||'Nunca ha salido'}</div>
      ${ex.gap_draws!==null?`<div style="margin-top:12px;font-size:2rem;font-weight:700;color:var(--text-primary);">${ex.gap_draws}</div><div style="font-size:0.8rem;color:var(--text-muted);">sorteos sin aparecer</div>`
      :'<div style="margin-top:12px;font-size:0.9rem;color:var(--text-muted);">Sin registro en el rango seleccionado</div>'}
    </div>
  </div>`;
  h+='</div>';

  // By category
  const cats=d.by_category||{};
  const catKeys=Object.keys(cats);
  if(catKeys.length){
    h+='<div class="card reveal" style="margin-top:20px;"><div class="card-header"><h3 class="card-title">Distribución por Categoría</h3></div><div class="bar-chart">';
    const maxCat=Math.max(...Object.values(cats));
    catKeys.sort((a,b)=>cats[b]-cats[a]);
    catKeys.forEach(k=>{
      const pct=Math.round(cats[k]/maxCat*100);
      h+=`<div class="bar-row"><span class="bar-label">${k}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span class="bar-value">${cats[k]}</span></div>`;
    });
    h+='</div></div>';
  }

  // Match history table
  const matches=ex.matches||[];
  if(matches.length){
    h+='<div class="card reveal" style="margin-top:20px;"><div class="card-header"><h3 class="card-title">Historial de Aciertos</h3><span class="card-badge badge-gold">Últimos '+matches.length+'</span></div>';
    h+='<div class="table-wrap"><table role="table"><thead><tr><th>Fecha</th><th>Categoría</th></tr></thead><tbody>';
    matches.forEach(m=>{
      h+=`<tr><td>${m.fecha}</td><td><span class="cat-badge">${m.cat}</span></td></tr>`;
    });
    h+='</tbody></table></div></div>';
  }

  document.getElementById('simResults').innerHTML=h;
  triggerReveals();
}

// FAVORITOS / WATCHLIST
function getFavorites(){try{return JSON.parse(localStorage.getItem('lp_favorites')||'[]')}catch{return[]}}
function saveFavorites(f){localStorage.setItem('lp_favorites',JSON.stringify(f))}

function addFavorite(){
  const input=document.getElementById('favInput');
  const num=input.value.trim().padStart(4,'0');
  if(!/^\d{4}$/.test(num)){showToast('Ingresa un número de 4 dígitos',3000);return;}
  const favs=getFavorites();
  if(favs.includes(num)){showToast(`${num} ya está en tu lista`,2000);return;}
  favs.push(num);
  saveFavorites(favs);
  input.value='';
  renderFavorites();
  showToast(`${num} agregado a favoritos`,2000);
}

function removeFavorite(num){
  const favs=getFavorites().filter(n=>n!==num);
  saveFavorites(favs);
  renderFavorites();
}

function renderFavorites(){
  const favs=getFavorites();
  const container=document.getElementById('favContainer');
  if(!container)return;
  if(!favs.length){
    container.innerHTML='<div class="card reveal" style="margin-top:20px;text-align:center;padding:40px;"><p style="color:var(--text-muted);font-size:1.1rem;">No tienes números favoritos aún.<br>Agrega números para rastrear sus apariciones.</p></div>';
    return;
  }

  // Check against recent results and recommendations
  const recentResults=allSorteos?allSorteos.slice(0,20):[];
  const recos=stats?(stats.recommendations||[]):[];
  const mlRecos=stats?(stats.ml_recommendations||[]):[];

  let h='<div style="margin-top:20px;">';

  favs.forEach(num=>{
    // Check if number appeared in recent results
    const appearances=[];
    recentResults.forEach(s=>{
      const prizes=[];
      if(s.primero&&s.primero===num)prizes.push('1ro');
      if(s.segundo&&s.segundo===num)prizes.push('2do');
      if(s.tercero&&s.tercero===num)prizes.push('3ro');
      // Check ending match
      const ending=num.slice(-2);
      if(!prizes.length){
        if(s.primero&&s.primero.slice(-2)===ending)prizes.push('Term 1ro');
        if(s.segundo&&s.segundo.slice(-2)===ending)prizes.push('Term 2do');
        if(s.tercero&&s.tercero.slice(-2)===ending)prizes.push('Term 3ro');
      }
      if(prizes.length)appearances.push({fecha:s.fecha,cat:s.cat||s.tipo,prizes});
    });

    // Check if recommended
    const isReco=recos.some(r=>r.number===num);
    const isMLReco=mlRecos.some(r=>r.number===num);

    const hasAlert=appearances.length>0;
    const borderColor=hasAlert?'border-left:4px solid #4ade80;':isReco||isMLReco?'border-left:4px solid var(--gold-400);':'';

    h+=`<div class="card reveal" style="margin-bottom:12px;${borderColor}">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:16px;">
          <span style="font-family:'JetBrains Mono';font-size:1.6rem;font-weight:700;color:var(--gold-400);letter-spacing:4px;">${num}</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${hasAlert?'<span style="background:#4ade8030;color:#4ade80;padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;">✓ SALIÓ RECIENTE</span>':''}
            ${isReco?'<span style="background:rgba(212,175,55,0.2);color:var(--gold-400);padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;">📊 Recomendado</span>':''}
            ${isMLReco?'<span style="background:rgba(74,222,128,0.2);color:#4ade80;padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;">🤖 ML Recomendado</span>':''}
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn" onclick="document.getElementById('simNumero').value='${num}';document.querySelector('[data-tab=simulador]').click();runSimulation();" style="font-size:0.8rem;">🔍 Simular</button>
          <button class="btn" onclick="removeFavorite('${num}')" style="font-size:0.8rem;color:#f87171;" aria-label="Eliminar ${num}">✕</button>
        </div>
      </div>`;

    if(appearances.length){
      h+='<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">';
      appearances.slice(0,5).forEach(a=>{
        h+=`<div style="display:flex;justify-content:space-between;font-size:0.85rem;padding:3px 0;">
          <span style="color:var(--text-secondary);">${a.fecha} · <span class="cat-badge" style="font-size:0.7rem;">${a.cat}</span></span>
          <span style="color:#4ade80;font-weight:600;">${a.prizes.join(', ')}</span>
        </div>`;
      });
      h+='</div>';
    }
    h+='</div>';
  });

  h+='</div>';
  container.innerHTML=h;
  triggerReveals();
  updateFavBadge();
}

function updateFavBadge(){
  const tab=document.getElementById('tab-favoritos');
  if(!tab)return;
  const favs=getFavorites();
  if(!allSorteos||!favs.length){tab.dataset.badge='';return;}
  const recent=allSorteos.slice(0,5);
  let alerts=0;
  favs.forEach(num=>{
    recent.forEach(s=>{
      if(s.primero&&s.primero===num)alerts++;
      if(s.segundo&&s.segundo===num)alerts++;
      if(s.tercero&&s.tercero===num)alerts++;
    });
  });
  tab.dataset.badge=alerts>0?alerts:'';
}

// BACKTESTING / PRECISION
let backtestData=null;

// ==================== SEGUIMIENTO ====================
const SEG_METODOS=[['ml','🤖 ML'],['estadistico','📊 Estadístico'],['combinada','⚖️ Combinada']];
function segPct(x){return x==null?'—':(x*100).toFixed(0)+'%'}
function segNum(x,d=2){return x==null?'—':Number(x).toFixed(d)}
async function loadSeguimiento(){
  const loader=document.getElementById('segLoader');
  loader.style.display='flex';
  document.getElementById('segContent').style.display='none';
  let d=null;
  try{const res=await fetch('/api/seguimiento');d=await res.json();if(!res.ok)throw new Error(d.error||res.status)}
  catch(e){console.error('Seguimiento error:',e);loader.innerHTML='<p>No se pudo cargar el seguimiento.</p>';return}
  loader.style.display='none';
  document.getElementById('segContent').style.display='block';
  renderSeguimiento(d);
  triggerReveals();
}
function renderSeguimiento(d){
  const pw=d.peso_ml??0.5, comp=d.comparados||[], pend=d.pendientes||[], sinReg=d.sin_registro||[];
  const pesoNota=d.comparados_para_peso<d.minimo_peso?`50/50 hasta tener ${d.minimo_peso} sorteos comparados (van ${d.comparados_para_peso})`:`según los últimos ${d.comparados_para_peso} sorteos comparados`;
  document.getElementById('segSummary').innerHTML=`
    <div class="stat-card"><div class="stat-value">${segPct(pw)} / ${segPct(1-pw)}</div><div class="stat-label">Peso Combinada: ML / Estadístico<br><small>${esc(pesoNota)}</small></div></div>
    <div class="stat-card"><div class="stat-value">${comp.length}</div><div class="stat-label">Sorteos comparados</div></div>
    <div class="stat-card"><div class="stat-value">${pend.length}</div><div class="stat-label">Esperando resultado</div></div>
    <div class="stat-card"><div class="stat-value">${sinReg.length}</div><div class="stat-label">Sorteos sin registro</div></div>`;

  document.getElementById('segPendientes').innerHTML=pend.length?pend.map(p=>`
    <div class="card reveal" aria-label="Recomendación congelada para ${esc(catLabel(p.categoria))}">
      <div class="card-header"><h3 class="card-title">${esc(catLabel(p.categoria))}</h3><span class="card-badge badge-gold">Registrada ${esc(p.registrado_en.replace('T',' '))}</span></div>
      ${SEG_METODOS.filter(([m])=>p.metodos[m]).map(([m,lbl])=>`<p class="section-subtitle"><strong>${lbl}</strong>: <span class="num-cell">${p.metodos[m].numeros.map(esc).join(' · ')}</span><br><small>Terminaciones: ${p.metodos[m].terminaciones.map(esc).join(' ')}</small></p>`).join('')}
      ${p.peso_ml!=null?`<small class="section-subtitle">Peso ML de la combinada: ${segPct(p.peso_ml)}</small>`:''}
    </div>`).join(''):'<p class="section-subtitle">Aún no hay recomendaciones congeladas. Se registran al calcular las estadísticas.</p>';

  const m=d.marcador||{};
  document.getElementById('segMarcador').innerHTML=SEG_METODOS.map(([k,lbl])=>{const x=m[k]||{};if(!x.sorteos)return`<tr><td>${lbl}</td><td>0</td><td colspan="5"><em>Sin sorteos comparados todavía</em></td></tr>`;return`<tr>
    <td>${lbl}</td><td>${x.sorteos||0}</td>
    <td>${x.exactos??0} <small>(azar ${segNum(x.exactos_azar,3)})</small></td>
    <td>${x.terminacion_numeros??0} <small>(azar ${segNum(x.terminacion_numeros_azar,1)})</small></td>
    <td>${segNum(x.digitos_media,3)} <small>(azar 0.400)</small></td>
    <td>${segNum(x.terminaciones_media)} <small>(azar ${segNum(x.terminaciones_media_azar)})</small></td>
    <td>${x.alguna_terminacion_pct==null?'—':x.alguna_terminacion_pct.toFixed(0)+'%'} <small>(azar ${x.alguna_terminacion_pct_azar==null?'—':x.alguna_terminacion_pct_azar.toFixed(0)+'%'})</small></td></tr>`}).join('');

  const premiosDe=s=>[s.primero,s.segundo,s.tercero].filter(Boolean).map(esc).join(' · ');
  const fila=c=>{
    const s=c.sorteo;
    const celda=k=>{const r=c.metodos[k];if(!r)return'<td>—</td>';
      const nums=r.numeros.map(n=>r.numeros_acertados.includes(n)?`<mark style="background:#4ade80;color:#0b0b0f;border-radius:4px;padding:0 4px" title="Acierto exacto">${esc(n)}</mark>`:esc(n)).join(' · ');
      const ta=r.terminaciones_acertadas.length?' ('+r.terminaciones_acertadas.map(esc).join(' ')+')':'';
      return`<td><span class="num-cell">${nums}</span><br><small>${r.exactos} exactos · dígitos ${segNum(r.digitos_media)} · term. ${r.terminaciones_aciertos}/10${ta}</small></td>`};
    return`<tr><td>${formatDate(s.fecha)}<br><small>${esc(catLabel(s.cat))}</small></td><td class="num-cell">${premiosDe(s)}</td>${celda('ml')}${celda('estadistico')}${celda('combinada')}</tr>`;
  };
  const sinFila=s=>`<tr style="opacity:0.55"><td>${formatDate(s.fecha)}<br><small>${esc(catLabel(s.cat))}</small></td><td class="num-cell">${premiosDe(s)}</td><td colspan="3"><em>Sin registro: nadie abrió la web entre sorteos</em></td></tr>`;
  const rows=[...comp.map(c=>({f:c.sorteo.fecha,h:fila(c)})),...sinReg.map(s=>({f:s.fecha,h:sinFila(s)}))].sort((a,b)=>b.f.localeCompare(a.f));
  document.getElementById('segHistorial').innerHTML=rows.length?rows.map(r=>r.h).join(''):'<tr><td colspan="5">Todavía no hay sorteos comparados.</td></tr>';
}
let precisionChartInstance=null;

async function loadBacktesting(){
  if(backtestData){renderBacktesting();return;}
  document.getElementById('precisionLoader').style.display='flex';
  document.getElementById('precisionContent').style.display='none';
  try{
    const res=await fetch('/api/backtesting?last_n=500');
    backtestData=await res.json();
  }catch(e){console.error('Backtest error:',e)}
  document.getElementById('precisionLoader').style.display='none';
  document.getElementById('precisionContent').style.display='block';
  renderBacktesting();
  triggerReveals();
}

function renderBacktesting(){
  if(!backtestData)return;
  const ml=backtestData.ml||{};
  const st=backtestData.statistical||{};
  const cmp=backtestData.comparison||{};

  // Summary cards
  document.getElementById('precisionSummary').innerHTML=`
    <div class="stat-card"><div class="stat-value">${ml.avg_top1_accuracy||'—'}%</div><div class="stat-label">ML Top-1 Precisión</div></div>
    <div class="stat-card"><div class="stat-value">${ml.avg_top3_accuracy||'—'}%</div><div class="stat-label">ML Top-3 Precisión</div></div>
    <div class="stat-card"><div class="stat-value">${ml.avg_lift_top1||'—'}x</div><div class="stat-label">ML Lift vs Azar</div></div>
    <div class="stat-card"><div class="stat-value">${ml.total_evaluated||0}</div><div class="stat-label">Sorteos Evaluados</div></div>
  `;

  // Per-position cards
  const posLabels=['Millares (pos 0)','Centenas (pos 1)','Decenas (pos 2)','Unidades (pos 3)'];
  const mlPos=ml.per_position||[];
  document.getElementById('precisionPositions').innerHTML=mlPos.map((p,i)=>{
    const t1w=Math.min(p.top1_accuracy/25*100,100);
    const t3w=Math.min(p.top3_accuracy/60*100,100);
    const liftColor=p.lift_top1>=1.2?'var(--accent-green)':p.lift_top1>=1.0?'var(--gold-300)':'var(--accent-hot)';
    return`<div class="card reveal">
      <div class="card-header"><div class="card-title" style="font-size:0.95rem;">${posLabels[i]}</div><span class="card-badge" style="background:${liftColor}20;color:${liftColor};">${p.lift_top1}x</span></div>
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-secondary);margin-bottom:4px;"><span>Top-1</span><span style="color:var(--gold-300);font-weight:600;">${p.top1_accuracy}%</span></div>
        <div class="bar-track" style="height:14px;position:relative;">
          <div class="bar-fill gold" style="width:${t1w}%;min-width:0;"></div>
          <div style="position:absolute;left:${10/25*100}%;top:0;height:100%;width:2px;background:var(--accent-hot);opacity:0.7;" title="Azar: 10%"></div>
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-secondary);margin-bottom:4px;"><span>Top-3</span><span style="color:var(--accent-green);font-weight:600;">${p.top3_accuracy}%</span></div>
        <div class="bar-track" style="height:14px;position:relative;">
          <div class="bar-fill green" style="width:${t3w}%;min-width:0;"></div>
          <div style="position:absolute;left:${30/60*100}%;top:0;height:100%;width:2px;background:var(--accent-hot);opacity:0.7;" title="Azar: 30%"></div>
        </div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);">Prob. prom. dígito real: <strong style="color:var(--text-secondary);">${p.avg_prob_actual}%</strong></div>
    </div>`;
  }).join('');

  // ML vs Statistical comparison
  const stPos=st.per_position||[];
  let compHTML='';
  // ML card
  compHTML+=`<div class="card reveal"><div class="card-header"><div class="card-title">🤖 Machine Learning</div><span class="card-badge badge-green">${cmp.ml_better?'Mejor':'—'}</span></div><div class="bar-chart">`;
  mlPos.forEach((p,i)=>{
    const w=Math.min(p.top1_accuracy/20*100,100);
    compHTML+=`<div class="bar-row"><div class="bar-label">P${i}</div><div class="bar-track"><div class="bar-fill green" style="width:${w}%">${p.top1_accuracy}%</div></div></div>`;
  });
  if(ml.ending_top10_hit_rate!==undefined){
    const ew=Math.min(ml.ending_top10_hit_rate/20*100,100);
    compHTML+=`<div class="bar-row"><div class="bar-label" style="font-size:0.7rem;">Term</div><div class="bar-track"><div class="bar-fill purple" style="width:${ew}%">${ml.ending_top10_hit_rate}%</div></div></div>`;
  }
  compHTML+=`</div></div>`;

  // Statistical card
  compHTML+=`<div class="card reveal"><div class="card-header"><div class="card-title">📊 Estadístico</div><span class="card-badge badge-gold">${!cmp.ml_better?'Mejor':'—'}</span></div><div class="bar-chart">`;
  stPos.forEach((p,i)=>{
    const w=Math.min(p.top1_accuracy/20*100,100);
    compHTML+=`<div class="bar-row"><div class="bar-label">P${i}</div><div class="bar-track"><div class="bar-fill gold" style="width:${w}%">${p.top1_accuracy}%</div></div></div>`;
  });
  compHTML+=`</div></div>`;
  document.getElementById('precisionComparison').innerHTML=compHTML;

  // Rolling accuracy trend chart
  renderPrecisionTrend(ml.rolling_accuracy||[]);
}

function renderPrecisionTrend(rolling){
  if(!rolling.length)return;
  const labels=rolling.map(r=>r.month);
  const ctx=document.getElementById('precisionTrendChart').getContext('2d');
  if(precisionChartInstance)precisionChartInstance.destroy();
  precisionChartInstance=new Chart(ctx,{
    type:'line',
    data:{
      labels,
      datasets:[
        {label:'Top-1 Promedio',data:rolling.map(r=>r.top1_avg),borderColor:'#ffd700',backgroundColor:'rgba(255,215,0,0.1)',tension:0.4,borderWidth:2,pointRadius:3,fill:true},
        {label:'Top-3 Promedio',data:rolling.map(r=>r.top3_avg),borderColor:'#34d399',backgroundColor:'rgba(52,211,153,0.1)',tension:0.4,borderWidth:2,pointRadius:3,fill:true},
        {label:'Azar Top-1 (10%)',data:labels.map(()=>10),borderColor:'rgba(255,77,77,0.5)',borderDash:[6,4],borderWidth:1,pointRadius:0,fill:false},
        {label:'Azar Top-3 (30%)',data:labels.map(()=>30),borderColor:'rgba(255,77,77,0.3)',borderDash:[6,4],borderWidth:1,pointRadius:0,fill:false},
      ]
    },
    options:chartOpts()
  });
}

// SCROLL REVEAL
function triggerReveals(){
  const obs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');obs.unobserve(e.target)}})},{threshold:0.1});
  document.querySelectorAll('.reveal:not(.visible)').forEach(el=>obs.observe(el));
}
