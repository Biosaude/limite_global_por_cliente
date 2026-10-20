# BIOSAÚDE — Limite Global por Cliente

React/TypeScript/Vite com API Express para Vercel e Neon PostgreSQL. Implementação em branch `feat/limite-global-backend`, sem Supabase. A estrutura e os componentes visuais compatíveis foram preservados a partir do projeto de Retenção de Faturamento.

A posição analisada é **19/10/2026**. Em 20/10/2026 o responsável aprovou preservar as faixas das abas de origem e os dois registros do título 87848/01. A decisão é aplicada somente à fonte financeira conferida, mantendo a severidade original na auditoria. Outros erros continuam bloqueantes. Consulte [a entrega e as limitações atuais](docs/FINALIZATION.md). O responsável esclareceu a identificação da planilha e reenviou o arquivo corrigido, conferido com os mesmos 5.099 registros financeiros e totais. As 2.348 divergências no campo derivado de dias permanecem auditadas.

Esta branch não executa deploy automático; nenhuma alteração no Neon remoto, publicação financeira de produção ou merge foi realizada.

## Desenvolvimento

Node >=22 e npm:

```sh
cd /workspace/limite_global_por_cliente
npm ci --cache /tmp/lgc-npm-cache
npm run dev
```

API na porta 3001 e frontend na 5173, ambos locais. Variáveis devem ser injetadas no processo pelo ambiente; `.env.example` é documentação e **não é carregado automaticamente**. Não colocar valores secretos em argumentos, commits, código frontend ou variáveis `VITE_*`.

- `DATABASE_URL`: URL PostgreSQL do projeto Neon novo, com acesso ao schema da aplicação. Driver verifica o certificado TLS; apenas hosts `.neon.tech` são aceitos. Use conexão pooled recomendada pelo Neon para Vercel.
- `APP_ORIGIN`: origem exata da interface, sem barra final; em desenvolvimento `http://127.0.0.1:5173`. Configurar separadamente em Preview e Production.
- `PUBLIC_FINANCIAL_DATA_AUTHORIZED`: manter `false` até autorização expressa da Biosaúde para nomes associados a valores financeiros.

Sem Neon/configuração, a interface abre sem dados, a leitura pública é negada e `/api/ready` responde 503. Não há dados fictícios no dashboard nem autenticação de desenvolvimento sem senha.

## Banco existente e preparação de implantação

1. A definição inicial fornecida está em `db/001_existing_baseline.sql`. **Já foi aplicada pelo administrador; não reaplicar no Neon.**
2. Configure `DATABASE_URL` exclusivamente no servidor. Execute `npm run db:inspect` para confrontar o schema real com o fornecido. Ainda não foi possível fazer essa inspeção nesta máquina, por ausência de conexão.
3. Após essa conferência, revise/aplique uma única vez `db/migrations/002_lgc_proposal.sql`. Ela preserva tabelas e registros existentes, adiciona colunas opcionais e estruturas auxiliares. Sua execução foi validada em PostgreSQL embarcado, não no Neon remoto. Não há execução automática no build ou na inicialização.
4. Use papel de banco exclusivo desta aplicação. O proprietário aplica migrations; o papel de runtime recebe apenas SELECT/INSERT nas tabelas financeiras e metadados, UPDATE no ponteiro/login attempts, SELECT/INSERT/DELETE em sessões, e USAGE nas sequences necessárias. Não conceder acesso ao banco antigo. Sem privilégios de runtime definidos, a aplicação não está pronta para produção.
5. Para criar o primeiro admin, injete `ADMIN_EMAIL` e `ADMIN_PASSWORD` de modo seguro e execute `npm run admin:create`. A senha exige 14–256 caracteres, é armazenada com scrypt e não é registrada. Remova a variável de bootstrap após usar. Não existe credencial padrão.
6. Entre pela interface administrativa, selecione a data de referência, importe XLSX, revise a prévia e corrija impedimentos na origem. Confirmar publicação é uma operação transacional; não exige SQL nem GitHub para atualizações posteriores.
7. Configure o projeto Vercel existente com build `npm run build`, saída `dist` e as variáveis de servidor acima. `vercel.json` contém a função/rewrite e cabeçalhos. Upload binário limitado a 4 MiB, abaixo do limite da função. Testar Preview com banco/dados isolados antes de solicitar autorização de produção.

Nenhuma política pública é ativada automaticamente. Convites, recuperação de senha, MFA e manutenção operacional das contas devem ser definidos pelo administrador antes de disponibilizar o acesso administrativo na Internet conforme sua política interna; esta base implementa login com senha, papéis e revogação, sem provedor externo.

## Verificação e conciliação

```sh
npm test
npm run build
npm run audit:official -- .local/official.xlsx 2026-10-19  .local/final-audit.private.json
python scripts/independent-audit.py .local/official.xlsx
```

A planilha original está em `.local/official.xlsx` nesta máquina, ignorada pelo Git e com permissão 0600. Não é incorporada ao build, repositório ou API pública. O servidor Vite também bloqueia acesso a `.local`, documentos, backend e arquivos Excel/ZIP pelo navegador. Fora desta máquina, forneça a planilha oficial por caminho privado ou `OFFICIAL_XLSX`. Os testes oficiais verificam o hash exato do anexo; se o arquivo estiver ausente, essa suíte fica explicitamente **skipped**, enquanto os demais testes continuam. Bases novas não devem ser comparadas aos valores fixos desta versão.

O auditor independente requer `openpyxl==3.1.5`, declarado em `scripts/requirements-audit.txt`. Usa Decimal e os valores cached do Excel; o relatório detalhado com identificadores permanece em `.local/independent-audit.private.json`. O relatório versionado `docs/official-audit.json` não contém pacientes, médicos ou nomes de clientes.

Consulte [auditoria financeira](docs/FINANCIAL-AUDIT.md), [arquitetura e modelo](docs/ARCHITECTURE.md), [contratos de API](docs/API.md) e [validação](docs/VALIDATION.md).

## Pendências concretas

- Conferência da planilha corrigida concluída; o arquivo privado está em `.local/official-corrected.xlsx`. Para repetir os testes com ele, use `OFFICIAL_XLSX=.local/official-corrected.xlsx npm test`. Ambos os anexos têm identidades exatas verificadas nos testes; fontes diferentes exigem nova auditoria.
- Validar o fluxo em ambiente Vercel/Neon autorizado antes da implantação. A disponibilidade remota foi informada pelo administrador, não retestada por esta alteração.
- Após atualização autorizada, reimportar o arquivo conferido: importações antigas e seu histórico permanecem intactos. Rever advertências e confirmar a publicação pela interface somente com autorização.
- Eventual acesso público exige autorização separada. `PUBLIC_FINANCIAL_DATA_AUTHORIZED` continua `false`.
- O remoto possui somente `feat/limite-global-backend`, sua branch padrão, no commit inicial `892d025`. A revisão desta alteração usa essa base existente; criar `main` exige resolver a estratégia de histórico separadamente.
