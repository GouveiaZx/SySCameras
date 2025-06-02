const { getExpiredRecordings } = require('./db');
const { deleteFromWasabi } = require('./wasabi');
const { supabase } = require('./services/supabase');

/**
 * Limpa gravações que excederam o período de retenção
 * @returns {Promise<Object>} Estatísticas de limpeza
 */
async function cleanupExpiredRecordings() {
  console.log('Iniciando limpeza de gravações expiradas...');
  
  const stats = {
    totalRecordings: 0,
    removedFromWasabi: 0,
    removedFromDatabase: 0,
    errors: 0
  };
  
  try {
    // Obter todas as gravações que excederam o período de retenção
    const expiredRecordings = await getExpiredRecordings();
    stats.totalRecordings = expiredRecordings.length;
    
    console.log(`Encontradas ${expiredRecordings.length} gravações expiradas`);
    
    // Processar cada gravação expirada
    for (const recording of expiredRecordings) {
      try {
        // Extrair a chave do arquivo da URL
        const url = new URL(recording.url);
        const fileKey = url.pathname.substring(1); // Remove a barra inicial
        
        // Excluir arquivo da Wasabi
        await deleteFromWasabi(fileKey);
        stats.removedFromWasabi++;
        
        // Excluir gravação do banco de dados usando Supabase
        const { error } = await supabase
          .from('recordings')
          .delete()
          .eq('id', recording.id);
        
        if (error) {
          throw error;
        }
        
        stats.removedFromDatabase++;
        
        console.log(`Gravação ${recording.id} (${recording.filename}) removida com sucesso`);
      } catch (error) {
        console.error(`Erro ao limpar gravação ${recording.id}:`, error);
        stats.errors++;
      }
    }
    
    console.log('Limpeza de gravações expiradas concluída');
    console.log(`Estatísticas: ${stats.removedFromWasabi} arquivos removidos do Wasabi, ${stats.removedFromDatabase} gravações removidas do banco`);
    
    return stats;
  } catch (error) {
    console.error('Erro durante limpeza de gravações expiradas:', error);
    throw error;
  }
}

module.exports = {
  cleanupExpiredRecordings
}; 