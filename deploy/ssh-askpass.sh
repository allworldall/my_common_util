#!/bin/sh
# OpenSSH 会调用本脚本获取密码（不要在这里写死密码）
# 密码来自环境变量 DEPLOY_SSH_PASS（由 ssh-with-pass.local.sh 提供）
[ -n "$DEPLOY_SSH_PASS" ] || exit 1
printf '%s\n' "$DEPLOY_SSH_PASS"
