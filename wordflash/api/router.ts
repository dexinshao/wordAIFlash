import { createRouter, publicQuery } from "./middleware";
import { libraryRouter } from "./library-router";
import { wordRouter } from "./word-router";
import { progressRouter } from "./progress-router";
import { aiRouter } from "./ai-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  library: libraryRouter,
  word: wordRouter,
  progress: progressRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
