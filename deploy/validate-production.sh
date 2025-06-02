#!/bin/bash

# 🧪 Script de Validação Final - Sistema Vigilância IP
# Teste completo do sistema em produção

echo "🧪 Iniciando validação final do Sistema Vigilância IP..."
echo "====================================================="

# Verificar argumentos
if [ $# -eq 0 ]; then
    read -p "🌐 Digite o domínio da aplicação (ex: vigilancia.seudominio.com): " DOMAIN
    read -p "📱 Digite a URL do frontend Vercel (ex: https://sistema.vercel.app): " FRONTEND_URL
else
    DOMAIN=$1
    FRONTEND_URL=$2
fi

if [ -z "$DOMAIN" ]; then
    echo "❌ Domínio é obrigatório"
    exit 1
fi

echo "🎯 Testando domínio: $DOMAIN"
echo "🌐 Frontend Vercel: ${FRONTEND_URL:-'Não informado'}"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Função para executar teste
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    printf "%-50s" "$test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Função para testar endpoint HTTP
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    printf "%-50s" "$name"
    
    local status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS (${status})${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL (${status})${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "🔍 TESTES DE INFRAESTRUTURA"
echo "=============================="

# 1. Testes de DNS
run_test "🌐 Resolução DNS" "nslookup $DOMAIN"
run_test "🔗 Conectividade HTTPS" "curl -s -k https://$DOMAIN/status"

# 2. Testes de certificado SSL
echo ""
echo "🔒 TESTES SSL/TLS"
echo "=================="

run_test "🔒 Certificado SSL válido" "echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -dates"
run_test "🔐 TLS 1.3 suportado" "echo | openssl s_client -connect $DOMAIN:443 -tls1_3 2>/dev/null"

# 3. Testes de endpoints
echo ""
echo "🌐 TESTES DE ENDPOINTS"
echo "======================"

test_endpoint "📊 Status do servidor" "https://$DOMAIN/status"
test_endpoint "🏥 Health check API" "https://$DOMAIN/health"
test_endpoint "🔐 Endpoint de autenticação" "https://$DOMAIN/api/auth/login" "400"
test_endpoint "📹 API de câmeras" "https://$DOMAIN/api/cameras" "401"
test_endpoint "📺 Streaming HLS" "https://$DOMAIN/live/" "404"

# 4. Testes de segurança
echo ""
echo "🛡️ TESTES DE SEGURANÇA"
echo "======================="

# Headers de segurança
SECURITY_HEADERS=(
    "Strict-Transport-Security"
    "X-Frame-Options"
    "X-Content-Type-Options"
    "X-XSS-Protection"
    "Referrer-Policy"
)

for header in "${SECURITY_HEADERS[@]}"; do
    run_test "🛡️ Header $header" "curl -s -I https://$DOMAIN | grep -i '$header'"
done

# 5. Testes de funcionalidade
echo ""
echo "⚙️ TESTES DE FUNCIONALIDADE"
echo "==========================="

# Teste de autenticação
AUTH_TEST='curl -s -X POST https://'$DOMAIN'/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"integrador.teste@gmail.com\",\"password\":\"senha123456\"}" | grep -q token'

run_test "🔐 Autenticação JWT" "$AUTH_TEST"

# Obter token para testes subsequentes
TOKEN=$(curl -s -X POST https://$DOMAIN/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"integrador.teste@gmail.com","password":"senha123456"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$TOKEN" ]; then
    # Teste de listagem de câmeras
    CAMERAS_TEST='curl -s -H "Authorization: Bearer '$TOKEN'" https://'$DOMAIN'/api/cameras | grep -q "\[\]"'
    run_test "📹 Listagem de câmeras" "$CAMERAS_TEST"
    
    # Teste de streams ativos
    STREAMS_TEST='curl -s -H "Authorization: Bearer '$TOKEN'" https://'$DOMAIN'/api/streams/active | grep -q "\[\]"'
    run_test "📺 Streams ativos" "$STREAMS_TEST"
fi

# 6. Testes de performance
echo ""
echo "⚡ TESTES DE PERFORMANCE"
echo "========================"

# Tempo de resposta
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" https://$DOMAIN/status)
if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
    echo -e "⚡ Tempo de resposta (< 2s)                    ${GREEN}✅ PASS (${RESPONSE_TIME}s)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "⚡ Tempo de resposta (< 2s)                    ${RED}❌ FAIL (${RESPONSE_TIME}s)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# 7. Testes do frontend (se fornecido)
if [ ! -z "$FRONTEND_URL" ]; then
    echo ""
    echo "📱 TESTES DO FRONTEND"
    echo "====================="
    
    test_endpoint "🌐 Frontend online" "$FRONTEND_URL"
    test_endpoint "🔐 Página de login" "$FRONTEND_URL/login"
    test_endpoint "📊 Dashboard" "$FRONTEND_URL/dashboard" "307"
fi

# 8. Teste com câmera simulada
echo ""
echo "🎥 TESTE DE STREAMING"
echo "====================="

if [ ! -z "$TOKEN" ]; then
    # Criar câmera de teste
    CAMERA_DATA='{"name":"Camera Teste Produção","rtspUrl":"rtsp://test:test@192.168.1.100:554/stream","clientId":"e9e3955e-692e-4c3a-9a10-227358e20c08","type":"IP","retentionDays":7}'
    
    CAMERA_ID=$(curl -s -X POST https://$DOMAIN/api/cameras \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$CAMERA_DATA" | \
      grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    
    if [ ! -z "$CAMERA_ID" ]; then
        echo -e "🎥 Criação de câmera                          ${GREEN}✅ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # Testar início de streaming
        STREAM_TEST='curl -s -X POST https://'$DOMAIN'/api/streams/start \
          -H "Authorization: Bearer '$TOKEN'" \
          -H "Content-Type: application/json" \
          -d "{\"camera_id\":\"'$CAMERA_ID'\"}" | grep -q "stream_id\|rtmp_url"'
        
        run_test "📺 Início de streaming" "$STREAM_TEST"
        
        # Limpar: deletar câmera de teste
        curl -s -X DELETE https://$DOMAIN/api/cameras/$CAMERA_ID \
          -H "Authorization: Bearer $TOKEN" >/dev/null 2>&1
    else
        echo -e "🎥 Criação de câmera                          ${RED}❌ FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
fi

# Relatório final
echo ""
echo "📊 RELATÓRIO FINAL"
echo "=================="
echo ""
echo -e "Total de testes: ${BLUE}$TESTS_TOTAL${NC}"
echo -e "Testes aprovados: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Testes falharam: ${RED}$TESTS_FAILED${NC}"

# Calcular porcentagem
if [ $TESTS_TOTAL -gt 0 ]; then
    PERCENTAGE=$((TESTS_PASSED * 100 / TESTS_TOTAL))
    echo -e "Taxa de sucesso: ${BLUE}$PERCENTAGE%${NC}"
else
    PERCENTAGE=0
fi

echo ""

# Status final
if [ $PERCENTAGE -ge 90 ]; then
    echo -e "${GREEN}🎉 SISTEMA APROVADO PARA PRODUÇÃO!${NC}"
    echo -e "${GREEN}✅ Todos os componentes críticos funcionando${NC}"
    EXIT_CODE=0
elif [ $PERCENTAGE -ge 75 ]; then
    echo -e "${YELLOW}⚠️ SISTEMA PARCIALMENTE FUNCIONAL${NC}"
    echo -e "${YELLOW}🔧 Alguns problemas menores identificados${NC}"
    EXIT_CODE=1
else
    echo -e "${RED}❌ SISTEMA NÃO PRONTO PARA PRODUÇÃO${NC}"
    echo -e "${RED}🚨 Problemas críticos identificados${NC}"
    EXIT_CODE=2
fi

echo ""
echo "🔗 URLs finais:"
echo "   - API Principal: https://$DOMAIN"
echo "   - Documentação: https://$DOMAIN/status"
if [ ! -z "$FRONTEND_URL" ]; then
    echo "   - Frontend: $FRONTEND_URL"
fi

echo ""
echo "📝 Próximos passos:"
if [ $EXIT_CODE -eq 0 ]; then
    echo "   ✅ Sistema pronto para uso em produção"
    echo "   📹 Conecte câmeras reais e teste transmissão"
    echo "   📊 Configure monitoramento e alertas"
elif [ $EXIT_CODE -eq 1 ]; then
    echo "   🔧 Revise e corrija problemas menores"
    echo "   🧪 Execute novamente após correções"
else
    echo "   🚨 Corrija problemas críticos antes de usar"
    echo "   📋 Verifique logs dos serviços"
    echo "   🔍 Consulte documentação de troubleshooting"
fi

echo ""
echo "📞 Suporte:"
echo "   - Logs Backend: /var/log/vigilancia/backend.log"
echo "   - Logs Worker: /var/log/vigilancia/worker.log"
echo "   - Status PM2: pm2 status"
echo "   - Status Docker: docker ps"

exit $EXIT_CODE 