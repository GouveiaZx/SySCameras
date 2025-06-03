const { Resend } = require('resend');

// Configuração do cliente Resend
const resend = new Resend(process.env.RESEND_API_KEY);

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
    const recipients = Array.isArray(to) ? to : [to];
    
    console.log(`📧 Enviando email para: ${recipients.join(', ')}`);
    console.log(`📧 Assunto: ${subject}`);
    
    const emailData = {
      from: 'Sistema de Vigilância <onboarding@resend.dev>',
      to: recipients,
      subject,
      text,
      html: html || `<pre>${text}</pre>`,
    };

    const result = await resend.emails.send(emailData);
    
    if (result.error) {
      console.error('❌ Erro ao enviar e-mail via Resend:', result.error);
      return { success: false, error: result.error };
    }
    
    console.log('✅ E-mail enviado com sucesso via Resend:', result.data.id);
    return { success: true, messageId: result.data.id };
    
  } catch (error) {
    console.error('❌ Erro crítico ao enviar e-mail:', error);
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
  const statusText = status === 'online' ? 'ONLINE' : 'OFFLINE';
  const statusColor = status === 'online' ? '#2e7d32' : '#c62828';
  const statusIcon = status === 'online' ? '🟢' : '🔴';
  
  const subject = `${statusIcon} Alerta de Câmera: ${camera.name} está ${statusText}`;
  
  const text = `
    Alerta de Monitoramento de Câmera
    
A câmera ${camera.name} agora está ${statusText}.
    
    Detalhes da câmera:
    - ID: ${camera.id}
    - Cliente: ${camera.client?.name || 'Não informado'}
- Status anterior: ${status === 'online' ? 'OFFLINE' : 'ONLINE'}
- Alteração detectada em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
    
Este é um e-mail automático do Sistema de Vigilância IP.
Para mais informações, acesse o painel de controle.
  `.trim();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Alerta de Câmera</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
            ${statusIcon} Sistema de Vigilância IP
          </h1>
          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">
            Notificação de Status de Câmera
          </p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; padding: 15px 25px; background-color: ${statusColor}; color: white; border-radius: 25px; font-weight: 600; font-size: 16px;">
              A câmera ${camera.name} está ${statusText}
            </div>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📹 Detalhes da câmera:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">ID:</td>
                <td style="padding: 8px 0; color: #333;">${camera.id}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Nome:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 600;">${camera.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Cliente:</td>
                <td style="padding: 8px 0; color: #333;">${camera.client?.name || 'Não informado'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Status anterior:</td>
                <td style="padding: 8px 0; color: #333;">${status === 'online' ? 'OFFLINE' : 'ONLINE'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Detectado em:</td>
                <td style="padding: 8px 0; color: #333;">${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
              </tr>
            </table>
          </div>
          
          ${status === 'offline' ? `
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <strong style="color: #856404;">⚠️ Ação recomendada:</strong>
            <p style="margin: 5px 0 0 0; color: #856404;">
              Verifique a conexão de rede da câmera e certifique-se de que está funcionando corretamente.
            </p>
          </div>
          ` : `
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <strong style="color: #155724;">✅ Status:</strong>
            <p style="margin: 5px 0 0 0; color: #155724;">
              A câmera está funcionando normalmente e transmitindo dados.
            </p>
          </div>
          `}
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
          <p style="margin: 0; color: #6c757d; font-size: 14px;">
            Este é um e-mail automático do Sistema de Vigilância IP.<br>
            Para mais informações, acesse o painel de controle.
          </p>
          <p style="margin: 10px 0 0 0; color: #adb5bd; font-size: 12px;">
            © ${new Date().getFullYear()} Sistema de Vigilância IP - Todos os direitos reservados
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail(emails, subject, text, html);
}

/**
 * Envia notificação de movimento detectado
 * @param {Array<string>} emails - Lista de e-mails para notificar
 * @param {Object} camera - Dados da câmera
 * @param {string} thumbnailUrl - URL da thumbnail (opcional)
 * @returns {Promise} Resultado do envio
 */
async function sendMotionAlert(emails, camera, thumbnailUrl = null) {
  const subject = `🚨 Movimento Detectado: ${camera.name}`;
  
  const text = `
Alerta de Movimento Detectado

Foi detectado movimento na câmera ${camera.name}.

Detalhes:
- ID da câmera: ${camera.id}
- Cliente: ${camera.client?.name || 'Não informado'}
- Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
${thumbnailUrl ? `- Thumbnail: ${thumbnailUrl}` : ''}

Este é um e-mail automático do Sistema de Vigilância IP.
  `.trim();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Movimento Detectado</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
            🚨 Movimento Detectado
          </h1>
          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">
            Sistema de Vigilância IP
          </p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; padding: 15px 25px; background-color: #ff6b6b; color: white; border-radius: 25px; font-weight: 600; font-size: 16px;">
              Movimento na câmera ${camera.name}
            </div>
          </div>
          
          ${thumbnailUrl ? `
          <div style="text-align: center; margin: 20px 0;">
            <img src="${thumbnailUrl}" alt="Thumbnail do movimento" style="max-width: 100%; height: auto; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          </div>
          ` : ''}
      
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📹 Detalhes:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Câmera:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 600;">${camera.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">ID:</td>
                <td style="padding: 8px 0; color: #333;">${camera.id}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Cliente:</td>
                <td style="padding: 8px 0; color: #333;">${camera.client?.name || 'Não informado'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Detectado em:</td>
                <td style="padding: 8px 0; color: #333;">${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <strong style="color: #856404;">📝 Próximos passos:</strong>
            <p style="margin: 5px 0 0 0; color: #856404;">
              Acesse o painel de controle para visualizar as gravações e tomar as ações necessárias.
            </p>
          </div>
      </div>
      
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
          <p style="margin: 0; color: #6c757d; font-size: 14px;">
            Este é um e-mail automático do Sistema de Vigilância IP.
          </p>
          <p style="margin: 10px 0 0 0; color: #adb5bd; font-size: 12px;">
            © ${new Date().getFullYear()} Sistema de Vigilância IP - Todos os direitos reservados
      </p>
    </div>
        
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail(emails, subject, text, html);
}

/**
 * Envia e-mail de teste para verificar configuração
 * @param {string} email - E-mail para teste
 * @returns {Promise} Resultado do envio
 */
async function sendTestEmail(email) {
  const subject = '✅ Teste do Sistema de E-mail - Vigilância IP';
  
  const text = `
Teste do Sistema de E-mail

Este é um e-mail de teste para verificar se o sistema de notificações está funcionando corretamente.

Configuração:
- Provedor: Resend
- Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

Se você recebeu este e-mail, o sistema está configurado corretamente!

Sistema de Vigilância IP
  `.trim();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Teste do Sistema de E-mail</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
            ✅ Sistema de E-mail
          </h1>
          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">
            Teste de Configuração
          </p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px 20px; text-align: center;">
          <div style="display: inline-block; padding: 20px 30px; background-color: #e8f5e8; border: 2px solid #4CAF50; border-radius: 15px; margin-bottom: 30px;">
            <h2 style="margin: 0; color: #2e7d32; font-size: 20px;">
              🎉 Configuração Bem-sucedida!
            </h2>
            <p style="margin: 10px 0 0 0; color: #2e7d32;">
              O sistema de e-mails está funcionando corretamente.
            </p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📊 Informações do Teste:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Provedor:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 600;">Resend</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Destinatário:</td>
                <td style="padding: 8px 0; color: #333;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: 500;">Data/Hora:</td>
                <td style="padding: 8px 0; color: #333;">${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <strong style="color: #155724;">🚀 Sistema Pronto!</strong>
            <p style="margin: 5px 0 0 0; color: #155724;">
              As notificações automáticas de status e movimento estão ativas.
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
          <p style="margin: 0; color: #6c757d; font-size: 14px;">
            Sistema de Vigilância IP - E-mail de Teste
          </p>
          <p style="margin: 10px 0 0 0; color: #adb5bd; font-size: 12px;">
            © ${new Date().getFullYear()} Sistema de Vigilância IP
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail(email, subject, text, html);
}

module.exports = {
  sendEmail,
  sendCameraStatusAlert,
  sendMotionAlert,
  sendTestEmail
}; 