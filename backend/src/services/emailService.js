const nodemailer = require('nodemailer');

// Configuração do transportador de e-mail
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Envia e-mail de notificação para uma lista de destinatários
 * @param {Array<string>} to - Lista de e-mails destinatários
 * @param {string} subject - Assunto do e-mail
 * @param {string} text - Conteúdo em texto plano
 * @param {string} html - Conteúdo em HTML (opcional)
 * @returns {Promise} Resultado do envio
 */
async function sendEmail(to, subject, text, html) {
  try {
    const mailOptions = {
      from: `"Sistema de Monitoramento" <${process.env.EMAIL_FROM || 'noreply@example.com'}>`,
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      text,
      html: html || text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('E-mail enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envia notificação de alteração de status da câmera
 * @param {Array<string>} emails - Lista de e-mails para notificar
 * @param {Object} camera - Dados da câmera
 * @param {string} status - Novo status ('online' ou 'offline')
 * @returns {Promise} Resultado do envio
 */
async function sendCameraStatusAlert(emails, camera, status) {
  const subject = `Alerta de Câmera: ${camera.name} está ${status === 'online' ? 'ONLINE' : 'OFFLINE'}`;
  
  const text = `
    Alerta de Monitoramento de Câmera
    
    A câmera ${camera.name} agora está ${status === 'online' ? 'ONLINE' : 'OFFLINE'}.
    
    Detalhes da câmera:
    - ID: ${camera.id}
    - Cliente: ${camera.client?.name || 'Não informado'}
    - Alteração detectada em: ${new Date().toLocaleString('pt-BR')}
    
    Este é um e-mail automático, por favor não responda.
  `;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${status === 'online' ? '#2e7d32' : '#c62828'};">
        Alerta de Monitoramento de Câmera
      </h2>
      
      <p style="font-size: 16px;">
        A câmera <strong>${camera.name}</strong> agora está 
        <span style="color: ${status === 'online' ? '#2e7d32' : '#c62828'}; font-weight: bold;">
          ${status === 'online' ? 'ONLINE' : 'OFFLINE'}
        </span>.
      </p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Detalhes da câmera:</h3>
        <ul>
          <li>ID: ${camera.id}</li>
          <li>Cliente: ${camera.client?.name || 'Não informado'}</li>
          <li>Alteração detectada em: ${new Date().toLocaleString('pt-BR')}</li>
        </ul>
      </div>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Este é um e-mail automático, por favor não responda.
      </p>
    </div>
  `;
  
  return await sendEmail(emails, subject, text, html);
}

module.exports = {
  sendEmail,
  sendCameraStatusAlert
}; 