import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync('site/redirect.js', 'utf8'), context);
const { redirectTarget } = context;

test('alternate addresses go to the canonical address, keeping path, query and hash', () => {
  assert.equal(redirectTarget('researchradar.kxqdesign.com', '/?a=1#x'), 'https://scigrantradar.com/?a=1#x');
  assert.equal(redirectTarget('www.scigrantradar.com', '/'), 'https://scigrantradar.com/');
  assert.equal(redirectTarget('WWW.SciGrantRadar.com', '/'), 'https://scigrantradar.com/');
});

test('canonical, preview and local addresses are left alone', () => {
  for (const host of ['scigrantradar.com', 'localhost', '127.0.0.1', 'abc123.scigrantradar.pages.dev']) {
    assert.equal(redirectTarget(host, '/'), null, host);
  }
});

test('loading the script outside a browser does not throw', () => {
  assert.doesNotThrow(() => vm.runInContext(fs.readFileSync('site/redirect.js', 'utf8'), vm.createContext({})));
});
