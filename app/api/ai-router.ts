import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { words, libraryWords, wordLibraries, wordProgress } from "@db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { callAI, callAILite } from "./lib/ai";

// 内置词库分类 → 显示名称映射
const LIB_CATEGORY_LABELS: Record<string, string> = {
  cet4: "四级",
  cet6: "六级",
  toefl: "托福",
  ielts: "雅思",
  tem8: "八级",
  bec: "BEC",
  high_school: "高中",
  top10000: "高频",
};

// ── AI 生成主题单词 ──────────────────────────────────────────────────

export const aiRouter = createRouter({
  generateTopicWords: publicQuery
    .input(z.object({
      prompt: z.string().min(2).max(200),
      excludeLibraryId: z.number().optional(), // 排除指定词库的所有单词
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const MIN_WORDS = 10;
      const MAX_RETRIES = 3;

      // 预加载排除数据（只需查一次）
      const excludeWordIds = new Set<number>();
      const masteredWordIds = new Set<number>();
      let excludeWordList: string[] = []; // 传给 AI 的排除单词文本列表

      if (input.excludeLibraryId) {
        const excludeLinks = await db
          .select({ wordId: libraryWords.wordId })
          .from(libraryWords)
          .where(eq(libraryWords.libraryId, input.excludeLibraryId));
        for (const link of excludeLinks) {
          excludeWordIds.add((link as any).wordId);
        }
        // 查询排除词库的单词文本（传给 AI，最多 100 个）
        if (excludeWordIds.size > 0) {
          const excludeWords = await db
            .select({ word: words.word })
            .from(words)
            .where(inArray(words.id, [...excludeWordIds]));
          excludeWordList = excludeWords.map((w: any) => w.word);
        }
      }

      const masteredProgress = await db
        .select({ wordId: wordProgress.wordId })
        .from(wordProgress)
        .where(eq(wordProgress.isMastered, true));
      for (const p of masteredProgress) {
        masteredWordIds.add((p as any).wordId);
      }

      const allExcluded = new Set([...masteredWordIds, ...excludeWordIds]);

      let bestResult: { topic: string; words: Array<{ word: string; tags: string[] }> } | null = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const aiResponse = await callAI(input.prompt, excludeWordList.length > 0 ? excludeWordList : undefined);
        const parsed = JSON.parse(aiResponse) as { topic: string; words: string[] };

        if (!parsed.words || !Array.isArray(parsed.words) || parsed.words.length === 0) {
          if (attempt < MAX_RETRIES - 1) continue;
          throw new Error("AI 未返回有效的单词列表");
        }

        // 去重、转小写、过滤非法字符
        const cleanWords = [...new Set(
          parsed.words
            .map((w: string) => w.trim().toLowerCase())
            .filter((w: string) => /^[a-z'-]+$/.test(w))
        )];

        // 查询每个单词在哪些内置词库中
        const wordTagMap: Record<string, string[]> = {};

        if (cleanWords.length > 0) {
          const existingWords = await db
            .select({ id: words.id, word: words.word })
            .from(words)
            .where(inArray(words.word, cleanWords));

          if (existingWords.length > 0) {
            const wordIdMap = new Map(existingWords.map((w: any) => [w.id, w.word]));
            const wordIds = existingWords.map((w: any) => w.id);

            const links = await db
              .select({ wordId: libraryWords.wordId, libraryId: libraryWords.libraryId })
              .from(libraryWords)
              .where(inArray(libraryWords.wordId, wordIds));

            const allLibs = await db
              .select({ id: wordLibraries.id, category: wordLibraries.category })
              .from(wordLibraries)
              .where(eq(wordLibraries.isBuiltin, true));

            const libCategoryMap = new Map(allLibs.map((l: any) => [l.id, l.category]));

            for (const link of links) {
              const word = wordIdMap.get((link as any).wordId);
              const category = libCategoryMap.get((link as any).libraryId);
              if (word && category && LIB_CATEGORY_LABELS[category]) {
                if (!wordTagMap[word]) wordTagMap[word] = [];
                wordTagMap[word].push(LIB_CATEGORY_LABELS[category]);
              }
            }
          }
        }

        // 过滤掉已掌握 + 排除词库中的单词
        const existingWordMap = await db
          .select({ id: words.id, word: words.word })
          .from(words)
          .where(inArray(words.word, cleanWords));
        const wordToIdMap = new Map(existingWordMap.map((w: any) => [w.word, w.id]));

        const filteredWords = cleanWords.filter(word => {
          const wid = wordToIdMap.get(word);
          if (!wid) return true;
          if (allExcluded.has(wid)) return false;
          return true;
        });

        const wordsWithTags = filteredWords.map(word => ({
          word,
          tags: wordTagMap[word] || [],
        }));

        // 足够则直接返回，否则保留最好的结果继续尝试
        if (wordsWithTags.length >= MIN_WORDS) {
          return {
            topic: parsed.topic || input.prompt,
            words: wordsWithTags,
            total: wordsWithTags.length,
          };
        }

        if (!bestResult || wordsWithTags.length > bestResult.words.length) {
          bestResult = {
            topic: parsed.topic || input.prompt,
            words: wordsWithTags,
            total: wordsWithTags.length,
          };
        }
      }

      // 重试后仍不足10个，返回最好的结果
      if (bestResult) {
        return bestResult;
      }

      throw new Error("AI 未能生成足够的单词，请尝试其他主题");
    }),

  // ── 用 AI 判断主题与哪些词库相关 ──────────────────────────────────────
  findRelatedLibraries: publicQuery
    .input(z.object({
      topic: z.string().min(1).max(100),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();

      // 获取所有非"已掌握"词库
      const allLibs = await db
        .select()
        .from(wordLibraries)
        .where(sql`${wordLibraries.category} != 'mastered'`);

      if (allLibs.length === 0) return { libraries: [] };

      // 构建词库列表文本，让 AI 判断哪些相关（去掉 emoji 避免干扰）
      const libListText = allLibs.map((lib: any, i: number) => {
        const cleanName = (lib.name || "").replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").trim();
        return `${i + 1}. [ID:${lib.id}] ${cleanName}${lib.description ? " - " + lib.description : ""}`;
      }).join("\n");

      const aiResponse = await callAILite(
        `你是一个分类匹配助手。用户会描述一个英语学习主题，你需要判断哪些词库与该主题相关。
注意：词库名可能是英文或中文，请根据语义判断相关性。
只返回相关词库的 ID 列表，用 JSON 数组格式，例如：[1, 5, 9]
如果没有相关的，返回空数组 []。只返回 JSON 数组，不要其他文字。`,
        `用户主题："${input.topic}"

现有词库列表：
${libListText}`
      );

      const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) return { libraries: [] };

      let relatedIds: number[];
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed)) return { libraries: [] };
        // 兼容多种格式：[1, 5, 9] 或 ["1", "5"] 或 [{"id": 1}, {"id": "5"}]
        relatedIds = parsed.map((item: any) => {
          if (typeof item === "number") return item;
          if (typeof item === "string") return parseInt(item, 10);
          if (item?.id != null) return typeof item.id === "number" ? item.id : parseInt(item.id, 10);
          return NaN;
        }).filter((id: any) => !isNaN(id));
      } catch {
        return { libraries: [] };
      }

      if (relatedIds.length === 0) return { libraries: [] };

      // 过滤出匹配的词库
      const related = allLibs.filter((lib: any) => relatedIds.includes(lib.id));

      return {
        libraries: related.map((lib: any) => ({
          id: lib.id,
          name: lib.name,
          description: lib.description,
          wordCount: lib.wordCount,
          category: lib.category,
        })),
      };
    }),

  createTopicLibrary: publicQuery
    .input(z.object({
      topic: z.string().min(1).max(100),
      wordList: z.array(z.object({
        word: z.string().min(1),
        tags: z.array(z.string()).optional(),
      })).max(100),
      targetLibraryId: z.number().optional(), // 合并到已有词库
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { topic, wordList, targetLibraryId } = input;
      const now = new Date();

      let libraryId: number;

      if (targetLibraryId) {
        // 合并到已有词库
        libraryId = targetLibraryId;
        // 更新词库时间
        await db
          .update(wordLibraries)
          .set({ updatedAt: now })
          .where(eq(wordLibraries.id, libraryId));
      } else {
        // 创建新词库
        const libResult = await db.insert(wordLibraries).values({
          name: `🤖 ${topic}`,
          description: `AI 生成：${topic} 相关词汇`,
          category: "ai_topic",
          isBuiltin: false,
          wordCount: 0,
          createdAt: now,
          updatedAt: now,
        });
        libraryId = Number((libResult as any)[0].insertId);
      }

      // 导入单词（复用 word-router 的逻辑，但简化版）
      let success = 0;
      const wordsToEnrich: Array<{ wordId: number; word: string }> = [];

      for (const item of wordList) {
        const word = item.word.trim().toLowerCase();
        if (!word) continue;

        try {
          const existing = await db
            .select()
            .from(words)
            .where(eq(words.word, word));

          let wordId: number;

          if (existing.length > 0) {
            wordId = existing[0].id;
          } else {
            const inserted = await db.insert(words).values({
              word,
              phonetic: "",
              definitions: JSON.stringify([{ pos: "", meaning: "释义获取中..." }]),
              phrases: JSON.stringify([]),
              examples: JSON.stringify([]),
            });
            wordId = Number((inserted as any)[0].insertId);
            wordsToEnrich.push({ wordId, word });
          }

          const existingLink = await db
            .select()
            .from(libraryWords)
            .where(
              and(
                eq(libraryWords.libraryId, libraryId),
                eq(libraryWords.wordId, wordId)
              )
            );

          if (existingLink.length === 0) {
            await db.insert(libraryWords).values({
              libraryId,
              wordId,
              addedAt: now,
            });
          }

          success++;
        } catch {
          // 静默失败
        }
      }

      // 更新词库单词数
      await db
        .update(wordLibraries)
        .set({ wordCount: success })
        .where(eq(wordLibraries.id, libraryId));

      // 触发后台释义获取（复用 word-router 的逻辑）
      // 通过简单的 setTimeout 链来处理
      if (wordsToEnrich.length > 0) {
        let idx = 0;
        const enrichNext = async () => {
          if (idx >= wordsToEnrich.length) return;
          const { wordId, word } = wordsToEnrich[idx];
          try {
            const res = await fetch(
              `https://dict.youdao.com/suggest?num=1&doctype=json&q=${encodeURIComponent(word)}`,
              { headers: { "User-Agent": "Mozilla/5.0" } }
            );
            if (res.ok) {
              const data = await res.json();
              const entries = data?.data?.entries;
              if (Array.isArray(entries) && entries.length > 0) {
                const explain = entries[0].explain || "";
                if (explain) {
                  const definitions: Array<{ pos: string; meaning: string }> = [];
                  const parts = explain.split(/(?=[a-z]\.\s)/i);
                  for (const part of parts) {
                    const trimmed = part.trim();
                    if (!trimmed) continue;
                    const match = trimmed.match(/^([a-z]+\.)\s*(.+)/i);
                    if (match) {
                      definitions.push({ pos: match[1], meaning: match[2].trim() });
                    } else if (definitions.length === 0) {
                      definitions.push({ pos: "", meaning: trimmed });
                    }
                  }
                  if (definitions.length > 0) {
                    await db.update(words).set({
                      definitions: JSON.stringify(definitions.slice(0, 3)),
                    }).where(eq(words.id, wordId));
                  }
                }
              }
            }
          } catch { /* 静默 */ }
          idx++;
          setTimeout(enrichNext, 200);
        };
        enrichNext();
      }

      // 获取词库名称
      const libInfo = await db
        .select({ name: wordLibraries.name })
        .from(wordLibraries)
        .where(eq(wordLibraries.id, libraryId));

      return {
        libraryId,
        name: libInfo[0]?.name || `🤖 ${topic}`,
        wordCount: success,
        enriching: wordsToEnrich.length,
        merged: !!targetLibraryId,
      };
    }),

  // ── 将指定单词在所有关联词库中标记为已掌握 ──────────────────────────
  markWordsAsMastered: publicQuery
    .input(z.object({
      wordList: z.array(z.string().min(1)),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const now = new Date();
      let marked = 0;
      let addedToMasteredLib = 0;

      // 确保存在"已掌握"专用词库
      const masteredLibRows = await db
        .select()
        .from(wordLibraries)
        .where(eq(wordLibraries.category, "mastered"));

      let masteredLibId: number;
      if (masteredLibRows.length > 0) {
        masteredLibId = masteredLibRows[0].id;
      } else {
        const libResult = await db.insert(wordLibraries).values({
          name: "✅ 已掌握",
          description: "AI 生成时跳过的已掌握单词",
          category: "mastered",
          isBuiltin: false,
          wordCount: 0,
          createdAt: now,
          updatedAt: now,
        });
        masteredLibId = Number((libResult as any)[0].insertId);
      }

      for (const rawWord of input.wordList) {
        const word = rawWord.trim().toLowerCase();
        if (!word) continue;

        // 查找或创建该单词
        let wordRows = await db
          .select({ id: words.id })
          .from(words)
          .where(eq(words.word, word));

        let wordId: number;
        if (wordRows.length > 0) {
          wordId = wordRows[0].id;
        } else {
          const inserted = await db.insert(words).values({
            word,
            phonetic: "",
            definitions: JSON.stringify([{ pos: "", meaning: "释义获取中..." }]),
            phrases: JSON.stringify([]),
            examples: JSON.stringify([]),
          });
          wordId = Number((inserted as any)[0].insertId);
        }

        // 查找该单词关联的所有词库
        const libLinks = await db
          .select({ libraryId: libraryWords.libraryId })
          .from(libraryWords)
          .where(eq(libraryWords.wordId, wordId));

        if (libLinks.length === 0) {
          // 不在任何词库中 → 添加到"已掌握"词库
          await db.insert(libraryWords).values({
            libraryId: masteredLibId,
            wordId,
            addedAt: now,
          });
          addedToMasteredLib++;
        }

        // 在所有关联词库中标记为已掌握（包括刚添加的"已掌握"词库）
        const allLibLinks = await db
          .select({ libraryId: libraryWords.libraryId })
          .from(libraryWords)
          .where(eq(libraryWords.wordId, wordId));

        for (const link of allLibLinks) {
          const libraryId = (link as any).libraryId;

          const existing = await db
            .select()
            .from(wordProgress)
            .where(and(
              eq(wordProgress.wordId, wordId),
              eq(wordProgress.libraryId, libraryId),
            ));

          if (existing.length > 0) {
            await db
              .update(wordProgress)
              .set({
                masteryScore: "1.00",
                lastFeedback: "mastered",
                isMastered: true,
                lastReviewedAt: now,
                updatedAt: now,
              })
              .where(eq(wordProgress.id, existing[0].id));
          } else {
            await db.insert(wordProgress).values({
              wordId,
              libraryId,
              masteryScore: "1.00",
              lastFeedback: "mastered",
              isMastered: true,
              lastReviewedAt: now,
            });
          }
          marked++;
        }
      }

      // 更新"已掌握"词库的单词数
      const masteredCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(libraryWords)
        .where(eq(libraryWords.libraryId, masteredLibId));
      await db
        .update(wordLibraries)
        .set({ wordCount: masteredCount[0]?.count ?? 0 })
        .where(eq(wordLibraries.id, masteredLibId));

      return { marked, addedToMasteredLib };
    }),
});
