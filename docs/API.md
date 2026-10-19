# Contratos de API

Todas as respostas usam `Cache-Control: no-store`. Valores monetários são strings com duas casas decimais. Erros usam `{error: CODIGO}` e falhas operacionais incluem `requestId`, sem detalhes SQL ou credenciais.

| Método | Rota | Acesso / resultado |
|---|---|---|
| GET | `/api/health` | Processo ativo; não atesta banco |
| GET | `/api/ready` | Confere versão do schema; 503 se não configurado |
| POST | `/api/auth/login` | JSON `{email,password}`; cookie HttpOnly e `{role,csrf}` |
| GET | `/api/admin/me` | Sessão válida; papel atual |
| POST | `/api/admin/logout` | Revoga sessão; CSRF obrigatório |
| GET | `/api/admin/dashboard` | Sessão válida, qualquer papel |
| POST | `/api/admin/imports?referenceDate=2026-10-19` | Admin; corpo binário XLSX, tipo oficial Excel; retorna `id`, conciliação, política, colunas, contagens e issues |
| GET | `/api/admin/imports/:id` | Admin; prévia/auditoria persistida |
| POST | `/api/admin/publications` | Admin; `{importId,expectedCurrentId,reviewedAudit:true}` |
| GET | `/api/admin/history` | Admin; `{currentId,versions}` com totais/contagens/data/hora |
| GET | `/api/admin/publications/:id/audit` | Admin; auditoria histórica completa |
| GET | `/api/public/dashboard` | Somente após autorização pública expressa e flag de servidor |
| GET | `/api/public/periods` | Mesma autorização; apenas IDs, referências e horários públicos |

Todos os POST exigem cabeçalho `Origin` igual ao `APP_ORIGIN` configurado. Após login, todas as mutações administrativas exigem `X-CSRF-Token` com o token retornado pelo login. Não armazenar senha nem sessão em localStorage. Após recarregar a página, o fluxo de escrita exige novo login para obter CSRF; o backend mantém validade/expiração da sessão no banco.

O upload pode informar o nome original em `X-File-Name`, codificado por `encodeURIComponent`; o servidor valida extensão/tamanho e remove diretórios, mantendo o SHA-256 independente do nome.

Upload aceita no máximo 4 MiB, com ZIP expandido limitado a 50 MiB e 1.000 entradas; não aceita macros nem external links. Exige as três abas reais, com seus cabeçalhos distintos, incluindo as duas colunas `Descricao` de A Vencer nas posições originais. Valores monetários calculados pelo navegador não são aceitos como importação. `reclassify=true&sameDay=overdue` pode explicitar a política, sendo esses os únicos valores permitidos.

`GET .../dashboard` exige `year` e `month`. Opcionais: `clients` como IDs separados por vírgula, `representatives` como array JSON codificado na URL, `version` como UUID de publicação. Os filtros se intersectam, antes de KPIs, rankings, participações e série mensal. `version` não permite usar uma posição de outro mês/ano.

Resposta contém `{version,publishedAt,referenceDate,partialPeriod,kpis,shares,clients,monthlyReceived,filters}`. `kpis` inclui `upcoming`, `overdue`, `received` (YTD), `global`, `clients`, `titles` (parcelas distintas) e `records`. `clients` é o ranking completo, sem truncamento financeiro; `monthlyReceived` apresenta cada mês do acumulado, inclusive zero quando não há pagamento na fonte para aquele mês. Não significa existência de fotografia histórica dos saldos. `filters` contém apenas clientes e representantes da versão selecionada.

Prévia inclui `rawTotals` (por aba de origem), `provisional` (faixas reclassificadas e YTD), `recordCounts.source`, `recordCounts.accounting`, `sourceRecords`, `parsedRecords`, `quarantinedRecords`, `sheets`, `issues` e `policy`. Cada issue contém `code`, `severity`, `sheet`, `row`, `message` e eventuais linhas relacionadas. Não há aprovação automática de advertências. `status=blocked` impede publicação; `review_required` exige revisão humana, não indica publicação.

Publicação usa HTTP 201. Conflito de concorrência ou fonte repetida: 409. Inconsistência impeditiva/revisão ausente: 422. Sessão ausente/expirada: 401. Permissão, origem, CSRF ou exposição pública negada: 403. Período indisponível: 404. Conteúdo inválido: 400/415/422. Banco/configuração indisponível: 503.

As respostas públicas são construídas no servidor exclusivamente com agregados, nomes de clientes/representantes autorizados, valores e IDs técnicos. Nunca retornam snapshot, títulos individuais, dados clínicos, auditoria, usuários ou hashes de senha. Com `PUBLIC_FINANCIAL_DATA_AUTHORIZED=false` (padrão), **todas** as rotas `/api/public/*` retornam 403, mesmo se houver base publicada.
