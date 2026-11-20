# Realtime Chat

Chat em tempo real feito com **Angular 22**, **signals** e **NgRx SignalStore**. Funciona 100% no navegador (sem backend): duas abas se comunicam via `BroadcastChannel` e dois bots respondem para que a sala nunca fique vazia.

## Demo e credenciais

A tela de login tem os botões **Entrar como Ana** e **Entrar como Bruno** (sem senha; usuários `ana` e `bruno`).
Para ver o tempo real: abra duas abas, entre como Ana em uma e como Bruno na outra e converse. A identidade fica em `sessionStorage`, por isso cada aba pode ser um usuário diferente.

## Funcionalidades

- Canais (`#general`, `#angular`, `#random`) com contador de mensagens não lidas.
- Envio otimista: `enviando` → `enviada` → `falhou`, com **Tentar de novo** e **Descartar**.
- Chave **Simular offline** na barra lateral para demonstrar falha e reenvio.
- Indicador de "digitando..." (pessoas entre abas e bots) com expiração automática.
- Presença online/offline por heartbeat entre abas.
- Rolagem automática inteligente (não puxa a tela se você rolou para cima) e botão "Novas mensagens".
- Estados de carregamento/conexão, canal vazio, offline e erro de login.
- Histórico persistido em `localStorage`; deduplicação por id.
- UI responsiva (a barra lateral vira gaveta no mobile), tema claro/escuro automático, `prefers-reduced-motion` e `aria-live`.

## Stack

Angular 22 (standalone, signals, OnPush, control flow, rotas lazy, guards funcionais) · `@ngrx/signals` · RxJS 7 · Vitest · TypeScript estrito.

## Como rodar

```bash
npm install --legacy-peer-deps   # @angular/build 22 exige TypeScript 6
npm start                        # http://localhost:4200 (ng serve --port 4212 para outra porta)
npm run build
npm test
```

## Arquitetura

```
src/app/
  core/    modelos (protocolo de eventos), AuthService (signals), guards
  login/   tela de login com contas demo
  chat/
    realtime.service.ts   transporte (BroadcastChannel) + estado da conexão
    chat.store.ts         SignalStore: mensagens, presença, digitando, não lidas
    bots.ts               lógica pura dos bots (testável)
    message-list / chat-page   UI
    websocket.service.ts  cliente rxjs/webSocket com backoff exponencial (retry({delay}))
```

Decisões:
- **Transporte plugável**: o store só conhece `events$`/`publish`. Para usar um servidor real, basta implementar o mesmo contrato com o `WebSocketService`, que já traz reconexão com backoff `min(1000·2^n, 30000)` ms e no máximo 10 tentativas.
- **SignalStore** como fonte única de verdade; `computed()` para mensagens da sala, digitando, online e não lidas.
- **Lista sem virtual scroll**: os balões têm altura variável e o `itemSize` fixo do CDK quebrava o layout; um canal tem no máximo centenas de itens.
- Timers de "digitando" com TTL para que um evento de "parou de digitar" perdido nunca trave o indicador.
- Bots como função pura (`pickReply`) com `rand` injetável, o que facilita os testes.
