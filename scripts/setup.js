#!/usr/bin/env node
/**
 * 交互式安装配置向导
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

async function checkNodeVersion() {
  log('检查 Node.js 版本...');
  const version = process.version;
  const major = parseInt(version.split('.')[0].substring(1));
  if (major < 16) {
    console.error('❌ Node.js 版本过低，需要 >= 16.0.0');
    console.log('   请访问 https://nodejs.org 下载最新版本');
    return false;
  }
  log(`✅ Node.js 版本: ${version}`);
  return true;
}

async function checkDocker() {
  log('检查 Docker...');
  try {
    await execPromise('docker --version');
    log('✅ Docker 已安装');
    return true;
  } catch (e) {
    console.error('❌ Docker 未安装');
    console.log('   请访问 https://www.docker.com/products/docker-desktop 下载安装');
    return false;
  }
}

async function installDependencies() {
  log('安装 npm 依赖...');
  try {
    await execPromise('npm install');
    log('✅ 依赖安装完成');
    return true;
  } catch (e) {
    console.error('❌ 依赖安装失败:', e.message);
    return false;
  }
}

async function configureEmail() {
  console.log('\n📧 邮件配置');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const email = await question('请输入 163 邮箱地址: ');
  const authCode = await question('请输入授权码（不是密码）: ');
  
  return {
    smtp_server: 'smtp.163.com',
    smtp_port: 465,
    username: email,
    password: authCode,
    to_email: email
  };
}

async function configureAI() {
  console.log('\n🤖 AI 配置');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('请访问 https://vectorengine.apifox.cn 获取 API Key');
  
  const apiKey = await question('请输入 Vector Engine API Key: ');
  
  return {
    api_key: apiKey,
    api_url: 'https://api.vectorengine.ai/v1/chat/completions',
    model: 'gemini-3-flash-preview'
  };
}

async function saveConfig(emailConfig, aiConfig) {
  const config = {
    email: emailConfig,
    ai: aiConfig,
    check_interval_hours: 6,
    summary_style: {
      max_length: "不限制",
      include: ["核心观点", "论证逻辑", "关键结论", "标签分类"],
      format: "structured_with_tags"
    },
    default_tags: ["投资", "研究", "金融", "经济", "宏观", "行业分析", "政策解读"],
    tag_rules: {
      "地缘政治": ["美伊冲突", "中美关系", "俄乌战争", "中东局势"],
      "市场板块": ["科技股", "新能源", "医药", "消费", "地产", "银行"],
      "经济周期": ["通胀", "通缩", "降息", "加息", "recession"],
      "投资策略": ["价值投资", "成长投资", "量化投资", "资产配置"]
    }
  };
  
  const configPath = path.join(__dirname, '..', 'config', 'settings.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  log(`✅ 配置已保存到: ${configPath}`);
}

async function setupDocker() {
  log('检查 Docker 状态...');
  
  try {
    await execPromise('docker info');
    log('✅ Docker 正在运行');
  } catch (e) {
    log('⏳ Docker 未运行，正在启动...');
    await execPromise('open /Applications/Docker.app');
    
    // 等待 Docker 启动
    let retries = 30;
    while (retries > 0) {
      try {
        await execPromise('docker info');
        log('✅ Docker 已启动');
        break;
      } catch (e) {
        retries--;
        process.stdout.write('.');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    if (retries === 0) {
      console.error('\n❌ Docker 启动超时，请手动启动 Docker Desktop');
      return false;
    }
  }
  
  // 启动 WeWe-RSS
  log('启动 WeWe-RSS 服务...');
  const composePath = path.join(__dirname, '..', 'docker', 'docker-compose.yml');
  
  try {
    await execPromise(`docker-compose -f "${composePath}" up -d`);
    log('✅ WeWe-RSS 已启动');
    log('   访问: http://localhost:4000');
    log('   默认密码: admin123');
    return true;
  } catch (e) {
    console.error('❌ WeWe-RSS 启动失败:', e.message);
    return false;
  }
}

async function createDesktopApp() {
  console.log('\n🖥️ 创建桌面应用');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const createShortcut = await question('是否创建桌面快捷方式? (y/n): ');
  
  if (createShortcut.toLowerCase() === 'y') {
    const desktopPath = path.join(require('os').homedir(), 'Desktop');
    const appPath = path.join(__dirname, '..');
    
    // 创建启动脚本
    const scriptContent = `#!/bin/bash
cd "${appPath}"
npm start
`;
    
    const scriptPath = path.join(desktopPath, '公众号监控.command');
    fs.writeFileSync(scriptPath, scriptContent);
    fs.chmodSync(scriptPath, '755');
    
    log(`✅ 桌面快捷方式已创建: ${scriptPath}`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║    公众号监控系统 - 安装配置向导       ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  // 1. 检查 Node.js
  if (!await checkNodeVersion()) {
    process.exit(1);
  }
  
  // 2. 检查 Docker
  if (!await checkDocker()) {
    const continueInstall = await question('Docker 未安装，是否继续? (y/n): ');
    if (continueInstall.toLowerCase() !== 'y') {
      process.exit(1);
    }
  }
  
  // 3. 安装依赖
  if (!await installDependencies()) {
    process.exit(1);
  }
  
  // 4. 配置邮件
  const emailConfig = await configureEmail();
  
  // 5. 配置 AI
  const aiConfig = await configureAI();
  
  // 6. 保存配置
  await saveConfig(emailConfig, aiConfig);
  
  // 7. 启动 Docker 服务
  await setupDocker();
  
  // 8. 创建桌面快捷方式
  await createDesktopApp();
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║         🎉 安装配置完成!               ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log('📖 下一步操作:');
  console.log('   1. 访问 http://localhost:4000 配置公众号');
  console.log('   2. 运行 npm start 启动监控系统');
  console.log('   3. 或使用桌面快捷方式启动\n');
  
  console.log('🧪 测试命令:');
  console.log('   npm run test-email  # 测试邮件发送');
  console.log('   npm run test-ai     # 测试 AI 总结\n');
  
  rl.close();
}

main().catch(err => {
  console.error('安装失败:', err);
  process.exit(1);
});
