import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {Activity,ArrowDownToLine,Ban,BriefcaseBusiness,CalendarClock,CheckCircle2,ChevronRight,FileSpreadsheet,LayoutDashboard,LogOut,Pause,Phone,Play,RefreshCw,ShieldCheck,UploadCloud,Users,XCircle} from 'lucide-react';

type Candidate={id:number;name:string;phone:string;email:string;role:string;scenario:string;consent:number;opt_out:number};
type Campaign={id:number;name:string;job_role:string;language:string;status:string;retry_limit:number;scheduled_at:string|null;assigned?:number};
type Call={id:number;name:string;phone:string;status:string;dtmf_response:string|null;attempt_number:number;duration_seconds:number|null;simulated:number;started_at:string};
type Analytics={assigned:number;total_calls:number;answered:number;interested:number;not_interested:number;no_response:number;failed:number;simulated_calls:number};
type PreviewRow={row:number;value:Record<string,string>|null;errors:string[]};
type Page='overview'|'candidates'|'campaigns'|'call-history';
const menu:[Page,string,typeof LayoutDashboard][]=[
 ['overview','Overview',LayoutDashboard],
 ['candidates','Candidates',Users],
 ['campaigns','Campaigns',BriefcaseBusiness],
 ['call-history','Call History',Phone]
];
async function api<T>(path:string,token:string,init:RequestInit={}):Promise<T>{
 const headers=new Headers(init.headers||{});
 if(token)headers.set('Authorization','Bearer '+token);
 if(init.body&&!(init.body instanceof FormData))headers.set('Content-Type','application/json');
 const res=await fetch('/api'+path,{...init,headers});
 const body=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(body.error||('Request failed: '+res.status));
 return body as T;
}
const number=(n:number|undefined)=>Number(n||0).toLocaleString('en-IN');
function statusClass(s:string){return 'status '+s.toLowerCase().replaceAll('_','-');}
function downloadUrl(endpoint:string,token:string,name:string){
 fetch('/api'+endpoint,{headers:{Authorization:'Bearer '+token}})
  .then(async r=>{if(!r.ok)throw Error('Export failed');return r.blob();})
  .then(blob=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);})
  .catch(e=>alert(String(e)));
}
export default function App(){
 const [token,setToken]=useState(()=>sessionStorage.getItem('hros-token')||'');
 const [username,setUsername]=useState('admin'),[password,setPassword]=useState('');
 const [page,setPage]=useState<Page>('overview'),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [loading,setLoading]=useState(false);
 const [candidates,setCandidates]=useState<Candidate[]>([]);
 const [campaigns,setCampaigns]=useState<Campaign[]>([]);
 const [selected,setSelected]=useState<number|null>(null);
 const [calls,setCalls]=useState<Call[]>([]);
 const [stats,setStats]=useState<Analytics|null>(null);
 const [system,setSystem]=useState<{simulated:boolean;activeCalls:number;provider:string}>({simulated:true,activeCalls:0,provider:'mock'});
 const [name,setName]=useState(''),[role,setRole]=useState(''),[retry,setRetry]=useState(1),[language,setLanguage]=useState('en'),[scheduled,setScheduled]=useState('');
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<PreviewRow[]>([]);

 const refresh=useCallback(async()=>{
  if(!token)return;
  try{
   const [cs,ca,sy]=await Promise.all([api<Candidate[]>('/candidates',token),api<Campaign[]>('/campaigns',token),api<typeof system>('/system',token)]);
   setCandidates(cs);setCampaigns(ca);setSystem(sy);
   const campaignId=selected??ca[0]?.id;
   if(campaignId){
    setSelected(campaignId);
    const [cl,an]=await Promise.all([api<Call[]>('/campaigns/'+campaignId+'/calls',token),api<Analytics>('/campaigns/'+campaignId+'/analytics',token)]);
    setCalls(cl);setStats(an);
   }else{setCalls([]);setStats(null);}
  }catch(e){setError(String(e));}
 },[token,selected]);
 useEffect(()=>{void refresh();const id=window.setInterval(()=>void refresh(),5000);return()=>clearInterval(id);},[refresh]);
 async function login(e:FormEvent){e.preventDefault();setError('');setLoading(true);try{
  const result=await api<{token:string}>('/auth/login','',{method:'POST',body:JSON.stringify({username,password})});
  sessionStorage.setItem('hros-token',result.token);setToken(result.token);setPassword('');
 }catch(e){setError(String(e));}finally{setLoading(false);}}
 function logout(){sessionStorage.removeItem('hros-token');setToken('');setCandidates([]);setCampaigns([]);}
 async function action(id:number,what:string){setError('');try{
  await api('/campaigns/'+id+'/'+what,token,{method:'PATCH'});setMessage('Campaign '+what+' successful');await refresh();
 }catch(e){setError(String(e));}}
 async function createCampaign(e:FormEvent){e.preventDefault();setError('');setLoading(true);try{
  const data={name,job_role:role,language,retry_limit:retry,scheduled_at:scheduled?new Date(scheduled).toISOString():null};
  const created=await api<Campaign>('/campaigns',token,{method:'POST',body:JSON.stringify(data)});
  setSelected(created.id);setName('');setRole('');setScheduled('');setMessage('Campaign created. Review candidates before starting.');await refresh();setPage('campaigns');
 }catch(e){setError(String(e));}finally{setLoading(false);}}
 async function sendExcel(endpoint:string){
  if(!file)return;setError('');setMessage('');setLoading(true);
  try{const form=new FormData();form.append('file',file);
   if(endpoint==='preview'){
    const data=await api<{rows:PreviewRow[]}>('/candidates/preview',token,{method:'POST',body:form});
    setPreview(data.rows);
   }else{
    const r=await api<{imported:number}>('/candidates/import',token,{method:'POST',body:form});
    setPreview([]);setFile(null);setMessage(r.imported+' candidates imported');await refresh();
   }
  }catch(e){setError(String(e));}finally{setLoading(false);}
 }
 async function optOut(candidate:Candidate){try{
  await api('/candidates/'+candidate.id+'/opt-out',token,{method:'PATCH',body:JSON.stringify({opt_out:!candidate.opt_out})});
  await refresh();
 }catch(e){setError(String(e));}}
 async function retryCall(call:Call){try{
  await api('/calls/'+call.id+'/retry',token,{method:'POST'});setMessage('Retry queued');await refresh();
 }catch(e){setError(String(e));}}
 const current=campaigns.find(c=>c.id===selected);
 const cards=[
  ['Calls placed',stats?.total_calls,Phone],
  ['Answered',stats?.answered,CheckCircle2],
  ['Interested',stats?.interested,Users],
  ['Not interested',stats?.not_interested,XCircle],
  ['No response',stats?.no_response,CalendarClock],
  ['Failed / busy',stats?.failed,Activity]
 ] as const;
 if(!token)return <div className="auth-wrap"><div className="login-card">
  <div className="logo">H<span>R</span>OS</div><div className="eyebrow">RECRUITMENT INTELLIGENCE</div>
  <h1>Welcome back</h1><p>Sign in to manage recruitment calling securely.</p>
  <form onSubmit={login}><label>Username<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required/></label>
   <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
   {error&&<p className="alert error">{error}</p>}
   <button disabled={loading} className="primary" type="submit">{loading?'Signing in...':'Sign in'} <ChevronRight size={18}/></button>
  </form><div className="login-foot"><ShieldCheck size={17}/> Secure workspace · No public calls by default</div>
 </div></div>;
 return <div className="shell">
  <aside className="sidebar"><div className="logo">H<span>R</span>OS <small>ADMIN</small></div>
   <div className="sidebar-title">WORKSPACE</div><nav>{menu.map(([key,label,Icon])=><button key={key} onClick={()=>setPage(key)} className={page===key?'nav active':'nav'}><Icon size={19}/>{label}</button>)}</nav>
   <div className="side-bottom"><div className="mode"><ShieldCheck size={17}/><div><strong>{system.simulated?'Simulation mode':'Asterisk mode'}</strong><span>{system.simulated?'No real calls placed':'Authorized SIP only'}</span></div></div><button className="nav" onClick={logout}><LogOut size={18}/>Sign out</button></div>
  </aside>
  <main><header className="topbar"><div><span className="crumb">Workspace</span><ChevronRight size={14}/><strong>{menu.find(x=>x[0]===page)?.[1]}</strong></div><div className="top-actions"><span className="connected"><span/> System online</span><button className="icon-btn" aria-label="Refresh dashboard" onClick={()=>void refresh()}><RefreshCw size={18}/></button><div className="avatar">HR</div></div></header>
   <div className="content">
    {error&&<div className="alert error" role="alert">{error}<button onClick={()=>setError('')}>×</button></div>}
    {message&&<div className="alert success" role="status">{message}<button onClick={()=>setMessage('')}>×</button></div>}
    <div className="page-head"><div><div className="eyebrow">HROS CONTROL CENTER</div><h1>{page==='overview'?'Recruitment overview':page==='candidates'?'Candidate management':page==='campaigns'?'Calling campaigns':'Call history'}</h1>
     <p>{page==='overview'?'Monitor your outreach and candidate engagement in one place.':page==='candidates'?'Import, validate and manage candidate consent.':page==='campaigns'?'Create, schedule and control your DTMF screening calls.':'Inspect every dialing attempt and its outcome.'}</p></div>
     <button className="secondary" onClick={()=>void refresh()}><RefreshCw size={16}/> Refresh</button></div>
    {page==='overview'&&<><div className="metric-grid">{cards.map(([label,value,Icon])=><div className="metric" key={label}><div className="metric-icon"><Icon size={20}/></div><div className="metric-label">{label}</div><strong>{number(value)}</strong></div>)}</div>
     <div className="split"><section className="panel"><div className="panel-header"><h2>Campaign performance</h2><span className="muted">Updated every 5 seconds</span></div>{campaigns.length?
     <div className="campaign-list">{campaigns.slice(0,6).map(c=><button className="campaign-item" key={c.id} onClick={()=>{setSelected(c.id);setPage('campaigns');}}><div className="item-icon"><BriefcaseBusiness size={19}/></div><div><strong>{c.name}</strong><span>{c.job_role}</span></div><span className={statusClass(c.status)}>{c.status}</span><ChevronRight size={16}/></button>)}</div>:
     <div className="empty"><BriefcaseBusiness/><strong>No campaigns yet</strong><span>Create a campaign to start a safe mock screening run.</span></div>}</section>
     <section className="panel"><div className="panel-header"><h2>Quick start</h2></div><div className="step"><span>01</span><div><strong>Upload your candidates</strong><p>Preview validation issues before importing.</p></div><button className="link-btn" onClick={()=>setPage('candidates')}>Open</button></div>
      <div className="step"><span>02</span><div><strong>Create a campaign</strong><p>Choose job role, language and retry policy.</p></div><button className="link-btn" onClick={()=>setPage('campaigns')}>Open</button></div>
      <div className="step"><span>03</span><div><strong>Review results</strong><p>Download a detailed Excel call report.</p></div><button className="link-btn" onClick={()=>setPage('call-history')}>Open</button></div>
      <div className="note"><ShieldCheck size={17}/> {system.simulated?'All calls are labeled simulated. No public telephony is active.':'Live SIP mode enabled; verify authorization for each call.'}</div>
     </section></div></>}
    {page==='candidates'&&<><section className="panel"><div className="panel-header"><h2>Import candidates</h2><span className="muted">.xlsx · Max 5 MB</span></div>
     <div className="upload"><UploadCloud size={32}/><strong>Upload an Excel workbook</strong><p>Columns: name, phone, email, location, role, consent, scenario (optional).</p><input aria-label="Candidate Excel workbook" type="file" accept=".xlsx" onChange={e=>{setFile(e.target.files?.[0]??null);setPreview([]);}}/></div>
     <div className="toolbar"><button className="secondary" disabled={!file||loading} onClick={()=>void sendExcel('preview')}><FileSpreadsheet size={17}/> Preview Excel</button>
     <button className="primary" disabled={!file||!preview.length||preview.some(r=>r.errors.length)||loading} onClick={()=>void sendExcel('import')}><UploadCloud size={17}/> Import {preview.length||''} candidates</button></div>
     {preview.length>0&&<div className="table-wrap"><div className="table-heading"><strong>Import preview</strong><span>{preview.filter(r=>r.errors.length).length} invalid rows</span></div><table><thead><tr><th>Excel row</th><th>Candidate</th><th>Phone</th><th>Role</th><th>Validation</th></tr></thead><tbody>{preview.map(r=><tr key={r.row}><td>{r.row}</td><td>{String(r.value?.name??'—')}</td><td>{String(r.value?.phone??'—')}</td><td>{String(r.value?.role??'—')}</td><td className={r.errors.length?'danger':'good'}>{r.errors.join('; ')||'Valid'}</td></tr>)}</tbody></table></div>}
    </section><section className="panel"><div className="panel-header"><h2>Candidate directory <span className="count">{candidates.length}</span></h2><button className="secondary" onClick={()=>downloadUrl('/candidates/export',token,'hros-candidates.xlsx')}><ArrowDownToLine size={16}/> Export Excel</button></div>
     <div className="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Job role</th><th>Consent</th><th>Calling status</th><th>Action</th></tr></thead><tbody>{candidates.map(c=><tr key={c.id}><td><strong>{c.name}</strong><span className="sub">{c.email}</span></td><td>{c.phone}</td><td>{c.role}</td><td>{c.consent?'Yes':'No'}</td><td><span className={c.opt_out?'status cancelled':'status completed'}>{c.opt_out?'Opted out':'Eligible'}</span></td><td><button className="small-btn" onClick={()=>void optOut(c)}><Ban size={14}/>{c.opt_out?'Restore':'Opt out'}</button></td></tr>)}</tbody></table>{!candidates.length&&<div className="empty">No candidates imported.</div>}</div></section></>}
    {page==='campaigns'&&<div className="split campaign-layout"><section className="panel"><div className="panel-header"><h2>Create campaign</h2></div><form className="form" onSubmit={createCampaign}>
     <label>Campaign name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Data Engineer Screening" required minLength={2}/></label>
     <label>Job role<input value={role} onChange={e=>setRole(e.target.value)} placeholder="Azure Data Engineer" required minLength={2}/></label>
     <div className="two-col"><label>Language<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="en">English</option><option value="te">Telugu (audio required)</option><option value="hi">Hindi (audio required)</option></select></label><label>Retry limit<select value={retry} onChange={e=>setRetry(Number(e.target.value))}>{[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label></div>
     <label>Schedule (optional)<input type="datetime-local" value={scheduled} onChange={e=>setScheduled(e.target.value)}/></label>
     <p className="muted">Only imported, consented, non-opted-out candidates with an exactly matching job role are assigned.</p>
     <button className="primary" disabled={loading} type="submit"><BriefcaseBusiness size={17}/> Create campaign</button>
    </form></section><section className="panel"><div className="panel-header"><h2>Your campaigns</h2><span className="count">{campaigns.length}</span></div>
      <div className="campaign-list">{campaigns.map(c=><button className={'campaign-item '+(selected===c.id?'selected':'')} key={c.id} onClick={()=>setSelected(c.id)}><div className="item-icon"><Phone size={19}/></div><div><strong>{c.name}</strong><span>{c.job_role}</span></div><span className={statusClass(c.status)}>{c.status}</span></button>)}</div>{!campaigns.length&&<div className="empty">Your campaigns will appear here.</div>}
     </section></div>}
    {(page==='campaigns'||page==='call-history')&&current&&<><section className="panel"><div className="panel-header"><div><h2>{current.name}</h2><p className="muted">{current.job_role} · {current.language} · campaign #{current.id}</p></div><span className={statusClass(current.status)}>{current.status}</span></div>
     <div className="toolbar">{current.status==='DRAFT'||current.status==='SCHEDULED'?<button className="primary" onClick={()=>void action(current.id,'start')}><Play size={17}/> Start mock calls</button>:null}
     {current.status==='RUNNING'?<button className="secondary" onClick={()=>void action(current.id,'pause')}><Pause size={17}/> Pause</button>:null}
     {current.status==='PAUSED'?<button className="primary" onClick={()=>void action(current.id,'resume')}><Play size={17}/> Resume</button>:null}
     {!['CANCELLED','COMPLETED'].includes(current.status)&&<button className="danger-btn" onClick={()=>{if(confirm('Cancel this campaign?'))void action(current.id,'cancel');}}><XCircle size={17}/> Cancel</button>}
     <button className="secondary" onClick={()=>downloadUrl('/campaigns/'+current.id+'/export',token,'hros-campaign-'+current.id+'.xlsx')}><ArrowDownToLine size={17}/> Download Excel</button></div>
     <div className="mini-metrics"><span>Assigned candidates <strong>{number(stats?.assigned)}</strong></span><span>Interested <strong>{number(stats?.interested)}</strong></span><span>Not interested <strong>{number(stats?.not_interested)}</strong></span><span>No response <strong>{number(stats?.no_response)}</strong></span></div>
    </section><section className="panel"><div className="panel-header"><h2>Call results</h2><span className="muted">{calls.length} attempts · {system.simulated?'simulated':'live'}</span></div>
      <div className="table-wrap"><table><thead><tr><th>Candidate</th><th>Status</th><th>DTMF decision</th><th>Attempt</th><th>Duration</th><th>Mode</th><th>Action</th></tr></thead><tbody>{calls.map(call=><tr key={call.id}><td><strong>{call.name}</strong><span className="sub">{call.phone}</span></td><td><span className={statusClass(call.status)}>{call.status}</span></td><td>{call.dtmf_response??'—'}</td><td>#{call.attempt_number}</td><td>{call.duration_seconds??'—'}s</td><td>{call.simulated?'Simulated':'Live'}</td><td>{['FAILED','BUSY','NO_ANSWER'].includes(call.status)&&<button className="small-btn" onClick={()=>void retryCall(call)}>Retry</button>}</td></tr>)}</tbody></table>{!calls.length&&<div className="empty">No calls recorded yet.</div>}</div>
     </section></>}
    {page==='call-history'&&!current&&<section className="panel"><div className="empty">Create a campaign to view call history.</div></section>}
    <footer>HROS Recruitment Calling Platform · Consent-first DTMF screening · {system.provider.toUpperCase()}</footer>
   </div></main>
 </div>;
}
