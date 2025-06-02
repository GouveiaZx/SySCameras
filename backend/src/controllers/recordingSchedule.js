const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Lista agendamentos de gravação para uma câmera
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function getRecordingSchedules(request, reply) {
  try {
    const { cameraId } = request.params;
    const { role, id: userId } = request.user;
    
    // Verificar se a câmera existe
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId },
      include: {
        client: true,
        integrator: true
      }
    });
    
    if (!camera) {
      return reply.code(404).send({
        error: 'Câmera não encontrada',
        message: 'A câmera solicitada não existe'
      });
    }
    
    // Verificar permissões
    if (role === 'CLIENT') {
      const client = await prisma.client.findUnique({
        where: { userId }
      });
      
      if (!client || camera.clientId !== client.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para acessar esta câmera'
        });
      }
    } else if (role === 'INTEGRATOR') {
      const integrator = await prisma.integrator.findUnique({
        where: { userId }
      });
      
      if (!integrator || camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para acessar esta câmera'
        });
      }
    }
    
    // Buscar agendamentos existentes
    const schedules = await prisma.recordingSchedule.findMany({
      where: { cameraId }
    });
    
    return reply.code(200).send(schedules);
    
  } catch (error) {
    console.error('Erro ao listar agendamentos de gravação:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao listar agendamentos de gravação'
    });
  }
}

