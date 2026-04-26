# WordFlash 部署问题排查记录

> 记录 WordFlash 项目部署到 Railway 过程中遇到的所有问题及解决方案。

---

## 1. Git 未配置 user.name 和 user.email

**错误信息：** 无明确报错，但提交时可能使用系统默认值。

**解决方案：**
```bash
git config --global user.name "你的用户名"
git config --global user.email "你的邮箱"
```

**验证：**
```bash
git config --global user.name
git config --global user.email
```

---

## 2. Railway CLI 安装后 permission denied

**错误信息：**
```
zsh: permission denied: railway
```

**原因：** npm 全局安装的可执行文件缺少执行权限。

**解决方案：**
```bash
# 找到 npm 全局 bin 目录
npm prefix -g

# 添加执行权限
chmod +x $(npm prefix -g)/bin/railway
```

> **注意：** `npm bin -g` 在 npm v10+ 中已被移除，请使用 `npm prefix -g` 替代。

---

## 3. Git push 报 'origin' does not appear to be a git repository

**错误信息：**
```
致命错误：'origin' does not appear to be a git repository
```

**原因：** 本地仓库未关联远程仓库地址。

**解决方案：**
```bash
# 添加远程仓库
git remote add origin https://github.com/用户名/仓库名.git

# 推送
git push -u origin main
```

---

## 4. Git push 报 HTTP 400 curl 22 / 远端意外挂断

**错误信息：**
```
错误：RPC 失败。HTTP 400 curl 22 The requested URL returned error: 400
send-pack: unexpected disconnect while reading sideband packet
致命错误：远端意外挂断了
```

**原因：** 推送数据量超过 Git HTTP 缓冲区大小。

**解决方案：**
```bash
# 增大 HTTP 缓冲区到 500MB
git config --global http.postBuffer 524288000

# 重新推送
git push -u origin main
```

**备选方案（改用 SSH）：**
```bash
git remote set-url origin git@github.com:用户名/仓库名.git
git push -u origin main
```

---

## 5. Git detached HEAD（分离头指针）- 不在分支上

**错误信息：**
```
致命错误：您当前不在一个分支上。
```

**原因：** 之前 `git push` 失败后 HEAD 被重置，脱离了分支。

**解决方案：**
```bash
# 强制将 main 分支指向当前 HEAD（保留所有提交）
git checkout -f main
git reset --hard <最新提交的SHA>

# 推送
git push -u origin main --force
```

> 如果 `git checkout -f main` 提示丢下提交，说明 main 分支落后于当前 HEAD，`reset --hard` 会把 main 更新到最新位置，不会丢失提交。

---

## 6. Docker 构建失败 - failed to calculate checksum of package.json

**错误信息：**
```
ERROR: failed to build: failed to solve: failed to compute cache key:
failed to calculate checksum: "/package.json": not found
```

**原因：** Railway 默认从仓库根目录构建，但 `package.json` 和 `Dockerfile` 在 `app/` 子目录下。

**排查步骤：**
1. 确认文件编码：`file package.json` → 应为 UTF-8 / LF
2. 检查 `.dockerignore` 是否排除了 `package.json`
3. 确认 Railway 构建上下文目录是否正确

**解决方案：**

在 Railway 控制台中设置 **Root Directory** 为 `app`：
- Railway → 服务 → Settings → Root Directory → 填入 `app`

---

## 7. Railway 使用了错误的构建器（NIXPACKS 而非 Dockerfile）

**错误信息：** Docker 构建步骤未执行，或出现与 Nixpacks 相关的报错。

**原因：** `railway.json` 中配置了 `"builder": "NIXPACKS"`，导致忽略了项目中的 `Dockerfile`。

**解决方案：** 修改 `railway.json`，将构建器切换为 Dockerfile：

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE"
  }
}
```

修改后提交推送：
```bash
git add railway.json
git commit -m "切换 Railway 构建器为 Dockerfile"
git push
```

---

## 8. 应用启动失败 - Missing required environment variable: APP_ID

**错误信息：**
```
Error: Missing required environment variable: APP_ID
```

**原因：** Railway 上未配置应用所需的环境变量。

**解决方案：** 在 Railway 控制台 → 服务 → **Variables** 中添加以下环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `APP_ID` | `wordflash` | 应用标识 |
| `APP_SECRET` | 随机字符串 | 应用密钥（可用 `openssl rand -hex 32` 生成） |
| `DATABASE_URL` | `sqlite:./data/wordflash.db` | 数据库路径 |
| `AI_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 通义千问 API 地址 |
| `AI_API_KEY` | 你的 API Key | AI 接口密钥 |
| `AI_MODEL` | `qwen-turbo` | AI 模型名称 |

添加完成后 Railway 会自动重新部署。

---

## 总结：部署流程清单

1. ✅ 配置 Git 用户信息
2. ✅ 安装 Railway CLI 并修复权限
3. ✅ 创建 GitHub 远程仓库并关联
4. ✅ 解决推送时的 HTTP 缓冲区问题
5. ✅ 修复 Git detached HEAD 状态
6. ✅ 修改 `railway.json` 使用 Dockerfile 构建
7. ✅ 在 Railway 设置 Root Directory 为 `app`
8. ✅ 在 Railway 配置所有必需的环境变量
