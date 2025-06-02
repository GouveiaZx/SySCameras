const { PrismaClient } = require('@prisma/client');
const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const prisma = new PrismaClient();

// Configuração do cliente Wasabi S3
const s3Client = new S3Client({
  region: process.env.WASABI_REGION || 'us-east-1',
  endpoint: process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com',
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY,
    secretAccessKey: process.env.WASABI_SECRET_KEY,
  },
});

/**
 * Lista gravações por câmera e período
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function getRecordings(request, reply) {
  try {
    const { role, id: userId } = request.user;
    const { cameraId, startDate, endDate, page = 1, pageSize = 20 } = request.query;
    
    // Validar permissão para a câmera solicitada
    let camera = null;
    
    if (cameraId) {
      camera = await prisma.camera.findUnique({
        where: { id: cameraId },
        include: {
          client: true
        }
      });
      
      if (!camera) {
        return reply.code(404).send({
          error: 'Câmera não encontrada',
          message: 'A câmera solicitada não existe'
        });
      }
      
      // Verificar permissão de acesso à câmera
      if (role === 'CLIENT') {
        const client = await prisma.client.findUnique({
          where: { userId }
        });
        
        if (!client || camera.clientId !== client.id) {
          return reply.code(403).send({
            error: 'Permissão negada',
            message: 'Você não tem permissão para acessar gravações desta câmera'
          });
        }
      } else if (role === 'INTEGRATOR') {
        const integrator = await prisma.integrator.findUnique({
          where: { userId }
        });
        
        if (!integrator || camera.integratorId !== integrator.id) {
          return reply.code(403).send({
            error: 'Permissão negada',
            message: 'Você não tem permissão para acessar gravações desta câmera'
          });
        }
      }
    }
    
    // Filtros de data
    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }
    
    // Calcular paginação
    const skip = (page - 1) * pageSize;
    
    // Montar query base
    const where = {};
    
    // Filtrar por câmera se especificado
    if (cameraId) {
      where.cameraId = cameraId;
    } else {
      // Se não especificou câmera, filtra baseado nas permissões
      if (role === 'CLIENT') {
        const client = await prisma.client.findUnique({
          where: { userId },
          include: {
            cameras: {
              select: { id: true }
            }
          }
        });
        
        if (!client || client.cameras.length === 0) {
          return reply.code(200).send({
            data: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0
          });
        }
        
        where.cameraId = {
          in: client.cameras.map(cam => cam.id)
        };
      } else if (role === 'INTEGRATOR') {
        const integrator = await prisma.integrator.findUnique({
          where: { userId },
          include: {
            cameras: {
              select: { id: true }
            }
          }
        });
        
        if (!integrator || integrator.cameras.length === 0) {
          return reply.code(200).send({
            data: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0
          });
        }
        
        where.cameraId = {
          in: integrator.cameras.map(cam => cam.id)
        };
      }
    }
    
    // Adicionar filtro de data se houver
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }
    
    // Consultar dados com paginação
    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          date: 'desc'
        },
        include: {
          camera: {
            select: {
              name: true,
              client: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }),
      prisma.recording.count({ where })
    ]);
    
    // Calcular total de páginas
    const totalPages = Math.ceil(total / pageSize);
    
    return reply.code(200).send({
      data: recordings,
      total,
      page,
      pageSize,
      totalPages
    });
    
  } catch (error) {
    console.error('Erro ao listar gravações:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao buscar gravações'
    });
  }
}

/**
 * Obtém detalhes de uma gravação específica
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function getRecordingById(request, reply) {
  try {
    const { id } = request.params;
    const { role, id: userId } = request.user;
    
    // Buscar gravação com dados da câmera
    const recording = await prisma.recording.findUnique({
      where: { id },
      include: {
        camera: {
          include: {
            client: true
          }
        }
      }
    });
    
    if (!recording) {
      return reply.code(404).send({
        error: 'Gravação não encontrada',
        message: 'A gravação solicitada não existe'
      });
    }
    
    // Verificar permissão
    if (role === 'CLIENT') {
      const client = await prisma.client.findUnique({
        where: { userId }
      });
      
      if (!client || recording.camera.clientId !== client.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para acessar esta gravação'
        });
      }
    } else if (role === 'INTEGRATOR') {
      const integrator = await prisma.integrator.findUnique({
        where: { userId }
      });
      
      if (!integrator || recording.camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para acessar esta gravação'
        });
      }
    }
    
    return reply.code(200).send(recording);
    
  } catch (error) {
    console.error('Erro ao buscar gravação:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao buscar detalhes da gravação'
    });
  }
}

/**
 * Limpa gravações antigas com base nas configurações de retenção
 * Esta função é executada pelo agendador de tarefas
 */
