# ===============================================
# SCRIPT POWERSHELL PARA RESTAURAR VERSÃO FUNCIONANDO NO SERVIDOR
# ===============================================

Write-Host "🔄 Iniciando restauração da versão funcionando no servidor Contabo..." -ForegroundColor Cyan

# Verificar se estamos no diretório correto
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "❌ Erro: Execute este script a partir da raiz do projeto" -ForegroundColor Red
    exit 1
}

# Configurações
$SERVER_IP = "66.94.104.241"
$SERVER_USER = "root"
$SERVER_PATH = "/opt/vigilancia"
$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"
$BACKUP_NAME = "backup-funcionando-$TIMESTAMP.tar.gz"

Write-Host "📦 Criando arquivo comprimido do projeto..." -ForegroundColor Yellow

# Criar lista de exclusões para tar
$EXCLUDE_LIST = @(
    "--exclude=node_modules",
    "--exclude=.git", 
    "--exclude=*.log",
    "--exclude=backup-*.tar.gz"
)

# Executar tar (assumindo que está disponível via WSL ou Git Bash)
$TAR_CMD = "tar -czf `"$BACKUP_NAME`" $($EXCLUDE_LIST -join ' ') ."
Invoke-Expression $TAR_CMD

Write-Host "📤 Enviando arquivo para o servidor..." -ForegroundColor Yellow
scp $BACKUP_NAME "${SERVER_USER}@${SERVER_IP}:/opt/"

Write-Host "🔧 Configurando no servidor..." -ForegroundColor Yellow

# Script para executar no servidor
$REMOTE_SCRIPT = @"
cd /opt

# Backup da versão atual (se existir)
if [ -d "vigilancia" ]; then
    echo "📁 Fazendo backup da versão atual..."
    mv vigilancia vigilancia-backup-`$(date +%Y%m%d-%H%M%S)
fi

# Criar novo diretório
mkdir -p vigilancia
cd vigilancia

# Extrair arquivos
echo "📂 Extraindo arquivos..."
tar -xzf "../$BACKUP_NAME"

# Dar permissões
chmod +x deploy-contabo.sh
chmod +x scripts/*.sh

# Parar containers se estiverem rodando
echo "🛑 Parando containers existentes..."
docker-compose down 2>/dev/null || true

# Limpar containers e imagens órfãs
echo "🧹 Limpando containers órfãos..."
docker system prune -f

# Executar deploy
echo "🚀 Iniciando deploy..."
./deploy-contabo.sh

echo "✅ Restauração concluída!"
echo "🌐 Acesse: https://nuvem.safecameras.com.br"
"@

# Executar script no servidor via SSH
$REMOTE_SCRIPT | ssh "${SERVER_USER}@${SERVER_IP}" 'bash -s'

# Remover arquivo local temporário
Remove-Item $BACKUP_NAME -Force

Write-Host ""
Write-Host "✅ RESTAURAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "🌐 Sistema disponível em: https://nuvem.safecameras.com.br" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Para verificar status dos containers:" -ForegroundColor Yellow
Write-Host "   ssh root@66.94.104.241 'cd /opt/vigilancia && docker-compose ps'" -ForegroundColor Gray
Write-Host ""
Write-Host "📋 Para ver logs:" -ForegroundColor Yellow
Write-Host "   ssh root@66.94.104.241 'cd /opt/vigilancia && docker-compose logs -f'" -ForegroundColor Gray 