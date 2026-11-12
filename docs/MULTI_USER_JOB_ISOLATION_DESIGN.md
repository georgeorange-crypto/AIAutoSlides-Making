# 多用户并发 Slides 任务与数据隔离设计

**状态：** 已实现低扰动 API 基础切片；生产级多人认证与租户部署仍未完成。

**日期：** 2026-11-12
**目标：** 允许多个用户同时提交多个 Slides 项目/任务，任务并发运行时彼此不串数据、不覆盖产物，并能可靠查看进度、取消任务、下载结果和恢复失败任务。

## 1. 设计摘要

采用 `User → Project → Job → Artifact` 的资源层级。每个 Project 有明确 owner；每个 Job 在数据库、存储目录和运行时都绑定到该 Project 和 owner。请求进入 API 时先认证，再在每一个资源访问点校验 owner/role。工作进程只获得一个 Job 的输入快照与独立工作目录，不获得任意文件系统路径、其他项目数据或默认网络访问。

```text
Web/Desktop/Agent Client
        │ HTTPS + authenticated API (remote)
        │ loopback + local session (single-user desktop)
        ▼
API: authentication → authorization → validation → job enqueue
        │
        ├── project/job metadata store (SQLite single-host; PostgreSQL multi-instance)
        ├── immutable source/artifact storage, tenant/project scoped
        └── bounded scheduler → isolated worker per job
                              ├── input snapshot (IR hash, evidence, assets)
                              ├── temp/work directory
                              └── output artifacts + QA + audit manifest
```

**不可妥协的不变量：**

1. 用户只能读取或修改其拥有/获授权项目中的 Project、Source、Job、Event 和 Artifact。
2. Job 执行时使用提交时锁定的输入快照；项目后续修改不会悄悄改变正在运行的 Job。
3. 每个 Job 有唯一工作目录和输出目录；构建器不得写到该目录之外。
4. 用户上传的原件不可覆盖；写入产物使用新路径并记录 SHA-256。
5. 文件名、路径、来源文本、分镜、素材、渲染器输出都视为不可信数据，不得作为主机命令或 Agent 指令执行。
6. “数据隔离”不仅是路径不同：数据库查询、API 响应、下载、日志、缓存、临时文件、错误消息和备份均需按 owner/tenant 约束。

## 2. 当前工作区基线

当前共享工作区已有可复用的单机任务基础：

- `packages/api/server.mjs` 提供 loopback REST API，可创建项目、编辑幻灯片、导入来源、提交/查看/取消 Job、查询/下载产物。
- `packages/api/store.mjs` 使用 SQLite 存储项目、来源、幻灯片、Job、事件与 Artifact 元数据；输入 IR 和文件以 SHA-256 地址保存。
- Job 具有 queued/running/completed/failed/cancelled 状态；API 启动时恢复 queued Job，并把进程重启时残留 running Job 标为失败。
- 工作流使用 `runs/<job_id>/` 作为运行目录；IR 渲染器校验输出路径不能通过路径遍历或 symlink 逃出项目工作区。
- `packages/core/models.mjs` 和 Project/Profile/Job Schema 已定义 Project、UserProfile、JobState 等基础结构。

**当前仍然存在的多人隔离边界：**

- API 支持注入可信 `authenticate(request)`；Projects 有 owner 字段，项目读写、Job 状态/取消、Artifact 下载会按 owner 过滤。默认 CLI/API principal 仍是 `local`，保留原有单用户行为。
- Project IR 与来源原件按 owner 分开存储；相同源文件即使跨用户也不会复用同一个物理 blob 路径。旧数据库迁移为 owner=`local`。
- Job 创建时记录不可变 IR blob 路径/hash；运行结果仍在唯一 `runs/<job_id>/` 目录。
- 调度器已限制全局并发与每用户并发，并在可运行用户之间轮转；当前仅对一个 API 进程有效。
- API 已提供身份模式下的有界二进制 source upload；身份模式拒绝客户端提供服务器 `file_path` 的旧导入方式。
- **仍没有内置登录/OIDC、项目成员/角色、网络监听、跨进程 worker lease、分布式队列、OS 级 Job 沙箱、资源配额和完整攻击面测试。** API 仍只绑定 loopback。
- 因此这次实现提供了**单机应用层 owner 隔离与有限并发**，并不等于可以把服务开放到公网或抵御恶意租户。实际身份验证需由可信宿主注入；服务部署前还要补远程 TLS、隔离 worker、权限审查和安全测试。

