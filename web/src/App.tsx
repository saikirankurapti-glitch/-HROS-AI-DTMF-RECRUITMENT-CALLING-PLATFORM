import {useState,type FormEvent} from 'react';
import {ArrowRight,CheckCircle2,LockKeyhole,RefreshCw,ShieldCheck,X} from 'lucide-react';
import {api,exportExcel,type Page} from './lib/client';
import {useWorkspace} from './lib/useWorkspace';
import {Shell} from './components/Shell';
import {Button,Loading} from './components/ui';
import Overview from './pages/Overview';
import Candidates from './pages/Candidates';
import Campaigns from './pages/Campaigns';
import {History,Monitor} from './pages/Calls';
import Analytics from './pages/Analytics';
import {Settings,Telephony} from './pages/TelephonySettings';

export default function App(){
 const [token,setToken]=useState(()=>sessionStorage.getItem('hros-token')||'');
 const [username,setUsername]=useState('admin'),[password,setPassword]=useState('');
 const [page,setPage]=useState<Page>('overview');
 const [selectedId,setSelectedId]=useState<number|null>(null);
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 const [loginBusy,setLoginBusy]=useState(false);
 const work=useWorkspace(token);
 const clearNotice=()=>{setNotice('');setError('');};
 const success=(message:string)=>{setNotice(message);setError('');};
 const fail=(message:string)=>{setError(message);setNotice('');};
 async function login(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setLoginBusy(true);clearNotice();
  try{
   const result=await api<{token:string}>('/auth/login','',{method:'POST',body:JSON.stringify({username,password})});
   sessionStorage.setItem('hros-token',result.token);setToken(result.token);setPassword('');
  }catch(err){fail(err instanceof Error?err.message:String(err));}
  finally{setLoginBusy(false);}
 }
 function logout(){sessionStorage.removeItem('hros-token');setToken('');setPage('overview');setSelectedId(null);clearNotice();}
 async function doExport(id:number|undefined){
  try{await exportExcel(id===undefined?'/candidates/export':'/campaigns/'+id+'/export',token,id===undefined?'hros-candidates.xlsx':'hros-campaign-'+id+'.xlsx');success('Excel report downloaded.');}
  catch(err){fail(err instanceof Error?err.message:String(err));}
 }
 if(!token)return <div className="auth-page"><div className="auth-container"><div className="auth-brand"><span className="auth-brand-icon">H</span><div><strong>HROS</strong><small>Recruitment operations</small></div></div>
  <div className="auth-content"><span className="auth-tag"><ShieldCheck size={15}/> SECURE WORKSPACE</span><h1>Welcome back</h1><p>Sign in to manage your recruitment campaigns, candidates, and calling results.</p>
   <form onSubmit={e=>void login(e)} className="auth-form"><label>Username<input required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter your username"/></label><label>Password<input aria-label="Password" required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/></label>
    {error&&<div className="auth-error" role="alert">{error}</div>}
    <Button kind="primary" type="submit" disabled={loginBusy} className="auth-submit">{loginBusy?'Signing in...':'Sign in'} <ArrowRight size={16}/></Button>
   </form>
  </div><div className="auth-bottom"><LockKeyhole size={15}/> Authentication is handled by your local HROS API.</div>
 </div><div className="auth-aside"><div className="auth-pattern"><span/><span/><span/><span/><span/><span/></div><div className="auth-aside-copy"><span className="auth-eyebrow">RECRUITMENT CALLING PLATFORM</span><h2>Smarter outreach.<br/>Clearer outcomes.</h2><p>Candidate management, structured screening, and auditable DTMF results in one focused workspace.</p><div className="auth-aside-steps"><span><CheckCircle2 size={16}/> Consent-first workflows</span><span><CheckCircle2 size={16}/> Operational visibility</span><span><CheckCircle2 size={16}/> Safe simulation by default</span></div></div></div></div>;
 return <Shell page={page} onPage={setPage} system={work.system} onLogout={logout}>
  {notice&&<div role="status" className="toast toast-success"><CheckCircle2 size={18}/><span>{notice}</span><button aria-label="Dismiss success" onClick={()=>setNotice('')}><X size={17}/></button></div>}
  {(error||work.error)&&<div role="alert" className="toast toast-error"><ShieldCheck size={18}/><span>{error||work.error}</span><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={17}/></button></div>}
  {work.loading?<Loading/>:<>
   {page==='overview'&&<Overview work={work} onPage={setPage} onCampaign={setSelectedId}/>}
   {page==='candidates'&&<Candidates work={work} token={token} onRefresh={work.refresh} onMessage={success} onError={fail}/>}
   {page==='campaigns'&&<Campaigns work={work} token={token} selectedId={selectedId} onSelect={setSelectedId} onRefresh={work.refresh} onMessage={success} onError={fail} onExport={id=>void doExport(id)}/>}
   {page==='monitor'&&<Monitor work={work} onRefresh={work.refresh}/>}
   {page==='history'&&<History work={work} token={token} onRefresh={work.refresh} onMessage={success} onError={fail} onExport={id=>void doExport(id)}/>}
   {page==='analytics'&&<Analytics work={work} onExport={id=>void doExport(id)}/>}
   {page==='telephony'&&<Telephony work={work}/>}
   {page==='settings'&&<Settings work={work} onLogout={logout}/>}
   <div className="refresh-footer"><span><span className="refresh-indicator"/> {work.refreshing?'Syncing latest records…':'Synced with HROS API · Refreshes approximately every 12 seconds'}</span><Button kind="ghost" icon={<RefreshCw size={14}/>} disabled={work.refreshing} onClick={()=>void work.refresh()}>Refresh data</Button></div>
  </>}
 </Shell>;
}
