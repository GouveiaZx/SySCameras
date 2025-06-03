# Dockerfile para Worker - Sistema de Vigilância IP
FROM node:18-alpine

# Instalar FFmpeg e dependências necessárias
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    pkgconfig \
    vips-dev \
    && rm -rf /var/cache/apk/*

# Criar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar código fonte
COPY . .

# Criar diretórios necessários
RUN mkdir -p /app/tmp /app/streams /app/thumbnails /app/logs

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs
RUN adduser -S worker -u 1001

# Alterar proprietário dos arquivos e diretórios
RUN chown -R worker:nodejs /app
USER worker

# Expor porta
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Comando de inicialização
CMD ["npm", "start"] 