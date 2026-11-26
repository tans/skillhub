# Skills over MCP 研究与整合方案

本文记录 SkillHub 与 MCP Skills 扩展（`io.modelcontextprotocol/skills`）的关系、使用方式和落地建议。

研究日期：2026-11-26。核对仓库基线 `3aa5928` 与官方扩展快照 [`c0705f9`](https://github.com/modelcontextprotocol/ext-skills/tree/c0705f9071caa539eeb2c9f5f2f77ac16b048ca6)。本文只交付研究与建议，未实现或部署 MCP 服务。

## 结论

SkillHub 适合作为 MCP Skills Server 的后端注册中心：SkillHub 继续负责技能包、版本、命名空间、可见性、审核和审计，MCP 适配层负责把“可见的已发布技能”映射为 MCP 的 `skills/list`、`skills/get` 和 `resources/read`。

MCP Skills 是技能的传输和发现协议，不是新的技能格式，也不是工具调用协议。现有 `SKILL.md`、`references/`、`scripts/` 和 `assets/` 目录约定可以直接复用。现阶段应保留 SkillHub CLI 的安装链路，MCP 作为面向 Claude Code、VS Code 等 MCP 客户端的补充入口。

## 规范要点

官方扩展基于 MCP Resources，当前 Beta 规范的扩展标识为 `io.modelcontextprotocol/skills`，基于协议版本 `2026-07-28`：

- 服务端声明 `resources` 能力和 `extensions["io.modelcontextprotocol/skills"]`。
- `skills/list` 返回技能 URI、完整 YAML frontmatter 和完整文件清单。
- `skills/get` 按技能的 `SKILL.md` URI 返回同样的元数据；未出现在列表中的技能也可以按 URI 获取。
- 每个文件通过标准 `resources/read` 读取；可选的 `resources/directory/read` 用于目录浏览。
- 每个文件清单项必须包含原始字节的 `size` 和 `sha256:<64位小写十六进制>` digest。
- `resources` 数组必须包含 `SKILL.md` 和所有支持文件。符合规范的宿主必须支持每技能 512 个文件、总大小 16 MiB；服务端不应超出该互操作边界，但这并非不可扩展的硬上限。动态内容可使用 `"dynamic"`，但不能建立内容绑定的审批。
- `skills/list` 支持 `cursor` / `nextCursor` 分页；`skills/get` 不分页。两者都必须返回 `resultType: "complete"`、`ttlMs` 和 `cacheScope`。请求必须携带当前基础协议要求的 `params._meta`。
- 客户端必须校验大小、digest 和 frontmatter；digest 只证明服务端元数据与内容一致，不是内容可信证明。

规范来源：

- [MCP Skills 扩展规范](https://github.com/modelcontextprotocol/ext-skills/blob/main/specification/beta/skills.mdx)
- [Skills Over MCP 工作组](https://github.com/modelcontextprotocol/ext-skills)
- [Agent Skills 规范](https://agentskills.io/specification)
- [SEP-2640](https://modelcontextprotocol.io/seps/2640-skills-extension)：提案已 Final；扩展自身仍为 Beta，未来 Beta 修订可能不兼容。实现时固定规范和 SDK 版本。
- [本次核对的固定版规范](https://github.com/modelcontextprotocol/ext-skills/blob/c0705f9071caa539eeb2c9f5f2f77ac16b048ca6/specification/beta/skills.mdx)，避免把后续 main 的变化当作本文已验证内容。

### 可借鉴的实现与客户端

| 资料 | 用途与限制 |
| --- | --- |
| [官方实现清单（固定快照）](https://github.com/modelcontextprotocol/ext-skills/blob/c0705f9071caa539eeb2c9f5f2f77ac16b048ca6/docs/implementations.md) | 区分 released、未发布合并、partial、in progress 与 requested；不能把“支持 MCP”当作“支持 Skills 扩展” |
| [olaservo/skills-over-mcp-demo](https://github.com/olaservo/skills-over-mcp-demo) | TypeScript SDK v2 的 stdio / HTTP 示例，覆盖完整 manifest、digest 与错误处理；示例作者的兼容性报告不能代替本项目验证 |
| [hemanth/skills-over-mcp](https://github.com/hemanth/skills-over-mcp) | 适合理解渐进加载和工作流；`skill://index.json` 属于早期方案，不能照搬为当前扩展实现 |
| [Claude Code 文档](https://code.claude.com/docs/en/mcp#use-skills-from-mcp-servers) | 工作组清单记录从 v2.1.331 起公开 Beta，使用 `/<server>:<skill>`；此次官网抓取返回 403，版本信息依据工作组清单，未实际运行客户端 |
| [VS Code 实现](https://github.com/microsoft/vscode/pull/345956) | 工作组清单记录从 1.147 起默认启用，按服务器同意；本次未进行客户端实测 |

工作组清单仍将 Spring AI 标为 `requested`，不宜假设现有 Java/Spring 依赖自动支持该扩展。原型优先选清单中已实现扩展的 SDK，固定依赖，再验证实际协议行为。

## SkillHub 映射

| MCP 概念 | SkillHub 数据/接口 | 处理规则 |
| --- | --- | --- |
| skill URI | 建议 `skill://<namespace>/v<version>/<slug>/SKILL.md` | 精确版本放在 slug 前，保证技能根目录最后一段仍等于 frontmatter.name；版本化 URI 是本项目建议，非协议强制要求 |
| `frontmatter` | 已发布版本的 `parsed_metadata_json`，或读取包内 `SKILL.md` 的完整 frontmatter | 必须与实际文件解析值逐字段一致；不能用网页展示名或自定义摘要替换 name / description |
| `resources` | 已发布版本的文件记录 | 使用每个 `SkillFile` 的路径、大小、SHA-256；必须完整列出 |
| `resources/read` | `SkillController` 的版本文件读取接口 | 复用现有可见性判断、对象存储和审计；禁止绕过权限直接读对象存储 |
| `skills/list` | 公开/当前用户可见的已发布技能查询 | 分页返回；草稿、待审核、撤回和无权访问的私有技能不返回 |
| `skills/get` | 按精确版本 URI 查询 | 复用版本解析和权限判断；未知或无权 URI 返回 JSON-RPC `-32602` |
| 目录读取 | SkillHub 文件列表按父路径过滤 | 第一阶段可不声明 `directoryRead`，减少协议面 |

SkillHub 当前已有 `/api/v1/skills`、`/api/web/skills` 的技能详情、版本、文件列表、单文件读取和下载接口，也已有 `SkillFile.sha256` 与版本 fingerprint。MCP 适配层应调用应用服务，而不是复制一套查询和授权逻辑。

独立进程原型可通过现有 REST 调用应用层。以 `team-name/pdf-processing` 的 `1.2.0` 为例，建议资源为 `skill://team-name/v1.2.0/pdf-processing/SKILL.md`，支持文件为同根下的 `references/GUIDE.md`：

| REST 数据源（GET） | 适配用途 |
| --- | --- |
| `/api/web/skills?q=pdf&source=platform&page=0&size=20` | 现有门户检索；只选平台技能，排除仅有 GitHub 来源记录但无本地包的结果 |
| `/api/v1/skills/team-name/pdf-processing/resolve?version=1.2.0` | 解析精确版本、versionId 和包级 fingerprint |
| `/api/v1/skills/team-name/pdf-processing/versions/1.2.0/files` | 完整文件清单，映射每文件 URI、size 与 digest |
| `/api/v1/skills/team-name/pdf-processing/versions/1.2.0/file?path=SKILL.md` | 原始文件流，转换为 MCP text / blob；该 REST 响应不是 JSON envelope |

`skills/list` 本身没有标准关键词检索参数；首版宜按配置选定 namespace / 技能范围，再分页枚举，不把 REST 搜索参数偷偷当作扩展字段。列表的元数据和支持文件清单可生成/缓存于发布时，避免每次枚举读取整包。完整 frontmatter 快照能否直接复用必须逐字段比对实际 `SKILL.md`。

注意：版本 `fingerprint` 是按路径和文件摘要计算的包级值，不能充当每文件 digest。对 `SkillFile.sha256` 核实其对应实际输出字节后再添加 `sha256:` 前缀；不能修改换行或重排正文后沿用旧 digest。文本按返回的 UTF-8 字节计算，blob 按 base64 解码后的字节计算。二进制文件同样必须可读。

`latest` 只用于发现时选择精确版本。已给出的 URI 在读取中不能再解析到新版本；每次读取仍需检查当前权限和可下载状态。缓存按身份/namespace 权限隔离，不能让私有 manifest 使用共享 public 缓存；撤权后不能仅凭缓存继续向调用者提供内容。沿用现有审计契约，并在实现时明确资源读取事件和包下载计数的区别。

源码依据：`SkillController`、`SkillSearchController`、`SkillQueryService`、`cli/src/clients/skillhub-client.ts`；包格式契约见 [技能协议](07-skill-protocol.md)。这些是源码核对结果，不代表生产 v0.2.26 所有新接口均已验证。

## 客户端使用

### MCP 客户端

MCP 客户端应连接一个提供 Streamable HTTP 或 stdio 的适配器。下列为 Claude Code 风格的拟议配置，需先实现和部署适配器；示例域名不是现有可用入口，其他客户端按各自配置格式填写：

```json
{
  "mcpServers": {
    "skillhub": {
      "type": "http",
      "url": "https://skillhub.example.com/mcp"
    }
  }
}
```

客户端发现扩展后调用 `skills/list`，用户批准具体技能后按需读取 `SKILL.md` 和支持文件。技能不会因为被列出或被 `resources/read` 读取就自动获得本机命令执行权限。

### 现有 CLI 链路

CLI 继续适用于需要把技能安装到本地 Agent Skills 目录的场景：

```bash
export SKILLHUB_REGISTRY=https://skillhub.example.com
skillhub search "pdf"
skillhub install @team-name/pdf-processing --version 1.2.0 --agent claude-code --scope project
```

以上以实际存在的 namespace / slug / version 替换；命令参数按本仓库 CLI 源码核对，未执行安装。私有技能先使用既有登录流程。CLI 负责下载、解压和本地安装元数据，目录与索引行为以所选 Agent profile 为准；MCP 负责远程发现和按需读取。两条链路共享 SkillHub 的版本和权限语义。MCP 缓存必须置于本地技能自动发现目录之外，防止远端内容在重启后被当成本地可信技能。

## 安全边界

- MCP 技能内容是远端输入和潜在 prompt injection，必须显示来源服务器，不能伪装成本地技能。
- 服务端必须在 `skills/list`、`skills/get`、`resources/read` 使用同一套 namespace、用户身份和发布状态可见性判断。
- 远端技能中的 `allowed-tools` 不能自动扩大宿主权限；涉及执行脚本或命令必须由客户端按技能单独批准。
- 同名技能不能静默覆盖本地技能或另一个 MCP 服务的技能，客户端应按服务来源隔离名称和缓存。
- 审批应绑定完整 resources manifest；版本变更、文件增加/删除或 digest 变化都应使旧审批失效。
- 私有技能使用用户认证或 OAuth；匿名访问只允许公开技能。不要把 API Token 写入 `SKILL.md`、MCP 配置示例或日志。

## 推荐落地阶段

1. **适配器原型**：建议 TypeScript SDK v2 独立 sidecar，通过现有 REST 提供 `skills/list`、`skills/get`、`resources/read`；只支持公开可下载的已发布技能和精确版本 URI。首版即满足分页、必需缓存字段、完整 manifest、大小与摘要规范；受限技能默认拒绝。
2. **认证与可见性**：接入现有身份体系，验证 namespace 权限、审核状态、撤回状态和审计事件，补齐私有缓存隔离与限流。独立服务不能默认透传任意 Token；HTTP MCP 的 OAuth/resource audience、调用者身份到 SkillHub 身份的映射与凭证存储需单独设计。首版 stdio 可用当前用户的 SkillHub 凭证，不能让多用户共享管理员 Token。
3. **客户端互操作**：用 MCP Inspector 和至少一个实际客户端验证 digest、frontmatter、支持文件、未知 URI、版本更新和权限拒绝；再决定是否开启 `directoryRead`。
4. **产品入口**：在 Web 技能详情页提供 MCP endpoint 和客户端配置提示；保留 CLI 作为本地安装、离线和批量管理入口。

第一阶段建议独立适配器，减少对现有 Java 服务和部署的改动。只支持 tools 的宿主可另加只读 `search_skills` / `read_skill` 工具桥接，但这属于自定义兼容层，不等于原生扩展支持；返回 Markdown 也不会自动激活技能。工具名称和行为不能与当前宿主已有工具冲突。首版先完成标准扩展，再按实际目标客户端决定是否需要桥接。

原型验收至少覆盖：两个同名跨 namespace 技能、含图片/脚本/相对引用的技能、分页、多文件大小与 digest 校验、frontmatter 不一致、未知 URI、路径穿越、未列入 manifest 的文件拒绝、版本变更、撤回后拒绝读取、匿名无法读取私有技能、两用户隔离，以及工具桥接与原生技能加载的区别。读取资源不执行脚本；脚本运行由宿主提供解释器、依赖与单独授权。

## 当前缺口

仓库当前没有 MCP Server 实现，也没有 `skills/list`、`skills/get` 的 JSON-RPC 处理器；`.mcp.json` 仅配置了 Playwright 客户端。现有 REST 接口可作为适配器的数据源，但不能直接被 MCP 客户端当作 Skills 扩展使用。需要新增适配器、协议测试、认证配置和部署入口后，才能宣称 SkillHub 支持 Skills over MCP。
