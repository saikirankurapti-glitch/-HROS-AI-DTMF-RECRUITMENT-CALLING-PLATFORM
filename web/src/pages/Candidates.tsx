import {useEffect,useMemo,useState} from 'react';
import {ArrowDownToLine,ArrowRight,CheckCircle2,ChevronDown,FileSpreadsheet,Info,RefreshCw,ShieldAlert,SlidersHorizontal,UploadCloud,UsersRound} from 'lucide-react';
import {api,dateLabel,maskPhone,type Candidate,type Call,type Preview} from '../lib/client';
import type {Workspace} from '../lib/useWorkspace';
import {Badge,Button,Dialog,Drawer,Empty,Pager,Panel,SearchBox,SortHeading} from '../components/ui';

type SortKey='name'|'role'|'created_at';
const fields=['name','phone','email','location','role','consent','scenario'] as const;
export default function Candidates({work,token,onRefresh,onMessage,onError}:{work:Workspace;token:string;onRefresh:()=>Promise<void>;onMessage:(s:string)=>void;onError:(s:string)=>void}){
 const [query,setQuery]=useState(''),[role,setRole]=useState('all'),[eligibility,setEligibility]=useState('all');
 const [sort,setSort]=useState<string>('name'),[page,setPage]=useState(1);
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<Preview|null>(null),[mapping,setMapping]=useState<Record<string,string>>({});
 const [showMapping,setShowMapping]=useState(false),[importBusy,setImportBusy]=useState(false),[downloading,setDownloading]=useState(false);
 const [selected,setSelected]=useState<Candidate|null>(null),[history,setHistory]=useState<Call[]>([]),[historyBusy,setHistoryBusy]=useState(false);
 const [confirm,setConfirm]=useState<Candidate|null>(null),[actionBusy,setActionBusy]=useState(false);
 const roles=useMemo(()=>[...new Set(work.candidates.map(c=>c.role))].sort((a,b)=>a.localeCompare(b)),[work.candidates]);
 const filtered=useMemo(()=>{
  const term=query.trim().toLowerCase();
  return work.candidates.filter(c=>(!term||[c.name,c.phone,c.email,c.role,c.location].some(v=>(v||'').toLowerCase().includes(term)))&&
   (role==='all'||c.role===role)&&
   (eligibility==='all'||(eligibility==='eligible'&&Boolean(c.consent)&&!c.opt_out)||(eligibility==='opted'&&Boolean(c.opt_out))||(eligibility==='no-consent'&&!c.consent))
  ).sort((a,b)=>{
   const key=sort.replace('-','') as SortKey;
   const reverse=sort.startsWith('-')?-1:1;
   return String(a[key]??'').localeCompare(String(b[key]??''),undefined,{numeric:true})*reverse;
  });
 },[work.candidates,query,role,eligibility,sort]);
 const shown=filtered.slice((page-1)*10,page*10);
 const chooseSort=(field:string)=>{setSort(sort===field?'-'+field:field);setPage(1);};
 useEffect(()=>{if(!selected)return;
  let cancelled=false;
  setHistoryBusy(true);
  api<Call[]>('/candidates/'+selected.id+'/history',token).then(r=>{if(!cancelled)setHistory(r);}).catch(e=>{if(!cancelled)onError(String(e));}).finally(()=>{if(!cancelled)setHistoryBusy(false);});
  return()=>{cancelled=true;};
 },[selected?.id,token]);
 async function submit(mode:'preview'|'import'){
  if(!file)return;setImportBusy(true);
  try{
   const body=new FormData();body.set('file',file);body.set('mapping',JSON.stringify(mapping));
   if(mode==='preview'){
    const result=await api<Preview>('/candidates/preview',token,{method:'POST',body});
    setPreview(result);
    if(result.valid!==result.total)onMessage('Preview complete. Correct all invalid rows before importing.');
   }else{
    const result=await api<{imported:number}>('/candidates/import',token,{method:'POST',body});
    setPreview(null);setFile(null);
    onMessage(result.imported+' candidates imported');await onRefresh();
   }
  }catch(e){onError(e instanceof Error?e.message:String(e));}
  finally{setImportBusy(false);}
 }
 async function exportCandidates(){
  setDownloading(true);try{
   const res=await fetch('/api/candidates/export',{headers:{Authorization:'Bearer '+token}});
   if(!res.ok)throw new Error('Candidate report download failed');
   const object=URL.createObjectURL(await res.blob());const link=document.createElement('a');link.href=object;link.download='hros-candidates.xlsx';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(object),1000);
  }catch(e){onError(String(e));}finally{setDownloading(false);}
 }
 async function applyOptOut(){
  if(!confirm)return;setActionBusy(true);
  try{
   await api('/candidates/'+confirm.id+'/opt-out',token,{method:'PATCH',body:JSON.stringify({opt_out:!confirm.opt_out})});
   onMessage(confirm.opt_out?'Candidate opt-out cleared':'Candidate opted out. Further calls are suppressed.');
   setSelected(null);setConfirm(null);await onRefresh();
  }catch(e){onError(String(e));}finally{setActionBusy(false);}
 }
 return <>
  <section className="page-header"><div><div className="eyebrow">CANDIDATE DIRECTORY</div><h1>Candidate management</h1><p>Import, validate, and manage the candidates eligible for recruitment screening.</p></div>
   <div className="header-actions"><Button icon={<ArrowDownToLine size={16}/>} disabled={downloading} onClick={()=>void exportCandidates()}>{downloading?'Exporting...':'Export Excel'}</Button></div></section>
  <div className="inline-info"><Info size={18}/><span>Candidate numbers are masked in lists. Open a record to view details. Opt-outs are enforced by the calling engine.</span></div>
  <Panel title="Import candidates" subtitle="Validate every Excel row before anything is added to the directory" action={<span className="mini-pill"><FileSpreadsheet size={15}/> .XLSX ONLY</span>}>
   <div className="import-layout"><div className="dropzone"><div className="drop-icon"><UploadCloud size={25}/></div><strong>{file?file.name:'Drop or choose an Excel workbook'}</strong><p>Max 5 MB · Required: name, phone, email, role and consent</p>
    <label className="file-picker">Choose .xlsx file<input type="file" aria-label="Candidate Excel workbook" accept=".xlsx" onChange={e=>{setFile(e.target.files?.[0]??null);setPreview(null);}}/></label>
   </div><div className="import-guide"><h3>Before you import</h3><div className="guide-step"><span>01</span><p>Upload a workbook with the required columns.</p></div><div className="guide-step"><span>02</span><p>Review row-level errors and explicit consent.</p></div><div className="guide-step"><span>03</span><p>Import only when every row is valid.</p></div>
    <button className="plain-link" onClick={()=>setShowMapping(x=>!x)}><SlidersHorizontal size={15}/> {showMapping?'Hide column mapping':'Map Excel columns'} <ChevronDown size={13}/></button>
   </div></div>
   {showMapping&&<div className="column-map"><h3>Column mapping</h3><p>Enter the exact Excel header for each system field. Required fields must exist in the uploaded workbook.</p><div className="mapping-grid">{fields.map(field=><label key={field}>{field}<input value={mapping[field]??field} onChange={e=>{setMapping(m=>({...m,[field]:e.target.value}));setPreview(null);}}/></label>)}</div></div>}
   <div className="import-actions"><Button disabled={!file||importBusy} icon={<FileSpreadsheet size={16}/>} onClick={()=>void submit('preview')}>{importBusy?'Validating...':'Preview Excel'}</Button>
    <Button kind="primary" icon={<CheckCircle2 size={17}/>} disabled={!file||!preview?.total||preview.valid!==preview.total||importBusy} onClick={()=>void submit('import')}>Import {preview?.total??''} candidates</Button>
    {preview&&<span className={'validation-summary '+(preview.valid!==preview.total?'validation-warning':'')}>{preview.valid}/{preview.total} valid rows</span>}
   </div>
   {preview&&<div className="table-scroll preview-table"><table className="data-table"><thead><tr><th>Row</th><th>Name</th><th>Phone</th><th>Role</th><th>Validation</th></tr></thead><tbody>{preview.rows.map(r=><tr key={r.row}><td>{r.row}</td><td>{String(r.value?.name??'—')}</td><td>{maskPhone(String(r.value?.phone??''))}</td><td>{String(r.value?.role??'—')}</td><td>{r.errors.length?<span className="table-error">{r.errors.join('; ')}</span>:<span className="table-success"><CheckCircle2 size={15}/> Valid</span>}</td></tr>)}</tbody></table></div>}
  </Panel>
  <Panel title="Candidate directory" subtitle="Search and review imported candidate records" action={<span className="table-count"><UsersRound size={14}/>{filtered.length} candidates</span>}>
   <div className="table-tools"><SearchBox label="Search candidates" placeholder="Search name, email, phone, role..." value={query} onChange={v=>{setQuery(v);setPage(1);}}/>
    <label className="filter-select">Role <select aria-label="Filter by role" value={role} onChange={e=>{setRole(e.target.value);setPage(1);}}><option value="all">All roles</option>{roles.map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="filter-select">Eligibility <select aria-label="Filter by eligibility" value={eligibility} onChange={e=>{setEligibility(e.target.value);setPage(1);}}><option value="all">All candidates</option><option value="eligible">Eligible</option><option value="opted">Opted out</option><option value="no-consent">No consent</option></select></label>
   </div>
   {shown.length?<div className="table-scroll"><table className="data-table"><thead><tr><th><SortHeading label="Candidate" field="name" sort={sort} onChange={chooseSort}/></th><th>Phone</th><th><SortHeading label="Job role" field="role" sort={sort} onChange={chooseSort}/></th><th>Consent</th><th>Calling</th><th><SortHeading label="Added" field="created_at" sort={sort} onChange={chooseSort}/></th><th>Details</th></tr></thead><tbody>{shown.map(c=><tr key={c.id}>
    <td><div className="name-cell"><span className="person-avatar">{c.name.slice(0,1).toUpperCase()}</span><span><strong>{c.name}</strong><small>{c.email}</small></span></div></td>
    <td>{maskPhone(c.phone)}</td><td>{c.role}</td>
    <td><Badge value={c.consent?'CONSENTED':'NO CONSENT'} tone={c.consent?'success':'warning'}/></td><td><Badge value={c.opt_out?'OPTED OUT':'ELIGIBLE'} tone={c.opt_out?'danger':'info'}/></td><td className="small-muted">{dateLabel(c.created_at)}</td>
    <td><button className="table-link" onClick={()=>setSelected(c)}>View <ArrowRight size={14}/></button></td>
   </tr>)}</tbody></table></div>:<Empty title={work.candidates.length?'No matching candidates':'No candidates imported'} description={work.candidates.length?'Try changing your search or filters.':'Upload an Excel workbook and validate the rows to begin.'}/>}
   <Pager page={page} pageSize={10} total={filtered.length} onChange={setPage}/>
  </Panel>
  {selected&&<Drawer title={selected.name} subtitle={'Candidate #'+selected.id+' · '+selected.role} onClose={()=>setSelected(null)}>
   <div className="detail-list"><div><span>Full phone number</span><strong>{selected.phone}</strong></div><div><span>Email</span><strong>{selected.email}</strong></div><div><span>Location</span><strong>{selected.location||'—'}</strong></div><div><span>Consent</span><Badge value={selected.consent?'CONSENTED':'NO CONSENT'} tone={selected.consent?'success':'warning'}/></div><div><span>Opt-out</span><Badge value={selected.opt_out?'OPTED OUT':'NOT OPTED OUT'} tone={selected.opt_out?'danger':'success'}/></div><div><span>Consent recorded</span><strong>{dateLabel(selected.consent_at)}</strong></div></div>
   <div className="drawer-section"><h3>Contact history</h3>{historyBusy?<p className="small-muted">Loading contact history...</p>:history.length?<div className="drawer-call-list">{history.map(c=><div key={c.id}><Badge value={c.dtmf_response??c.status}/><span>{dateLabel(c.started_at)}</span><small>Attempt #{c.attempt_number}</small></div>)}</div>:<p className="small-muted">No calls recorded for this candidate.</p>}</div>
   <div className="drawer-actions"><Button kind={selected.opt_out?'secondary':'danger'} icon={<ShieldAlert size={15}/>} onClick={()=>setConfirm(selected)}>{selected.opt_out?'Restore eligibility':'Opt out of further calls'}</Button></div>
  </Drawer>}
  {confirm&&<Dialog title={confirm.opt_out?'Clear this opt-out?':'Suppress further calls?'} description={confirm.opt_out?'This removes the opt-out flag. Candidate consent and other restrictions still apply.':'This candidate will be excluded from future calls across campaigns.'} danger={!confirm.opt_out} label={confirm.opt_out?'Restore candidate':'Confirm opt-out'} onClose={()=>setConfirm(null)} action={()=>void applyOptOut()} busy={actionBusy}/>}
 </>;
}
