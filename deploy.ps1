#Requires -Version 5.1
<#
.SYNOPSIS
    公众号监控系统 - Windows 部署脚本
.DESCRIPTION
    一键部署微信公众号监控系统，支持 Windows 10/11
.NOTES
    需要以管理员权限运行 PowerShell
#>

# 设置错误处理
$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-Info($message) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ℹ️  $message" -ForegroundColor Cyan
}

function Write-Success($message) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ✅ $message" -ForegroundColor Green
}

function Write-Warning($message) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ⚠️  $message" -ForegroundColor Yellow
}

function Write-Error($message) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ❌ $message" -ForegroundColor Red
}

function Write-Section($title) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host "  $title" -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
}

# 检查管理员权限
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# 检查 Node.js
function Test-NodeJS {
    Write-Info "正在检查 Node.js..."
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            $version = $nodeVersion -replace 'v', ''
            $major = [int]($version.Split('.')[0])
            if ($major -ge 16) {
                Write-Success "Node.js 已安装: $nodeVersion"
                return $true
            } else {
                Write-Warning "Node.js 版本过低 (需要 >= 16.0.0)，当前: $nodeVersion"
                return $false
            }
        }
    } catch {
        Write-Warning "未检测到 Node.js"
        return $false
    }
    return $false
}

# 检查 Docker
function Test-Docker {
    Write-Info "正在检查 Docker..."
    try {
        $dockerVersion = docker --version 2>$null
        if ($dockerVersion) {
            Write-Success "Docker 已安装"
            
            # 检查 Docker 是否运行
            try {
                $dockerInfo = docker info 2>$null
                if ($dockerInfo) {
                    Write-Success "Docker Desktop 正在运行"
                    return $true
                } else {
                    Write-Warning "Docker Desktop 未运行"
                    return $false
                }
            } catch {
                Write-Warning "Docker Desktop 未运行"
                return $false
            }
        }
    } catch {
        Write-Warning "未检测到 Docker"
        return $false
    }
    return $false
}

# 安装 Node.js 指引
function Install-NodeJSGuide {
    Write-Error "Node.js 未安装或版本过低"
    Write-Host ""
    Write-Host "安装步骤：" -ForegroundColor Yellow
    Write-Host "1. 访问: https://nodejs.org" -ForegroundColor White
    Write-Host "2. 下载 LTS 版本 (Windows Installer)" -ForegroundColor White
    Write-Host "3. 双击 .msi 文件安装" -ForegroundColor White
    Write-Host "4. 安装完成后，重新运行此脚本" -ForegroundColor White
    Write-Host ""
    
    $openBrowser = Read-Host "是否自动打开 Node.js 官网? (y/n)"
    if ($openBrowser -eq 'y') {
        Start-Process "https://nodejs.org"
        Write-Info "请在浏览器中下载并安装 Node.js"
        Write-Info "安装完成后，请重新运行此脚本"
        exit 0
    } else {
        Write-Error "无法继续部署，请先安装 Node.js"
        exit 1
    }
}

# 安装 Docker 指引
function Install-DockerGuide {
    Write-Error "Docker 未安装"
    Write-Host ""
    Write-Host "安装步骤：" -ForegroundColor Yellow
    Write-Host "1. 访问: https://www.docker.com/products/docker-desktop" -ForegroundColor White
    Write-Host "2. 点击 'Download for Windows'" -ForegroundColor White
    Write-Host "3. 双击安装程序" -ForegroundColor White
    Write-Host "4. 安装过程中可能需要重启电脑" -ForegroundColor White
    Write-Host ""
    
    $openBrowser = Read-Host "是否自动打开 Docker 官网? (y/n)"
    if ($openBrowser -eq 'y') {
        Start-Process "https://www.docker.com/products/docker-desktop"
        Write-Info "请在浏览器中下载并安装 Docker Desktop"
        Write-Info "安装完成后，请重新运行此脚本"
        exit 0
    } else {
        Write-Error "无法继续部署，请先安装 Docker Desktop"
        exit 1
    }
}

