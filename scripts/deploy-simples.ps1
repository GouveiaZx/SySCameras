# Script de Deploy Simples para Contabo
Write-Host "=== DEPLOY PARA SERVIDOR CONTABO ===" -ForegroundColor Cyan
Write-Host ""

# Verificar se estamos no diretório correto
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "ERRO: Execute este script a partir da raiz do projeto" -ForegroundColor Red
    exit 1
}

# Configurações
$SERVER_IP = "66.94.104.241"
$SERVER_USER = "root"
$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"
$BACKUP_NAME = "projeto-local-$TIMESTAMP.tar.gz"

Write-Host "1. Verificando arquivos..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "  .env - OK" -ForegroundColor Green
} else {
    Write-Host "  .env - FALTANDO!" -ForegroundColor Red
    exit 1
}

if (Test-Path "docker-compose.yml") {
    Write-Host "  docker-compose.yml - OK" -ForegroundColor Green
} else {
    Write-Host "  docker-compose.yml - FALTANDO!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Criando arquivo comprimido..." -ForegroundColor Yellow
tar -czf $BACKUP_NAME --exclude=node_modules --exclude=.git --exclude="*.log" .

if (Test-Path $BACKUP_NAME) {
    $fileSize = [Math]::Round((Get-Item $BACKUP_NAME).Length / 1MB, 2)
    Write-Host "  Arquivo criado: $BACKUP_NAME" -ForegroundColor Green
    Write-Host "  Tamanho: $fileSize MB" -ForegroundColor Green
} else {
    Write-Host "  ERRO ao criar arquivo!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "3. Fazendo backup do servidor..." -ForegroundColor Yellow

ssh "$SERVER_USER@$SERVER_IP" @"
cd /opt
if [ -d vigilancia ]; then
    echo 'Fazendo backup da versao atual...'
    tar -czf backup-servidor-$TIMESTAMP.tar.gz vigilancia/
    mv vigilancia vigilancia-backup-$TIMESTAMP
    echo 'Backup concluido'
else
    echo 'Primeira instalacao'
fi
mkdir -p vigilancia
"@

Write-Host ""
Write-Host "4. Enviando arquivo para servidor..." -ForegroundColor Yellow
scp $BACKUP_NAME "${SERVER_USER}@${SERVER_IP}:/opt/"

Write-Host ""
Write-Host "5. Instalando no servidor..." -ForegroundColor Yellow

ssh "$SERVER_USER@$SERVER_IP" @"
cd /opt/vigilancia
echo 'Extraindo arquivos...'
tar -xzf ../$BACKUP_NAME
chmod +x deploy-contabo.sh
chmod +x scripts/*.sh
echo 'Parando containers...'
docker-compose down 2>/dev/null || true
echo 'Limpando containers orfaos...'
docker system prune -f
echo 'Iniciando deploy...'
./deploy-contabo.sh
echo 'Deploy concluido!'
docker-compose ps
"@

Write-Host ""
Write-Host "6. Limpeza..." -ForegroundColor Yellow
Remove-Item $BACKUP_NAME -Force
Write-Host "  Arquivo temporario removido" -ForegroundColor Green

Write-Host ""
Write-Host "=== DEPLOY CONCLUIDO! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Sistema disponivel em: https://nuvem.safecameras.com.br" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para verificar logs:" -ForegroundColor Yellow
Write-Host "  ssh root@66.94.104.241 'cd /opt/vigilancia && docker-compose logs -f'" -ForegroundColor Gray
Write-Host ""
Write-Host "Para verificar status:" -ForegroundColor Yellow  
Write-Host "  ssh root@66.94.104.241 'cd /opt/vigilancia && docker-compose ps'" -ForegroundColor Gray 