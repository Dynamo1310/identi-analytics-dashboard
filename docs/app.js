(()=>{
'use strict';

let D=window.IDENTI_ANALYTICS_DATA||{posts:[]};
let posts=[];
let selected=null;

const nf=new Intl.NumberFormat('es-AR');
const df=new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const $=s=>document.querySelector(s);
const val=(x,fallback=0)=>x==null?fallback:Number(x);
const fmt=x=>x==null?'–':nf.format(Number(x));
const score=x=>x==null?'–':Number(x).toFixed(1).replace('.',',');
const dt=x=>x?new Date(x):null;
const latest=p=>p.history?.length?p.history[p.history.length-1]:null;

function baseline(p,hours){
  const l=latest(p); if(!l)return null;
  const target=dt(l.t).getTime()-hours*3600000;
  let best=null;
  for(const m of p.history){
    const t=dt(m.t).getTime();
    if(t<=target)best=m; else break;
  }
  return best;
}
function deltaObj(a,b){
  if(!a||!b)return null;
  return {
    hours:(dt(a.t)-dt(b.t))/3600000,
    points:val(a.points)-val(b.points),
    visits:val(a.visits)-val(b.visits),
    favorites:val(a.favorites)-val(b.favorites),
    comments:val(a.comments)-val(b.comments)
  };
}
function delta(p,h){return deltaObj(latest(p),baseline(p,h));}
function ratePerHour(d){return d&&d.hours>0?d.points/d.hours:null;}
function cls(n){return n>0?'positive':n<0?'negative':'neutral';}
function dtext(n,suffix=''){return n==null?'–':`${n>0?'+':''}${nf.format(n)}${suffix}`;}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function enriched(p){
  const l=latest(p),d1=delta(p,1),d3=delta(p,3),d6=delta(p,6),d24=delta(p,24);
  return {...p,l,d1,d3,d6,d24,momentum:ratePerHour(d1),
    points100:l&&val(l.visits)>0?100*val(l.points)/val(l.visits):null,
    favRate:l&&val(l.visits)>0?100*val(l.favorites)/val(l.visits):null};
}

function rebuildModel(){
  posts=(D.posts||[]).map(enriched).filter(p=>p.l);
  if(!selected || !posts.some(p=>String(p.postId)===String(selected))){
    const first=[...posts].sort((a,b)=>val(b.l.points)-val(a.l.points))[0];
    selected=first?String(first.postId):null;
  }
}

function renderHeader(){
  $('#updatedText').textContent=D.generatedAt?df.format(new Date(D.generatedAt)):'sin datos';
  $('#storageText').textContent=`${D.storage?.engine||'SQL Server'} · ${D.storage?.database||''}`;
  const totals=posts.reduce((a,p)=>{
    a.points+=val(p.l.points); a.visits+=val(p.l.visits);
    a.favorites+=val(p.l.favorites); a.comments+=val(p.l.comments); return a;
  },{points:0,visits:0,favorites:0,comments:0});
  $('#summary').innerHTML=[
    ['Posts',posts.length],['Puntos',totals.points],['Visitas',totals.visits],
    ['Favoritos',totals.favorites],['Comentarios',totals.comments]
  ].map(([k,v])=>`<div class="stat"><b>${fmt(v)}</b><span>${k}</span></div>`).join('');

  const topPoints=[...posts].sort((a,b)=>val(b.l.points)-val(a.l.points))[0];
  const topMomentum=[...posts].filter(p=>p.momentum!=null).sort((a,b)=>b.momentum-a.momentum)[0];
  const topFav=[...posts].sort((a,b)=>val(b.l.favorites)-val(a.l.favorites))[0];
  const hi=(label,p,value)=>`<div class="highlight"><small>${label}</small><b>${escapeHtml(p?.title||'Histórico insuficiente')}</b><strong>${value??'–'}</strong></div>`;
  $('#highlights').innerHTML=
    hi('Más puntos',topPoints,topPoints?`${fmt(topPoints.l.points)} pts`:'–')+
    hi('Momentum 1h',topMomentum,topMomentum?`${topMomentum.momentum.toFixed(1)} pts/h`:'–')+
    hi('Más favoritos',topFav,topFav?`${fmt(topFav.l.favorites)} fav`:'–');
}

function renderSelect(){
  const select=$('#postSelect');
  select.innerHTML=[...posts].sort((a,b)=>val(b.l.points)-val(a.l.points))
    .map(p=>`<option value="${p.postId}">${escapeHtml(p.title)}</option>`).join('');
  if(selected) select.value=selected;
}

function windowCell(d){
  if(!d)return '<span class="neutral">–</span>';
  return `<span class="${cls(d.points)}">${dtext(d.points)}</span>`;
}
function renderTable(filter=''){
  const q=filter.trim().toLowerCase();
  const rows=[...posts]
    .filter(p=>!q||p.title.toLowerCase().includes(q)||String(p.postId).includes(q))
    .sort((a,b)=>val(b.l.points)-val(a.l.points));
  $('#rankingBody').innerHTML=rows.map(p=>`<tr data-id="${p.postId}" class="${String(p.postId)===String(selected)?'selected':''}">
    <td><span class="title">${escapeHtml(p.title)}</span><small class="topic">topic #${p.postId}</small></td>
    <td>${fmt(p.l.points)}</td><td>${fmt(p.l.visits)}</td><td>${fmt(p.l.favorites)}</td><td>${fmt(p.l.comments)}</td>
    <td>${score(p.l.score)}</td><td>${windowCell(p.d1)}</td><td>${windowCell(p.d3)}</td><td>${windowCell(p.d24)}</td>
    <td>${p.points100==null?'–':p.points100.toFixed(2)}</td></tr>`).join('');
  document.querySelectorAll('#rankingBody tr').forEach(tr=>tr.addEventListener('click',()=>{
    selected=tr.dataset.id;
    $('#postSelect').value=selected;
    renderTable($('#search').value);
    renderDetail();
  }));
}
function metricRow(label,value){return `<div><b>${fmt(value)}</b><span>${label}</span></div>`;}
function wcard(label,d){
  return `<div class="window-card"><h4>${label}</h4>${
    [['Puntos',d?.points],['Visitas',d?.visits],['Favoritos',d?.favorites],['Comentarios',d?.comments]]
      .map(([k,v])=>`<div><span>${k}</span><b class="${v==null?'neutral':cls(v)}">${dtext(v)}</b></div>`).join('')
  }</div>`;
}
function draw(canvas,history,key){
  const ctx=canvas.getContext('2d'),rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  canvas.width=Math.max(1,Math.floor(rect.width*dpr)); canvas.height=Math.max(1,Math.floor(rect.height*dpr));
  ctx.scale(dpr,dpr);
  const w=rect.width,h=rect.height,pad=12; ctx.clearRect(0,0,w,h);
  const pts=history.map(m=>({x:dt(m.t).getTime(),y:m[key]==null?null:Number(m[key])})).filter(p=>p.y!=null);
  if(pts.length<2)return;
  let minX=pts[0].x,maxX=pts[pts.length-1].x,minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));
  if(maxY===minY)maxY=minY+1;
  ctx.strokeStyle='rgba(143,160,184,.18)'; ctx.lineWidth=1;
  for(let i=1;i<4;i++){
    const y=pad+(h-2*pad)*i/4; ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke();
  }
  ctx.strokeStyle='#70a7ff';ctx.lineWidth=2;ctx.beginPath();
  pts.forEach((p,i)=>{
    const x=pad+(p.x-minX)/(maxX-minX||1)*(w-2*pad);
    const y=h-pad-(p.y-minY)/(maxY-minY)*(h-2*pad);
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  });
  ctx.stroke();
}
function renderDetail(){
  const p=posts.find(x=>String(x.postId)===String(selected));
  if(!p){$('#detail').innerHTML='<div class="empty">Todavía no hay muestras.</div>';return;}
  const l=p.l;
  $('#detail').innerHTML=`<div class="detail-head"><div>
    <h3><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.title)}</a></h3>
    <p>Topic #${p.postId} · ${fmt(p.samples)} muestras · última ${df.format(new Date(l.t))}</p>
    </div><div class="score-pill"><b>${score(l.score)}</b><small>score / 10</small></div></div>
    <div class="current-grid">${metricRow('Puntos',l.points)}${metricRow('Visitas',l.visits)}
    ${metricRow('Favoritos',l.favorites)}${metricRow('Comentarios',l.comments)}
    <div><b>${p.momentum==null?'–':p.momentum.toFixed(1)}</b><span>Pts/h (1h)</span></div></div>
    <div class="windows">${wcard('Última 1 hora',p.d1)}${wcard('Últimas 3 horas',p.d3)}
    ${wcard('Últimas 6 horas',p.d6)}${wcard('Últimas 24 horas',p.d24)}</div>
    <div class="charts"><div class="chart-box"><header><b>Evolución de puntos</b><span>${D.historyDays||7} días</span></header>
    <canvas id="pointsChart"></canvas></div><div class="chart-box"><header><b>Evolución de visitas</b><span>${D.historyDays||7} días</span></header>
    <canvas id="visitsChart"></canvas></div></div>`;
  requestAnimationFrame(()=>{
    draw($('#pointsChart'),p.history,'points');
    draw($('#visitsChart'),p.history,'visits');
  });
}
function renderAll(){
  rebuildModel();
  renderHeader();
  renderSelect();
  renderTable($('#search')?.value||'');
  renderDetail();
}

async function loadFreshData(){
  try{
    const before=D.generatedAt||'';
    const url=`data/dashboard.js?t=${Date.now()}`;
    const r=await fetch(url,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const code=await r.text();
    (0,eval)(code);
    const fresh=window.IDENTI_ANALYTICS_DATA;
    if(fresh && fresh.generatedAt && fresh.generatedAt!==before){
      D=fresh;
      renderAll();
      console.info('Identi Analytics actualizado:',D.generatedAt);
    }
  }catch(err){
    console.warn('No se pudo refrescar dashboard.js:',err);
  }
}

$('#search').addEventListener('input',e=>renderTable(e.target.value));
$('#postSelect').addEventListener('change',e=>{
  selected=e.target.value; renderTable($('#search').value); renderDetail();
});
window.addEventListener('resize',()=>renderDetail());

renderAll();

/* Primera comprobación inmediata: evita mostrar una copia cacheada al abrir desde móvil. */
setTimeout(loadFreshData,500);

/* Luego consulta el archivo publicado cada 60 s sin caché. */
const refresh=Math.max(30,Number(D.autoRefreshSeconds||60));
setInterval(loadFreshData,refresh*1000);

})();
