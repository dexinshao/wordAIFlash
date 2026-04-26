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

/** 解析单行文本，提取单词、音标、释义、频率排名
 *  支持格式：
 *    abandon [əˈbændən] v. 1. 抛弃，放弃 2. 离弃
 *    abolish [əˈbɒlɪʃ] n. 废除，消除 v. 废除，取消
 *    attribute 1[əˈtrɪbjʊːt] v. 把…归因于
 *    arbitrary ˈɑːbɪtrərɪ /adj. 随意的
 *    the  #1  art. 这；那  （带频率排名）
 *    abandon  (纯单词，无释义)
 */
function parseWordLine(line: string): { word: string; phonetic: string; definitions: Array<{ pos: string; meaning: string }>; frequencyRank?: number } {
  const trimmed = line.trim();
  if (!trimmed) return { word: "", phonetic: "", definitions: [] };

  // 尝试提取 #数字 频率排名（如 #1, #100）
  let frequencyRank: number | undefined;
  const rankMatch = trimmed.match(/#(\d+)/);
  if (rankMatch) {
    frequencyRank = parseInt(rankMatch[1], 10);
  }

  // 格式1: "word [音标] 词性. 释义" （标准格式）
  const richPattern = /^([a-zA-Z'-]+)\s+\[([^\]]*)\]\s+(.+)$/;
  const richMatch = trimmed.match(richPattern);
  if (richMatch) {
    const word = richMatch[1].toLowerCase();
    const phonetic = richMatch[2].trim();
    const rest = richMatch[3].trim();
    return { word, phonetic, definitions: parseDefinitions(rest), frequencyRank };
  }

  // 格式2: "word 数字[音标] 词性. 释义" （如 attribute 1[əˈtrɪbjʊːt]）
  const numBracketPattern = /^([a-zA-Z'-]+)\s+(\d+)\[([^\]]*)\]\s*(.*)$/;
  const numBracketMatch = trimmed.match(numBracketPattern);
  if (numBracketMatch) {
    const word = numBracketMatch[1].toLowerCase();
    const phonetic = numBracketMatch[3].trim();
    const rest = numBracketMatch[4].trim();
    if (rest) return { word, phonetic, definitions: parseDefinitions(rest), frequencyRank };
  }

  // 格式3: "word 音标 /词性. 释义" （音标无方括号，用/分隔）
  const slashPattern = /^([a-zA-Z'-]+)\s+([^\[/]+?)\s*\/\s*(.+)$/;
  const slashMatch = trimmed.match(slashPattern);
  if (slashMatch) {
    const word = slashMatch[1].toLowerCase();
    const phonetic = slashMatch[2].trim();
    const rest = slashMatch[3].trim();
    return { word, phonetic, definitions: parseDefinitions(rest), frequencyRank };
  }

  // 纯单词格式（无音标无释义）
  const pureWord = trimmed.match(/^([a-zA-Z'-]+)$/);
  if (pureWord) {
    return { word: pureWord[1].toLowerCase(), phonetic: "", definitions: [], frequencyRank };
  }

  // 其他格式：尝试提取第一个英文单词作为word，其余作为释义
  const fallbackMatch = trimmed.match(/^([a-zA-Z'-]+)\s+(.+)$/);
  if (fallbackMatch) {
    const word = fallbackMatch[1].toLowerCase();
    const rest = fallbackMatch[2].trim();
    return { word, phonetic: "", definitions: parseDefinitions(rest), frequencyRank };
  }

  return { word: trimmed.toLowerCase(), phonetic: "", definitions: [], frequencyRank };
}

/** 解析释义部分，支持多词性，如 "n. 废除，消除 v. 废除，取消" */
function parseDefinitions(rest: string): Array<{ pos: string; meaning: string }> {
  const definitions: Array<{ pos: string; meaning: string }> = [];
  const posRegex = /\b([a-z]{1,4})\.\s/gi;
  let lastEnd = 0;
  let match: RegExpExecArray | null;

  while ((match = posRegex.exec(rest)) !== null) {
    const pos = match[1] + ".";
    const start = match.index + match[0].length;
    // 确认是词性标记：后面应跟中文或数字
    const afterPos = rest.slice(start);
    if (/^[\d\u4e00-\u9fff]/.test(afterPos) || afterPos.trim() === "") {
      if (lastEnd > 0) {
        definitions[definitions.length - 1].meaning = rest.slice(lastEnd, match.index).trim();
      }
      definitions.push({ pos, meaning: "" });
      lastEnd = start;
    }
  }

  if (definitions.length > 0) {
    definitions[definitions.length - 1].meaning = rest.slice(lastEnd).trim();
  } else if (rest.trim()) {
    definitions.push({ pos: "", meaning: rest.trim() });
  }

  return definitions;
}

export default function Import() {
  const [selectedLibrary, setSelectedLibrary] = useState<string>("");
  const [wordInput, setWordInput] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorResult, setErrorResult] = useState<{ success: number; failed: number; words: string[]; failedWords: string[] } | null>(null);
  const [enrichProgress, setEnrichProgress] = useState<{ progress: number; status: string } | null>(null);
  const [importProgress, setImportProgress] = useState<{ imported: number; total: number; failed: number; isImporting: boolean } | null>(null);
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

    // 解析每行，提取单词、音标、释义
    const parsedWords = limitedLines
      .map(line => parseWordLine(line))
      .filter(item => item.word.length > 0);

    const totalWords = parsedWords.length;
    const BATCH_SIZE = 50;

    // 初始化进度
    setImportProgress({ imported: 0, total: totalWords, failed: 0, isImporting: true });

    let totalSuccess = 0;
    let totalFailed = 0;
    let lastTaskId = "";
    let totalEnriching = 0;

    // 分批导入
    for (let i = 0; i < parsedWords.length; i += BATCH_SIZE) {
      const batch = parsedWords.slice(i, i + BATCH_SIZE);
      try {
        const data = await importMutation.mutateAsync({
          libraryId: libId,
          wordList: batch.map(item => ({
            word: item.word,
            ...(item.phonetic ? { phonetic: item.phonetic } : {}),
            ...(item.definitions.length > 0 ? { definitions: item.definitions } : {}),
            ...(item.frequencyRank != null ? { frequencyRank: item.frequencyRank } : {}),
          })),
        });
        totalSuccess += data.success;
        totalFailed += data.failed;
        totalEnriching += data.enriching;
        lastTaskId = data.taskId;
      } catch {
        totalFailed += batch.length;
      }

      // 更新进度
      setImportProgress({
        imported: totalSuccess + totalFailed,
        total: totalWords,
        failed: totalFailed,
        isImporting: true,
      });
    }

    // 导入完成
    setImportProgress(prev => prev ? { ...prev, isImporting: false } : null);

    // 刷新相关查询
    utils.word.list.invalidate();
    utils.library.list.invalidate();
    utils.progress.getLibraryStats.invalidate();

    // 设置结果
    setResult({
      success: totalSuccess,
      failed: totalFailed,
      importedWords: [],
      failedWords: [],
      enriching: totalEnriching,
      taskId: lastTaskId,
    });

    // 如果有需要后台获取释义的单词，开始轮询进度
    if (totalEnriching > 0 && lastTaskId) {
      setEnrichProgress({ progress: 0, status: "processing" });
      startPolling(lastTaskId);
    }

    setWordInput("");
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
          <p className="text-sm text-zinc-500">将自定义单词批量导入到指定词库，支持纯单词或带音标释义的格式，最多10000个</p>
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
            placeholder={`每行输入一个单词，支持以下格式：\nabandon\nabandon [əˈbændən] v. 抛弃，放弃\nabandon [əˈbændən] v. 1. 抛弃 2. 放弃`}
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value)}
            className="min-h-[200px] bg-zinc-50 border-zinc-200 font-mono text-sm resize-y"
          />
        </div>

        {/* Submit */}
        <Button
          onClick={handleImport}
          disabled={!selectedLibrary || !wordInput.trim() || importProgress?.isImporting}
          className="w-full bg-blue-600 hover:bg-blue-700 h-11"
        >
          {importProgress?.isImporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              正在导入 {importProgress.imported}/{importProgress.total}...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              开始导入
            </>
          )}
        </Button>

        {/* Import progress bar */}
        {importProgress && (
          <div className="rounded-xl p-4 bg-blue-50 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {importProgress.isImporting ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
                <span className="text-sm font-medium text-blue-800">
                  {importProgress.isImporting
                    ? `正在导入... 已处理 ${importProgress.imported}/${importProgress.total}`
                    : `导入完成！共 ${importProgress.imported} 个单词`}
                </span>
              </div>
              <span className="text-xs text-blue-500">
                {importProgress.failed > 0 && `失败 ${importProgress.failed} 个`}
              </span>
            </div>
            <Progress
              value={importProgress.total > 0 ? Math.round((importProgress.imported / importProgress.total) * 100) : 0}
              className="h-2 bg-blue-100"
            />
            <p className="text-xs text-blue-500 mt-2">
              {importProgress.isImporting
                ? "每批 50 个单词逐批写入数据库，请耐心等待。"
                : "所有单词已导入完毕。"}
            </p>
          </div>
        )}

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
            <li>支持 <b>纯单词</b>（如 <code className="bg-zinc-200 px-1 rounded">abandon</code>）和 <b>带音标释义</b>（如 <code className="bg-zinc-200 px-1 rounded">abandon [əˈbændən] v. 抛弃，放弃</code>）两种格式</li>
            <li>带释义的单词会直接使用txt中的释义，无需调用API，导入更快</li>
            <li>纯单词或无释义的单词会由后台异步从有道词典获取中文释义</li>
            <li>每次最多导入 10000 个，已存在的单词将直接关联到目标词库</li>
            <li>专有名词、拼写错误或不常见单词可能无法查到释义</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
