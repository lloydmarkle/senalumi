import { defineConfig, Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

import { AuraluxRoom } from './server';
import { Server } from 'colyseus';
const colyseusServerPlugin = (): Plugin => {
  let gameServer: Server;
  return {
    name: 'colyseus-server',
    buildStart(options) {
      gameServer = new Server();
      gameServer.listen(2567);
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
    proxy: {
      '/server': {
        target: 'http://localhost:2567',
        ws: true,
      },
    },
  },
})
