// PUENTE PARA LAS ISLAS REACT (frontend/src/store/legacyStore.ts)
// Va el primero: applyTheme corre antes de las declaraciones `let` de abajo, así que _lpEmit no puede leer el estado
// mientras no exista la caché (nadie ha pedido aún una instantánea).
var _lpListeners=new Set(), _lpCache=null, _lpStatsBueno=null, _lpSim=null, _lpSimId=0, _lpErrSorteos=false;
function _lpStatsOk(x){return !!x&&typeof x==='object'&&typeof x.total_sorteos==='number'}
function _lpLeer(campo){
  switch(campo){
    case 'sorteos': return allSorteos;
    case 'ready': return allSorteos.length>0;
    case 'stats': if(_lpStatsOk(stats))_lpStatsBueno=stats;return _lpStatsBueno;
    case 'useML': return useML;
    case 'prize': return currentPrize;
    case 'statsPrize': return currentStatsPrize;
    case 'theme': return document.documentElement.getAttribute('data-theme')==='light'?'light':'dark';
    case 'activeTab': {const t=document.querySelector('#navTabs .nav-tab.active');return t&&t.dataset.tab?t.dataset.tab:'predicciones'}
    case 'simulacion': return _lpSim;
    case 'errorSorteos': return _lpErrSorteos;
  }
}
function _lpSnapshot(){
  if(!_lpCache){
    _lpCache={};
    ['sorteos','ready','stats','useML','prize','statsPrize','theme','activeTab','simulacion','errorSorteos'].forEach(c=>{_lpCache[c]=_lpLeer(c)});
  }
  return _lpCache;
}
function _lpEmit(...campos){
  let cambio=true;
  if(_lpCache){
    const sig={..._lpCache};
    campos.forEach(c=>{
      if(c==='sorteos'){sig.sorteos=_lpLeer('sorteos');sig.ready=_lpLeer('ready')}
      else sig[c]=_lpLeer(c);
    });
    cambio=Object.keys(sig).some(k=>sig[k]!==_lpCache[k]);
    if(cambio)_lpCache=sig;
  }
  if(!cambio)return;
  _lpListeners.forEach(fn=>{try{fn()}catch(e){console.error(e)}});
  campos.forEach(c=>document.dispatchEvent(new CustomEvent('lp:change',{detail:c})));
}
function _lpTabPremio(contenedor,p){return Array.from(document.querySelectorAll(contenedor+' .prize-tab')).find(t=>t.dataset.prize===p)}
window.LP={
  getSnapshot:_lpSnapshot,
  subscribe(fn){_lpListeners.add(fn);return()=>{_lpListeners.delete(fn)}},
  setUseML(v){setUseMLLP(!!v)},
  setPrize(p){const tab=_lpTabPremio('#prizeTabs',p);if(tab)selectPrize(tab)},
  setStatsPrize(p){const tab=_lpTabPremio('#statsPrizeTabs',p);if(tab)selectStatsPrize(tab)},
  toast(msg,ms){showToast(msg,ms)},
  simular(n){
    const t=document.querySelector('#navTabs [data-tab="simulador"]');if(!t)return;
    _lpSim={numero:String(n),id:++_lpSimId};
    t.click();
    _lpEmit('simulacion')
  },
  reload(){return loadData().catch(e=>{console.error('Error reloading:',e)})}
};

// THEME
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme',theme);
  document.getElementById('themeIcon').textContent=theme==='light'?'🌙':'☀️';
  document.getElementById('themeLabel').textContent=theme==='light'?'Oscuro':'Claro';
  localStorage.setItem('theme',theme);
  _lpEmit('theme');
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
let allSorteos=[], stats={};
let currentPrize='primero', currentStatsPrize='primero';
let useML=false;
let trendChartInstance=null, volumeChartInstance=null, endingsTrendChartInstance=null;

const CAT_LABELS={dominical:'Dominical',miercolito:'Miercolito',gordito:'Gordito del Zodiaco',extraordinario:'Extraordinario'};
function catLabel(k){return CAT_LABELS[k]||k.charAt(0).toUpperCase()+k.slice(1)}
// Category as a CSS class suffix: only [a-z0-9_-], so a raw API value cannot break out of class="…".
function catClase(k){return String(k??'').toLowerCase().replace(/[^a-z0-9_-]/g,'')}
function formatDate(d){if(!d)return'—';return new Date(d+'T00:00:00').toLocaleDateString('es-PA',{year:'numeric',month:'short',day:'numeric'})}
function renderBalls(val,variant='gold',size='lg'){
  const s=String(val??'').trim();
  if(!s)return'<span class="num-empty">—</span>';
  const balls=Array.from(s).map(ch=>`<span class="lotto-ball ball-${variant}" aria-hidden="true">${esc(ch)}</span>`).join('');
  return`<span class="lotto-balls lotto-balls-${size}" aria-label="${esc(s)}">${balls}</span>`;
}

