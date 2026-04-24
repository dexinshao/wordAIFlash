import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// 词库表
export const wordLibraries = sqliteTable("word_libraries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name", { length: 100 }).notNull(),
  description: text("description"),
  wordCount: integer("word_count").default(0),
  category: text("category", { length: 50 }),
  isBuiltin: integer("is_builtin", { mode: "boolean" }).default(true),
  isShared: integer("is_shared", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// 单词表
export const words = sqliteTable("words", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  word: text("word", { length: 100 }).notNull(),
  phonetic: text("phonetic", { length: 200 }),
  pronunciationUrl: text("pronunciation_url", { length: 500 }),
  definitions: text("definitions").$type<Array<{ pos: string; meaning: string }>>(),
  phrases: text("phrases").$type<Array<{ phrase: string; meaning: string }>>(),
  examples: text("examples").$type<Array<{ sentence: string; translation: string }>>(),
  frequencyRank: integer("frequency_rank"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// 词库-单词关联表
export const libraryWords = sqliteTable("library_words", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  libraryId: integer("library_id").notNull().references(() => wordLibraries.id),
  wordId: integer("word_id").notNull().references(() => words.id),
  addedAt: text("added_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex("library_word_idx").on(table.libraryId, table.wordId),
]);

// 学习进度表（单用户模式，userId 固定为 1）
export const wordProgress = sqliteTable("word_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().default(1),
  wordId: integer("word_id").notNull(),
  libraryId: integer("library_id").notNull(),
  masteryScore: real("mastery_score").default(0),
  lastFeedback: text("last_feedback", { length: 20 }),
  reviewCount: integer("review_count").default(0),
  streakCorrect: integer("streak_correct").default(0),
  isMastered: integer("is_mastered", { mode: "boolean" }).default(false),
  lastReviewedAt: text("last_reviewed_at"),
  nextReviewAt: text("next_review_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex("user_word_library_idx").on(table.userId, table.wordId, table.libraryId),
]);