### 本次低扰动实现与兼容影响

- 没有改 legacy CLI、旧分镜 JSON/Markdown 契约、渲染 Adapter 接口或输出格式。
- SQLite 变更为加列迁移：旧 Project 自动归属 `local`，旧 Job 自动绑定项目当前 IR hash；对应旧数据库迁移有回归测试。
- 默认本地 API 仍使用 `local` 用户；原有项目、来源路径导入、构建与下载流程继续工作。API 新增默认最大并发 2 的有界队列，超出任务继续排队；嵌入式调用可配置全局和每用户上限。
- 多用户通过嵌入式身份解析器 opt-in；认证模式的所有资源路由 owner-scoped。身份模式下 source 文件须通过二进制上传端点，不接受服务器绝对路径。
- 验收测试覆盖两个身份项目/Job/Artifact 互不可见、每用户存储命名空间、全局并发上限、提交快照和旧库迁移。此处不声称已完成远程认证、OS 沙箱或渗透测试。

## 3. 部署与信任边界

### 3.1 支持的部署级别

| 模式 | 使用场景 | 隔离级别与限制 |
|---|---|---|
| 本地单用户 App | 一个人在自己电脑上制作 | OS 用户 + 每 Job 目录；无远程共享。多个项目可并行，但需有并发上限。 |
| 单机组织服务 | 一台受控服务器上多个已认证用户 | API 认证/授权、owner-scoped DB 查询、每租户存储前缀、独立 worker 进程；不等同于抵御恶意同机管理员。 |
| 多实例托管服务 | 多台 API/Worker 节点 | PostgreSQL、共享对象存储或隔离卷、分布式队列/lease、OIDC、worker 容器或 OS 沙箱、审计和运维策略。 |

第一版多人目标建议设为**单机组织服务**，先支持一个 API 实例与多个有身份的用户。只有出现多 API/Worker 节点需求时，再迁移到 PostgreSQL/外部队列/对象存储；不把尚未验证的分布式基础设施提前加入首版。

### 3.2 信任边界

- **Client → API：** 网络模式强制 HTTPS。桌面单用户模式仍只绑定 loopback，并用短期随机本地会话凭证防止网页跨站请求/本机其他进程误用。
- **API → Worker：** Worker 只收到 job snapshot、受限输入文件和输出目录；不接受任意 shell、任意绝对路径、任意环境变量或任意可执行文件。
- **Worker → 外部网络：** 默认禁用。只有显式批准的研究/AI Adapter 才能使用网络，并记录 provider、文件清单、用途和费用策略。
- **Storage/DB：** 所有行和对象必须能追溯到 tenant/project/job；权限校验由服务端强制，不依赖客户端传入的 `user_id`。
- **管理员：** 服务管理员可管理服务生命周期，但默认不能以普通 API 路径读取用户私有内容；必要的支持访问须审计并有授权依据。

## 4. 身份、租户、角色与权限

### 4.1 身份策略

- 单机个人版：由桌面 App 建立本地用户身份，凭证保存在 OS 安全存储；只接受 loopback 连接。
- 组织/远程版：优先 OIDC/OAuth 身份提供方。API 验证签名、issuer、audience、expiry，并将稳定的 `(issuer, subject)` 映射为内部 `user_id`。不自行存储明文密码。
- 可以在未来增加 workspace/organization tenant；首版无明确组织管理需求时，先以 user 为 tenant 边界，数据模型保留 tenant 扩展点。
- `user_id` 由已验证 token/session 得出；不得信任 request body、query 或自定义未验证 header 中的用户 ID。

