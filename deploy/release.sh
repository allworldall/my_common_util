#!/usr/bin/env bash
# 一键发布：本地打包 → 同步到服务器 → restart systemd
#
# 用法：
#   ./deploy/release.sh                 # 读 deploy/deploy.env
#   ./deploy/release.sh prod            # 读 deploy/deploy.env.prod
#   ./deploy/release.sh --skip-build    # 跳过打包，只上传并重启
#   ./deploy/release.sh prod --skip-build
#
# 首次上线额外建议（手动一次即可）：
#   1) 配置 nginx（参考 deploy/nginx.conf.example）
#   2) 安装 systemd：sudo cp deploy/my-common-util.service /etc/systemd/system/ && daemon-reload && enable
#   3) 配置环境变量：/etc/service_env/my_common_util（参考 deploy/env.example）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_NAME=""
SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      if [[ -n "$ENV_NAME" ]]; then
        echo "未知参数：$arg"
        exit 1
      fi
      ENV_NAME="$arg"
      ;;
  esac
done

if [[ -n "$ENV_NAME" ]]; then
  ENV_FILE="$ROOT/deploy/deploy.env.$ENV_NAME"
else
  ENV_FILE="$ROOT/deploy/deploy.env"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "缺少部署配置：$ENV_FILE"
  echo "请先：cp deploy/deploy.env.example ${ENV_FILE#$ROOT/}"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${DEPLOY_HOST:?请在 $ENV_FILE 设置 DEPLOY_HOST}"
: "${DEPLOY_USER:?请在 $ENV_FILE 设置 DEPLOY_USER}"
: "${APP_HOME:?请在 $ENV_FILE 设置 APP_HOME}"
: "${FRONTEND_REMOTE:?请在 $ENV_FILE 设置 FRONTEND_REMOTE}"
: "${SERVICE_NAME:?请在 $ENV_FILE 设置 SERVICE_NAME}"
DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"

JAR_NAME="my_common_util-0.0.1-SNAPSHOT.jar"
LOCAL_JAR="$ROOT/target/$JAR_NAME"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
SSH=(ssh -p "$DEPLOY_SSH_PORT" "$REMOTE")
SCP=(scp -P "$DEPLOY_SSH_PORT")

echo "==> 目标：$REMOTE  APP_HOME=$APP_HOME"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "==> 打包（需本机 JDK 21）"
  ./mvnw -B -DskipTests package
else
  echo "==> 跳过打包"
fi

if [[ ! -f "$LOCAL_JAR" ]]; then
  echo "未找到 $LOCAL_JAR，请先打包"
  exit 1
fi

echo "==> 上传后端（jar + start.sh）"
"${SSH[@]}" "mkdir -p '$APP_HOME/logs'"
"${SCP[@]}" \
  "$ROOT/deploy/start.sh" \
  "$LOCAL_JAR" \
  "${REMOTE}:${APP_HOME}/"
"${SSH[@]}" "chmod +x '$APP_HOME/start.sh'"

echo "==> 上传前端"
"${SSH[@]}" "mkdir -p '$FRONTEND_REMOTE' && find '$FRONTEND_REMOTE' -mindepth 1 -delete"
(
  cd "$ROOT/frontend"
  "${SCP[@]}" -r . "${REMOTE}:${FRONTEND_REMOTE}/"
)

echo "==> 重启服务 $SERVICE_NAME"
"${SSH[@]}" "systemctl restart '$SERVICE_NAME' && systemctl is-active '$SERVICE_NAME'"

echo "==> 完成"