# 启动 Docker
function Start-Docker {
    Write-Info "正在启动 Docker Desktop..."
    
    try {
        Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
        Write-Info "等待 Docker 启动..."
        
        $retries = 30
        while ($retries -gt 0) {
            Start-Sleep -Seconds 2
            try {
                $dockerInfo = docker info 2>$null
                if ($dockerInfo) {
                    Write-Success "Docker Desktop 已成功启动"
                    return $true
                }
            } catch {}
            $retries--
            Write-Host "." -NoNewline
        }
        
        Write-Error "Docker Desktop 启动超时"
        Write-Info "请手动打开 Docker Desktop，等待鲸鱼图标出现后再运行此脚本"
        exit 1
    } catch {
        Write-Error "启动 Docker Desktop 失败"
        Write-Info "请手动打开 Docker Desktop"
        exit 1
    }
}

# 配置邮箱
function Configure-Email {
    Write-Section "配置邮箱"
    
    Write-Host "本系统使用 163 邮箱发送通知邮件" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "163 邮箱配置指南：" -ForegroundColor Cyan
    Write-Host "1. 登录 163 邮箱: https://mail.163.com" -ForegroundColor White
    Write-Host "2. 点击顶部 '设置' → 'POP3/SMTP/IMAP'" -ForegroundColor White
    Write-Host "3. 开启 'IMAP/SMTP服务'" -ForegroundColor White
    Write-Host "4. 发送短信验证" -ForegroundColor White
    Write-Host "5. 保存显示的授权码（不是邮箱密码！）" -ForegroundColor White
    Write-Host ""
    
    $openBrowser = Read-Host "是否自动打开 163 邮箱? (y/n)"
    if ($openBrowser -eq 'y') {
        Start-Process "https://mail.163.com"
        Write-Info "请在浏览器中完成设置并获取授权码"
        Write-Host "按回车键继续..." -ForegroundColor Yellow
        Read-Host
    }
    
    # 获取邮箱地址
    do {
        $email = Read-Host "请输入您的 163 邮箱地址"
        if ($email -match "^[a-zA-Z0-9._%+-]+@163\.com$") {
            break
        } else {
            Write-Error "请输入正确的 163 邮箱地址（例如：example@163.com）"
        }
    } while ($true)
    
    # 获取授权码
    do {
        $authCode = Read-Host "请输入授权码（不是邮箱密码）" -AsSecureString
        $authCodePlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($authCode))
        if ($authCodePlain.Length -ge 10) {
            break
        } else {
            Write-Error "授权码长度不足，请重新输入"
        }
    } while ($true)
    
    Write-Success "邮箱配置完成"
    
    return @{
        Email = $email
        AuthCode = $authCodePlain
    }
}

# 配置 AI API
function Configure-AI {
    Write-Section "配置 AI 服务"
    
    Write-Host "本系统使用 Vector Engine 提供的 Gemini AI" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Vector Engine 配置指南：" -ForegroundColor Cyan
    Write-Host "1. 访问: https://vectorengine.apifox.cn" -ForegroundColor White
    Write-Host "2. 注册账号（支持支付宝充值）" -ForegroundColor White
    Write-Host "3. 充值一定金额（建议 10-20 元）" -ForegroundColor White
    Write-Host "4. 在控制台创建 API Key" -ForegroundColor White
    Write-Host ""
    
    $openBrowser = Read-Host "是否自动打开 Vector Engine 官网? (y/n)"
    if ($openBrowser -eq 'y') {
        Start-Process "https://vectorengine.apifox.cn"
        Write-Info "请在浏览器中注册并获取 API Key"
        Write-Host "按回车键继续..." -ForegroundColor Yellow
        Read-Host
    }
    
    # 获取 API Key
    do {
        $apiKey = Read-Host "请输入 Vector Engine API Key"
        if ($apiKey -match "^sk-[a-zA-Z0-9]{40,}$") {
            break
        } else {
            Write-Error "API Key 格式不正确，应以 'sk-' 开头"
        }
    } while ($true)
    
    Write-Success "AI 配置完成"
    
    return $apiKey
}

