import ExcelJS from 'exceljs';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {HEADERS,SHEETS,parseWorkbook} from '../server/import.js';
import type {Band,Dataset} from '../server/financial.js';
import type {Database} from '../server/db.js';
import {passwordHash} from '../server/auth.js';
export async function workbook(edit?:(book:ExcelJS.Workbook)=>void){
 const b=new ExcelJS.Workbook();
 for(const band of ['upcoming','overdue','received'] as const){const s=b.addWorksheet(SHEETS[band]);s.addRow(HEADERS[band]);
  const r:unknown[]=[ 'CLIENTE TESTE',band==='received'?3:band==='upcoming'?1:2,1,new Date('2026-01-01'),new Date(band==='upcoming'?'2026-11-01':'2026-09-01'),band==='received'?new Date('2026-03-01'):band==='upcoming'?-13:48,null,'NOME CLINICO NAO DEVE SAIR',null,null,'MEDICO NAO DEVE SAIR'];
  if(band==='received')r.push(new Date('2026-03-01'),'100.00','0.00','100.00','BANCO','REP TESTE','3/01');
  else r.push('100.00','0.00','100.00','BANCO',...(band==='upcoming'?['COBRANCA']:[]),'REP TESTE',`${band==='upcoming'?1:2}/01`);
  s.addRow(r);
 }edit?.(b);return Buffer.from(await b.xlsx.writeBuffer());
}
export async function fixture(edit?:(b:ExcelJS.Workbook)=>void):Promise<Dataset>{return parseWorkbook(await workbook(edit),'2026-10-19');}
export async function testDatabase(){
 const pg=new PGlite();await pg.exec(await readFile(new URL('../db/001_existing_baseline.sql',import.meta.url),'utf8'));await pg.exec(await readFile(new URL('../db/migrations/002_lgc_proposal.sql',import.meta.url),'utf8'));
 const db:Database={query:async(s,p)=>(await pg.query(s,p)) as any,transaction:fn=>pg.transaction(tx=>fn({query:async(s,p)=>(await tx.query(s,p)) as any}))};
 const actor=randomUUID();await db.query('INSERT INTO lgc.admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[actor,'admin@example.test',await passwordHash('senha-de-teste-segura-123'),'admin']);return {pg,db,actor};
}
