# 🗄️ Configuração do Banco de Dados - Supabase

## ✅ Status: Configurado e Funcionando

**Projeto:** Safe Cameras  
**URL:** https://mmpipjndealyromdfnoa.supabase.co  
**Região:** sa-east-1 (São Paulo)  
**Status:** ACTIVE_HEALTHY  
**Versão PostgreSQL:** 15.8.1.092  

---

## 🔑 Credenciais de Acesso

### URLs e Chaves:
- **URL:** `https://mmpipjndealyromdfnoa.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcGlwam5kZWFseXJvbWRmbm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4NDc5NzcsImV4cCI6MjA2MzQyMzk3N30.x_4ADMbr-Se1MXMRmHftDDq8Lji7rZUDUpo9Cv8b6R0`
- **Service Role Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcGlwam5kZWFseXJvbWRmbm9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Nzg0Nzk3NywiZXhwIjoyMDYzNDIzOTc3fQ.gHBER4v_A1HzfaqC2YlJHrVKGDcGB0RNejktoy3TvX8`

### Conexão Direta PostgreSQL:
- **Host:** `db.mmpipjndealyromdfnoa.supabase.co`
- **Porta:** `5432`
- **Database:** `postgres`
- **Schema:** `public`

---

## 📊 Estrutura do Banco de Dados

### Enums Criados:

#### UserRole
```sql
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'INTEGRATOR', 'CLIENT');
```

#### RecordingType
```sql
CREATE TYPE "RecordingType" AS ENUM ('MANUAL', 'MOTION', 'SCHEDULED', 'CONTINUOUS');
```

---

### 🗂️ Tabelas Principais

#### 1. users
Tabela central de usuários do sistema.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária (auto-gerada) |
| email | VARCHAR | E-mail único do usuário |
| name | VARCHAR | Nome completo |
| role | UserRole | Nível de acesso (ADMIN/INTEGRATOR/CLIENT) |
| createdAt | TIMESTAMP | Data de criação |
| updatedAt | TIMESTAMP | Data de atualização |

#### 2. integrators
Dados específicos dos integradores.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária |
| name | VARCHAR | Nome da empresa/integrador |
| userId | UUID | FK para users (único) |

#### 3. clients
Clientes vinculados aos integradores.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária |
| name | VARCHAR | Nome do cliente |
| userId | UUID | FK para users (único) |
| integratorId | UUID | FK para integrators |

#### 4. cameras
Câmeras IP do sistema.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária |
| name | VARCHAR | Nome da câmera |
| rtspUrl | VARCHAR | URL RTSP da câmera |
| rtmpUrl | VARCHAR | URL RTMP gerada (opcional) |
| hlsUrl | VARCHAR | URL HLS para streaming (opcional) |
| streamStatus | VARCHAR | Status do stream (ACTIVE/INACTIVE) |
| recordingStatus | VARCHAR | Status da gravação |
| clientId | UUID | FK para clients |
| integratorId | UUID | FK para integrators |
| userId | UUID | FK para users (opcional) |
| type | VARCHAR | Tipo/marca da câmera |
| status | VARCHAR | Status online/offline |
| createdAt | TIMESTAMP | Data de criação |
| updatedAt | TIMESTAMP | Data de atualização |

#### 5. recordings
Metadados das gravações.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária |
| filename | VARCHAR | Nome do arquivo |
| url | VARCHAR | URL do arquivo na Wasabi |
| date | TIMESTAMP | Data/hora da gravação |
| duration | INTEGER | Duração em segundos |
| size | INTEGER | Tamanho do arquivo em bytes |
| cameraId | UUID | FK para cameras |
| userId | UUID | FK para users |
| recordingType | RecordingType | Tipo da gravação |
| triggerEvent | VARCHAR | Evento que disparou (opcional) |
| scheduleId | UUID | ID do agendamento (opcional) |
| createdAt | TIMESTAMP | Data de criação |

---

### 🔔 Tabelas de Alertas e Notificações

#### 6. alerts
Sistema de alertas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária |
| cameraId | UUID | FK para cameras |
| status | VARCHAR | Status do alerta (NEW/READ/DISMISSED) |
| type | VARCHAR | Tipo (MOTION/OFFLINE/MANUAL) |
| message | VARCHAR | Mensagem do alerta (opcional) |
| thumbnailUrl | VARCHAR | URL da thumbnail (opcional) |
| date | TIMESTAMP | Data do alerta |
| readAt | TIMESTAMP | Data de leitura (opcional) |
| userId | UUID | FK para users (opcional) |

#### 7. notifications
Configurações de notificações.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária |
| type | VARCHAR | Tipo de notificação |
| userId | UUID | FK para users |
| email | VARCHAR | E-mail para notificação |
| preferences | JSONB | Preferências em JSON |

#### 8. alert_configurations
Configurações de alertas por câmera.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária |
| cameraId | UUID | FK para cameras |
| userId | UUID | FK para users |
| emailAddresses | TEXT[] | Lista de e-mails |
| notifyOnline | BOOLEAN | Notificar quando online |
| notifyOffline | BOOLEAN | Notificar quando offline |
| createdAt | TIMESTAMP | Data de criação |
| updatedAt | TIMESTAMP | Data de atualização |
| createdBy | UUID | Usuário que criou |

---

### ⚙️ Tabelas de Configuração

#### 9. retention_settings
Configurações de retenção por câmera.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária |
| cameraId | UUID | FK para cameras (único) |
| days | INTEGER | Dias de retenção (padrão: 7) |
| createdAt | TIMESTAMP | Data de criação |
| updatedAt | TIMESTAMP | Data de atualização |

#### 10. motion_detection_configs
Configurações de detecção de movimento.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária |
| cameraId | UUID | FK para cameras (único) |
| enabled | BOOLEAN | Detecção habilitada |
| sensitivity | INTEGER | Sensibilidade (1-100) |
| minMotionDuration | INTEGER | Duração mínima em segundos |
| preRecordingBuffer | INTEGER | Buffer pré-gravação |
| postRecordingBuffer | INTEGER | Buffer pós-gravação |
| notifyOnMotion | BOOLEAN | Notificar movimento |
| recordOnMotion | BOOLEAN | Gravar movimento |
| detectionAreas | JSONB | Áreas de detecção (JSON) |
| cooldownPeriod | INTEGER | Período de cooldown |
| createdAt | TIMESTAMP | Data de criação |
| updatedAt | TIMESTAMP | Data de atualização |

#### 11. recording_schedules
Agendamentos de gravação.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária |
| cameraId | UUID | FK para cameras |
| name | VARCHAR | Nome do agendamento |
| enabled | BOOLEAN | Agendamento ativo |
| daysOfWeek | INTEGER[] | Dias da semana (0-6) |
| startTime | VARCHAR | Horário início (HH:MM) |
| endTime | VARCHAR | Horário fim (HH:MM) |
| createdAt | TIMESTAMP | Data de criação |
| updatedAt | TIMESTAMP | Data de atualização |
| createdBy | UUID | Usuário que criou |

#### 12. camera_streams
Informações de streams ativas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária |
| cameraId | UUID | FK para cameras (único) |
| streamName | VARCHAR | Nome único do stream |
| hlsUrl | VARCHAR | URL HLS do stream |
| status | VARCHAR | Status (STARTING/ACTIVE/ERROR/STOPPED) |
| errorMessage | VARCHAR | Mensagem de erro (opcional) |
| startedAt | TIMESTAMP | Data de início |
| updatedAt | TIMESTAMP | Data de atualização |

---

## 🔧 Funcionalidades Implementadas

### Triggers Automáticos:
- ✅ Atualização automática do campo `updatedAt` em todas as tabelas relevantes
- ✅ Função `update_updated_at_column()` criada e aplicada

### Índices para Performance:
- ✅ `idx_cameras_client_id` - Busca por cliente
- ✅ `idx_cameras_integrator_id` - Busca por integrador
- ✅ `idx_recordings_camera_id` - Gravações por câmera
- ✅ `idx_recordings_date` - Gravações por data
- ✅ `idx_users_email` - Busca por e-mail
- ✅ `idx_users_role` - Busca por nível de acesso
- ✅ `idx_alerts_camera_id` - Alertas por câmera
- ✅ `idx_alerts_date` - Alertas por data
- ✅ `idx_alerts_status` - Alertas por status

### Relacionamentos (Foreign Keys):
- ✅ Todas as tabelas possuem relacionamentos corretos
- ✅ Cascata configurada para exclusões
- ✅ Integridade referencial garantida

---

## 🚀 Próximos Passos

1. ✅ Estrutura do banco criada e funcionando
2. ⏳ Implementar Row Level Security (RLS) no Supabase
3. ⏳ Configurar políticas de acesso por nível de usuário
4. ⏳ Criar views para consultas complexas
5. ⏳ Implementar stored procedures para operações específicas
6. ⏳ Configurar backup automático

---

## 📝 Notas Importantes

- Todas as tabelas usam UUID como chave primária
- Campos de data/hora são automaticamente atualizados via triggers
- O banco está configurado para UTF-8 e timezone UTC
- Todas as senhas e dados sensíveis devem ser criptografados na aplicação
- As gravações são armazenadas na Wasabi, apenas metadados no banco 