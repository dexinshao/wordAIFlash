import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import { BookOpen, GraduationCap, Languages, Globe, Building2, School, BarChart3, Play, List, Sparkles, Trash2, X, FolderOpen, Merge } from "lucide-react";
import { Button } from "@/components/ui/button";
import AiTopicDialog from "@/components/AiTopicDialog";

interface Library {
  id: number;
  name: string;
  description: string | null;
  wordCount: number | null;
  category: string | null;
  isBuiltin: number | null;
}

const categoryIcons: Record<string, React.ReactNode> = {
  cet4: <GraduationCap className="w-5 h-5" />,
  cet6: <GraduationCap className="w-5 h-5" />,
  toefl: <Languages className="w-5 h-5" />,
  ielts: <Globe className="w-5 h-5" />,
  tem8: <BookOpen className="w-5 h-5" />,
  bec: <Building2 className="w-5 h-5" />,
  high_school: <School className="w-5 h-5" />,
  top10000: <BarChart3 className="w-5 h-5" />,
  ai_topic: <Sparkles className="w-5 h-5" />,
  mastered: <BookOpen className="w-5 h-5" />,
};

const categoryColors: Record<string, string> = {
  cet4: "bg-emerald-50 text-emerald-600 border-emerald-200",
  cet6: "bg-blue-50 text-blue-600 border-blue-200",
  toefl: "bg-violet-50 text-violet-600 border-violet-200",
  ielts: "bg-amber-50 text-amber-600 border-amber-200",
  tem8: "bg-rose-50 text-rose-600 border-rose-200",
  bec: "bg-slate-50 text-slate-600 border-slate-200",
  high_school: "bg-cyan-50 text-cyan-600 border-cyan-200",
  top10000: "bg-orange-50 text-orange-600 border-orange-200",
  ai_topic: "bg-gradient-to-br from-purple-50 to-blue-50 text-purple-600 border-purple-200",
  mastered: "bg-green-50 text-green-600 border-green-200",
};

export default function Home() {
  const utils = trpc.useUtils();
  const { data: libraries, isLoading } = trpc.library.list.useQuery();
  const [aiOpen, setAiOpen] = useState(false);

  // 删除对话框状态
  const [deleteTarget, setDeleteTarget] = useState<Library | null>(null);
  const [selectedMergeId, setSelectedMergeId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteMutation = trpc.library.delete.useMutation({
    onSuccess: () => {
      utils.library.list.invalidate();
      setDeleteTarget(null);
      setSelectedMergeId(null);
    },
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync({
        id: deleteTarget.id,
        mergeToLibraryId: selectedMergeId ?? undefined,
      });
    } catch (err: any) {
      alert(err.message || "删除失败");
      setIsDeleting(false);
    }
  };

  const otherLibraries = libraries?.filter(
    (lib: Library) => lib.id !== deleteTarget?.id && lib.category !== "mastered"
  ) ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-black mb-3">
          选择你的词库
        </h1>
        <p className="text-zinc-500 text-base md:text-lg">
          内置常见单词库，涵盖四六级、托福、雅思、考研等考试词汇
        </p>
      </div>

      {/* AI Topic Banner */}
      <button
        onClick={() => setAiOpen(true)}
        className="w-full mb-8 p-5 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 rounded-2xl text-left hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">AI 智能生成词库</h3>
              <p className="text-white/80 text-sm">告诉 AI 你想学什么，自动生成专属词库并开始学习</p>
            </div>
          </div>
          <div className="p-2 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors">
            <Play className="w-5 h-5 text-white" />
          </div>
        </div>
      </button>

      {/* Library Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-36 bg-zinc-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {libraries?.map((lib: Library) => (
            <div
              key={lib.id}
              className="group bg-zinc-50 border border-zinc-200 rounded-xl p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg border ${categoryColors[lib.category ?? ""] ?? "bg-zinc-50 text-zinc-600 border-zinc-200"}`}>
                    {categoryIcons[lib.category ?? ""] ?? <BookOpen className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-black text-base">{lib.name}</h3>
                    <p className="text-zinc-500 text-sm">{lib.wordCount} 个单词</p>
                  </div>
                </div>
                {/* 删除按钮（仅非内置词库显示） */}
                {!lib.isBuiltin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(lib); setSelectedMergeId(null); }}
                    className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    title="删除词库"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <p className="text-zinc-500 text-sm mb-4">{lib.description}</p>

              <div className="flex gap-2">
                <Link to={`/study/${lib.id}`} className="flex-1">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm h-9">
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    开始学习
                  </Button>
                </Link>
                <Link to={`/words/${lib.id}`}>
                  <Button variant="outline" className="text-sm h-9 border-zinc-200">
                    <List className="w-3.5 h-3.5 mr-1.5" />
                    查看单词
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </div>
                <h2 className="font-bold text-black">删除词库</h2>
              </div>
              {!isDeleting && (
                <button onClick={() => setDeleteTarget(null)} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <p className="text-sm text-zinc-600">
                确定要删除「<span className="font-medium text-black">{deleteTarget.name}</span>」吗？
                该词库包含 <span className="font-medium">{deleteTarget.wordCount}</span> 个单词。
              </p>

              {/* 合并选项 */}
              {otherLibraries.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-400 mb-2">是否将单词合并到其他词库？（可选）</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {/* 不合并选项 */}
                    <button
                      onClick={() => setSelectedMergeId(null)}
                      className={`w-full text-left p-2.5 rounded-lg border-2 transition-all text-sm ${
                        selectedMergeId === null
                          ? "border-red-300 bg-red-50"
                          : "border-zinc-100 hover:border-zinc-200"
                      }`}
                    >
                      <span className="text-zinc-600">直接删除（不合并单词）</span>
                    </button>
                    {otherLibraries.map((lib: Library) => (
                      <button
                        key={lib.id}
                        onClick={() => setSelectedMergeId(lib.id)}
                        className={`w-full text-left p-2.5 rounded-lg border-2 transition-all text-sm ${
                          selectedMergeId === lib.id
                            ? "border-purple-400 bg-purple-50"
                            : "border-zinc-100 hover:border-zinc-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="text-zinc-700 font-medium">{lib.name}</span>
                            <span className="text-[10px] text-zinc-400">{lib.wordCount} 词</span>
                          </div>
                          {selectedMergeId === lib.id && (
                            <span className="text-[10px] text-purple-600">✓</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  {isDeleting ? (
                    "删除中..."
                  ) : selectedMergeId ? (
                    <>
                      <Merge className="w-3.5 h-3.5 mr-1.5" />
                      合并并删除
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      确认删除
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Dialog */}
      <AiTopicDialog open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
