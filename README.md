# Rolê

> O convite vira uma sala.

Crie o rolê, escolha o lugar e mande o link no grupo. Quem abre o convite cai numa sala isométrica em pixel art com o tema do evento, onde cada pessoa aparece como um avatar Y2K personalizável, anda, conversa, senta, dança e ouve house enquanto o rolê não começa.

## Descrições prontas

**Curta (bio, "About" do GitHub, 1 linha)**
Convites de festa que viram salas virtuais em pixel art, com avatar, chat ao vivo, pets e música.

**Média (portfólio, LinkedIn)**
Rolê é uma aplicação web em tempo real para organizar encontros entre amigos. Quem organiza cria o evento em menos de um minuto, escolhe um dos 11 cenários (quintal, boteco, boate, praia, vulcão, templo…) e compartilha o link. Os convidados confirmam com cadastro por código no celular e entram numa sala isométrica compartilhada, estilo Habbo, com avatares em pixel art de moda Y2K, chat, presença ao vivo, pets e um mixer que gera house no navegador.

**Técnica (README, entrevista)**
Front-end em JavaScript puro e Canvas 2D: motor próprio de avatar (esqueleto 3D com cinemática direta, rasterização com contorno e sombreamento em pixel), cenários isométricos com ordenação por profundidade, ciclo dia/noite com iluminação por composição e áudio gerado com Web Audio. Back-end em Node.js com WebSocket (`ws`): banco de documentos com assinaturas em tempo real, regras de acesso por usuário, login por código com sessão em token, salas ao vivo com limite de 50 pessoas e páginas de convite com Open Graph gerado no servidor. Interface em estética neo-brutalista inspirada em cartucho de Game Boy Color.

## Rodar no VS Code

Requisitos: Node.js 18.17 ou mais novo.

```bash
npm install
npm run dev
```

Abra http://localhost:3000. O comando `dev` remonta a página quando você mexe em `src/` e reinicia o servidor quando mexe em `server/`. Depois de cada mudança, recarregue o navegador.

No VS Code também dá para usar **Executar e Depurar** (Ctrl+Shift+D) → "Rolê: dev (build + servidor)".

Sem SMS configurado, o código de verificação aparece na própria tela (modo de teste).

Para testar com duas pessoas: abra uma janela normal e uma anônima, crie a conta nas duas e use o link de convite.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | build observando `src/` + servidor em modo desenvolvimento |
| `npm run build` | gera `dist/index.html` (site), `dist/artifact.html` (claude.ai) e `dist/local.html` (abre direto do disco) |
| `npm start` | sobe o servidor de produção (monta o `dist/` se não existir) |
| `npm run assets` | regera ícones e a imagem de prévia `public/og.png` |
| `npm test` | teste de ponta a ponta com navegador real (precisa de `npx playwright install chromium` uma vez) |
| `node test/games.js [nomes]` | testa os jogos com 2 a 5 navegadores (`sinuca,xadrez,truco,damas,domino,memoria,volei,solo` ou `todos`) |
| `node test/cenarios.js` | confere que todo assento e atividade dos 11 cenários é alcançável a pé (sem servidor) |
| `node test/fm.js` | testa o Rolê FM (música sincronizada) com 3 navegadores e o player do YouTube simulado |
| `node --test test/*.test.js` | regras dos jogos (sinuca, truco, damas, dominó) e o servidor de tempo real |

Se mudar a lista de arquivos do `scripts/build.js`, o `npm run dev` se reinicia sozinho (versões antigas do `dev` precisam ser fechadas e abertas de novo). `ROLE_DIST=pasta` faz o build e o servidor usarem outra pasta no lugar de `dist/` (útil para testar com o `dev` aberto).

## Rolê FM

Música do YouTube sincronizada na sala, por comandos no chat (`/music <link>`, `/skip`, `/pause`…). Dirigível no céu no computador e palco com caixas no celular. Instalação, comandos e limites em [docs/ROLE-FM.md](docs/ROLE-FM.md).

## Jogos e atividades da sala

Funcionam no modo servidor e no Pages + Supabase (precisam das mensagens da sala). Cada jogador vê a sua tela; quem está na sala vê a partida no mundo.

