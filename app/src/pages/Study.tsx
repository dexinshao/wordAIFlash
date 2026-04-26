import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import { Volume2, ArrowLeft, Check, Eye, Zap, Brain, HelpCircle, XCircle, CheckCircle2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type FeedbackType = "unknown" | "familiar" | "well_known" | "mastered";

interface Word {
  id: number;
  word: string;
  phonetic: string | null;
  definitions: Array<{ pos: string; meaning: string }> | null;
  phrases: Array<{ phrase: string; meaning: string }> | null;
  examples: Array<{ sentence: string; translation: string }> | null;
  frequencyRank: number | null;
  createdAt: Date;
}

interface HistoryEntry {
  word: Word;
  feedback: FeedbackType | "mastered_direct";
}

const feedbackOptions: { key: FeedbackType; label: string; color: string; hoverColor: string; icon: React.ReactNode; score: number }[] = [
  { key: "unknown", label: "不认识", color: "bg-red-500", hoverColor: "hover:bg-red-600", icon: <XCircle className="w-4 h-4" />, score: 0 },
  { key: "familiar", label: "有点印象", color: "bg-blue-500", hoverColor: "hover:bg-blue-600", icon: <HelpCircle className="w-4 h-4" />, score: 0.3 },
  { key: "well_known", label: "快记住了", color: "bg-amber-500", hoverColor: "hover:bg-amber-600", icon: <Brain className="w-4 h-4" />, score: 0.7 },
  { key: "mastered", label: "已掌握", color: "bg-green-500", hoverColor: "hover:bg-green-600", icon: <CheckCircle2 className="w-4 h-4" />, score: 1 },
];

export default function Study() {
  const { libraryId } = useParams<{ libraryId: string }>();
  const navigate = useNavigate();
  const libId = parseInt(libraryId ?? "1");

  const { data: library } = trpc.library.getById.useQuery({ id: libId });
  const utils = trpc.useUtils();

  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const prefetchedWord = useRef<Word | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyCount, setStudyCount] = useState(0);
  const [sessionStats, setSessionStats] = useState({ studied: 0, mastered: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // 历史记录：用于"上一个"功能
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);

  const prefetchNextWord = useCallback(async (excludeWordId?: number) => {
    try {
      const word = await utils.word.getNextFlashcard.fetch({ libraryId: libId, excludeWordId });
      prefetchedWord.current = word;
    } catch {
      prefetchedWord.current = null;
    }
  }, [libId, utils]);

  const fetchNextWord = useCallback(async () => {
    let wordId: number | undefined;
    // 优先使用预取的结果
    if (prefetchedWord.current) {
      const word = prefetchedWord.current;
      prefetchedWord.current = null;
      if (!word) {
        setIsComplete(true);
        return;
      }
      wordId = word.id;
      setCurrentWord(word);
      setIsFlipped(false);
    } else {
      try {
        const word = await utils.word.getNextFlashcard.fetch({ libraryId: libId });
        if (!word) {
          setIsComplete(true);
          return;
        }
        wordId = word.id;
        setCurrentWord(word);
        setIsFlipped(false);
      } catch {
        setIsComplete(true);
        return;
      }
    }
    // 立即预取下一张，排除当前展示的单词
    prefetchNextWord(wordId);
  }, [libId, utils, prefetchNextWord]);

  // Fetch first word on mount
  useEffect(() => {
    fetchNextWord();
  }, [fetchNextWord]);

  const submitFeedback = trpc.progress.submitFeedback.useMutation({
    onSuccess: () => {
      utils.progress.getLibraryStats.invalidate({ libraryId: libId });
    },
  });

  const markAsMastered = trpc.progress.markAsMastered.useMutation({
    onSuccess: () => {
      utils.progress.getLibraryStats.invalidate({ libraryId: libId });
    },
  });

  const handleFlip = () => {
    if (!isAnimating) {
      setIsFlipped(true);
    }
  };

  const handleFeedback = async (feedback: FeedbackType) => {
    if (!currentWord || isAnimating) return;
    setIsAnimating(true);

    await submitFeedback.mutateAsync({
      wordId: currentWord.id,
      libraryId: libId,
      feedback,
    });

    // 记入历史
    setHistory(prev => [...prev, { word: currentWord, feedback }]);

    setSessionStats(prev => ({
      studied: prev.studied + 1,
      mastered: feedback === "mastered" ? prev.mastered + 1 : prev.mastered,
    }));

    // Slide out, then show next card directly
    setTimeout(() => {
      setStudyCount(prev => prev + 1);
      setIsReviewing(false);
      setIsFlipped(false);
      fetchNextWord();
      setIsAnimating(false);
    }, 300);
  };

  const handleMastered = async () => {
    if (!currentWord || isAnimating) return;
    setIsAnimating(true);

    await markAsMastered.mutateAsync({
      wordId: currentWord.id,
      libraryId: libId,
    });

    // 记入历史
    setHistory(prev => [...prev, { word: currentWord, feedback: "mastered_direct" }]);

    setSessionStats(prev => ({
      studied: prev.studied + 1,
      mastered: prev.mastered + 1,
    }));

    setTimeout(() => {
      setStudyCount(prev => prev + 1);
      setIsReviewing(false);
      setIsFlipped(false);
      fetchNextWord();
      setIsAnimating(false);
    }, 300);
  };

  // 回到上一个单词，重新选择反馈
  const handleGoBack = () => {
    if (history.length === 0 || isAnimating) return;

    const prev = history[history.length - 1];
    setCurrentWord(prev.word);
    setIsFlipped(true); // 回到上一个时直接显示释义，方便重新选择
    setIsReviewing(true);
    setHistory(h => h.slice(0, -1));
    // 回退后预取的下一张可能不再准确，清除并重新预取
    prefetchedWord.current = null;
    prefetchNextWord(prev.word.id);
    setStudyCount(c => Math.max(0, c - 1));

    // 回退统计
    if (prev.feedback === "mastered" || prev.feedback === "mastered_direct") {
      setSessionStats(s => ({ studied: Math.max(0, s.studied - 1), mastered: Math.max(0, s.mastered - 1) }));
    } else {
      setSessionStats(s => ({ ...s, studied: Math.max(0, s.studied - 1) }));
    }
  };

  // 重新提交反馈（回退后）
  const handleReFeedback = async (feedback: FeedbackType) => {
    if (!currentWord || isAnimating) return;
    setIsAnimating(true);

    await submitFeedback.mutateAsync({
      wordId: currentWord.id,
      libraryId: libId,
      feedback,
    });

    setSessionStats(prev => ({
      studied: prev.studied + 1,
      mastered: feedback === "mastered" ? prev.mastered + 1 : prev.mastered,
    }));

    setTimeout(async () => {
      setStudyCount(prev => prev + 1);
      setIsReviewing(false);
      await fetchNextWord();
      setIsAnimating(false);
    }, 300);
  };

  const playPronunciation = (word: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  if (isComplete) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-black mb-2">本轮学习完成！</h2>
          <p className="text-zinc-500">你已完成本轮学习目标</p>
        </div>

        <div className="bg-zinc-50 rounded-xl p-6 mb-8 max-w-sm mx-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{sessionStats.studied}</p>
              <p className="text-sm text-zinc-500">学习单词</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{sessionStats.mastered}</p>
              <p className="text-sm text-zinc-500">新掌握</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <Button onClick={() => { setIsComplete(false); fetchNextWord(); }} className="bg-blue-600 hover:bg-blue-700">
            <Zap className="w-4 h-4 mr-2" />
            继续学习
          </Button>
          <Link to="/">
            <Button variant="outline">返回词库</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-200 rounded w-48 mx-auto mb-4" />
          <div className="h-64 bg-zinc-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </button>
          <div>
            <h2 className="font-semibold text-black text-sm">{library?.name}</h2>
            <p className="text-xs text-zinc-400">第 {studyCount + 1} 张卡片</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 上一个按钮 */}
          {history.length > 0 && !isAnimating && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
              className="text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 text-xs"
            >
              <Undo2 className="w-3.5 h-3.5 mr-1" />
              上一个
            </Button>
          )}
          {!isReviewing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMastered}
              className="text-green-600 hover:text-green-700 hover:bg-green-50 text-xs"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              标记已掌握
            </Button>
          )}
        </div>
      </div>

      {/* 回退提示 */}
      {isReviewing && (
        <div className="mb-3 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-center">
          <span className="text-xs text-amber-700">正在回顾上一个单词，请重新选择掌握程度</span>
        </div>
      )}

      {/* Flashcard */}
      <div className="perspective-[1000px] mb-6">
        <div
          className={`relative w-full h-[360px] md:h-[400px] cursor-pointer preserve-3d ${
            isFlipped && !isAnimating ? "rotate-y-180" : ""
          } ${isAnimating ? (isFlipped ? "-translate-x-full opacity-0" : "translate-x-full opacity-0") : ""} ${
            !isAnimating ? "transition-transform duration-600" : ""
          }`}
          onClick={handleFlip}
          style={{ transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)" }}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden">
            <div className="w-full h-full bg-zinc-800 rounded-2xl flex flex-col items-center justify-center p-8 shadow-lg">
              <h3 className="text-4xl md:text-5xl font-bold text-white mb-3">
                {currentWord.word}
              </h3>
              <p className="text-zinc-400 text-lg mb-2">{currentWord.phonetic}</p>
              {(currentWord.frequencyRank != null && currentWord.frequencyRank > 0 && currentWord.frequencyRank < 99999) && (
                <span className="inline-block px-2.5 py-0.5 bg-zinc-700 text-zinc-300 text-xs rounded-full mb-4">
                  词频排名 #{currentWord.frequencyRank}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playPronunciation(currentWord.word);
                }}
                className="p-3 rounded-full bg-zinc-700 hover:bg-zinc-600 transition-colors mb-4"
              >
                <Volume2 className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <Eye className="w-4 h-4" />
                <span>点击翻转查看释义</span>
              </div>
            </div>
          </div>

          {/* Back */}
          <div className="absolute inset-0 backface-hidden rotate-y-180">
            <div className="w-full h-full bg-white border border-zinc-200 rounded-2xl flex flex-col p-6 md:p-8 shadow-lg overflow-y-auto">
              {/* Word header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold text-black">{currentWord.word}</h3>
                    {(currentWord.frequencyRank != null && currentWord.frequencyRank > 0 && currentWord.frequencyRank < 99999) && (
                      <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                        #{currentWord.frequencyRank}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-400">{currentWord.phonetic}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playPronunciation(currentWord.word);
                  }}
                  className="p-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 transition-colors"
                >
                  <Volume2 className="w-4 h-4 text-zinc-600" />
                </button>
              </div>

              {/* Definitions */}
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">释义</h4>
                {currentWord.definitions?.map((def: any, i: number) => (
                  <div key={i} className="mb-1">
                    <span className="text-blue-600 font-medium text-sm">{def.pos}</span>{" "}
                    <span className="text-black text-sm">{def.meaning}</span>
                  </div>
                ))}
              </div>

              {/* Phrases */}
              {currentWord.phrases && currentWord.phrases.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">常见搭配</h4>
                  {currentWord.phrases.map((phrase: any, i: number) => (
                    <div key={i} className="mb-1.5">
                      <span className="text-sm font-medium text-zinc-700">{phrase.phrase}</span>
                      <span className="text-zinc-400 mx-2">—</span>
                      <span className="text-sm text-zinc-500">{phrase.meaning}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Examples */}
              {currentWord.examples && currentWord.examples.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">例句</h4>
                  {currentWord.examples.map((ex: any, i: number) => (
                    <div key={i} className="mb-2">
                      <p className="text-sm text-zinc-700 italic">"{ex.sentence}"</p>
                      <p className="text-sm text-zinc-400">{ex.translation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback buttons (show when flipped) */}
      {isFlipped && (
        <div className="grid grid-cols-4 gap-2 md:gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {feedbackOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => isReviewing ? handleReFeedback(option.key) : handleFeedback(option.key)}
              disabled={isAnimating}
              className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-white font-medium text-xs md:text-sm transition-all ${option.color} ${option.hoverColor} disabled:opacity-50 hover:scale-105 active:scale-95`}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* View answer button (only show when not flipped and not reviewing) */}
      {!isFlipped && !isReviewing && (
        <div className="flex items-center justify-center gap-3 animate-in fade-in duration-300">
          <Button
            onClick={handleFlip}
            variant="outline"
            className="border-zinc-300 text-zinc-700 hover:bg-zinc-50 px-8"
          >
            <Eye className="w-4 h-4 mr-2" />
            查看答案
          </Button>
          <Button
            onClick={handleMastered}
            className="bg-green-500 hover:bg-green-600 text-white px-6"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            已掌握
          </Button>
        </div>
      )}

      {/* Session stats */}
      {sessionStats.studied > 0 && (
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-zinc-400">
          <span>本轮已学: {sessionStats.studied}</span>
          <span>新掌握: {sessionStats.mastered}</span>
          {history.length > 0 && (
            <span className="text-zinc-300">|</span>
          )}
          {history.length > 0 && (
            <span>可回退 {history.length} 个</span>
          )}
        </div>
      )}
    </div>
  );
}
