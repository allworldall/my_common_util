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
#   1) 配置 nginx：把 deploy/nginx.conf.example 放到 /etc/nginx/conf.d/my_common_util.conf
#      （Alibaba Cloud Linux / RHEL 系用 conf.d，不用 sites-available/sites-enabled）
#      然后：sudo nginx -t && sudo systemctl reload nginx
#   2) 安装 systemd：sudo cp deploy/my-common-util.service /etc/systemd/system/ && daemon-reload && enable
#      （unit 内需含 SPRING_PROFILES_ACTIVE=prod，加载 application-prod.yaml）
#   3) 配置环境变量：/etc/service_env/my_common_util（参考 deploy/env.example；邮件等密钥）
#   4) 普通用户部署：配置 sudoers（参考 deploy/sudoers.example），并把 APP_HOME 属主交给 DEPLOY_USER
#   5) 免密手输：填写 deploy/ssh-with-pass.local.sh（从 .example 复制，不入库）
# 说明：本脚本不修改 nginx；只打包/同步 jar+前端并 restart Java 服务。
#
# 说明：release.sh 的参数 prod 指「发布目标配置 deploy.env.prod」，
#       与 Spring 运行时 profile（local/prod）不是同一概念。
#
# 有密码脚本时：全部 ssh/scp 统一走自动填密，不再手输。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_NAME=""
SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help)
      sed -n '2,17p' "$0"
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

# 非 root 部署时，systemctl 走 sudo（需配 NOPASSWD，见 deploy/sudoers.example）
if [[ -z "${DEPLOY_USE_SUDO:-}" ]]; then
  if [[ "$DEPLOY_USER" == "root" ]]; then
    DEPLOY_USE_SUDO=0
  else
    DEPLOY_USE_SUDO=1
  fi
fi

JAR_NAME="my_common_util-0.0.1-SNAPSHOT.jar"
LOCAL_JAR="$ROOT/target/$JAR_NAME"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

# ---- 密码脚本：所有 ssh/scp 统一调用，不再有的走有的不走 ----
SSH_PASS_SCRIPT="$ROOT/deploy/ssh-with-pass.local.sh"
ASKPASS_SCRIPT="$ROOT/deploy/ssh-askpass.sh"
USE_ASKPASS=0
if [[ -f "$SSH_PASS_SCRIPT" ]]; then
  # shellcheck disable=SC1090
  source "$SSH_PASS_SCRIPT"
  if [[ -z "${DEPLOY_SSH_PASS:-}" || "$DEPLOY_SSH_PASS" == "在这里粘贴密码" ]]; then
    echo "错误：deploy/ssh-with-pass.local.sh 存在，但 DEPLOY_SSH_PASS 还是占位符"
    exit 1
  fi
  if [[ ! -x "$ASKPASS_SCRIPT" ]]; then
    chmod +x "$ASKPASS_SCRIPT" 2>/dev/null || true
  fi
  if [[ ! -f "$ASKPASS_SCRIPT" ]]; then
    echo "错误：缺少 $ASKPASS_SCRIPT"
    exit 1
  fi
  export DEPLOY_SSH_PASS
  export SSH_ASKPASS="$ASKPASS_SCRIPT"
  export SSH_ASKPASS_REQUIRE=force
  export DISPLAY="${DISPLAY:-:0}"
  USE_ASKPASS=1
fi

# SSH 连接复用 +（可选）自动填密
# ControlPath 必须短：macOS TMPDIR 很长，否则会报 unix_listener path too long
SSH_CTRL_DIR="/tmp/toolkit-ssh-$USER"
mkdir -p "$SSH_CTRL_DIR"
SSH_CTRL_PATH="$SSH_CTRL_DIR/%C"
SSH_OPTS=(
  -o StrictHostKeyChecking=accept-new
  -o PreferredAuthentications=password
  -o PubkeyAuthentication=no
  -o ControlMaster=auto
  -o "ControlPath=$SSH_CTRL_PATH"
  -o ControlPersist=120
)
SSH=(ssh -p "$DEPLOY_SSH_PORT" "${SSH_OPTS[@]}" "$REMOTE")
SCP=(scp -P "$DEPLOY_SSH_PORT" "${SSH_OPTS[@]}")

cleanup_ssh() {
  ssh -p "$DEPLOY_SSH_PORT" -o "ControlPath=$SSH_CTRL_PATH" -O exit "$REMOTE" 2>/dev/null || true
}

