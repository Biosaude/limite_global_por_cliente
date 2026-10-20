import {describe,it,expect,beforeAll} from 'vitest';
import {readFile,access} from 'node:fs/promises';
import {officialExpectation} from './official-sources.js';
import ExcelJS from 'exceljs';
import {parseWorkbook,SHEETS,reconciliation} from '../server/import.js';
import {applyReviewedExceptions,financialFingerprint} from '../server/reviewed-exceptions.js';
import {sum,type Dataset} from '../server/financial.js';
import {fixture} from './helpers.js';
const file=process.env.OFFICIAL_XLSX??'.local/official.xlsx';const available=await access(file).then(()=>true,()=>false);
describe('aprovações restritas e rastreáveis',()=>{
 it('não libera casos futuros com o mesmo código, nem o mesmo título em dados não conferidos',async()=>{
  const ds=await fixture(book=>{for(const band of ['upcoming','received'] as const){const sheet=book.getWorksheet(SHEETS[band])!;sheet.getRow(2).getCell(2).value=87848;sheet.getRow(2).getCell(18).value='87848/01';}});
  expect(ds.issues.find(i=>i.code==='POSSIBLE_DOUBLE_COUNT')).toMatchObject({severity:'blocking'});expect(ds.issues.some(i=>i.review)).toBe(false);
 });
});
describe.skipIf(!available)('fonte real conferida e decisão do responsável',()=>{
 let buffer:Buffer,ds:Dataset;beforeAll(async()=>{buffer=await readFile(file);ds=await parseWorkbook(buffer,'2026-10-19');});
 it('preserva as faixas originais, os 5099 registros e todos os valores oficiais',()=>{
  expect(ds.policy.reclassifyByDueDate).toBe(false);expect(ds.sourceRecords).toBe(5099);expect(ds.rows).toHaveLength(5099);expect(ds.rows.every(r=>r.band===r.sourceBand)).toBe(true);
  expect(reconciliation(ds).provisional).toEqual({upcoming:'25711247.24',overdue:'10575015.21',received:'56999819.30',global:'93286081.75'});expect(ds.issues.filter(i=>i.severity==='blocking')).toHaveLength(0);
 });
 it('transforma somente a ocorrência conferida em advertência com severidade e decisão rastreáveis',()=>{
  const issue=ds.issues.find(i=>i.code==='POSSIBLE_DOUBLE_COUNT')!;
  expect(issue).toMatchObject({severity:'warning',originalSeverity:'blocking',sheet:SHEETS.upcoming,row:461,related:[{sheet:SHEETS.received,row:1291}],review:{id:'BIOS-2026-10-20-87848-01',decidedAt:'2026-10-20',appliedSourceSha256:ds.sha256}});
  expect(ds.issues.filter(i=>i.review?.id==='BIOS-2026-10-20-SOURCE-BANDS')).toHaveLength(25);expect(ds.issues.filter(i=>i.code==='DAYS_MISMATCH')).toHaveLength(officialExpectation(ds.sha256).daysMismatch);
  expect(ds.rows.filter(r=>r.title==='87848').map(r=>r.amount)).toEqual(['4300.00','4300.00']);
 });
 it('confere todas as linhas e somas diretamente nas células Excel, sem usar totais fixados para montar resultados',async()=>{
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer as never);
  for(const band of ['upcoming','overdue','received'] as const){const sheet=workbook.getWorksheet(SHEETS[band])!,amountColumn=band==='received'?15:14;const values:string[]=[];
   for(let row=2;row<=sheet.rowCount;row++){const parsed=ds.rows.find(r=>r.sheet===sheet.name&&r.row===row)!;const value=String(sheet.getRow(row).getCell(amountColumn).value);expect(Number(parsed.amount)).toBe(Number(value));expect(parsed.band).toBe(band);expect(parsed.title).toBe(String(sheet.getRow(row).getCell(2).value));values.push(value);}
   expect(sum(values)).toBe(ds.rawTotals[band]);
  }
 });
 it('não muda os registros financeiros ao aplicar a revisão e mantém outros erros impeditivos',()=>{
  const input=structuredClone(ds);input.issues.push({code:'INVALID_AMOUNT',severity:'blocking',sheet:SHEETS.upcoming,row:2,message:'Outro erro exige correção.'});
  const before=JSON.stringify(input.rows),reviewed=applyReviewedExceptions(input);
  expect(JSON.stringify(reviewed.rows)).toBe(before);expect(reviewed.issues.find(i=>i.code==='INVALID_AMOUNT')?.severity).toBe('blocking');expect(reconciliation(reviewed).status).toBe('blocked');
 });
 it('um arquivo com valores alterados deixa de corresponder à aprovação',async()=>{
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer as never);workbook.getWorksheet(SHEETS.upcoming)!.getRow(461).getCell(14).value=4300.01;
  const changed=await parseWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()),'2026-10-19');
  expect(financialFingerprint(changed)).not.toBe(financialFingerprint(ds));expect(changed.issues.find(i=>i.code==='POSSIBLE_DOUBLE_COUNT')?.severity).toBe('blocking');expect(changed.issues.some(i=>i.review)).toBe(false);
 });
 it('renomear a fonte não decide aprovação, e outra data de referência não herda a decisão',async()=>{
  const renamed=await parseWorkbook(buffer,'2026-10-19',undefined,'Faturamento A Vencer, Vencido e Faturado(2).xlsx');expect(renamed.issues.find(i=>i.code==='POSSIBLE_DOUBLE_COUNT')?.review?.id).toBe('BIOS-2026-10-20-87848-01');
  const anotherDate=await parseWorkbook(buffer,'2026-10-20');expect(anotherDate.issues.find(i=>i.code==='POSSIBLE_DOUBLE_COUNT')?.severity).toBe('blocking');
 });
});
