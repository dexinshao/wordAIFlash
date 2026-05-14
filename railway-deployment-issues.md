# Railway 部署问题排查记录

> 项目：wordAIFlash（glistening-empathy）
> 部署平台：Railway（Trial 计划）
> 部署方式：GitHub 自动部署（Dockerfile）
> 数据库：MySQL 9.4.0

---

## 问题一：HTTPS 方式推送 GitHub 失败

### 现象
执行 `git push` 时提示 HTTPS 认证失败，没有配置 GitHub 凭据。

### 原因
远程仓库地址为 `https://github.com/dexinshao/wordAIFlash.git`，当前环境未配置 GitHub HTTPS 认证。

### 解决方案
改用 SSH 密钥认证：
1. 生成 ed25519 SSH 密钥：`ssh-keygen -t ed25519 -C "SOLO Push Key"`
2. 通过浏览器将公钥添加到 GitHub → Settings → SSH Keys（标题：`SOLO Push Key`）
3. 修改远程地址：`git remote set-url origin git@github.com:dexinshao/wordAIFlash.git`
4. 推送成功：`c1381fa..adcdedd main -> main`

---

## 问题二：数据库类型不匹配（代码用 MySQL，Railway 用 Postgres）

### 现象
页面报错，API 请求失败。

### 原因
- 项目代码使用 `mysql2` 驱动 + Drizzle ORM MySQL 方言
- Railway 上初始创建的是 **Postgres** 服务
- Railway 自动注入的 `DATABASE_URL` 指向 Postgres，导致 mysql2 驱动无法连接

### 解决方案
在 Railway 页面上手动添加 MySQL 服务（删除或忽略原有 Postgres），Railway 自动将 `DATABASE_URL` 更新为 MySQL 连接字符串。

---

## 问题三：数据库表未创建，应用启动即崩溃

### 现象
MySQL 服务已就绪，但应用反复重启（Starting Container → Server running → Stopping Container 循环）。

### 原因
MySQL 数据库为空，没有任何表。应用启动后查询数据库时因表不存在而报错，导致进程退出，Railway 检测到退出后自动重启。

### 解决方案（经历三次迭代）

#### 尝试一：Railway preDeployCommand（drizzle-kit push）

在 `railway.json` 中配置：
```json
{
  "deploy": {
    "preDeployCommand": "npx drizzle-kit push && npx tsx db/seed-fast.ts"
  }
}
```

**结果**：`drizzle-kit push` 成功创建了表，但 seed 脚本未执行。

#### 尝试二：esbuild 编译 seed 脚本

在 Dockerfile 中添加 esbuild 编译步骤，将 `seed-fast.ts` 编译为 JS。

**结果**：失败。esbuild `--bundle` 模式无法处理 `mysql2` 的原生 C++ 模块（`.node` 文件），编译报错。

#### 尝试三：在 runner 阶段安装 tsx

在 Dockerfile 的 runner 阶段执行 `npm install --no-save tsx`，然后通过 `npx tsx db/seed-fast.ts` 执行。

**结果**：seed 脚本仍未执行。原因是 Railway 的 `preDeployCommand` 在**旧容器**中运行，而 tsx 只安装在新构建的容器中。

#### 最终方案：应用启动时自动初始化（✅ 成功）

将数据库初始化逻辑直接集成到应用启动流程中，不依赖任何外部 pre-deploy 机制：

1. **新建 `db/auto-init.ts`**：
   - 使用原生 `mysql2/promise` 直接执行 SQL（不依赖 Drizzle ORM）
   - `CREATE TABLE IF NOT EXISTS` 创建所有 4 张表
   - 检查 `word_libraries` 是否有数据，为空则插入种子数据（8 个词库 × 10 个单词）
   - 导出 `autoInitDatabase(databaseUrl)` 函数

2. **修改 `api/boot.ts`**：
   ```typescript
   if (env.isProduction) {
     console.log("[boot] Initializing database...");
     await autoInitDatabase(env.databaseUrl);
     console.log("[boot] Database ready.");
     // ... 启动 HTTP 服务
   }
   ```

3. **简化 Dockerfile**：
   - 移除 tsx 安装
   - 移除不必要的 `db/` 和 `drizzle.config.ts` 文件复制
   - esbuild `--bundle` 会自动将 `auto-init.ts` 打包进 `dist/boot.js`

4. **清空 `railway.json`**：移除 preDeployCommand

**部署日志确认**：
```
[boot] Initializing database...
[auto-init] Tables ensured.
[auto-init] Seeding database...
[auto-init] Inserted 10 words for cet4
[auto-init] Inserted 10 words for cet6
[auto-init] Inserted 10 words for toefl
[auto-init] Inserted 10 words for ielts
[auto-init] Inserted 10 words for tem8
[auto-init] Inserted 10 words for bec
[auto-init] Inserted 10 words for high_school
[auto-init] Inserted 10 words for top10000
[auto-init] Seed completed!
[boot] Database ready.
Server running on http://localhost:8080/
```

---

## 问题四：localhost:8080 是否有问题？

### 现象
日志中显示 `Server running on http://localhost:8080/`，看起来像是只监听本地地址。

### 分析
查阅 `@hono/node-server` 源码，当 `hostname` 参数为 `undefined` 时，底层调用的是 `server.listen(port)`，等价于绑定 `0.0.0.0`（所有网络接口）。日志中的 `localhost` 只是显示文本，**不影响实际监听地址**。Railway 通过内部端口转发将外部流量路由到容器，因此服务可以正常被外部访问。

### 结论
无需修改，这是正常行为。

---

## 经验总结

| 经验 | 说明 |
|------|------|
| **数据库类型要一致** | 代码用什么数据库，Railway 就要创建对应类型的数据库服务 |
| **preDeployCommand 不可靠** | 在旧容器中执行，无法使用新构建的依赖，不适合需要运行时工具的场景 |
| **esbuild 不能打包原生模块** | mysql2、better-sqlite3 等含 C++ 原生代码的模块不能用 esbuild bundle |
| **启动时自初始化最可靠** | 将建表和 seed 逻辑写入应用启动流程，每次部署自动执行，无需外部依赖 |
| **Railway 端口由环境变量控制** | `PORT` 由 Railway 自动注入，代码中应读取 `process.env.PORT` |
| **SSH 密钥优于 HTTPS** | 自动化环境中 SSH 密钥认证比 HTTPS 更方便，无需交互式输入凭据 |
