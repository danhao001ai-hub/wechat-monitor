# 公众号监控与 AI 总结系统

[![Node.js Version](https://img.shields.io/badge/node->%3D16.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

🤖 **AI 驱动的微信公众号监控系统**，自动生成专业投资分析摘要并发送邮件通知。

## ✨ 功能特性

- 📰 **公众号监控** - 通过 WeWe-RSS 获取订阅的公众号文章
- 🤖 **AI 智能总结** - 使用 Gemini AI 生成专业投资分析
- 📧 **邮件推送** - HTML 格式邮件，支持 Markdown 渲染
- 🖥️ **桌面应用** - macOS 原生桌面应用，一键启动
- 🔄 **双模式运行**:
  - **检查更新** - 只抓取6小时内更新的文章
  - **全量更新** - 抓取所有公众号最新文章
- 🐳 **自动管理** - 自动启动 Docker 和 WeWe-RSS 服务

## 🚀 快速开始

### 方式一：一键安装（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/wechat-monitor.git
cd wechat-monitor

# 2. 运行安装脚本
npm run setup

# 3. 启动系统
npm start
```

### 方式二：手动安装

#### 1. 环境要求

- **macOS** (支持 Intel 和 Apple Silicon)
- **Node.js** >= 16.0 ([下载](https://nodejs.org/))
- **Docker Desktop** ([下载](https://www.docker.com/products/docker-desktop))

#### 2. 安装依赖

```bash
npm install
```

#### 3. 配置系统

```bash
# 运行交互式配置向导
npm run setup
```

或者手动配置：

1. 复制配置文件模板：
```bash
cp config/settings.example.json config/settings.json
```

2. 编辑 `config/settings.json`，填入你的信息：
```json
{
  "email": {
    "smtp_server": "smtp.163.com",
    "smtp_port": 465,
    "username": "你的邮箱@163.com",
    "password": "你的授权码",
    "to_email": "收件邮箱@163.com"
  },
  "ai": {
    "api_key": "sk-你的-Vector-Engine-API-Key",
    "model": "gemini-3-flash-preview"
  }
}
```

#### 4. 启动系统

```bash
npm start
```

浏览器将自动打开管理界面。

## 📖 使用指南

### 1. 配置微信公众号

1. 访问 `http://localhost:4000`
2. 使用密码 `admin123` 登录
3. 扫码登录微信
4. 添加需要监控的公众号

### 2. 日常使用

**方式一：桌面应用（推荐）**
1. 双击桌面上的「公众号监控中心」
2. 等待自动启动（Docker + 服务）
3. 点击按钮：
   - 🔄 **检查更新** - 只抓6小时内的新文章
   - 📥 **全量更新** - 抓所有公众号最新文章

**方式二：命令行**
```bash
npm start
# 然后访问 http://localhost:3456
```

### 3. 查看邮件

检查你配置的邮箱，将收到 HTML 格式的 AI 分析邮件。

## ⚙️ 配置说明

### 获取 163 邮箱授权码

1. 登录 [163 邮箱](https://mail.163.com)
2. 设置 → POP3/SMTP/IMAP
3. 开启 SMTP 服务
4. 获取授权码（不是登录密码）

### 获取 Vector Engine API Key

1. 访问 [Vector Engine](https://vectorengine.apifox.cn)
2. 注册并充值
3. 创建 API Key
4. 复制 Key 到配置文件

## 🧪 测试

```bash
# 测试邮件发送
npm run test-email

# 测试 AI 总结
npm run test-ai
```

## 📁 项目结构

```
wechat-monitor/
├── app/
│   ├── server.js          # 主服务程序
│   ├── index.html         # 前端界面
│   └── app.js             # 前端逻辑
├── config/
│   └── settings.json      # 配置文件（需手动创建）
├── docker/
│   └── docker-compose.yml # WeWe-RSS 配置
├── scripts/
│   ├── setup.js           # 安装配置向导
│   ├── test-email.js      # 邮件测试
│   └── test-ai.js         # AI 测试
├── sender.js              # 邮件发送模块
├── package.json
└── README.md
```

## 🔧 故障排除

### 问题：邮件发送失败

**检查：**
- 确认 163 邮箱已开启 SMTP
- 确认使用的是**授权码**而非密码
- 检查 `config/settings.json` 配置

### 问题：AI 总结失败

**检查：**
- 确认 Vector Engine 有余额
- 确认 API Key 正确
- 检查网络连接

### 问题：无法获取 RSS

**检查：**
- Docker 是否运行：`docker ps`
- WeWe-RSS 是否启动
- 是否已添加公众号

### 查看日志

```bash
# 服务日志
tail -f logs/monitor.log

# 系统日志
tail -f /tmp/wechat-monitor.log
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📝 更新日志

### v1.0.0 (2026-03-12)
- ✨ 初始版本发布
- 📧 支持邮件推送
- 🤖 集成 Gemini AI
- 🖥️ 桌面应用支持
- 🔄 双模式运行（检查更新/全量更新）

## 📄 许可证

MIT License

## 🙏 致谢

- [WeWe-RSS](https://github.com/cooderl/wewe-rss) - 微信 RSS 订阅服务
- [Vector Engine](https://vectorengine.apifox.cn) - AI API 中转服务

---

**Made with ❤️ by OpenCode**
