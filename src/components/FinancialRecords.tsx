import type {Repository} from '../../server/repository';
type Page=NonNullable<Awaited<ReturnType<Repository['records']>>>;
const brl=(value:string)=>'R$ '+value.replace(/\B(?=(\d{3})+(?!\d))/g,'.').replace(/\.(\d{2})$/,',$1');
const civil=(value:string|null)=>value?value.split('-').reverse().join('/'):'—';
const bands={upcoming:'A Vencer',overdue:'Vencido',received:'Recebido'};
export function FinancialRecords({data,onPage}:{data:Page;onPage:(page:number)=>void}){
 return <details className="panel record-details"><summary>Detalhamento financeiro • {data.total.toLocaleString('pt-BR')} registros</summary><div className="table-scroll"><table><thead><tr><th>Cliente</th><th>Título</th><th>Parcela</th><th>Faixa</th><th>Emissão</th><th>Vencimento</th><th>Recebimento</th><th>Representante</th><th>Valor</th><th>Aba de origem</th><th>Linha</th></tr></thead><tbody>{data.records.map(r=><tr key={`${r.sheet}:${r.row}`}><td>{r.client}</td><td>{r.title}</td><td>{r.installment}</td><td>{bands[r.band]}</td><td>{civil(r.issued)}</td><td>{civil(r.due)}</td><td>{civil(r.received)}</td><td>{r.representative}</td><td>{brl(r.amount)}</td><td>{r.sheet}</td><td>{r.row}</td></tr>)}</tbody></table></div><div className="pagination"><span>Página {data.page} de {Math.max(1,Math.ceil(data.total/data.pageSize))}</span><div><button disabled={data.page<=1} onClick={()=>onPage(data.page-1)}>Anterior</button><button disabled={data.page*data.pageSize>=data.total} onClick={()=>onPage(data.page+1)}>Próxima</button></div></div></details>;
}
