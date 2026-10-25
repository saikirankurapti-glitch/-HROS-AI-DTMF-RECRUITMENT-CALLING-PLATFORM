import {useMemo,useState,type FormEvent} from 'react';
import {ArrowDownToLine,ArrowRight,CalendarClock,CheckCircle2,Clock,Pause,PhoneCall,Play,Plus,ShieldCheck,Square,Target,UsersRound} from 'lucide-react';
import {api,COMPLETE,COUNT,dateLabel,PERCENT,maskPhone,type Campaign} from '../lib/client';
import type {Workspace} from '../lib/useWorkspace';
import {Badge,Button,Dialog,Empty,Panel,SearchBox} from '../components/ui';

type CampaignAction='start'|'pause'|'resume'|'cancel';
export default function Campaigns({work,token,selectedId,onSelect,onRefresh,onMessage,onError,onExport}:{work:Workspace;token:string;selectedId:number|null;onSelect:(id:number)=>void;onRefresh:()=>Promise<void>;onMessage:(s:string)=>void;onError:(s:string)=>void;onExport:(id:number)=>void}){
 const [name,setName]=useState(''),[role,setRole]=useState(''),[language,setLanguage]=useState('en'),[retry,setRetry]=useState(1),[scheduled,setScheduled]=useState('');
 const [query,setQuery]=useState(''),[statusFilter,setStatusFilter]=useState('all'),[busy,setBusy]=useState(false);
 const [confirm,setConfirm]=useState<{campaign:Campaign;action:CampaignAction}|null>(null);
 const current=work.campaigns.find(c=>c.id===selectedId)??work.campaigns[0];
 const currentBundle=current?work.byCampaign(current.id):undefined;
 const stats=currentBundle?.analytics, calls=currentBundle?.calls??[];
 const roleChoices=[...new Set(work.candidates.map(c=>c.role))].sort();
 const assignedEligible=work.candidates.filter(c=>c.consent===1&&!c.opt_out&&c.role.toLowerCase()===role.trim().toLowerCase()).length;
 const list=useMemo(()=>work.campaigns.filter(c=>(c.name+' '+c.job_role).toLowerCase().includes(query.toLowerCase())&&(statusFilter==='all'||c.status===statusFilter)),[work.campaigns,query,statusFilter]);
 const lastCalls=[...calls].sort((a,b)=>b.id-a.id).slice(0,7);
 const completedCandidates=new Set(calls.filter(c=>COMPLETE.includes(c.status)).map(c=>c.candidate_id)).size;
 const percent=PERCENT(Math.min(completedCandidates,stats?.assigned||0),stats?.assigned||0);
 async function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);
  try{
   const c=await api<Campaign>('/campaigns',token,{method:'POST',body:JSON.stringify({
    name:name.trim(),job_role:role.trim(),language,retry_limit:retry,scheduled_at:scheduled?new Date(scheduled).toISOString():null
   })});
   onSelect(c.id);setName('');setRole('');setScheduled('');onMessage('Campaign created. Review assigned candidates before starting.');await onRefresh();
  }catch(e){onError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 async function runAction(){
  if(!confirm)return;setBusy(true);
  try{
   await api('/campaigns/'+confirm.campaign.id+'/'+confirm.action,token,{method:'PATCH'});
   onMessage('Campaign '+confirm.action+' completed.');setConfirm(null);await onRefresh();
  }catch(e){onError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 const dialogText:Record<CampaignAction,{title:string;description:string;label:string}>={
  start:{title:'Start this calling campaign?',description:work.system?.simulated===false?'This action starts Asterisk calls using the server configuration. Ensure every destination is authorized before continuing.':'This starts mock calling for assigned candidates. No public telephone calls will be placed.',label:'Confirm start'},
  pause:{title:'Pause campaign?',description:'The scheduler stops creating new calls. Any in-flight calls may finish normally.',label:'Confirm pause'},
  resume:{title:'Resume calling?',description:'The scheduler will continue eligible candidates according to retry limits and consent checks.',label:'Confirm resume'},
  cancel:{title:'Cancel this campaign?',description:'The campaign will be marked cancelled and active calls will be ended. This cannot be reversed.',label:'Cancel campaign'}
 };
 return <>
  <section className="page-header"><div><div className="eyebrow">CAMPAIGN OPERATIONS</div><h1>Campaign management</h1><p>Create role-based screening campaigns and manage their calling lifecycle.</p></div><div className="header-actions"><span className="context-count">{work.campaigns.length} campaigns</span></div></section>
  <div className="campaign-page-grid">
   <section className="campaign-left">
    <Panel title="Your campaigns" subtitle="Select a campaign to manage" action={<span className="table-count">{list.length} shown</span>}>
     <div className="list-tools"><SearchBox label="Search campaigns" value={query} onChange={setQuery} placeholder="Search campaigns..."/><select aria-label="Filter campaign status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>{['DRAFT','SCHEDULED','RUNNING','PAUSED','COMPLETED','CANCELLED'].map(s=><option key={s}>{s}</option>)}</select></div>
     {list.length?<div className="campaign-rows">{list.map(c=>{
      const b=work.byCampaign(c.id),chosen=current?.id===c.id;
      return <button key={c.id} className={'campaign-row '+(chosen?'selected':'')} onClick={()=>onSelect(c.id)}><div className="campaign-icon"><Target size={18}/></div><span className="campaign-row-info"><strong>{c.name}</strong><small>{c.job_role}</small><small>{COUNT(b?.analytics.assigned)} assigned · {COUNT(b?.analytics.total_calls)} calls</small></span><span className="campaign-row-right"><Badge value={c.status}/><ArrowRight size={15}/></span></button>;
     })}</div>:<Empty title={work.campaigns.length?'No matching campaigns':'No campaigns yet'} description={work.campaigns.length?'Adjust the campaign filters.':'Complete the creation form to begin.'}/>}
    </Panel>
    <Panel title="Create campaign" subtitle="A guided, role-targeted calling setup">
     <form className="form-grid" onSubmit={e=>void create(e)}>
      <label>Campaign name<input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={120} required placeholder="October — Engineer screening"/></label>
      <label>Job role<input value={role} onChange={e=>setRole(e.target.value)} list="hros-roles" required minLength={2} placeholder="Data Engineer"/><datalist id="hros-roles">{roleChoices.map(x=><option key={x} value={x}/>)}</datalist><small className="field-help">Candidates are selected by an exact, case-insensitive role match.</small></label>
      <div className="form-pair"><label>Language<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="en">English</option><option value="hi">Hindi — custom audio required</option><option value="te">Telugu — custom audio required</option></select></label><label>Retry limit<select value={retry} onChange={e=>setRetry(Number(e.target.value))}>{[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n} retries</option>)}</select></label></div>
      <label>Schedule (optional)<input aria-label="Schedule campaign" type="datetime-local" value={scheduled} onChange={e=>setScheduled(e.target.value)}/><small className="field-help">Leave empty to create a draft for review.</small></label>
      <div className="target-summary"><UsersRound size={17}/><span><strong>{COUNT(assignedEligible)}</strong> currently eligible candidates match {role.trim()?('"'+role.trim()+'"'):'the selected role'}</span></div>
      <div className="form-submit"><Button kind="primary" icon={<Plus size={16}/>} type="submit" disabled={busy}>{busy?'Creating...':'Create campaign'}</Button></div>
     </form>
    </Panel>
   </section>
   <section className="campaign-right">
    {current?<><Panel title="Campaign detail" subtitle={'Created '+dateLabel(current.created_at)} action={<Badge value={current.status}/>}>
      <div className="detail-hero"><div className="detail-hero-icon"><PhoneCall size={23}/></div><div><h3>{current.name}</h3><p>{current.job_role} · Campaign #{current.id}</p></div></div>
      <div className="campaign-facts"><div><span>Targeted candidates</span><strong>{COUNT(stats?.assigned)}</strong></div><div><span>Call attempts</span><strong>{COUNT(stats?.total_calls)}</strong></div><div><span>Interested</span><strong>{COUNT(stats?.interested)}</strong></div><div><span>Answer rate</span><strong>{PERCENT(stats?.answered||0,stats?.total_calls||0)}%</strong></div></div>
      <div className="progress-header"><span>Contacted candidates <small>(including failures)</small></span><strong>{Math.min(completedCandidates,stats?.assigned??0)} / {COUNT(stats?.assigned)}</strong></div>
      <div className="progress-track"><div style={{width:percent+'%'}}/></div>
      <div className="campaign-config"><span><CalendarClock size={15}/> {current.scheduled_at?'Scheduled '+dateLabel(current.scheduled_at):'Not scheduled'}</span><span><ShieldCheck size={15}/> {current.retry_limit} retries</span><span><Clock size={15}/> {current.language.toUpperCase()}</span></div>
      <div className="campaign-buttons">
       {['DRAFT','SCHEDULED'].includes(current.status)&&<Button kind="primary" icon={<Play size={16}/>} onClick={()=>setConfirm({campaign:current,action:'start'})}>{work.system?.simulated===false?'Start calls':'Start mock calls'}</Button>}
       {current.status==='RUNNING'&&<Button icon={<Pause size={16}/>} onClick={()=>setConfirm({campaign:current,action:'pause'})}>Pause campaign</Button>}
       {current.status==='PAUSED'&&<Button kind="primary" icon={<Play size={16}/>} onClick={()=>setConfirm({campaign:current,action:'resume'})}>Resume campaign</Button>}
       {!['COMPLETED','CANCELLED'].includes(current.status)&&<Button kind="danger" icon={<Square size={15}/>} onClick={()=>setConfirm({campaign:current,action:'cancel'})}>Cancel</Button>}
       <Button icon={<ArrowDownToLine size={16}/>} onClick={()=>onExport(current.id)}>Export calls</Button>
      </div>
      {current.status==='DRAFT'&&<div className="safe-note"><ShieldCheck size={17}/><span>Review the assigned count and candidate consent before starting. The API re-checks opt-outs and rate limits.</span></div>}
     </Panel>
     <Panel title="Latest attempts" subtitle="Saved call results for the selected campaign" action={<span className="table-count">{calls.length} attempts</span>}>
      {lastCalls.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>Candidate</th><th>Status</th><th>DTMF outcome</th><th>Attempt</th></tr></thead><tbody>{lastCalls.map(c=><tr key={c.id}><td><strong>{c.name??'Candidate #'+c.candidate_id}</strong><span className="cell-meta">{maskPhone(c.phone)}</span></td><td><Badge value={c.status}/></td><td>{c.dtmf_response?<Badge value={c.dtmf_response}/>:<span className="small-muted">—</span>}</td><td>#{c.attempt_number}</td></tr>)}</tbody></table></div>
      :<Empty title="No attempts recorded" description="Start or schedule this campaign to see real stored outcomes."/>}
     </Panel>
    </>:<Panel title="Campaign detail"><Empty title="No campaign selected" description="Create or select a campaign to inspect its calling progress."/></Panel>}
   </section>
  </div>
  {confirm&&<Dialog title={dialogText[confirm.action].title} description={dialogText[confirm.action].description} label={dialogText[confirm.action].label} busy={busy} danger={confirm.action==='cancel'} onClose={()=>setConfirm(null)} action={()=>void runAction()}>
   <div className="confirmation-context"><strong>{confirm.campaign.name}</strong><span>{confirm.campaign.job_role} · {COUNT(work.byCampaign(confirm.campaign.id)?.analytics.assigned)} assigned</span></div>
  </Dialog>}
 </>;
}
