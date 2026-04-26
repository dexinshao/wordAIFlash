import {
  mysqlTable,
  text,
  int,
  float,
  uniqueIndex,
  boolean,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// 词库表
export const wordLibraries = mysqlTable("word_libraries", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  wordCount: int("word_count").default(0),
  category: varchar("category", { length: 50 }),
  isBuiltin: boolean("is_builtin").default(true),
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

// 单词表
export const words = mysqlTable("words", {
  id: int("id").primaryKey().autoincrement(),
  word: varchar("word", { length: 100 }).notNull(),
  phonetic: varchar("phonetic", { length: 200 }),
  pronunciationUrl: varchar("pronunciation_url", { length: 500 }),
  definitions: text("definitions").$type<Array<{ pos: string; meaning: string }>>(),
  phrases: text("phrases").$type<Array<{ phrase: string; meaning: string }>>(),
  examples: text("examples").$type<Array<{ sentence: string; translation: string }>>(),
  frequencyRank: int("frequency_rank"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 词库-单词关联表
export const libraryWords = mysqlTable("library_words", {
  id: int("id").primaryKey().autoincrement(),
  libraryId: int("library_id").notNull().references(() => wordLibraries.id),
  wordId: int("word_id").notNull().references(() => words.id),
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("library_word_idx").on(table.libraryId, table.wordId),
]);

// 学习进度表（单用户模式，userId 固定为 1）
export const wordProgress = mysqlTable("word_progress", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().default(1),
  wordId: int("word_id").notNull(),
  libraryId: int("library_id").notNull(),
  masteryScore: float("mastery_score").default(0),
  lastFeedback: varchar("last_feedback", { length: 20 }),
  reviewCount: int("review_count").default(0),
  streakCorrect: int("streak_correct").default(0),
  isMastered: boolean("is_mastered").default(false),
  lastReviewedAt: timestamp("last_reviewed_at"),
  nextReviewAt: timestamp("next_review_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("user_word_library_idx").on(table.userId, table.wordId, table.libraryId),
]);
