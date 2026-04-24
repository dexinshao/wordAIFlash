/**
 * 密钥配置脚本
 *
 * 使用方式：
 *   npx tsx scripts/setup-secrets.ts
 *
 * 会交互式引导你设置 AI_API_KEY 等敏感信息，
 * 加密后保存到 data/.secrets.enc 文件。
 */
import * as readline from "node:readline";
import { encryptSecrets } from "../api/lib/crypto-utils";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string, silent = false): Promise<string> {
  return new Promise((resolve) => {
    if (silent) {
      // 简单的隐藏输入（实际生产环境建议用 readline-sync 或 inquirer）
      process.stdout.write(prompt);
      const stdin = process.stdin;
      const buf: Buffer[] = [];
      const onData = (char: Buffer) => {
        const c = char.toString();
        if (c === "\n" || c === "\r" || c === "\u0004") {
          stdin.setRawMode(false);
          stdin.removeListener("data", onData);
          stdin.pause();
          process.stdout.write("\n");
          resolve(Buffer.concat(buf).toString("utf8"));
        } else if (c === "\u0003") {
          process.exit(1);
        } else if (c === "\u007f") {
          buf.pop();
        } else {
          buf.push(char);
        }
      };
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on("data", onData);
    } else {
      rl.question(prompt, resolve);
    }
  });
}

async function main() {
  console.log("\n🔐 WordFlash 密钥配置工具\n");
  console.log("此工具将帮助你加密存储 AI API Key 等敏感信息。\n");

  const password = await question("请设置加密密码（用于加密/解密密钥）: ", true);
  if (!password || password.length < 4) {
    console.error("❌ 密码长度至少 4 位");
    process.exit(1);
  }

  const confirm = await question("再次输入密码确认: ", true);
  if (password !== confirm) {
    console.error("❌ 两次密码不一致");
    process.exit(1);
  }

  console.log("\n请输入以下配置（直接回车跳过）：\n");

  const aiBaseUrl = await question("AI 服务地址 [https://api.deepseek.com/v1]: ");
  const aiApiKey = await question("AI API Key: ", true);
  const aiModel = await question("AI 模型名称 [deepseek-chat]: ");

  const secrets: Record<string, string> = {};
  if (aiApiKey) secrets.AI_API_KEY = aiApiKey;
  if (aiBaseUrl) secrets.AI_BASE_URL = aiBaseUrl;
  if (aiModel) secrets.AI_MODEL = aiModel;

  if (Object.keys(secrets).length === 0) {
    console.log("\n⚠️  没有输入任何密钥，退出。");
    rl.close();
    return;
  }

  encryptSecrets(secrets, password);

  console.log("\n✅ 配置完成！");
  console.log("请将加密密码设置到 .env 文件的 SECRET_PASSWORD 字段中：");
  console.log("  SECRET_PASSWORD=你的加密密码\n");
  console.log("启动服务时会自动解密密钥。\n");

  rl.close();
}

main().catch(console.error);
