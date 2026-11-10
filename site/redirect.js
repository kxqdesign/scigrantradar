// Sends visitors who arrive on an alternate address to the canonical one.
// Preview addresses and local development are left alone.
var CANONICAL_ORIGIN = 'https://scigrantradar.com';
var ALTERNATE_HOSTS = ['www.scigrantradar.com'];

function redirectTarget(hostname, rest) {
  return ALTERNATE_HOSTS.indexOf(String(hostname).toLowerCase()) === -1 ? null : CANONICAL_ORIGIN + rest;
}

if (typeof location !== 'undefined') {
  var target = redirectTarget(location.hostname, location.pathname + location.search + location.hash);
  if (target) location.replace(target);
}
