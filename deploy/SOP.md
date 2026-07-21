# 部署 SOP

日常发布**不用多次手动 scp**。配好一次后，本机执行一条命令即可：

```bash
./deploy/release.sh
```

脚本会自动完成：打包 → 同步 jar / start.sh / 前端 → 重启服务。

---

## 一、架构（先搞清两块）

| 部分 | 线上路径 | 谁在跑 |
|------|----------|--------|
| 后端 jar + start.sh + logs | `/var/app/my_common_util/` | systemd → `start.sh` → java |
| 前端静态文件 | `/var/www/my_common_util/frontend/` | Nginx 直接托管 |
| API 反代 | Nginx `/api/` → `127.0.0.1:8080` | Nginx |

---

## 二、开发完成后：本机怎么测

1. 后端（JDK 21）：
   ```bash
   ./mvnw -DskipTests package
   ./deploy/start.sh
   ```
   默认监听 `http://localhost:8080`

2. 前端（另开终端）：
   ```bash
   cd frontend && python3 -m http.server 5500
   ```
   浏览器打开 `http://localhost:5500`  
   （`api-config.js` 在本地非 8080 端口时会自动指向 `http://localhost:8080`）

3. 自测通过后再发布。

---

## 三、云服务器：首次部署（只做一次）

在能 SSH 登录服务器的前提下操作。

### 1. 本机准备发布配置

```bash
cp deploy/deploy.env.example deploy/deploy.env
```

编辑 `deploy/deploy.env`，填真实值，例如：

```bash
DEPLOY_HOST=你的服务器IP或域名
DEPLOY_USER=webuser
DEPLOY_SSH_PORT=22
APP_HOME=/var/app/my_common_util
FRONTEND_REMOTE=/var/app/my_common_util/frontend
SERVICE_NAME=my-common-util
```

确认本机可免密 SSH（普通用户）：

```bash
ssh -p 22 webuser@你的服务器IP
```

### 2. 服务器装运行环境

- JDK 21（`java -version` 能看到 21）
- Nginx
- 目录（属主交给部署用户，避免再次出现 403）：
  ```bash
  sudo mkdir -p /var/app/my_common_util/logs
  sudo mkdir -p /var/app/my_common_util/frontend
  sudo mkdir -p /etc/service_env
  sudo chown -R webuser:webuser /var/app/my_common_util
  sudo chmod 755 /var/app/my_common_util /var/app/my_common_util/frontend
  ```

### 2.1 普通用户重启服务权限（只需一次）

```bash
# 本机
scp deploy/sudoers.example root@服务器:/tmp/my-common-util-sudoers
# 服务器（root）
sudo cp /tmp/my-common-util-sudoers /etc/sudoers.d/my-common-util
sudo chmod 440 /etc/sudoers.d/my-common-util
sudo visudo -cf /etc/sudoers.d/my-common-util
```

确认 `webuser` 可无密码执行：

```bash
sudo -u webuser sudo -n systemctl is-active my-common-util
```

### 3. 服务器配业务环境变量（邮件等）

```bash
# 本机把示例拷上去后在服务器编辑
scp deploy/env.example root@服务器:/etc/service_env/my_common_util
ssh root@服务器 'vim /etc/service_env/my_common_util'
```

至少填：`MAIL_USERNAME`、`MAIL_AUTH_CODE`。

### 4. 服务器装 systemd

把仓库里的 unit 拷到服务器（首次一次即可；`User=` 需与 `DEPLOY_USER` 一致）：

```bash
scp deploy/my-common-util.service root@服务器:/etc/systemd/system/my-common-util.service
ssh root@服务器 'systemctl daemon-reload && systemctl enable my-common-util'
```

此时还没有 jar，先不急 restart；下一步发布脚本会带上 jar 和 start.sh。

### 5. 服务器配 Nginx

参考 `deploy/nginx.conf.example`，改 `server_name` / 路径后启用，并 `nginx -t && systemctl reload nginx`。

建议同时在 `deploy/deploy.env` 填写 `SITE_ORIGIN`（如 `https://你的域名`，无末尾斜杠）。  
发布时会自动写入 `robots.txt` / `sitemap.xml` / canonical，便于搜索引擎收录。  
上线后把 `https://你的域名/sitemap.xml` 提交到百度站长 / Google Search Console。

### 6. 本机第一次正式发布

```bash
./deploy/release.sh
```

然后浏览器访问你的域名或 `http://服务器IP`，测页面和接口。

日志位置：

- 访问：`/var/app/my_common_util/logs/access.log`
- 业务：`/var/app/my_common_util/logs/app.log`
- GC：`/var/app/my_common_util/logs/gc.log`

---

## 四、以后每次发版（常规流程）

开发自测通过后，在本机项目根目录：

```bash
./deploy/release.sh
```

就这一条。不需要再手敲多次 scp。

| 场景 | 命令 |
|------|------|
| 正常发版（打包+上传+重启） | `./deploy/release.sh` |
| 刚打过包，只重新上传重启 | `./deploy/release.sh --skip-build` |
| 多环境（如 prod） | `./deploy/release.sh prod`（对应 `deploy/deploy.env.prod`） |

查看服务：

```bash
ssh webuser@服务器 'sudo systemctl status my-common-util'
ssh webuser@服务器 'journalctl -u my-common-util -n 100 --no-pager'
```

回滚（简单做法）：保留上一版 jar，SSH 上去换回旧 jar 后 `sudo systemctl restart my-common-util`。

---

## 五、这次改动（图片扫描 / 日志等）怎么上

1. **本机**：按「第二节」起服务，测问题反馈、工具需求、图片扫描、接口是否正常。  
2. **确认** `deploy/deploy.env` 已配好。  
3. **若服务器还是旧的 `java -jar` unit**：先按「第三节」换成 `my-common-util.service`（走 `start.sh`），只需一次。  
4. **本机执行**：`./deploy/release.sh`  
5. **线上抽测**：首页按钮、图片扫描、看 `logs/` 是否写出 access/app/gc。

---

## 六、常见问题

**Q：要 scp 很多次吗？**  
A：不用。日常只跑 `release.sh`；脚本内部用 scp 上传后端和前端。

**Q：改前端也要重启 java 吗？**  
A：会 restart（脚本统一重启）。只改前端时也可以接受；若以后要拆「只同步前端不重启」，再说。

**Q：密钥 / 主机写在哪？**  
A：`deploy/deploy.env`（已 gitignore，勿提交）。邮件在服务器 `/etc/service_env/my_common_util`。
