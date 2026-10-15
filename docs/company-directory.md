# Vitrine de empresas

A rota `/api/companies` lê o índice público `companyShowcase`, que contém somente
os identificadores das empresas escolhidas pelo super admin. Ela usa o SDK público
para ler as informações dos cardápios, autorizadas pelas regras existentes, e retorna
somente nome, logo e identificador. A listagem completa de `companies` permanece
restrita aos administradores. Esta rota não depende de credenciais Firebase Admin
na Vercel e mantém cache de 30 segundos. A resposta HTTP não é armazenada pelo navegador.

## Seleção das empresas

Em Super admin → Empresas, use a coluna **Vitrine**. O botão salva a opção e o
índice em um único batch. Somente o super admin pode fazer essa alteração.
Empresas precisam de `showcaseEnabled: true`, `isActive: true`, nome e assinatura
não vencida para aparecer. A seleção é independente da ativação da empresa.
O painel informa quando uma empresa selecionada está inativa ou com assinatura
vencida. Ao carregar a lista, recupera entradas ausentes do índice automaticamente,
relendo a seleção em uma transação para respeitar desmarcações simultâneas.
Se a sincronização falhar, exibe um aviso com opção de tentar novamente.

Publique também `src/firestore.rules`. As escolhas anteriores à introdução do índice
podem ser sincronizadas com `scripts/sync-company-showcase.cjs`, usando uma sessão
existente do Firebase CLI. Defina `FIREBASE_CLI_ROOT` com a instalação do firebase-tools;
a execução padrão apenas conta registros, e `--apply` preenche o índice com as escolhas
existentes. Nenhuma chave privada ou token é persistido pelo script.

Alterações podem levar cerca de 30 segundos para aparecer ao recarregar a vitrine. A API deve retornar 200 com
`companies`; um erro não deve ser tratado como uma lista vazia.

Outras APIs administrativas continuam usando Firebase Admin e suas credenciais
privadas do servidor, documentadas em `.env.example`.
