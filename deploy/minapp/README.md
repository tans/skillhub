# minapp 生产部署手册

维护任务：JAI-57。核对时间：2026-11-26。源码仓库为 `tans/skillhub`（SSH origin：`git@github.com:tans/skillhub.git`）；同步源码不等于升级生产。

管理后台的前端发布覆盖、当前三文件 Compose 命令与回退方法见 [管理后台发布与使用](ADMIN.md)。以下 v0.2.26 清单是首次核对基线；启用 web 覆盖后以 `ADMIN.md` 和生产 `deployment.json` 为准。

## 已运行环境

| 项目 | 当前值 |
| --- | --- |
| 公网入口 | https://skillhub.minapp.xin / https://jie-skills.minapp.xin |
| 生产目录 / Compose 项目 | `/data/skillhub` / `skillhub` |
| 源码目录 | `/data/skillhub-code`，origin 指向 tans/skillhub |
| 发布版本 / 镜像源 | v0.2.26 / 阿里云 ACR `skill_hub` 命名空间 |
| 镜像源码 revision | `929f3f1b34a2ddd1739b8ba36715ae34e34173b3` |
| 编排 | `compose.release.yml` + `compose.host.yml` + 私有 `.env.release` |
| 回环端口 | web 3371、server 3370、PostgreSQL 15437、Redis 16387 |
| 持久卷 | `skillhub_postgres_data`、`skillhub_redis_data`、`skillhub_skillhub_storage` |
| 文件存储 / 认证 | local 存储 / 本地账号，Secure cookie |

生产目录不是 Git 仓库，不要在此执行 clone 或覆盖文件。两个域名共用相同后端和数据库；无须复制服务或数据。OpenResty 的两个站点配置位于 `/opt/1panel/apps/openresty/openresty/conf/conf.d/`，均反代 `127.0.0.1:3371`，证书各自独立。HTML 标题通过 `sub_filter` 改为 jie-skills；`/assets/` 保持直接代理。

`compose.host.yml` 限额：server 1024m、scanner 768m、postgres 256m、redis/web 各 128m；JVM 使用 `-Xms128m -Xmx512m -XX:MaxMetaspaceSize=256m`。

## 同步源码

本次使用 main 的浅克隆（同步基线 `629be65109cc634525243faa6399a9d279905b60`），保留完整工作树；需要历史时再执行 `git fetch --unshallow origin`。没有自动合并上游，也没有切换生产版本。

在 `/data/skillhub-code` 执行；不创建分支，不在生产目录执行开发脚本：

```bash
git status --short --branch
git fetch origin main
git merge --ff-only origin/main
git log -1 --format='%H %s'
```

工作区有修改或快进失败时先保留并处理差异，不使用 reset/stash 覆盖。添加上游只用于比较，合并上游与升级生产单独评估：

```bash
git remote add upstream https://github.com/iflytek/skillhub.git
git fetch upstream tag v0.2.26
git rev-parse 'v0.2.26^{commit}'
```

remote 已存在时跳过 add。main 与线上 v0.2.26 不是同一版本；生产镜像的 OCI revision 才是当前运行源码依据。开发环境使用独立 Compose 项目、端口和卷，禁止对生产执行 `make dev-all`、`make staging` 或任何 reset/clean。

## 备份与现有数据

运行镜像 digest、OCI revision 与卷挂载见同目录 `baseline-2026-11-26.json`；内存覆盖文件见 `compose.host.yml`。这两个文件均不含私有 env。

本次私有备份位于生产目录的 `backups/jai-57-20261126T095335Z/`，仅服务器 root 可读：

- `postgres.dump`：PostgreSQL custom-format 逻辑备份。
- `storage.tar`：完整本地技能/头像文件卷。
- `redis.rdb`：Redis RDB 快照。
- `private-config.tar`：私有 env、两个 Compose 文件、deployment.json。
- `proxy-config.tar`：两个 OpenResty 站点配置，不包含 TLS 私钥。
- `SHA256SUMS`：备份完整性校验。

这些文件含业务数据或凭证，不入 Git，不附到公开 issue。证书与 acme 续签账户需要另行纳入服务器备份策略。本次是在线备份，各组件不是同一时点；正式升级前安排写入维护窗口，暂停 server/scanner/可选同步任务后重新备份数据库与文件，以获得一致恢复点。备份复制到异机后才具备主机故障恢复能力。

本次数据基线：8 用户、89 技能、92 版本、511 条 skill_file 记录；存储卷 598 个文件，约 109 MiB。归档目录经 `pg_restore --list` 可读，未执行恢复演练。

重新备份时以权限 700 的专用目录保存产物，并使用当前容器和卷，而不是猜测数据目录：

