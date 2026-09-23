import { z } from 'zod';
import { ehPlacaValida, normalizarPlaca } from '../formato/placa.js';
import { normalizarTelefone } from '../formato/telefone.js';
import {
  categoriaSchema,
  combustivelSchema,
  momentoMidiaSchema,
  papelSchema,
  statusOrdemSchema,
  tipoItemSchema,
} from './status.js';

/** Campo de texto obrigatorio, ja sem espaco sobrando nas pontas. */
const textoObrigatorio = (rotulo: string) => z.string().trim().min(1, `Preencha ${rotulo}.`);

const textoOpcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

export const placaSchema = z
  .string()
  .transform(normalizarPlaca)
  .refine(ehPlacaValida, 'Placa inválida. Use ABC-1234 ou ABC1D23.');

export const telefoneSchema = z
  .string()
  .transform((v) => normalizarTelefone(v))
  .refine((v): v is string => v !== null, 'Telefone inválido. Confira o DDD e o número.');

export const centavosSchema = z
  .number()
  .int('O valor precisa ser em centavos, sem casas decimais.')
  .min(0, 'O valor não pode ser negativo.');

export const clienteSchema = z.object({
  nome: textoObrigatorio('o nome do cliente'),
  telefone: telefoneSchema,
  cpf: textoOpcional,
  endereco: textoOpcional,
  observacoes: textoOpcional,
});
export type NovoCliente = z.input<typeof clienteSchema>;
export type Cliente = z.output<typeof clienteSchema> & { id: number; arquivado: boolean };

export const veiculoSchema = z.object({
  clienteId: z.number().int().positive(),
  marca: textoObrigatorio('a marca'),
  modelo: textoObrigatorio('o modelo'),
  placa: placaSchema,
  ano: z.number().int().min(1900).max(2100).nullable().optional(),
  cor: textoOpcional,
  kmAtual: z.number().int().min(0).nullable().optional(),
  observacoes: textoOpcional,
});
export type NovoVeiculo = z.input<typeof veiculoSchema>;
export type Veiculo = z.output<typeof veiculoSchema> & { id: number; arquivado: boolean };

export const checklistEntradaSchema = z.object({
  avarias: z.array(z.string()).default([]),
  objetos: z.array(z.string()).default([]),
  observacoes: z.string().default(''),
});
export type ChecklistEntrada = z.infer<typeof checklistEntradaSchema>;

export const ordemSchema = z.object({
  clienteId: z.number().int().positive(),
  veiculoId: z.number().int().positive(),
  status: statusOrdemSchema.default('recepcao'),
  kmEntrada: z.number().int().min(0).nullable().optional(),
  combustivel: combustivelSchema.nullable().optional(),
  checklistEntrada: checklistEntradaSchema.nullable().optional(),
  queixas: textoObrigatorio('o que o cliente relatou'),
  diagnostico: textoOpcional,
  descontoCentavos: centavosSchema.default(0),
  prazoEstimado: textoOpcional,
  observacoesGerais: textoOpcional,
});
export type NovaOrdem = z.input<typeof ordemSchema>;

export const itemOrdemSchema = z.object({
  tipo: tipoItemSchema,
  descricao: textoObrigatorio('a descrição do item'),
  quantidade: z.number().positive('A quantidade precisa ser maior que zero.').default(1),
  valorUnitarioCentavos: centavosSchema,
  observacao: textoOpcional,
  aprovado: z.boolean().default(true),
});
export type NovoItemOrdem = z.input<typeof itemOrdemSchema>;
export type ItemOrdem = z.output<typeof itemOrdemSchema> & {
  id: number;
  ordemId: number;
  posicao: number;
};

export const catalogoSchema = z.object({
  descricao: textoObrigatorio('a descrição'),
  tipo: tipoItemSchema,
  valorPadraoCentavos: centavosSchema.nullable().optional(),
  categoria: categoriaSchema.nullable().optional(),
});
export type NovoCatalogo = z.input<typeof catalogoSchema>;

export const usuarioSchema = z.object({
  nome: textoObrigatorio('o nome'),
  papel: papelSchema,
  pin: z
    .string()
    .regex(/^\d{4,6}$/, 'O PIN precisa ter de 4 a 6 números.')
    .nullable()
    .optional(),
});
export type NovoUsuario = z.input<typeof usuarioSchema>;

export const midiaSchema = z.object({
  ordemId: z.number().int().positive().nullable().optional(),
  itemId: z.number().int().positive().nullable().optional(),
  tipo: z.enum(['foto', 'video']),
  momento: momentoMidiaSchema.default('servico'),
  incluirParaCliente: z.boolean().default(false),
  legenda: textoOpcional,
});
export type NovaMidia = z.input<typeof midiaSchema>;