async function cleanupExpiredRecordings() {
  try {
    console.log('Iniciando limpeza de gravações expiradas...');
    
    // Buscar todas as câmeras com configurações de retenção
    const cameras = await prisma.camera.findMany({
      include: {
        retention: true
      }
    });
    
    const bucket = process.env.WASABI_BUCKET;
    let deletedCount = 0;
    
    // Para cada câmera, obter e limpar gravações expiradas
    for (const camera of cameras) {
      const retentionDays = camera.retention?.days || 7; // Padrão: 7 dias
      
      // Calcular data limite para retenção
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - retentionDays);
      
      // Buscar gravações expiradas para esta câmera
      const expiredRecordings = await prisma.recording.findMany({
        where: {
          cameraId: camera.id,
          date: {
            lt: retentionDate
          }
        }
      });
      
      console.log(`Câmera ${camera.name}: ${expiredRecordings.length} gravações expiradas`);
      
      // Excluir cada gravação expirada
      for (const recording of expiredRecordings) {
        try {
          // Extrair o nome do arquivo da URL
          const filename = recording.filename;
          
          // Excluir do Wasabi
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucket,
            Key: filename
          });
          
          await s3Client.send(deleteCommand);
          console.log(`Arquivo excluído do Wasabi: ${filename}`);
          
          // Excluir do banco de dados
          await prisma.recording.delete({
            where: { id: recording.id }
          });
          
          deletedCount++;
        } catch (deleteError) {
          console.error(`Erro ao excluir gravação ${recording.id}:`, deleteError);
        }
      }
    }
    
    console.log(`Limpeza concluída. ${deletedCount} gravações removidas.`);
    return { success: true, deletedCount };
    
  } catch (error) {
    console.error('Erro na limpeza de gravações expiradas:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza configuração de retenção para uma câmera
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function updateRetentionSetting(request, reply) {
  try {
    const { cameraId } = request.params;
    const { days } = request.body;
    const { role, id: userId } = request.user;
    
    // Validar dias de retenção
    if (!days || days < 1 || days > 60) {
      return reply.code(400).send({
        error: 'Dados inválidos',
        message: 'Os dias de retenção devem estar entre 1 e 60'
      });
    }
    
    // Buscar câmera
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId }
    });
    
    if (!camera) {
      return reply.code(404).send({
        error: 'Câmera não encontrada',
        message: 'A câmera solicitada não existe'
      });
    }
    
    // Verificar permissão
    if (role === 'CLIENT') {
      return reply.code(403).send({
        error: 'Permissão negada',
        message: 'Clientes não podem alterar configurações de retenção'
      });
    } else if (role === 'INTEGRATOR') {
      const integrator = await prisma.integrator.findUnique({
        where: { userId }
      });
      
      if (!integrator || camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para configurar esta câmera'
        });
      }
    }
    
    // Atualizar ou criar configuração de retenção
    const retention = await prisma.retentionSetting.upsert({
      where: { cameraId },
      update: { days },
      create: {
        cameraId,
        days
      }
    });
    
    return reply.code(200).send(retention);
    
  } catch (error) {
    console.error('Erro ao atualizar configuração de retenção:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao atualizar a configuração de retenção'
    });
  }
}

module.exports = {
  getRecordings,
  getRecordingById,
  cleanupExpiredRecordings,
  updateRetentionSetting
}; 