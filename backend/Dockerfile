# Dockerfile para Backend - Sistema de Vigilância IP
FROM node:18-alpine

# Instalar dependências do sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Criar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar código fonte
COPY . .

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

# Alterar proprietário dos arquivos
RUN chown -R backend:nodejs /app
USER backend

# Expor porta
EXPOSE 3001

# Comando de inicialização
CMD ["npm", "start"] 