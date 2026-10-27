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
test/smoke.js       teste ponta a ponta
```

O mesmo código roda em três modos, escolhidos automaticamente:

- **Servidor** (`npm start`): várias pessoas em aparelhos diferentes. Dados no servidor, salas por WebSocket.
- **Artifact do claude.ai** (`dist/artifact.html`): usa o banco e as salas do próprio claude.ai.
- **Local** (`dist/local.html`): sem servidor; dados no navegador, salas só entre abas do mesmo navegador.

## Colocar no ar

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
