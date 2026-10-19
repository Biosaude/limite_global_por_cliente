import {basename} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {parseWorkbook,reconciliation} from '../server/import.js';
const [file,reference,out]=process.argv.slice(2);if(!file||!reference)throw Error('Uso: npm run audit:official -- arquivo.xlsx AAAA-MM-DD [saida.json]');
const ds=await parseWorkbook(await readFile(file),reference,undefined,basename(file));const report=reconciliation(ds);
if(out)await writeFile(out,JSON.stringify(report,null,2),{mode:0o600});
console.log(JSON.stringify({sha256:ds.sha256,referenceDate:ds.referenceDate,records:ds.sourceRecords,rawTotals:report.rawTotals,provisional:report.provisional,blocking:ds.issues.filter(i=>i.severity==='blocking').length,issues:ds.issues.reduce((a,x)=>({...a,[x.code]:(a[x.code]??0)+1}),{} as Record<string,number>)},null,2));
