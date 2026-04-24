import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import { Sparkles, Loader2, X, ArrowRight, XCircle, Plus, FolderOpen, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const suggestions = [
  "我想学习天气相关的词汇",
  "旅行出行常用英语单词",
  "商务会议和谈判词汇",
  "食物和烹饪相关单词",
  "医疗健康类词汇",
  "科技互联网常用词",
];

export default function AiTopicDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input, setInput] = useState("");
  const [step, setStep] = useState<"input" | "generating" | "preview" | "chooseLib" | "creating">("input");
  const [result, setResult] = useState<{ topic: string; words: Array<{ word: string; tags: string[] }> } | null>(null);
  const [error, setError] = useState("");
  const [selectedLibId, setSelectedLibId] = useState<number | null>(null);
  const [excludeLibId, setExcludeLibId] = useState<number | null>(null);
  const navigate = useNavigate();

  const generateMutation = trpc.ai.generateTopicWords.useMutation();
  const createMutation = trpc.ai.createTopicLibrary.useMutation();
  const markMasteredMutation = trpc.ai.markWordsAsMastered.useMutation();
  const findRelatedMutation = trpc.ai.findRelatedLibraries.useMutation();

  // 相关词库数据（生成单词后由 AI 匹配获取）
  const [relatedLibs, setRelatedLibs] = useState<Array<{ id: number; name: string; description: string | null; wordCount: number | null; category: string | null }>>([]);

  // 获取所有词库列表（用于排除词库选择 + "添加到已有词库"选项）
  const { data: allLibs } = trpc.library.list.useQuery();

  const [masteredWords, setMasteredWords] = useState<string[]>([]);
  const [excludeExpanded, setExcludeExpanded] = useState(false); // 排除词库是否展开
  const [excludeLoading, setExcludeLoading] = useState(false); // AI 匹配中

  const handleRemoveWord = (index: number) => {
    if (!result) return;
    const removedWord = result.words[index].word;
    setResult(prev => prev ? { ...prev, words: prev.words.filter((_, idx) => idx !== index) } : null);
    setMasteredWords(prev => [...prev, removedWord]);
    markMasteredMutation.mutate({ wordList: [removedWord] });
  };

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setError("");
    setStep("generating");

    try {
      const data = await generateMutation.mutateAsync({
        prompt: input.trim(),
        excludeLibraryId: excludeLibId ?? undefined,
      });
      setResult(data);
      setStep("preview");
    } catch (err: any) {
      setError(err.message || "生成失败，请重试");
      setStep("input");
    }
  };

  const handleChooseLib = () => {
    if (!result || result.words.length === 0) return;
    setStep("chooseLib");
    // 如果已有 relatedLibs，默认选中第一个相关词库
    if (relatedLibs.length > 0 && selectedLibId === null) {
      setSelectedLibId(relatedLibs[0].id);
    }
  };

  // 点击展开排除词库时，调用 AI 匹配相关词库并设置默认值
  const handleToggleExclude = async () => {
    if (excludeExpanded) {
      setExcludeExpanded(false);
      return;
    }
    setExcludeExpanded(true);
    if (!input.trim()) return;

    setExcludeLoading(true);
    try {
      const relData = await findRelatedMutation.mutateAsync({ topic: input.trim() });
      setRelatedLibs(relData.libraries);
      if (relData.libraries.length > 0 && excludeLibId === null) {
        setExcludeLibId(relData.libraries[0].id);
      }
    } catch {
      // AI 匹配失败不影响使用
    } finally {
      setExcludeLoading(false);
    }
  };

  const handleConfirmCreate = async () => {
    if (!result) return;
    setStep("creating");

    try {
      const data = await createMutation.mutateAsync({
        topic: result.topic,
        wordList: result.words,
        targetLibraryId: selectedLibId ?? undefined,
      });
      onClose();
      navigate(`/study/${data.libraryId}`);
    } catch (err: any) {
      setError(err.message || "创建词库失败");
      setStep(selectedLibId ? "chooseLib" : "preview");
    }
  };

  const handleClose = () => {
    if (step === "generating" || step === "creating") return;
    setInput("");
    setResult(null);
    setError("");
    setMasteredWords([]);
    setSelectedLibId(null);
    setExcludeLibId(null);
    setStep("input");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-black">AI 智能生成词库</h2>
              <p className="text-xs text-zinc-400">
                {step === "input" && "描述你想学习的主题，AI 为你生成专属词库"}
                {step === "preview" && "预览生成的单词，可删除不需要的"}
                {step === "chooseLib" && "选择目标词库"}
                {(step === "generating" || step === "creating") && "请稍候..."}
              </p>
            </div>
          </div>
          {(step === "input" || step === "preview" || step === "chooseLib") && (
            <button onClick={handleClose} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Step 1: Input */}
          {step === "input" && (
            <div className="space-y-4">
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                  placeholder="描述你想学习的主题，例如：&#10;• 我想学习天气相关的词汇&#10;• 旅行出行常用英语单词&#10;• 商务会议和谈判词汇"
                  className="w-full h-28 bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder:text-zinc-300"
                />
              </div>

              <div>
                <p className="text-xs text-zinc-400 mb-2">快速选择：</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-full text-xs text-zinc-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exclude library */}
              {allLibs && allLibs.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={handleToggleExclude}
                    className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
                  >
                    <span className={`transition-transform ${excludeExpanded ? "rotate-90" : ""}`}>▶</span>
                    排除已有词库中的单词（可选）
                    {excludeLibId && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">
                        已选
                      </span>
                    )}
                  </button>

                  {excludeExpanded && (
                    <div className="mt-2 pl-4 border-l-2 border-zinc-200">
                      {excludeLoading ? (
                        <div className="flex items-center gap-2 py-2 text-xs text-zinc-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          AI 正在匹配相关词库...
                        </div>
                      ) : (
                        <>
                          <select
                            value={excludeLibId ?? ""}
                            onChange={(e) => setExcludeLibId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          >
                            <option value="">不排除（生成全新单词）</option>
                            {/* 相关词库排在前面 */}
                            {relatedLibs.length > 0 && (
                              <optgroup label="🤖 AI 推荐相关词库">
                                {relatedLibs.map((lib) => (
                                  <option key={lib.id} value={lib.id}>
                                    {lib.name}（{lib.wordCount ?? 0} 词）
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="所有词库">
                              {allLibs
                                .filter((lib: any) => lib.category !== "mastered")
                                .filter((lib: any) => !relatedLibs.some((rl) => rl.id === lib.id))
                                .map((lib: any) => (
                                  <option key={lib.id} value={lib.id}>
                                    {lib.name}（{lib.wordCount} 词）
                                  </option>
                                ))}
                            </optgroup>
                          </select>
                          {excludeLibId && (
                            <p className="text-xs text-amber-600 mt-1">
                              ⚠️ 将过滤掉该词库中已有的所有单词，只生成新单词
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {masteredWords.length > 0 && (
                <p className="text-xs text-green-600">
                  ✅ 已将 {masteredWords.length} 个单词标记为已掌握，下次生成时将自动跳过
                </p>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={!input.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white h-10"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                生成词库
              </Button>
            </div>
          )}

          {/* Step 2: Generating */}
          {step === "generating" && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-purple-500 animate-pulse" />
                </div>
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin absolute -bottom-1 -right-1" />
              </div>
              <p className="text-sm font-medium text-black">AI 正在生成单词列表...</p>
              <p className="text-xs text-zinc-400 mt-1">根据「{input}」生成相关词汇</p>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full text-xs font-medium text-purple-700">
                  🤖 {result.topic}
                </span>
                <span className="text-xs text-zinc-400">{result.words.length} 个单词</span>
              </div>

              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {result.words.map((item, i) => (
                  <span
                    key={i}
                    className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm hover:border-red-200 hover:bg-red-50 transition-colors"
                  >
                    <span className="text-zinc-700 font-medium">{item.word}</span>
                    {item.tags.length > 0 && (
                      <span className="flex gap-0.5 ml-0.5">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-[10px] font-medium leading-none"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                    <button
                      onClick={() => handleRemoveWord(i)}
                      className="ml-0.5 p-0.5 rounded-full text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="标记已掌握并移除"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>

              {masteredWords.length > 0 && (
                <p className="text-xs text-green-600">
                  ✅ 已将 {masteredWords.length} 个单词标记为已掌握，下次生成时将自动跳过
                </p>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setStep("input"); setResult(null); }}
                  className="flex-1"
                >
                  重新生成
                </Button>
                <Button
                  onClick={handleChooseLib}
                  disabled={result.words.length === 0}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                >
                  <ArrowRight className="w-4 h-4 mr-1.5" />
                  下一步：选择词库
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Choose Library */}
          {step === "chooseLib" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full text-xs font-medium text-purple-700">
                  🤖 {result.topic}
                </span>
                <span className="text-xs text-zinc-400">{result.words.length} 个单词</span>
              </div>

              <p className="text-sm text-zinc-600 font-medium">选择目标词库：</p>

              {/* 创建新词库选项（默认选中） */}
              <button
                onClick={() => setSelectedLibId(null)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                  selectedLibId === null
                    ? "border-purple-400 bg-purple-50"
                    : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black">创建新词库</p>
                    <p className="text-xs text-zinc-400">创建「🤖 {result.topic}」词库</p>
                  </div>
                </div>
              </button>

              {/* 相关词库 */}
              {relatedLibs.length > 0 ? (
                <div>
                  <p className="text-xs text-zinc-400 mb-2">发现相关词库：</p>
                  <div className="space-y-2">
                    {relatedLibs.map((lib) => (
                      <button
                        key={lib.id}
                        onClick={() => setSelectedLibId(lib.id)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          selectedLibId === lib.id
                            ? "border-purple-400 bg-purple-50"
                            : "border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <FolderOpen className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-black">{lib.name}</p>
                              <p className="text-xs text-zinc-400">
                                {lib.wordCount ?? 0} 个单词
                                {lib.description ? ` · ${lib.description}` : ""}
                              </p>
                            </div>
                          </div>
                          {selectedLibId === lib.id && (
                            <span className="text-xs text-purple-600 font-medium">✓ 已选</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* 其他已有词库 */}
              {allLibs && allLibs.length > 0 && (
                <details className="group">
                  <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 py-1">
                    查看所有词库 ({allLibs.length})
                  </summary>
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {allLibs
                      .filter((lib: any) => lib.category !== "mastered")
                      .filter((lib: any) => !relatedLibs.some((rl) => rl.id === lib.id))
                      .map((lib: any) => (
                        <button
                          key={lib.id}
                          onClick={() => setSelectedLibId(lib.id)}
                          className={`w-full text-left p-2.5 rounded-lg border-2 transition-all ${
                            selectedLibId === lib.id
                              ? "border-purple-400 bg-purple-50"
                              : "border-zinc-100 hover:border-zinc-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                              <span className="text-xs font-medium text-zinc-700">{lib.name}</span>
                              <span className="text-[10px] text-zinc-400">{lib.wordCount} 词</span>
                            </div>
                            {selectedLibId === lib.id && (
                              <span className="text-[10px] text-purple-600">✓</span>
                            )}
                          </div>
                        </button>
                      ))}
                  </div>
                </details>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("preview")}
                  className="flex-1"
                >
                  返回预览
                </Button>
                <Button
                  onClick={handleConfirmCreate}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                >
                  <ArrowRight className="w-4 h-4 mr-1.5" />
                  {selectedLibId ? "合并并开始学习" : "创建并开始学习"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Creating */}
          {step === "creating" && result && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-blue-100 rounded-2xl flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                </div>
              </div>
              <p className="text-sm font-medium text-black">
                {selectedLibId ? "正在合并到已有词库..." : "正在创建词库..."}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                {selectedLibId
                  ? `将 ${result.words.length} 个单词合并到目标词库`
                  : `创建「${result.topic}」词库并导入 ${result.words.length} 个单词`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
