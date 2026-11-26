# 管理后台发布与使用

管理员登录后，从头像菜单进入「管理后台」，或打开 `/admin`。

- 用户管理 `/admin/users`：搜索、状态筛选、分页、账号审批与启停、平台角色调整、发起密码重置（依赖邮件配置）。
- 空间管理 `/admin/namespaces`：创建空间、搜索与筛选、成员添加/移除和角色调整、所有权转移、冻结/解冻、归档/恢复。
- 用户管理员可管理用户；空间管理仅超级管理员可用。页面权限与原后端鉴权同时生效，未改变现有角色模型。

本次复用 v0.2.26 的管理接口，仅替换 web；server、scanner、数据库与持久卷保持原版本。源码 main 与生产应用版本不同，不能因此顺带更新后端镜像或数据库迁移。

## 构建与发布

在源码根目录执行。先完成生产配置和数据库备份，确认工作区提交及目标镜像标签：

```bash
pnpm -C web install --frozen-lockfile
VITE_SITE_PRESENTATION_ENABLED=false pnpm -C web build
release_sha=$(git rev-parse HEAD)
docker build -f deploy/minapp/Dockerfile.web --build-arg SOURCE_REVISION="$release_sha" -t "skillhub-minapp-web:$release_sha" .
```

该 Dockerfile 复用现有生产 web 基础镜像的 nginx、入口脚本，并保留旧 hash 资源以支持发布前已经打开的页面；只覆盖新构建的静态文件。首次切换前，在临时容器验证真实管理员会话、用户列表、空间创建与刷新，再移除临时容器。

v0.2.26 没有站点展示配置接口，因此该构建显式关闭新版展示配置读取，使用默认页面内容，并保留 OpenResty 提供的 jie-skills 标题；不屏蔽其他接口的鉴权或服务错误。以后后端支持展示配置时再移除此构建参数。

将 `deploy/minapp/compose.web.yml` 复制到 `/data/skillhub/compose.web.yml`，在私有 `.env.release` 中设置 `SKILLHUB_MINAPP_WEB_IMAGE=skillhub-minapp-web:<完整提交 SHA>`。原有 `SKILLHUB_VERSION=v0.2.26` 保留。当前为本机镜像，异机重建需先构建或将镜像同步至私有仓库。

生产固定使用三个文件（包括今后的 ps/up/config）：

```bash
cd /data/skillhub
docker compose -p skillhub --env-file .env.release -f compose.release.yml -f compose.host.yml -f compose.web.yml config --quiet
docker compose -p skillhub --env-file .env.release -f compose.release.yml -f compose.host.yml -f compose.web.yml up -d --no-deps web
docker compose -p skillhub --env-file .env.release -f compose.release.yml -f compose.host.yml -f compose.web.yml ps
```

每步失败即停止。`--no-deps` 确保此次仅替换 web，两个域名仍转发相同的 3371 端口。通过浏览器验证 `/admin`、用户搜索、空间创建/成员/状态操作、退出登录后的拒绝访问，以及首页、技能详情和下载；仅清理本次创建的测试空间。

## 回退

将私有 env 中 `SKILLHUB_MINAPP_WEB_IMAGE` 改为备份记录的原 web 镜像完整名称，然后使用上述三个文件执行 `up -d --no-deps web`。无需恢复数据库或文件卷；本次未更改 schema。移除覆盖文件或忘记第三个 `-f` 会选择旧发布镜像，因此不要混用编排命令。

镜像标签、实际 image ID、源码 SHA、验收和回退目标记录在生产目录的 `deployment.json`；私有 env 不入库。