# 创建配置文件
function Create-Config($email, $authCode, $apiKey) {
    Write-Info "正在创建配置文件..."
    
    $config = @{
        email = @{
            smtp_server = "smtp.163.com"
            smtp_port = 465
            username = $email
            password = $authCode
            to_email = $email
        }
        ai = @{
            api_key = $apiKey
            api_url = "https://api.vectorengine.ai/v1/chat/completions"
            model = "gemini-3-flash-preview"
        }
        check_interval_hours = 6
        summary_style = @{
            max_length = "不限制"
            include = @("核心观点", "论证逻辑", "关键结论", "标签分类")
            format = "structured_with_tags"
        }
        default_tags = @("投资", "研究", "金融", "经济", "宏观", "行业分析", "政策解读")
        tag_rules = @{
            地缘政治 = @("美伊冲突", "中美关系", "俄乌战争", "中东局势")
            市场板块 = @("科技股", "新能源", "医药", "消费", "地产", "银行")
            经济周期 = @("通胀", "通缩", "降息", "加息", "recession")
            投资策略 = @("价值投资", "成长投资", "量化投资", "资产配置")
        }
    }
    
    $configPath = ".\config\settings.json"
    if (!(Test-Path ".\config")) {
        New-Item -ItemType Directory -Path ".\config" -Force | Out-Null
    }
    
    $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $configPath -Encoding UTF8
    Write-Success "配置文件已保存到: $configPath"
}

# 部署 WeWe-RSS
function Deploy-WeWeRSS {
    Write-Section "部署 WeWe-RSS"
    
    $dockerComposePath = "$env:USERPROFILE\wewe-rss-docker-compose.yml"
    
    if (Test-Path $dockerComposePath) {
        Write-Info "发现现有的 Docker Compose 配置"
        $recreate = Read-Host "是否重新创建? (y/n) [默认: n]"
        if ($recreate -ne 'y') {
            Write-Info "使用现有配置"
        } else {
            Remove-Item $dockerComposePath -Force
        }
    }
    
    if (!(Test-Path $dockerComposePath)) {
        Write-Info "创建 Docker Compose 配置文件..."
        
        $dockerCompose = @"
version: '3'
services:
  mysql:
    image: mysql:8.0
    container_name: wewe-mysql
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: wewe-rss
      MYSQL_USER: wewe
      MYSQL_PASSWORD: wewe123
    volumes:
      - ~/wewe-mysql-data:/var/lib/mysql
    ports:
      - "3306:3306"
    command: --default-authentication-plugin=mysql_native_password
    restart: unless-stopped

  wewe-rss:
    image: cooderl/wewe-rss:latest
    container_name: wewe-rss
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=mysql://wewe:wewe123@mysql:3306/wewe-rss
      - DATABASE_TYPE=mysql
      - AUTH_CODE=admin123
      - PLATFORM_URL=https://weread.965111.xyz
    depends_on:
      - mysql
    restart: unless-stopped
"@
        
        $dockerCompose | Out-File -FilePath $dockerComposePath -Encoding UTF8
        Write-Success "Docker Compose 文件已创建"
    }
    
    Write-Info "启动 WeWe-RSS 服务..."
    Set-Location $env:USERPROFILE
    docker-compose -f $dockerComposePath up -d
    
    Write-Info "等待服务启动..."
    $retries = 30
    while ($retries -gt 0) {
        Start-Sleep -Seconds 3
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:4000" -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Success "WeWe-RSS 部署成功！"
                Write-Host ""
                Write-Host "访问地址: http://localhost:4000" -ForegroundColor Cyan
                Write-Host "默认密码: admin123" -ForegroundColor Cyan
                Write-Host ""
                return $true
            }
        } catch {}
        $retries--
        Write-Host "." -NoNewline
    }
    
    Write-Error "WeWe-RSS 启动超时"
    exit 1
}

