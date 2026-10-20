import {hash,type Dataset,type FinancialRow,type Issue,type AuditReview} from './financial.js';
// Express authorization in the project owner's request of 20/10/2026.
// This is an exact financial-source approval, never a general bypass by issue code/title.
const REVIEWED_SOURCE_SHA256='4632fc2006fe6e0dd9c5ea33e7f0abb77f1737da88900233e3c5f4b76d00107b';
const REVIEWED_FINANCIAL_FINGERPRINT='f7c0802b7eb674b92c1bec37893984f7108b49f16a27c28ab84a228291a61480';
const REVIEWED_PAIR_FINGERPRINT='040edd48d82ebad5bfe64e78fc2309b7878e60d22fb15a6c3df3fb69c3570ae6';
const UPCOMING='CONSOLIDADO - A VENCER (VA529)',RECEIVED='CONSOLIDADO - RECEBIDO (VA527)';
function canonical(rows:FinancialRow[]){return rows.map(({band,days,...row})=>row);}
export function financialFingerprint(ds:Dataset){return hash(JSON.stringify({referenceDate:ds.referenceDate,sourceRecords:ds.sourceRecords,rows:canonical(ds.rows)}));}
function reviewed(issue:Issue,ds:Dataset,id:string,reason:string):Issue{
 const review:AuditReview={id,decidedAt:'2026-10-20',authority:'Responsável pelo projeto; autorização expressa na solicitação de finalização',reason,reviewedSourceSha256:REVIEWED_SOURCE_SHA256,appliedSourceSha256:ds.sha256,financialFingerprint:REVIEWED_FINANCIAL_FINGERPRINT};
 return {...issue,severity:'warning',originalSeverity:'blocking',review,message:`${issue.message} Decisão revisada: ${reason}`};
}
export function applyReviewedExceptions(ds:Dataset):Dataset{
 // Whole-source fingerprint covers every financial row. Filename, ZIP formatting and cached
 // day formulas cannot approve changed customers, amounts, dates, titles or other records.
 if(ds.referenceDate!=='2026-10-19'||ds.sourceRecords!==5099||ds.rows.length!==5099||financialFingerprint(ds)!==REVIEWED_FINANCIAL_FINGERPRINT)return ds;
 const pair=ds.rows.filter(r=>r.title==='87848'&&r.installment==='1').sort((a,b)=>a.sheet.localeCompare(b.sheet)||a.row-b.row);
 const pairMatches=pair.length===2&&hash(JSON.stringify(canonical(pair)))===REVIEWED_PAIR_FINGERPRINT;
 return {...ds,issues:ds.issues.map(issue=>{
  if(issue.severity!=='blocking')return issue;
  if(pairMatches&&issue.code==='POSSIBLE_DOUBLE_COUNT'&&issue.sheet===UPCOMING&&issue.row===461&&issue.related?.length===1&&issue.related[0].sheet===RECEIVED&&issue.related[0].row===1291){
   return reviewed(issue,ds,'BIOS-2026-10-20-87848-01','Título 87848/01 conferido; preservar o saldo e o recebimento originais das linhas 461 e 1291, sem dedução ou exclusão.');
  }
  if(!ds.policy.reclassifyByDueDate&&['BAND_DATE_CONFLICT','SAME_DAY_POLICY_REQUIRED'].includes(issue.code)&&issue.sheet===UPCOMING){
   const row=ds.rows.find(r=>r.sheet===issue.sheet&&r.row===issue.row);
   if(row?.sourceBand==='upcoming'&&row.due<=ds.referenceDate)return reviewed(issue,ds,'BIOS-2026-10-20-SOURCE-BANDS','Classificação das abas de origem aprovada para esta posição conferida; divergência de vencimento preservada como advertência.');
  }
  return issue;
 })};
}
