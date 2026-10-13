# Vitrine de empresas

A rota `/api/companies` consulta as empresas pelo Firebase Admin, retorna somente
nome, logo e identificador públicos e mantém cache de cinco minutos. As regras
de listagem da coleção `companies` continuam restritas aos administradores.

## Credenciais do servidor

O login de um usuário no navegador e a configuração pública do Firebase não
autenticam o Firebase Admin. Sem credenciais do servidor, a API retorna 503 e a
vitrine mostra “Não foi possível carregar as empresas agora”.

Em localhost ou Vercel, configure no `.env.local` ou nos segredos do ambiente:

- `FIREBASE_ADMIN_PROJECT_ID`: o `project_id` da conta de serviço.
- `FIREBASE_ADMIN_CLIENT_EMAIL`: o `client_email` da conta de serviço.
- `FIREBASE_ADMIN_PRIVATE_KEY`: o `private_key`, aceitando quebras de linha reais
  ou `\n` literais.

Use a conta de serviço do projeto `studio-516051115-a8e0e` com permissão para ler
o Firestore. Obtenha esses valores em Configurações do projeto → Contas de serviço
no Firebase. Insira-os diretamente no ambiente; não envie a chave no chat nem
a coloque em variáveis `NEXT_PUBLIC_*`. Reinicie o servidor local ou faça uma
nova publicação após configurar.

Também é possível usar `GOOGLE_APPLICATION_CREDENTIALS` apontando para um arquivo
de credenciais fora do repositório. No Firebase App Hosting, o SDK usa a conta de
serviço do backend automaticamente; confira suas permissões se ocorrer 403.

Depois de configurar, `/api/companies` deve responder 200 com `companies`.
Empresas precisam de `showcaseEnabled: true`, `isActive: true`, nome e assinatura
não vencida para aparecer. Em Super admin → Empresas, use a coluna **Vitrine**
para selecionar cada empresa. Empresas existentes e novas ficam ocultas até
serem selecionadas. Essa escolha é independente da ativação da empresa.
Publique também `src/firestore.rules` para restringir essa opção ao super admin.
Alterações na listagem podem levar até cinco minutos para aparecer.

Documentação: https://firebase.google.com/docs/admin/setup
