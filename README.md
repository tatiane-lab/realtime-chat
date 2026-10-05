# Real-time Chat

> Angular 22 · `rxjs/webSocket` · Exponential Backoff · NgRx SignalStore · `cdk-virtual-scroll` · User Presence

A real-time chat application with WebSocket reconnection, virtual scroll for large message histories, and live presence indicators.

## Features

- **WebSocket with Exponential Backoff** – `WebSocketService` wraps `rxjs/webSocket` and uses `retryWhen + delayWhen` to reconnect with delay = `min(1000 × 2^retry, 30000)` ms; stops after 10 attempts and transitions to `error` state; `NgZone.run()` pushes state changes into Angular's CD cycle.
- **NgRx SignalStore** – `ChatStore` manages messages, users and pending ops; `sendMessage` does an optimistic append, then `confirmMessage` / `failMessage` resolve or revert based on the WebSocket response.
- **Virtual Scroll** – `CdkVirtualScrollViewport` with `itemSize="72"` renders only visible messages; `AfterViewChecked` auto-scrolls to the bottom when new messages arrive, unless the user has scrolled up.
- **User Presence** – `setUserPresence` and `setUserTyping` update `users` in the store; `typingUsers` and `onlineUsers` are `computed()` projections.
- **Conflict Handling** – deduplication guard on `receiveMessage` prevents the same message ID appearing twice (server echo vs. WebSocket push).

## Tech Stack

| Package | Version |
|---|---|
| `@angular/core` | ^22.3.0 |
| `@angular/cdk` | ^22.3.0 |
| `@ngrx/signals` | ^22.0.0 |
| `rxjs` | ~7.8.0 |
