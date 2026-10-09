const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

const handles = [];
const timers = new Map();
let timerId = 0;
const firebase = {
  queryEqual: (a, b) => a.db === b.db && a.path === b.path && a.filter === b.filter,
  onSnapshot: (query, next, error) => {
    const handle = { query, next, error, stopped: false };
    handles.push(handle);
    return () => { handle.stopped = true; };
  },
};
const exportsObject = {};
const source = fs.readFileSync(path.join(__dirname, '../src/firebase/firestore/shared-listener.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, {
  exports: exportsObject,
  require: () => firebase,
  setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; },
  clearTimeout: id => timers.delete(id),
});
const subscribe = exportsObject.subscribeToQuery;
const target = { db: 'one', path: 'orders', filter: 'active' };
const first = [], second = [], remount = [], errors = [];
const stopFirst = subscribe(target, value => first.push(value), value => errors.push(value));
const stopSecond = subscribe({ ...target }, value => second.push(value), value => errors.push(value));
assert.equal(handles.length, 1, 'equivalent queries share one listener');
const snapshot = { docs: [{ id: '1' }] };
handles[0].next(snapshot);
assert.equal(first[0], snapshot);
assert.equal(second[0], snapshot);
stopFirst();
assert.equal(handles[0].stopped, false, 'remaining subscriber keeps listener active');
stopSecond();
const stopRemount = subscribe({ ...target }, value => remount.push(value), () => {});
assert.equal(handles.length, 1, 'same-tick remount reuses listener');
assert.equal(remount[0], snapshot, 'remount receives latest snapshot');
const stopFilter = subscribe({ ...target, filter: 'all' }, () => {}, () => {});
const stopDatabase = subscribe({ ...target, db: 'two' }, () => {}, () => {});
assert.equal(handles.length, 3, 'different filters and databases stay isolated');
stopRemount(); stopFilter(); stopDatabase();
for (const callback of timers.values()) callback();
timers.clear();
assert.ok(handles.every(handle => handle.stopped), 'last subscriber closes each listener');
const stopError = subscribe(target, () => {}, value => errors.push(value));
handles[3].error({ code: 'resource-exhausted' });
assert.equal(errors[0].code, 'resource-exhausted', 'quota error is preserved');
stopError();
for (const callback of timers.values()) callback();
console.log('PASS: query sharing, snapshots, remount, isolation, cleanup and quota errors');
