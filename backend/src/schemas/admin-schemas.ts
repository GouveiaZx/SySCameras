import { z } from 'zod';

/**
 * Esquema para validação de parâmetros de consulta para estatísticas
 */
export const statsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional().default('week')
});

/**
 * Esquema para validação de parâmetros de consulta para atividades
 */
export const activitiesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional().default(10)
});

/**
 * Esquema para validação de parâmetros de consulta para listagem de integradores
 */
export const integratorsQuerySchema = z.object({
  search: z.string().optional().default(''),
  status: z.enum(['all', 'active', 'inactive']).optional().default('all'),
  sortBy: z.enum(['name', 'email', 'createdAt', 'active']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10)
});

/**
 * Esquema para validação de parâmetros de rota para um integrador específico
 */
export const integratorParamsSchema = z.object({
  id: z.string().uuid()
});

/**
 * Esquema para validação de corpo da requisição para criação de integrador
 */
export const createIntegratorSchema = z.object({
  name: z.string().min(3, { message: 'Nome deve ter pelo menos 3 caracteres' }),
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'Senha deve ter pelo menos 6 caracteres' })
});

/**
 * Esquema para validação de corpo da requisição para atualização de integrador
 */
export const updateIntegratorSchema = z.object({
  name: z.string().min(3, { message: 'Nome deve ter pelo menos 3 caracteres' }).optional(),
  email: z.string().email({ message: 'Email inválido' }).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6, { message: 'Senha deve ter pelo menos 6 caracteres' }).optional()
}); 