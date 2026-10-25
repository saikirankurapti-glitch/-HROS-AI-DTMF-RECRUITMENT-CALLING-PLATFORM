import {ArrowDownToLine,BarChart3,CheckCircle2,Phone,Target,TrendingUp} from 'lucide-react';
import {COUNT,PERCENT,type Campaign} from '../lib/client';
import type {Workspace} from '../lib/useWorkspace';
import {Badge,Bars,Button,ChartEmpty,Metric,Panel} from '../components/ui';
export default function Analytics({work,onExport}:{work:Workspace;onExport:(id:number|undefined)=>void}){
 const a=work.aggregate, campaigns=work.bundles;
 const outcomes=[{name:'Interested',value:a.interested},{name:'Not interested',value:a.notInterested},{name:'No response',value:a.noResponse},{name:'Failed / busy / no answer',value:a.failed}];
 const hasOutcomes=outcomes.some(x=>x.value>0);
 return <>
  <section className="page-header"><div><div className="eyebrow">PERFORMANCE / REPORTING</div><h1>Analytics & Reports</h1><p>Operational performance based on saved call attempts. Retry attempts count separately.</p></div>
   <div className="header-actions"><Button icon={<ArrowDownToLine size={16}/>} onClick={()=>onExport(undefined)}>Export candidates</Button></div></section>
  <div className="stats-grid stats-grid-four">
   <Metric label="Calls attempted" value={COUNT(a.attempts)} detail="All campaign attempts" icon={<Phone size={18}/>}/>
   <Metric label="Answer rate" value={PERCENT(a.answered,a.attempts)+'%'} detail="Answered ÷ attempted" icon={<TrendingUp size={18}/>}/>
   <Metric label="Interested responses" value={COUNT(a.interested)} detail="DTMF 1 responses" icon={<CheckCircle2 size={18}/>} accent/>
   <Metric label="Interest rate" value={PERCENT(a.interested,a.answered)+'%'} detail="Interested ÷ answered" icon={<Target size={18}/>}/>
  </div>
  <div className="dashboard-two">
   <Panel title="Call outcome distribution" subtitle="Outcomes are taken from stored DTMF and failure fields">
    {hasOutcomes?<><div className="outcome-total"><strong>{COUNT(a.attempts)}</strong><span>dial attempts</span></div>
     <div className="outcome-segments">{outcomes.map((x,i)=><div className={'outcome-segment outcome-'+i} key={x.name} style={{width:x.value/Math.max(a.attempts,1)*100+'%'}} title={x.name+': '+x.value}/>)}</div>
     <div className="outcome-key">{outcomes.map((x,i)=><div key={x.name}><i className={'outcome-key-dot outcome-'+i}/><span>{x.name}</span><strong>{COUNT(x.value)}</strong></div>)}</div>
    </>:<ChartEmpty/>}
   </Panel>
   <Panel title="Campaign volume" subtitle="Total calling attempts per campaign">
    {a.attempts?<Bars data={campaigns.filter(x=>x.calls.length).slice(0,8).map(x=>({name:x.campaign.name,value:x.calls.length}))}/>:<ChartEmpty/>}
   </Panel>
  </div>
  <Panel title="Campaign reports" subtitle="Download a detailed XLSX export of the saved outcomes for each campaign" action={<span className="table-count">{work.campaigns.length} campaign(s)</span>}>
   {work.campaigns.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>Campaign</th><th>Status</th><th>Assigned</th><th>Attempts</th><th>Answered</th><th>Interested</th><th>Answer rate</th><th>Report</th></tr></thead>
    <tbody>{work.campaigns.map((c:Campaign)=>{
     const b=campaigns.find(x=>x.campaign.id===c.id);
     return <tr key={c.id}><td><strong>{c.name}</strong><span className="cell-meta">{c.job_role}</span></td><td><Badge value={c.status}/></td><td>{COUNT(b?.analytics.assigned)}</td><td>{COUNT(b?.analytics.total_calls)}</td><td>{COUNT(b?.analytics.answered)}</td><td>{COUNT(b?.analytics.interested)}</td><td>{PERCENT(b?.analytics.answered||0,b?.analytics.total_calls||0)}%</td><td><Button kind="ghost" icon={<ArrowDownToLine size={16}/>} onClick={()=>onExport(c.id)}>Excel</Button></td></tr>;
    })}</tbody></table></div>:<div className="chart-empty"><BarChart3 size={24}/> Reports become available after you create a campaign.</div>}
  </Panel>
  <p className="source-note">Source: HROS API /campaigns/:id/calls and /campaigns/:id/analytics. Simulated calls remain labeled as such in exported reports. These are not live-provider figures unless Asterisk calls have actually been verified.</p>
 </>;
}
