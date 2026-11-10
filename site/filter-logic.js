// OR within each selected facet, AND across facets; empty means unrestricted.
function matches(d,f){
  const includesAny=(selected,values)=>!selected?.length||selected.some(value=>values.includes(value));
  const text=[d.name,d.org,d.fields,d.summary,d.eligibility,d.geographyNote,...d.audience].join(' ').toLowerCase();
  return (!f.q||text.includes(f.q))&&includesAny(f.level,[d.scope])&&includesAny(f.category,[d.category])&&includesAny(f.audience,d.audience)&&includesAny(f.status,[d.status])&&includesAny(f.discipline,d.disciplines);
}
