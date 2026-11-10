'use strict';
const KEY='china-research-radar-v1';
const STATUS={open:'开放中',upcoming:'即将开放',verify:'待核实',closed:'已截止'};
const DISCIPLINE={natural:'自然科学',social:'社会科学（含人文）'};
const REGION={'国内':'中国','国际':'国外'};
const LEVEL={national:'全国性',province:'省级 / 直辖市',city:'市级',joint:'跨地区联合',overseas:'国外'};
const TYPE={'科研基金':['fund','◈'],'青年人才':['talent','✦'],'博士后':['postdoc','◉'],'交流合作':['exchange','↗'],'国际资助':['international','◎'],'专家机会':['expert','◇'],'指南征集':['call','▤']};
const PRIORITY={open:0,upcoming:1,verify:2,closed:3};
const HINT_KEY='scigrantradar-setup-hint-dismissed';
let hintDismissed=false;try{hintDismissed=localStorage.getItem(HINT_KEY)==='1'}catch{}
let data=[],saved=[],checks={},preferences=null,layout='timeline',timer,view='national',previousView='national',explore={province:'',city:''};
try{const state=JSON.parse(localStorage.getItem(KEY)||'{}');saved=Array.isArray(state.saved)?state.saved.filter(id=>typeof id==='string'):[];checks=state.checks&&typeof state.checks==='object'?state.checks:{};preferences=normalizePreferences(state.preferences)}catch{}
if(preferences){view='home';layout=preferences.layout}
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function persist(){try{localStorage.setItem(KEY,JSON.stringify({saved,checks,preferences,preferencesVersion:4}))}catch{toast('浏览器无法保存，当前选择仅在本次访问保留。')}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>$('#toast').classList.remove('visible'),2500)}

