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
| 前端静态文件 | `/var/www/my_common_util/frontend/` 或与 APP_HOME 同级 `frontend/` | Nginx 直接托管 |
| API 反代 | Nginx `/api/` → `127.0.0.1:8080` | Nginx |

### 环境隔离（Spring Profile）

| 环境 | profile | 配置文件 | 如何启用 |
|------|---------|----------|----------|
| 本机开发/测试 | `local` | `application.yaml` + `application-local.yaml` | `./deploy/start.sh` 检测到 jar 在 `target/` 时默认 |
| 线上 | `prod` | `application.yaml` + `application-prod.yaml` | systemd `SPRING_PROFILES_ACTIVE=prod` |
| 单元测试 | `test` | `application-test.yaml` | `@ActiveProfiles("test")` |

差异项（如 LibreOffice 路径、限流）写在对应 `application-{profile}.yaml`，**不要**把本机路径写进公共 `application.yaml`。  
密钥（邮件授权码等）仍放服务器 `/etc/service_env/my_common_util`，用环境变量注入。

---

## 二、开发完成后：本机怎么测

1. 后端（JDK 21）：
   ```bash
   ./mvnw -DskipTests package
   ./deploy/start.sh
   ```
   启动日志应出现：`Starting with spring.profiles.active=local`  
   默认监听 `http://localhost:8080`

2. 前端（另开终端）：
   ```bash
   cd frontend && python3 -m http.server 5500
   ```
   浏览器打开 `http://localhost:5500`  
   （`api-config.js` 在本地非 8080 端口时会自动指向 `http://localhost:8080`）

3. **测 Word↔PDF 前**，本机需安装依赖：

   **Word→PDF**：LibreOffice  
   ```bash
   # macOS
   brew install --cask libreoffice
   ls "/Applications/LibreOffice.app/Contents/MacOS/soffice"
   ```
   路径写在 `application-local.yaml` 的 `doc.convert.soffice-path`（macOS 默认已写好）。  
   若本机是 Linux，改成 `/usr/bin/soffice`。

   **PDF→Word（推荐）**：Python **3.8+** + `pdf2docx`（比 LibreOffice 保真更好；失败会自动回退 LibreOffice）  
   ```bash
   # macOS：建议用较新的 python（系统自带若过旧，pip 会卡在编译 PyMuPDF）
   brew install python
   # 或确认：python3 --version  >= 3.8，并先升级 pip（旧 pip 常装不上轮子）
   python3 -m pip install -U pip
   python3 -m pip install -U -r deploy/requirements-pdf2docx.txt
   python3 -c "from pdf2docx import Converter; print('pdf2docx ok')"
   python3 deploy/pdf2docx_convert.py   # 应提示 usage
   ```
   脚本路径一般不用配：本机跑在仓库根目录时会自动找到 `deploy/pdf2docx_convert.py`。

4. **测 PDF 压缩前**，本机需安装 Ghostscript：
   ```bash
   # macOS
   brew install ghostscript
   gs --version
   ```
   一般能自动探测；若找不到可在本地 profile 配 `pdf.compress.gs-path`。

5. 需要强制指定环境时：
   ```bash
   SPRING_PROFILES_ACTIVE=local ./deploy/start.sh
   ```

6. 自测通过后再发布。

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
- LibreOffice（**Word→PDF**；也作为 PDF→Word 回退；无 GUI 装 headless 即可）  
  先看系统类型：`cat /etc/os-release`
  ```bash
  # Debian / Ubuntu
  sudo apt-get update
  sudo apt-get install -y libreoffice-writer libreoffice-java-common libreoffice-pdfimport
  # 中文字体（缺了 Word→PDF 中文会变方框）
  sudo apt-get install -y fonts-wqy-microhei fonts-noto-cjk

  # CentOS / RHEL / Alma / Rocky / OpenCloudOS / Alibaba Cloud Linux 等（yum）
  sudo yum install -y libreoffice-writer libreoffice-pdfimport
  sudo yum install -y wqy-microhei-fonts google-noto-sans-cjk-ttc-fonts

  # 较新的 Fedora / RHEL 系（dnf）
  sudo dnf install -y libreoffice-writer libreoffice-pdfimport
  sudo dnf install -y wqy-microhei-fonts google-noto-sans-cjk-ttc-fonts

  # 安装后确认
  soffice --version || libreoffice --version
  which soffice libreoffice
  fc-list :lang=zh | head
  sudo fc-cache -fv
  ```
  线上路径写在 `application-prod.yaml`（默认 `/usr/bin/soffice`）。  
  若 `which soffice` 不是这个路径，可改 `application-prod.yaml`，或在 `/etc/service_env/my_common_util` 设：
  ```bash
  DOC_CONVERT_SOFFICE_PATH=/实际路径/soffice
  ```
  **注意**：2G 内存机器转换时可能吃紧，建议加 swap 或控制文件大小。  
  **注意**：PDF 中文变方框 / 「乱码」，几乎都是服务器缺中文字体，装完字体后一般**不用重启** Java，再转一次即可。

