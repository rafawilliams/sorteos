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
window.LP={
  getSnapshot:_lpSnapshot,
  subscribe(fn){_lpListeners.add(fn);return()=>{_lpListeners.delete(fn)}},
  setUseML(v){setUseMLLP(!!v)},
  setPrize(p){if(!['primero','segundo','tercero'].includes(p))return;currentPrize=p;_lpEmit('prize')},
  setStatsPrize(p){if(!['primero','segundo','tercero'].includes(p))return;currentStatsPrize=p;_lpEmit('statsPrize')},
  setTheme(t){if(t==='light'||t==='dark')applyTheme(t)},
  setActiveTab(t){const tab=document.querySelector('#navTabs [data-tab="'+t+'"]');if(tab)activateNavTab(tab)},
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
}
(function(){const saved=localStorage.getItem('theme');if(saved)applyTheme(saved)})();

// STATE
let allSorteos=[], stats={};
let currentPrize='primero', currentStatsPrize='primero';
let useML=false;

const CAT_LABELS={dominical:'Dominical',miercolito:'Miercolito',gordito:'Gordito del Zodiaco',extraordinario:'Extraordinario'};
function catLabel(k){return CAT_LABELS[k]||k.charAt(0).toUpperCase()+k.slice(1)}
function formatDate(d){if(!d)return'—';return new Date(d+'T00:00:00').toLocaleDateString('es-PA',{year:'numeric',month:'short',day:'numeric'})}
// TOAST
function showToast(msg,ms=2500){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),ms)}

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

function showSkeletons(){
  document.getElementById('loader').style.display='none';
  document.getElementById('content').style.display='block';
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
  // Las pestañas son islas de React: aquí solo queda lo que pertenece al armazón
  renderLastUpdate();
}

function renderFull(){
  renderLastUpdate();
}

// LAST UPDATE
function renderLastUpdate(){
  const lu=stats.last_update||(allSorteos[0]&&allSorteos[0].fecha)||'';
  if(lu){
    document.getElementById('lastUpdate').textContent='Última actualización: '+formatDate(lu);
    document.getElementById('footerText').innerHTML=`Lotería de Panamá — Análisis Estadístico © 2026 &nbsp;·&nbsp; ${allSorteos.length.toLocaleString()} sorteos históricos &nbsp;·&nbsp; Actualizado: ${formatDate(lu)}`;
  }
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

function _statsListas(){return _lpStatsOk(stats)}
// ML TOGGLE
function toggleML(){setUseMLLP(!useML)}
function setUseMLLP(valor){
  if(valor===useML)return;
  useML=valor;
  document.querySelectorAll('.ml-toggle:not([data-isla])').forEach(b=>{
    b.classList.toggle('active',useML);
    b.textContent=useML?'🤖 ML Activo':'📊 Estadístico';
    b.setAttribute('aria-pressed',String(useML));
  });
  _lpEmit('useML');
  if(!_statsListas())return; // aún no hay estadísticas: solo cambia el modo
  // Show ML info badge
  const info=stats.ml_info||{};
  if(useML&&info.trained)showToast(`ML: ${info.train_samples} muestras · Entrenado: ${info.train_date}`,3000);
}

// SCROLL REVEAL
function triggerReveals(){
  const obs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');obs.unobserve(e.target)}})},{threshold:0.1});
  document.querySelectorAll('.reveal:not(.visible)').forEach(el=>obs.observe(el));
}
