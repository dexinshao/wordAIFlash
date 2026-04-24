import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { words, libraryWords, wordProgress, wordLibraries } from "@db/schema";
import { eq, and, like, inArray, sql } from "drizzle-orm";

// ── 有道词典 API（免费，无需 API Key，返回中文释义） ──────────────────

interface WordDefinition {
  phonetic: string;
  definitions: Array<{ pos: string; meaning: string }>;
  phrases: Array<{ phrase: string; meaning: string }>;
  examples: Array<{ sentence: string; translation: string }>;
}

async function fetchWordFromYoudao(word: string): Promise<WordDefinition | null> {
  try {
    const res = await fetch(
      `https://dict.youdao.com/suggest?num=1&doctype=json&q=${encodeURIComponent(word.toLowerCase())}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const entries = data?.data?.entries;
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const entry = entries[0];
    const explain = entry.explain || "";
    if (!explain) return null;

    // 解析有道返回的释义格式，如 "n. 爱；爱情；v. 爱恋；..."
    const definitions: Array<{ pos: string; meaning: string }> = [];
    const parts = explain.split(/(?=[a-z]\.\s)/i);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // 匹配词性前缀，如 "n. " 或 "v. "
      const match = trimmed.match(/^([a-z]+\.)\s*(.+)/i);
      if (match) {
        definitions.push({ pos: match[1], meaning: match[2].trim() });
      } else if (definitions.length === 0) {
        // 没有词性前缀的，作为默认释义
        definitions.push({ pos: "", meaning: trimmed });
      }
    }

    return {
      phonetic: "",
      definitions: definitions.slice(0, 3),
      phrases: [],
      examples: [],
    };
  } catch {
    return null;
  }
}

// ── 降级方案：Free Dictionary API（备用） ──────────────────────────────

async function fetchWordFromFreeDict(word: string): Promise<WordDefinition | null> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const entry = data[0];
    const phonetic = entry.phonetic || (entry.phonetics?.find((p: any) => p.text)?.text) || "";

    const definitions: Array<{ pos: string; meaning: string }> = [];
    const examples: Array<{ sentence: string; translation: string }> = [];

    for (const meaning of entry.meanings || []) {
      const pos = meaning.partOfSpeech || "";
      for (const def of meaning.definitions?.slice(0, 2) || []) {
        definitions.push({ pos, meaning: def.definition });
        if (def.example) {
          examples.push({ sentence: def.example, translation: "" });
        }
      }
    }

    return {
      phonetic,
      definitions: definitions.slice(0, 3),
      phrases: [],
      examples: examples.slice(0, 2),
    };
  } catch {
    return null;
  }
}

// ── 多源降级查询：有道 → Free Dictionary ──────────────────────────────

// SQLite 将 JSON 存为 text，需要手动解析
function parseJsonField<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return null; }
  }
  return value as T;
}

function parseWordFields(w: Record<string, unknown>) {
  return {
    ...w,
    definitions: parseJsonField<Array<{ pos: string; meaning: string }>>(w.definitions),
    phrases: parseJsonField<Array<{ phrase: string; meaning: string }>>(w.phrases),
    examples: parseJsonField<Array<{ sentence: string; translation: string }>>(w.examples),
  };
}

async function fetchWordDefinition(word: string): Promise<WordDefinition | null> {
  // 首选有道词典（中文释义）
  const youdaoResult = await fetchWordFromYoudao(word);
  if (youdaoResult) return youdaoResult;

  // 降级到 Free Dictionary API（英文释义）
  return fetchWordFromFreeDict(word);
}

// ── 异步导入任务管理 ──────────────────────────────────────────────────

interface ImportTask {
  id: string;
  libraryId: number;
  total: number;
  completed: number;
  success: number;
  failed: number;
  status: "processing" | "completed";
  importedWords: string[];
  failedWords: string[];
  createdAt: Date;
}

// 内存中的任务队列（单进程足够，重启后任务丢失可接受）
const importTasks = new Map<string, ImportTask>();

// 后台异步获取释义并更新数据库
async function enrichWordInBackground(wordId: number, word: string) {
  try {
    const def = await fetchWordDefinition(word);
    if (def && (def.definitions.length > 0 || def.phonetic)) {
      const db = getDb();
      await db
        .update(words)
        .set({
          phonetic: def.phonetic || undefined,
          definitions: def.definitions.length > 0 ? JSON.stringify(def.definitions) : undefined,
          phrases: def.phrases.length > 0 ? JSON.stringify(def.phrases) : undefined,
          examples: def.examples.length > 0 ? JSON.stringify(def.examples) : undefined,
        })
        .where(eq(words.id, wordId));
    }
  } catch {
    // 静默失败，不影响用户
  }
}

// 启动后台任务处理队列
function startBackgroundEnrichment(taskId: string, wordEntries: Array<{ wordId: number; word: string }>) {
  const task = importTasks.get(taskId);
  if (!task) return;

  // 逐个处理，控制并发速率（每 200ms 一个请求，避免被限流）
  let index = 0;
  const processNext = async () => {
    if (index >= wordEntries.length) {
      task.status = "completed";
      return;
    }
    const { wordId, word } = wordEntries[index];
    await enrichWordInBackground(wordId, word);
    task.completed++;
    index++;
    setTimeout(processNext, 200);
  };
  processNext();
}

export const wordRouter = createRouter({
  list: publicQuery
    .input(z.object({
      libraryId: z.number(),
      search: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
      filter: z.enum(["all", "mastered", "well_known", "familiar", "unknown", "unlearned"]).default("all"),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const { libraryId, search, page, pageSize, filter } = input;
      const offset = (page - 1) * pageSize;

      const lwResult = await db
        .select({ wordId: libraryWords.wordId })
        .from(libraryWords)
        .where(eq(libraryWords.libraryId, libraryId));

      const wordIds = lwResult.map((r: { wordId: number }) => r.wordId);

      if (wordIds.length === 0) {
        return { words: [], total: 0 };
      }

      // 获取该词库所有进度
      const allProgress = await db
        .select()
        .from(wordProgress)
        .where(eq(wordProgress.libraryId, libraryId));

      const progressMap = new Map(allProgress.map((p: typeof wordProgress.$inferSelect) => [p.wordId, p]));

      // 根据 filter 筛选 wordIds
      let filteredWordIds = wordIds;
      if (filter !== "all") {
        filteredWordIds = wordIds.filter(wid => {
          const p = progressMap.get(wid);
          if (filter === "unlearned") return !p;
          if (!p) return false;
          if (filter === "mastered") return p.isMastered || p.lastFeedback === "mastered";
          return p.lastFeedback === filter;
        });
      }

      // 搜索过滤
      let searchWordIds = filteredWordIds;
      if (search) {
        searchWordIds = filteredWordIds.filter(wid => {
          const w = wordIds.indexOf(wid);
          return wid; // placeholder, actual filter below
        });
      }

      const conditions = search
        ? and(inArray(words.id, search ? filteredWordIds : wordIds), like(words.word, `%${search}%`))
        : inArray(words.id, filteredWordIds);

      const wordList = await db
        .select()
        .from(words)
        .where(conditions)
        .limit(pageSize)
        .offset(offset);

      const progressList = wordList.length > 0
        ? allProgress.filter((p: typeof wordProgress.$inferSelect) =>
            wordList.some((w: typeof words.$inferSelect) => w.id === p.wordId)
          )
        : [];

      const progressMapForList = new Map(progressList.map((p: typeof wordProgress.$inferSelect) => [p.wordId, p]));

      const wordsWithProgress = wordList.map((w: typeof words.$inferSelect) => ({
        ...w,
        progress: progressMapForList.get(w.id) ?? null,
      }));

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(words)
        .where(conditions);

      return {
        words: wordsWithProgress.map((w: Record<string, unknown>) => parseWordFields(w)),
        total: countResult[0]?.count ?? 0,
      };
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db.select().from(words).where(eq(words.id, input.id));
      const raw = result[0] ?? null;
      return raw ? parseWordFields(raw as Record<string, unknown>) : null;
    }),

  getNextFlashcard: publicQuery
    .input(z.object({ libraryId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const { libraryId } = input;

      const lwResult = await db
        .select({ wordId: libraryWords.wordId })
        .from(libraryWords)
        .where(eq(libraryWords.libraryId, libraryId));

      const wordIds = lwResult.map((r: { wordId: number }) => r.wordId);
      if (wordIds.length === 0) return null;

      const progressList = await db
        .select()
        .from(wordProgress)
        .where(
          and(
            eq(wordProgress.libraryId, libraryId),
            inArray(wordProgress.wordId, wordIds)
          )
        );

      const progressMap = new Map<number, typeof wordProgress.$inferSelect>(
        progressList.map((p: typeof wordProgress.$inferSelect) => [p.wordId, p])
      );

      const candidates = wordIds.filter((id: number) => {
        const p = progressMap.get(id);
        return !p || !p.isMastered;
      });

      if (candidates.length === 0) return null;

      const weights = candidates.map((id: number) => {
        const p = progressMap.get(id);
        let weight = 1.0;

        if (!p || (p.reviewCount ?? 0) === 0) weight *= 3.0;
        const nextReview = p?.nextReviewAt;
        if (nextReview && new Date(nextReview) <= new Date()) weight *= 2.5;
        const mastery = parseFloat(p?.masteryScore?.toString() ?? "0");
        weight *= (1.5 - mastery);

        return weight;
      });

      const totalWeight = weights.reduce((a: number, b: number) => a + b, 0);
      let random = Math.random() * totalWeight;

      let selectedIndex = 0;
      for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          selectedIndex = i;
          break;
        }
      }

      const selectedWordId = candidates[selectedIndex];
      const wordResult = await db.select().from(words).where(eq(words.id, selectedWordId));
      const raw = wordResult[0] ?? null;
      return raw ? parseWordFields(raw as Record<string, unknown>) : null;
    }),

  // ── 异步导入：先快速入库，后台获取释义 ────────────────────────────────
  import: publicQuery
    .input(z.object({
      libraryId: z.number(),
      wordList: z.array(z.string().min(1)).max(10000),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { libraryId, wordList } = input;

      const taskId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const task: ImportTask = {
        id: taskId,
        libraryId,
        total: wordList.length,
        completed: 0,
        success: 0,
        failed: 0,
        status: "processing",
        importedWords: [],
        failedWords: [],
        createdAt: new Date(),
      };
      importTasks.set(taskId, task);

      // 需要后台获取释义的单词列表
      const wordsToEnrich: Array<{ wordId: number; word: string }> = [];

      for (const rawWord of wordList) {
        const word = rawWord.trim().toLowerCase();
        if (!word) continue;

        try {
          // 检查单词是否已存在
          const existing = await db
            .select()
            .from(words)
            .where(eq(words.word, word));

          let wordId: number;

          if (existing.length > 0) {
            wordId = existing[0].id;
          } else {
            // 先快速创建单词记录（释义待后台填充）
            const inserted = await db.insert(words).values({
              word,
              phonetic: "",
              definitions: JSON.stringify([{ pos: "", meaning: "释义获取中..." }]),
              phrases: JSON.stringify([]),
              examples: JSON.stringify([]),
            });
            wordId = Number((inserted as any).lastInsertRowid);
            wordsToEnrich.push({ wordId, word });
          }

          // 检查是否已关联到该词库
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
            });
          }

          task.success++;
          task.importedWords.push(word);
        } catch {
          task.failed++;
          task.failedWords.push(word);
        }
      }

      // 更新词库单词数
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(libraryWords)
        .where(eq(libraryWords.libraryId, libraryId));

      await db
        .update(wordLibraries)
        .set({ wordCount: countResult[0]?.count ?? 0 })
        .where(eq(wordLibraries.id, libraryId));

      // 启动后台任务获取释义
      if (wordsToEnrich.length > 0) {
        startBackgroundEnrichment(taskId, wordsToEnrich);
      } else {
        task.status = "completed";
      }

      return {
        taskId,
        success: task.success,
        failed: task.failed,
        importedWords: task.importedWords,
        failedWords: task.failedWords,
        enriching: wordsToEnrich.length,
      };
    }),

  // ── 查询导入任务状态（后台释义获取进度） ─────────────────────────────
  getImportStatus: publicQuery
    .input(z.object({ taskId: z.string() }))
    .query(({ input }) => {
      const task = importTasks.get(input.taskId);
      if (!task) return null;
      return {
        id: task.id,
        status: task.status,
        total: task.total,
        completed: task.completed,
        success: task.success,
        failed: task.failed,
        progress: task.total > 0 ? Math.round((task.completed / task.total) * 100) : 100,
      };
    }),

  // ── 批量补全缺失释义（后台异步） ──────────────────────────────────────
  enrichMissing: publicQuery
    .input(z.object({ libraryId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // 防重复：如果已有正在运行的补全任务，直接返回
      for (const [, task] of importTasks) {
        if (task.status === "processing" && task.id.startsWith("enrich_")) {
          return { total: task.total, taskId: task.id, message: `已有补全任务运行中，已处理 ${task.completed}/${task.total}` };
        }
      }

      // 查找释义缺失的单词（definitions 为空或包含"释义获取中"）
      let query = db.select().from(words);
      if (input.libraryId) {
        query = db
          .select({ id: words.id, word: words.word })
          .from(words)
          .innerJoin(libraryWords, eq(libraryWords.wordId, words.id))
          .where(eq(libraryWords.libraryId, input.libraryId));
      }

      const allWords = await query;
      const missingWords: Array<{ id: number; word: string }> = [];

      for (const w of allWords) {
        const defs = w.definitions;
        let defsArr: unknown;
        if (typeof defs === "string") {
          try { defsArr = JSON.parse(defs); } catch { defsArr = null; }
        } else {
          defsArr = defs;
        }
        if (
          !defsArr ||
          !Array.isArray(defsArr) ||
          defsArr.length === 0 ||
          (defsArr.length === 1 && defsArr[0]?.meaning === "释义获取中...")
        ) {
          missingWords.push({ id: (w as any).id, word: (w as any).word });
        }
      }

      if (missingWords.length === 0) {
        return { total: 0, message: "所有单词释义已完整" };
      }

      // 启动后台任务
      const taskId = `enrich_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const task: ImportTask = {
        id: taskId,
        libraryId: input.libraryId ?? 0,
        total: missingWords.length,
        completed: 0,
        success: 0,
        failed: 0,
        status: "processing",
        importedWords: [],
        failedWords: [],
        createdAt: new Date(),
      };
      importTasks.set(taskId, task);

      const entries = missingWords.map(w => ({ wordId: w.id, word: w.word }));
      startBackgroundEnrichment(taskId, entries);

      return { total: missingWords.length, taskId, message: `正在补全 ${missingWords.length} 个单词的释义` };
    }),

  // ── 统计缺失释义的单词数量 ──────────────────────────────────────────
  getMissingCount: publicQuery
    .input(z.object({ libraryId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();

      let query;
      if (input.libraryId) {
        query = await db
          .select({ id: words.id, word: words.word, definitions: words.definitions })
          .from(words)
          .innerJoin(libraryWords, eq(libraryWords.wordId, words.id))
          .where(eq(libraryWords.libraryId, input.libraryId));
      } else {
        query = await db.select().from(words);
      }

      let missing = 0;
      for (const w of query) {
        const defs = (w as any).definitions;
        let defsArr: unknown;
        if (typeof defs === "string") {
          try { defsArr = JSON.parse(defs); } catch { defsArr = null; }
        } else {
          defsArr = defs;
        }
        if (
          !defsArr ||
          !Array.isArray(defsArr) ||
          defsArr.length === 0 ||
          (defsArr.length === 1 && defsArr[0]?.meaning === "释义获取中...")
        ) {
          missing++;
        }
      }

      return { total: query.length, missing };
    }),

  // ── 调试：查看所有后台任务状态 ──────────────────────────────────────
  getTaskList: publicQuery
    .query(() => {
      const tasks: Array<{
        id: string;
        type: string;
        status: string;
        total: number;
        completed: number;
        progress: number;
      }> = [];
      for (const [id, task] of importTasks) {
        tasks.push({
          id,
          type: id.startsWith("enrich_") ? "补全释义" : "导入",
          status: task.status,
          total: task.total,
          completed: task.completed,
          progress: task.total > 0 ? Math.round((task.completed / task.total) * 100) : 100,
        });
      }
      return { count: tasks.length, tasks };
    }),
});