// TOAST
function showToast(msg,ms=2500){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),ms)}

// COPY
function copyNumber(num){navigator.clipboard.writeText(num).then(()=>{showToast('Copiado: '+num);document.querySelectorAll(`.copy-btn[data-num="${num}"]`).forEach(b=>{b.classList.add('copied');b.textContent='OK';setTimeout(()=>{b.classList.remove('copied');b.textContent='Copiar'},1500)})})}

// INIT
document.addEventListener('DOMContentLoaded',async()=>{initTabs();await loadData()});

// Keyboard navigation helper for tablists
// Las flechas, Inicio y Fin activan la pestaña con un click() sintético: el menú lateral abierto no debe cerrarse por eso
let _navPorTeclado=false;
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
    if(next>=0){tabs[next].focus();_navPorTeclado=true;try{tabs[next].click()}finally{_navPorTeclado=false}}
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
  _lpEmit('activeTab');
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
  initMenu();
}

// MENÚ LATERAL: con la ventana estrecha la barra se esconde y el botón con el icono de menú la abre
function initMenu(){
  const btn=document.getElementById('menuToggle'),nav=document.getElementById('navTabs'),fondo=document.getElementById('menuBackdrop');
  if(!btn||!nav||!fondo)return;
  const abierto=()=>nav.classList.contains('open');
  // Con el menú abierto el resto de la página es inerte (sin foco ni lectura): el fondo oscuro es modal
  const resto=()=>Array.from(document.querySelector('.app').children).filter(el=>el!==nav&&el!==fondo);
  const poner=on=>{
    nav.classList.toggle('open',on);fondo.hidden=!on;document.body.classList.toggle('menu-open',on);
    resto().forEach(el=>el.toggleAttribute('inert',on));
    btn.setAttribute('aria-expanded',String(on));
    btn.setAttribute('aria-label',on?'Cerrar menú de secciones':'Abrir menú de secciones');
  };
  btn.addEventListener('click',()=>{
    poner(!abierto());
    if(abierto()){const t=nav.querySelector('.nav-tab.active')||nav.querySelector('.nav-tab');if(t)t.focus()}
  });
  fondo.addEventListener('click',()=>{poner(false);btn.focus()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&abierto()){poner(false);btn.focus()}});
  // Con el menú abierto, elegir una sección con clic o Enter lo cierra; con las flechas se recorre sin cerrarlo.
  // (En escritorio no está "abierto": el foco no se mueve.)
  nav.querySelectorAll('.nav-tab').forEach(t=>t.addEventListener('click',()=>{if(abierto()&&!_navPorTeclado){poner(false);btn.focus()}}));
  if(window.matchMedia){const ancho=matchMedia('(min-width:901px)');if(ancho.addEventListener)ancho.addEventListener('change',e=>{if(e.matches)poner(false)})}
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
  const decEl=document.getElementById('decenaContainer');
  if(decEl)decEl.innerHTML=`<div class="skel-grid">${skelCard(5)+skelCard(5)}</div>`;
}

