import {ArrowRight,ArrowUpRight,CheckCheck,Download,PhoneCall,Plus,RadioTower,Target,Upload,UsersRound} from 'lucide-react';
import {COUNT,PERCENT,dateLabel,maskPhone,type Page} from '../lib/client';
import type {Workspace} from '../lib/useWorkspace';
import {Badge,Bars,Button,ChartEmpty,Empty,Metric,Panel} from '../components/ui';
export default function Overview({work,onPage,onCampaign}:{work:Workspace;onPage:(p:Page)=>void;onCampaign:(id:number)=>void}){
 const {aggregate:a,campaigns,candidates,calls,bundles}=work;
 const running=campaigns.filter(c=>c.status==='RUNNING').length;
 const sorted=[...bundles].sort((x,y)=>y.analytics.total_calls-x.analytics.total_calls);
 const distribution=['RUNNING','SCHEDULED','DRAFT','PAUSED','COMPLETED','CANCELLED'].map(s=>({status:s,count:campaigns.filter(c=>c.status===s).length})).filter(s=>s.count);
 const latest=calls.slice(0,6);
 const volume=sorted.slice(0,5).map(x=>({name:x.campaign.name,value:x.analytics.total_calls}));
 return <>
  <section className="page-header"><div><div className="eyebrow">WORKSPACE / OPERATIONS</div><h1>Recruitment overview</h1><p>One place to track every candidate, calling campaign, and screening outcome.</p></div>
   <div className="header-actions"><Button icon={<Upload size={16}/>} onClick={()=>onPage('candidates')}>Import candidates</Button><Button kind="primary" icon={<Plus size={17}/>} onClick={()=>onPage('campaigns')}>New campaign</Button></div></section>
  <div className="welcome-strip"><div className="welcome-orb"><RadioTower size={21}/></div><div><strong>Calling operations at a glance</strong><span>{work.system?.simulated===false?'Asterisk mode selected. Verify your provider before real calls.':'Simulation mode is enabled. All calls are mock unless a live provider is explicitly configured.'}</span></div><button onClick={()=>onPage('telephony')}>View environment <ArrowUpRight size={15}/></button></div>
  <div className="stats-grid">
   <Metric label="Total candidates" value={COUNT(candidates.length)} detail="Candidate directory records" icon={<UsersRound size={19}/>}/>
   <Metric label="Active campaigns" value={COUNT(running)} detail={COUNT(campaigns.length)+' campaigns in total'} icon={<Target size={19}/>}/>
   <Metric label="Calls attempted" value={COUNT(a.attempts)} detail="All recorded dialing attempts" icon={<PhoneCall size={19}/>}/>
   <Metric label="Answered calls" value={COUNT(a.answered)} detail="Provider-confirmed answers" icon={<CheckCheck size={19}/>}/>
   <Metric label="Interested candidates" value={COUNT(a.interested)} detail="DTMF 1 responses" icon={<ArrowUpRight size={19}/>} accent/>
   <Metric label="Answer rate" value={PERCENT(a.answered,a.attempts)+'%'} detail="Answered ÷ calls attempted" icon={<RadioTower size={19}/>}/>
  </div>
  <div className="dashboard-two">
   <Panel title="Calling activity" subtitle="Total attempts by campaign · actual stored records" action={<button className="plain-link" onClick={()=>onPage('analytics')}>Full analytics <ArrowRight size={16}/></button>}>
    {volume.length&&a.attempts?<Bars data={volume}/>:<ChartEmpty/>}
    <div className="chart-footnote"><span className="legend-dot"/> Attempted calls · Counts include retries</div>
   </Panel>
   <Panel title="Campaign status" subtitle="Distribution across all created campaigns">
    {campaigns.length?<><div className="distribution-big"><strong>{COUNT(campaigns.length)}</strong><span>total campaigns</span></div>
     <div className="distribution-track">{distribution.map(x=><div key={x.status} className={'dist-segment dist-'+x.status.toLowerCase()} style={{width:x.count/campaigns.length*100+'%'}} title={x.status+': '+x.count}/>)}</div>
     <div className="dist-list">{distribution.map(x=><div key={x.status}><Badge value={x.status}/><strong>{x.count}</strong></div>)}</div></>:<Empty title="No campaigns yet" description="Create a recruitment campaign to see operational status here." action={<Button onClick={()=>onPage('campaigns')}>Create campaign</Button>}/>}
   </Panel>
  </div>
  <div className="dashboard-two">
   <Panel title="Recent calls" subtitle="Latest recorded attempts across your campaigns" action={<button className="plain-link" onClick={()=>onPage('history')}>Call history <ArrowRight size={16}/></button>}>
    {latest.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>Candidate</th><th>Campaign</th><th>Result</th><th>When</th></tr></thead><tbody>{latest.map(c=><tr key={c.id}><td><strong>{c.name??'Candidate #'+c.candidate_id}</strong><span className="cell-meta">{maskPhone(c.phone)}</span></td><td>{campaigns.find(k=>k.id===c.campaign_id)?.name??'#'+c.campaign_id}</td><td><Badge value={c.dtmf_response||c.status}/></td><td><span className="small-muted">{dateLabel(c.started_at)}</span></td></tr>)}</tbody></table></div>
    :<Empty title="No calls recorded" description="Start a mock campaign to create your first calling history."/>}
   </Panel>
   <Panel title="Latest campaigns" subtitle="Select a campaign to review its performance" action={<button className="plain-link" onClick={()=>onPage('campaigns')}>All campaigns <ArrowRight size={16}/></button>}>
    {campaigns.length?<div className="compact-campaigns">{campaigns.slice(0,5).map(c=><button className="compact-campaign" key={c.id} onClick={()=>{onCampaign(c.id);onPage('campaigns');}}><span className="campaign-letter">{c.name[0]?.toUpperCase()||'C'}</span><span className="campaign-copy"><strong>{c.name}</strong><small>{c.job_role} · #{c.id}</small></span><Badge value={c.status}/><ArrowRight size={15}/></button>)}</div>
    :<Empty title="Start with a campaign" description="Import consented candidates, then create and run a safe mock campaign." action={<Button icon={<Plus size={15}/>} onClick={()=>onPage('campaigns')}>New campaign</Button>}/>}
    {campaigns.length>0&&<div className="panel-footer-note"><Download size={15}/> Download campaign reports from Analytics & Reports.</div>}
   </Panel>
  </div>
 </>;
}
