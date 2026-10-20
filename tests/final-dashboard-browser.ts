// Local UI validation only. Never reads DATABASE_URL or writes to a remote database.
import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.js';
import {Repository} from '../server/repository.js';
import {parseWorkbook} from '../server/import.js';
import {sum} from '../server/financial.js';
import {testDatabase} from './helpers.js';
const ctx=await testDatabase();const ds=await parseWorkbook(await readFile(process.env.OFFICIAL_XLSX??'.local/official.xlsx'),'2026-10-19');
const repo=new Repository(ctx.db);const imported=await repo.preview(ds,ctx.actor);
const origin='http://127.0.0.1:5178';
const backend=createApp({db:ctx.db,origin,publicAuthorized:()=>false}).listen(0,'127.0.0.1');await new Promise<void>(r=>backend.once('listening',r));
const vite=await createServer({server:{host:'127.0.0.1',port:5178,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${(backend.address() as {port:number}).port}`}}}});await vite.listen();
const profile=await mkdtemp('/tmp/lgc-final-chromium-');
const chrome=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws:WebSocket|undefined;
try{
 let port='';for(let n=0;n<100;n++){try{port=(await readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0];break;}catch{await new Promise(r=>setTimeout(r,100));}}assert(port,'Chromium startup');
 const pages=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as {type:string;webSocketDebuggerUrl:string}[];
 ws=new WebSocket(pages.find(p=>p.type==='page')!.webSocketDebuggerUrl);await new Promise<void>((r,j)=>{ws!.addEventListener('open',()=>r(),{once:true});ws!.addEventListener('error',()=>j(Error('CDP connection')),{once:true});});
 let sequence=0;const pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
 ws.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.id){const p=pending.get(message.id);pending.delete(message.id);if(message.error)p?.reject(Error(message.error.message));else p?.resolve(message.result);}});
 const send=(method:string,params:unknown={})=>new Promise<any>((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws!.send(JSON.stringify({id,method,params}));});
 const evaluate=async(expression:string)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result?.value;};
 const wait=async(expression:string,label:string)=>{for(let n=0;n<100;n++){if(await evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}throw Error('UI timeout: '+label);};
 await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:origin});
 await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Acesso administrativo')`,'initial page');
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Acesso administrativo').click()`);
 await wait(`!!document.querySelector('input[type=email]')`,'login form');
 await evaluate(`(()=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [type,value] of [['email','admin@example.test'],['password','senha-de-teste-segura-123']]){const e=document.querySelector('input[type='+type+']');set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('form').requestSubmit();})()`);
 await wait(`document.querySelector('[aria-label="Importações pendentes"]')?.options.length>1`,'admin login and saved imports');
 await evaluate(`(()=>{const select=document.querySelector('[aria-label="Importações pendentes"]');select.value=${JSON.stringify(imported.id)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait(`!!document.querySelector('.base-confirm input')`,'import audit');
 assert(await evaluate(`!document.querySelector('.kpi-grid')&&!document.querySelector('.financial-preview-banner')`));
 await evaluate(`document.querySelector('.base-confirm input').click()`);
 await wait(`!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Confirmar publicação').disabled`,'review confirmation');
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Confirmar publicação').click()`);
 await wait(`document.querySelector('.kpi-grid')?.textContent.includes('93.286.081,75')`,'published dashboard');
 for(const amount of ['25.711.247,24','10.575.015,21','56.999.819,30'])assert(await evaluate(`document.querySelector('.kpi-grid').textContent.includes(${JSON.stringify(amount)})`));
 await wait(`!!document.querySelector('.record-details')`,'record details');
 assert(await evaluate(`Array.from(document.querySelectorAll('h2')).some(e=>e.textContent==='Ranking financeiro por cliente')&&Array.from(document.querySelectorAll('h2')).some(e=>e.textContent==='Indicadores por representante')`));
 assert(await evaluate(`document.querySelector('.record-details summary').textContent.includes('5.099')`));
 await evaluate(`document.querySelector('.record-details summary').click()`);
 await wait(`document.querySelector('.record-details tbody tr')`,'detail rows');
 await wait(`document.querySelectorAll('.recharts-wrapper svg').length===2`,'charts');
 for(const width of [1280,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await new Promise(r=>setTimeout(r,400));
  const bounds=await evaluate(`(()=>{const panel=document.querySelector('.base-management').getBoundingClientRect();return Array.from(document.querySelectorAll('.base-controls input,.base-controls button,.base-import-controls select')).map(e=>{const r=e.getBoundingClientRect();return {width:r.width,inside:r.left>=panel.left&&r.right<=panel.right+1,viewport:r.left>=0&&r.right<=innerWidth+1};});})()`);
  assert(bounds.every((r:{width:number;inside:boolean;viewport:boolean})=>r.width>0&&r.inside&&r.viewport),`import controls at ${width}px`);
  await evaluate(`(()=>{const p=document.querySelector('.base-management');window.scrollTo(0,p.getBoundingClientRect().top+scrollY-90);})()`);
  const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(`.local/final-dashboard-${width}.png`,Buffer.from(shot.data,'base64'));
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 const client=ds.rows[0].client,rep=ds.rows[0].representative;
 const clickFilter=async(label:string,value:string)=>evaluate(`(()=>{const summary=document.querySelector('[aria-label=${JSON.stringify(label)}]');summary.click();const item=Array.from(summary.parentElement.querySelectorAll('.select-options label')).find(e=>e.querySelector('span').textContent===${JSON.stringify(value)});item.querySelector('input').click();summary.click();})()`);
 await clickFilter('Clientes',client);await wait(`document.querySelector('.kpi-grid')?.textContent.includes('Clientes1')`,'client filter');
 await clickFilter('Representantes',rep);
 const selected=ds.rows.filter(r=>r.client===client&&r.representative===rep);const expected=sum(selected.map(r=>r.amount)).replace(/\B(?=(\d{3})+(?!\d))/g,'.').replace(/\.(\d{2})$/,',$1');
 await wait(`document.querySelector('.kpi-grid')?.textContent.includes(${JSON.stringify(expected)})`,'combined filters');
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Sair').click()`);
 await wait(`!document.querySelector('.base-management')&&!document.querySelector('.financial-preview-banner')&&!document.querySelector('.kpi-grid')`,'logout hides preview');
 assert(await repo.current());assert.equal((await repo.history()).length,1);assert.deepEqual((await repo.getImport(imported.id)).rows,JSON.parse(JSON.stringify(ds.rows))); 
 console.log('PASS: Chromium admin login, import audit, local publication, four KPIs, charts, rankings, detail records, combined filters, import controls at 1280/390px, logout isolation. No remote database or deployment.');
}finally{
 ws?.close();chrome.kill('SIGTERM');await vite.close();await new Promise<void>(r=>backend.close(()=>r()));await ctx.pg.close();await new Promise(r=>setTimeout(r,300));await rm(profile,{recursive:true,force:true});
}
