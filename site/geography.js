'use strict';
const AREAS={
  '江苏':['南京','苏州','无锡','常州','镇江','扬州','南通','泰州','盐城','淮安','宿迁','徐州','连云港'],
  '上海':[],
  '北京':[],
  '浙江':['杭州','宁波','温州','嘉兴','湖州','绍兴','金华','衢州','舟山','台州','丽水'],
  '广东':['广州','深圳','珠海','佛山','东莞','惠州','中山','江门','肇庆','汕头','潮州','揭阳','汕尾','湛江','茂名','阳江','清远','韶关','河源','梅州','云浮'],
  '安徽':['合肥','芜湖','蚌埠','淮南','马鞍山','淮北','铜陵','安庆','黄山','滁州','阜阳','宿州','六安','亳州','池州','宣城']
};
const PREFERENCE_VALUES={
  discipline:['natural','social'],
  level:['national','province','city','joint','overseas'],
  category:['科研基金','青年人才','博士后','交流合作','国际资助','专家机会','指南征集'],
  audience:['在职科研人员','团队负责人','青年研究者','博士生','博士后','应届博士','硕士生'],
  status:['open','upcoming','verify','closed']
};
const DEFAULT_PREFERENCES={province:'江苏',city:'南京',discipline:['natural'],scopeVersion:2,coverage:['national'],level:['national','province','city','joint'],category:[],audience:[],layout:'timeline',status:[]};
function preferenceValues(key,value){
  if(key==='status'&&value==='active')return ['open','upcoming'];
  const values=Array.isArray(value)?value:typeof value==='string'&&value?[value]:[];
  return PREFERENCE_VALUES[key].filter(v=>values.includes(v));
}
function preferenceSources(value){
  if(Array.isArray(value)||value===''||['国内','国际'].includes(value))return ['国内','国际'].filter(v=>(Array.isArray(value)?value:[value]).includes(v));
  return ['国内'];
}
function normalizePreferences(value){
  if(!value||typeof value!=='object')return null;
  const p={province:'',city:'',layout:'timeline'};
  p.province=Object.hasOwn(AREAS,value.province)?value.province:'';
  p.city=AREAS[p.province]?.includes(value.city)?value.city:'';
  for(const key of Object.keys(PREFERENCE_VALUES))p[key]=preferenceValues(key,value[key]);
  // Convert older two-stage source/scope preferences into one scope selection.
  if(!value.scopeVersion&&Object.hasOwn(value,'source')){
    const sources=preferenceSources(value.source);
    if(sources.length===1){
      const allowed=PREFERENCE_VALUES.level.filter(v=>sources[0]==='国际'?v==='overseas':v!=='overseas');
      const selected=p.level.length?p.level.filter(v=>allowed.includes(v)):allowed;
      p.level=selected.length?selected:allowed;
    }
  }
  const coverage=value.scopeVersion===2?preferenceValues('level',value.coverage):p.level.length?p.level:PREFERENCE_VALUES.level;
  p.coverage=coverage.filter(v=>['national','overseas'].includes(v));
  const local=p.province?['province','joint',...(p.city?['city']:[])]:[];
  p.level=PREFERENCE_VALUES.level.filter(v=>p.coverage.includes(v)||local.includes(v));
  p.scopeVersion=2;
  p.layout=['timeline','list','cards'].includes(value.layout)?value.layout:'timeline';
  return p;
}
function areaLabel(area){return area?.province?(area.city?area.province+' · '+area.city:area.province):'未设置地区'}
function matchesArea(d,area,{allCities=false}={}){
  if(!area?.province)return false;
  return (d.eligibleAreas||[]).some(a=>a.province===area.province&&(!a.city||a.city===area.city||allCities&&!area.city));
}
function inView(d,view,prefs,explore){
  if(view==='saved')return true;
  if(view==='overseas')return d.region==='国际';
  if(view==='national')return d.scope==='national';
  if(view==='explore')return ['province','city','joint'].includes(d.scope)&&(!explore.province||matchesArea(d,explore,{allCities:true}));
  if(!prefs)return false;
  if(view==='home'&&prefs.scopeVersion===2&&!prefs.level.length)return false;
  if(view==='local')return ['province','city','joint'].includes(d.scope)&&matchesArea(d,prefs);
  return d.region==='国际'||d.scope==='national'||matchesArea(d,prefs);
}
function scopeLabel(d){
  const area=d.jurisdiction||{};
  if(d.scope==='national')return '全国性';
  if(d.scope==='overseas')return '国外';
  if(d.scope==='joint')return '跨地区联合';
  if(d.scope==='city')return (area.city||'地方')+' · 市级';
  if(['北京','上海'].includes(area.province))return area.province+' · 直辖市';
  return (area.province||'地方')+' · 省级';
}
