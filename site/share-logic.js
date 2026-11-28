// Links to a single opportunity support both canonical /grant/<id>/ pages and legacy #o=<id> hashes.
function sharedId(hash){
  const match=/^#o=([^&]+)/.exec(String(hash||''));
  if(!match)return null;
  try{return decodeURIComponent(match[1])}catch{return null}
}
function shareHash(id){return '#o='+encodeURIComponent(id)}
function grantPath(id){return 'grant/'+encodeURIComponent(id)+'/'}
// The view in which a record is always listed, whatever the visitor's own preferences are.
function viewForRecord(d){return d.region==='国际'?'overseas':['national','hmt'].includes(d.scope)?'national':'explore'}
// What a share carries besides the link, so it reads in a chat without being opened.
function shareSummary(d){return d.name+'｜'+datesText(d)}
