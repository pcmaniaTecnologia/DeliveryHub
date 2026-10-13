const path = require('node:path');

async function main() {
  const cliRoot = process.env.FIREBASE_CLI_ROOT;
  if (!cliRoot) throw new Error('Defina FIREBASE_CLI_ROOT com o diretório do firebase-tools autenticado.');
  const auth = require(path.join(cliRoot, 'lib/auth.js'));
  const account = auth.getProjectDefaultAccount(process.cwd());
  if (!account) throw new Error('Entre no Firebase CLI antes de executar.');
  const tokens = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  const headers = { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' };
  const project = 'studio-516051115-a8e0e';
  const root = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  async function request(url, body) {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Firestore respondeu ${response.status}.`);
    return response.json();
  }
  const rows = await request(`${root}:runQuery`, { structuredQuery: {
    from: [{ collectionId: 'companies' }],
    select: { fields: [{ fieldPath: 'showcaseEnabled' }] },
    where: { fieldFilter: { field: { fieldPath: 'showcaseEnabled' }, op: 'EQUAL', value: { booleanValue: true } } },
  } });
  const documents = rows.filter(row => row.document).map(row => row.document);
  console.log(`Empresas selecionadas para sincronizar: ${documents.length}`);
  if (!process.argv.includes('--apply')) return;
  const writes = documents.map(document => {
    const id = document.name.split('/').pop();
    return { update: { name: `projects/${project}/databases/(default)/documents/companyShowcase/${id}`, fields: { companyId: { stringValue: id } } } };
  });
  for (let offset = 0; offset < writes.length; offset += 400) await request(`${root}:commit`, { writes: writes.slice(offset, offset + 400) });
  console.log(`Índice público sincronizado: ${writes.length} empresas. Nenhuma credencial foi gravada.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
