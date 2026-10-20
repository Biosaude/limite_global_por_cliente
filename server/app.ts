import express,{type Request,type Response,type NextFunction} from 'express';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {database,type Database} from './db.js';
import {Auth,type Identity} from './auth.js';
import {Repository,DomainError} from './repository.js';
import {parseWorkbook,reconciliation} from './import.js';
import {date} from './financial.js';
const filters=z.object({year:z.coerce.number().int().min(2000).max(2100),month:z.coerce.number().int().min(1).max(12),clients:z.string().max(40000).optional(),representatives:z.string().max(20000).optional(),version:z.string().uuid().optional()}).strict();
const mutation=(req:Request)=>!['GET','HEAD','OPTIONS'].includes(req.method);
const token=(req:Request)=>/(?:^|;\s*)lgc_session=([a-f0-9]{64})(?:;|$)/.exec(req.get('cookie')??'')?.[1]??'';
export function createApp(options:{db?:Database;origin?:string;publicAuthorized?:()=>boolean;production?:boolean}={}){
 const app=express();app.disable('x-powered-by');const production=options.production??!!process.env.VERCEL;
 const cookie={httpOnly:true,secure:production,sameSite:'strict' as const,path:'/api',maxAge:8*3600000};
 const getDB=()=>options.db??database();const repo=()=>new Repository(getDB());const auth=()=>new Auth(getDB());
 app.use(helmet());app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');res.locals.requestId=randomUUID();res.set('X-Request-Id',res.locals.requestId);next();});
 app.use('/api',rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-8',legacyHeaders:false}));
 app.use('/api',(req,res,next)=>{if(mutation(req)){const origin=options.origin??process.env.APP_ORIGIN;if(!origin||req.get('origin')!==origin)return res.status(403).json({error:'ORIGIN_DENIED'});}next();});
 app.get('/api/health',(_req,res)=>res.json({status:'ok'}));
 app.get('/api/ready',async(_req,res)=>{await repo().ready();res.json({status:'ready'});});
 app.post('/api/auth/login',express.json({limit:'8kb'}),async(req,res)=>{const b=z.object({email:z.string().email().max(254),password:z.string().min(1).max(256)}).strict().parse(req.body);const login=await auth().login(b.email,b.password);res.cookie('lgc_session',login.token,cookie).json({csrf:login.csrf,role:login.role});});
 app.use('/api/admin',async(req,res,next)=>{if(!token(req))return res.status(401).json({error:'AUTH_REQUIRED'});const id=await auth().session(token(req));if(!id)return res.status(401).json({error:'AUTH_REQUIRED'});res.locals.identity=id;if(mutation(req)&&!auth().csrf(id,req.get('x-csrf-token')??''))return res.status(403).json({error:'CSRF_DENIED'});next();});
 app.get('/api/admin/me',(_req,res)=>res.json({role:(res.locals.identity as Identity).role}));
 app.post('/api/admin/logout',async(req,res)=>{await auth().logout(token(req));res.clearCookie('lgc_session',{...cookie,maxAge:undefined}).sendStatus(204);});
 function administrator(_req:Request,res:Response,next:NextFunction){if((res.locals.identity as Identity).role!=='admin')return res.status(403).json({error:'ADMIN_REQUIRED'});next();}
 app.get('/api/admin/history',administrator,async(_req,res)=>res.json({currentId:await repo().current(),versions:await repo().history()}));
 app.get('/api/admin/publications/:id/audit',administrator,async(req,res)=>res.json(reconciliation(await repo().publicationDataset(z.string().uuid().parse(req.params.id)))));
 app.get('/api/admin/imports',administrator,async(_req,res)=>res.json(await repo().pendingImports()));
 app.get('/api/admin/imports/:id',administrator,async(req,res)=>res.json(reconciliation(await repo().getImport(z.string().uuid().parse(req.params.id)))));
 // Binary body keeps upload below the Vercel request limit; no client-side financial payload is trusted.
 app.post('/api/admin/imports',administrator,express.raw({type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',limit:'4mb'}),async(req,res)=>{
  if(!Buffer.isBuffer(req.body))throw new DomainError('XLSX_BODY_REQUIRED',415);
  const reference=date(z.string().parse(req.query.referenceDate));
  const policy=z.object({reclassify:z.literal('false').default('false'),sameDay:z.literal('overdue').default('overdue')}).parse(req.query);
  let filename:string;try{filename=decodeURIComponent(req.get('x-file-name')??'upload.xlsx');}catch{throw new DomainError('INVALID_FILE_NAME');}
  filename=z.string().min(1).max(200).regex(/^[^\x00-\x1f]+\.xlsx$/i).parse(filename);
  const ds=await parseWorkbook(req.body,reference,{reclassifyByDueDate:false,sameDay:policy.sameDay},filename);res.status(201).json(await repo().preview(ds,(res.locals.identity as Identity).id));
 });
 app.post('/api/admin/publications',administrator,express.json({limit:'8kb'}),async(req,res)=>{const b=z.object({importId:z.string().uuid(),expectedCurrentId:z.string().uuid().nullable(),reviewedAudit:z.literal(true)}).strict().parse(req.body);res.status(201).json(await repo().publish(b.importId,(res.locals.identity as Identity).id,b.expectedCurrentId,b.reviewedAudit));});
 const dashboard=async(req:Request,res:Response)=>{const f=filters.parse(req.query);const result=await repo().dashboard({year:f.year,month:f.month,clients:f.clients?.split(',').filter(Boolean),representatives:f.representatives?z.array(z.string().max(250)).max(1000).parse(JSON.parse(f.representatives)):undefined},f.version);if(!result)return res.status(404).json({error:'NO_HISTORICAL_POSITION'});const {representatives,...publicResult}=result;return res.json(req.path.startsWith('/api/public/')?publicResult:result);};
 app.get('/api/admin/records',administrator,async(req,res)=>{
  const f=filters.extend({page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(50)}).parse(req.query);
  const result=await repo().records({year:f.year,month:f.month,clients:f.clients?.split(',').filter(Boolean),representatives:f.representatives?z.array(z.string().max(250)).max(1000).parse(JSON.parse(f.representatives)):undefined},f.version,f.page,f.pageSize);
  if(!result)return res.status(404).json({error:'NO_HISTORICAL_POSITION'});res.json(result);
 });
 app.get('/api/admin/dashboard',dashboard);
 app.use('/api/public',(_req,res,next)=>{if(!(options.publicAuthorized?.()??process.env.PUBLIC_FINANCIAL_DATA_AUTHORIZED==='true'))return res.status(403).json({error:'PUBLIC_FINANCIAL_DISCLOSURE_NOT_AUTHORIZED'});next();});
 app.get('/api/public/dashboard',dashboard);
 app.get('/api/public/periods',async(_req,res)=>{res.json((await repo().history()).map(v=>({id:v.id,referenceDate:v.referenceDate,publishedAt:v.publishedAt})));});
 app.use('/api',(_req,res)=>res.status(404).json({error:'NOT_FOUND'}));
 app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{
  if(err instanceof DomainError)return res.status(err.status).json({error:err.code});
  if(err instanceof z.ZodError||err instanceof SyntaxError)return res.status(400).json({error:'INVALID_REQUEST'});
  const code=err instanceof Error?err.message:'';
  if(['INVALID_DATE','FILE_TOO_LARGE','INVALID_XLSX','UNSAFE_XLSX','THREE_SHEETS_REQUIRED','SHEET_NAME_MISMATCH','HEADER_MISMATCH','TOO_MANY_ROWS'].includes(code))return res.status(422).json({error:code});
  if((err as {type?:string})?.type==='entity.too.large')return res.status(413).json({error:'FILE_TOO_LARGE'});
  // No request bodies, names, credentials or database messages in operational logs.
  console.error(JSON.stringify({event:'api_failure',requestId:res.locals.requestId,code:'DEPENDENCY_UNAVAILABLE'}));return res.status(503).json({error:'SERVICE_UNAVAILABLE',requestId:res.locals.requestId});
 });return app;
}
