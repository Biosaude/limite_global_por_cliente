import {randomBytes,randomUUID,scrypt as rawScrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {hash} from './financial.js';
import {DomainError} from './repository.js';
import type {Database} from './db.js';
const scrypt=promisify(rawScrypt);
export async function passwordHash(password:string){if(password.length<14||password.length>256)throw new DomainError('PASSWORD_LENGTH_14_256');const salt=randomBytes(16).toString('hex');return `scrypt:${salt}:${(await scrypt(password,salt,64) as Buffer).toString('hex')}`;}
async function verify(password:string,stored:string){const [kind,salt,key]=stored.split(':');if(kind!=='scrypt'||!salt||!key)return false;const expected=Buffer.from(key,'hex'),actual=await scrypt(password,salt,64) as Buffer;return expected.length===actual.length&&timingSafeEqual(expected,actual);}
export type Identity={id:string;role:'admin'|'analyst'|'viewer';csrfHash:string};
export class Auth {
 constructor(private db:Database){}
 async login(email:string,password:string){
  const key=hash(email.toLowerCase());
  const limit=await this.db.query(`INSERT INTO lgc.login_attempts(key,attempts,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN lgc.login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE lgc.login_attempts.attempts+1 END, window_start=CASE WHEN lgc.login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE lgc.login_attempts.window_start END RETURNING attempts`,[key]);
  if(limit.rows[0].attempts>5)throw new DomainError('LOGIN_RATE_LIMIT',429);
  const user=(await this.db.query('SELECT id,password_hash,role,active FROM lgc.admin_users WHERE email=$1',[email.toLowerCase()])).rows[0];
  // Same expensive check for unknown identities, avoiding a cheap username oracle.
  const dummy='scrypt:00000000000000000000000000000000:'+('00'.repeat(64));
  const ok=await verify(password,user?.password_hash??dummy);if(!user||!ok||!user.active)throw new DomainError('INVALID_CREDENTIALS',401);
  const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');
  await this.db.transaction(async tx=>{await tx.query('INSERT INTO lgc.sessions(token_hash,csrf_hash,user_id,expires_at) VALUES($1,$2,$3,now()+interval \'8 hours\')',[hash(token),hash(csrf),user.id]);await tx.query('INSERT INTO lgc.operations(id,actor,action) VALUES($1,$2,$3)',[randomUUID(),user.id,'login']);});return {token,csrf,role:user.role};
 }
 async session(token:string):Promise<Identity|null>{if(!/^[a-f0-9]{64}$/.test(token))return null;const r=await this.db.query('SELECT u.id,u.role,s.csrf_hash AS "csrfHash" FROM lgc.sessions s JOIN lgc.admin_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[hash(token)]);return r.rows[0]??null;}
 csrf(identity:Identity,value:string){const actual=Buffer.from(hash(value)),expected=Buffer.from(identity.csrfHash);return actual.length===expected.length&&timingSafeEqual(actual,expected);}
 async logout(token:string){await this.db.query('DELETE FROM lgc.sessions WHERE token_hash=$1',[hash(token)]);}
}
