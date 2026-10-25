import type {ReactNode,ButtonHTMLAttributes} from 'react';
import {AlertTriangle,ArrowDown,ArrowUp,ChevronLeft,ChevronRight,FileQuestion,Search,X} from 'lucide-react';
import {COUNT,statusTone} from '../lib/client';

type ButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&{kind?:'primary'|'secondary'|'ghost'|'danger';icon?:ReactNode};
export function Button({kind='secondary',icon,children,className='',...props}:ButtonProps){
 return <button className={'button button-'+kind+' '+className} {...props}>{icon}{children}</button>;
}
export function Badge({value,tone}:{value:string;tone?:'success'|'warning'|'danger'|'neutral'|'info'}){
 return <span className={'badge badge-'+(tone??statusTone(value))}><span className="badge-dot"/>{value.replaceAll('_',' ')}</span>;
}
export function Panel({title,subtitle,action,children,className=''}:{title:string;subtitle?:string;action?:ReactNode;children:ReactNode;className?:string}){
 return <section className={'panel '+className}><div className="panel-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action&&<div className="panel-action">{action}</div>}</div>{children}</section>;
}
export function Empty({title,description,action}:{title:string;description:string;action?:ReactNode}){
 return <div className="empty"><div className="empty-mark"><FileQuestion size={22}/></div><strong>{title}</strong><p>{description}</p>{action}</div>;
}
export function Loading({label='Loading workspace data...'}:{label?:string}){
 return <div className="loading-view" role="status" aria-live="polite"><div className="spinner"/>{label}</div>;
}
export function SearchBox({value,onChange,placeholder='Search',label='Search records'}:{value:string;onChange:(s:string)=>void;placeholder?:string;label?:string}){
 return <label className="searchbox"><Search size={17}/><input aria-label={label} type="search" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>;
}
export function Pager({page,pageSize,total,onChange}:{page:number;pageSize:number;total:number;onChange:(n:number)=>void}){
 const max=Math.max(1,Math.ceil(total/pageSize));
 return <div className="pager"><span>{total===0?'No records':COUNT((page-1)*pageSize+1)+'–'+COUNT(Math.min(total,page*pageSize))+' of '+COUNT(total)}</span>
  <div><button aria-label="Previous page" onClick={()=>onChange(Math.max(1,page-1))} disabled={page===1}><ChevronLeft size={16}/></button>
  <span>Page {page} of {max}</span>
  <button aria-label="Next page" onClick={()=>onChange(Math.min(max,page+1))} disabled={page>=max}><ChevronRight size={16}/></button></div>
 </div>;
}
export function SortHeading({label,field,sort,onChange}:{label:string;field:string;sort:string;onChange:(field:string)=>void}){
 return <button className="sort-link" onClick={()=>onChange(field)} title={'Sort by '+label}>{label}{sort===field?<ArrowUp size={13}/>:sort==='-'+field?<ArrowDown size={13}/>:null}</button>;
}
export function Dialog({title,description,children,onClose,action,label='Confirm',danger=false,busy=false}:{title:string;description?:string;children?:ReactNode;onClose:()=>void;action:()=>void;label?:string;danger?:boolean;busy?:boolean}){
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="modal card-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-heading">
   <div className="dialog-top"><div className={'dialog-icon '+(danger?'dialog-icon-danger':'')}><AlertTriangle size={21}/></div><button aria-label="Close dialog" className="icon-button" onClick={onClose}><X size={19}/></button></div>
   <h2 id="dialog-heading">{title}</h2>{description&&<p className="dialog-description">{description}</p>}
   {children}
   <div className="dialog-actions"><Button onClick={onClose} disabled={busy}>Back</Button><Button kind={danger?'danger':'primary'} onClick={action} disabled={busy}>{busy?'Processing...':label}</Button></div>
  </div>
 </div>;
}
export function Drawer({title,subtitle,onClose,children}:{title:string;subtitle?:string;onClose:()=>void;children:ReactNode}){
 return <div className="drawer-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
   <div className="drawer-header"><div><span className="eyebrow">RECORD DETAIL</span><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-button" aria-label="Close details" onClick={onClose}><X size={20}/></button></div>
   <div className="drawer-content">{children}</div>
  </aside>
 </div>;
}
export function Metric({label,value,detail,icon,accent=false}:{label:string;value:string|number;detail:string;icon:ReactNode;accent?:boolean}){
 return <article className={'metric '+(accent?'metric-featured':'')}><div className="metric-head"><span>{label}</span><span className="metric-symbol">{icon}</span></div>
  <div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></article>;
}
export function ChartEmpty(){return <div className="chart-empty">No call data yet. Metrics appear once attempts are recorded.</div>;}
export function Bars({data,max,compact=false}:{data:{name:string;value:number;secondary?:number}[];max?:number;compact?:boolean}){
 const limit=max??Math.max(1,...data.map(x=>x.value));
 return <div className={'bar-chart '+(compact?'bar-chart-compact':'')}>
  {data.map((d,i)=><div className="bar-row" key={d.name+'-'+i}><span title={d.name}>{d.name}</span><div className="bar-track"><div className="bar-fill" style={{width:(d.value/Math.max(1,limit)*100)+'%'}}/></div><strong>{COUNT(d.value)}</strong></div>)}
 </div>;
}
