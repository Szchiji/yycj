// Node/jsdom only: listing-card markup and action placement. No network or screenshots.
const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=name=>fs.readFileSync(path.join(root,'miniapp',name),'utf8');
(async()=>{
  const dom=new JSDOM('<!doctype html><div id="adminListings"></div>',{url:'https://test.invalid/',runScripts:'outside-only'});
  const w=dom.window,d=w.document;
  w.eval(src('edit-state-ui.js'));
  w.eval(src('admin-ops.js'));
  assert.equal(typeof w.yycjAdminListings.render,'function');
  const edit={operation_id:'op-1',text_saved:true,review_status:'none',action:'text',channel_status:'synced',channel_retryable:false,notification_status:'not_required',notification_retryable:false,album:'https://t.me/example/1001'};
  const items=[
    {lamp_id:'xiaoming',title:'小明',city:'深圳',status:'active',expires_at:'2026-12-04T00:00:00Z',updated_at:'2026-11-11T10:00:00Z'},
    {lamp_id:'xiaohong',title:'小红',city:'深圳',status:'active',expires_at:'2026-12-11T00:00:00Z',updated_at:'2026-11-11T10:00:00Z',edit_state:edit},
    {lamp_id:'xiaoqing',title:'小青',city:'深圳',status:'hidden',unlist_reason:'teacher',expires_at:'2026-12-20T00:00:00Z',updated_at:'2026-11-11T10:00:00Z'}
  ];
  w.yycjAdminListings.render(items);
  const cards=[...d.querySelectorAll('#adminListings .listing-card')];
  assert.equal(cards.length,3);
  const hong=d.querySelector('[data-fill-proxy="xiaohong"]').closest('.listing-card');
  const status=hong.querySelector('.edit-result');
  assert(status, '小红 should show 本次修改状态');
  assert(status.textContent.includes('本次修改状态'));
  assert(status.textContent.includes('文字已保存；有效期不变'));
  assert(status.textContent.includes('原频道文字已同步'));
  assert(status.textContent.includes('无需老师通知'));
  assert(status.querySelector('a') && status.querySelector('a').getAttribute('href')==='https://t.me/example/1001');
  // Status is a sibling of actions, not a grid auto-column companion of the button row.
  assert.equal(hong.querySelector('.meta').nextElementSibling,status);
  assert(hong.querySelector('.listing-actions'));
  assert.equal(status.nextElementSibling,hong.querySelector('.listing-actions'));
  // Primary row for an already-active card: 修改资料 / 续期 / 下架 / 更多. 重新上架 is in 更多, 续期 is not truncated.
  const primary=[...hong.querySelector('.listing-actions').children].filter(el=>el.matches('button, details'));
  assert.deepEqual(primary.map(el=>el.tagName==='DETAILS'?'更多':el.textContent.trim()),['修改资料','续期','下架','更多']);
  assert(!hong.querySelector(':scope > .listing-actions > [data-list="relist"]'));
  const moreRelist=hong.querySelector('.listing-more-menu [data-list="relist"]');
  assert(moreRelist && moreRelist.textContent.trim()==='重新上架');
  assert(hong.querySelector('.listing-more-menu [data-list="delete"]'));
  assert(!d.body.textContent.includes('续期…'));
  assert(!d.body.textContent.includes('续期...'));
  // Hidden card: 重新上架 is the primary action, not tucked away only.
  const qing=d.querySelector('[data-fill-proxy="xiaoqing"]').closest('.listing-card');
  const qingPrimary=qing.querySelector(':scope > .listing-actions > [data-list="relist"]');
  assert(qingPrimary && qingPrimary.classList.contains('primary'));
  assert(!qing.querySelector('[data-list="unlist"]'));
  // Existing data-list / data-fill-proxy contract is unchanged for handlers.
  for (const sel of ['[data-fill-proxy]','[data-list="renew"]','[data-list="relist"]','[data-list="delete"]']) {
    assert(d.querySelector(sel), sel);
  }
  const css=src('admin.css');
  assert(css.includes('#adminListings > .pick-item'));
  assert(css.includes('flex-direction: column'));
  assert(css.includes('min-height: 44px'));
  console.log('listing layout DOM: stacked status, 续期 label, active relist in 更多, hidden relist primary PASS');
  w.close();
})().catch(e=>{console.error(e);process.exit(1)});