| Cenário | O quê |
|---|---|
| Boteco | sinuca (mesa maior), truco mineiro, damas, dominó; TV do Rolê FM, placar do truco ao vivo (no fim mostra os campeões), barman e violeiro (NPCs), quadro da sambista, tacos, baleiro, caixas de cerveja e a cidade boêmia lá fora |
| Parque com lago | xadrez, dominó |
| Templo e lago de carpas | damas, pesca de carpas (4 banquinhos), panda, gueixa com leque (NPC), tatames para sentar |
| Noite do pijama | jogo da memória (2); pôster da guerreira de marinheiro, quadro da cruz, escrivaninha, plantas de folha grossa, TV, almofadas, mesa de comida e ursinhos |
| Festa em casa | só a decoração e o som |
| Boate | barwoman (NPC) com falas e cantadas, telão do Rolê FM, focos de luz, puffs e caixas de som para sentar |
| Luau na praia | vôlei de praia (2), cangas, troncos e cadeiras para sentar |
| Casa com piscina | dá para entrar e nadar |
| Ilha do vulcão | o chão é lava (de tempos em tempos ou batendo o gongo) e um dragão-de-Komodo que cospe fogo e queima por 1,5 s |
| Rooftop | cidade em camadas atrás do terraço (paralaxe), telescópio panorâmico (zoom de 0,5x a 5x) |

NPCs (`src/app/npcs.js`) são bonecos fixos ou passeando, com falas no balão; não contam como gente na sala. Cenários de fundo com paralaxe ficam em `src/app/backdrops.js`. `node test/cenarios.js` confere se todo assento e toda atividade de cada cenário pode ser alcançado a pé.

As regras ficam em `src/engine/` (sem tela, com testes) e as telas em `src/app/` (um arquivo por jogo; a base comum é `games.js`). Não há servidor no meio das partidas: é jogo entre amigos, quem fuçar no navegador consegue trapacear.

## Estrutura

```
src/
  index.html        marcação e CSS (tokens, componentes)
  fonts.css         Anybody + Atkinson Hyperlegible Next embutidas (woff2 em base64)
  engine/           motor do avatar (esqueleto, corpo, cabelo, roupas, render)
  app/
    adapter.js      ponte motor ↔ app, cache de sprites, codificação do visual
    scenes.js       mundo isométrico, câmera, desenho por retângulo visível
    props2.js       móveis e objetos
    catalog.js      os 11 cenários
    pets.js         pets em bitmap
    music.js        sequenciador de house (Web Audio)
    icons.js        ícones em pixel (SVG 10×10)
    net.js          cliente WebSocket (banco + salas) usado no modo servidor
    app.js          telas, fluxo, sala, chat, guarda-roupa, céu, zoom
server/
  server.js         HTTP (página, SEO, estáticos, gzip/brotli) + WebSocket
  store.js          banco de documentos em JSON com escrita atômica
scripts/            build, dev e geração de assets
public/             ícones, manifest, og.png
test/              smoke.js (ponta a ponta), games.js (jogos), *.test.js (regras)
```

O mesmo código roda em três modos, escolhidos automaticamente:

- **Servidor** (`npm start`): várias pessoas em aparelhos diferentes. Dados no servidor, salas por WebSocket.
- **Artifact do claude.ai** (`dist/artifact.html`): usa o banco e as salas do próprio claude.ai.
- **Local** (`dist/local.html`): sem servidor; dados no navegador, salas só entre abas do mesmo navegador.

## Colocar no ar

### Cloudflare Pages + Supabase (fase de testes, sem servidor Node)

Dá para publicar o app só com o Pages e o banco no Supabase (Postgres). Serve para testar com amigos antes da VPS.

