// Each opportunity gets one full card, at its next date. An opening still ahead also leaves a one-line echo at its deadline.
function timelineEvents(rows){
  const events=[],undated=[];
  for(const d of rows){
    const ahead=d.phase==='upcoming'&&d.opening;
    if(ahead)events.push({d,date:d.opening,kind:'opening',primary:true});
    if(d.closing)events.push({d,date:d.closing,kind:'closing',primary:!ahead});
    if(!ahead&&!d.closing)undated.push(d);
  }
  const order=e=>e.kind==='closing'?0:1;
  events.sort((a,b)=>a.date.localeCompare(b.date)||order(a)-order(b)||a.d.name.localeCompare(b.d.name,'zh-CN'));
  return {events,undated};
}
function nextDates(rows,today){
  return timelineEvents(rows).events.filter(e=>e.primary&&e.date>=today&&['open','upcoming'].includes(e.d.status)).slice(0,3);
}
// The date column already names this node's date, so the card line says how far off it is and what the other end is.
function nodeLine(e,today){
  const d=e.d;
  if(e.kind==='opening')return countdown(d.opening,today,'opening')+'开放'+(d.closing?' · '+safeText(closeLabel(d,today))+' · 窗口 '+dayGap(d.opening,d.closing)+' 天':d.capped?' · 满额即止':'');
  if(d.phase==='closed')return d.opening?safeText(windowLabel(d,today)):'';
  if(d.phase==='verify')return '日期待核实';
  const days=dayGap(today,d.closing),left=countdown(d.closing,today,'closing')+(days===0||days>COUNT_DAYS?'截止':'');
  return '<span'+(d.phase==='soon'?' class="date-urgent"':'')+'>'+left+'</span>'+(d.opening?' · '+dayLabel(d.opening,today)+' 已开放':d.phase==='upcoming'?' · 开放日待公布':'');
}
function renderTimeline(rows,today){
  const {events,undated}=timelineEvents(rows);
  const isPast=e=>e.date<today||e.d.phase==='closed';
  const future=events.filter(e=>!isPast(e)),past=events.filter(isPast);
  const monthName=date=>date.slice(0,4)+'年'+Number(date.slice(5,7))+'月';
  const echo=d=>'<p class="timeline-echo"><a href="#'+safeText(d.id)+'" data-echo="'+safeText(d.id)+'" title="跳到这项机会的完整卡片">'+safeText(d.name)+'</a><span>'+dayLabel(d.opening,today)+' 开放 <span aria-hidden="true">↑</span></span></p>';
  const entry=e=>'<div class="timeline-event'+(e.primary?'':' is-echo')+(e.primary&&e.kind==='closing'&&e.d.phase==='soon'?' is-urgent':'')+'"><div class="timeline-date"><time datetime="'+e.date+'">'+Number(e.date.slice(5,7))+' / '+Number(e.date.slice(8,10))+'</time><span class="event-kind '+e.kind+'">'+(e.kind==='opening'?'开放':'截止')+'</span></div>'+(e.primary?card(e.d,nodeLine(e,today)):echo(e.d))+'</div>';
  function months(items,prefix){
    return [...new Set(items.map(e=>e.date.slice(0,7)))].map(month=>{
      const entries=items.filter(e=>e.date.startsWith(month));
      return '<section class="timeline-month" id="'+prefix+month+'"><h3>'+monthName(month)+'<span>'+entries.length+' 个节点</span></h3><div class="timeline-track">'+entries.map(entry).join('')+'</div></section>';
    }).join('');
  }
  const monthLinks=[...new Set(future.map(e=>e.date.slice(0,7)))].map(m=>'<a href="#timeline-'+m+'">'+monthName(m)+'</a>').join('');
  const undatedGroups=[{label:'名额有限 · 满额即止',items:undated.filter(d=>d.status==='open'&&d.capped)},{label:'滚动申请',items:undated.filter(d=>d.status==='open'&&!d.capped)},{label:'日期待核实',items:undated.filter(d=>!['open','closed'].includes(d.status))},{label:'已截止 · 日期待补充',items:undated.filter(d=>d.status==='closed')}].filter(g=>g.items.length);
  return '<div class="timeline-toolbar"><span>按日期先后排列</span><nav aria-label="跳转到月份">'+monthLinks+(past.length?'<button type="button" data-past-jump>已过日期 · '+past.length+'</button>':'')+(undated.length?'<a href="#timeline-undated">无固定日期 · '+undated.length+'</a>':'')+'</nav></div>'+
    (future.length?'<p class="timeline-today"><span>今天 · '+Number(today.slice(5,7))+'月'+Number(today.slice(8,10))+'日</span></p>'+months(future,'timeline-'):'<p class="timeline-no-future">当前筛选下暂无接下来的已确定日期。</p>')+
    (undated.length?'<div id="timeline-undated">'+undatedGroups.map(g=>'<section class="timeline-undated"><h3>'+g.label+'<span>'+g.items.length+' 项机会</span></h3><div class="timeline-undated-grid">'+g.items.map(d=>card(d)).join('')+'</div></section>').join('')+'</div>':'')+
    (past.length?'<details class="timeline-history" open><summary>已过日期 <span>'+past.length+' 个节点</span></summary>'+months(past,'history-')+'</details>':'');
}
