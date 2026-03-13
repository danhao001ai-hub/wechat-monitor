#!/usr/bin/env node
/**
 * 邮件发送模块
 * 发送公众号更新通知邮件
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// 加载配置
function loadConfig() {
  const configPath = path.join(__dirname, 'config', 'settings.json');
  
  if (!fs.existsSync(configPath)) {
    throw new Error('配置文件不存在，请先运行: npm run setup');
  }
  
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

/**
 * 将 Markdown 格式转换为 HTML
 */
function markdownToHtml(text) {
  if (!text) return '';
  
  return text
    // 处理加粗 **text** 或 __text__
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    // 处理斜体 *text* 或 _text_
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    // 处理换行符
    .replace(/\n/g, '<br>');
}

/**
 * 创建邮件内容
 */
function createEmailContent(summaries) {
  const now = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>公众号文章摘要</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; 
      line-height: 1.8; 
      color: #333; 
      background: #f5f5f5;
      padding: 20px;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .header .meta { opacity: 0.9; font-size: 14px; }
    .content { padding: 30px; }
    .stats {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 15px 20px;
      margin-bottom: 30px;
      text-align: center;
      color: #666;
    }
    .stats strong { color: #667eea; font-size: 24px; }
    .article { 
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      transition: all 0.3s;
    }
    .article:hover { 
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      border-color: #667eea;
    }
    .article-header {
      border-bottom: 2px solid #f0f0f0;
      padding-bottom: 15px;
      margin-bottom: 15px;
    }
    .article-title { 
      font-size: 18px; 
      color: #2c3e50;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .article-meta {
      font-size: 13px;
      color: #999;
    }
    .article-meta .source {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      margin-right: 10px;
      font-size: 12px;
    }
    .summary { 
      color: #555;
      line-height: 1.8;
    }
    .summary strong {
      color: #667eea;
    }
    .read-more {
      display: inline-block;
      margin-top: 15px;
      padding: 10px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-size: 14px;
      transition: opacity 0.3s;
    }
    .read-more:hover {
      opacity: 0.9;
    }
    .tags {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px dashed #e0e0e0;
    }
    .tags-label {
      font-size: 12px;
      color: #999;
      margin-bottom: 8px;
    }
    .tag {
      display: inline-block;
      background: #f0f4ff;
      color: #667eea;
      padding: 4px 10px;
      border-radius: 20px;
      margin: 3px 5px 3px 0;
      font-size: 12px;
      border: 1px solid #e0e7ff;
    }
    .tag:hover {
      background: #667eea;
      color: white;
    }
    .footer { 
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #999;
      font-size: 12px;
      border-top: 1px solid #e0e0e0;
    }
    @media (max-width: 600px) {
      body { padding: 10px; }
      .header { padding: 20px; }
      .content { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📰 公众号文章摘要</h1>
      <div class="meta">${now} | OpenCode 智能监控</div>
    </div>
    
    <div class="content">
      <div class="stats">
        本次发现 <strong>${summaries.length}</strong> 篇新文章
      </div>
`;

  summaries.forEach((item, index) => {
    // 生成标签 HTML
    let tagsHtml = '';
    if (item.tags && item.tags.length > 0) {
      const tagSpans = item.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
      tagsHtml = `
        <div class="tags">
          <div class="tags-label">🏷️ 标签分类：</div>
          ${tagSpans}
        </div>`;
    }
    
    html += `
      <div class="article">
        <div class="article-header">
          <div class="article-title">${index + 1}. ${item.title}</div>
          <div class="article-meta">
            <span class="source">${item.source}</span>
            <span>${new Date(item.publish_time).toLocaleString('zh-CN')}</span>
          </div>
        </div>
        <div class="summary">
          ${markdownToHtml(item.summary)}
        </div>
        ${tagsHtml}
        <a href="${item.original_url}" class="read-more" target="_blank">阅读原文 →</a>
      </div>
`;
  });

  html += `
    </div>
    
    <div class="footer">
      <p>此邮件由 OpenCode 公众号监控系统自动生成</p>
      <p>如需帮助，请联系系统管理员</p>
    </div>
  </div>
</body>
</html>
`;

  return html;
}

/**
 * 发送邮件
 * @param {Array} summaries - 文章摘要列表
 * @returns {Promise<boolean>} - 是否发送成功
 */
async function sendEmail(summaries) {
  if (!summaries || summaries.length === 0) {
    console.log('ℹ️ 没有新文章，无需发送邮件');
    return false;
  }

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error('❌ 加载配置失败:', err.message);
    return false;
  }
  
  const emailConfig = config.email;

  console.log(`📧 准备发送邮件到: ${emailConfig.to_email}`);
  console.log(`   SMTP服务器: ${emailConfig.smtp_server}:${emailConfig.smtp_port}`);

  // 创建邮件内容
  const htmlContent = createEmailContent(summaries);
  const subject = `📰 公众号更新 - ${summaries.length}篇新文章 - ${new Date().toLocaleDateString('zh-CN')}`;

  // 保存邮件预览（用于调试）
  const previewPath = path.join(__dirname, 'logs', `email_preview_${Date.now()}.html`);
  const dir = path.dirname(previewPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(previewPath, htmlContent);
  console.log(`💾 邮件预览已保存: ${previewPath}`);

  try {
    // 创建 SMTP 传输对象
    const transporter = nodemailer.createTransport({
      host: emailConfig.smtp_server,
      port: emailConfig.smtp_port,
      secure: emailConfig.smtp_port === 465,
      auth: {
        user: emailConfig.username,
        pass: emailConfig.password
      }
    });

    // 发送邮件
    const info = await transporter.sendMail({
      from: `"公众号监控" <${emailConfig.username}>`,
      to: emailConfig.to_email,
      subject: subject,
      html: htmlContent
    });

    console.log(`✅ 邮件发送成功: ${info.messageId}`);
    return true;

  } catch (error) {
    console.error(`❌ 邮件发送失败: ${error.message}`);
    console.log('   邮件内容已保存，可以手动发送');
    return false;
  }
}

module.exports = {
  sendEmail,
  createEmailContent
};

// 如果直接运行
if (require.main === module) {
  console.log('请使用 npm run test-email 测试邮件功能');
}
