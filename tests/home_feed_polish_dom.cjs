// Offline jsdom: equal-height cards, full hours, vertical announce flip. No network.
const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=name=>fs.readFileSync(path.join(root,'miniapp',name),'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const rose=src('theme-rose.css'), styles=src('styles.css'), inline=src('home-inline.css'), fix=src('home-fix.css'), homeUi=src('home-ui.js'), ws=src('workspace.js'), wsCss=src('workspace.css');
  assert.match(rose,/height:\s*240px/);
  assert.match(rose,/height:\s*72px/);
  assert.doesNotMatch(rose,/height:\s*224px/);
  assert.match(rose,/\.st-hours/);
  assert.match(inline,/gap:\s*6px/);
  assert.match(fix,/gap:\s*6px/);
  assert.match(styles,/gap:\s*6px/);
  assert.doesNotMatch(styles,/@keyframes\s+marquee/);
  assert.doesNotMatch(styles,/animation:\s*marquee/);
  assert.match(styles,/announce-track/);
  assert.match(homeUi,/st-hours" \+ \(hours \? "" : " is-empty"\)/);
  assert.match(homeUi,/__yycjPaintAnnounce/);
  assert.doesNotMatch(homeUi,/\+ "点"/);
  assert.match(ws,/data-ann-item/);
  assert.match(ws,/添加一条公告/);
  assert.match(wsCss,/\.ws-ann-list/);

  const html=fs.readFileSync(path.join(root,'miniapp/index.html'),'utf8');
  const dom=new JSDOM(html,{url:'https://offline.invalid/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document;
  w.__yycjHomeBooted=true;
  w.localStorage.setItem('yycj_token','OFFLINE_UNIT_ONLY');
  w.localStorage.setItem('yycj_city','深圳');
  const items=[
    {lamp_id:'xiaoming',title:'小明',city:'深圳',district:'福田',price_text:'9999',hours_text:'10:00–次日00:00',open_text:'营业中',open_code:'open',feed_pinned:true,media_count:4},
    {lamp_id:'xiaohong',title:'小红',city:'深圳',district:'南山',price_text:'1000P 2500PP',hours_text:'09:00–00:00',open_text:'营业中',open_code:'open',feed_pinned:true,media_count:8},
    {lamp_id:'qiandao',title:'千岛',city:'深圳',district:'福田',price_text:'1200P 1800PP',hours_text:'',media_count:8}
  ];
  w.fetch=async()=>({ok:true,json:async()=>({city:'深圳',enabled_cities:['深圳'],items,pins:items.slice(0,2).map(lamp=>({lamp})),has_more:false,announcement:{text:'欢迎使用月影车姬',items:['欢迎使用月影车姬','第二条评审公告'],enabled:true}})});
  w.eval(homeUi);
  await w.__yycjLoadHome();
  await wait(0);
  const cards=[...d.querySelectorAll('#feed .feed-card')];
  assert.equal(cards.length,3);
  assert.equal(cards.map(c=>c.querySelector('.st-hours')).length,3);
  assert.equal(d.querySelector('[data-id="xiaoming"] .st-hours').textContent,'10:00–次日00:00');
  assert.equal(d.querySelector('[data-id="xiaohong"] .st-hours').textContent,'09:00–00:00');
  assert(d.querySelector('[data-id="qiandao"] .st-hours').classList.contains('is-empty'));
  assert.equal(d.querySelector('[data-id="qiandao"] .st-hours').innerHTML,'&nbsp;');
  for (const c of cards) {
    assert(!c.textContent.includes('10-00点') && !c.textContent.includes('10–00点'));
    assert(!c.textContent.includes('09-00点'));
  }
  const ann=d.querySelector('#announce');
  assert(ann && !ann.classList.contains('hidden'));
  assert(ann.classList.contains('is-flip'));
  assert.equal(ann.querySelectorAll('.announce-item').length,3); // 2 + clone
  assert.equal(ann.querySelector('.announce-item').textContent,'欢迎使用月影车姬');
  assert(typeof w.__yycjPaintAnnounce==='function');

  w.__yycjPaintAnnounce({announcement:{text:'仅一条公告',items:['仅一条公告'],enabled:true}});
  assert(ann.classList.contains('is-static'));
  assert(!ann.classList.contains('is-flip'));
  assert.equal(ann.querySelectorAll('.announce-item').length,1);
  assert.equal(ann.querySelector('.announce-item').textContent,'仅一条公告');

  w.__yycjPaintAnnounce({announcement:{text:'',items:[],enabled:true}});
  assert(ann.classList.contains('hidden'));

  w.__yycjPaintAnnounce({announcement:{text:'旧字段单条'}});
  assert(ann.classList.contains('is-static'));
  assert.equal(ann.querySelector('.announce-item').textContent,'旧字段单条');

  w.close();
  console.log('home feed polish DOM: equal hours row, full hours text, vertical flip/static/hidden PASS');
})().catch(e=>{console.error(e);process.exit(1)});