### 4.2 资源角色

首版角色建议：

- **owner**：管理项目成员、设置、数据导出和删除；可提交任务。
- **editor**：查看/编辑项目内容、导入材料、提交/取消任务和下载产物。
- **viewer**：只读项目、状态和已授权产物。

项目创建者默认为 owner。匿名分享链接、全局管理员越权访问和跨租户模板复用不在首版范围内。

### 4.3 授权原则

每个 handler 使用经认证的 principal 并执行 `authorize(principal, resource, action)`；存储 API 也要求带 owner/tenant 条件，不提供生产路径使用的无范围 `getJob(jobId)`/`listProjects()` 方法。

示意查询：

```sql
SELECT j.*
FROM jobs j
JOIN projects p ON p.project_id = j.project_id
JOIN project_members m ON m.project_id = p.project_id
WHERE j.job_id = ? AND m.user_id = ?;
```

即使 Job ID 是随机 UUID，也必须授权；ID 难猜不是访问控制。无权资源建议统一返回 404，避免泄露其他用户资源是否存在。

## 5. 数据模型与迁移

当前表基础上做增量迁移，所有迁移有版本号、可回滚备份，并保证旧单用户数据迁移后 owner 明确。

### 5.1 建议关系

```text
users(user_id, issuer, subject, created_at, disabled_at)
tenants(tenant_id, name, created_at)                       -- 首版可让 user 作为默认 tenant
tenant_members(tenant_id, user_id, role, created_at)
projects(project_id, tenant_id, owner_user_id, ..., version)
project_members(project_id, user_id, role, created_at)
sources(tenant_id, project_id, source_id, blob_key, sha256, ...)
jobs(job_id, tenant_id, project_id, submitted_by, state, input_snapshot_hash, ...)
job_events(event_id, tenant_id, project_id, job_id, ...)
artifacts(artifact_id, tenant_id, project_id, job_id, storage_key, sha256, ...)
```

所有项目相关表都加 `tenant_id`，使访问范围可由复合索引和外键约束验证。外键应尽量覆盖 tenant/project 组合，防止误把一个租户的 source 或 artifact 关联到另一个租户。

### 5.2 项目并发编辑

Project 增加递增 `version` 或 `ir_sha256` 条件写入。编辑接口要求 `If-Match`/期望版本；若版本已变化，返回 `409 conflict` 并要求客户端合并/重载，不采用静默最后写入胜出。

提交 Job 时将当前 `presentationIR`、证据台账、资产清单、主题 tokens、Adapter 版本和必要配置冻结为只读 snapshot，并记录 hash。Worker 只读取该快照，不直接读取会继续编辑的 Project 最新版本。

### 5.3 文件与产物布局

建议采用清晰的 tenant/project/job 命名空间：

```text
data/
  db/aiautoslides.sqlite
  tenants/<tenant_id>/
    projects/<project_id>/
      sources/<source_id>/<sha256>.<ext>
      jobs/<job_id>/
        input/       # 已授权、只读的任务快照
        work/        # 临时生成文件
        artifacts/   # PPTX/PDF/PNG/JSON/QA reports
        logs/        # 有大小与敏感字段限制
        manifest.json
```

- tenant/project/job ID 由服务端生成 UUID/随机 ID，并在路径解析时做 realpath containment 校验，拒绝 `..`、绝对路径注入和 symlink 逃逸。
- 用户上传首先进入受限 staging；服务端校验大小、媒体类型、扩展名、文件签名和恶意文件策略，再复制到不可变 source blob。
- **禁止跨租户内容哈希去重**：全局 content-addressed blob 会暴露两个租户持有相同文件的侧信道。可以在租户命名空间内去重，或随机对象 key + 独立 SHA 校验。
- 客户端只使用 `artifact_id` 下载；服务端查询记录、检查授权、校验对象 hash 后流式返回。不能接收客户端 path 直接读文件。
- 数据库记录对象 key 而不是任意文件路径。清理、保留和备份同样按照 tenant/project 授权和审计策略执行。

