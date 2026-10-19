import pg from 'pg';
export interface SQL {query(sql:string,params?:unknown[]):Promise<{rows:any[]}>;}
export interface Database extends SQL {transaction<T>(fn:(tx:SQL)=>Promise<T>):Promise<T>;}
let instance:Database|undefined;
export function database():Database{
 if(instance)return instance;
 const url=process.env.DATABASE_URL;if(!url)throw Error('DATABASE_UNAVAILABLE');
 const parsed=new URL(url);if(!parsed.hostname.endsWith('.neon.tech'))throw Error('NEON_HOST_REQUIRED');
 // pg interprets sslmode=require as compatibility mode. Enforce certificate validation explicitly.
 parsed.searchParams.delete('sslmode');parsed.searchParams.delete('sslrootcert');parsed.searchParams.delete('sslcert');parsed.searchParams.delete('sslkey');parsed.searchParams.delete('uselibpqcompat');
 const pool=new pg.Pool({connectionString:parsed.toString(),max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,ssl:{rejectUnauthorized:true}});
 instance={query:(s,p)=>pool.query(s,p),transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const value=await fn(c);await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};return instance;
}