function card(d,instanceId=d.id){return `<article class="card" data-type="${(TYPE[d.category]||['fund'])[0]}" id="${esc(instanceId)}" data-opportunity="${esc(d.id)}"><div class="card-top"><div class="card-labels"><span class="tag type-tag"><span aria-hidden="true">${(TYPE[d.category]||['fund','◈'])[1]}</span>${esc(d.category)}</span><span class="tag region">${esc(scopeLabel(d))}${d.id.startsWith('csc-')?' · 赴国外':d.id==='yssp-2027'?' · 国际合作':''}</span><span class="tag discipline">${d.disciplines.map(v=>DISCIPLINE[v]).join(' / ')}</span></div><button class="save-button" data-save="${esc(d.id)}" aria-label="${saved.includes(d.id)?'取消收藏':'收藏'}：${esc(d.name)}" aria-pressed="${saved.includes(d.id)}">${saved.includes(d.id)?'★':'☆'}</button></div><div class="card-title"><h5>${esc(d.name)}</h5><p class="org">${esc(d.org)}<span class="scope-label">${esc(scopeLabel(d))}</span><span class="timeline-only timeline-context">${esc(scopeLabel(d))} · ${d.disciplines.map(v=>DISCIPLINE[v]).join(" / ")}</span></p></div><p class="card-summary">${esc(d.summary)}</p><div class="card-meta">${d.audience.map(a=>`<span>${esc(a)}</span>`).join('')}</div><div class="status-row"><span class="status-badge status-${d.status}">${STATUS[d.status]}</span><span class="date-text">${esc(d.dateLabel)}</span></div><p class="prep-row">准备时间（建议） · <strong>${esc(d.prep)}</strong></p><details><summary aria-label="查看详情：${esc(d.name)}"><span class="card-summary-label">查看资格、资助与官方来源</span><span class="list-only">详情</span></summary><div class="details-content"><p class="list-summary">${esc(d.summary)}</p><dl><dt class="list-only">职业阶段</dt><dd class="list-only">${d.audience.map(esc).join(" · ")}</dd><dt class="list-only">准备时间（建议）</dt><dd class="list-only">${esc(d.prep)}</dd><dt>适合领域</dt><dd>${esc(d.fields)}</dd><dt>地域要求</dt><dd>${esc(d.geographyNote||"以项目指南与依托单位要求为准。")}</dd><dt>资格与限制</dt><dd>${esc(d.eligibility)}</dd><dt>资助 / 参与形式</dt><dd>${esc(d.support)}</dd><dt>日期与状态说明</dt><dd>${esc(d.timeNote)}</dd><dt>下一步</dt><dd>${esc(d.next)}</dd></dl><div class="sources">${d.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗<span class="sr-only">（新标签页）</span></a>`).join('')}</div><p class="share-row"><button type="button" class="text-button" data-share="${esc(d.id)}">复制分享链接</button></p>${d.sourceNote?`<p class="verified">来源说明：${esc(d.sourceNote)}</p>`:""}<p class="verified">资料核验：${esc(d.verified)} · 原始指南优先</p></div></details></article>`}
const FILTERS={
  discipline:{label:'学科',all:'全部学科',options:()=>Object.entries(DISCIPLINE)},
  level:{label:'机会范围',all:'全部范围',options:()=>Object.entries(LEVEL)},
  category:{label:'机会类型',all:'全部类型',options:()=>Object.keys(TYPE).map(v=>[v,v])},
  audience:{label:'职业阶段',all:'全部阶段',options:()=>PREFERENCE_VALUES.audience.map(v=>[v,v])},
  status:{label:'申报状态',all:'全部状态',options:()=>Object.entries(STATUS)}
};
function filters(){return {q:$('#search').value.trim().toLowerCase(),...Object.fromEntries(Object.keys(FILTERS).map(key=>[key,Array.from(document.querySelectorAll('input[data-filter="'+key+'"]:checked')).map(el=>el.value)]))}}
function setFilter(key,values){document.querySelectorAll('input[data-filter="'+key+'"]').forEach(el=>el.checked=values.includes(el.value))}
function filterMenuMarkup(key,spec,pref=false){
  const prefix=pref?'pref':'filter',attribute=pref?'data-pref-filter':'data-filter';
  return '<details class="filter-menu" '+(pref?'data-pref-menu':'data-menu')+'="'+key+'"><summary><span class="filter-name">'+spec.label+'</span><span class="filter-value">'+spec.all+'</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><div class="filter-popover"><div class="filter-popover-heading"><strong>'+spec.label+' · 多选</strong><button type="button" '+(pref?'data-pref-reset':'data-filter-reset')+'="'+key+'" aria-label="清除'+(pref?'默认':'')+spec.label+'筛选">不限</button></div><div class="filter-options" role="group" aria-label="'+(pref?'默认':'')+spec.label+'选项">'+spec.options().map(([value,label],i)=>'<label for="'+prefix+'-'+key+'-'+i+'"><input id="'+prefix+'-'+key+'-'+i+'" type="checkbox" '+attribute+'="'+key+'" value="'+esc(value)+'"><span>'+esc(label)+'</span>'+(!pref?'<span class="option-count" data-filter-count="'+key+'" data-value="'+esc(value)+'" aria-hidden="true"></span>':'')+'</label>').join('')+'</div></div></details>';
}
function buildFilterMenus(){
  const previous=filters();
  $('#filter-menus').innerHTML=Object.entries(FILTERS).map(([key,spec])=>filterMenuMarkup(key,spec)).join('');
  Object.keys(FILTERS).forEach(key=>setFilter(key,previous[key]));
}
function sourceLabel(p){const scope=p.level||[];return !scope.length?'国内与国外':scope.every(v=>v==='overseas')?'国外':scope.includes('overseas')?'国内与国外':'国内'}
function disciplineLabel(p){return p.discipline.length===1?DISCIPLINE[p.discipline[0]]:'全部学科'}
function usingDefaults(f){return !f.q&&Object.keys(FILTERS).every(key=>JSON.stringify([...f[key]].sort())===JSON.stringify([...(preferences||DEFAULT_PREFERENCES)[key]].sort()))}
function scopeRows(target=view){return data.filter(d=>inView(d,target,preferences,explore)&&(target!=='saved'||saved.includes(d.id)))}
function applyDefaults(){const p=preferences||DEFAULT_PREFERENCES;$('#filters').reset();$('#sort').value='priority';Object.keys(FILTERS).forEach(key=>setFilter(key,p[key]));layout=p.layout}
function syncSidebar(){
  $('#home-location-label').textContent=preferences?areaLabel(preferences):'尚未设置';
  $('#edit-preferences').textContent=preferences?'更改':'设置';
  $('#home-preference-summary').textContent=preferences?disciplineLabel(preferences)+' · '+sourceLabel(preferences):'设置你的关注方向';
  document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
  document.querySelectorAll('[data-count]').forEach(el=>{const target=el.dataset.count,current=filters(),f=target==='home'?(view==='home'?current:preferences||{}):{...current,level:[]};el.textContent=!preferences&&['home','local'].includes(target)?'—':scopeRows(target).filter(d=>matches(d,f)).length});
  $('#saved-count').textContent=saved.filter(id=>data.some(d=>d.id===id)).length;
}
function syncControls(f,base){
  const chips=f.q?[['q',f.q,'搜索：'+f.q,f.q]]:[];
  Object.entries(FILTERS).forEach(([key,spec])=>{
    const labels=new Map(spec.options());
    const selected=f[key],menu=document.querySelector('[data-menu="'+key+'"]');
    const text=!selected.length?spec.all:selected.length===1?labels.get(selected[0]):'已选 '+selected.length+' 项';
    menu.querySelector('.filter-value').textContent=text;
    menu.querySelector('summary').title=selected.map(v=>labels.get(v)).join('、')||spec.all;
    menu.classList.toggle('has-selection',selected.length>0);
    selected.forEach(value=>chips.push([key,value,spec.label+'：'+labels.get(value),labels.get(value)]));
  });
  document.querySelectorAll('[data-filter-count]').forEach(el=>{const key=el.dataset.filterCount;el.textContent=base.filter(d=>matches(d,{...f,[key]:[el.dataset.value]})).length});
  $('#active-filters').hidden=!chips.length;$('#active-filters').innerHTML=chips.map(([key,value,label,display])=>'<button type="button" data-clear="'+key+'" data-value="'+esc(value)+'" aria-label="移除筛选：'+esc(label)+'">'+esc(display)+'<span aria-hidden="true">×</span></button>').join('');
  document.querySelectorAll('[data-layout]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layout===layout)));
  $('#cards').classList.toggle('list-layout',layout!=='cards');$('#cards').classList.toggle('timeline-layout',layout==='timeline');$('#sort').closest('label').hidden=layout==='timeline';
}
function titles(){
  if(view==='home'){
    const p=preferences||DEFAULT_PREFERENCES,f=filters();
    const area=sourceLabel(f)==='国外'?'':p.province?areaLabel(p):'全国性';
    const labels=[f.discipline.length===1?DISCIPLINE[f.discipline[0]]:'全部学科'];
    return ['与我相关',[area,sourceLabel(f),...labels].filter(Boolean).join(' · ')];
  }
  if(view==='national')return ['全国性机会','全国性项目 · 具体资格见项目详情'];
  if(view==='local')return ['省市机会',areaLabel(preferences)+' · 省级、市级与跨地区联合'];
  if(view==='overseas')return ['国外机会','国外资助与学术交流'];
  if(view==='explore')return ['探索其他地区',explore.province?areaLabel(explore)+' · 临时浏览':'北京、上海、江苏、浙江、广东、安徽'];
  return ['我的收藏','已收藏的机会，不受常用地区限制'];
}
function renderDates(rows){
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});
  const {events}=timelineEvents(rows);
  const next=events.filter(e=>e.date>=today&&['open','upcoming'].includes(e.d.status)).slice(0,3);
  $('.next-dates').hidden=!next.length;
  $('#date-cards').innerHTML=next.map(e=>'<a class="date-card" href="#'+esc(e.d.id)+'" data-jump="'+esc(e.d.id)+'"><time datetime="'+e.date+'"><strong>'+e.date.slice(5).replace('-',' / ')+'</strong><span>'+e.date.slice(0,4)+'</span></time><div><h3>'+esc(e.d.name)+'</h3><small>'+(e.kind==='opening'?'开放日期':'截止日期')+' · '+esc(e.d.category)+'</small></div><span class="date-arrow" aria-hidden="true">↗</span></a>').join('');
}
function render(){
  syncSidebar();document.body.dataset.mode=view;
  $('#preferences-page').hidden=view!=='settings';$('#browse-page').hidden=view==='settings';
  if(view==='settings')return;
  const base=scopeRows(),f=filters(),sort=$('#sort').value,rows=base.filter(d=>matches(d,f));
  rows.sort((a,b)=>(sort==='category'?a.category.localeCompare(b.category,'zh-CN'):0)||PRIORITY[a.status]-PRIORITY[b.status]||(a.date||'9999').localeCompare(b.date||'9999'));
  const expanded=new Set(Array.from(document.querySelectorAll('.card details[open]')).map(el=>el.closest('.card').id));
  const historyOpen=$('.timeline-history')?.open;
  $('#cards').innerHTML=rows.length?(layout==='timeline'?renderTimeline(rows):groupCards(rows)):'';
  if(historyOpen!==undefined&&$('.timeline-history'))$('.timeline-history').open=historyOpen;
  expanded.forEach(id=>{const el=document.getElementById(id);if(el)el.querySelector('details').open=true});
  const [heading,description]=titles();$('#view-heading').textContent=heading;$('#view-description').textContent=description;
  $('#list-title').textContent='机会库';$('#result-count').textContent=heading+' · '+rows.length+' 项';
  $('#empty').hidden=rows.length>0||!data.length;
  $('#explore-panel').hidden=view!=='explore';$('#explore-set-home').disabled=!explore.province;
  $('#location-prompt').hidden=!(view==='local'&&!preferences?.province);
  $('#setup-hint').hidden=!!preferences||hintDismissed||view==='local';
  $('#scope-context').textContent=view==='home'?(usingDefaults(f)?'默认关注范围':'临时筛选'):view==='explore'?'其他地区 · 临时浏览':heading;
  $('#restore-defaults').hidden=view!=='home'||!preferences||usingDefaults(f);
  $('#stat-total').textContent=rows.length;
  $('#stat-open').textContent=rows.filter(d=>d.status==='open').length;
  $('#stat-upcoming').textContent=rows.filter(d=>d.status==='upcoming').length;
  $('#stat-closed').textContent=rows.filter(d=>d.status==='closed').length;
  const unverified=rows.filter(d=>d.status==='verify').length;
  $('#stat-unverified').textContent=unverified;
  const localArea=view==='explore'?explore:preferences;
  const noCityCoverage=['home','local','explore'].includes(view)&&localArea?.city&&!data.some(d=>d.scope==='city'&&matchesArea(d,localArea));
  $('#coverage-note').hidden=!noCityCoverage;$('#coverage-note').textContent=noCityCoverage?localArea.city+'市级项目正在补充；当前已展示地域条件覆盖该市的省级与跨地区项目。':'';
  syncControls(f,base);renderDates(rows);
}
function groupCards(rows){
  const groups=[['natural','自然科学'],['social','社会科学（含人文）'],['both','自然科学与社会科学均适用']];
  const regions=['国内','国际'];
  return regions.map(region=>{
    const regional=rows.filter(d=>d.region===region);if(!regional.length)return '';
    return '<section class="region-group">'+(rows.some(d=>d.region!==region)?'<h3 class="region-heading">'+REGION[region]+'<span>'+regional.length+' 项机会</span></h3>':'')+groups.map(([key,label])=>{
      const entries=regional.filter(d=>key==='both'?d.disciplines.length>1:d.disciplines.length===1&&d.disciplines[0]===key);
      return entries.length?'<div class="discipline-group"><h4>'+label+'<span>'+entries.length+'</span></h4><div class="card-grid">'+entries.map(d=>card(d)).join('')+'</div></div>':'';
    }).join('')+'</section>';
  }).join('');
}
function clearFilters(){$('#filters').reset();$('#sort').value='priority';render()}
function goView(next,{scroll=true}={}){
  if(next==='settings'){openSettings();return}
  if(next==='home'&&!preferences){openSettings();return}
  view=next;if(next==='home')applyDefaults();else setFilter('level',[]);
  render();if(scroll)$('#main').scrollIntoView({behavior:'smooth',block:'start'});
}
function provinceOptions(select,first){select.innerHTML='<option value="">'+first+'</option>'+Object.keys(AREAS).map(p=>'<option value="'+p+'">'+p+'</option>').join('')}
function cityOptions(select,province,city,exploring=false){
  const cities=AREAS[province]||[];
  select.innerHTML='<option value="">'+(!province?'请先选择省份':!cities.length?'全市':exploring?'全省（含各市）':'省级机会 / 其他城市')+'</option>'+cities.map(c=>'<option value="'+c+'">'+c+'</option>').join('');
  select.disabled=!cities.length;select.value=cities.includes(city)?city:'';
}
function readPreferencesForm(){
  const p=Object.fromEntries(['province','city'].map(key=>[key,$('#pref-'+key).value]));
  p.layout=document.querySelector('[name="pref-layout"]:checked').value;
  p.coverage=Array.from(document.querySelectorAll('[data-pref-coverage]:checked')).map(el=>el.value);
  p.scopeVersion=2;
  Object.keys(FILTERS).filter(key=>key!=='level').forEach(key=>p[key]=Array.from(document.querySelectorAll('[data-pref-filter="'+key+'"]:checked')).map(el=>el.value));
  return normalizePreferences(p);
}
function updatePreferencePreview(){
  const p=readPreferencesForm(),layoutNames={timeline:'时间线',list:'列表',cards:'卡片'};
  Object.entries(FILTERS).filter(([key])=>key!=='level').forEach(([key,spec])=>{
    const menu=document.querySelector('[data-pref-menu="'+key+'"]'),labels=new Map(spec.options());
    menu.querySelector('.filter-value').textContent=!p[key].length?spec.all:p[key].length===1?labels.get(p[key][0]):'已选 '+p[key].length+' 项';
    menu.querySelector('summary').title=p[key].map(v=>labels.get(v)).join('、')||spec.all;
    menu.classList.toggle('has-selection',p[key].length>0);
  });
  const conditions=Object.entries(FILTERS).filter(([key])=>key!=='level').flatMap(([key,spec])=>p[key].length?[p[key].map(v=>new Map(spec.options()).get(v)).join(' / ')]:[]);
  $('#pref-province').disabled=false;
  $('#pref-city').disabled=!AREAS[p.province]?.length;
  const coverage=[p.coverage.includes('national')?'全国性':'',p.province?(['北京','上海'].includes(p.province)?p.province+'市':p.province+'省级'):'',p.city?p.city+'市级':'',p.coverage.includes('overseas')?'国外':''].filter(Boolean);
  $('#preference-preview-text').textContent=[coverage.join(' + '),...conditions,layoutNames[p.layout]].filter(Boolean).join(' · ');
  $('#preferences-form button[type=submit]').disabled=!p.level.length;
  const count=data.filter(d=>inView(d,'home',p,{})&&matches(d,p)).length;
  $('#preference-preview-count').textContent=!p.level.length?'请选择全国性、国外或一个省市。':!data.length?'正在载入机会…':count?'当前收录中匹配 '+count+' 项机会。':'当前暂无匹配机会，可减少筛选条件。';
  $('#pref-geography-hint').textContent=!p.province?'可选择省市，将当地机会加入关注范围。':p.city?'同时关注 '+p.province+'省级、'+p.city+'市级及覆盖该市的联合项目。':'同时关注 '+p.province+'省级 / 直辖市及覆盖该地区的联合项目。';
}
function fillPreferences(value){
  const p=normalizePreferences(value);
  $('#pref-province').value=p.province;
  document.querySelectorAll('[name="pref-layout"]').forEach(el=>el.checked=el.value===p.layout);
  document.querySelectorAll('[data-pref-coverage]').forEach(el=>el.checked=p.coverage.includes(el.value));
  cityOptions($('#pref-city'),p.province,p.city);
  Object.keys(FILTERS).forEach(key=>document.querySelectorAll('[data-pref-filter="'+key+'"]').forEach(el=>el.checked=p[key].includes(el.value)));
  updatePreferencePreview();
}
$('#preference-menus').innerHTML=Object.entries(FILTERS).filter(([key])=>key!=='level').map(([key,spec])=>filterMenuMarkup(key,spec,true)).join('');
function openSettings(draft){
  if(view!=='settings')previousView=view;
  view='settings';fillPreferences(draft||preferences||DEFAULT_PREFERENCES);$('#preferences-cancel').hidden=false;
  render();$('#main').scrollIntoView({behavior:'smooth',block:'start'});
}
provinceOptions($('#pref-province'),'不设置地区');
provinceOptions($('#explore-province'),'全部六个省市');
cityOptions($('#explore-city'),'','',true);
fillPreferences(preferences||DEFAULT_PREFERENCES);$('#preferences-cancel').hidden=!preferences;
$('#pref-province').addEventListener('change',()=>{cityOptions($('#pref-city'),$('#pref-province').value,'');updatePreferencePreview()});
$('#preferences-form').addEventListener('change',updatePreferencePreview);
$('#preferences-form').addEventListener('submit',e=>{e.preventDefault();preferences=readPreferencesForm();persist();goView('home',{scroll:false});$('#opportunity-library').scrollIntoView({behavior:'smooth',block:'start'});toast('默认配置已保存')});
$('#preferences-cancel').addEventListener('click',()=>{view=previousView==='settings'?'home':previousView;render();$('#main').scrollIntoView({behavior:'smooth',block:'start'})});
$('#edit-preferences').addEventListener('click',()=>openSettings());
document.querySelectorAll('[data-open-settings]').forEach(b=>b.addEventListener('click',()=>openSettings()));
$('#explore-province').addEventListener('change',()=>{explore.province=$('#explore-province').value;explore.city='';cityOptions($('#explore-city'),explore.province,'',true);render()});
$('#explore-city').addEventListener('change',()=>{explore.city=$('#explore-city').value;render()});
$('#explore-set-home').addEventListener('click',()=>{if(explore.province)openSettings({...preferences||DEFAULT_PREFERENCES,...explore})});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));
$('#nav-toggle').addEventListener('click',()=>{const open=$('#nav-toggle').getAttribute('aria-expanded')!=='true';$('#nav-toggle').setAttribute('aria-expanded',String(open));$('#nav-toggle').setAttribute('aria-label',open?'收起相关机会':'展开相关机会');$('#opportunity-subnav').hidden=!open});
document.querySelectorAll('[data-layout]').forEach(b=>b.addEventListener('click',()=>{layout=b.dataset.layout;render()}));
$('#filters').addEventListener('submit',e=>e.preventDefault());$('#filters').addEventListener('input',e=>{if(e.target.id==='search')render()});$('#filters').addEventListener('change',render);$('#sort').addEventListener('change',render);
$('#restore-defaults').addEventListener('click',()=>{applyDefaults();render()});
$('#reset').addEventListener('click',clearFilters);$('#empty-reset').addEventListener('click',clearFilters);
$('#active-filters').addEventListener('click',e=>{const b=e.target.closest('[data-clear]');if(!b)return;const key=b.dataset.clear;if(key==='q')$('#search').value='';else setFilter(key,filters()[key].filter(v=>v!==b.dataset.value));render()});
$('#cards').addEventListener('click',e=>{
  if(e.target.closest('[data-past-jump]')){const history=$('.timeline-history');history.open=true;history.scrollIntoView({behavior:'smooth',block:'start'});return}
  const share=e.target.closest('[data-share]');
  if(share){
    const hash=shareHash(share.dataset.share),url=location.origin+location.pathname+hash;
    (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast('链接已复制，可直接分享'),()=>{history.replaceState(null,'',hash);toast('链接已显示在地址栏，可复制分享')});
    return;
  }
  const b=e.target.closest('[data-save]');if(!b)return;const id=b.dataset.save;
  if(saved.includes(id)){saved=saved.filter(x=>x!==id);toast('已取消收藏')}else{saved.push(id);toast('已收藏')}persist();
  if(view==='saved')render();else{document.querySelectorAll('[data-save]').forEach(button=>{if(button.dataset.save!==id)return;button.textContent=saved.includes(id)?'★':'☆';button.setAttribute('aria-pressed',String(saved.includes(id)));button.setAttribute('aria-label',(saved.includes(id)?'取消收藏':'收藏')+'：'+data.find(d=>d.id===id).name)});syncSidebar()}
});
$('#date-cards').addEventListener('click',e=>{const a=e.target.closest('[data-jump]');if(!a)return;e.preventDefault();const c=document.querySelector('[data-opportunity="'+a.dataset.jump+'"]');if(c){c.querySelector('details').open=true;c.closest('.timeline-history')?.setAttribute('open','');c.scrollIntoView({behavior:'smooth',block:'center'})}});
document.querySelectorAll('[data-check]').forEach(el=>{el.checked=!!checks[el.dataset.check];el.addEventListener('change',()=>{checks[el.dataset.check]=el.checked;persist()})});
document.querySelectorAll('.sidebar a[href="#method"]').forEach(a=>a.addEventListener('click',()=>{if(view==='settings'){view=preferences?'home':'national';render()}}));
buildFilterMenus();applyDefaults();if(!preferences)Object.keys(FILTERS).forEach(key=>setFilter(key,[]));render();
const recordsLoaded=fetch('data/opportunities.json').then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json()}).then(rows=>{
  data=rows;buildFilterMenus();updatePreferencePreview();render();openShared();
}).catch(()=>{$('#load-error').hidden=false;$('#result-count').textContent='加载失败，请刷新重试'});

// Opens the opportunity named in a share link, in a view that lists it for every visitor.
function openShared(){
  const id=sharedId(location.hash),d=id&&data.find(x=>x.id===id);
  if(!d)return;
  view=viewForRecord(d);explore.province='';explore.city='';
  $('#explore-province').value='';cityOptions($('#explore-city'),'','',true);
  $('#filters').reset();render();
  const el=document.querySelector('[data-opportunity="'+CSS.escape(id)+'"]');
  if(!el)return;
  el.querySelector('details').open=true;el.closest('.timeline-history')?.setAttribute('open','');
  el.scrollIntoView({behavior:'instant',block:'start'});
}
window.addEventListener('hashchange',openShared);
$('#setup-hint-dismiss').addEventListener('click',()=>{hintDismissed=true;try{localStorage.setItem(HINT_KEY,'1')}catch{}render()});

const backToTop=$('#back-to-top');
function syncBackToTop(){backToTop.hidden=window.scrollY<360}
window.addEventListener('scroll',syncBackToTop,{passive:true});
backToTop.addEventListener('click',()=>{
  window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  $('.brand').focus({preventScroll:true});
});
syncBackToTop();

$('#filter-menus').addEventListener('click',e=>{
  const reset=e.target.closest('[data-filter-reset]');
  if(reset){setFilter(reset.dataset.filterReset,[]);render();return}
  const summary=e.target.closest('summary');
  if(summary)document.querySelectorAll('.filter-menu[open]').forEach(menu=>{if(menu!==summary.parentElement)menu.open=false});
});
document.addEventListener('click',e=>{if(!e.target.closest('.filter-menu'))document.querySelectorAll('.filter-menu[open]').forEach(menu=>menu.open=false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const menu=document.querySelector('.filter-menu[open]');if(menu){menu.open=false;menu.querySelector('summary').focus()}}});

$('#preferences-form').addEventListener('click',e=>{
  const reset=e.target.closest('[data-pref-reset]');
  if(reset){document.querySelectorAll('[data-pref-filter="'+reset.dataset.prefReset+'"]').forEach(el=>el.checked=false);updatePreferencePreview();return}
  const summary=e.target.closest('summary');
  if(summary)document.querySelectorAll('.filter-menu[open]').forEach(menu=>{if(menu!==summary.parentElement)menu.open=false});
});

recordsLoaded.then(()=>fetch('data/update-log.json')).then(r=>{if(!r.ok)throw Error('Unavailable');return r.json()}).then(log=>{
 const fmt=t=>new Date(t).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
 const runs=Array.isArray(log.runs)?log.runs:[];
 const checked=runs.find(run=>run.kind==='research'&&(run.checkedSources||[]).some(c=>c.result==='checked'));
 const last=checked?checked.at:null;
 const sidebarDate=last?new Date(last).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).replaceAll('/','-'):null;
 $('#sidebar-last-update').textContent='上次更新：'+(sidebarDate||'2026-11-10');
 $('#sidebar-last-update').title=last?fmt(last)+'（北京时间）':'2026-11-10';
 $('#data-update-status').textContent='每周收集，人工审核后发布 · '+(last?'最近检查 '+fmt(last):'尚无例行检查记录');
 const title=run=>run.kind==='initialize'?'初始收录':run.kind==='correction'?'人工更正':run.outcome==='partial'?'部分来源已检查':'来源检查完成';
 const counts=run=>run.kind==='correction'?'修改 '+Number(run.updated||0):'新增 '+Number(run.added||0)+' · 修改 '+Number(run.updated||0)+' · 核验 '+(run.checkedIds||[]).length+' 项';
 $('#update-log-content').innerHTML=runs.length?runs.map(run=>'<article><strong>'+esc(title(run))+'</strong><span>'+esc(fmt(run.at))+'（北京时间）</span><p>'+esc(run.kind==='initialize'?'已收录 '+data.length+' 项机会；各项目保留原核验日期。':run.summary)+'</p><p>'+esc(counts(run))+'</p>'+((run.issues||[]).length?'<ul>'+run.issues.map(x=>'<li>'+esc(x.label||x.url)+'：'+esc(x.message)+'</li>').join('')+'</ul>':'')+'</article>').join(''):'尚无更新记录';
}).catch(()=>{$('#sidebar-last-update').textContent='上次更新：2026-11-10';$('#data-update-status').textContent='更新记录暂不可用';$('#update-log-content').textContent='暂时无法读取，请稍后重试。';});
