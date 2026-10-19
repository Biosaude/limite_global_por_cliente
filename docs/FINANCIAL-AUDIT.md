# Auditoria da planilha oficial

Arquivo: `Faturamento A Vencer, Vencido e Faturado.xlsx`.
SHA-256: `4632fc2006fe6e0dd9c5ea33e7f0abb77f1737da88900233e3c5f4b76d00107b`.
Posição confirmada pelo administrador: **19/10/2026**. Todas as 5.099 linhas de dados e 3 abas foram examinadas, sem amostragem. Cabeçalhos estão na linha 1; a origem das linhas é preservada com numeração Excel, a partir de 2.

O arquivo chama-se “Faturado”, mas a terceira aba é realmente **RECEBIDO**, com `Vr.recebido` e `Dt.recebimento`. O indicador usa recebimentos, sem substituir por valor nominal, emissão, crédito ou faturamento inferido.

## Conciliação por origem

| Faixa/aba de origem | Registros | Soma oficial da coluna (R$) | Divergências |
|---|---:|---:|---|
| A Vencer — `CONSOLIDADO - A VENCER (VA529)` | 1.583 | 25.711.247,24 | 25 linhas exigem reclassificação; 17 diferenças nos dias informados; uma sobreposição com Recebido |
| Vencido — `CONSOLIDADO - VENCIDO (VA529)` | 765 | 10.575.015,21 | Datas/dias coerentes com 19/10/2026 |
| Recebido — `CONSOLIDADO - RECEBIDO (VA527)` | 2.751 | 56.999.819,30 | Uma sobreposição com saldo em aberto |
| Soma global bruta | 5.099 | **93.286.081,75** | **Prévia bloqueada para publicação**, não é total financeiro aprovado |

A soma acima reproduz exatamente o arquivo. Não desconta automaticamente R$ 4.300,00 nem aprova a sobreposição. O valor final aprovado depende da conciliação do financeiro.

## Posição após a reclassificação autorizada

O administrador autorizou reclassificação auditada por vencimento e confirmou expressamente que **vencimento no próprio dia entra em Vencido**. São 25 linhas, R$ 432.077,26, transferidas da faixa contábil A Vencer para Vencido. Não são transferidas de aba nem removidas da origem.

| Faixa contábil | Registros | Valor (R$) | Estado |
|---|---:|---:|---|
| A Vencer | 1.558 | 25.279.169,98 | Após reclassificação; sobreposição ainda em análise |
| Vencido | 790 | 11.007.092,47 | Após reclassificação |
| Recebido YTD | 2.751 | 56.999.819,30 | 01/01/2026 até 19/10/2026 por recebimento |
| Limite Global preliminar | 5.099 linhas / 5.098 títulos-parcelas distintos | **93.286.081,75** | Publicação bloqueada |

Há **169 nomes de clientes normalizados** no conjunto completo. Não há CNPJ/código de cliente para confirmar identidade fiscal.

Detalhe das 25 linhas por vencimento:

| Vencimento | Linhas | Saldo (R$) |
|---|---:|---:|
| 16/10/2026 | 1 | 4.500,00 |
| 17/10/2026 | 2 | 9.800,00 |
| 18/10/2026 | 2 | 13.010,00 |
| 19/10/2026 | 20 | 404.767,26 |
| Total | 25 | 432.077,26 |

## Mapeamento integral dos cabeçalhos

| Posição | A Vencer (18 colunas) | Vencido (17 colunas) | Recebido (18 colunas) |
|---:|---|---|---|
| 1 | Nome cliente | Nome cliente | Nome cliente |
| 2 | Duplicata | Duplicata | Duplicata |
| 3 | Parcela | Parcela | Parcela |
| 4 | Dt.emissao | Dt.emissao | Dt.emissao |
| 5 | Dt.vencimento | Dt.vencimento | Dt.vencimento |
| 6 | Dias para vencer | Qtd. De dias vencidos | Dt.recebimento |
| 7 | Dt.cirurgia | Dt.cirurgia | Dt.cirurgia |
| 8 | Paciente | Paciente | Paciente |
| 9 | Nome hospital | Nome hospital | Nome hospital |
| 10 | Descricao do plano de saude | Descricao do plano de saude | Descricao do plano de saude |
| 11 | Nome do medico | Nome do medico | Nome do medico |
| 12 | Vr.duplicata | Vr.duplicata | Dt.credito |
| 13 | Vr.desconto | Vr.desconto | Vr.duplicata |
| 14 | **Vr.aberto** | **Vr.aberto** | Vr.desconto |
| 15 | Descricao | Descricao | **Vr.recebido** |
| 16 | Descricao | Nome representante | Descricao |
| 17 | Nome representante | Numero do titulo completo | Nome representante |
| 18 | Numero do titulo completo | — | Numero do titulo completo |

