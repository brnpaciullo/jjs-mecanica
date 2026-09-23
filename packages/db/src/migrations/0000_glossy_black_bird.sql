CREATE TABLE `catalogo` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`descricao` text NOT NULL,
	`tipo` text NOT NULL,
	`valor_padrao_centavos` integer,
	`categoria` text,
	`ativo` integer DEFAULT true NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_catalogo_descricao` ON `catalogo` (`descricao`);--> statement-breakpoint
CREATE INDEX `idx_catalogo_categoria` ON `catalogo` (`categoria`);--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`telefone` text NOT NULL,
	`cpf` text,
	`endereco` text,
	`observacoes` text,
	`arquivado` integer DEFAULT false NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_clientes_nome` ON `clientes` (`nome`);--> statement-breakpoint
CREATE INDEX `idx_clientes_telefone` ON `clientes` (`telefone`);--> statement-breakpoint
CREATE TABLE `dispositivos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`token_hash` text NOT NULL,
	`usuario_id` integer,
	`ultimo_acesso` text,
	`revogado` integer DEFAULT false NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `itens_ordem` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ordem_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`descricao` text NOT NULL,
	`quantidade` real DEFAULT 1 NOT NULL,
	`valor_unitario_centavos` integer DEFAULT 0 NOT NULL,
	`observacao` text,
	`aprovado` integer DEFAULT true NOT NULL,
	`posicao` integer DEFAULT 0 NOT NULL,
	`criado_por` integer,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`ordem_id`) REFERENCES `ordens`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_itens_ordem` ON `itens_ordem` (`ordem_id`,`posicao`);--> statement-breakpoint
CREATE TABLE `mensagens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ordem_id` integer,
	`cliente_id` integer,
	`tipo` text NOT NULL,
	`conteudo` text NOT NULL,
	`anexos` text,
	`status` text NOT NULL,
	`erro` text,
	`enviado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`ordem_id`) REFERENCES `ordens`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mensagens_ordem` ON `mensagens` (`ordem_id`);--> statement-breakpoint
CREATE TABLE `midias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ordem_id` integer,
	`item_id` integer,
	`tipo` text NOT NULL,
	`arquivo_path` text NOT NULL,
	`thumb_path` text,
	`tamanho_bytes` integer,
	`duracao_s` real,
	`momento` text DEFAULT 'servico' NOT NULL,
	`incluir_para_cliente` integer DEFAULT false NOT NULL,
	`origem` text DEFAULT 'app' NOT NULL,
	`status_processamento` text DEFAULT 'pronto' NOT NULL,
	`legenda` text,
	`criado_por` integer,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`ordem_id`) REFERENCES `ordens`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `itens_ordem`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_midias_ordem` ON `midias` (`ordem_id`);--> statement-breakpoint
CREATE INDEX `idx_midias_status` ON `midias` (`status_processamento`);--> statement-breakpoint
CREATE TABLE `oficina_config` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`nome` text DEFAULT 'JJS Oficina Mecânica' NOT NULL,
	`cnpj` text,
	`endereco` text,
	`telefone` text,
	`logo_path` text,
	`texto_garantia` text,
	`validade_orcamento_dias` integer DEFAULT 7 NOT NULL,
	`mensagem_rodape_pdf` text,
	`impressora_padrao` text,
	`pasta_backup` text,
	`economizar_tinta` integer DEFAULT true NOT NULL,
	`template_msg_orcamento` text,
	`template_msg_pronto` text,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ordem_eventos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ordem_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`descricao` text NOT NULL,
	`status_de` text,
	`status_para` text,
	`usuario_id` integer,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`ordem_id`) REFERENCES `ordens`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_eventos_ordem` ON `ordem_eventos` (`ordem_id`,`criado_em`);--> statement-breakpoint
CREATE TABLE `ordens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`numero` integer NOT NULL,
	`cliente_id` integer NOT NULL,
	`veiculo_id` integer NOT NULL,
	`status` text DEFAULT 'recepcao' NOT NULL,
	`km_entrada` integer,
	`combustivel` text,
	`checklist_entrada` text,
	`queixas` text NOT NULL,
	`diagnostico` text,
	`desconto_centavos` integer DEFAULT 0 NOT NULL,
	`prazo_estimado` text,
	`validade_ate` text,
	`forma_pagamento` text,
	`pago` integer DEFAULT false NOT NULL,
	`observacoes_gerais` text,
	`recepcao_em` text,
	`diagnostico_em` text,
	`orcamento_enviado_em` text,
	`aprovado_em` text,
	`recusado_em` text,
	`em_servico_em` text,
	`pronto_em` text,
	`entregue_em` text,
	`criado_por` integer,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ordens_numero` ON `ordens` (`numero`);--> statement-breakpoint
CREATE INDEX `idx_ordens_status` ON `ordens` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ordens_veiculo` ON `ordens` (`veiculo_id`);--> statement-breakpoint
CREATE INDEX `idx_ordens_cliente` ON `ordens` (`cliente_id`);--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`papel` text DEFAULT 'balcao' NOT NULL,
	`pin_hash` text,
	`ativo` integer DEFAULT true NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `veiculos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`marca` text NOT NULL,
	`modelo` text NOT NULL,
	`ano` integer,
	`placa` text NOT NULL,
	`cor` text,
	`km_atual` integer,
	`observacoes` text,
	`arquivado` integer DEFAULT false NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_veiculos_placa` ON `veiculos` (`placa`);--> statement-breakpoint
CREATE INDEX `idx_veiculos_cliente` ON `veiculos` (`cliente_id`);