```bash
umask 077
backup_dir="/data/skillhub/backups/manual-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -m 700 "$backup_dir"
docker exec skillhub-postgres-1 pg_dump -U skillhub -d skillhub -Fc > "$backup_dir/postgres.dump"
docker exec skillhub-server-1 tar -C /var/lib/skillhub/storage -cf - . > "$backup_dir/storage.tar"
tar -C /data/skillhub -cf "$backup_dir/private-config.tar" .env.release compose.release.yml compose.host.yml deployment.json
```

维护窗口内 server 暂停时，用临时容器只读挂载 `skillhub_skillhub_storage` 归档，不能对停止的 server 执行 docker exec。每步确认退出码后继续，并对所有备份生成 SHA256 校验；数据库用 `docker exec -i skillhub-postgres-1 pg_restore --list < "$backup_dir/postgres.dump"` 检查。

## 后续发布流程

1. 明确目标源码 SHA、三个组件镜像 tag/digest、Flyway 变化与旧版本兼容性。先在独立库上验证迁移和恢复；不能启动新 server “试一下”，启动本身会迁移数据库。
2. 在维护窗口完成一致备份，记录当前镜像 ID/digest、env 和挂载信息。备份先于修改配置和重建容器。
3. 从源码仓库的真实 Dockerfile/发布工作流构建镜像，推送可访问的仓库。镜像使用不可变标签，核对架构与 OCI revision；不要使用 latest 覆盖现有版本。
4. 在私有 `.env.release` 设置镜像仓库变量 `SKILLHUB_SERVER_IMAGE`、`SKILLHUB_WEB_IMAGE`、`SKILLHUB_SCANNER_IMAGE`（不带 tag），统一标签由 `SKILLHUB_VERSION` 提供。生产现有 Compose 会为三个组件追加同一个标签。保留全部数据库、存储、认证、邮件配置；不要把仓库 main 的 Compose 直接覆盖线上定制配置。
5. 固定目录、项目名、env 与覆盖文件。以下命令只在已完成发布准备时执行；配置校验不输出渲染后的敏感值：

   ```bash
   cd /data/skillhub
   docker compose -p skillhub --env-file .env.release -f compose.release.yml -f compose.host.yml config --quiet
   docker compose -p skillhub --env-file .env.release -f compose.release.yml -f compose.host.yml pull server web skill-scanner
   docker compose -p skillhub --env-file .env.release -f compose.release.yml -f compose.host.yml up -d server web skill-scanner
   docker compose -p skillhub --env-file .env.release -f compose.release.yml -f compose.host.yml ps
   ```

   每条命令失败即停止；restart 不加载新 env。storage-permissions 服务也引用 server 镜像，确认目标镜像仍有相同存储 UID/GID。不要执行 `down -v`、卷 prune 或重建空库。

6. 检查健康、Flyway 错误及两个域名；再验收登录、搜索、已有技能详情和 ZIP 下载。涉及发布/扫描变化时，用专用测试账号验证完整流程并清理本次创建的数据。确认数据基线和卷挂载，记录运行版本与未验项目。
7. 如修改 OpenResty，先检查配置再 reload，保留两个域名、证书与转发头。无边缘变更时不用重载。

## 回退与恢复

无数据库迁移且已确认兼容时，恢复备份中的私有配置及旧镜像引用，以相同项目名重建应用容器。不要只修改源码 revision。

有不兼容迁移时，回退应用镜像不等于回退数据库。停止写入，在隔离 PostgreSQL 和新存储卷恢复 `postgres.dump`/`storage.tar`，匹配旧镜像验证后再切换；恢复命令以目标实例、卷和数据库角色为准，禁止向现有生产库直接执行 `pg_restore --clean`。恢复 Redis 时先停应用和 Redis，再在其专用卷恢复 RDB，并处理原 AOF 避免其覆盖 RDB，先在隔离实例验证。恢复会丢失备份点之后的写入，执行前明确恢复点与业务窗口。

## 本次核验边界

两个域名首页 HTTP 200，公开 `/api/v1/skills?limit=1` 均返回相同 JSON，五个常驻容器健康，server 内部 `/actuator/health` 返回 JSON `UP`；数据库统计与存储挂载已核对。公网 `/actuator/health` 返回的是 SPA HTML，不能将其 HTTP 200 当后端健康证据。本次未升级/重建服务，未修改数据，未执行登录、发布或恢复演练。

线上 Compose 中发现 bootstrap 密码硬编码，与私有 env 的设计不一致；发布前应改为 env 引用并按现有管理员账号流程核对初始化状态，禁止提交该配置原件或默认口令。`SKILLHUB_BUILTIN_SKILLS_ENABLED` 当前为 true，与历史清理内置技能的目的可能不一致，调整需核对启动实现，不能假定已禁用。
