import { callAILite } from "../api/lib/ai";

async function main() {
  const r = await callAILite(
    '你是一个分类匹配助手。只返回 JSON 数组，不要其他文字。',
    '用户主题：天气\n\n现有词库：\n1. [ID:9] weather - AI 生成：weather 相关词汇\n2. [ID:14] travel and transportation - AI 生成：travel and transportation 相关词汇'
  );
  console.log('RAW:', JSON.stringify(r));
  const m = r.match(/\[[\s\S]*?\]/);
  console.log('MATCH:', m ? m[0] : 'null');
}

main().catch(console.error);
