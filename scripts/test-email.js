#!/usr/bin/env node
/**
 * 测试邮件发送功能
 */

const { sendEmail } = require('../sender');

console.log('📧 测试邮件发送功能...\n');

const testSummaries = [
  {
    title: "测试文章 - 系统安装完成",
    source: "系统测试",
    publish_time: new Date().toISOString(),
    original_url: "https://example.com/test",
    summary: `📌 **核心观点**：
这是一封测试邮件，说明你的公众号监控系统已经成功安装并配置完成。

🧠 **系统功能**：
1. **公众号监控** - 自动获取 WeWe-RSS 订阅的公众号文章
2. **AI 智能总结** - 使用 Gemini AI 生成专业投资分析
3. **邮件推送** - 自动发送 HTML 格式邮件到配置的邮箱
4. **双模式运行** - 支持"检查更新"和"全量更新"两种模式

✅ **关键结论**：
• 系统已成功配置
• 可以开始使用监控功能
• 建议添加需要监控的公众号
• 点击"检查更新"或"全量更新"按钮测试完整流程`,
    tags: ["系统测试", "安装完成", "使用指南"]
  }
];

sendEmail(testSummaries)
  .then(success => {
    if (success) {
      console.log('\n✅ 测试邮件发送成功！');
      console.log('   请检查你的邮箱（包括垃圾邮件箱）');
      process.exit(0);
    } else {
      console.error('\n❌ 测试邮件发送失败');
      console.log('   请检查 config/settings.json 中的邮件配置');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('\n❌ 测试失败:', err.message);
    process.exit(1);
  });
