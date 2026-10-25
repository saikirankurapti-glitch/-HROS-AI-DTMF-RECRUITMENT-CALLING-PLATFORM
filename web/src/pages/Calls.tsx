import {useMemo,useState} from 'react';
import {Activity,ArrowDownToLine,Clock3,Info,PhoneCall,RefreshCw,RotateCcw,ShieldCheck,SquareStack} from 'lucide-react';
import {api,COUNT,dateLabel,maskPhone,NONTERMINAL,type Call} from '../lib/client';
import type {Workspace} from '../lib/useWorkspace';
import {Badge,Button,Dialog,Drawer,Empty,Metric,Pager,Panel,SearchBox} from '../components/ui';

export function Monitor({work,onRefresh}:{work:Workspace;onRefresh:()=>Promise<void>}){
 const active=work.calls.filter(c=>NONTERMINAL.includes(c.status));
 const recently=work.calls.slice(0,10);
 return <>
  <section className="page-header"><div><div className="eyebrow">CALL OPERATIONS / MONITOR</div><h1>Live Calls</h1><p>Polling-based visibility into the call states currently stored by the backend.</p></div>
   <div className="header-actions"><Button icon={<RefreshCw size={16}/>} onClick={()=>void onRefresh()}>Refresh now</Button></div></section>
  <div className="inline-info"><Info size={17}/><span>Data refreshes approximately every 12 seconds. This is not a streaming, real-time telephony monitor. Mock records are simulations.</span></div>
  <div className="stats-grid stats-grid-four">
   <Metric label="Active call attempts" value={COUNT(active.length)} detail="Stored in-progress states" icon={<PhoneCall size={18}/>}/>
   <Metric label="Engine activity" value={COUNT(work.system?.activeCalls)} detail="Current scheduler count" icon={<Activity size={18}/>}/>
   <Metric label="Simulated attempts" value={COUNT(work.aggregate.simulated)} detail="Clearly marked mock calls" icon={<ShieldCheck size={18}/>}/>
   <Metric label="Completed attempts" value={COUNT(work.calls.filter(c=>c.ended_at).length)} detail="With an end timestamp" icon={<Clock3 size={18}/>}/>
  </div>
  <Panel title="Active calls" subtitle="Currently in-progress records from all campaigns" action={<span className="table-count">{active.length} active</span>}>
   {active.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>Candidate</th><th>Campaign</th><th>Call status</th><th>Provider</th><th>Started</th></tr></thead><tbody>{active.map(c=><tr key={c.id}><td><strong>{c.name??'Candidate #'+c.candidate_id}</strong><span className="cell-meta">{maskPhone(c.phone)}</span></td><td>{work.campaigns.find(k=>k.id===c.campaign_id)?.name??'#'+c.campaign_id}</td><td><Badge value={c.status}/></td><td><Badge value={c.simulated?'SIMULATED':c.provider.toUpperCase()} tone={c.simulated?'info':'warning'}/></td><td>{dateLabel(c.started_at)}</td></tr>)}</tbody></table></div>
   :<Empty title="No calls in progress" description="The scheduler is idle or calls completed between refreshes. Review the recent activity below."/>}
  </Panel>
  <Panel title="Latest call activity" subtitle="Most recently created attempts, including errors and outcomes">
   {recently.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>Attempt</th><th>Candidate</th><th>Status</th><th>DTMF result</th><th>Provider</th><th>Time</th></tr></thead><tbody>{recently.map(c=><tr key={c.id}><td>#{c.id}</td><td>{c.name??c.candidate_id}</td><td><Badge value={c.status}/></td><td>{c.dtmf_response?<Badge value={c.dtmf_response}/>:<span className="small-muted">—</span>}</td><td>{c.simulated?'Simulated':c.provider}</td><td>{dateLabel(c.started_at)}</td></tr>)}</tbody></table></div>
   :<Empty title="No calling activity yet" description="Campaign attempts will appear here when they are recorded."/>}
  </Panel>
 </>;
}

export function History({work,token,onRefresh,onMessage,onError,onExport}:{work:Workspace;token:string;onRefresh:()=>Promise<void>;onMessage:(s:string)=>void;onError:(s:string)=>void;onExport:(id:number)=>void}){
 const [query,setQuery]=useState(''),[campaign,setCampaign]=useState('all'),[status,setStatus]=useState('all'),[outcome,setOutcome]=useState('all'),[page,setPage]=useState(1);
 const [selected,setSelected]=useState<Call|null>(null),[retryTarget,setRetryTarget]=useState<Call|null>(null),[busy,setBusy]=useState(false);
 const filtered=useMemo(()=>work.calls.filter(c=>(campaign==='all'||String(c.campaign_id)===campaign)&&
  (status==='all'||c.status===status)&&(outcome==='all'||c.dtmf_response===outcome)&&
  (!query||[c.name,c.phone,c.email,c.provider_call_id,String(c.id)].some(v=>String(v??'').toLowerCase().includes(query.toLowerCase())))
 ),[work.calls,campaign,status,outcome,query]);
 const shown=filtered.slice((page-1)*12,page*12);
 const canRetry=(c:Call)=>['FAILED','BUSY','NO_ANSWER'].includes(c.status)&&(
  work.byCampaign(c.campaign_id)?.campaign.retry_limit??0)>=c.attempt_number &&
  !work.candidates.find(p=>p.id===c.candidate_id)?.opt_out &&
  work.byCampaign(c.campaign_id)?.campaign.status!=='CANCELLED';
 async function retry(){
  if(!retryTarget)return;setBusy(true);
  try{await api('/calls/'+retryTarget.id+'/retry',token,{method:'POST'});onMessage('Retry requested. Scheduling and consent rules still apply.');setRetryTarget(null);setSelected(null);await onRefresh();}
  catch(e){onError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 return <>
  <section className="page-header"><div><div className="eyebrow">OPERATION HISTORY</div><h1>Call History</h1><p>Auditable call attempts with recorded DTMF responses, duration, and provider IDs.</p></div>
   <div className="header-actions"><Button icon={<ArrowDownToLine size={16}/>} disabled={!work.campaigns.length} onClick={()=>onExport(work.campaigns[0].id)}>Export latest campaign</Button></div></section>
  <Panel title="All call records" subtitle="Filter across stored campaign attempts" action={<span className="table-count">{filtered.length} records</span>}>
   <div className="table-tools">
    <SearchBox label="Search call records" value={query} onChange={v=>{setQuery(v);setPage(1);}} placeholder="Candidate, phone, call ID..."/>
    <label className="filter-select">Campaign<select aria-label="Filter calls by campaign" value={campaign} onChange={e=>{setCampaign(e.target.value);setPage(1);}}><option value="all">All campaigns</option>{work.campaigns.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
    <label className="filter-select">Status<select aria-label="Filter calls by status" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="all">All statuses</option>{[...new Set(work.calls.map(c=>c.status))].map(s=><option key={s}>{s}</option>)}</select></label>
    <label className="filter-select">DTMF<select aria-label="Filter calls by outcome" value={outcome} onChange={e=>{setOutcome(e.target.value);setPage(1);}}><option value="all">All outcomes</option>{['INTERESTED','NOT_INTERESTED','NO_RESPONSE'].map(s=><option key={s}>{s}</option>)}</select></label>
   </div>
   {shown.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>ID</th><th>Candidate</th><th>Campaign</th><th>Status</th><th>DTMF response</th><th>Duration</th><th>Mode</th><th>Details</th></tr></thead><tbody>{shown.map(c=><tr key={c.id}>
    <td className="mono">#{c.id}</td><td><strong>{c.name??'Candidate #'+c.candidate_id}</strong><span className="cell-meta">{maskPhone(c.phone)}</span></td>
    <td>{work.campaigns.find(x=>x.id===c.campaign_id)?.name??'Campaign #'+c.campaign_id}</td><td><Badge value={c.status}/></td>
    <td>{c.dtmf_response?<Badge value={c.dtmf_response}/>:<span className="small-muted">—</span>}</td><td>{c.duration_seconds??'—'}{c.duration_seconds!==null?' sec':''}</td>
    <td><Badge value={c.simulated?'SIMULATED':c.provider.toUpperCase()} tone={c.simulated?'info':'warning'}/></td>
    <td><button className="table-link" onClick={()=>setSelected(c)}>View <SquareStack size={14}/></button></td>
   </tr>)}</tbody></table></div>:<Empty title={work.calls.length?'No matching call records':'No call history yet'} description={work.calls.length?'Adjust your search and filters.':'Start a mock campaign to see individual call attempts here.'}/>}
   <Pager page={page} pageSize={12} total={filtered.length} onChange={setPage}/>
  </Panel>
  {selected&&<Drawer title={'Call #'+selected.id} subtitle={'Campaign '+selected.campaign_id+' · Candidate '+selected.candidate_id} onClose={()=>setSelected(null)}>
   <div className="detail-list">
    <div><span>Status</span><Badge value={selected.status}/></div><div><span>DTMF response</span><strong>{selected.dtmf_response??'—'}</strong></div>
    <div><span>Provider</span><strong>{selected.provider}{selected.simulated?' (simulated)':''}</strong></div><div><span>Provider call ID</span><strong className="break-all">{selected.provider_call_id??'—'}</strong></div>
    <div><span>Attempt</span><strong>#{selected.attempt_number}</strong></div><div><span>Started</span><strong>{dateLabel(selected.started_at)}</strong></div>
    <div><span>Answered</span><strong>{dateLabel(selected.answered_at)}</strong></div><div><span>Ended</span><strong>{dateLabel(selected.ended_at)}</strong></div>
    <div><span>Duration</span><strong>{selected.duration_seconds??'—'} seconds</strong></div><div><span>Failure reason</span><strong>{selected.error_message??'—'}</strong></div>
   </div>
   {canRetry(selected)&&<div className="drawer-actions"><Button icon={<RotateCcw size={16}/>} onClick={()=>setRetryTarget(selected)}>Request retry</Button></div>}
  </Drawer>}
  {retryTarget&&<Dialog title="Retry this call attempt?" description="The backend checks that this attempt is the latest, respects retry limits and enforces candidate opt-outs before scheduling." label="Confirm retry" busy={busy} onClose={()=>setRetryTarget(null)} action={()=>void retry()}>
   <div className="confirmation-context"><strong>Call #{retryTarget.id}</strong><span>{retryTarget.status} · Attempt #{retryTarget.attempt_number}</span></div>
  </Dialog>}
 </>;
}
