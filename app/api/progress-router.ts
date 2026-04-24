import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { wordProgress, libraryWords } from "@db/schema";
import { eq, and, inArray } from "drizzle-orm";

// Feedback score mapping
const FEEDBACK_SCORES: Record<string, number> = {
  unknown: 0,
  familiar: 0.3,
  well_known: 0.7,
  mastered: 1.0,
};

// EMA learning rate
const ALPHA = 0.4;

function calculateMastery(oldMastery: number, feedback: string): number {
  const feedbackScore = FEEDBACK_SCORES[feedback] ?? 0;

  if (feedback === "unknown") {
    return Math.min(oldMastery * 0.5, 0.2);
  }

  const newMastery = oldMastery * (1 - ALPHA) + feedbackScore * ALPHA;

  if (feedback === "mastered" && oldMastery > 0.8) {
    return 1.0;
  }

  return Math.min(Math.max(newMastery, 0), 1);
}

function calculateNextReview(
  masteryScore: number,
  _reviewCount: number,
  streakCorrect: number
): Date | null {
  if (masteryScore >= 0.95) return null;

  const baseInterval = 4; // hours
  const multiplier = Math.pow(2, streakCorrect);
  const masteryMultiplier = 1 + masteryScore * 2;
  const interval = baseInterval * multiplier * masteryMultiplier;
  const maxInterval = 30 * 24; // 30 days in hours
  const finalInterval = Math.min(interval, maxInterval);

  const nextReview = new Date();
  nextReview.setHours(nextReview.getHours() + finalInterval);
  return nextReview;
}

export const progressRouter = createRouter({
  submitFeedback: publicQuery
    .input(z.object({
      wordId: z.number(),
      libraryId: z.number(),
      feedback: z.enum(["unknown", "familiar", "well_known", "mastered"]),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { wordId, libraryId, feedback } = input;

      // Find existing progress
      const existing = await db
        .select()
        .from(wordProgress)
        .where(
          and(
            eq(wordProgress.wordId, wordId),
            eq(wordProgress.libraryId, libraryId)
          )
        );

      const oldMastery = existing.length > 0
        ? parseFloat(existing[0].masteryScore?.toString() ?? "0")
        : 0;
      const oldReviewCount = existing[0]?.reviewCount ?? 0;
      const oldStreak = existing[0]?.streakCorrect ?? 0;

      const newMastery = calculateMastery(oldMastery, feedback);
      const newReviewCount = oldReviewCount + 1;
      const newStreak =
        feedback === "unknown"
          ? 0
          : feedback === "mastered"
            ? oldStreak + 2
            : oldStreak + 1;
      const isMastered = newMastery >= 0.95;
      const nextReview = calculateNextReview(newMastery, newReviewCount, newStreak);

      if (existing.length > 0) {
        await db
          .update(wordProgress)
          .set({
            masteryScore: newMastery.toFixed(2),
            lastFeedback: feedback,
            reviewCount: newReviewCount,
            streakCorrect: newStreak,
            isMastered,
            lastReviewedAt: new Date().toISOString(),
            nextReviewAt: nextReview?.toISOString() ?? null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(wordProgress.id, existing[0].id));
      } else {
        await db.insert(wordProgress).values({
          wordId,
          libraryId,
          masteryScore: newMastery.toFixed(2),
          lastFeedback: feedback,
          reviewCount: newReviewCount,
          streakCorrect: newStreak,
          isMastered,
          lastReviewedAt: new Date().toISOString(),
          nextReviewAt: nextReview?.toISOString() ?? null,
        });
      }

      return { success: true, newMastery: Math.round(newMastery * 100) / 100 };
    }),

  getLibraryStats: publicQuery
    .input(z.object({ libraryId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const { libraryId } = input;

      // Get all word IDs in library
      const lwResult = await db
        .select({ wordId: libraryWords.wordId })
        .from(libraryWords)
        .where(eq(libraryWords.libraryId, libraryId));

      const totalWords = lwResult.length;
      if (totalWords === 0) {
        return {
          totalWords: 0,
          mastered: 0,
          wellKnown: 0,
          familiar: 0,
          unknown: 0,
          unlearned: 0,
          progress: 0,
        };
      }

      const wordIds = lwResult.map((r: { wordId: number }) => r.wordId);

      // Get all progress for this library
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

      let masteredCount = 0;
      let wellKnownCount = 0;
      let familiarCount = 0;
      let unknownCount = 0;
      let totalScore = 0;

      for (const wordId of wordIds) {
        const p = progressMap.get(wordId);
        if (!p) {
          continue;
        }

        const lastFeedback = p.lastFeedback;
        if (p.isMastered || lastFeedback === "mastered") {
          masteredCount++;
          totalScore += 1;
        } else if (lastFeedback === "well_known") {
          wellKnownCount++;
          totalScore += 0.7;
        } else if (lastFeedback === "familiar") {
          familiarCount++;
          totalScore += 0.3;
        } else if (lastFeedback === "unknown") {
          unknownCount++;
          totalScore += 0;
        }
      }

      const progress = totalWords > 0 ? Math.round((totalScore / totalWords) * 1000) / 10 : 0;

      return {
        totalWords,
        mastered: masteredCount,
        wellKnown: wellKnownCount,
        familiar: familiarCount,
        unknown: unknownCount,
        unlearned: totalWords - progressList.length,
        progress,
      };
    }),

  markAsMastered: publicQuery
    .input(z.object({
      wordId: z.number(),
      libraryId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { wordId, libraryId } = input;

      const existing = await db
        .select()
        .from(wordProgress)
        .where(
          and(
            eq(wordProgress.wordId, wordId),
            eq(wordProgress.libraryId, libraryId)
          )
        );

      if (existing.length > 0) {
        await db
          .update(wordProgress)
          .set({
            masteryScore: "1.00",
            lastFeedback: "mastered",
            isMastered: true,
            streakCorrect: (existing[0].streakCorrect ?? 0) + 2,
            lastReviewedAt: new Date().toISOString(),
            nextReviewAt: null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(wordProgress.id, existing[0].id));
      } else {
        await db.insert(wordProgress).values({
          wordId,
          libraryId,
          masteryScore: "1.00",
          lastFeedback: "mastered",
          isMastered: true,
          streakCorrect: 2,
          lastReviewedAt: new Date().toISOString(),
        });
      }

      return { success: true };
    }),
});
