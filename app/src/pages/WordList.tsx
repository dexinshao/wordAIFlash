import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import { ArrowLeft, Search, Volume2, CheckCircle2, Brain, HelpCircle, XCircle, Circle, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode; score: number }> = {
  mastered: { label: "已掌握", color: "bg-green-500 text-white", icon: <CheckCircle2 className="w-3 h-3" />, score: 1 },
  well_known: { label: "快记住了", color: "bg-amber-500 text-white", icon: <Brain className="w-3 h-3" />, score: 0.7 },
  familiar: { label: "有点印象", color: "bg-blue-500 text-white", icon: <HelpCircle className="w-3 h-3" />, score: 0.3 },
  unknown: { label: "不认识", color: "bg-red-500 text-white", icon: <XCircle className="w-3 h-3" />, score: 0 },
};

export default function WordList() {
  const { libraryId } = useParams<{ libraryId: string }>();
  const libId = parseInt(libraryId ?? "1");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<string>("all");
  const pageSize = 200;

  const { data: library } = trpc.library.getById.useQuery({ id: libId });
  const { data: wordData, isLoading } = trpc.word.list.useQuery({
    libraryId: libId,
    search: search || undefined,
    page,
    pageSize,
    filter: filter as any,
  });
  const { data: stats } = trpc.progress.getLibraryStats.useQuery({ libraryId: libId });
  const { data: missingInfo } = trpc.word.getMissingCount.useQuery({ libraryId: libId });
  const utils = trpc.useUtils();

  const [enrichStatus, setEnrichStatus] = useState<{ taskId: string; total: number; progress: number; status: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enrichMutation = trpc.word.enrichMissing.useMutation({
    onSuccess: (data) => {
      if (data.total > 0 && data.taskId) {
        setEnrichStatus({ taskId: data.taskId, total: data.total, progress: 0, status: "processing" });
        startPolling(data.taskId);
      }
    },
  });

  const submitFeedback = trpc.progress.submitFeedback.useMutation({
    onSuccess: () => {
      utils.word.list.invalidate({ libraryId: libId });
      utils.progress.getLibraryStats.invalidate({ libraryId: libId });
    },
  });

  const markAsMastered = trpc.progress.markAsMastered.useMutation({
    onSuccess: () => {
      utils.word.list.invalidate({ libraryId: libId });
      utils.progress.getLibraryStats.invalidate({ libraryId: libId });
    },
  });

  const handleChangeStatus = async (wordId: number, newStatus: string) => {
    if (newStatus === "mastered") {
      await markAsMastered.mutateAsync({ wordId, libraryId: libId });
    } else if (newStatus === "unlearned") {
      // 无需操作，清除进度即可（暂不实现删除）
    } else {
      await submitFeedback.mutateAsync({
        wordId,
        libraryId: libId,
        feedback: newStatus as "unknown" | "familiar" | "well_known" | "mastered",
      });
    }
  };

  const startPolling = (taskId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const s = await utils.word.getImportStatus.fetch({ taskId });
        if (!s) { if (pollRef.current) clearInterval(pollRef.current); return; }
        setEnrichStatus(prev => prev ? { ...prev, progress: s.progress, status: s.status } : null);
        if (s.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          utils.word.list.invalidate({ libraryId: libId });
          utils.word.getMissingCount.invalidate({ libraryId: libId });
        }
      } catch { if (pollRef.current) clearInterval(pollRef.current); }
    }, 2000);
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const playPronunciation = (word: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  const getStatus = (progress: any) => {
    if (!progress) return null;
    if (progress.isMastered || progress.lastFeedback === "mastered") return "mastered";
    return progress.lastFeedback;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-zinc-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-black">{library?.name} - 单词列表</h1>
          <p className="text-sm text-zinc-400">{wordData?.total ?? 0} 个单词</p>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && stats.totalWords > 0 && (
        <div className="bg-zinc-50 rounded-xl p-4 mb-6 border border-zinc-100">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <button
              onClick={() => { setFilter(filter === "mastered" ? "all" : "mastered"); setPage(1); }}
              className={`text-center p-2 rounded-lg transition-colors ${filter === "mastered" ? "bg-green-100 ring-1 ring-green-300" : "hover:bg-zinc-100"}`}
            >
              <p className="text-lg font-bold text-green-600">{stats.mastered}</p>
              <p className="text-xs text-zinc-500">已掌握 (1分)</p>
            </button>
            <button
              onClick={() => { setFilter(filter === "well_known" ? "all" : "well_known"); setPage(1); }}
              className={`text-center p-2 rounded-lg transition-colors ${filter === "well_known" ? "bg-amber-100 ring-1 ring-amber-300" : "hover:bg-zinc-100"}`}
            >
              <p className="text-lg font-bold text-amber-600">{stats.wellKnown}</p>
              <p className="text-xs text-zinc-500">快记住了 (0.7分)</p>
            </button>
            <button
              onClick={() => { setFilter(filter === "familiar" ? "all" : "familiar"); setPage(1); }}
              className={`text-center p-2 rounded-lg transition-colors ${filter === "familiar" ? "bg-blue-100 ring-1 ring-blue-300" : "hover:bg-zinc-100"}`}
            >
              <p className="text-lg font-bold text-blue-600">{stats.familiar}</p>
              <p className="text-xs text-zinc-500">有点印象 (0.3分)</p>
            </button>
            <button
              onClick={() => { setFilter(filter === "unknown" ? "all" : "unknown"); setPage(1); }}
              className={`text-center p-2 rounded-lg transition-colors ${filter === "unknown" ? "bg-red-100 ring-1 ring-red-300" : "hover:bg-zinc-100"}`}
            >
              <p className="text-lg font-bold text-red-500">{stats.unknown}</p>
              <p className="text-xs text-zinc-500">不认识 (0分)</p>
            </button>
            <button
              onClick={() => { setFilter(filter === "unlearned" ? "all" : "unlearned"); setPage(1); }}
              className={`text-center p-2 rounded-lg border-l border-zinc-200 transition-colors ${filter === "unlearned" ? "bg-zinc-200 ring-1 ring-zinc-300" : "hover:bg-zinc-100"}`}
            >
              <p className="text-lg font-bold text-zinc-600">{stats.unlearned}</p>
              <p className="text-xs text-zinc-500">未学习</p>
            </button>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-zinc-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-blue-500 via-amber-500 to-green-500 rounded-full transition-all"
                style={{ width: `${Math.max(stats.progress, 2)}%` }}
              />
            </div>
            <span className="text-sm font-bold text-blue-600 shrink-0">{stats.progress}%</span>
          </div>
        </div>
      )}

      {/* Active filter indicator */}
      {filter !== "all" && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-zinc-500">
            当前筛选：
            {filter === "mastered" && "已掌握"}
            {filter === "well_known" && "快记住了"}
            {filter === "familiar" && "有点印象"}
            {filter === "unknown" && "不认识"}
            {filter === "unlearned" && "未学习"}
            {" "}（{wordData?.total ?? 0} 个）
          </span>
          <button
            onClick={() => { setFilter("all"); setPage(1); }}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            清除筛选
          </button>
        </div>
      )}

      {/* Search + Enrich */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            placeholder="搜索单词..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 bg-zinc-50 border-zinc-200"
          />
        </div>
        {missingInfo && missingInfo.missing > 0 && !enrichStatus && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => enrichMutation.mutate({ libraryId: libId })}
            disabled={enrichMutation.isPending}
            className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            {enrichMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4 mr-1.5" />
            )}
            {enrichMutation.isPending ? "启动中..." : `补全释义 (${missingInfo.missing})`}
          </Button>
        )}
      </div>

      {/* Enrich progress */}
      {enrichStatus && (
        <div className="rounded-xl p-3 mb-4 bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            {enrichStatus.status === "processing" ? (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
            )}
            <span className="text-sm font-medium text-blue-800">
              {enrichStatus.status === "processing"
                ? `正在补全释义... ${enrichStatus.progress}%`
                : `释义补全完成`}
            </span>
          </div>
          <Progress value={enrichStatus.progress} className="h-1.5 bg-blue-100" />
          <p className="text-xs text-blue-500 mt-1">
            {enrichStatus.status === "processing"
              ? `已处理 ${Math.round(enrichStatus.total * enrichStatus.progress / 100)} / ${enrichStatus.total} 个单词`
              : `共补全 ${enrichStatus.total} 个单词的释义`}
          </p>
        </div>
      )}

      {/* Word List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {wordData?.words.map((word: any) => {
            const status = getStatus(word.progress);
            const statusInfo = status ? statusConfig[status] : null;

            return (
              <div
                key={word.id}
                className="flex items-center gap-4 p-3 bg-white border border-zinc-100 rounded-lg hover:bg-zinc-50 transition-colors group"
              >
                {/* Word info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-black">{word.word}</span>
                    <span className="text-zinc-400 text-sm">{word.phonetic}</span>
                    {/* 释义状态标签 */}
                    {(!word.definitions || word.definitions.length === 0 ||
                      (word.definitions.length === 1 && word.definitions[0]?.meaning === "释义获取中...")) && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-600">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        释义缺失
                      </span>
                    )}
                    <button
                      onClick={() => playPronunciation(word.word)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-200 rounded transition-all"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                  </div>
                  <p className="text-sm text-zinc-500 truncate">
                    {word.definitions?.map((d: any) => `${d.pos} ${d.meaning}`).join("；")}
                  </p>
                </div>

                {/* Status badge - clickable dropdown */}
                <div className="flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${statusInfo ? statusInfo.color : "bg-zinc-100 text-zinc-400"}`}>
                        {statusInfo ? statusInfo.icon : <Circle className="w-3 h-3" />}
                        {statusInfo ? statusInfo.label : "未学习"}
                        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      {Object.entries(statusConfig).map(([key, cfg]) => (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => handleChangeStatus(word.id, key)}
                          className={status === key ? "bg-zinc-100" : ""}
                        >
                          <span className="mr-2">{cfg.icon}</span>
                          {cfg.label}
                          {status === key && <span className="ml-auto text-[10px] text-zinc-400">✓</span>}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}

          {wordData?.words.length === 0 && (
            <div className="text-center py-12 text-zinc-400">
              <p>没有找到匹配的单词</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {wordData && wordData.total > pageSize && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-zinc-500">
            第 {page} / {Math.ceil(wordData.total / pageSize)} 页（共 {wordData.total} 个）
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(wordData.total / pageSize)}
            onClick={() => setPage(p => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
