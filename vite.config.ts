import { defineConfig, Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

import { AuraluxRoom } from './server';
import { WebSocketTransport } from "@colyseus/ws-transport"
import { Server } from 'colyseus';
const colyseusServerPlugin = (): Plugin => {
  let gameServer: Server;
  return {
    name: 'colyseus-server',
    buildStart(options) {
      gameServer = new Server({
        transport: new WebSocketTransport({
          pingMaxRetries: 10,
        }),
      });
      gameServer.listen(2567);
      // gameServer.simulateLatency(1600)
      // gameServer.simulateLatency(800)
      // gameServer.simulateLatency(200)
      gameServer.define('auralux', AuraluxRoom)
        .filterBy(['label']);
    },
    closeBundle() {
      gameServer.gracefullyShutdown(false)
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), colyseusServerPlugin()],
  server: {
    cors: true,
    host: '0.0.0.0',
    proxy: {
      '/server': {
        target: 'http://localhost:2567',
        ws: true,
      },
    },
  },
})
