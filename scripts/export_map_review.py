#!/usr/bin/env python3
"""Export actual map modules + vendored Leaflet with labelled schematic tiles; no auth/SDK/network."""
import argparse
import json
from pathlib import Path
import re
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from bot.services.feed_filters import center_of


def export(dest):
 dest.mkdir(parents=True,exist_ok=True)
 items=[];groups=[]
 for district,count in [('南山',6),('福田',3),('罗湖',2),('宝安',1)]:
  ids=[]
  for i in range(count):
   ident=district+'-'+str(i);ids.append(ident);items.append({'lamp_id':ident,'title':['小青','小红','小蓝','小荷','小晴','小宁'][i],'city':'深圳','district':district,'open_text':'营业中' if i%2==0 else '休息','media_count':1 if i==1 else 0,'cover_url':'/offline-fixture-photo.svg' if i==1 else ''})
  lat,lng=center_of('深圳',district);groups.append({'district':district,'count':count,'lat':lat,'lng':lng,'lamp_ids':ids})
 items.append({'lamp_id':'unknown','title':'未标注区中心示例','city':'深圳','district':'未标注地区','media_count':0})
 data={'city':'深圳','items':items,'map_groups':groups,'map_truncated':False}

 base=(ROOT/'miniapp/index.html').read_text()
 base=re.sub(r'<script\b[^>]*>[\s\S]*?</script>','',base)
 base=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>',lambda m:'<style>'+(ROOT/'miniapp/app.bundle.css').read_text()+'</style>',base)
 base=base.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob: file:; connect-src \'none\'; form-action \'none\'">')
 base=base.replace('</head>','<style>'+(ROOT/'miniapp/vendor/leaflet/leaflet.css').read_text()+'''\n#mapReviewCaption{background:#2b342a;color:#ddcb90;font:11px/1.6 sans-serif;padding:5px 12px;text-align:center;border-bottom:1px solid #53654a}#boot,#gate{display:none!important}#app{display:block!important}.schematic-tile{background:#1c332d;color:#4b6b56;font:11px sans-serif}.map-review-photo{display:none}</style></head>''')
 base=base.replace('<body>','<body><div id="mapReviewCaption">离线审核 · 示例资料 / 示意底图（非真实道路） · 未发布</div>',1)
 leaf=(ROOT/'miniapp/vendor/leaflet/leaflet.js').read_text()
 setup='''
localStorage.setItem('yycj_city','深圳');
const $=s=>document.querySelector(s);$('#app').classList.remove('hidden');$('#boot')?.classList.add('hidden');$('#gate')?.classList.add('hidden');$('#btnCity').textContent='深圳 ▾';
let lastMap;const realMap=L.map;L.map=(...args)=>(lastMap=realMap(...args));
// Only tile rendering is replaced. Real Leaflet projection, bounds, zoom, markers and events run.
const Schematic=L.GridLayer.extend({createTile(coords){const c=document.createElement('canvas');c.width=c.height=256;c.className='schematic-tile';const g=c.getContext('2d');g.fillStyle='#eceee7';g.fillRect(0,0,256,256);g.strokeStyle='#b8c5b7';g.lineWidth=7;g.beginPath();g.moveTo(-10,40);g.lineTo(270,160);g.moveTo(60,-10);g.lineTo(180,270);g.stroke();g.strokeStyle='#c4d0be';g.lineWidth=1;g.strokeRect(0,0,256,256);g.fillStyle='#67786c';g.font='11px sans-serif';g.fillText('示意底图 · 非真实道路',18,220);return c;}});
L.tileLayer=()=>new Schematic({attribution:'离线示意图 · 非真实地图',maxZoom:15});window.__yycjLoadLeaflet=async()=>L;
const data=DATA;
// Explicitly illustrative sample media, not a real person's photo.
const photo='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="75"><rect width="60" height="75" fill="#3a604f"/><circle cx="30" cy="24" r="13" fill="#8ba38d"/><path d="M8 67 Q30 24 52 67" fill="#8ba38d"/><text x="30" y="73" text-anchor="middle" font-size="9" fill="#f0d69a">示例图</text></svg>');// Media response adapter: inline the known sample asset without changing product JS.
new MutationObserver(()=>{document.querySelectorAll('#hubMapSelection img[src="/offline-fixture-photo.svg"]').forEach(img=>img.src=photo)}).observe(document.body,{subtree:true,childList:true});
let seq=0,failNext=false,hold=false;window.__mapReviewCalls=0;
window.__yycjLoadHome=({mapArea=null}={})=>{const meta={seq:++seq,city:'深圳',area:mapArea};window.__mapReviewCalls++;window.dispatchEvent(new CustomEvent('yycj:map-loading',{detail:meta}));
 if(hold)return;
 setTimeout(()=>{if(failNext){failNext=false;window.dispatchEvent(new CustomEvent('yycj:map-error',{detail:meta}));return;}const ev=new CustomEvent('yycj:home-data',{detail:data});ev.mapRequest=meta;window.dispatchEvent(ev);},80);
};
window.fetch=async url=>{if(String(url).startsWith('/api/lamps/'))return{ok:true,json:async()=>({lamp:{title:'离线详情示例'}})};throw Error('offline only')};
window.__yycjRenderDetail=(d,id)=>{$('#detail').textContent='离线详情示例 · '+id};
'''.replace('DATA',json.dumps(data,ensure_ascii=False))
 source=''.join('<script>'+s.replace('</script','<\\/script')+'</script>' for s in [leaf,setup,(ROOT/'miniapp/map-results.js').read_text(),(ROOT/'miniapp/community-ui.js').read_text()])
 for case in ['overview','selected','chooser','empty','error','loading','desktop']:
  after='''
$('#hubMapToggle').click();
let ticks=0;const timer=setInterval(()=>{if(++ticks>100){clearInterval(timer);return}if(!lastMap||!document.querySelector('.hub-map-marker'))return;clearInterval(timer);
 setTimeout(()=>{
 const action=CASE;
 if(action==='selected'||action==='chooser'){
  const centre=data.map_groups.find(g=>g.district==='南山');lastMap.setView([centre.lat,centre.lng],14,{animate:false});
  const marker=[...document.querySelectorAll('.hub-map-marker')].find(e=>e.getAttribute('title')==='6份区域资料');
  marker?.click();if(action==='selected')document.querySelector('[data-map-select="南山-1"]')?.click();
 }
 if(['empty','error','loading'].includes(action)){
  lastMap.setView([22.1,113.7],13,{animate:false});if(action==='error')failNext=true;if(action==='loading')hold=true;
  setTimeout(()=>document.querySelector('#hubSearchArea')?.click(),60);
 }
 setTimeout(()=>{document.body.dataset.mapReviewReady='1'},220);
 },120);
},40);
'''.replace('CASE',json.dumps(case))
  (dest/('map-'+case+'.html')).write_text(base.replace('</body>',source+'<script>'+after+'</script></body>'))
 (dest/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>地图首批升级 · 离线审核</title><body style="font:16px sans-serif;background:#10251e;color:#dbc894;padding:24px"><h1>地图首批升级 · 未发布</h1><p>真实本地CSS/JS与Leaflet；示意底图和示例资料，不是真实道路/线上数据。无Telegram SDK/鉴权/定位权限。</p>'+''.join('<p><a style="color:#e2ca83" href="map-'+c+'.html">'+c+'</a></p>' for c in ['overview','selected','chooser','empty','error','loading','desktop'])+'</body>')
 print(str(dest))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);export(p.parse_args().output.resolve())
