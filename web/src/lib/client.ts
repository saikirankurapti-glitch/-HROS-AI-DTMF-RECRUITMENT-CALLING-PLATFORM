export type Page='overview'|'candidates'|'campaigns'|'monitor'|'history'|'analytics'|'telephony'|'settings';
export type Candidate={
 id:number;name:string;phone:string;email:string;location:string;role:string;scenario:string;
 consent:number;opt_out:number;consent_at:string|null;created_at?:string;updated_at?:string
};
export type Campaign={
 id:number;name:string;job_role:string;language:string;status:string;retry_limit:number;
 created_at:string;scheduled_at:string|null;assigned?:number
};
export type Call={
 id:number;campaign_id:number;candidate_id:number;name?:string;phone?:string;email?:string;
 provider:string;provider_call_id:string|null;status:string;dtmf_response:string|null;
 attempt_number:number;started_at:string;answered_at:string|null;ended_at:string|null;
 duration_seconds:number|null;error_message:string|null;simulated:number
};
export type Analytics={
 campaign?:Campaign;assigned:number;total_calls:number;answered:number;
 interested:number;not_interested:number;no_response:number;failed:number;simulated_calls:number
};
export type SystemInfo={provider:string;simulated:boolean;activeCalls:number;publicCallingEnabled:boolean};
export type PreviewRow={row:number;value:Record<string,string>|null;errors:string[]};
export type Preview={total:number;valid:number;rows:PreviewRow[]};
export type CampaignBundle={campaign:Campaign;analytics:Analytics;calls:Call[]};

export const PAGE_NAMES:Record<Page,string>={
 overview:'Overview',candidates:'Candidates',campaigns:'Campaigns',monitor:'Live Calls',
 history:'Call History',analytics:'Analytics & Reports',telephony:'Integrations / Telephony',settings:'Settings'
};
export const COMPLETE=['COMPLETED','NO_ANSWER','BUSY','FAILED','CANCELLED'];
export const NONTERMINAL=['INIT','CALLING','ANSWERED','INTRODUCTION','ROLE_DESCRIPTION','AVAILABILITY_QUESTION','WAITING_FOR_DTMF'];
export const COUNT=(value:number|undefined|null)=>Number(value??0).toLocaleString('en-IN');
export const PERCENT=(num:number,den:number)=>den?Math.round(num/den*100):0;
export function dateLabel(value:string|null|undefined):string{
 if(!value)return '—';
 const parsed=new Date(value.includes('T')?value:value.replace(' ','T')+'Z');
 return Number.isNaN(parsed.getTime())?value:parsed.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
export function maskPhone(phone:string|undefined):string{
 if(!phone)return '—';
 return phone.length>4?'•••• ••'+phone.slice(-4):'••••';
}
export function statusTone(value:string):'success'|'warning'|'danger'|'neutral'|'info'{
 if(['COMPLETED','INTERESTED','RUNNING'].includes(value))return 'success';
 if(['PAUSED','SCHEDULED','NO_RESPONSE','WAITING_FOR_DTMF','BUSY'].includes(value))return 'warning';
 if(['FAILED','NO_ANSWER','CANCELLED','NOT_INTERESTED'].includes(value))return 'danger';
 if(['CALLING','ANSWERED','INTRODUCTION','ROLE_DESCRIPTION','AVAILABILITY_QUESTION'].includes(value))return 'info';
 return 'neutral';
}
export async function api<T>(path:string,token:string,init:RequestInit={}):Promise<T>{
 const headers=new Headers(init.headers);
 if(token)headers.set('Authorization','Bearer '+token);
 if(init.body&&!(init.body instanceof FormData))headers.set('Content-Type','application/json');
 let res:Response;
 try{res=await fetch('/api'+path,{...init,headers});}catch{throw new Error('Network unavailable. Check the API connection and try again.');}
 const body=await res.json().catch(()=>({}));
 if(!res.ok){
  if(res.status===401)throw new Error('Your session has expired or is not authorized. Sign out and sign in again.');
  throw new Error(typeof body?.error==='string'?body.error:'Request failed ('+res.status+')');
 }
 return body as T;
}
export async function exportExcel(path:string,token:string,filename:string):Promise<void>{
 const res=await fetch('/api'+path,{headers:{Authorization:'Bearer '+token}});
 if(!res.ok)throw new Error('Export failed ('+res.status+'). Please try again.');
 const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
 try{a.href=url;a.download=filename;document.body.appendChild(a);a.click();}
 finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