## 6. Job 调度、并发和生命周期

### 6.1 Job 状态机

建议状态：

```text
queued → claimed → running → (succeeded | failed | cancel_requested → cancelled)
   └──────────────────────────────────────────────→ cancelled
```

保留当前的事件历史能力，并记录 `submitted_by`、`attempt`、`worker_id`、`lease_expires_at`、开始/结束时间、输入 hash、取消原因和失败类别。可重试错误与永久错误分开；达到最大尝试次数后失败，不无限重试。

### 6.2 有界公平调度

- 取代当前“每个 POST 立即 setImmediate 开始”的无界并发方式，建立有界 worker pool。
- 配置 `MAX_GLOBAL_JOBS`、`MAX_JOBS_PER_TENANT`、`MAX_JOBS_PER_USER`、`MAX_JOBS_PER_PROJECT` 和队列容量；第一阶段的默认值通过负载测试确定，不在设计文档中虚构。
- 使用每租户轮转或 weighted fair queue，避免单个用户占满全部槽位；并发额度与大文件/高成本 Adapter 的资源预算可分开配置。
- SQLite 单机实现中用 `BEGIN IMMEDIATE` 原子领取 queued Job，并写 worker lease。多进程必须通过 DB lease 协调，不能只靠 Node 内存 Map。
- worker 进程启动后限时、限内存/磁盘/日志；任务超时后终止子进程。能安全取消的阶段提供取消；不可中断阶段明确返回“到阶段边界取消”。
- PptxGenJS 当前直接在 API 进程内运行；多人生产模式应改为子进程/worker 执行。共享 API 进程内的 JavaScript 调用不能提供 OS 级资源隔离。

### 6.3 恢复与幂等

- `POST /jobs` 支持客户端 `Idempotency-Key`，避免网络重试创建重复 Deck。
- 启动/定期回收过期 lease：可安全重试的任务重新 queued；无法判断是否安全的任务转 `interrupted`/`failed` 并保留工作区供诊断。
- 每次尝试使用 `jobs/<job_id>/attempts/<n>/` 子目录，成功后原子发布 final manifest；半成品不能被当成完成产物。
- Job 事件和阶段进度通过轮询或 Server-Sent Events 暴露；事件中不写源文本、密钥或完整 prompt。

## 7. API 设计

保留当前资源形式，但所有非公开接口都先认证、再校验 owner/role。可考虑的端点如下：

| Endpoint | 能力 | 权限要点 |
|---|---|---|
| `GET /v1/me` | 当前用户身份和租户 | 只由认证 principal 决定 |
| `POST/GET /v1/projects` | 创建/列出可访问项目 | 列表按 membership 过滤 |
| `GET/PATCH/DELETE /v1/projects/{p}` | 项目读写/归档/删除 | role 授权；删除采用软删除/保留策略 |
| `POST /v1/projects/{p}/sources` | 上传/登记来源 | 流式限额，暂存区，路径不由客户端指定 |
| `POST /v1/projects/{p}/jobs` | 创建并排队 | 记录提交用户、幂等键、快照 hash 和预算 |
| `GET /v1/jobs/{j}` | 状态与当前阶段 | 必须通过 Project membership 授权 |
| `GET /v1/jobs/{j}/events` | 进度流 | 与 Job 相同权限，事件脱敏 |
| `POST /v1/jobs/{j}/cancel` | 请求取消 | owner/editor 且 Job 可取消 |
| `GET /v1/jobs/{j}/artifacts` | 列出产物 | Job 授权；只返回 artifact ID/元数据 |
| `GET /v1/artifacts/{a}/content` | 下载产物 | 以 artifact 关联的 project/tenant 再次授权 |

