# Validação executada

Ambiente: Node 22+, TypeScript, Vitest, PostgreSQL embarcado PGlite. A suite executa os comandos SQL reais do baseline fornecido e da migration aditiva em bancos descartáveis. Não simula publicação com simples arrays em memória.

| Requisito | Evidência |
|---|---|
| Três abas reais / colunas distintas | `tests/official.test.ts` e `tests/financial.test.ts` |
| Moeda decimal / arredondamento / inválidos | `financial.test.ts` |
| Datas / dias / fórmulas com zero | `financial.test.ts`, `official.test.ts` |
| A Vencer / Vencido / reclassificação | `official.test.ts` com totais da planilha e casos de fronteira |
| Recebido YTD / reinício do ano | `official.test.ts` reconcilia os dez meses; `financial.test.ts` testa exclusões e fronteira anual |
| Limite Global / cliente / filtros | Ambas as suites financeiras, sem join multiplicador |
| Pagamentos parciais / sobreposição | Caso legítimo sintético + ocorrência real 87848/01 |
| Inconsistências / quarentena / duplicatas | `financial.test.ts`, relatório oficial por aba/linha |
| Histórico | `repository.test.ts`: versões distintas mantidas, mesma data sem soma duplicada |
| Publicação transacional | `repository.test.ts`: falha injetada depois de todos os inserts financeiros; rollback de publicação, registros e ponteiro |
| Segurança pública | `security.test.ts`: endpoints recusados sem autorização; payload autorizado sem campos clínicos/internos |
| Autenticação/autorização | HTTP real, sessões PostgreSQL, CSRF/origem, papel alterado, conta revogada, expiração, logout e limite persistente de login |
| Build de produção | `npm run build`: checagem TypeScript de frontend/backend/API + Vite `dist` |

Resultado da rodada completa: **37 testes aprovados, 4 arquivos de teste, 0 falhas e 0 ignorados**, incluindo os 7 testes que leem a planilha oficial. O arquivo oficial é ignorado pelo Git; fora desta máquina essa suíte é explicitamente ignorada se o arquivo privado não for fornecido. Não substituir essa ausência por aprovação.

Auditoria de dependências de produção: `npm audit --omit=dev`, **0 vulnerabilidades reportadas** na execução. O build emite aviso de chunk acima de 500 kB; não impede a compilação, e não foi mascarado. Divisão dos gráficos pode ser tratada como otimização posterior.

Inicialização local verificada: HTML e `/api/health` retornam 200; consulta financeira pública sem autorização retorna 403; prontidão sem Neon retorna 503. Tentativas de leitura via Vite de `.local/official.xlsx`, `docs/official-audit.json` e `server/db.ts` retornam 403. A instalação foi repetida com `npm ci` sem alterar o lockfile.

Também foi executado o auditor independente em Python/openpyxl/Decimal, confirmando os totais e 17 divergências dos dias cached.

## Limites da evidência

- Testes PostgreSQL foram executados em PGlite, **não no projeto Neon remoto**. Não atestam conectividade, permissões, extensões ou estado real do schema remoto.
- Não foram aplicadas migrations nem realizadas gravações remotas. O SQL inicial foi analisado a partir da definição fornecida pelo administrador.
- Não houve deploy Vercel, teste em Preview real ou teste de navegador Playwright do novo sistema. A interface foi compilada; os fluxos HTTP de importação/prévia/publicação e permissões foram exercitados em servidor Express real com PostgreSQL embarcado.
- A planilha original está bloqueada para publicação financeira por uma inconsistência pendente; passar nos testes confirma esse bloqueio, não a aprovação dos dados.
- Nenhuma autorização para exposição pública foi presumida. O padrão continua negado.
