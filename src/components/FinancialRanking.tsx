type Row={id:string;name:string;upcoming:string;overdue:string;received:string;global:string;titles:number};
const brl=(value:string)=>'R$ '+value.replace(/\B(?=(\d{3})+(?!\d))/g,'.').replace(/\.(\d{2})$/,',$1');
export function FinancialRanking({title,dimension,rows}:{title:string;dimension:string;rows:Row[]}){
 return <section className="panel"><h2>{title}</h2><div className="table-scroll"><table><thead><tr><th>{dimension}</th><th>A Vencer</th><th>Vencido</th><th>Recebido YTD</th><th>Limite Global</th><th>Títulos</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.name}</td><td>{brl(row.upcoming)}</td><td>{brl(row.overdue)}</td><td>{brl(row.received)}</td><td>{brl(row.global)}</td><td>{row.titles}</td></tr>)}</tbody></table></div></section>;
}
