import {randomUUID} from 'node:crypto';
import type {Database,SQL} from './db.js';
import type {Dataset,Filters} from './financial.js';
import {consolidate} from './financial.js';
import {reconciliation} from './import.js';
export class DomainError extends Error {constructor(public code:string,public status=400){super(code);}}
export class Repository {
 constructor(readonly db:Database){}
 async ready(){const r=await this.db.query('SELECT version FROM lgc.schema_version WHERE version=2');if(r.rows.length!==1)throw Error('SCHEMA_NOT_READY');}
 async preview(ds:Dataset,actor:string){const id=randomUUID();await this.db.transaction(async tx=>{
  await tx.query('INSERT INTO lgc.imports(id,file_sha256,reference_date,snapshot,created_by) VALUES($1,$2,$3,$4,$5)',[id,ds.sha256,ds.referenceDate,JSON.stringify(ds),actor]);
  for(let i=0;i<ds.issues.length;i+=500){const issues=ds.issues.slice(i,i+500).map(x=>({id:randomUUID(),...x}));await tx.query(`INSERT INTO lgc.audit_issues(id,import_id,code,severity,sheet,source_row,detail) SELECT x.id::uuid,$1,x.code,x.severity,x.sheet,x.row,x.detail FROM jsonb_to_recordset($2::jsonb) AS x(id text,code text,severity text,sheet text,row integer,detail jsonb)`,[id,JSON.stringify(issues.map(x=>({...x,detail:x})))]);}
  await this.log(tx,actor,'preview',id,{sha256:ds.sha256});
 });return {id,...reconciliation(ds)};}
 async getImport(id:string){const r=await this.db.query('SELECT snapshot FROM lgc.imports WHERE id=$1',[id]);if(!r.rows[0])throw new DomainError('IMPORT_NOT_FOUND',404);return r.rows[0].snapshot as Dataset;}
 async history(){return (await this.db.query(`SELECT p.id,p.import_id AS "importId",p.reference_date::text AS "referenceDate",p.published_at AS "publishedAt",p.totals,p.counts FROM lgc.publications p ORDER BY p.published_at DESC,p.id`)).rows;}
 async publicationDataset(id:string){const r=await this.db.query(`SELECT i.snapshot FROM lgc.publications p JOIN lgc.imports i ON i.id=p.import_id WHERE p.id=$1`,[id]);if(!r.rows[0])throw new DomainError('PUBLICATION_NOT_FOUND',404);return r.rows[0].snapshot as Dataset;}
 async dashboard(f:Filters,version?:string){
  const r=version?await this.db.query(`SELECT p.id,p.published_at AS "publishedAt",i.snapshot FROM lgc.publications p JOIN lgc.imports i ON i.id=p.import_id WHERE p.id=$1`,[version]):await this.db.query(`SELECT p.id,p.published_at AS "publishedAt",i.snapshot FROM lgc.publications p JOIN lgc.imports i ON i.id=p.import_id WHERE EXTRACT(YEAR FROM p.reference_date)=$1 AND EXTRACT(MONTH FROM p.reference_date)=$2 ORDER BY p.reference_date DESC,p.published_at DESC,p.id DESC LIMIT 1`,[f.year,f.month]);
  if(!r.rows[0])return null;const v=r.rows[0];const result=consolidate(v.snapshot,f);return result?{version:v.id,publishedAt:v.publishedAt,...result}:null;
 }
 async publish(importId:string,actor:string,expectedId:string|null,reviewed:boolean){
  return this.db.transaction(async tx=>{
   const current=(await tx.query('SELECT publication_id FROM lgc.current_publication WHERE singleton=true FOR UPDATE')).rows[0];if(!current)throw Error('SCHEMA_NOT_READY');
   if(current.publication_id!==expectedId)throw new DomainError('PUBLICATION_CONFLICT',409);
   const imp=(await tx.query('SELECT snapshot FROM lgc.imports WHERE id=$1 FOR UPDATE',[importId])).rows[0];if(!imp)throw new DomainError('IMPORT_NOT_FOUND',404);const ds=imp.snapshot as Dataset;
   if(ds.issues.some(i=>i.severity==='blocking'))throw new DomainError('UNRESOLVED_BLOCKING_ISSUES',422);
   if(!reviewed)throw new DomainError('AUDIT_REVIEW_REQUIRED',422);
   if((await tx.query('SELECT id FROM lgc.publications WHERE import_id=$1',[importId])).rows.length)throw new DomainError('ALREADY_PUBLISHED',409);
   if((await tx.query('SELECT p.id FROM lgc.publications p JOIN lgc.imports i ON i.id=p.import_id WHERE i.file_sha256=$1 AND i.reference_date=$2',[ds.sha256,ds.referenceDate])).rows.length)throw new DomainError('DUPLICATE_SOURCE_PUBLICATION',409);
   const rows=JSON.stringify(ds.rows);
   await tx.query(`INSERT INTO lgc.clients(id,name) SELECT DISTINCT x."clientId",x.client FROM jsonb_to_recordset($1::jsonb) AS x("clientId" text,client text) ON CONFLICT DO NOTHING`,[rows]);
   await tx.query(`INSERT INTO lgc.titles(id,client_id,document,installment) SELECT DISTINCT x."titleId",x."clientId",x.title,x.installment FROM jsonb_to_recordset($1::jsonb) AS x("titleId" text,"clientId" text,title text,installment text) ON CONFLICT DO NOTHING`,[rows]);
   const id=randomUUID();
   await tx.query(`INSERT INTO public.lg_publications(id,reference_date,status,source_filename,published_at) VALUES($1,$2,'published',$3,now())`,[id,ds.referenceDate,ds.sourceFilename]);
   await tx.query(`INSERT INTO public.lg_financial_records(publication_id,source_sheet,source_row,client_name,title_number,installment,full_title_number,issued_at,due_at,received_at,credit_at,representative_name,invoice_amount,discount_amount,open_amount,received_amount,raw_record,accounting_band,client_key,title_key)
    SELECT $1,CASE x."sourceBand" WHEN 'upcoming' THEN 'a_vencer' WHEN 'overdue' THEN 'vencido' ELSE 'recebido' END,x.row,x.client,x.title,x.installment,x."fullTitle",x.issued::date,x.due::date,x.received::date,x.credit::date,x.representative,x.face::numeric,x.discount::numeric,CASE WHEN x.band<>'received' THEN x.amount::numeric END,CASE WHEN x.band='received' THEN x.amount::numeric END,jsonb_build_object('sheet',x.sheet,'row',x.row,'sourceBand',x."sourceBand"),x.band,x."clientId",x."titleId"
    FROM jsonb_to_recordset($2::jsonb) AS x(sheet text,row integer,band text,"sourceBand" text,client text,title text,installment text,"fullTitle" text,issued text,due text,received text,credit text,representative text,face text,discount text,amount text,"clientId" text,"titleId" text)`,[id,rows]);
   await tx.query(`INSERT INTO public.lg_audit_issues(publication_id,source_sheet,source_row,issue_code,severity,details) SELECT $1,i.sheet,NULLIF(i.source_row,0),i.code,CASE i.severity WHEN 'blocking' THEN 'error' ELSE i.severity END,i.detail FROM lgc.audit_issues i WHERE i.import_id=$2`,[id,importId]);
   const totals=consolidate(ds,{year:Number(ds.referenceDate.slice(0,4)),month:Number(ds.referenceDate.slice(5,7))})!.kpis;
   await tx.query(`INSERT INTO lgc.publications(id,import_id,reference_date,published_by,totals,counts,validation) VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,importId,ds.referenceDate,actor,JSON.stringify(totals),JSON.stringify(reconciliation(ds).recordCounts),JSON.stringify({reviewed:true,issues:ds.issues.length,blocking:0})]);
   await tx.query('UPDATE lgc.current_publication SET publication_id=$1 WHERE singleton=true',[id]);await this.log(tx,actor,'publish',id,{importId,referenceDate:ds.referenceDate});return {id,referenceDate:ds.referenceDate,totals};
  });
 }
 async current(){return (await this.db.query('SELECT publication_id FROM lgc.current_publication WHERE singleton=true')).rows[0]?.publication_id??null;}
 private async log(tx:SQL,actor:string,action:string,id:string,detail:unknown){await tx.query('INSERT INTO lgc.operations(id,actor,action,resource_id,detail) VALUES($1,$2,$3,$4,$5)',[randomUUID(),actor,action,id,JSON.stringify(detail)]);}
}