As duas colunas `Descricao` de A Vencer não são confundidas: são posições distintas. O parser valida cada estrutura separadamente. Cliente e representante são texto; duplicata e parcela são inteiros na origem, mantidos como identificadores textuais no modelo. Valores são numéricos inteiros/decimais no Excel e convertidos com precisão Decimal, em duas casas, arredondamento half-up. Datas são células Excel de data. A coluna 6 de ambas as bases de saldo contém fórmulas, inclusive compartilhadas; a auditoria usa os resultados armazenados, sem recalcular contra a data da máquina. O cache zero é preservado.

Perfis completos de todas as colunas, tipos, células vazias e limites de datas constam em `official-audit.json`. Identificadores e campos financeiros necessários não apresentam nulos/invalidade. `Dt.cirurgia` possui 5, 16 e 96 células textuais nas três abas, respectivamente; não é usada neste modelo. Paciente, médico, cirurgia, hospital e plano não são persistidos nem expostos pelo novo backend. O exame de tipos não reproduz seus conteúdos na documentação.

| Datas | A Vencer | Vencido | Recebido |
|---|---|---|---|
| Emissão | 24/02/2026–19/10/2026 | 23/06/2023–09/10/2026 | 14/09/2023–19/10/2026 |
| Vencimento | 16/10/2026–18/03/2027 | 02/01/2024–15/10/2026 | 03/03/2024–28/12/2026 |
| Recebimento | — | — | 02/01/2026–19/10/2026 |
| Crédito | — | — | 02/01/2026–19/10/2026 |

Não foram encontradas diferenças entre recebimento e crédito, recebimentos anteriores à emissão, valores financeiros zero/negativos ou duplicação da mesma chave cliente/título/parcela dentro de cada aba. A ausência de duplicatas internas não elimina a sobreposição entre abas.

## Recebido: conciliação mensal e YTD

| Mês de recebimento | Valor do mês (R$) |
|---|---:|
| Janeiro | 3.388.841,33 |
| Fevereiro | 6.753.718,01 |
| Março | 5.248.942,33 |
| Abril | 5.054.086,89 |
| Maio | 9.574.190,13 |
| Junho | 6.050.973,65 |
| Julho | 6.274.563,50 |
| Agosto | 5.961.707,47 |
| Setembro | 4.806.580,88 |
| Outubro até dia 19 | 3.886.215,11 |
| **Acumulado YTD até 19/10** | **56.999.819,30** |

A disponibilidade dos pagamentos mensais não autoriza reconstrução de saldos históricos. Sem publicação real de março, por exemplo, não é mostrado Limite Global de março a partir desta fotografia de outubro.

## Inconsistências e decisão pendente

- **25 reclassificações informativas**, rastreadas por aba/linha no JSON versionado.
- **17 advertências `DAYS_MISMATCH`** na base A Vencer. O cálculo por datas usa a referência confirmada, não o campo de dias divergente. A auditoria independente encontra referências implícitas diferentes para essas 17 linhas. A base Vencido e as outras 1.566 linhas de A Vencer são compatíveis com 19/10/2026.
- **Uma sobreposição `OPEN_AND_RECEIVED`**: título **87848/01**, A Vencer linha **461**, R$ **4.300,00**, e Recebido linha **1291**, R$ **4.300,00**; o nominal informado é R$ **4.300,00** em ambas. A soma de saldo e pagamento é superior ao nominal, gerando **um bloqueio `POSSIBLE_DOUBLE_COUNT`**. Não se concluiu automaticamente que houve erro ou pagamento parcial. O administrador informou que consultará o financeiro; ambas as linhas permanecem preservadas e a publicação bloqueada.
- **Uma advertência global `CLIENT_NAME_ONLY`**, pela ausência de identificação fiscal.

Estado final da auditoria: **45 ocorrências (25 informativas, 19 advertências e 1 impeditiva)**. Nenhuma linha em quarentena por campo obrigatório inválido; nenhuma exclusão automática. A reclassificação não resolve a sobreposição.

## Reprodutibilidade

Vitest lê a planilha real de caminho privado, verifica hash, número de linhas, colunas, totais por faixa, cada mês de recebimento, consolidação por cliente, linhas da sobreposição e invariância da soma na reclassificação. O script independente Python/openpyxl/Decimal confirma as somas da origem, os perfis, a divergência de dias e o cruzamento de chaves. `scripts/audit.ts` gera o relatório JSON usando exatamente o parser da API.

Dados de casos sintéticos existem apenas nos testes de borda/segurança/transação; não definem os números oficiais e nunca são inseridos automaticamente no dashboard ou Neon.