# 统一入口：有密码脚本时全部走 ASKPASS；没有则退回手输（仍只输一次，靠连接复用）
run_ssh() {
  if [[ "$USE_ASKPASS" == "1" ]]; then
    "${SSH[@]}" "$@" < /dev/null
  else
    "${SSH[@]}" "$@"
  fi
}
run_scp() {
  if [[ "$USE_ASKPASS" == "1" ]]; then
    "${SCP[@]}" "$@" < /dev/null
  else
    "${SCP[@]}" "$@"
  fi
}

remote_sys() {
  if [[ "$DEPLOY_USE_SUDO" == "1" ]]; then
    run_ssh "sudo systemctl $*"
  else
    run_ssh "systemctl $*"
  fi
}

echo "==> 目标：$REMOTE  APP_HOME=$APP_HOME  sudo=$DEPLOY_USE_SUDO"
if [[ "$USE_ASKPASS" == "1" ]]; then
  echo "==> SSH：全部远程操作走 ssh-with-pass.local.sh 自动填密（无需手输）"
else
  echo "==> SSH：未配置密码脚本，将手输 1 次密码（连接复用）"
  echo "    免手输请：cp deploy/ssh-with-pass.local.example deploy/ssh-with-pass.local.sh 并填写密码"
fi

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

echo "==> 连接服务器"
run_ssh "true"

# 必须先停再覆盖 jar：Spring Boot fat jar 被运行中进程占用时，
# 直接 scp 覆盖会导致旧进程关闭时报
# NoClassDefFoundError: org/apache/catalina/Lifecycle$SingleUse
echo "==> 停止服务 ${SERVICE_NAME} (避免覆盖正在运行的 jar)"
remote_sys stop "${SERVICE_NAME}" || true

echo "==> 上传后端（jar + start.sh + pdf2docx 脚本）"
run_ssh "mkdir -p '$APP_HOME/logs'"
run_scp \
  "$ROOT/deploy/start.sh" \
  "$ROOT/deploy/pdf2docx_convert.py" \
  "$LOCAL_JAR" \
  "${REMOTE}:${APP_HOME}/"
# start.sh / pdf2docx_convert.py 本地已是可执行，scp 会带上 +x
# （若文件仍属 root，webuser 去 chmod 会 Operation not permitted）

echo "==> 上传前端"
run_ssh "mkdir -p '$FRONTEND_REMOTE' && find '$FRONTEND_REMOTE' -mindepth 1 -delete"

FRONTEND_STAGE="$(mktemp -d "${TMPDIR:-/tmp}/toolkit-frontend.XXXXXX")"
cleanup_all() {
  rm -rf "$FRONTEND_STAGE"
  cleanup_ssh
}
trap cleanup_all EXIT
cp -R "$ROOT/frontend/." "$FRONTEND_STAGE/"

# 把 SEO 占位符替换成真实域名（robots / sitemap / site-config / 各页 canonical）
SITE_ORIGIN="${SITE_ORIGIN:-}"
SITE_ORIGIN="${SITE_ORIGIN%/}"
if [[ -n "$SITE_ORIGIN" ]]; then
  echo "==> SEO 域名：$SITE_ORIGIN"
  while IFS= read -r -d '' f; do
    # macOS / Linux 兼容的原地替换
    sed "s|__SITE_ORIGIN__|${SITE_ORIGIN}|g" "$f" > "${f}.tmp" && mv "${f}.tmp" "$f"
  done < <(find "$FRONTEND_STAGE" -type f \( -name '*.html' -o -name '*.js' -o -name '*.txt' -o -name '*.xml' \) -print0)
else
  echo "==> 未设置 SITE_ORIGIN，跳过 robots/sitemap 域名替换（建议在 deploy.env 配置）"
fi

(
  cd "$FRONTEND_STAGE"
  run_scp -r . "${REMOTE}:${FRONTEND_REMOTE}/"
)

# Nginx 需要能读前端；失败多半是目录仍属 root，需服务器上一次性 chown 给 webuser
echo "==> 修正前端目录权限（供 nginx 读取）"
run_ssh "chmod 755 '$APP_HOME' '$FRONTEND_REMOTE' 2>/dev/null || true; find '$FRONTEND_REMOTE' -type d -exec chmod 755 {} + 2>/dev/null || true; find '$FRONTEND_REMOTE' -type f -exec chmod 644 {} + 2>/dev/null || true"
echo "==> 启动服务 ${SERVICE_NAME}"
# unit 文件若刚改过，reload 一次避免 stale 配置
remote_sys daemon-reload
remote_sys start "${SERVICE_NAME}"
remote_sys is-active "${SERVICE_NAME}"

echo "==> 完成"