1. No Supabase, abra **SQL Editor** e rode `supabase/schema.sql` (pode rodar mais de uma vez). Se você rodou a versão antiga, rode depois `supabase/limpar-docs.sql`.
2. Em **Authentication → Sign In / Providers**, ligue **Allow anonymous sign-ins**.
3. No Pages, em **Settings → Variables and Secrets**, crie `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
4. Build: `npm ci && npm run build:pages`, saída `dist-pages`.

**Tabelas:** `users`, `sessions`, `otp_codes`, `roles`, `role_members`, `chat_messages`, `reports` e `app_config`, com chaves estrangeiras e índices.

**Como o acesso é protegido:**
- Ninguém escreve direto nas tabelas. Toda escrita passa por funções do banco que validam tudo (`auth_start`, `auth_verify`, `criar_role`, `entrar_role`, `enviar_mensagem`…).
- A leitura é por RLS: só quem está no rolê vê o rolê, os membros e o chat. E-mail e celular não saem pela API.
- O código de verificação é gerado e conferido no banco: só o hash é guardado, vale 10 minutos, aceita 5 tentativas e é de uso único. Há limite por celular, por IP e por dia.
- O navegador entra como anônimo do Supabase, e a tabela `sessions` liga essa sessão ao usuário. Por isso "Entrar" funciona em outro aparelho, e dá para sair de todos.

**Ainda falta neste modo:**
- O SMS é simulado: `app_config.sms_dev = 1` devolve o código na tela. Para SMS de verdade, envie o código por uma Edge Function e ponha `sms_dev = 0`.
- A lotação de 50 pessoas só vale no cliente.
- A sala ao vivo (canal de presença) não exige ser membro.
- Painel admin, expulsar e banir pelo app, excluir conta e baixar dados (LGPD).

O servidor Node com Postgres próprio segue sendo o caminho de produção.

### Docker

```bash
docker build -t role .
docker run -d -p 3000:3000 -v role-data:/data -e PUBLIC_URL=https://seu-dominio role
```

### VPS com Nginx (HTTPS)

O WebSocket precisa dos cabeçalhos de upgrade:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Render, Railway e Fly.io também funcionam: comando `npm start`, porta pela variável `PORT`, e um disco persistente apontado em `DATA_FILE`.

Configurações em `.env` (copie de `.env.example`).

## Multiusuário: como funciona

- **Contas:** cadastro e login com código de 4 dígitos. O servidor gera o código, confere e devolve um token de sessão. O token fica no aparelho e é validado a cada conexão.
- **Permissões:**
  - Dados da conta só são lidos pelo dono.
  - Só quem criou o rolê pode mudar o cenário ou o dia/noite.
  - Mensagens no chat são limitadas a 280 caracteres e uma a cada 0,6 s.
  - Há limite de mensagens por conexão e de tentativas de login por IP.
- **Salas:** presença ao vivo por WebSocket, com no máximo 50 pessoas (`MAX_SALA`). Quem chega com a sala cheia volta para o início com um aviso. O limite não aparece na interface.
- **Reconexão:** se a internet cair, o app reconecta sozinho e volta para a sala e para as assinaturas.
- **Convites:** cada link `/r/<id>` gera uma prévia com o nome do rolê, quem chamou, a data e o lugar. É isso que aparece no WhatsApp e no Instagram.

## Desempenho e mobile

- O mundo só redesenha o retângulo visível da tela.
- Densidade de pixels limitada a 2× no celular.
- O céu base fica em cache, e os cenários ficam em cache (2 no celular, 3 no computador).
- No servidor:
  - JavaScript minificado com esbuild;
  - HTML comprimido com brotli/gzip;
  - ETag e cache longo para ícones e imagens.
- Instalável como app (manifest, ícones, cor de tema), com área segura do iPhone respeitada e alvos de toque de 44 px ou mais.
- Zoom pela roda do mouse (no ponto do cursor), pelos botões + e − e por pinça com dois dedos no celular.

## Antes de abrir ao público

- **SMS:** sem `SMS_WEBHOOK_URL`, o código aparece na tela. Para produção, ligue um provedor de SMS (Twilio, Zenvia…) por um webhook seu.
- **Banco:** o arquivo JSON aguenta bem um MVP e alguns milhares de rolês. Para crescer, troque `server/store.js` por Postgres ou SQLite mantendo os mesmos métodos (`get`, `set`, `update`, `list`, `add`).
- **Instâncias:** use uma instância só do servidor. As salas ao vivo ficam em memória. Para escalar horizontalmente, use Redis pub/sub.
