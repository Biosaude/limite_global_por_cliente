import {randomUUID} from 'node:crypto';
import {database} from '../server/db.js';
import {passwordHash} from '../server/auth.js';
const email=process.env.ADMIN_EMAIL?.toLowerCase(),password=process.env.ADMIN_PASSWORD;
if(!email||!password)throw Error('Configure ADMIN_EMAIL e ADMIN_PASSWORD de forma segura.');
await database().query('INSERT INTO lgc.admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[randomUUID(),email,await passwordHash(password),'admin']);
console.log('Administrador criado. Nenhuma credencial foi registrada.');process.exit(0);
