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
| `/music <link>` (ou `/m`) | todos | põe na fila; se nada toca, toca na hora |
| `/skip` | dono e DJs | pula |
| `/pause` e `/play` | dono e DJs | pausa e volta para todo mundo |
| `/fila` | todos | as próximas 5 (só para quem pediu) |
| `/tocando` | todos | o que toca e o tempo (só para quem pediu) |
| `/tirar` | todos | tira a última música que **você** colocou (dono e DJs: `/tirar <posição>`) |
| `/limpar` | dono e DJs | esvazia a fila |
| `/dj @usuario`, `/undj @usuario` | dono | dá ou tira DJ |

Digitar `/` mostra só os comandos que a pessoa pode usar. As mensagens do bot (chip amarelo com a nota) vão para o chat de todos; as respostas privadas ficam só para quem pediu (borda tracejada).

## Limites (ajustáveis)

| O quê | Padrão | Onde mudar |
|---|---|---|
| duração máxima do vídeo | 15 min | `fm_max_dur_s` em `app_config` (Supabase) · `FM_CFG.maxDurS` (Node) |
| fila da sala | 30 itens | `fm_max_fila` · `FM_CFG.maxQueue` |
| esperando por pessoa (dono e DJs sem limite) | 3 | `fm_por_pessoa` · `FM_CFG.perUser` |
| `/music` por minuto por pessoa | 5 | `fm_por_minuto` · `FM_CFG.perMinute` |
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
3. Opcional, **`YOUTUBE_API_KEY`** (Edge Functions → Secrets): traz a duração (a música avança no tempo certo) e recusa lives. Sem ela, a duração vem do primeiro DJ que ouvir a música.
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
- `node test/fm.js`: ponta a ponta com o servidor Node, 3 navegadores e o player do YouTube simulado (`SHOTS=pasta` salva capturas).

## Para depois

Busca por nome (`/music ai se eu te pego`, `/buscar`), votação para pular, playlist inteira, escolher "só DJs" na criação da sala, painel de uso da cota.
