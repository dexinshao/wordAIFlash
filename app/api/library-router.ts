import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { wordLibraries, libraryWords, wordProgress, words } from "@db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export const libraryRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = await getDb();
    const libs = await db.select().from(wordLibraries);
    return libs;
  }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const lib = await db.select().from(wordLibraries).where(eq(wordLibraries.id, input.id));
      return lib[0] ?? null;
    }),

  // ── 删除词库（可选合并单词到其他词库） ──────────────────────────────
  delete: publicQuery
    .input(z.object({
      id: z.number(),
      mergeToLibraryId: z.number().optional(), // 合并目标词库 ID
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, mergeToLibraryId } = input;

      // 获取词库信息
      const libRows = await db
        .select()
        .from(wordLibraries)
        .where(eq(wordLibraries.id, id));

      if (libRows.length === 0) throw new Error("词库不存在");

      let mergedWords = 0;

      if (mergeToLibraryId) {
        // 验证目标词库存在
        const targetLib = await db
          .select()
          .from(wordLibraries)
          .where(eq(wordLibraries.id, mergeToLibraryId));

        if (targetLib.length === 0) throw new Error("目标词库不存在");

        // 获取源词库的所有单词关联
        const sourceLinks = await db
          .select()
          .from(libraryWords)
          .where(eq(libraryWords.libraryId, id));

        for (const link of sourceLinks) {
          const wordId = (link as any).wordId;

          // 检查目标词库是否已有该单词
          const existingLink = await db
            .select()
            .from(libraryWords)
            .where(and(
              eq(libraryWords.libraryId, mergeToLibraryId),
              eq(libraryWords.wordId, wordId),
            ));

          if (existingLink.length === 0) {
            // 添加到目标词库
            await db.insert(libraryWords).values({
              libraryId: mergeToLibraryId,
              wordId,
              addedAt: (link as any).addedAt || new Date(),
            });
            mergedWords++;
          }

          // 迁移进度记录
          const existingProgress = await db
            .select()
            .from(wordProgress)
            .where(and(
              eq(wordProgress.wordId, wordId),
              eq(wordProgress.libraryId, id),
            ));

          if (existingProgress.length > 0) {
            const targetProgress = await db
              .select()
              .from(wordProgress)
              .where(and(
                eq(wordProgress.wordId, wordId),
                eq(wordProgress.libraryId, mergeToLibraryId),
              ));

            if (targetProgress.length === 0) {
              // 迁移进度到目标词库
              await db.insert(wordProgress).values({
                ...existingProgress[0],
                id: undefined,
                libraryId: mergeToLibraryId,
              });
            }
          }
        }

        // 更新目标词库的单词数
        const targetCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(libraryWords)
          .where(eq(libraryWords.libraryId, mergeToLibraryId));
        await db
          .update(wordLibraries)
          .set({ wordCount: targetCount[0]?.count ?? 0, updatedAt: new Date() })
          .where(eq(wordLibraries.id, mergeToLibraryId));
      }

      // 删除源词库的进度记录
      await db
        .delete(wordProgress)
        .where(eq(wordProgress.libraryId, id));

      // 删除源词库的单词关联
      await db
        .delete(libraryWords)
        .where(eq(libraryWords.libraryId, id));

      // 删除词库
      await db
        .delete(wordLibraries)
        .where(eq(wordLibraries.id, id));

      return { deleted: true, mergedWords };
    }),
});
