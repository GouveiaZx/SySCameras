# ===============================================
# SCRIPT PARA DEPLOY COM BACKUP DO SERVIDOR
# ===============================================

Write-Host "=== DEPLOY COM BACKUP DO SERVIDOR ===" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se estamos no diretório correto
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "ERRO: Execute este script a partir da raiz do projeto" -ForegroundColor Red
    exit 1
}

# Configurações
$SERVER_IP = "66.94.104.241"
$SERVER_USER = "root"
$SERVER_PATH = "/opt/vigilancia"
$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"
$BACKUP_NAME = "local-para-servidor-$TIMESTAMP.tar.gz"

Write-Host "1. VERIFICANDO ARQUIVOS LOCAIS..." -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Yellow

# Verificações básicas
$arquivos_ok = $true

if (Test-Path ".env") {
    Write-Host "  ✅ .env encontrado" -ForegroundColor Green
} else {
    Write-Host "  ❌ .env FALTANDO!" -ForegroundColor Red
    $arquivos_ok = $false
}

if (Test-Path "docker-compose.yml") {
    Write-Host "  ✅ docker-compose.yml encontrado" -ForegroundColor Green
} else {
    Write-Host "  ❌ docker-compose.yml FALTANDO!" -ForegroundColor Red
    $arquivos_ok = $false
}

foreach ($service in @("backend", "worker", "frontend")) {
    if (Test-Path "$service/Dockerfile") {
        Write-Host "  ✅ $service/Dockerfile encontrado" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $service/Dockerfile FALTANDO!" -ForegroundColor Red
        $arquivos_ok = $false
    }
}

if (-not $arquivos_ok) {
    Write-Host ""
    Write-Host "ERRO: Arquivos essenciais estão faltando!" -ForegroundColor Red
    Write-Host "Corrija os problemas acima antes de continuar." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. CRIANDO ARQUIVO COMPRIMIDO..." -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow

# Criar arquivo comprimido
Write-Host "  📦 Comprimindo projeto (excluindo node_modules e .git)..."
tar -czf "$BACKUP_NAME" --exclude=node_modules --exclude=.git --exclude="*.log" --exclude="backup-*.tar.gz" .

if (Test-Path $BACKUP_NAME) {
    $fileSize = [Math]::Round((Get-Item $BACKUP_NAME).Length / 1MB, 2)
    Write-Host "  ✅ Arquivo criado: $BACKUP_NAME ($fileSize MB)" -ForegroundColor Green
} else {
    Write-Host "  ❌ Erro ao criar arquivo comprimido!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "3. FAZENDO BACKUP DO SERVIDOR..." -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow

Write-Host "  📤 Conectando ao servidor para backup..."

$BACKUP_SCRIPT = @"
cd /opt

# Verificar se existe vigilancia
if [ -d "vigilancia" ]; then
    echo "📁 Fazendo backup da versão atual..."
    tar -czf "backup-servidor-$TIMESTAMP.tar.gz" vigilancia/
    echo "✅ Backup salvo como: backup-servidor-$TIMESTAMP.tar.gz"
    
    # Mover diretório atual
    mv vigilancia vigilancia-backup-$TIMESTAMP
    echo "✅ Diretório atual movido para: vigilancia-backup-$TIMESTAMP"
else
    echo "ℹ️  Diretório vigilancia não existe - primeira instalação"
fi

# Criar novo diretório
mkdir -p vigilancia
echo "✅ Novo diretório vigilancia criado"
"@

# Executar script de backup no servidor
$BACKUP_SCRIPT | ssh "${SERVER_USER}@${SERVER_IP}" 'bash -s'

Write-Host ""
Write-Host "4. ENVIANDO NOVA VERSÃO..." -ForegroundColor Yellow
Write-Host "=========================" -ForegroundColor Yellow

Write-Host "  📤 Enviando arquivo para o servidor..."
scp "$BACKUP_NAME" "${SERVER_USER}@${SERVER_IP}:/opt/"

Write-Host ""
Write-Host "5. INSTALANDO NO SERVIDOR..." -ForegroundColor Yellow
Write-Host "===========================" -ForegroundColor Yellow

$DEPLOY_SCRIPT = @"
cd /opt/vigilancia

# Extrair arquivos
echo "📂 Extraindo arquivos..."
tar -xzf "../$BACKUP_NAME"

# Dar permissões
chmod +x deploy-contabo.sh
chmod +x scripts/*.sh

# Parar containers se estiverem rodando
echo "🛑 Parando containers existentes..."
docker-compose down 2>/dev/null || true

# Limpar containers órfãos
echo "🧹 Limpando containers órfãos..."
docker system prune -f

# Executar deploy
echo "🚀 Iniciando deploy..."
./deploy-contabo.sh

echo ""
echo "✅ DEPLOY CONCLUÍDO!"
echo "🌐 Sistema disponível em: https://nuvem.safecameras.com.br"
echo ""
echo "📊 Status dos containers:"
docker-compose ps
"@

# Executar deploy no servidor
$DEPLOY_SCRIPT | ssh "${SERVER_USER}@${SERVER_IP}" 'bash -s'

Write-Host ""
Write-Host "6. LIMPEZA LOCAL..." -ForegroundColor Yellow
Write-Host "==================" -ForegroundColor Yellow

# Remover arquivo local temporário
Remove-Item $BACKUP_NAME -Force
Write-Host "  🗑️  Arquivo temporário removido" -ForegroundColor Green

Write-Host ""
Write-Host "=== DEPLOY CONCLUÍDO COM SUCESSO! ===" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Frontend: https://nuvem.safecameras.com.br" -ForegroundColor Cyan
Write-Host "🔧 Backend API: https://nuvem.safecameras.com.br/api" -ForegroundColor Cyan
Write-Host "⚙️  Worker: https://nuvem.safecameras.com.br/worker" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 COMANDOS ÚTEIS:" -ForegroundColor Yellow
Write-Host "  Ver logs:      ssh root@66.94.104.241 'cd /opt/vigilancia && docker-compose logs -f'" -ForegroundColor Gray
Write-Host "  Status:        ssh root@66.94.104.241 'cd /opt/vigilancia && docker-compose ps'" -ForegroundColor Gray
Write-Host "  Reiniciar:     ssh root@66.94.104.241 'cd /opt/vigilancia && docker-compose restart'" -ForegroundColor Gray
Write-Host ""
Write-Host "📁 BACKUPS NO SERVIDOR:" -ForegroundColor Yellow
Write-Host "  Backup atual:  /opt/backup-servidor-$TIMESTAMP.tar.gz" -ForegroundColor Gray
Write-Host "  Pasta backup:  /opt/vigilancia-backup-$TIMESTAMP" -ForegroundColor Gray 