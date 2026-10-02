# Presença das empresas no Google

Em **Configurações → Perfil da loja → Presença no Google**, a empresa pode permitir a indexação, informar uma descrição e um endereço público. Esses campos são salvos pelo botão de salvar o perfil. A descrição e o endereço também aparecem no cardápio.

As páginas `/menu/{companyId}` geram título, descrição e instruções de indexação no servidor. Empresas ativas com nome cadastrado permitem indexação por padrão; o responsável pode desativá-la. Empresas inativas, inexistentes ou com indexação desativada recebem `noindex`. Quando há endereço, a página inclui dados estruturados de restaurante, sem publicar dados de assinatura, email da conta ou informações administrativas.

## Configuração da publicação

1. Defina `NEXT_PUBLIC_SITE_URL` como o domínio público de produção, incluindo `https://`, na hospedagem. Sem essa variável, o sitemap fica vazio e as URLs canônicas não são emitidas.
2. O servidor precisa de credenciais do Firebase Admin com permissão de leitura no Firestore. Em ambientes Google, use a identidade do serviço; em outros provedores, configure credenciais de servidor pelo mecanismo de Application Default Credentials. Nunca coloque credenciais privadas em variáveis `NEXT_PUBLIC_*`. Se a leitura falhar, o cardápio interativo continua funcionando, mas os metadados usam `noindex` e a geração do sitemap falha.
3. Após publicar, confira `/robots.txt`, `/sitemap.xml` e o código-fonte de um cardápio ativo.
4. Verifique o domínio no Google Search Console e envie `/sitemap.xml`. Valide um cardápio na ferramenta de resultados avançados do Google.
5. Cada responsável deve cadastrar ou gerenciar seu Perfil da Empresa no Google e adicionar o link do cardápio. O botão nas configurações abre o site do Google; não cria nem verifica o perfil automaticamente.

O recurso ajuda na descoberta das páginas. Não garante indexação, posição, recomendações, presença no Maps ou resultados avançados. A desativação da indexação também não torna o cardápio privado e depende de uma nova visita do buscador para atualizar resultados existentes.
