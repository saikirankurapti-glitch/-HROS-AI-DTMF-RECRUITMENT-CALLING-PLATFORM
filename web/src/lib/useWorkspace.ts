import {useCallback,useEffect,useMemo,useState} from 'react';
import {api,type Analytics,type Call,type Campaign,type Candidate,type CampaignBundle,type SystemInfo} from './client';

export type Workspace={
 candidates:Candidate[];campaigns:Campaign[];bundles:CampaignBundle[];calls:Call[];
 system:SystemInfo|null;loading:boolean;refreshing:boolean;error:string|null;
 refresh:()=>Promise<void>;byCampaign:(id:number)=>CampaignBundle|undefined;
 aggregate:{attempts:number;answered:number;interested:number;notInterested:number;noResponse:number;failed:number;simulated:number;active:number};
};
export function useWorkspace(token:string):Workspace{
 const [candidates,setCandidates]=useState<Candidate[]>([]);
 const [campaigns,setCampaigns]=useState<Campaign[]>([]);
 const [bundles,setBundles]=useState<CampaignBundle[]>([]);
 const [system,setSystem]=useState<SystemInfo|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const refresh=useCallback(async()=>{
  if(!token)return;
  setRefreshing(true);
  try{
   const [people,groups,info]=await Promise.all([
    api<Candidate[]>('/candidates',token),
    api<Campaign[]>('/campaigns',token),
    api<SystemInfo>('/system',token)
   ]);
   // No synthetic totals. Read every campaign's real calls and aggregate endpoint.
   const snapshots:CampaignBundle[]=[];
   for(let i=0;i<groups.length;i+=8){
    const batch=groups.slice(i,i+8);
    const chunk=await Promise.all(batch.map(async campaign=>{
     const [calls,analytics]=await Promise.all([
      api<Call[]>('/campaigns/'+campaign.id+'/calls',token),
      api<Analytics>('/campaigns/'+campaign.id+'/analytics',token)
     ]);
     return {campaign,calls,analytics};
    }));
    snapshots.push(...chunk);
   }
   setCandidates(people);setCampaigns(groups);setSystem(info);setBundles(snapshots);setError(null);
  }catch(e){setError(e instanceof Error?e.message:'Unable to load workspace');}
  finally{setRefreshing(false);setLoading(false);}
 },[token]);
 useEffect(()=>{
  if(!token){setLoading(false);return;}
  void refresh();
  const interval=setInterval(()=>{if(document.visibilityState!=='hidden')void refresh();},12000);
  return()=>clearInterval(interval);
 },[token,refresh]);
 const calls=useMemo(()=>bundles.flatMap(x=>x.calls).sort((a,b)=>b.id-a.id),[bundles]);
 const aggregate=useMemo(()=>({
  attempts:calls.length,
  answered:calls.filter(c=>Boolean(c.answered_at)).length,
  interested:calls.filter(c=>c.dtmf_response==='INTERESTED').length,
  notInterested:calls.filter(c=>c.dtmf_response==='NOT_INTERESTED').length,
  noResponse:calls.filter(c=>c.dtmf_response==='NO_RESPONSE').length,
  failed:calls.filter(c=>['FAILED','BUSY','NO_ANSWER'].includes(c.status)).length,
  simulated:calls.filter(c=>Boolean(c.simulated)).length,
  active:calls.filter(c=>['INIT','CALLING','ANSWERED','INTRODUCTION','ROLE_DESCRIPTION','AVAILABILITY_QUESTION','WAITING_FOR_DTMF'].includes(c.status)).length
 }),[calls]);
 const byCampaign=useCallback((id:number)=>bundles.find(x=>x.campaign.id===id),[bundles]);
 return {candidates,campaigns,bundles,calls,system,loading,refreshing,error,refresh,byCampaign,aggregate};
}
