#!/usr/bin/env bash
# 启动后端服务：附带 log4j2 日志目录与 JVM GC 日志
set -euo pipefail

APP_HOME="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${LOG_DIR:-$APP_HOME/logs}"
JAR="${JAR:-$APP_HOME/target/my_common_util-0.0.1-SNAPSHOT.jar}"

if [[ ! -f "$JAR" ]]; then
  echo "未找到 jar：$JAR"
  echo "请先执行：./mvnw -DskipTests package"
  exit 1
fi

mkdir -p "$LOG_DIR"

# GC 日志单独写入 logs/gc.log（按大小滚动）
# 访问日志：logs/access.log（按天）
# 服务日志：logs/app.log（按天）
exec java \
  -DLOG_PATH="$LOG_DIR" \
  -Xlog:gc*:file="$LOG_DIR/gc.log":time,uptime,level,tags:filecount=10,filesize=20M \
  -jar "$JAR" \
  "$@"