- Python **3.8+** + `pdf2docx`（**PDF→Word 主路径**；`release.sh` 会上传 `pdf2docx_convert.py` 到 `APP_HOME`）  

  > 注意：Alibaba Cloud Linux / 部分 RHEL8 系默认 `python3` 仍是 **3.6**，装不了新版 `pdf2docx`。请单独装 `python38`。

  ```bash
  # Alibaba Cloud Linux / RHEL8 系
  sudo yum install -y python38 python38-pip
  python3.8 --version

  # 上传依赖清单后安装（本机执行 scp，或手动拷）
  # scp deploy/requirements-pdf2docx.txt deploy/pdf2docx_convert.py webuser@服务器:/tmp/
  sudo python3.8 -m pip install -U pip
  sudo python3.8 -m pip install -U -r /tmp/requirements-pdf2docx.txt

  # 验证
  python3.8 -c "from pdf2docx import Converter; print('pdf2docx ok')"
  # 脚本由 release.sh 部署；也可先手动放一份
  sudo cp /tmp/pdf2docx_convert.py /var/app/my_common_util/pdf2docx_convert.py
  sudo chmod 755 /var/app/my_common_util/pdf2docx_convert.py
  ```

  `/etc/service_env/my_common_util` 建议写上：
  ```bash
  DOC_CONVERT_PYTHON_BIN=/usr/bin/python3.8
  DOC_CONVERT_PDF2DOCX_SCRIPT=/var/app/my_common_util/pdf2docx_convert.py
  ```
  改完环境变量后 `sudo systemctl restart my-common-util`。  
  成功日志会出现：`PDF→Word 使用 pdf2docx 完成`；若库未装好会 WARN 后回退 LibreOffice。

- Ghostscript（**PDF 压缩**；`pdf.compress` 依赖 `gs`）
  ```bash
  # Debian / Ubuntu
  sudo apt-get install -y ghostscript
  # CentOS / RHEL / Alma / Rocky / OpenCloudOS / Alibaba Cloud Linux
  sudo yum install -y ghostscript
  # 较新的 Fedora / RHEL 系
  sudo dnf install -y ghostscript

  # 安装后确认
  gs --version
  which gs
  ```
  线上路径写在 `application-prod.yaml`（默认 `/usr/bin/gs`）。  
  若 `which gs` 不是这个路径，可改配置或在 `/etc/service_env/my_common_util` 设：
  ```bash
  PDF_COMPRESS_GS_PATH=/实际路径/gs
  ```
  **本机开发**：`brew install ghostscript`，一般能自动探测到。  
  **注意**：大文件压缩偏耗 CPU/内存，与 Word 转换类似，建议控制并发（服务端已串行化）。

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
**不要**在这里靠改 profile 区分环境——线上 profile 由 systemd 固定为 `prod`。

### 4. 服务器装 systemd

把仓库里的 unit 拷到服务器（首次一次即可；`User=` 需与 `DEPLOY_USER` 一致）：

```bash
scp deploy/my-common-util.service root@服务器:/etc/systemd/system/my-common-util.service
ssh root@服务器 'systemctl daemon-reload && systemctl enable my-common-util'
```

确认 unit 里有：

```ini
Environment=SPRING_PROFILES_ACTIVE=prod
```

此时还没有 jar，先不急 restart；下一步发布脚本会带上 jar 和 start.sh。

### 5. 服务器配 Nginx

本仓库服务器为 Alibaba Cloud Linux / RHEL 系：Nginx **只加载** `/etc/nginx/conf.d/*.conf`，**不要**用 Debian 的 `sites-available` / `sites-enabled`（即使建了也不会生效，除非改 `nginx.conf` 去 include）。

