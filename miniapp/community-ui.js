// City community, shared-filter district map, and a light review ranking. No new bottom tab.
(() => {
  const $ = s => document.querySelector(s);
  const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const city = () => localStorage.getItem('yycj_city') || '';
  const api = async path => { const r=await fetch(path,{headers:{Authorization:'Bearer '+(localStorage.getItem('yycj_token')||'')}}); const d=await r.json(); if(!r.ok) throw new Error(d.detail || '加载失败'); return d; };
  function show(name) { document.querySelectorAll('.view').forEach(v=>v.classList.toggle('hidden',v.id !== 'view-'+name)); }
  function openLink(url) { const tg=window.Telegram?.WebApp; if(/^https:\/\/t\.me\//.test(url) && tg?.openTelegramLink) tg.openTelegramLink(url); else if(tg?.openLink) tg.openLink(url); else window.open(url,'_blank','noopener'); }
  function panel() {
    let p=$('#view-community'); if(p) return p;
    p=document.createElement('section');p.id='view-community';p.className='view hidden';$('#view-home')?.parentNode.appendChild(p); return p;
  }
  let request=0, back='me';
  async function open(kind) {
    if(!$('#view-home')?.classList.contains('hidden')) back='home'; else if(!$('#view-me')?.classList.contains('hidden')) back='me';
    const p=panel(), seq=++request, c=city();
    p.innerHTML=`<button class="btn" data-hub-back>‹ 返回</button><div class="card"><h2>${esc(c)} · ${kind==='ranking'?'本城评价榜':'城市社区'}</h2><div id="hubBody">加载中…</div></div>`;show('community');
    try {
      const d=await api('/api/community'+(kind==='ranking'?'/ranking':'')+'?city='+encodeURIComponent(c)); if(seq!==request || c!==city()) return;
      const body=$('#hubBody'); if(!body) return;
      if(kind==='ranking') body.innerHTML=`<p class="muted">${esc(d.rule)}</p>`+(d.items.length?d.items.map(x=>`<button class="hub-row" data-hub-lamp="${esc(x.lamp_id)}"><b>${x.rank}. ${esc(x.title)}</b><span>${esc(x.district || '')} · ${x.review_count} 位评价</span></button>`).join(''):'<p class="muted">近30天暂无符合条件的评价，不编造榜单。</p>');
      else body.innerHTML=`<p class="muted">月影车姬 · ${esc(d.city)}，仅显示已配置的官方入口。</p>`+(d.links.length?d.links.map(x=>`<button class="hub-row" data-hub-url="${esc(x.url)}"><b>${esc(x.label)}</b><span>前往 ›</span></button>`).join(''):'<p class="muted">本城社区入口暂未配置。</p>')+`<p class="muted">${d.links.some(x=>x.key==='discussion')?'':'本城暂未开群。'}目录设置变更在12:00刷新后生效。</p><button class="hub-row" data-hub="ranking"><b>本城评价榜</b><span>近30天 ›</span></button>`;
    } catch(e) { if(seq===request && $('#hubBody')) $('#hubBody').innerHTML=`<p class="muted">${esc(e.message)}</p><button class="btn" data-hub="${kind}">重试</button>`; }
  }
  document.addEventListener('click',ev=>{
    const b=ev.target.closest('[data-hub],[data-hub-url],[data-hub-lamp],[data-hub-back]');if(!b)return;
    if(b.dataset.hub) open(b.dataset.hub);
    else if(b.dataset.hubUrl) openLink(b.dataset.hubUrl);
    else if(b.dataset.hubLamp) { show('detail');window.__yycjOpenLamp=b.dataset.hubLamp;fetchDetail(b.dataset.hubLamp); }
    else { ++request;show(back); }
  });
  async function fetchDetail(id) { try { const d=await api('/api/lamps/'+encodeURIComponent(id)); if(window.__yycjOpenLamp === id) window.__yycjRenderDetail?.(d,id); } catch(e) { window.__yycjToast?.(e.message); } }
  // One community action in the top-left header, with no duplicate homepage row.
  function mount() {
    const home=$('#view-home');if(!home) return;
    if(!$('#hubHomeEntry')) { const b=document.createElement('button');b.id='hubHomeEntry';b.type='button';b.className='top-admin';b.dataset.hub='community';b.textContent='本城社区';const old=$('#topAdmin');if(old)old.replaceWith(b);else $('.topbar')?.prepend(b); }
    if(!$('#hubMapToggle')) { const b=document.createElement('button');b.id='hubMapToggle';b.className='btn hub-map-toggle';b.type='button';b.textContent='地图';b.setAttribute('aria-pressed','false');const anchor=$('#btnSearch'); if(anchor) anchor.insertAdjacentElement('afterend',b); b.onclick=()=>{window.__yycjMapMode=!window.__yycjMapMode;b.textContent=window.__yycjMapMode?'列表':'地图';b.setAttribute('aria-pressed',String(window.__yycjMapMode)); syncMapMode();window.__yycjLoadHome?.();}; }
    if(!$('#hubMapWrap')) { const w=document.createElement('div');w.id='hubMapWrap';w.className='hidden';w.innerHTML='<p class="muted">同一套搜索 / 筛选 · 按区中心聚合，并非资料精确位置</p><div id="hubResultMap"></div><div id="hubMapRows"></div>';$('#feed')?.insertAdjacentElement('beforebegin',w); }
  }
  function syncMapMode() { const on=!!window.__yycjMapMode;$('#feed')?.classList.toggle('hidden',on);$('#pins')?.classList.toggle('hidden',on);$('#hubMapWrap')?.classList.toggle('hidden',!on);if(on) $('#btnLoadMore')?.classList.add('hidden'); }
  let map=null, layer=null, lastSeq=0;
  async function drawMap(data) {
    mount();syncMapMode();if(!window.__yycjMapMode)return;
    const seq=++lastSeq, rows=$('#hubMapRows'), groups=data.map_groups || [], items=data.items || [];
    const list = group => { const ids=new Set(group?.lamp_ids || items.map(x=>x.lamp_id)); rows.innerHTML=`<p class="muted">${esc(group?.district || '全部区域')} · ${ids.size} 份资料${data.map_truncated?'（最多显示600份，请缩小筛选）':''}</p>`+items.filter(x=>ids.has(x.lamp_id)).map(x=>`<button class="hub-row" data-hub-lamp="${esc(x.lamp_id)}"><b>${esc(x.title)}</b><span>${esc(x.district || '其他')}${x.distance?' · '+esc(x.distance):''} ›</span></button>`).join(''); };
    list();
    const known=groups.filter(g=>g.lat!=null && g.lng!=null);$('#hubResultMap').classList.toggle('hidden',!known.length);
    if(!known.length) { rows.insertAdjacentHTML('afterbegin','<p class="muted">当前结果暂无公开区中心，可查看下方列表。</p>');return; }
    try {
      const L=await window.__yycjLoadLeaflet();if(seq!==lastSeq || !window.__yycjMapMode)return;
      if(!map) {
        map=L.map('hubResultMap',{scrollWheelZoom:false}).setView([known[0].lat,known[0].lng],11);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:15,attribution:'© OpenStreetMap'}).addTo(map);
        layer=L.layerGroup().addTo(map);
      }
      layer.clearLayers();const pts=[];
      known.forEach(g=>{const pt=[g.lat,g.lng];pts.push(pt);L.marker(pt,{icon:L.divIcon({className:'hub-cluster',html:`<b>${g.count}</b><span>${esc(g.district)}</span>`,iconSize:[68,48]})}).addTo(layer).on('click',()=>list(g));});
      map.invalidateSize();map.fitBounds(pts,{padding:[40,40],maxZoom:12});
    } catch(e) { rows.insertAdjacentHTML('afterbegin','<p class="muted">地图加载失败，结果列表仍可使用。</p>'); }
  }
  window.addEventListener('yycj:home-data',ev=>drawMap(ev.detail));
  mount();
  // Welcome's known 「我的」 target, after authentication finishes.
  if(new URLSearchParams(location.search).get('page')==='me') { let tries=0;const go=()=>{if($('#app')&&!$('#app').classList.contains('hidden')) {$('[data-nav="me"]')?.click();} else if(++tries<80) setTimeout(go,150);};go(); }
})();
