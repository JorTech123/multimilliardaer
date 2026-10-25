/**
 * ============================================================
 *  Multimillionær — inngang for Cloudflare Workers
 *
 *  Cloudflare har to måter å kjøre dette på:
 *
 *    Pages            plukker opp mappa functions/ av seg selv
 *    Workers + assets trenger denne filen, pekt på fra wrangler.jsonc
 *
 *  Begge veier ender i samme serverkode, så det finnes bare én
 *  utgave av logikken å vedlikeholde.
 *
 *  Statiske filer serveres rett fra ASSETS uten å gå via koden her.
 *  Bare /api sendes hit, styrt av run_worker_first i wrangler.jsonc.
 * ============================================================
 */

import { onRequest } from './functions/api.js';

export default {
  async fetch(request, env, ctx) {
    const sti = new URL(request.url).pathname;

    if (sti === '/api' || sti.startsWith('/api/')) {
      return onRequest({ request, env, ctx });
    }

    /* Alt annet er spillet selv: HTML, CSS og JavaScript */
    return env.ASSETS.fetch(request);
  }
};
