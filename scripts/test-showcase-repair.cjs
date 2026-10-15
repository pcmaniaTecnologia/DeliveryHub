const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const result = {};
let writes = [];
let fail = false;
const selections = { missing: true, deselected: false };
const firestore = {
  collection: (_, name) => name,
  doc: (_, collection, id) => `${collection}/${id}`,
  getDocs: async () => {
    if (fail) throw new Error('Permission denied');
    return { docs: [{ id: 'indexed' }] };
  },
  runTransaction: async (_, callback) => callback({
    get: async ref => ({ data: () => ({ showcaseEnabled: selections[ref.split('/')[1]] }) }),
    set: (ref, data) => writes.push({ ref, data }),
  }),
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/repair-company-showcase.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText, { exports: result, require: () => firestore });
async function main() {
  const companies = [
    { id: 'indexed', showcaseEnabled: true },
    { id: 'missing', showcaseEnabled: true },
    { id: 'deselected', showcaseEnabled: true },
    { id: 'hidden', showcaseEnabled: false },
  ];
  await result.repairCompanyShowcaseIndex({}, companies);
  assert.equal(JSON.stringify(writes), JSON.stringify([{ ref: 'companyShowcase/missing', data: { companyId: 'missing' } }]));
  writes = [];
  await result.repairCompanyShowcaseIndex({}, companies, () => true);
  assert.equal(writes.length, 0);
  fail = true;
  await assert.rejects(result.repairCompanyShowcaseIndex({}, companies), /Permission denied/);
  console.log('PASS: missing index restored, indexed/hidden companies skipped, concurrent deselection respected, cancellation and failures handled');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