向后兼容可在 `v1` 多用户接口下引入认证，在本机单用户模式用本地 session；不让 `X-User-Id` 之类客户端任意字段直接变成身份。

## 8. 数据保护与生命周期

- 传输加密：所有远程部署强制 TLS。数据库与存储的静态加密由部署环境提供并记录密钥归属/轮换方式。
- 密钥：Provider/API 密钥用 secret store 或 OS credential store；禁止放在 Project JSON、Job options、日志和 manifest。
- 外部 AI/搜索：默认关闭。任何任务调用前展示将发送的文件/字段、目标服务、用途与费用；只发送最少必要内容，并把 consent 记录到 Job。
- 日志：限制大小和保留期；不记录整份上传内容、Access Token 或完整 prompt。日志下载必须也有项目授权。
- 删除：项目删除先软删除并阻止新访问，随后按保留期删除 blob、Job、Artifact 和备份副本；对删除状态提供可审计记录。
- 配额：至少限制单文件大小、单 Job 输入总量、产物总量、每用户项目数、队列深度、运行时长和磁盘用量；超限返回清晰错误。
- 备份/还原：备份清单按 tenant 记录；恢复后必须保持 owner/member 关系，不可通过导入备份改变用户权限。

## 9. 分阶段实施计划

### Phase A — 单机并发可靠性与路径隔离

1. 为 legacy CLI 和 IR API 统一显式 `project_id/job_id/outputDir`；所有多任务命令禁止依赖共享默认产物名。
2. Job snapshot 固化输入 hash；每次尝试使用 job 独立目录。
3. 实现有界 worker pool、每任务超时/取消、最大队列长度和原子 claim/lease。
4. SQLite 表增加迁移版本、乐观并发编辑版本和幂等键。
5. 做同一 API 下并发提交/取消/失败恢复测试，确认产物 hash 和路径互不覆盖。

### Phase B — 有身份的单机多人服务

1. 引入 users/tenants/project_members；为项目建立 owner 和 role。
2. 接入组织 OIDC；每一个 Project/Source/Job/Event/Artifact 路由与存储查询执行 owner-scoped authorization。
3. 改存储 key 为 tenant/project/job 命名空间，禁用跨租户 blob 去重。
4. 将渲染和外部 Adapter 移到受限 worker 子进程，清除默认网络和凭证继承。
5. 添加授权矩阵、跨用户 IDOR、上传路径、symlink、并发修改、日志/错误信息隔离测试。
6. 进行安全评审前只在内网/受控环境试点，不宣称已通过渗透测试。

### Phase C — 多实例可扩展服务（按需求启动）

1. SQLite 迁移到 PostgreSQL；队列改用有可见性超时和租约的消息/数据库队列。
2. Artifact/source blob 放到私有对象存储或每租户隔离卷；短时签名下载链接需校验授权和 TTL。
3. Worker 以容器/OS sandbox 运行，CPU/RAM/磁盘/网络 egress 配额由部署平台强制。
4. 添加调度指标、成本计量、死信队列、审计导出和管理员运维工具。

**里程碑关系：** A 是单用户产品多任务的可靠化；B 才满足“多人同时制作且互相隔离”；C 是横向扩容，不应在 A/B 未验收时抢先做。

## 10. 验收标准

### 功能与并发

- 两个或更多用户可同时建立项目并提交多个 Job；队列按配置上限运行，超出部分保持 queued。
- 一个用户的慢 Job 不会饿死其他用户的 queued Job；达到 per-user 配额时能清楚拒绝或排队。
- Job 完成、失败、取消、服务重启后都有可查询状态、事件和确定的产物行为；重复 Idempotency-Key 不产生重复 Job。
- 每个 Job 使用提交时 snapshot；项目随后编辑不改变旧 Job 的输入 hash。

