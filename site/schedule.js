// Works out where each opportunity stands today from its confirmed dates, and words its dates.
const SOON_DAYS=14,COUNT_DAYS=60;
const PHASE={upcoming:'待开放',open:'开放中',soon:'即将截止',closed:'已截止',verify:'待核实'};
const shanghaiToday=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});
const dayGap=(from,to)=>Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/864e5);
const safeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Records written before deadlineTime existed carry the time only in dateLabel; trust it when unambiguous.
function closingTime(d){
  if(d.deadlineTime)return d.deadlineTime;
  const found=[...String(d.dateLabel||'').matchAll(/(\d{1,2}:\d{2})(\s*(?:[A-Z]{2,5}|英国时间))?/g)];
  return found.length===1?found[0][1]+(found[0][2]?' '+found[0][2].trim():''):'';
}
// Dates only move a record forward (upcoming → open → closed). Stored closed and verify are never reopened.
function withSchedule(d,today){
  if(d.phase)return d;
  const opening=d.opensOn||(d.status==='upcoming'?d.date:null)||null;
  const closing=d.deadline||(d.status!=='upcoming'?d.date:null)||null;
  let status=d.status;
  if(status==='upcoming'&&opening&&opening<=today)status='open';
  if(['open','upcoming'].includes(status)&&closing&&closing<today)status='closed';
  const phase=status==='open'&&closing&&dayGap(today,closing)<=SOON_DAYS?'soon':status;
  const capped=d.closesWhenFull??/满额/.test(d.dateLabel||'');
  const nextDate=status==='upcoming'&&opening?opening:closing;
  return {...d,status,phase,opening,closing,capped,nextDate,closeTime:closing?closingTime(d):''};
}

// Without a reference day the year is always written out, for text that will be read later.
const dayLabel=(date,today)=>(today&&date.slice(0,4)===today.slice(0,4)?'':date.slice(0,4)+'/')+Number(date.slice(5,7))+'/'+Number(date.slice(8,10));
const closeLabel=(d,today)=>dayLabel(d.closing,today)+(d.closeTime?' '+d.closeTime:'')+' 截止';
function countdown(date,today,kind){
  const days=dayGap(today,date);
  if(days===0)return '今天';
  if(days>COUNT_DAYS)return '约 '+Math.round(days/30)+' 个月后';
  return kind==='opening'?days+' 天后':'还剩 '+days+' 天';
}
function windowLabel(d,today){
  const sameYear=d.opening.slice(0,4)===d.closing.slice(0,4);
  const end=sameYear?Number(d.closing.slice(5,7))+'/'+Number(d.closing.slice(8,10)):dayLabel(d.closing,today);
  return dayLabel(d.opening,today)+' – '+end+' · 窗口 '+dayGap(d.opening,d.closing)+' 天';
}

// The dates of a record as opening → closing. `next` marks the date to act on, `arrow` a link to the following
// part, `urgent` what needs action now, and `relative` wording that is only true today.
function dateParts(d,today){
  const stored=[{text:d.dateLabel}];
  if(d.phase==='verify')return stored;
  if(d.phase==='closed')return d.closing?[{text:d.opening?windowLabel(d,today):dayLabel(d.closing,today)}]:stored;
  if(d.phase==='upcoming'){
    if(d.opening)return [{text:dayLabel(d.opening,today)+' 开放',next:true,arrow:!!(d.closing||d.capped)},d.closing?{text:closeLabel(d,today)}:d.capped?{text:'满额即止'}:null,{text:countdown(d.opening,today,'opening'),relative:true}].filter(Boolean);
    return d.closing?[{text:'开放日待公布',arrow:true},{text:closeLabel(d,today),next:true},{text:countdown(d.closing,today,'closing'),relative:true}]:stored;
  }
  const opened=d.opening?[{text:dayLabel(d.opening,today)+' 已开放',arrow:true}]:[];
  const urgent=d.phase==='soon';
  if(d.closing)return [...opened,{text:closeLabel(d,today),next:true,urgent},{text:countdown(d.closing,today,'closing'),relative:true,urgent}];
  if(d.capped)return [...opened,{text:'满额即止',next:true,urgent:true},{text:'尽快',relative:true,urgent:true}];
  return d.opening?[...opened,{text:'无固定截止'}]:stored;
}
// The status row beside the phase badge. Each part stays on one line, so a narrow column wraps between dates.
function statusLine(d,today){
  return dateParts(d,today).map(p=>'<span class="seg'+(p.urgent?' date-urgent':'')+'">'+(p.relative?'· ':'')+(p.next?'<strong>'+safeText(p.text)+'</strong>':safeText(p.text))+(p.arrow?' <span aria-hidden="true">→</span>':'')+'</span>').join(' ');
}
// The same dates as plain text that stays true after today: full years, no countdown.
function datesText(d){
  const text=dateParts(d,null).filter(p=>!p.relative).map(p=>p.text+(p.arrow?' →':'')).join(' ');
  return d.phase==='closed'&&d.closing?'已截止 · '+text:text;
}
