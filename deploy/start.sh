#!/usr/bin/env bash
# 统一启动入口：本地 / 线上都用这个脚本，systemd 也指向它。
# 可通过环境变量覆盖（建议写在 EnvironmentFile 里）：
#   APP_HOME                 应用根目录
#   JAR                      jar 完整路径
#   LOG_DIR                  日志目录（access/app/gc）
#   JAVA_BIN                 java 可执行文件
#   SPRING_PROFILES_ACTIVE   Spring 环境：local（本机）/ prod（线上）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

resolve_app_home() {
  if [[ -n "${APP_HOME:-}" ]]; then
    printf '%s\n' "$APP_HOME"
    return
  fi
  # 线上常见布局：start.sh 与 jar 放在同一目录
  if compgen -G "$SCRIPT_DIR/my_common_util-*.jar" > /dev/null; then
    printf '%s\n' "$SCRIPT_DIR"
    return
  fi
  # 本地开发：仓库里的 deploy/start.sh，jar 在 ../target/
  printf '%s\n' "$(cd "$SCRIPT_DIR/.." && pwd)"
}

APP_HOME="$(resolve_app_home)"
LOG_DIR="${LOG_DIR:-$APP_HOME/logs}"
JAVA_BIN="${JAVA_BIN:-java}"

if [[ -n "${JAR:-}" ]]; then
  :
elif [[ -f "$APP_HOME/my_common_util-0.0.1-SNAPSHOT.jar" ]]; then
  JAR="$APP_HOME/my_common_util-0.0.1-SNAPSHOT.jar"
elif [[ -f "$APP_HOME/target/my_common_util-0.0.1-SNAPSHOT.jar" ]]; then
  JAR="$APP_HOME/target/my_common_util-0.0.1-SNAPSHOT.jar"
else
  # 兼容改名后的唯一 jar
  shopt -s nullglob
  candidates=("$APP_HOME"/my_common_util-*.jar "$APP_HOME"/target/my_common_util-*.jar)
  shopt -u nullglob
  if ((${#candidates[@]} == 1)); then
    JAR="${candidates[0]}"
  else
    echo "未找到 jar，请设置 JAR，或放到以下位置之一："
    echo "  $APP_HOME/my_common_util-0.0.1-SNAPSHOT.jar"
    echo "  $APP_HOME/target/my_common_util-0.0.1-SNAPSHOT.jar"
    exit 1
  fi
fi

if [[ ! -f "$JAR" ]]; then
  echo "未找到 jar：$JAR"
  exit 1
fi

if ! command -v "$JAVA_BIN" >/dev/null 2>&1; then
  echo "未找到 java：$JAVA_BIN"
  exit 1
fi

mkdir -p "$LOG_DIR"
cd "$APP_HOME"

# Spring profile：
# - 已设置 SPRING_PROFILES_ACTIVE 时尊重外部环境（systemd 应固定为 prod）
# - 否则：jar 在 target/ → 本机开发用 local；其余按线上 prod
if [[ -z "${SPRING_PROFILES_ACTIVE:-}" ]]; then
  if [[ "$JAR" == *"/target/"* ]]; then
    SPRING_PROFILES_ACTIVE=local
  else
    SPRING_PROFILES_ACTIVE=prod
  fi
fi
export SPRING_PROFILES_ACTIVE
echo "Starting with spring.profiles.active=${SPRING_PROFILES_ACTIVE}"
echo "JAR=${JAR}"
echo "LOG_DIR=${LOG_DIR}"

# access.log / app.log：log4j2（-DLOG_PATH）
# gc.log：JVM 独立输出
exec "$JAVA_BIN" \
  -DLOG_PATH="$LOG_DIR" \
  -Dspring.profiles.active="$SPRING_PROFILES_ACTIVE" \
  -Xlog:gc*:file="$LOG_DIR/gc.log":time,uptime,level,tags:filecount=10,filesize=20M \
  -jar "$JAR" \
  "$@"
