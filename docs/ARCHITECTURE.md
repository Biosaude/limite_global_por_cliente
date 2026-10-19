# Arquitetura e diagnóstico da referência

Foram inventariados os 87 arquivos do ZIP original, com hashes, imports e símbolos exportados em `reference-inventory.json`. O ZIP e sua cópia extraída permanecem fora do novo checkout. Não houve acesso ao Supabase original nem modificação do projeto de referência.

## Referência encontrada

- React 19 / TypeScript / Vite; aplicação executiva em `src/App.tsx`, Recharts, Lucide, CSS responsivo, multisseleção e ranking.
- API Express 5 em `server/app.ts`; função Vercel em `api/handler.ts`; rewrite `/api/*` e distribuição estática `dist`.
- Importação ExcelJS/CSV, baseada em **uma aba de 14 colunas**. Incompatível com as três estruturas financeiras novas.
- `src/lib/domain.ts`: regras de cirurgias, retenção e faixas de envelhecimento. Não representa títulos em aberto ou recebimentos; não foi reutilizado como motor financeiro.
- `server/store.ts`: Supabase em produção, armazenamento local criptografado; publicação com versões financeiras e versões de auditoria. Migrations Supabase próprias do sistema anterior.
- Autenticação Supabase e permissões `admin`, `analyst`, `viewer`; atalho administrativo local em desenvolvimento. Ambos foram substituídos; o novo sistema não possui login sem senha nem SDK Supabase.
- Componentes `AdminAccess`, `BaseManagement`, `AuditPanel` dependem dos contratos de retenção. Suas responsabilidades foram adaptadas aos novos contratos, sem copiar os cálculos antigos.
- Suíte Vitest de domínio/API/auditoria/versões/permissões e Playwright de interface. Nenhuma aprovação de teste antigo é atribuída ao novo sistema.

## Reutilização efetiva

`src/styles.css` e `src/components/MultiSelect.tsx` foram copiados da referência. A interface conserva identidade Biosaúde, cards executivos, filtros, gráficos, ranking e painel administrativo. O `App.tsx` foi adaptado ao modelo de três faixas; o fluxo administrativo agora envia Excel ao servidor e distingue prévia de publicação. A arquitetura React/Vite → Express → função Vercel foi preservada.

## Novo backend

- `server/import.ts`: limite de upload e expansão ZIP, validação estrita por aba/posição, leitura de fórmulas de dias pelo cache sem executar `TODAY()`, perfis de todas as colunas, valores decimais, quarentena e auditoria por aba/linha. Campos clínicos nunca entram no snapshot persistido.
- `server/financial.ts`: datas civis UTC, Decimal, agrupamento por cliente, filtros combinados, YTD e KPIs. Valores monetários trafegam como strings decimais; `Number` é usado apenas na apresentação dos gráficos.
- `server/repository.ts`: snapshots de importação, histórico, persistência nas tabelas fornecidas, clientes/títulos normalizados, publicação transacional, trava do ponteiro e controle de concorrência por versão esperada.
- `server/db.ts`: pool PostgreSQL `pg`, conexão Neon exclusivamente no servidor, TLS com validação de certificado. Sem acesso Supabase ou credenciais no frontend.
- `server/auth.ts`: senha scrypt com salt aleatório, sessões aleatórias persistidas por hash, expiração de oito horas, CSRF, revogação via sessão/conta e consulta do papel a cada requisição. Limite de tentativas de login persistido no banco; limite HTTP adicional por instância.
- `server/app.ts`: autenticação/autorização, validação Zod, origem exata para operações de escrita, cookie HttpOnly/SameSite/Secure em Vercel, respostas públicas restritas e logs sem corpo de requisição ou mensagens do driver.

A conta `admin` importa, revisa, publica e consulta auditoria/histórico; `analyst` e `viewer` consultam o dashboard administrativo. Não existe cadastro público. O bootstrap administrativo é feito uma vez por operador, fora da interface pública, com `npm run admin:create`. Recuperação de senha/convites não foi implementada; a gestão operacional das contas permanece restrita ao operador do banco.

## Dados e temporalidade

Cliente é agrupado por nome normalizado (trim, espaços consecutivos, caixa alta), com SHA-256 como chave técnica, sem remoção de acentos. A planilha não contém CNPJ nem código fiscal: homônimos/variações precisam de cadastro mestre antes de garantir identidade jurídica. Título é a tupla cliente + duplicata + parcela; o número completo é conferido.

Saldos são fotografias por publicação. Para um mês, a API seleciona a posição mais recente publicada **dentro daquele mês**, respeitando a data de referência e marcando períodos parciais. Uma versão explícita seleciona exatamente aquela fotografia. Nenhum saldo de setembro é derivado de outubro. Sem fotografia, HTTP 404 `NO_HISTORICAL_POSITION`. Recebimentos usam `Dt.recebimento`, de 1º de janeiro à referência, reiniciando no novo ano. Importações nunca concatenam recebimentos de versões diferentes.

Em cada importação, a origem de uma linha (`sourceBand`/`source_sheet`) é preservada independentemente da classificação contábil (`band`/`accounting_band`). A política aprovada é vencimento <= referência em Vencido e vencimento > referência em A Vencer. Cada reclassificação deixa ocorrência de auditoria. Parâmetros contrários a essa política são rejeitados pela API.

Títulos parcialmente pagos podem contribuir com **saldo remanescente + pagamento**, sem juntar tabelas de forma multiplicadora. Duplicatas de saldos e pagamentos idênticos sem identidade distinta bloqueiam publicação. Saldo + recebimentos acima do nominal requer conciliação, sem subtração ou exclusão automática.

## Persistência e transação

O SQL inicial fornecido pelo administrador está documentado em `db/001_existing_baseline.sql`, apenas como baseline de referência/teste; não deve ser reaplicado em Neon. `db/migrations/002_lgc_proposal.sql` é uma extensão aditiva, revisada contra essa definição, ainda não aplicada no banco remoto.

As tabelas públicas existentes continuam sendo o registro financeiro: `lg_publications`, `lg_financial_records`, `lg_audit_issues`. São acrescentadas três colunas opcionais ao registro financeiro: `accounting_band`, `client_key`, `title_key`, sem atualizar ou remover linhas existentes. Colunas clínicas existentes permanecem NULL nas novas gravações.

O schema complementar `lgc` guarda `admin_users`, `sessions`, `login_attempts`, `imports`, `clients`, `titles`, `audit_issues` de prévia, metadados `publications`, `current_publication`, `operations` e `schema_version`. A API não oferece exclusão nem alteração de versões publicadas.

Prévia grava apenas importação/auditoria. Publicar trava o ponteiro corrente, verifica a versão esperada, bloqueios e revisão expressa; grava clientes/títulos, publicação base, registros, auditoria publicada, metadados e novo ponteiro na mesma transação. Qualquer falha reverte tudo. Repetição da mesma fonte/data não cria outra publicação. É permitido publicar fotografias antigas reais; a consulta por período não depende do ponteiro da última operação.

A aplicação lê snapshots integrais da versão para garantir um único motor para todos os KPIs/filtros; as tabelas financeiras são mantidas para rastreabilidade e consulta SQL. O limite de 25.000 linhas por aba e upload de 4 MiB é deliberado. Para volumes maiores, implementar armazenamento privado de objetos e processamento assíncrono antes de elevar limites.

Histórico anterior que eventualmente já exista só nas tabelas públicas não é convertido automaticamente em snapshot. A inspeção real deve verificar esse caso; importação de legado exige migração específica, preservando a origem e sem inventar dados ausentes.
