import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import { ArrowLeft, Upload, Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Library {
  id: number;
  name: string;
  description: string | null;
  wordCount: number | null;
  category: string | null;
}

interface ImportResult {
  success: number;
  failed: number;
  words: string[];
  failedWords: string[];
  enriching: number;
  taskId: string;
}

export default function Import() {
  const [selectedLibrary, setSelectedLibrary] = useState<string>("");
  const [wordInput, setWordInput] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorResult, setErrorResult] = useState<{ success: number; failed: number; words: string[]; failedWords: string[] } | null>(null);
  const [enrichProgress, setEnrichProgress] = useState<{ progress: number; status: string } | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: libraries } = trpc.library.list.useQuery();
  const utils = trpc.useUtils();

  const importMutation = trpc.word.import.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setErrorResult(null);
      setWordInput("");
      // Invalidate related queries
      utils.word.list.invalidate();
      utils.library.list.invalidate();
      utils.progress.getLibraryStats.invalidate();

      // 如果有需要后台获取释义的单词，开始轮询进度
      if (data.enriching > 0) {
        setEnrichProgress({ progress: 0, status: "processing" });
        startPolling(data.taskId);
      } else {
        setEnrichProgress(null);
      }
    },
    onError: () => {
      const lines = wordInput.trim().split(/\n+/).map(l => l.trim()).filter(Boolean);
      setErrorResult({ success: 0, failed: lines.length, words: [], failedWords: lines });
      setResult(null);
    },
  });

  // 轮询后台释义获取进度
  const startPolling = (taskId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const status = await utils.word.getImportStatus.fetch({ taskId });
        if (!status) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          return;
        }
        setEnrichProgress({ progress: status.progress, status: status.status });
        if (status.status === "completed") {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          // 刷新单词列表以获取最新释义
          utils.word.list.invalidate();
        }
      } catch {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      }
    }, 1500);
  };

  // 组件卸载时清除轮询
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const lineCount = wordInput.trim() ? wordInput.trim().split(/\n+/).filter(Boolean).length : 0;

  const handleImport = async () => {
    if (!selectedLibrary || !wordInput.trim()) return;

    setResult(null);
    setErrorResult(null);
    setEnrichProgress(null);

    const lines = wordInput.trim().split(/\n+/).map(l => l.trim()).filter(Boolean);
    const limitedLines = lines.slice(0, 10000);
    const libId = parseInt(selectedLibrary);

    await importMutation.mutateAsync({
      libraryId: libId,
      wordList: limitedLines,
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link to="/" className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-zinc-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-black">导入单词</h1>
          <p className="text-sm text-zinc-500">将自定义单词批量导入到指定词库，每行一个单词，最多10000个</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Library select */}
        <div>
          <label className="block text-sm font-medium text-black mb-2">目标词库</label>
          <Select value={selectedLibrary} onValueChange={setSelectedLibrary}>
            <SelectTrigger className="bg-zinc-50 border-zinc-200">
              <SelectValue placeholder="选择一个词库" />
            </SelectTrigger>
            <SelectContent>
              {libraries?.map((lib: Library) => (
                <SelectItem key={lib.id} value={lib.id.toString()}>
                  {lib.name} ({lib.wordCount} 词)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Word input */}
        <div>
          <label className="block text-sm font-medium text-black mb-2">
            单词列表
            {lineCount > 0 && (
              <span className="text-zinc-400 font-normal ml-2">({lineCount} 行{lineCount > 10000 ? "，将截取前10000个" : ""})</span>
            )}
          </label>
          <Textarea
            placeholder={`每行输入一个单词，例如：\nabandon\nability\nable\nabsence`}
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value)}
            className="min-h-[200px] bg-zinc-50 border-zinc-200 font-mono text-sm resize-y"
          />
        </div>

        {/* Submit */}
        <Button
          onClick={handleImport}
          disabled={!selectedLibrary || !wordInput.trim() || importMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 h-11"
        >
          {importMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              正在导入...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              开始导入
            </>
          )}
        </Button>

        {/* Import result */}
        {result && (
          <div className={`rounded-xl p-4 ${result.failed === 0 ? "bg-green-50 border border-green-200" : result.success > 0 ? "bg-amber-50 border border-amber-200" : "bg-red-50 border border-red-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.failed === 0 ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600" />
              )}
              <span className={`font-medium ${result.failed === 0 ? "text-green-800" : result.success > 0 ? "text-amber-800" : "text-red-800"}`}>
                {result.failed === 0
                  ? `成功导入 ${result.success} 个单词`
                  : `导入完成：成功 ${result.success} 个，失败 ${result.failed} 个`}
              </span>
            </div>

            {/* Successfully imported words */}
            {result.importedWords && result.importedWords.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-green-700 mb-1.5">成功导入的单词：</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.importedWords.map((w, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white rounded text-xs text-green-700 border border-green-200">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Failed words */}
            {result.failedWords && result.failedWords.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-red-600 mb-1.5">失败的单词：</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.failedWords.map((w, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white rounded text-xs text-red-500 border border-red-200">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error result (mutation error) */}
        {errorResult && (
          <div className="rounded-xl p-4 bg-red-50 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-800">导入失败</span>
            </div>
            <div className="mt-3">
              <p className="text-xs font-medium text-red-600 mb-1.5">失败的单词：</p>
              <div className="flex flex-wrap gap-1.5">
                {errorResult.failedWords.map((w, i) => (
                  <span key={i} className="px-2 py-0.5 bg-white rounded text-xs text-red-500 border border-red-200">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Background enrichment progress */}
        {enrichProgress && (
          <div className="rounded-xl p-4 bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              {enrichProgress.status === "processing" ? (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              ) : (
                <Check className="w-4 h-4 text-blue-600" />
              )}
              <span className="text-sm font-medium text-blue-800">
                {enrichProgress.status === "processing"
                  ? `正在获取释义... ${enrichProgress.progress}%`
                  : `释义获取完成`}
              </span>
            </div>
            <Progress value={enrichProgress.progress} className="h-2 bg-blue-100" />
            <p className="text-xs text-blue-500 mt-2">
              {enrichProgress.status === "processing"
                ? "后台正在从有道词典查询中文释义，完成后自动刷新。你可以继续其他操作。"
                : "所有单词释义已获取完毕，刷新单词列表即可查看。"}
            </p>
          </div>
        )}

        {/* Tips */}
        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
          <h3 className="font-medium text-sm text-black mb-2">导入说明</h3>
          <ul className="text-sm text-zinc-500 space-y-1">
            <li>单词会先快速入库，释义由后台异步从有道词典获取（中文释义）</li>
            <li>每行输入一个单词，每次最多导入 10000 个</li>
            <li>已存在的单词将直接关联到目标词库，不会重复创建</li>
            <li>专有名词、拼写错误或不常见单词可能无法查到释义</li>
            <li>释义获取失败不影响单词导入，可稍后在学习时查看</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
