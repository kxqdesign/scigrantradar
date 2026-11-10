// Links to a single opportunity look like https://scigrantradar.com/#o=<record id>.
function sharedId(hash){
  const match=/^#o=([^&]+)/.exec(String(hash||''));
  if(!match)return null;
  try{return decodeURIComponent(match[1])}catch{return null}
}
function shareHash(id){return '#o='+encodeURIComponent(id)}
// The view in which a record is always listed, whatever the visitor's own preferences are.
function viewForRecord(d){return d.region==='国际'?'overseas':d.scope==='national'?'national':'explore'}
// What a share carries besides the link, so it reads in a chat without being opened.
function shareSummary(d){return d.name+'｜'+datesText(d)}
