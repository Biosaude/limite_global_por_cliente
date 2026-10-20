# Finalização em revisão — 20/10/2026

Branch de trabalho: `feat/finalizacao-dashboard`. Esta entrega prepara código para revisão; não autoriza implantação, merge ou publicação financeira de produção.

## Decisões e fonte disponível

O responsável aprovou preservar os dois registros do título 87848/01 e, posteriormente, confirmou que as faixas das abas de origem devem prevalecer. Essa decisão substitui a reclassificação anterior por vencimento. Recebido permanece YTD, pela data efetiva, de janeiro até 19/10/2026. Não se reconstruem saldos de meses sem posição publicada.

O responsável esclareceu que o nome com sufixo `(2)` se referia à mesma base e reenviou a planilha corrigida em 20/10/2026. O arquivo corrigido `Faturamento A Vencer, Vencido e Faturado.xlsx` tem SHA-256 `95c06103c0102d71d1aae3f40cad83ba721de7ac0f32f435d077ec934be554d1`. A linha 461 de A Vencer foi conferida: nominal e saldo de R$ 4.300,00, conforme esclarecimento do responsável.

A comparação de todos os 5.099 registros com o anexo original (SHA-256 `4632fc2006fe6e0dd9c5ea33e7f0abb77f1737da88900233e3c5f4b76d00107b`) confirmou igualdade de clientes, títulos, parcelas, representantes, faixas de origem, datas e valores. Apenas o campo derivado de dias difere em 2.348 registros. A assinatura financeira continua `f7c0802b7eb674b92c1bec37893984f7108b49f16a27c28ab84a228291a61480`, já abrangida pela regra restrita existente. Não foi alterado o código de cálculo, de validação ou de aprovação para aceitar o arquivo corrigido.

A versão intermediária reenviada com nominal de R$ 4.301,00 não correspondia à aprovação e continuou bloqueada. Ela não foi publicada nem usada para substituir a fonte validada. A pendência de recebimento/conferência da planilha foi resolvida pelo novo envio corrigido.

## Conciliação executada no anexo disponível

| Faixa / aba | Registros | Valor (R$) |
|---|---:|---:|
| A Vencer — CONSOLIDADO - A VENCER (VA529) | 1.583 | 25.711.247,24 |
| Vencido — CONSOLIDADO - VENCIDO (VA527) | 765 | 10.575.015,21 |
| Recebido YTD — CONSOLIDADO - RECEBIDO (VA527) | 2.751 | 56.999.819,30 |
| Limite Global | 5.099 | 93.286.081,75 |

Os valores são calculados nas células financeiras e somados com precisão decimal. Os testes também confrontam todas as linhas, títulos, faixas e valores diretamente com as células. Nenhum total é usado para preencher resultados do serviço. As colunas de saldo são as posições 14 nas bases abertas e a posição 15 contém o recebido. Cabeçalhos distintos continuam validados pelo importador.

Auditoria atual: 25 `BAND_DATE_CONFLICT`, 2.348 `DAYS_MISMATCH`, uma `OPEN_AND_RECEIVED`, uma `POSSIBLE_DOUBLE_COUNT` e uma `CLIENT_NAME_ONLY`. Nenhuma linha é excluída. A divergência de datas continua localizável por aba/linha. Há zero bloqueios no anexo conferido sob as duas decisões expressas; advertências exigem revisão do administrador antes da confirmação.

## Exceção restrita e histórico

`server/reviewed-exceptions.ts` verifica uma assinatura de todos os 5.099 registros financeiros, a data de referência e, separadamente, os dois registros do título 87848/01. A decisão não depende do nome do arquivo. Renomear um arquivo não comprova correspondência; mudar qualquer cliente, título, representante, data ou valor modelado invalida a assinatura. O campo derivado de dias e a classificação contábil não participam da assinatura; a faixa original participa.

Somente a ocorrência correspondente à linha 461 de A Vencer e à linha 1291 de Recebido passa de `blocking` a `warning`. Os dois valores de R$ 4.300,00 permanecem intactos. Cada decisão inclui severidade original, identificador, data, autoridade, motivo, SHA da fonte revisada e aplicada e assinatura financeira. A decisão sobre as 25 divergências de faixa/data também é restrita à mesma fonte conferida. Outras fontes e erros não recebem aprovação automática.

Snapshots e auditorias anteriores permanecem intactos. A decisão entra em novas importações; não modifica retroativamente importações já armazenadas. O histórico de publicação preserva a política e as revisões em JSONB, além das issues individuais.

