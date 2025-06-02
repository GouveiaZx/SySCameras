import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const prisma = new PrismaClient();

// Configurações do transporte de email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || 'user@example.com',
    pass: process.env.EMAIL_PASSWORD || 'password',
  },
});

/**
 * Lê um template HTML e substitui variáveis
 * @param templateName Nome do arquivo do template
 * @param variables Variáveis para substituição no template
 * @returns Template HTML processado
 */
function getEmailTemplate(templateName: string, variables: Record<string, string>): string {
  try {
    const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Substituir variáveis
    for (const [key, value] of Object.entries(variables)) {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    return template;
  } catch (error) {
    console.error(`Erro ao carregar template de email ${templateName}:`, error);
    // Template padrão caso o arquivo não seja encontrado
    return `<html><body><h1>Notificação</h1><p>${variables.message || 'Notificação do sistema'}</p></body></html>`;
  }
}

/**
 * Envia email para destinatários
 * @param to Destinatário(s)
 * @param subject Assunto do email
 * @param html Conteúdo HTML do email
 * @returns Resultado do envio
 */
async function sendEmail(to: string | string[], subject: string, html: string): Promise<boolean> {
  try {
    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Sistema de Vigilância <sistema@vigilancia.com>',
      to,
      subject,
      html,
    });
    
    console.log(`Email enviado para ${to}: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error(`Erro ao enviar email para ${to}:`, error);
    return false;
  }
}

/**
 * Envia notificação de alerta para usuários configurados
 * @param alertId ID do alerta
 * @returns Resultado do envio
 */
export async function sendAlertNotification(alertId: string): Promise<boolean> {
  try {
    // Buscar informações do alerta
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        camera: {
          include: {
            client: true
          }
        }
      }
    });
    
    if (!alert) {
      console.error(`Alerta não encontrado: ${alertId}`);
      return false;
    }
    
    // Buscar configurações de notificação para esta câmera
    const alertConfigurations = await prisma.alertConfiguration.findMany({
      where: { cameraId: alert.cameraId },
      include: {
        user: true
      }
    });
    
    if (alertConfigurations.length === 0) {
      console.log(`Nenhuma configuração de alerta encontrada para a câmera ${alert.cameraId}`);
      return false;
    }
    
    // Determinar o tipo de alerta
    let alertTypeName = 'desconhecido';
    switch (alert.type) {
      case 'MOTION':
        alertTypeName = 'movimento';
        break;
      case 'OFFLINE':
        alertTypeName = 'câmera offline';
        break;
      case 'MANUAL':
        alertTypeName = 'manual';
        break;
    }
    
    // Formatar data
    const formattedDate = format(
      alert.date,
      "dd 'de' MMMM 'de' yyyy, HH:mm",
      { locale: ptBR }
    );
    
    // Para cada configuração, verificar o tipo de alerta e enviar email se necessário
    let emailsSent = 0;
    
    for (const config of alertConfigurations) {
      // Verificar se devemos enviar notificação para este tipo de alerta
      if (
        (alert.type === 'OFFLINE' && config.notifyOffline) ||
        (alert.type === 'MOTION' && config.notifyOnline) ||
        alert.type === 'MANUAL'
      ) {
        // Preparar variáveis para o template
        const templateVars = {
          userName: config.user.name,
          cameraName: alert.camera.name,
          clientName: alert.camera.client.name,
          alertType: alertTypeName,
          alertDate: formattedDate,
          alertMessage: alert.message || '',
          thumbnailUrl: alert.thumbnailUrl || '',
          systemUrl: process.env.FRONTEND_URL || 'https://vigilancia.com',
        };
        
        // Obter o template HTML
        const html = getEmailTemplate('alert-notification', templateVars);
        
        // Enviar para todos os emails configurados
        const emailsToNotify = config.emailAddresses;
        
        if (emailsToNotify.length > 0) {
          const result = await sendEmail(
            emailsToNotify,
            `Alerta de ${alertTypeName} - ${alert.camera.name}`,
            html
          );
          
          if (result) {
            emailsSent += emailsToNotify.length;
          }
        }
      }
    }
    
    console.log(`Enviadas ${emailsSent} notificações para o alerta ${alertId}`);
    return emailsSent > 0;
  } catch (error) {
    console.error(`Erro ao enviar notificação para o alerta ${alertId}:`, error);
    return false;
  }
}

/**
 * Envia um relatório diário de alertas para um usuário
 * @param userId ID do usuário
 * @returns Resultado do envio
 */
export async function sendDailyAlertReport(userId: string): Promise<boolean> {
  try {
    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: true,
        integrator: true
      }
    });
    
    if (!user) {
      console.error(`Usuário não encontrado: ${userId}`);
      return false;
    }
    
    // Determinar câmeras para o relatório baseado no papel do usuário
    let cameraFilter: any = {};
    
    if (user.role === 'CLIENT' && user.client) {
      cameraFilter.clientId = user.client.id;
    } else if (user.role === 'INTEGRATOR' && user.integrator) {
      cameraFilter.integratorId = user.integrator.id;
    } else if (user.role !== 'ADMIN') {
      console.error(`Papel de usuário não suportado para relatório: ${user.role}`);
      return false;
    }
    
    // Data de 24 horas atrás
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Buscar alertas das últimas 24 horas
    const alerts = await prisma.alert.findMany({
      where: {
        date: {
          gte: yesterday
        },
        camera: cameraFilter
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
      },
      orderBy: {
        date: 'desc'
      }
    });
    
    if (alerts.length === 0) {
      console.log(`Nenhum alerta nas últimas 24 horas para o usuário ${userId}`);
      return false;
    }
    
    // Contar alertas por tipo
    const alertCounts = {
      motion: alerts.filter(a => a.type === 'MOTION').length,
      offline: alerts.filter(a => a.type === 'OFFLINE').length,
      manual: alerts.filter(a => a.type === 'MANUAL').length,
      total: alerts.length
    };
    
    // Formatar data do relatório
    const reportDate = format(
      new Date(),
      "dd 'de' MMMM 'de' yyyy",
      { locale: ptBR }
    );
    
    // Preparar variáveis para o template
    const templateVars = {
      userName: user.name,
      reportDate,
      totalAlerts: String(alertCounts.total),
      motionAlerts: String(alertCounts.motion),
      offlineAlerts: String(alertCounts.offline),
      manualAlerts: String(alertCounts.manual),
      systemUrl: process.env.FRONTEND_URL || 'https://vigilancia.com',
    };
    
    // Obter o template HTML
    const html = getEmailTemplate('daily-alert-report', templateVars);
    
    // Enviar email
    return await sendEmail(
      user.email,
      `Relatório Diário de Alertas - ${reportDate}`,
      html
    );
  } catch (error) {
    console.error(`Erro ao enviar relatório diário para o usuário ${userId}:`, error);
    return false;
  }
} 