1. 申请域名证书（阿里云免费 DV 即可），放到例如 `/etc/nginx/ssl/`。
2. 参考 `deploy/nginx.conf.example`，改 `server_name` / 证书路径 / `root` 后拷到服务器：
   ```bash
   # 本机
   scp deploy/nginx.conf.example webuser@服务器:/tmp/my_common_util.conf
   # 服务器
   sudo cp /tmp/my_common_util.conf /etc/nginx/conf.d/my_common_util.conf
   sudo nginx -t && sudo systemctl reload nginx
   ```
   示例配置已包含：HTTPS、www→裸域、真 404、安全响应头、`/api` 限流。  
   **PDF 压缩**路径 `/api/pdf/compress` 单独放宽到 `client_max_body_size 110m`、超时约 200s；若服务器上是旧版 nginx 配置，发版后请同步 `nginx.conf.example` 再 `nginx -t && reload`。
3. 阿里云安全组放行 **TCP 80 / 443**，**不要**对公网开放 8080（Java 在 prod 绑定 `127.0.0.1`）。
4. 大陆机房域名需完成 ICP 备案；备案通过后在 `frontend/js/site-config.js` 填写 `icp`（如 `浙ICP备xxxxxxxx号`），再发版。
5. 验证：
   ```bash
   sudo ss -lntp | grep -E ':80|:443'
   curl -I https://你的域名
   curl -I http://你的域名          # 应 301 到 https://裸域
   curl -I https://www.你的域名     # 应 301 到 https://裸域
   curl -I https://你的域名/not-exist  # 应 404
   ```

`release.sh` **不会**改 Nginx；日常发版只同步 jar/前端并重启 Java。

建议同时在 `deploy/deploy.env` 填写 `SITE_ORIGIN`（如 `https://你的域名`，无末尾斜杠）。  
发布时会替换前端里所有 `__SITE_ORIGIN__`（robots / sitemap / canonical / og 等）。  
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

启动后在 `app.log` / journal 里应能看到 `spring.profiles.active=prod`（或 start.sh 打印的 Starting with ...）。

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
| 多套发布目标（如 prod 机器） | `./deploy/release.sh prod`（对应 `deploy/deploy.env.prod`，这是**发布目标**，与 Spring profile 不是一回事） |

查看服务：

```bash
ssh webuser@服务器 'sudo systemctl status my-common-util'
ssh webuser@服务器 'journalctl -u my-common-util -n 100 --no-pager'
```

回滚（简单做法）：保留上一版 jar，SSH 上去换回旧 jar 后 `sudo systemctl restart my-common-util`。

---

## 五、这次改动怎么上

1. **本机**：按「第二节」起服务（确认 profile=`local`），测 Word↔PDF、图片扫描等。  
2. **确认** `deploy/deploy.env` 已配好。  
3. **若服务器 systemd 还是旧 unit**：重新拷贝 `my-common-util.service`（需含 `SPRING_PROFILES_ACTIVE=prod`），然后：
   ```bash
   ssh root@服务器 'systemctl daemon-reload && systemctl restart my-common-util'
   ```
4. **本机执行**：`./deploy/release.sh`  
5. **线上抽测**：确认 journal/start 日志为 `prod`，再测 Word↔PDF。

---

## 六、常见问题

**Q：要 scp 很多次吗？**  
A：不用。日常只跑 `release.sh`；脚本内部用 scp 上传后端和前端。

**Q：改前端也要重启 java 吗？**  
A：会 restart（脚本统一重启）。只改前端时也可以接受；若以后要拆「只同步前端不重启」，再说。

**Q：密钥 / 主机写在哪？**  
A：发布目标在 `deploy/deploy.env`（已 gitignore，勿提交）。邮件在服务器 `/etc/service_env/my_common_util`。

**Q：本机和线上 LibreOffice 路径不同怎么办？**  
A：分别写在 `application-local.yaml` / `application-prod.yaml`，用 Spring profile 隔离。不要写死进公共 `application.yaml`。

**Q：PDF→Word 和 Word→PDF 分别用什么？**  
A：Word→PDF 用 LibreOffice；PDF→Word **优先 pdf2docx**，失败再回退 LibreOffice。前端已提示结果需人工核对。

**Q：线上 PDF→Word 仍很差 / 日志在回退 LibreOffice？**  
A：先确认 `python3 -c "import pdf2docx"` 成功，且 `/var/app/my_common_util/pdf2docx_convert.py` 存在；再 `journalctl -u my-common-util -n 80` 看是否有 `pdf2docx 失败`。

**Q：线上怎么确认当前是 prod？**  
A：看启动输出 `Starting with spring.profiles.active=prod`，或 `journalctl -u my-common-util -n 50`。

**Q：`release.sh prod` 和 Spring 的 `prod` 一样吗？**  
A：不一样。`release.sh prod` 读的是 `deploy/deploy.env.prod`（发布到哪台机器）；Spring `prod` 是应用运行配置（`application-prod.yaml`）。