## Dashboard e segurança

O painel consulta exclusivamente publicações normais. Foram reaproveitados da alteração anterior os controles de importação, proteção contra respostas atrasadas e a tabela de ranking. Não existe rota de dashboard para importação não publicada.

Estão disponíveis quatro KPIs monetários, contagens de clientes/títulos, composição percentual, recebimentos por mês que compõem o YTD, rankings de clientes e representantes e detalhes paginados. Ano/mês, cliente, representante e versão usam o mesmo recorte no serviço. O detalhamento é fixado à versão retornada pelo dashboard e mostra valores/datas em BRL e formato brasileiro.

`GET /api/admin/records` exige sessão e papel admin, limita página a 100 registros e retorna uma lista explícita de campos financeiros sem pacientes, médicos ou registros brutos. Visitantes e papéis não administrativos não recebem detalhes. Login, Origin, CSRF e publicação transacional foram preservados. `PUBLIC_FINANCIAL_DATA_AUTHORIZED` não foi alterado; o público segue bloqueado por padrão.

## Banco e implantação

Não há alteração de schema ou migration nova. As novas informações de revisão utilizam JSONB já existente em `lgc.imports`, `lgc.audit_issues`, `lgc.publications.validation` e `public.lg_audit_issues.details`. O backend continua dependente do baseline 001 mais a migration aditiva 002; as três tabelas originais isoladamente não atendem à aplicação. O estado remoto Ready foi informado pelo administrador, não revalidado nesta entrega.

As transações e consultas foram executadas em PGlite, PostgreSQL embarcado. Isso não valida TLS/conexão Neon, permissões do usuário de runtime, concorrência real entre conexões nem os limites operacionais da função Vercel. Build usa a configuração Vercel existente, sem nova dependência. `vercel.json` desabilita deploy Git desta branch e o commit inclui `[skip vercel] [skip ci]`.

## Validação reproduzível

```sh
OFFICIAL_XLSX=.local/official-corrected.xlsx npm test
npm run build
OFFICIAL_XLSX=.local/official-corrected.xlsx npx --no-install tsx tests/final-dashboard-browser.ts
npm run audit:official -- .local/official-corrected.xlsx 2026-10-19 .local/final-audit.private.json
```

O teste Chromium usa `/usr/bin/chromium` já disponível e banco local isolado; não lê `DATABASE_URL`. A planilha e capturas permanecem privadas/ignoradas. Nenhum programa ou dependência adicional foi instalado nesta entrega.

Resultado na planilha corrigida: 53 testes automatizados aprovados, nenhum ignorado nesta máquina; build TypeScript/Vite aprovado; Chromium aprovado em 1280 e 390 px. A suíte inclui importação HTTP autenticada da fonte disponível, conferência dos 5.099 registros, exceção revisada, bloqueios futuros/erros adicionais, publicação transacional local, histórico, YTD, filtros combinados, autorização e negação de acesso público. A interface foi exercitada com login, revisão, confirmação local, quatro KPIs, dois gráficos, rankings, detalhamento, filtros e logout. O build emite advertência de bundle JavaScript maior que 500 kB; não impede compilação.

## Próximos passos após aprovação

1. Conferência do arquivo corrigido concluída: 5.099 registros, os quatro totais preservados, zero erros bloqueantes e advertências mantidas. Nenhuma publicação de produção foi realizada.
2. Revisar a PR e autorizar separadamente implantação e operação em produção. Não houve acesso de escrita ao Neon remoto, deploy ou merge.
3. Após implantação autorizada, entrar com o administrador existente e reimportar a fonte conferida, preservando importações antigas. Rever as advertências e a data; confirmar a publicação pela interface somente quando autorizada. O dashboard passa a consultar a versão publicada normalmente.
4. Para uma planilha corrigida posteriormente, usar o mesmo fluxo normal; não há modo provisório para desligar. Qualquer nova inconsistência bloqueante exige correção/revisão antes da publicação. A liberação pública depende de autorização específica independente.

O remoto ainda possui apenas a branch padrão `feat/limite-global-backend`, no commit `892d02537eb8ea97a5a25e6c3d0fae9349e7b50a`. A PR desta entrega usa essa base existente para revisão incremental. Criar `main` e reorganizar o fluxo de branches fica fora desta alteração; nenhum histórico é reescrito.
