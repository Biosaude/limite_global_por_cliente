import Decimal from 'decimal.js';
import {createHash} from 'node:crypto';
export type Band='upcoming'|'overdue'|'received';
export type Issue={code:string;severity:'info'|'warning'|'blocking';sheet:string;row:number;related?:{sheet:string;row:number}[];message:string};
export type FinancialRow={sheet:string;row:number;band:Band;sourceBand:Band;client:string;clientId:string;title:string;installment:string;titleId:string;fullTitle:string;representative:string;issued:string;due:string;received:string|null;credit:string|null;days:number|null;amount:string;face:string;discount:string};
export type ColumnProfile={position:number;name:string;types:Record<string,number>;empty:number;minDate?:string;maxDate?:string};
export type Dataset={schemaVersion:1;sourceFilename:string;policy:{reclassifyByDueDate:boolean;sameDay:'upcoming'|'overdue'|'unresolved'};sha256:string;referenceDate:string;sheets:{name:string;band:Band;records:number;columns:ColumnProfile[];financialColumn:number}[];rows:FinancialRow[];issues:Issue[];rawTotals:Record<Band,string>;sourceRecords:number};
export function money(v:unknown):string {
 if(typeof v!=='number'&&typeof v!=='string')throw Error('INVALID_MONEY');
 let s=String(v).trim();
 if(s.includes(',')){if(!/^-?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{1,2}$/.test(s))throw Error('INVALID_MONEY');s=s.replaceAll('.','').replace(',','.');}
 if(!/^-?\d+(?:\.\d+)?$/.test(s))throw Error('INVALID_MONEY');
 const d=new Decimal(s);if(d.abs().gte('1000000000000000'))throw Error('MONEY_OVERFLOW');
 return d.toDecimalPlaces(2,Decimal.ROUND_HALF_UP).toFixed(2);
}
export function sum(values:string[]):string{return values.reduce((a,b)=>a.plus(b),new Decimal(0)).toFixed(2);}
export const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const normalize=(s:string)=>s.trim().replace(/\s+/g,' ').toUpperCase();
export function date(v:unknown):string {
 if(v instanceof Date){if(!Number.isFinite(v.getTime()))throw Error('INVALID_DATE');return v.toISOString().slice(0,10);}
 if(typeof v!=='string')throw Error('INVALID_DATE');
 let s=v.trim();if(/^\d{2}\/\d{2}\/\d{4}$/.test(s))s=s.slice(6)+'-'+s.slice(3,5)+'-'+s.slice(0,2);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('INVALID_DATE');
 const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error('INVALID_DATE');return s;
}
export const dayDiff=(a:string,b:string)=>Math.round((Date.parse(a)-Date.parse(b))/86400000);
export type Filters={year:number;month:number;clients?:string[];representatives?:string[]};
export function consolidate(ds:Dataset,f:Filters){
 const ref=ds.referenceDate;
 // A snapshot can serve only its exact month; earlier positions are never reconstructed.
 if(Number(ref.slice(0,4))!==f.year||Number(ref.slice(5,7))!==f.month)return null;
 const rows=ds.rows.filter(r=>(!f.clients?.length||f.clients.includes(r.clientId))&&(!f.representatives?.length||f.representatives.includes(r.representative))&&(r.band!=='received'||r.received!>=`${f.year}-01-01`&&r.received!<=ref));
 const groups=new Map<string,FinancialRow[]>();for(const r of rows){const group=groups.get(r.clientId);if(group)group.push(r);else groups.set(r.clientId,[r]);}
 const totals=(rs:FinancialRow[])=>{const upcoming=sum(rs.filter(r=>r.band==='upcoming').map(r=>r.amount));const overdue=sum(rs.filter(r=>r.band==='overdue').map(r=>r.amount));const received=sum(rs.filter(r=>r.band==='received').map(r=>r.amount));return {upcoming,overdue,received,global:sum([upcoming,overdue,received])};};
 const kpis=totals(rows);
 const clients=[...groups].map(([id,rs])=>({id,name:rs[0].client,...totals(rs),titles:new Set(rs.map(r=>r.titleId)).size})).sort((a,b)=>new Decimal(b.global).cmp(a.global)||a.id.localeCompare(b.id));
 const monthlyReceived=Array.from({length:f.month},(_,i)=>({month:i+1,amount:sum(rows.filter(r=>r.band==='received'&&Number(r.received!.slice(5,7))===i+1).map(r=>r.amount))}));
 return {referenceDate:ref,partialPeriod:ref!==new Date(Date.UTC(f.year,f.month,0)).toISOString().slice(0,10),kpis:{...kpis,clients:clients.length,titles:new Set(rows.map(r=>r.titleId)).size,records:rows.length},shares:Object.fromEntries((['upcoming','overdue','received'] as const).map(b=>[b,new Decimal(kpis.global).isZero()?'0.00':new Decimal(kpis[b]).div(kpis.global).mul(100).toFixed(2)])),clients,monthlyReceived,filters:{clients:[...new Map(ds.rows.map(r=>[r.clientId,{value:r.clientId,label:r.client}])).values()],representatives:[...new Set(ds.rows.map(r=>r.representative))].sort()}};
}
