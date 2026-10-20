import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {readFile,access} from 'node:fs/promises';
import type {Server} from 'node:http';
import {randomUUID} from 'node:crypto';
import {Repository} from '../server/repository.js';
import {Auth} from '../server/auth.js';
import {createApp} from '../server/app.js';
import {parseWorkbook} from '../server/import.js';
import {sum,hash,type Dataset} from '../server/financial.js';
import {testDatabase,fixture} from './helpers.js';
const file=process.env.OFFICIAL_XLSX??'.local/official.xlsx';const available=await access(file).then(()=>true,()=>false);
describe('publicação normal e dashboard administrativo definitivo',()=>{
 let ctx:Awaited<ReturnType<typeof testDatabase>>,repo:Repository,ds:Dataset,id:string,publishedId:string,session:Awaited<ReturnType<Auth['login']>>,server:Server,base:string,originalRows:string;
 const origin='http://127.0.0.1:5173';const get=(path:string,headers:Record<string,string>={})=>fetch(base+path,{headers});
 const admin=(path:string,init:RequestInit={})=>fetch(base+path,{...init,headers:{Cookie:`lgc_session=${session.token}`,Origin:origin,'X-CSRF-Token':session.csrf,...init.headers}});
 const publish=(importId:string,expectedId:string|null,reviewedAudit=true)=>admin('/api/admin/publications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({importId,expectedCurrentId:expectedId,reviewedAudit})});
 beforeAll(async()=>{
  ctx=await testDatabase();repo=new Repository(ctx.db);ds=available?await parseWorkbook(await readFile(file),'2026-10-19'):await fixture();
  session=await new Auth(ctx.db).login('admin@example.test','senha-de-teste-segura-123');
  server=createApp({db:ctx.db,origin,publicAuthorized:()=>false}).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  if(available){const response=await admin('/api/admin/imports?referenceDate=2026-10-19',{method:'POST',headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','X-File-Name':encodeURIComponent('Faturamento A Vencer, Vencido e Faturado.xlsx')},body:await readFile(file)});expect(response.status).toBe(201);id=(await response.json()).id;}else{id=(await repo.preview(ds,ctx.actor)).id;}
  originalRows=hash(JSON.stringify((await repo.getImport(id)).rows));
 });
 afterAll(async()=>{await new Promise<void>(r=>server.close(()=>r()));await ctx.pg.close();});
 it('importação autenticada mantém contagens e faixas, sem publicar automaticamente',async()=>{
  const response=await admin('/api/admin/imports/'+id);expect(response.status).toBe(200);const data=await response.json();expect(data.sourceRecords).toBe(ds.sourceRecords);expect(data.parsedRecords).toBe(ds.rows.length);expect(data.policy.reclassifyByDueDate).toBe(false);expect(await repo.current()).toBeNull();
 });
 it('exige autenticação e papel admin para auditoria, publicação e detalhes',async()=>{
  expect((await get('/api/admin/records?year=2026&month=10')).status).toBe(401);expect((await get('/api/admin/imports/'+id)).status).toBe(401);
  const hash=(await ctx.db.query('SELECT password_hash FROM lgc.admin_users WHERE id=$1',[ctx.actor])).rows[0].password_hash;
  await ctx.db.query("INSERT INTO lgc.admin_users(id,email,password_hash,role) VALUES($1,'viewer@example.test',$2,'viewer')",[randomUUID(),hash]);const viewer=await new Auth(ctx.db).login('viewer@example.test','senha-de-teste-segura-123');
  expect((await get('/api/admin/records?year=2026&month=10',{Cookie:`lgc_session=${viewer.token}`})).status).toBe(403);
 });
 it('ainda exige confirmação explícita de revisão para publicar',async()=>{expect((await publish(id,null,false)).status).toBe(400);expect(await repo.current()).toBeNull();});
 it('publica a fonte conferida na transação normal e preserva rastreabilidade e registros',async()=>{
  const response=await publish(id,null);expect(response.status).toBe(201);publishedId=(await response.json()).id;expect(await repo.current()).toBe(publishedId);
  expect(hash(JSON.stringify((await repo.getImport(id)).rows))).toBe(originalRows);
  const stored=(await ctx.db.query('SELECT validation FROM lgc.publications WHERE id=$1',[publishedId])).rows[0].validation;
  if(available){expect(stored.reviewedExceptions.some((i:{code:string;review:{id:string}})=>i.code==='POSSIBLE_DOUBLE_COUNT'&&i.review.id==='BIOS-2026-10-20-87848-01')).toBe(true);}
  expect((await ctx.db.query('SELECT count(*)::int AS n FROM lg_financial_records WHERE publication_id=$1',[publishedId])).rows[0].n).toBe(ds.rows.length);
 });
 it.skipIf(!available)('dashboard publicado confere os quatro KPIs, YTD, clientes e representantes',async()=>{
  const response=await admin('/api/admin/dashboard?year=2026&month=10');expect(response.status).toBe(200);const data=await response.json();
  expect(data.version).toBe(publishedId);expect(data.preview).toBeUndefined();expect(data.kpis).toMatchObject({upcoming:'25711247.24',overdue:'10575015.21',received:'56999819.30',global:'93286081.75',records:5099});
  expect(sum(data.clients.map((r:{global:string})=>r.global))).toBe(data.kpis.global);expect(sum(data.representatives.map((r:{global:string})=>r.global))).toBe(data.kpis.global);expect(sum(data.monthlyReceived.map((r:{amount:string})=>r.amount))).toBe(data.kpis.received);
 });
 it('detalhamento paginado preserva todas as linhas sem expor campos clínicos',async()=>{
  const all:{amount:string;sheet:string;row:number}[]=[];
  for(let page=1;page<=Math.ceil(ds.rows.length/100);page++){
   const response=await admin(`/api/admin/records?year=2026&month=10&version=${publishedId}&page=${page}&pageSize=100`);expect(response.status).toBe(200);const data=await response.json();expect(data.total).toBe(ds.rows.length);all.push(...data.records);
   expect(Object.keys(data.records[0]).sort()).toEqual(['client','title','installment','band','sourceBand','issued','due','received','representative','amount','sheet','row'].sort());
  }
  expect(all).toHaveLength(ds.rows.length);expect(new Set(all.map(r=>`${r.sheet}:${r.row}`)).size).toBe(ds.rows.length);expect(sum(all.map(r=>r.amount))).toBe(sum(ds.rows.map(r=>r.amount)));
 });
 it('filtros do detalhamento e dos indicadores consultam a mesma versão e recorte',async()=>{
  const row=ds.rows[0],q=new URLSearchParams({year:'2026',month:'10',version:publishedId,clients:row.clientId,representatives:JSON.stringify([row.representative])});
  const dashboard=await (await admin('/api/admin/dashboard?'+q)).json(),detail=await (await admin('/api/admin/records?'+q+'&pageSize=100')).json();
  expect(detail.total).toBe(dashboard.kpis.records);expect(sum(detail.records.map((r:{amount:string})=>r.amount))).toBe(dashboard.kpis.global);expect(detail.version).toBe(dashboard.version);
  expect((await admin('/api/admin/records?year=2026&month=10&pageSize=1000')).status).toBe(400);expect((await admin('/api/admin/dashboard?year=2026&month=9')).status).toBe(404);
 });
 it('outros bloqueios e importações antigas continuam impedindo publicação',async()=>{
  const blocked=structuredClone(ds);blocked.sha256='other-source';blocked.issues.push({code:'INVALID_AMOUNT',severity:'blocking',sheet:'origem',row:2,message:'Erro não aprovado.'});const importId=(await repo.preview(blocked,ctx.actor)).id;
  expect((await publish(importId,publishedId)).status).toBe(422);expect(await repo.current()).toBe(publishedId);
  const old=structuredClone(ds);old.sha256='old-source';old.issues.push({code:'POSSIBLE_DOUBLE_COUNT',severity:'blocking',sheet:'origem',row:2,message:'Importação anterior sem revisão registrada.'});const oldId=(await repo.preview(old,ctx.actor)).id;const before=hash(JSON.stringify(await repo.getImport(oldId)));
  expect((await publish(oldId,publishedId)).status).toBe(422);expect(hash(JSON.stringify(await repo.getImport(oldId)))).toBe(before);
 });
 it('não habilita o público e não depende de uma rota de dashboard provisório',async()=>{
  expect((await get('/api/public/dashboard?year=2026&month=10')).status).toBe(403);expect((await get('/api/public/records?year=2026&month=10')).status).toBe(403);expect((await admin(`/api/admin/imports/${id}/dashboard?year=2026&month=10`)).status).toBe(404);
  expect((await admin('/api/admin/logout',{method:'POST'})).status).toBe(204);expect((await admin('/api/admin/records?year=2026&month=10')).status).toBe(401);
 });
});
