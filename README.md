# DeliveryHub - Seu App de Delivery SaaS

Este é um projeto Next.js pronto para ser publicado, criado com o Firebase Studio.

## Publicando na Vercel

Seu projeto está preparado para ser publicado na Vercel. Siga os passos abaixo.

### 1. Envie seu código para um repositório Git

Se você ainda não fez isso, envie seu projeto para um provedor Git como GitHub, GitLab, ou Bitbucket.

### 2. Importe seu projeto na Vercel

- Crie uma conta na [Vercel](https://vercel.com/signup).
- No seu painel da Vercel, clique em **"Add New... > Project"**.
- Conecte seu provedor Git e selecione o repositório do seu projeto.

### 3. Configure as Variáveis de Ambiente

A Vercel detectará que é um projeto Next.js. Antes de publicar, você precisa adicionar as configurações do seu Firebase.

- Na tela de configuração do projeto na Vercel, vá para a seção **Environment Variables**.
- Copie as variáveis do arquivo `.env.example` que está no seu projeto.
- Para cada variável, adicione o nome e o valor correspondente. Você pode encontrar esses valores no console do seu projeto Firebase, em **Configurações do Projeto > Geral > Seus apps > App da Web**.

As variáveis que você precisa adicionar são:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

### 4. Publique (Deploy)

- Após adicionar as variáveis, clique no botão **"Deploy"**.
- A Vercel irá construir e publicar seu site.

Pronto! Seu aplicativo estará no ar. A partir de agora, toda vez que você enviar uma atualização para o seu repositório Git, a Vercel fará uma nova publicação automaticamente.
