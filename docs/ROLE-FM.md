# Rolê FM

Música do YouTube tocando sincronizada para todo mundo da sala, controlada por comandos no chat.
No computador a música aparece como um **dirigível** no céu; no celular, como um **palco com telão e paredão de caixas**.

## Como funciona a sincronia

- **Ninguém retransmite áudio.** Cada pessoa toca o vídeo no próprio aparelho, pelo player oficial do YouTube (IFrame API), e só depois de tocar em **Ouvir junto**. Quem não quer ouvir não baixa nada do YouTube.
- O servidor guarda só: qual vídeo, **desde quando** (relógio do servidor, nunca do aparelho), se está pausado e a fila.
- Cada aparelho mede a diferença entre o relógio dele e o do servidor (3 medidas, descontando metade da ida e volta) e calcula `posição = (agora_do_servidor − começou_em) / 1000`.
- Quem entra no meio, ou ativa o "Ouvir junto" depois, começa na posição certa (`loadVideoById` com `startSeconds`).
- A cada 30 s o player é conferido: se desviou mais de 2 s, pula para a posição certa.
- **Troca de música sem disputa:** quando acaba, qualquer aparelho pede a próxima, mas o servidor só aceita o pedido que traz a **versão atual** (compare-and-swap). Dois pedidos juntos, só um vale. O `/skip` usa o mesmo caminho.
- Uma mensagem por evento (troca, pausa, pulo). Nada de enviar a posição a cada segundo.
- O house da sala (botão Som) pausa sozinho enquanto a pessoa ouve o Rolê FM e volta quando a fila acaba ou ela para de ouvir.

## Comandos

| Comando | Quem | O que faz |
|---|---|---|
| `/music <link ou nome>` (ou `/m`) | todos | põe na fila; se nada toca, toca na hora. Com um nome (`/music ai se eu te pego`), o 1º resultado entra e aparece **"Não era essa?"** com até 4 alternativas |
| `/skip` | dono e DJs | pula |
| `/pause` e `/play` | dono e DJs | pausa e volta para todo mundo |
| `/fila` | todos | as próximas 5 (só para quem pediu) |
| `/tocando` | todos | o que toca e o tempo (só para quem pediu) |
| `/tirar` | todos | tira a última música que **você** colocou (dono e DJs: `/tirar <posição>`) |
| `/limpar` | dono e DJs | esvazia a fila |

Digitar `/` mostra só os comandos que a pessoa pode usar. As mensagens do bot (chip amarelo com a nota) vão para o chat de todos; as respostas privadas ficam só para quem pediu (borda tracejada).

## Busca por nome

- **O 1º resultado entra na fila na hora** (ou começa a tocar). Logo abaixo, só para quem pediu, aparece **"Não era essa?"** com até 4 outros resultados em cartões (miniatura, título, canal e duração). Tocar num cartão **troca** a música recém-pedida (na fila ou já tocando, que recomeça do zero) pela escolhida. Só quem pediu troca, uma vez, em até 60 s.
- Sem modo rádio e sem músicas parecidas automáticas: quando a fila acaba, o som para e o house volta.
- A busca roda **no servidor** (Edge Function `music-resolve`, ou `server/fm.js` no modo Node), com a chave guardada como segredo: YouTube Data API v3 `search.list` (`videoEmbeddable=true`, `videoCategoryId=10`, `regionCode=BR`, `relevanceLanguage=pt`, `safeSearch=moderate`, 5 resultados) e as durações dos 5 numa chamada só de `videos.list`. Descarta vídeo acima de 15 min, transmissão ao vivo e duração zero; em ranking apertado, "official", "clipe" ou "áudio" no título sobe uma posição.
- Nada de scraping do YouTube, Invidious, yt-dlp ou APIs não oficiais.

### Cota (a parte importante)

A cota gratuita é de **10.000 unidades por dia**; cada busca nova custa **101** (`search.list` 100 + `videos.list` 1): cerca de 99 buscas novas por dia. Por isso:

| Proteção | Como |
|---|---|
| **Cache** | tabela `music_search_cache` (consulta normalizada: minúsculas, sem acento, sem pontuação, espaços únicos; resultados em jsonb), válido por 30 dias. Busca repetida não gasta cota nem chama o YouTube |
| **Por pessoa** | 10 buscas novas por hora (as do cache não contam) |
| **Por sala** | uma busca por vez |
| **Contador do dia** | tabela `fm_quota`; o dia vira à meia-noite do **fuso do Pacífico**, que é quando o Google zera a cota |
| **Aviso a 90%** | passando de 90% (`fm_cota_aviso`) o bot diz "A busca por nome está no limite de hoje. Cola o link que funciona."; só links continuam valendo, e o que está no cache também |

Ver o uso: `select * from fm_quota order by dia desc;` (não há painel admin ainda). No modo Node, o contador fica em `fm_quota/<dia>` no mesmo arquivo de dados.

### Pedir mais cota ao Google (grátis)

1. console.cloud.google.com → seu projeto → **APIs e serviços → YouTube Data API v3 → Cotas** (confira o uso do dia ali também).
2. Na mesma tela, **Solicitar aumento de cota** (ou o formulário "YouTube API Services – Audit and Quota Extension Form"). É de graça e passa por uma auditoria de conformidade com os Termos de Serviço.
3. Na auditoria, explique: o app só **toca o player oficial incorporado e visível** (nunca baixa nem separa áudio), usa a busca para achar o vídeo que a pessoa pediu, guarda resultados em cache por 30 dias e mostra a miniatura pública. Mostre o link do app e os limites por pessoa.
4. Enquanto a resposta não vem, o cache e o limite por pessoa seguram o gasto.

