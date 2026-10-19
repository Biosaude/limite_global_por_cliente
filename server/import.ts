import ExcelJS from 'exceljs';
import {basename} from 'node:path';
import yauzl from 'yauzl';
import Decimal from 'decimal.js';
import {consolidate,date,dayDiff,money,sum,hash,normalize,type Dataset,type Band,type FinancialRow,type Issue} from './financial.js';
export const HEADERS:Record<Band,string[]>={
 upcoming:['Nome cliente','Duplicata','Parcela','Dt.emissao','Dt.vencimento','Dias para vencer','Dt.cirurgia','Paciente','Nome hospital','Descricao do plano de saude','Nome do medico','Vr.duplicata','Vr.desconto','Vr.aberto','Descricao','Descricao','Nome representante','Numero do titulo completo'],
 overdue:['Nome cliente','Duplicata','Parcela','Dt.emissao','Dt.vencimento','Qtd. De dias vencidos','Dt.cirurgia','Paciente','Nome hospital','Descricao do plano de saude','Nome do medico','Vr.duplicata','Vr.desconto','Vr.aberto','Descricao','Nome representante','Numero do titulo completo'],
 received:['Nome cliente','Duplicata','Parcela','Dt.emissao','Dt.vencimento','Dt.recebimento','Dt.cirurgia','Paciente','Nome hospital','Descricao do plano de saude','Nome do medico','Dt.credito','Vr.duplicata','Vr.desconto','Vr.recebido','Descricao','Nome representante','Numero do titulo completo']
};
export const SHEETS:Record<Band,string>={upcoming:'CONSOLIDADO - A VENCER (VA529)',overdue:'CONSOLIDADO - VENCIDO (VA529)',received:'CONSOLIDADO - RECEBIDO (VA527)'};
async function inspectZip(buffer:Buffer){
 if(buffer.length>4*1024*1024)throw Error('FILE_TOO_LARGE');
 await new Promise<void>((resolve,reject)=>yauzl.fromBuffer(buffer,{lazyEntries:true},(err,zip)=>{
  if(err||!zip)return reject(Error('INVALID_XLSX'));let bytes=0,entries=0;
  zip.on('error',()=>reject(Error('INVALID_XLSX')));zip.on('end',resolve);
  zip.on('entry',(entry:yauzl.Entry)=>{bytes+=entry.uncompressedSize;entries++;
   if(bytes>50*1024*1024||entries>1000||/externalLinks|vbaProject|\.\./i.test(entry.fileName)){zip.close();reject(Error('UNSAFE_XLSX'));return;}zip.readEntry();});zip.readEntry();
 }));
}
function text(v:unknown){if(typeof v!=='string'&&typeof v!=='number')throw Error('INVALID_IDENTIFIER');const s=normalize(String(v));if(!s||s.length>250)throw Error('INVALID_IDENTIFIER');return s;}
export async function parseWorkbook(buffer:Buffer,reference:string,policy:Dataset['policy']={reclassifyByDueDate:true,sameDay:'overdue'},sourceFilename='upload.xlsx'):Promise<Dataset>{
 const referenceDate=date(reference);await inspectZip(buffer);const book=new ExcelJS.Workbook();await book.xlsx.load(buffer as never);
 if(book.worksheets.length!==3)throw Error('THREE_SHEETS_REQUIRED');
 const ds:Dataset={schemaVersion:1,sourceFilename:basename(sourceFilename.replaceAll('\\','/')).slice(0,200),policy,sha256:'',referenceDate,sheets:[],rows:[],issues:[],rawTotals:{upcoming:'0.00',overdue:'0.00',received:'0.00'},sourceRecords:0};
 // Hash the actual bytes, not a representation.
 const {createHash}=await import('node:crypto');ds.sha256=createHash('sha256').update(buffer).digest('hex');
 const issue=(code:string,severity:Issue['severity'],sheet:string,row:number,message:string,related?:Issue['related'])=>ds.issues.push({code,severity,sheet,row,message,...(related?{related}:{})});
 for(const band of ['upcoming','overdue','received'] as const){
  const sheet=book.getWorksheet(SHEETS[band]);if(!sheet)throw Error('SHEET_NAME_MISMATCH');
  const headers=HEADERS[band];if(sheet.columnCount!==headers.length||headers.some((h,i)=>sheet.getRow(1).getCell(i+1).value!==h))throw Error('HEADER_MISMATCH');
  if(sheet.rowCount>25001)throw Error('TOO_MANY_ROWS');
  const columns=headers.map((name,i)=>({position:i+1,name,types:{} as Record<string,number>,empty:0,minDate:undefined as string|undefined,maxDate:undefined as string|undefined}));
  const amounts:string[]=[];let records=0;
  for(let n=2;n<=sheet.rowCount;n++){
   const row=sheet.getRow(n);if(!row.hasValues){issue('EMPTY_ROW','info',sheet.name,n,'Linha vazia preservada na auditoria.');continue;}
   records++;ds.sourceRecords++;
   for(let j=0;j<columns.length;j++){const v=row.getCell(j+1).value;const c=columns[j];const type=v instanceof Date?'date':v&&typeof v==='object'&&('formula' in v||'sharedFormula' in v)?'formula':typeof v;c.types[type]=(c.types[type]||0)+1;if(v===null||v===undefined||typeof v==='string'&&!v.trim())c.empty++;if(v instanceof Date){const d=date(v);c.minDate=!c.minDate||d<c.minDate?d:c.minDate;c.maxDate=!c.maxDate||d>c.maxDate?d:c.maxDate;}}
   const at=(i:number)=>row.getCell(i).value;
   const amountIndex=band==='received'?15:14;let amount:string;
   try{amount=money(at(amountIndex));amounts.push(amount);}catch{issue('INVALID_AMOUNT','blocking',sheet.name,n,'Valor financeiro inválido; linha em quarentena.');continue;}
   // Strict financial fields; unused clinical fields never enter the dataset.
   try{
    const client=text(at(1)),title=text(at(2)),installment=text(at(3)),fullTitle=text(at(headers.length));
    if(!/^\d+$/.test(title)||!/^\d+$/.test(installment))throw Error('INVALID_IDENTIFIER');
    if(fullTitle!==`${title}/${installment.padStart(2,'0')}`)issue('TITLE_ID_MISMATCH','blocking',sheet.name,n,'Número completo diverge da duplicata/parcela.');
    const clientId=hash(client),titleId=hash(JSON.stringify([clientId,title,installment]));
    const issued=date(at(4)),due=date(at(5)),received=band==='received'?date(at(6)):null,credit=band==='received'?date(at(12)):null;
    const face=money(at(band==='received'?13:12)),discount=money(at(band==='received'?14:13));
    const dayCell=at(6);const dayValue=row.getCell(6).type===ExcelJS.ValueType.Formula?row.getCell(6).result:dayCell;
    const days=band==='received'?null:typeof dayValue==='number'?dayValue:NaN;
    const r:FinancialRow={sheet:sheet.name,row:n,band,sourceBand:band,client,clientId,title,installment,titleId,fullTitle,representative:text(at(band==='overdue'?16:17)),issued,due,received,credit,days,amount,face,discount};ds.rows.push(r);
    if(new Decimal(amount).lte(0))issue('NONPOSITIVE_AMOUNT','blocking',sheet.name,n,'Valor zero ou negativo exige conferência.');
    if(new Decimal(face).lt(0)||new Decimal(discount).lt(0))issue('INVALID_FACE_DISCOUNT','blocking',sheet.name,n,'Valor nominal/desconto negativo.');
    if(due<issued)issue('DUE_BEFORE_ISSUE','blocking',sheet.name,n,'Vencimento anterior à emissão.');
    if(band!=='received'){
     if(!Number.isInteger(days)||dayDiff(referenceDate,due)!==days)issue('DAYS_MISMATCH','warning',sheet.name,n,'Dias informados divergem da data de referência.');
     const target=due>referenceDate?'upcoming':due<referenceDate?'overdue':policy.sameDay;
     if(target==='unresolved')issue('SAME_DAY_POLICY_REQUIRED','blocking',sheet.name,n,'Título vence na referência; definir explicitamente a faixa do próprio dia.');
     else if(target!==band){
      if(policy.reclassifyByDueDate){r.band=target;issue('RECLASSIFIED_BY_DUE_DATE','info',sheet.name,n,`Faixa de origem ${band}; classificação contábil ${target} por vencimento, conforme política registrada.`);}
      else issue('BAND_DATE_CONFLICT','blocking',sheet.name,n,'Faixa de origem incompatível com vencimento e referência.');
     }
     if(new Decimal(amount).plus(discount).gt(face))issue('OPEN_EXCEEDS_FACE','warning',sheet.name,n,'Saldo mais desconto excede o nominal.');
    }else{
     if(received!<issued)issue('RECEIVED_BEFORE_ISSUE','blocking',sheet.name,n,'Recebimento anterior à emissão.');
     if(received!>referenceDate)issue('FUTURE_RECEIPT','blocking',sheet.name,n,'Recebimento posterior à posição.');
     if(credit!==received)issue('CREDIT_DATE_DIFFERS','warning',sheet.name,n,'Data de crédito difere do recebimento; YTD usa recebimento.');
     if(received!.slice(0,4)!==referenceDate.slice(0,4))issue('OUTSIDE_YTD','info',sheet.name,n,'Recebimento fora do ano; preservado, não soma ao YTD.');
    }
   }catch{issue('INVALID_FINANCIAL_FIELDS','blocking',sheet.name,n,'Identificação, dimensão ou data financeira inválida; linha em quarentena.');}
  }
  if(records===0)issue('EMPTY_SHEET','blocking',sheet.name,0,'Aba sem registros financeiros; confirmação ou fonte corrigida necessária.');
  ds.rawTotals[band]=sum(amounts);ds.sheets.push({name:sheet.name,band,records,columns,financialColumn:band==='received'?15:14});
 }
 const grouped=new Map<string,FinancialRow[]>();for(const r of ds.rows){const group=grouped.get(r.titleId);if(group)group.push(r);else grouped.set(r.titleId,[r]);}
 for(const rs of grouped.values()){
  const open=rs.filter(r=>r.band!=='received'),paid=rs.filter(r=>r.band==='received');
  if(open.length>1)for(const r of open)issue('DUPLICATE_OPEN_TITLE','blocking',r.sheet,r.row,'Mesmo saldo/título repetido na posição.',open.map(x=>({sheet:x.sheet,row:x.row})));
  const receipts=new Set<string>();for(const r of paid){const key=JSON.stringify([r.received,r.amount]);if(receipts.has(key))issue('AMBIGUOUS_DUPLICATE_PAYMENT','blocking',r.sheet,r.row,'Mesmo título/data/valor sem identificador único de pagamento.');receipts.add(key);}
  if(open.length&&paid.length){const r=open[0];issue('OPEN_AND_RECEIVED','warning',r.sheet,r.row,'Título em saldo e recebimentos: possível pagamento parcial; valores não são unidos por join.',paid.map(x=>({sheet:x.sheet,row:x.row})));
   if(new Decimal(sum(rs.map(x=>x.amount))).gt(r.face))issue('POSSIBLE_DOUBLE_COUNT','blocking',r.sheet,r.row,'Saldo mais recebimentos excede o nominal; requer conciliação da origem.',paid.map(x=>({sheet:x.sheet,row:x.row})));
  }
 }
 issue('CLIENT_NAME_ONLY','warning','',0,'Fonte sem CNPJ/código de cliente: agrupamento pelo nome normalizado, sem identidade fiscal garantida.');
 return ds;
}
export function reconciliation(ds:Dataset){return {sourceFilename:ds.sourceFilename,referenceDate:ds.referenceDate,policy:ds.policy,status:ds.issues.some(i=>i.severity==='blocking')?'blocked':'review_required',recordCounts:{source:Object.fromEntries(ds.sheets.map(s=>[s.band,s.records])),accounting:Object.fromEntries((['upcoming','overdue','received'] as const).map(b=>[b,ds.rows.filter(r=>r.band===b).length]))},sourceRecords:ds.sourceRecords,parsedRecords:ds.rows.length,quarantinedRecords:ds.sourceRecords-ds.rows.length,rawTotals:{...ds.rawTotals,global:sum(Object.values(ds.rawTotals))},provisional:consolidatePreview(ds),issues:ds.issues,sheets:ds.sheets};}
function consolidatePreview(ds:Dataset){const k=consolidate(ds,{year:Number(ds.referenceDate.slice(0,4)),month:Number(ds.referenceDate.slice(5,7))})!.kpis;return {upcoming:k.upcoming,overdue:k.overdue,received:k.received,global:k.global};}
