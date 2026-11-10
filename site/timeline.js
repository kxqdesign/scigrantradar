function timelineEvents(rows){
  const events=[],undated=[];
  for(const d of rows){
    const opening=d.opensOn||(d.status==='upcoming'?d.date:null);
    const closing=d.deadline||(d.status!=='upcoming'?d.date:null);
    if(opening)events.push({d,date:opening,kind:'opening'});
    if(closing)events.push({d,date:closing,kind:'closing'});
    if(!opening&&!closing)undated.push(d);
  }
  events.sort((a,b)=>a.date.localeCompare(b.date)||(a.kind==='opening'?-1:1)-(b.kind==='opening'?-1:1)||a.d.name.localeCompare(b.d.name,'zh-CN'));
  return {events,undated};
}
function renderTimeline(rows){
  const {events,undated}=timelineEvents(rows);
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});
  const future=events.filter(e=>e.date>=today),past=events.filter(e=>e.date<today);
  const monthName=date=>date.slice(0,4)+'年'+Number(date.slice(5,7))+'月';
  function months(items,prefix){
    return [...new Set(items.map(e=>e.date.slice(0,7)))].map(month=>{
      const entries=items.filter(e=>e.date.startsWith(month));
      return '<section class="timeline-month" id="'+prefix+month+'"><h3>'+monthName(month)+'<span>'+entries.length+' 个节点</span></h3><div class="timeline-track">'+entries.map(e=>'<div class="timeline-event"><div class="timeline-date"><time datetime="'+e.date+'">'+Number(e.date.slice(5,7))+' / '+Number(e.date.slice(8,10))+'</time><span class="event-kind '+e.kind+'">'+(e.kind==='opening'?'开放':'截止')+'</span></div>'+card(e.d,e.d.id+'--'+e.kind)+'</div>').join('')+'</div></section>';
    }).join('');
  }
  const monthLinks=[...new Set(future.map(e=>e.date.slice(0,7)))].map(m=>'<a href="#timeline-'+m+'">'+monthName(m)+'</a>').join('');
  const undatedGroups=[{label:'滚动申请',items:undated.filter(d=>d.status==='open')},{label:'日期待核实',items:undated.filter(d=>!['open','closed'].includes(d.status))},{label:'已截止 · 日期待补充',items:undated.filter(d=>d.status==='closed')}].filter(g=>g.items.length);
  return '<div class="timeline-toolbar"><span>按日期先后排列</span><nav aria-label="跳转到月份">'+monthLinks+(past.length?'<button type="button" data-past-jump>已过日期 · '+past.length+'</button>':'')+(undated.length?'<a href="#timeline-undated">无固定日期 · '+undated.length+'</a>':'')+'</nav></div>'+
    (future.length?months(future,'timeline-'):'<p class="timeline-no-future">当前筛选下暂无接下来的已确定日期。</p>')+
    (undated.length?'<div id="timeline-undated">'+undatedGroups.map(g=>'<section class="timeline-undated"><h3>'+g.label+'<span>'+g.items.length+' 项机会</span></h3><div class="timeline-undated-grid">'+g.items.map(d=>card(d)).join('')+'</div></section>').join('')+'</div>':'')+
    (past.length?'<details class="timeline-history" open><summary>已过日期 <span>'+past.length+' 个节点</span></summary>'+months(past,'history-')+'</details>':'');
}