Se subir a cota, ajuste `fm_cota_dia` em `app_config` (Supabase) ou `FM_CFG.quotaDay` (Node).

## Limites (ajustáveis)

| O quê | Padrão | Onde mudar |
|---|---|---|
| duração máxima do vídeo | 15 min | `fm_max_dur_s` em `app_config` (Supabase) · `FM_CFG.maxDurS` (Node) |
| fila da sala | 30 itens | `fm_max_fila` · `FM_CFG.maxQueue` |
| esperando por pessoa (dono e DJs sem limite) | 3 | `fm_por_pessoa` · `FM_CFG.perUser` |
| `/music` por minuto por pessoa | 5 | `fm_por_minuto` · `FM_CFG.perMinute` |
| buscas por nome por pessoa por hora | 10 | `fm_busca_hora` · `FM_CFG.searchPerHour` |
| cota diária da API / aviso | 10.000 / 90% | `fm_cota_dia`, `fm_cota_aviso` · `FM_CFG.quotaDay`, `quotaWarnPct` |
| validade do cache de buscas | 30 dias | `fm_cache_dias` · `FM_CFG.cacheDays` |
| quem pode pôr música | todos | `roles.quem_adiciona` (`'todos'` ou `'djs'`) |
| visual (tamanho do player, BPM do pulso, velocidade do dirigível) | | `FMV` em `src/app/fm.js` |

## Regras do YouTube que o Rolê FM respeita

- O player fica **visível, com no mínimo 200×200 px**, sem nada por cima. Minimizar só esconde título e controles.
- Não esconde o player, não separa áudio do vídeo, não baixa nem desenha o vídeo em canvas.
- A capa usada no cenário é a **miniatura pública** (`i.ytimg.com/vi/<id>/hqdefault.jpg`), reduzida uma vez por música.
- O pulso das caixas é **simulado** (120 BPM com leve variação): o áudio do player não pode ser analisado.
- Só toca vídeo que o dono permite incorporar (conferido pelo oEmbed). Transmissões ao vivo são recusadas quando há chave da API.
- O Rolê FM só existe em salas privadas (`privacidade` = `link` ou `fechado`); o banco recusa qualquer outra.

## Instalação

### Supabase (site no ar)

1. SQL Editor: rode `supabase/schema.sql` e depois **`supabase/fm.sql`** (pode rodar de novo sem estragar nada).
2. Publique a função **`music-resolve`**:
   - Painel: Edge Functions → Deploy a new function → Via Editor, nome `music-resolve`, cole `supabase/functions/music-resolve/index.ts`. Em Details, desligue "Verify JWT with legacy secret" (o login é conferido dentro da função).
   - ou no terminal: `supabase functions deploy music-resolve --no-verify-jwt`
3. **`YOUTUBE_API_KEY`** (Edge Functions → Secrets): **obrigatória para a busca por nome**; opcional para links (traz a duração, para a música avançar no tempo certo, e recusa lives; sem ela a duração vem do primeiro DJ que ouvir).
   - Criar: console.cloud.google.com → novo projeto → APIs e serviços → Biblioteca → **YouTube Data API v3** → Ativar → Credenciais → Chave de API (restrinja a essa API).
   - Custo: `videos.list` = 1 unidade de cota por música (a cota gratuita é de 10.000 por dia).

### Servidor Node (`npm run dev`, VPS)

Já vem pronto (`server/fm.js`), sem nada para configurar. `YOUTUBE_API_KEY` no `.env` é opcional, pelos mesmos motivos. Os dados ficam no mesmo arquivo do resto.

## O visual

- **Dirigível (computador):** camada do céu, atrás da ilha, na cor do cartucho da sala. Telão lateral com a capa (28×28) e o título correndo em letreiro de LED (fonte 3×5 própria), alto-falante pendurado que pulsa, notinhas (no máximo 8), luzes que piscam à noite. Só aparece com música tocando. Em salas fechadas (festa, boate…) as paredes cobrem o céu, então ele só aparece quando o céu está à vista.
- **Palco (celular, até 760 px ou toque):** na borda de trás de cada cenário (`stageSpot` no `catalog.js`), fora das casas onde dá para andar. Telão inclinado no grid com a capa, barra de progresso e letreiro; paredão de 6 caixas grandes e 4 pequenas pulsando defasadas; luzes à noite.
- Tocar no dirigível, no palco ou em **Ouvir junto** liga a música.
- Com `prefers-reduced-motion`: dirigível mais lento, sem notas e sem balanço.
- Tudo que é fixo é desenhado uma vez, em cache. Custo medido: **cerca de 2 ms por quadro numa CPU 4× mais lenta** (uns 0,5 ms numa máquina normal), pela diferença entre ligado e desligado.

## Testes

- `node --test test/fmcore.test.js`: links, comandos, posição com pausa e relógio, permissões, limite de 3.
- `node test/sql/fm.test.mjs <pasta> supabase/schema.sql supabase/fm.sql`: o banco num Postgres de verdade (precisa de `npm i --no-save embedded-postgres pg`).
- `node test/fm.js [principal|busca|visual]`: ponta a ponta com o servidor Node, 3 navegadores e o player do YouTube simulado (`SHOTS=pasta` salva capturas).

## Para depois

Autocompletar com as buscas já feitas (só do cache), painel de uso da cota, votação para pular, playlist inteira, escolher "só DJs" na criação da sala, painel de uso da cota.
