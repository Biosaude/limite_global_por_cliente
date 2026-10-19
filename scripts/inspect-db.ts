import {database} from '../server/db.js';
const result=await database().query(`SELECT table_schema,table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema IN ('public','lgc') ORDER BY table_schema,table_name,ordinal_position`);
console.log(JSON.stringify(result.rows,null,2));process.exit(0);