/**
 * Cria um novo agendamento de gravação
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function createRecordingSchedule(request, reply) {
  try {
    const { cameraId } = request.params;
    const { role, id: userId } = request.user;
    const { name, daysOfWeek, startTime, endTime, enabled } = request.body;
    
    // Verificar se a câmera existe
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId },
      include: {
        client: true,
        integrator: true
      }
    });
    
    if (!camera) {
      return reply.code(404).send({
        error: 'Câmera não encontrada',
        message: 'A câmera solicitada não existe'
      });
    }
    
    // Verificar permissões (apenas integradores e admins podem criar agendamentos)
    if (role === 'CLIENT') {
      return reply.code(403).send({
        error: 'Permissão negada',
        message: 'Apenas integradores e administradores podem criar agendamentos de gravação'
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
    
    // Validar dados
    if (!name || name.trim() === '') {
      return reply.code(400).send({
        error: 'Dados inválidos',
        message: 'Nome do agendamento é obrigatório'
      });
    }
    
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return reply.code(400).send({
        error: 'Dados inválidos',
        message: 'Dias da semana são obrigatórios'
      });
    }
    
    if (!startTime || !endTime) {
      return reply.code(400).send({
        error: 'Dados inválidos',
        message: 'Horários de início e fim são obrigatórios'
      });
    }
    
    // Validar formato de horário (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return reply.code(400).send({
        error: 'Dados inválidos',
        message: 'Horários devem estar no formato HH:MM'
      });
    }
    
    // Criar novo agendamento
    const schedule = await prisma.recordingSchedule.create({
      data: {
        cameraId,
        name,
        daysOfWeek,
        startTime,
        endTime,
        enabled: enabled !== undefined ? enabled : true,
        createdBy: userId
      }
    });
    
    return reply.code(201).send(schedule);
    
  } catch (error) {
    console.error('Erro ao criar agendamento de gravação:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao criar agendamento de gravação'
    });
  }
}

/**
 * Atualiza um agendamento de gravação existente
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function updateRecordingSchedule(request, reply) {
  try {
    const { scheduleId } = request.params;
    const { role, id: userId } = request.user;
    const { name, daysOfWeek, startTime, endTime, enabled } = request.body;
    
    // Buscar agendamento existente
    const schedule = await prisma.recordingSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        camera: {
          include: {
            integrator: true
          }
        }
      }
    });
    
    if (!schedule) {
      return reply.code(404).send({
        error: 'Agendamento não encontrado',
        message: 'O agendamento solicitado não existe'
      });
    }
    
    // Verificar permissões (apenas integradores e admins podem atualizar agendamentos)
    if (role === 'CLIENT') {
      return reply.code(403).send({
        error: 'Permissão negada',
        message: 'Apenas integradores e administradores podem atualizar agendamentos de gravação'
      });
    } else if (role === 'INTEGRATOR') {
      const integrator = await prisma.integrator.findUnique({
        where: { userId }
      });
      
      if (!integrator || schedule.camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para atualizar este agendamento'
        });
      }
    }
    
    // Validar dados de horário (se informados)
    if (startTime || endTime) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      
      if (startTime && !timeRegex.test(startTime)) {
        return reply.code(400).send({
          error: 'Dados inválidos',
          message: 'Horário de início deve estar no formato HH:MM'
        });
      }
      
      if (endTime && !timeRegex.test(endTime)) {
        return reply.code(400).send({
          error: 'Dados inválidos',
          message: 'Horário de fim deve estar no formato HH:MM'
        });
      }
    }
    
    // Atualizar agendamento
    const updatedSchedule = await prisma.recordingSchedule.update({
      where: { id: scheduleId },
      data: {
        name: name !== undefined ? name : undefined,
        daysOfWeek: daysOfWeek !== undefined ? daysOfWeek : undefined,
        startTime: startTime !== undefined ? startTime : undefined,
        endTime: endTime !== undefined ? endTime : undefined,
        enabled: enabled !== undefined ? enabled : undefined
      }
    });
    
    return reply.code(200).send(updatedSchedule);
    
  } catch (error) {
    console.error('Erro ao atualizar agendamento de gravação:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao atualizar agendamento de gravação'
    });
  }
}

/**
 * Remove um agendamento de gravação
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function deleteRecordingSchedule(request, reply) {
  try {
    const { scheduleId } = request.params;
    const { role, id: userId } = request.user;
    
    // Buscar agendamento existente
    const schedule = await prisma.recordingSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        camera: {
          include: {
            integrator: true
          }
        }
      }
    });
    
    if (!schedule) {
      return reply.code(404).send({
        error: 'Agendamento não encontrado',
        message: 'O agendamento solicitado não existe'
      });
    }
    
    // Verificar permissões (apenas integradores e admins podem remover agendamentos)
    if (role === 'CLIENT') {
      return reply.code(403).send({
        error: 'Permissão negada',
        message: 'Apenas integradores e administradores podem remover agendamentos de gravação'
      });
    } else if (role === 'INTEGRATOR') {
      const integrator = await prisma.integrator.findUnique({
        where: { userId }
      });
      
      if (!integrator || schedule.camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para remover este agendamento'
        });
      }
    }
    
    // Excluir agendamento
    await prisma.recordingSchedule.delete({
      where: { id: scheduleId }
    });
    
    return reply.code(204).send();
    
  } catch (error) {
    console.error('Erro ao excluir agendamento de gravação:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao excluir agendamento de gravação'
    });
  }
}

/**
 * Verifica se há agendamentos ativos para as câmeras
 * Esta função seria chamada por um job agendado no sistema
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function checkActiveSchedules(request, reply) {
  try {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Segunda, etc.
    
    console.log(`Verificando agendamentos ativos às ${currentTime} (dia ${dayOfWeek})`);
    
    // Buscar agendamentos que devem estar ativos neste momento
    const activeSchedules = await prisma.recordingSchedule.findMany({
      where: {
        enabled: true,
        daysOfWeek: {
          has: dayOfWeek
        }
      },
      include: {
        camera: true
      }
    });
    
    const camerasToStartRecording = [];
    const camerasToStopRecording = [];
    
    // Verificar quais agendamentos devem iniciar ou parar gravação
    for (const schedule of activeSchedules) {
      // Verificar se o horário atual está dentro do período de gravação
      const isInScheduledPeriod = isTimeBetween(currentTime, schedule.startTime, schedule.endTime);
      
      if (isInScheduledPeriod) {
        // Verificar se a câmera está online
        if (schedule.camera.status === 'online') {
          camerasToStartRecording.push({
            cameraId: schedule.cameraId,
            scheduleId: schedule.id,
            scheduleName: schedule.name
          });
        } else {
          console.log(`Câmera ${schedule.camera.name} (${schedule.cameraId}) está offline, não pode iniciar gravação agendada`);
        }
      } else {
        // Verificar se está próximo do final do período (dentro de 1 minuto)
        const endTimeMinutes = timeToMinutes(schedule.endTime);
        const currentTimeMinutes = timeToMinutes(currentTime);
        
        if (Math.abs(endTimeMinutes - currentTimeMinutes) <= 1) {
          camerasToStopRecording.push({
            cameraId: schedule.cameraId,
            scheduleId: schedule.id,
            scheduleName: schedule.name
          });
        }
      }
    }
    
    // Em uma implementação real, aqui você iniciaria ou pararia gravações
    // Por enquanto, apenas retornamos as câmeras que devem ser atualizadas
    return reply.code(200).send({
      timestamp: now.toISOString(),
      startRecording: camerasToStartRecording,
      stopRecording: camerasToStopRecording
    });
    
  } catch (error) {
    console.error('Erro ao verificar agendamentos ativos:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao verificar agendamentos ativos'
    });
  }
}

/**
 * Verifica se um horário está entre outros dois
 * @param {string} time - Horário a verificar (HH:MM)
 * @param {string} start - Horário de início (HH:MM)
 * @param {string} end - Horário de fim (HH:MM)
 * @returns {boolean} Verdadeiro se o horário está no intervalo
 */
function isTimeBetween(time, start, end) {
  // Converter para minutos desde meia-noite para facilitar comparação
  const timeMinutes = timeToMinutes(time);
  let startMinutes = timeToMinutes(start);
  let endMinutes = timeToMinutes(end);
  
  // Verificar período que cruza meia-noite (ex: 23:00 às 01:00)
  if (endMinutes < startMinutes) {
    // Período cruza meia-noite
    return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
  } else {
    // Período normal
    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  }
}

/**
 * Converte um horário no formato HH:MM para minutos desde meia-noite
 * @param {string} time - Horário no formato HH:MM
 * @returns {number} Minutos desde meia-noite
 */
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

module.exports = {
  getRecordingSchedules,
  createRecordingSchedule,
  updateRecordingSchedule,
  deleteRecordingSchedule,
  checkActiveSchedules
}; 