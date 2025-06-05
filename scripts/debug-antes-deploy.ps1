# ===============================================
# SCRIPT DE DEBUG ANTES DO DEPLOY
# ===============================================

Write-Host "🔍 INICIANDO DEBUG DOS ARQUIVOS LOCAIS" -ForegroundColor Cyan
Write-Host "=====================================`n" -ForegroundColor Cyan

# Verificar se estamos no diretório correto
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "❌ Erro: Execute este script a partir da raiz do projeto" -ForegroundColor Red
    exit 1
}

Write-Host "📋 VERIFICAÇÕES GERAIS" -ForegroundColor Yellow
Write-Host "=====================`n" -ForegroundColor Yellow

# 1. Verificar arquivos principais
$MAIN_FILES = @(
    ".env",
    "docker-compose.yml", 
    "deploy-contabo.sh"
)

foreach ($file in $MAIN_FILES) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Host "✅ $file - Tamanho: $size bytes" -ForegroundColor Green
    } else {
        Write-Host "❌ $file - ARQUIVO FALTANDO!" -ForegroundColor Red
    }
}

Write-Host "`n📁 VERIFICAÇÕES POR SERVIÇO" -ForegroundColor Yellow
Write-Host "===========================`n" -ForegroundColor Yellow

# 2. Verificar serviços
$SERVICES = @("backend", "worker", "frontend")

foreach ($service in $SERVICES) {
    Write-Host "🔧 Verificando $service..." -ForegroundColor Cyan
    
    # Package.json
    $packagePath = "$service/package.json"
    if (Test-Path $packagePath) {
        Write-Host "  ✅ package.json encontrado" -ForegroundColor Green
        
        # Verificar node_modules
        $nodeModulesPath = "$service/node_modules"
        if (Test-Path $nodeModulesPath) {
            $count = (Get-ChildItem $nodeModulesPath -Directory).Count
            Write-Host "  ✅ node_modules ($count pacotes)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  node_modules não encontrado" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ package.json FALTANDO!" -ForegroundColor Red
    }
    
    # Dockerfile
    $dockerPath = "$service/Dockerfile"
    if (Test-Path $dockerPath) {
        Write-Host "  ✅ Dockerfile encontrado" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Dockerfile FALTANDO!" -ForegroundColor Red
    }
    
    # Diretório src
    $srcPath = "$service/src"
    if (Test-Path $srcPath) {
        $srcFiles = (Get-ChildItem $srcPath -Recurse -File).Count
        Write-Host "  ✅ Diretório src ($srcFiles arquivos)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Diretório src FALTANDO!" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "🌐 VERIFICAÇÕES DE CONFIGURAÇÃO" -ForegroundColor Yellow
Write-Host "==============================`n" -ForegroundColor Yellow

# 3. Verificar .env
if (Test-Path ".env") {
    Write-Host "🔑 Verificando variáveis do .env..." -ForegroundColor Cyan
    
    $envContent = Get-Content ".env" -Raw
    
    $REQUIRED_VARS = @(
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY", 
        "WASABI_ACCESS_KEY",
        "WASABI_SECRET_KEY",
        "WASABI_BUCKET",
        "PUBLIC_BACKEND_URL",
        "PUBLIC_WORKER_URL",
        "PUBLIC_FRONTEND_URL"
    )
    
    foreach ($var in $REQUIRED_VARS) {
        if ($envContent -match "$var=(.+)") {
            $value = $Matches[1].Substring(0, [Math]::Min(20, $Matches[1].Length))
            Write-Host "  ✅ $var = $value..." -ForegroundColor Green
        } else {
            Write-Host "  ❌ $var - VARIÁVEL FALTANDO!" -ForegroundColor Red
        }
    }
} else {
    Write-Host "❌ Arquivo .env não encontrado!" -ForegroundColor Red
}

Write-Host "`n🐳 VERIFICAÇÕES DOCKER" -ForegroundColor Yellow
Write-Host "=====================`n" -ForegroundColor Yellow

# 4. Verificar Docker Compose
if (Test-Path "docker-compose.yml") {
    Write-Host "🔧 Verificando docker-compose.yml..." -ForegroundColor Cyan
    
    $composeContent = Get-Content "docker-compose.yml" -Raw
    
    $REQUIRED_SERVICES = @("backend", "worker", "frontend", "nginx", "srs")
    
    foreach ($service in $REQUIRED_SERVICES) {
        if ($composeContent -match "^\s*${service}:") {
            Write-Host "  ✅ Serviço $service configurado" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Serviço $service FALTANDO!" -ForegroundColor Red
        }
    }
} else {
    Write-Host "❌ docker-compose.yml não encontrado!" -ForegroundColor Red
}

Write-Host "`n📊 VERIFICAÇÕES DE TAMANHO" -ForegroundColor Yellow
Write-Host "=========================`n" -ForegroundColor Yellow

# 5. Verificar tamanhos dos diretórios
$DIRECTORIES = @("backend", "worker", "frontend", "nginx", "streaming-server")

foreach ($dir in $DIRECTORIES) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem $dir -Recurse -File | Measure-Object -Property Length -Sum).Sum
        $sizeMB = [Math]::Round($size / 1MB, 2)
        Write-Host "📁 $dir - $sizeMB MB" -ForegroundColor Cyan
    }
}

Write-Host "`n🎯 RESUMO DO DEBUG" -ForegroundColor Yellow
Write-Host "==================`n" -ForegroundColor Yellow

# 6. Contagem final
$totalFiles = (Get-ChildItem -Recurse -File -Exclude "node_modules", ".git").Count
$totalSize = (Get-ChildItem -Recurse -File -Exclude "node_modules", ".git" | Measure-Object -Property Length -Sum).Sum
$totalSizeMB = [Math]::Round($totalSize / 1MB, 2)

Write-Host "📈 Total de arquivos: $totalFiles" -ForegroundColor Cyan
Write-Host "💾 Tamanho total (sem node_modules): $totalSizeMB MB" -ForegroundColor Cyan

Write-Host "`n✅ DEBUG CONCLUÍDO!" -ForegroundColor Green
Write-Host "==================`n" -ForegroundColor Green

Write-Host "🚀 Para fazer o deploy agora, execute:" -ForegroundColor Yellow
Write-Host "   .\scripts\restaurar-servidor.ps1" -ForegroundColor Gray

Write-Host "`n⚠️  IMPORTANTE:" -ForegroundColor Yellow
Write-Host "   - Verifique se todas as verificações passaram" -ForegroundColor Gray
Write-Host "   - Confirme se as URLs estão corretas no .env" -ForegroundColor Gray
Write-Host "   - Certifique-se de que não há erros críticos acima" -ForegroundColor Gray 