# 配置微信公众号
function Configure-WeChatAccounts {
    Write-Section "配置微信公众号"
    
    Write-Host "微信公众号配置指南：" -ForegroundColor Cyan
    Write-Host "1. 打开浏览器访问: http://localhost:4000" -ForegroundColor White
    Write-Host "2. 使用密码 admin123 登录" -ForegroundColor White
    Write-Host "3. 使用微信扫码登录" -ForegroundColor White
    Write-Host "4. 点击 '+ 添加公众号'" -ForegroundColor White
    Write-Host "5. 搜索并添加需要监控的公众号" -ForegroundColor White
    Write-Host "6. 等待同步完成" -ForegroundColor White
    Write-Host ""
    
    $openBrowser = Read-Host "是否现在打开 WeWe-RSS? (y/n)"
    if ($openBrowser -eq 'y') {
        Start-Process "http://localhost:4000"
        Write-Info "请在浏览器中完成公众号配置"
    }
    
    Write-Host ""
    Write-Host "添加至少一个公众号后，按回车键继续..." -ForegroundColor Yellow
    Read-Host
    
    Write-Success "公众号配置完成"
}

# 测试系统
function Test-System {
    Write-Section "测试系统"
    
    Write-Info "正在测试邮件发送功能..."
    
    # 创建测试脚本
    $testScript = @"
const { sendEmail } = require('./sender');

const testSummaries = [{
    title: "测试邮件 - Windows 系统部署成功",
    source: "系统测试",
    publish_time: new Date().toISOString(),
    original_url: "https://example.com",
    summary: \`📌 核心观点：
您的公众号监控系统（Windows 版）已成功部署并运行！

系统功能：
1. 自动监控微信公众号更新
2. AI 智能生成投资分析摘要
3. 自动发送邮件通知
4. 支持检查更新和全量更新两种模式

测试结论：系统运行正常\`,
    tags: ["系统测试", "部署成功", "Windows"]
}];

sendEmail(testSummaries)
    .then(success => {
        if (success) {
            console.log('\\n✅ 测试邮件发送成功！');
            process.exit(0);
        } else {
            console.error('\\n❌ 测试邮件发送失败');
            process.exit(1);
        }
    })
    .catch(err => {
        console.error('\\n❌ 错误:', err.message);
        process.exit(1);
    });
"@
    
    $testScript | Out-File -FilePath ".\test-email.js" -Encoding UTF8
    
    # 运行测试
    try {
        $output = node test-email.js 2>&1
        Write-Host $output
        
        if ($output -match "测试邮件发送成功") {
            Write-Success "邮件测试通过！"
            Remove-Item ".\test-email.js" -Force
            return $true
        } else {
            throw "邮件发送失败"
        }
    } catch {
        Write-Error "邮件测试失败"
        Write-Info "请检查："
        Write-Host "  1. 邮箱地址是否正确" -ForegroundColor White
        Write-Host "  2. 授权码是否正确（不是邮箱密码）" -ForegroundColor White
        Write-Host "  3. 163 邮箱是否开启 SMTP 服务" -ForegroundColor White
        return $false
    }
}

# 创建启动脚本
function Create-Launcher {
    Write-Section "创建启动脚本"
    
    # 创建 PowerShell 启动脚本
    $startScript = @"
# 公众号监控系统启动脚本
Set-Location "$PWD"
Write-Host "正在启动公众号监控系统..." -ForegroundColor Green
Write-Host "访问地址: http://localhost:3456" -ForegroundColor Cyan
node app/server.js
pause
"@
    
    $startScript | Out-File -FilePath ".\start.ps1" -Encoding UTF8
    
    # 创建桌面快捷方式（可选）
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $shortcutPath = "$desktopPath\公众号监控.lnk"
    
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut($shortcutPath)
        $Shortcut.TargetPath = "powershell.exe"
        $Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$PWD\start.ps1`""
        $Shortcut.WorkingDirectory = "$PWD"
        $Shortcut.IconLocation = "powershell.exe,0"
        $Shortcut.Save()
        Write-Success "桌面快捷方式已创建"
    } catch {
        Write-Warning "创建桌面快捷方式失败，可以手动运行 start.ps1"
    }
    
    Write-Success "启动脚本创建完成"
}

# 完成安装
function Finish-Installation {
    Write-Section "🎉 部署完成！"
    
    Write-Host "恭喜！公众号监控系统已成功部署！" -ForegroundColor Green
    Write-Host ""
    Write-Host "系统信息：" -ForegroundColor Cyan
    Write-Host "  • 项目目录: $PWD" -ForegroundColor White
    Write-Host "  • 配置文件: $PWD\config\settings.json" -ForegroundColor White
    Write-Host "  • WeWe-RSS: http://localhost:4000" -ForegroundColor White
    Write-Host "  • 管理界面: http://localhost:3456" -ForegroundColor White
    Write-Host ""
    Write-Host "使用方式：" -ForegroundColor Cyan
    Write-Host "  1. 双击桌面上的'公众号监控'图标" -ForegroundColor White
    Write-Host "  2. 或运行 .\start.ps1" -ForegroundColor White
    Write-Host "  3. 点击'检查更新'或'全量更新'" -ForegroundColor White
    Write-Host "  4. 检查 163 邮箱接收 AI 总结" -ForegroundColor White
    Write-Host ""
    
    $startNow = Read-Host "是否现在启动系统? (y/n)"
    if ($startNow -eq 'y') {
        Write-Info "正在启动..."
        Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PWD\start.ps1`""
    } else {
        Write-Info "稍后可以通过以下方式启动："
        Write-Host "  • 双击桌面图标" -ForegroundColor White
        Write-Host "  • 运行: .\start.ps1" -ForegroundColor White
    }
}

# 主函数
function Main {
    Clear-Host
    Write-Host ""
    Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Blue
    Write-Host "║                                        ║" -ForegroundColor Blue
    Write-Host "║     公众号监控与 AI 总结系统           ║" -ForegroundColor Blue
    Write-Host "║     Windows 部署向导                   ║" -ForegroundColor Blue
    Write-Host "║                                        ║" -ForegroundColor Blue
    Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Blue
    Write-Host ""
    
    Write-Info "本脚本将一步步引导您完成系统部署"
    Write-Info "预计耗时: 15-20 分钟"
    Write-Host ""
    
    $start = Read-Host "是否开始部署? (y/n)"
    if ($start -ne 'y') {
        Write-Info "已取消部署"
        exit 0
    }
    
    # 检查管理员权限
    if (!(Test-Administrator)) {
        Write-Warning "建议以管理员身份运行 PowerShell"
        Write-Info "某些操作可能需要管理员权限"
        Write-Host ""
        $continue = Read-Host "是否继续? (y/n)"
        if ($continue -ne 'y') {
            exit 0
        }
    }
    
    # 检查 Node.js
    if (!(Test-NodeJS)) {
        Install-NodeJSGuide
    }
    
    # 检查 Docker
    $dockerRunning = Test-Docker
    if (!$dockerRunning) {
        if (!(docker --version 2>$null)) {
            Install-DockerGuide
        } else {
            Start-Docker
        }
    }
    
    # 配置
    $emailConfig = Configure-Email
    $apiKey = Configure-AI
    
    # 创建配置
    Create-Config $emailConfig.Email $emailConfig.AuthCode $apiKey
    
    # 部署 WeWe-RSS
    Deploy-WeWeRSS
    
    # 配置公众号
    Configure-WeChatAccounts
    
    # 安装依赖
    Write-Section "安装项目依赖"
    Write-Info "安装 npm 包..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install 失败"
        exit 1
    }
    Write-Success "依赖安装完成"
    
    # 测试系统
    $testResult = Test-System
    if (!$testResult) {
        Write-Warning "测试未通过，但系统已安装"
        Write-Info "可以稍后手动检查配置"
    }
    
    # 创建启动脚本
    Create-Launcher
    
    # 完成
    Finish-Installation
}

# 运行主程序
Main