### 安全隔离

- 用户 A 不能通过已知/猜测用户 B 的 project/job/artifact/source ID 查看、修改、取消、下载或删除资源。
- DB query、文件路径、缓存、事件订阅和产物下载均执行相同授权约束；无权和不存在资源的响应不泄漏跨租户事实。
- 对 `../`、绝对路径、编码路径、symlink、超大文件、伪装 MIME、压缩炸弹/异常 Office 包进行负面测试；拒绝跨命名空间读写。
- 多租户间不做内容哈希命中侧信道；同一文件 hash 不应让一个租户观察另一租户是否已有该文件。
- Worker 不能读取其他 Job/租户目录，也不能继承 API secrets；任务默认没有网络 egress。

### 证据和产物完整性

- 输入 source hash、Job snapshot hash 和 artifact hash 可重复核验，产物路径在该 Job 命名空间内。
- 未核验来源仍保持 pending/unverified；用户身份与访问控制不能自动提高科学验证状态。
- PPTX 结构 QA、PDF/PNG 视觉检查状态与 Job 成功状态分开记录；不能把渲染成功写成科学内容已核验。

## 11. 测试策略

- **单元测试：** 授权策略、角色矩阵、状态转换、lease 过期、幂等键、路径 containment、配额边界。
- **API 集成测试：** 创建两个用户和多个项目，交错调用 list/get/patch/upload/cancel/download，验证所有跨用户访问均拒绝且无内容泄漏。
- **并发测试：** 同时提交 20 个合成 Job；断言运行数不超过配置值、所有 Job 状态最终确定、artifact hash 唯一且输出无覆盖。数量为测试压力参数，不代表生产容量承诺。
- **故障注入：** Worker 中途退出、API 重启、磁盘满、DB busy、取消竞争、重复 POST、产物 hash 错误。
- **隐私测试：** 检查日志/事件/错误报告不包含正文、密钥、完整个人路径；外部 AI 未显式 opt-in 时确认无外部请求。
- **端到端验收：** 多用户上传本地 synthetic sources → 排队 → 并发 render → QA → 各自下载结果；逐项验证 owner isolation 和 lineage。

## 12. 技术决策与未决项

1. **首版身份源：** 若应用目标是一个实验室/团队，采用其 OIDC 提供方；本地 App 使用独立本地身份。不要为“以后可能用”自行实现密码库。
2. **首版数据库：** 单机、单 API 实例先保留 SQLite，并严格事务化领取 Job；多 API 实例再迁移 PostgreSQL。SQLite 数据库不放在不可靠的网络共享盘上。
3. **Worker 隔离：** 单机多人首版至少使用独立 OS 子进程与每 Job 文件权限。若用户之间互不信任或服务暴露到公网，必须使用容器/OS sandbox 和网络 egress 控制后再开放。
4. **存储加密/保留：** 需要由部署 owner 确定静态加密密钥、备份位置、默认保留期限和删除 SLA。
5. **并发数与配额：** 通过目标硬件上的合成负载测量；不在设计阶段预设未经验证的“支持 N 人”承诺。
6. **Agent 接入：** MCP 复用同一身份与授权服务；不能给 MCP 一个绕过 API owner checks 的直连数据库或任意 shell 工具。

## 13. 下一步可交付切片

本轮已实现单进程内的 Job 输入快照、`runs/<job_id>/` 独立目录、有界 worker pool、单机 owner authorization 接缝及 per-user blob namespace，并覆盖并发上限、快照稳定性和旧库迁移测试。仍未实现 SQLite 原子 worker claim/lease 和跨进程协调。下一步应先补这组队列可靠性能力与重启/多实例测试，再单独接入正式身份提供方、OS 级 worker 隔离和资源配额；这些完成前，服务继续保持 loopback-only。