async function loadData(){
  showSkeletons();
  // Phase 1: Load sorteos fast (lightweight endpoint)
  try{
    if(_lpErrSorteos){_lpErrSorteos=false;_lpEmit('errorSorteos')} // nuevo intento: vuelve a «cargando»
    const sRes=await fetch('/api/sorteos?all=true');
    const sData=await sRes.json();
    const lista=sData.data||sData;
    if(!sRes.ok||!Array.isArray(lista))throw new Error('Respuesta inválida de /api/sorteos');
    allSorteos=lista;
    _lpEmit('sorteos');
    renderQuick();
  }catch(e){
    console.error('Error loading sorteos:',e);
    // Sin ningún sorteo la pestaña no puede distinguir «cargando» de «no va a llegar»; con datos viejos se conservan.
    if(!allSorteos.length){_lpErrSorteos=true;_lpEmit('errorSorteos')}
  }
  // Phase 2: Load stats (heavy ML computation — may take >60s on first load)
  const loadStats=async(attempt=1)=>{
    try{
      const stRes=await fetch('/api/stats',{signal:AbortSignal.timeout(180000)});
      const cuerpo=await stRes.json();
      // Un 500 con cuerpo JSON (o {}) no puede ocupar el lugar de las estadísticas: cuenta como fallo y reintenta.
      if(!stRes.ok||!_lpStatsOk(cuerpo))throw new Error('Respuesta inválida de /api/stats');
      stats=cuerpo;
      _lpEmit('stats');
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
  renderLastUpdate();
  renderScatterChart();
}

function renderFull(){
  // Full renders once stats are available
  renderLastUpdate();buildCategoryUI();
  renderRecommendations('all');renderDecenas();renderStatsForPrize(currentStatsPrize);renderSeriesLetras();renderFormatos();
  renderRadarChart();renderScatterChart();
  renderPositionGrids();renderHeatmap();renderTrendChart();renderVolumeChart();
  renderEndingsSection();renderDashboard();
  initRecoCatTabs();initEndCatTabs();initPrizeTabs();initStatsPrizeTabs();
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
  const te=document.getElementById('endCatTabs');
  if(te)cats.forEach(c=>{const b=document.createElement('button');b.className='cat-tab';b.dataset.cat=c;b.setAttribute('role','tab');b.setAttribute('aria-selected','false');b.textContent=catLabel(c);te.appendChild(b)});
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
function _statsListas(){return _lpStatsOk(stats)}
function selectPrize(tab){
  _setAriaTab(document.getElementById('prizeTabs'),tab);currentPrize=tab.dataset.prize;
  _lpEmit('prize');
  const cat=document.querySelector('#recoCatTabs .cat-tab.active');
  if(_statsListas()&&cat)renderRecommendations(cat.dataset.cat);
}
function selectStatsPrize(tab){
  _setAriaTab(document.getElementById('statsPrizeTabs'),tab);currentStatsPrize=tab.dataset.prize;
  _lpEmit('statsPrize');
  if(_statsListas()){renderStatsForPrize(currentStatsPrize);triggerReveals()}
}
function initPrizeTabs(){
  document.getElementById('prizeTabs').querySelectorAll('.prize-tab').forEach(tab=>{
    tab.addEventListener('click',()=>selectPrize(tab));
  });
}
function initStatsPrizeTabs(){
  document.getElementById('statsPrizeTabs').querySelectorAll('.prize-tab').forEach(tab=>{
    tab.addEventListener('click',()=>selectStatsPrize(tab));
  });
}
function initEndCatTabs(){
  const wrap=document.getElementById('endCatTabs');
  if(!wrap)return;
  wrap.querySelectorAll('.cat-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{_setAriaTab(wrap,tab);renderEndingsSection();});
  });
  initTablistKeyboard(wrap);
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
function toggleML(){setUseMLLP(!useML)}
function setUseMLLP(valor){
  if(valor===useML)return;
  useML=valor;
  document.querySelectorAll('.ml-toggle').forEach(b=>{
    b.classList.toggle('active',useML);
    b.textContent=useML?'🤖 ML Activo':'📊 Estadístico';
    b.setAttribute('aria-pressed',String(useML));
  });
  _lpEmit('useML');
  const cat=document.querySelector('#recoCatTabs .cat-tab.active');
  if(!_statsListas()||!cat)return; // aún no hay estadísticas: solo cambia el modo; renderFull lo usará al llegar
  renderRecommendations(cat.dataset.cat);
  renderEndingsSection();
  // Show ML info badge
  const info=stats.ml_info||{};
  if(useML&&info.trained)showToast(`ML: ${info.train_samples} muestras · Entrenado: ${info.train_date}`,3000);
}

// Number confidence (statistical and ML) is "times more likely than chance": 1.0 = pure chance, capped at 15.
function fmtLift(x){return x==null?'—':`×${Number(x).toFixed(2)} azar`}
function liftBar(x){return Math.min((x||0)/2*100,100)}  // 2× chance fills the bar

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
    else recos=(stats.by_category&&stats.by_category[cat]&&stats.by_category[cat].recommendations)||[];
  }
  if(!recos.length){container.innerHTML='<p style="color:var(--text-muted);text-align:center;padding:40px;">No hay suficientes datos para esta combinación.</p>';return}
  // Per-category recommendations cover every 4-digit prize (1st, 2nd and 3rd), whatever prize is selected.
  const pl=cat==='all'?{primero:'1er Premio',segundo:'2do Premio',tercero:'3er Premio'}[currentPrize]:'cualquier premio de 4 cifras';
  const method=useML?'🤖 Machine Learning':'📊 Estadístico';
  const ranks=['1ro','2do','3ro','4to','5to'];
  container.innerHTML=`<div style="margin-bottom:12px;font-size:0.8rem;color:var(--text-muted);">Recomendaciones para <strong style="color:var(--gold-300)">${pl}</strong> — <span style="color:${useML?'var(--accent-green)':'var(--gold-400)'};">${method}</span></div>
    <div class="reco-grid">${recos.map((r,i)=>`<div class="reco-card${useML?' reco-ml':''}">
      <button class="copy-btn" data-num="${r.number}" onclick="copyNumber('${r.number}')">Copiar</button>
      <div class="reco-rank">${ranks[i]||(i+1)+'to'} Recomendado</div>
      <div class="reco-number">${renderBalls(r.number,useML?'green':'gold','lg')}</div>
      <div class="reco-confidence" title="Veces más probable que un número al azar (×1.00 = azar)"><div class="conf-bar"><div class="conf-bar-fill" style="width:${liftBar(r.confidence)}%;${useML?'background:linear-gradient(90deg,var(--accent-green),#6ee7b7);':''}"></div></div>${fmtLift(r.confidence)}</div>
    </div>`).join('')}</div>`;
  requestAnimationFrame(()=>{container.querySelectorAll('.conf-bar-fill').forEach(b=>{const w=b.style.width;b.style.width='0%';requestAnimationFrame(()=>{b.style.width=w})})});
}

// DECENA RECOMMENDATION
function renderDecenas(){
  const dr=stats.decena_recomendada||{};
  const cats=Object.keys(dr);
  if(!cats.length){document.getElementById('decenaContainer').innerHTML='<p style="color:var(--text-muted);text-align:center;padding:40px;">No hay suficientes datos para análisis de decenas.</p>';return}
  const methodLabel={triple:'Patrón de 3 sorteos',pair:'Patrón de 2 sorteos',frecuencia:'Frecuencia general',fallback:'Frecuencia general'};
  let h='<div class="decena-grid">';
  cats.forEach(cat=>{
    const d=dr[cat];
    const dist=d.follower_distribution||{};
    const maxDist=Math.max(...Object.values(dist),1);
    h+=`<div class="card reveal decena-card">
      <div class="card-header"><div class="card-title">${esc(catLabel(cat))}</div><span class="card-badge badge-gold">${esc(methodLabel[d.method]||d.method)}</span></div>
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
            <div class="decena-confidence" title="Veces más probable que una decena al azar (×1.00 = azar)">${fmtLift(d.confidence)} · ${d.method==='frecuencia'||d.method==='fallback'?`${d.match_count} sorteos (ningún patrón llega a ${d.minimo||20} coincidencias)`:`${d.match_count} sorteos coincidentes`} · ${d.muestras??'—'} decenas</div>
            <div class="decena-confidence" style="opacity:0.85;">${d.backtest?`ℹ Prueba con los últimos ${d.backtest.sorteos} sorteos: la decena recomendada salió en algún premio el ${d.backtest.acierto_pct}% de las veces, frente al ${d.backtest.acierto_pct_azar}% del azar.`:'ℹ Muy pocos sorteos desde 1995 para comprobarlo.'}</div>
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
  document.getElementById('seriesChart').innerHTML=series.map(s=>`<div class="bar-row"><span class="bar-label">${esc(s.value)}</span><div class="bar-track"><div class="bar-fill gold" style="width:${(s.count/sMax*100).toFixed(1)}%">${s.count}</div></div></div>`).join('');
  const lMax=Math.max(...letras.map(l=>l.count),1);
  document.getElementById('letrasChart').innerHTML=letras.map(l=>`<div class="bar-row"><span class="bar-label">${esc(l.letra)}</span><div class="bar-track"><div class="bar-fill green" style="width:${(l.count/lMax*100).toFixed(1)}%">${l.count}</div></div></div>`).join('');
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
  // Recommendations — ML or Statistical, for "Todos" or one category (the ones Seguimiento freezes)
  const endTab=document.querySelector('#endCatTabs .cat-tab.active');
  const endCat=endTab?endTab.dataset.cat:'all';
  const ec=endCat!=='all'?((stats.endings_by_category||{})[endCat]||{}):null;
  const recos=ec?((useML?ec.ml_recommendations:ec.recommendations)||[]):(useML?(stats.ml_endings||[]):(ed.recommendations||[]));
  const bt=ec&&ec.backtest;
  document.getElementById('endingsBacktestNote').innerHTML=endCat==='all'
    ?'ℹ En las pruebas por categoría con sorteos reales, las terminaciones aciertan como el azar. Elige una categoría para ver la suya.'
    :bt?`ℹ Prueba del método estadístico con los últimos ${bt.sorteos} sorteos de ${esc(catLabel(endCat))}, recomendando solo con los sorteos anteriores: ${bt.aciertos} aciertos frente a ${bt.aciertos_azar} del azar; al menos 1 acierto en el ${bt.alguna_pct}% de los sorteos frente al ${bt.alguna_pct_azar}% del azar.${useML?' El ML no tiene prueba propia aquí (ver Seguimiento).':''}`
    :`ℹ ${esc(catLabel(endCat))} tiene muy pocos sorteos para comprobarlo (${ec.total_endings||0} terminaciones): una cifra alta aquí es ruido de muestra pequeña.`;
  const isEnding=!useML; // statistical uses 'ending' key, ML uses 'ending' key too
  const ranks=['1ro','2do','3ro','4to','5to','6to','7mo','8vo','9no','10mo'];
  const method=useML?'🤖 Machine Learning':'📊 Estadístico';
  document.getElementById('endingsRecoContainer').innerHTML=`
    <div style="margin-bottom:12px;font-size:0.8rem;color:var(--text-muted);">Terminaciones recomendadas — <span style="color:${useML?'var(--accent-green)':'var(--gold-400)'};">${method}</span></div>
    <div class="reco-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));">${recos.map((r,i)=>`<div class="reco-card${useML?' reco-ml':''}" style="padding:20px 16px;">
      <button class="copy-btn" data-num="${r.ending}" onclick="copyNumber('${r.ending}')">Copiar</button>
      <div class="reco-rank">${ranks[i]||(i+1)+'to'} Terminación</div>
      <div class="reco-number">${renderBalls(r.ending,useML?'green':'gold','md')}</div>
      <div class="reco-confidence" title="Veces más probable que una terminación al azar (×1.00 = azar)"><div class="conf-bar"><div class="conf-bar-fill" style="width:${liftBar(r.confidence)}%;${useML?'background:linear-gradient(90deg,var(--accent-green),#6ee7b7);':''}"></div></div>${fmtLift(r.confidence)}</div>
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
  let h=`<div class="heatmap-legend" aria-hidden="true"><span>Menor frec.</span><span class="heatmap-scale"><span class="heatmap-swatch" style="background:rgba(212,175,55,0.08)"></span><span class="heatmap-swatch" style="background:rgba(212,175,55,0.28)"></span><span class="heatmap-swatch" style="background:rgba(212,175,55,0.5)"></span><span class="heatmap-swatch" style="background:rgba(212,175,55,0.75)"></span></span><span>Mayor frec. (máx: ${max})</span></div>`;
  h+='<div style="display:flex;gap:4px;margin-bottom:6px;padding-left:28px;">';
  for(let c=0;c<10;c++)h+=`<div style="flex:1;text-align:center;font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted);">x${c}</div>`;
  h+='</div>';
  for(let r=0;r<10;r++){
    h+=`<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">`;
    h+=`<div style="width:24px;text-align:right;font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted);">${r}x</div>`;
    for(let c=0;c<10;c++){
      const key=String(r)+String(c);const v=freq[key]||0;const i=v/max;
      const peak=i>=0.85?' cell-peak':'';
      const bg=`rgba(212,175,55,${(i*0.65+0.04).toFixed(2)})`;
      const col=i>0.4?(isLight()?'#fff':'#0a0a0f'):(isLight()?'#1a1612':'#f0ece2');
      h+=`<div class="ending-cell${peak}" style="flex:1;background:${bg};color:${col}" title="${key}: ${v} veces">${key}<small style="font-size:0.55rem;opacity:0.75">${v}</small></div>`;
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
  let h=`<div class="heatmap-legend" aria-hidden="true"><span>Menor frec.</span><span class="heatmap-scale"><span class="heatmap-swatch" style="background:rgba(212,175,55,0.08)"></span><span class="heatmap-swatch" style="background:rgba(212,175,55,0.3)"></span><span class="heatmap-swatch" style="background:rgba(212,175,55,0.6)"></span></span><span>Mayor frec. (máx: ${allMax})</span></div>`;
  h+='<table class="heatmap-table"><thead><tr><th style="padding:10px;color:var(--text-muted);font-size:0.72rem;">Posición</th>';
  for(let d=0;d<10;d++)h+=`<th style="padding:10px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:0.82rem;">${d}</th>`;
  h+='</tr></thead><tbody>';
  pf.forEach((pos,idx)=>{h+=`<tr><td style="padding:10px;color:var(--text-secondary);font-size:0.82rem;font-weight:600;">${posLabels[idx]}</td>`;
    for(let d=0;d<10;d++){const v=pos[String(d)]||0;const i=v/(allMax||1);const peak=i>=0.9?' cell-peak':'';h+=`<td class="${peak.trim()}" style="padding:10px;text-align:center;font-family:var(--font-mono);font-size:0.85rem;font-weight:600;background:rgba(${Math.round(212*i)},${Math.round(175*i)},${Math.round(55*i)},${(i*0.5+0.03).toFixed(2)});border-radius:8px;color:${i>0.4?(isLight()?'#fff':'#0a0a0f'):(isLight()?'#1a1612':'#f0ece2')};cursor:default;" title="${posLabels[idx]} dígito ${d}: ${v}">${v}</td>`}h+='</tr>'});
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

  const catKey=esc(last.cat||last.tipo||'');
  const h=`<div class="dashboard-hero-grid">
    <div class="last-draw-card">
      <div class="last-draw-header">
        <div class="last-draw-title">
          <span class="cat-pill cat-${catKey}">${esc(catLabel(last.cat||last.tipo||''))}</span>
          <span>Último Sorteo Oficial</span>
        </div>
        <span class="last-draw-date">${formatDate(last.fecha)}</span>
      </div>
      <div class="last-draw-prizes">
        <div class="last-draw-prize-box prize-box-1" title="1er Premio">
          <span class="last-draw-prize-label">1er Premio</span>
          ${renderBalls(last.primero,'gold','md')}
        </div>
        <div class="last-draw-prize-box prize-box-2" title="2do Premio">
          <span class="last-draw-prize-label">2do Premio</span>
          ${renderBalls(last.segundo,'green','md')}
        </div>
        <div class="last-draw-prize-box prize-box-3" title="3er Premio">
          <span class="last-draw-prize-label">3er Premio</span>
          ${renderBalls(last.tercero,'purple','md')}
        </div>
      </div>
      <div class="last-draw-meta">
        <span>Letras: <strong>${esc(last.letra||'—')}</strong></span>
        <span>Serie: <strong>${esc(last.serie||'—')}</strong></span>
        <span>Folio: <strong>${esc(last.folio||'—')}</strong></span>
      </div>
    </div>
    <div class="dashboard-kpis">
      <div class="kpi-card">
        <div class="kpi-label">Top Recomendación</div>
        <div>${topRec?renderBalls(topRec.number,'gold','sm'):'<span class="num-empty">—</span>'}</div>
        <div class="kpi-sub">📊 Estadístico · ${topRec?fmtLift(topRec.confidence):'—'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Top ML</div>
        <div>${topML?renderBalls(topML.number,'green','sm'):'<span class="num-empty">—</span>'}</div>
        <div class="kpi-sub">🤖 Machine Learning · ${topML?fmtLift(topML.confidence):'—'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Terminación Caliente</div>
        <div>${renderBalls(hotDecena.ending,'hot','sm')}</div>
        <div class="kpi-sub">🔥 ${hotDecena.count} veces en ${new Date().getFullYear()}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Sorteos</div>
        <div class="stat-value" style="font-size:1.75rem;line-height:1.1;">${stats.total_sorteos?.toLocaleString()||'—'}</div>
        <div class="kpi-sub">Historial desde 1919</div>
      </div>
    </div>
  </div>`;
  document.getElementById('dashboardSummary').innerHTML=h;
}

// SCROLL REVEAL
function triggerReveals(){
  const obs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');obs.unobserve(e.target)}})},{threshold:0.1});
  document.querySelectorAll('.reveal:not(.visible)').forEach(el=>obs.observe(el));
}
