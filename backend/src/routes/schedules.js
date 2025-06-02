const { createClient } = require('@supabase/supabase-js');

// Configurar cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Rotas simples para agendamentos
 * @param {Object} fastify - Instância do Fastify
 */
async function routes(fastify, options) {
  // Listar todos os agendamentos
  fastify.get('/', async (request, reply) => {
    try {
      console.log('📅 Buscando todos os agendamentos...');
      
      // Buscar todos os agendamentos de todas as câmeras (consulta simples primeiro)
      const { data: schedules, error } = await supabase
        .from('recording_schedules')
        .select('*');

      if (error) {
        console.error('❌ Erro ao buscar agendamentos:', error);
        return reply.code(500).send({
          error: 'Erro interno',
          message: 'Falha ao buscar agendamentos',
          details: error.message
        });
      }

      console.log(`✅ Encontrados ${schedules?.length || 0} agendamentos`);
      return reply.code(200).send(schedules || []);
      
    } catch (error) {
      console.error('❌ Erro inesperado ao buscar agendamentos:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Ocorreu um erro inesperado',
        details: error.message
      });
    }
  });

  // Criar um novo agendamento
  fastify.post('/', async (request, reply) => {
    try {
      const { cameraId, name, daysOfWeek, startTime, endTime, enabled = true } = request.body;
      
      console.log('📝 Criando novo agendamento:', { cameraId, name, daysOfWeek, startTime, endTime });

      // Validações básicas
      if (!cameraId || !name || !daysOfWeek || !startTime || !endTime) {
        return reply.code(400).send({
          error: 'Dados inválidos',
          message: 'Todos os campos são obrigatórios: cameraId, name, daysOfWeek, startTime, endTime'
        });
      }

      // Criar agendamento
      const { data: schedule, error } = await supabase
        .from('recording_schedules')
        .insert({
          camera_id: cameraId,
          name,
          days_of_week: daysOfWeek,
          start_time: startTime,
          end_time: endTime,
          enabled,
          created_by: request.user?.id
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar agendamento:', error);
        return reply.code(500).send({
          error: 'Erro interno',
          message: 'Falha ao criar agendamento'
        });
      }

      console.log('✅ Agendamento criado:', schedule.id);
      return reply.code(201).send(schedule);
      
    } catch (error) {
      console.error('❌ Erro inesperado ao criar agendamento:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Ocorreu um erro inesperado'
      });
    }
  });
}

module.exports = routes; 