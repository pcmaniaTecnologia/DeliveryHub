const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const result = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  }).outputText, { exports: result, require: name => dependencies[name] });
  return result;
}
const adjustments = load('src/lib/logo-adjustments.ts');
const { toDirectoryCompany, normalizeCompanySearch } = load('src/lib/company-directory.ts', { './logo-adjustments': adjustments });
const active = { name: ' Café da Praça ', isActive: true, showcaseEnabled: true, logoUrl: 'https://example.com/logo.png', ownerId: 'private', paymentToken: 'secret', phone: 'private' };
const company = toDirectoryCompany('abc', active, 100);
assert.equal(company.name, 'Café da Praça');
assert.equal(company.id, 'abc');
assert.equal(toDirectoryCompany('abc', { ...active, showcaseEnabled: false }, 100), null);
assert.equal(toDirectoryCompany('abc', { ...active, showcaseEnabled: undefined }, 100), null);
assert.equal(Object.keys(company).sort().join(','), 'id,logoAdjustments,logoUrl,name');
assert.equal(toDirectoryCompany('abc', { ...active, isActive: false }, 100), null);
assert.equal(toDirectoryCompany('abc', { ...active, isActive: undefined }, 100), null);
assert.equal(toDirectoryCompany('abc', { ...active, name: '  ' }, 100), null);
assert.equal(toDirectoryCompany('abc', { ...active, subscriptionEndDate: { toMillis: () => 99 } }, 100), null);
assert.ok(toDirectoryCompany('abc', { ...active, subscriptionEndDate: { toMillis: () => 101 } }, 100));
assert.equal(toDirectoryCompany('abc', { ...active, logoUrl: 'javascript:alert(1)' }).logoUrl, null);
assert.equal(normalizeCompanySearch(company.name), 'cafe da praca');
assert.ok(normalizeCompanySearch(company.name).includes(normalizeCompanySearch('CAFE')));
console.log('PASS: public field allowlist, active/expired companies, logo validation and accent-insensitive search');
