import type { Database } from './db.js';
import { audit, getRow, getRows } from './db.js';
import type { Candidate, Call, Campaign } from './types.js';
import type { TelephonyProvider } from './telephony.js';

const terminal=['COMPLETED','NO_ANSWER','BUSY','FAILED','CANCELLED'];
const phases:Record<string,string[]> = {
 INIT:['CALLING','FAILED','CANCELLED'],CALLING:['ANSWERED','NO_ANSWER','BUSY','FAILED','CANCELLED'],
 ANSWERED:['INTRODUCTION','FAILED','CANCELLED'],INTRODUCTION:['ROLE_DESCRIPTION','FAILED','CANCELLED'],
 ROLE_DESCRIPTION:['AVAILABILITY_QUESTION','FAILED','CANCELLED'],
 AVAILABILITY_QUESTION:['WAITING_FOR_DTMF','FAILED','CANCELLED'],
 WAITING_FOR_DTMF:['COMPLETED','FAILED','CANCELLED']
};
export function transition(db:Database,id:number,next:string):void {
 const current=getRow<Call>(db,'SELECT * FROM calls WHERE id=?',id);
 if(!current||!phases[current.status]?.includes(next)) throw new Error('Invalid call transition '+(current?.status??'missing')+' → '+next);
 db.prepare('UPDATE calls SET status=? WHERE id=?').run(next,id);
}
function iso():string{return new Date().toISOString();}
function ageMs(date:string):number {return Date.now()-Date.parse(date.replace(' ','T').replace(/Z?$/,'Z'));}
export class CallingEngine {
 private active=new Map<number,{campaignId:number,candidateId:number,providerCallId:string|null}>();
 private timer:ReturnType<typeof setInterval>|null=null;
 private pumping=false;
 private lastStarted=0;
 constructor(private db:Database,private provider:TelephonyProvider) {}
 start():void {if(!this.timer)this.timer=setInterval(()=>{void this.tick();},1000);}
 shutdown():void {if(this.timer)clearInterval(this.timer);this.timer=null;this.provider.shutdown();}
 async cancelCampaign(id:number):Promise<void> {
  this.db.prepare("UPDATE campaigns SET status='CANCELLED' WHERE id=?").run(id);
  for(const [callId,item] of this.active) {
   if(item.campaignId!==id)continue;
   if(item.providerCallId) await this.provider.endCall(item.providerCallId);
   this.finish(callId,'CANCELLED',null,'Campaign cancelled');
  }
  audit(this.db,'admin','cancel','campaign',id);
 }
 private finish(id:number,status:string,response:string|null=null,error:string|null=null):void {
  const call=getRow<Call>(this.db,'SELECT * FROM calls WHERE id=?',id);
  if(!call||terminal.includes(call.status))return;
  const ended=iso();
  const secs=Math.max(0,Math.round((Date.now()-Date.parse(call.started_at.replace(' ','T').replace(/Z?$/,'Z')))/1000));
  this.db.prepare('UPDATE calls SET status=?,dtmf_response=?,ended_at=?,duration_seconds=?,error_message=? WHERE id=?')
   .run(status,response,ended,secs,error,id);
  this.active.delete(id);
 }
 private async runCall(campaign:Campaign,candidate:Candidate,attempt:number):Promise<void> {
  const insert=this.db.prepare('INSERT INTO calls(campaign_id,candidate_id,provider,status,attempt_number,started_at,simulated) VALUES(?,?,?,?,?,?,?)')
   .run(campaign.id,candidate.id,this.provider.name,'INIT',attempt,iso(),this.provider.simulated?1:0);
  const id=Number(insert.lastInsertRowid);
  this.active.set(id,{campaignId:campaign.id,candidateId:candidate.id,providerCallId:null});
  let providerId:string|null=null;
  try {
   transition(this.db,id,'CALLING');
   providerId=await this.provider.startCall(candidate);
   this.db.prepare('UPDATE calls SET provider_call_id=? WHERE id=?').run(providerId,id);
   const active=this.active.get(id); if(active)active.providerCallId=providerId;
   if(!this.active.has(id))return;
   const answer=await this.provider.waitForAnswer(providerId,25000);
   if(!this.active.has(id))return;
   if(answer!=='answered'){this.finish(id,answer.toUpperCase(),null,answer);return;}
   transition(this.db,id,'ANSWERED');
   this.db.prepare('UPDATE calls SET answered_at=? WHERE id=?').run(iso(),id);
   for(const [step,sound] of [
    ['INTRODUCTION','hros_intro_'+campaign.language],
    ['ROLE_DESCRIPTION','hros_role_'+campaign.language],
    ['AVAILABILITY_QUESTION','hros_question_'+campaign.language]
   ]) {
    if(!this.active.has(id))return;
    transition(this.db,id,step);
    await this.provider.playAudio(providerId,sound);
   }
   if(!this.active.has(id))return;
   transition(this.db,id,'WAITING_FOR_DTMF');
   let digit=await this.provider.collectDtmf(providerId,8000);
   if(digit!==null&&digit!=='1'&&digit!=='2') {
    await this.provider.playAudio(providerId,'hros_question_'+campaign.language);
    digit=await this.provider.collectDtmf(providerId,8000);
   }
   if(!this.active.has(id))return;
   const response=digit==='1'?'INTERESTED':digit==='2'?'NOT_INTERESTED':'NO_RESPONSE';
   transition(this.db,id,'COMPLETED');
   this.finish(id,'COMPLETED',response);
  }catch(err) {
   this.finish(id,'FAILED',null,err instanceof Error?err.message:'Unknown telephony error');
  }finally{
   if(providerId)await this.provider.endCall(providerId);
   this.active.delete(id);
   this.maybeFinish(campaign.id);
  }
 }
 private maybeFinish(id:number):void {
  const c=getRow<Campaign>(this.db,'SELECT * FROM campaigns WHERE id=?',id);
  if(!c||c.status!=='RUNNING'||[...this.active.values()].some(x=>x.campaignId===id))return;
  const members=getRows<{candidate_id:number;consent:number;opt_out:number}>(this.db,
   'SELECT cc.candidate_id,c.consent,c.opt_out FROM campaign_candidates cc JOIN candidates c ON cc.candidate_id=c.id WHERE cc.campaign_id=?',id);
  const hasWork=members.some(m=>{
   if(!m.consent||m.opt_out)return false;
   const call=getRow<Call>(this.db,'SELECT * FROM calls WHERE campaign_id=? AND candidate_id=? ORDER BY attempt_number DESC LIMIT 1',id,m.candidate_id);
   if(!call)return true;
   return ['BUSY','NO_ANSWER','FAILED'].includes(call.status)&&call.attempt_number<=c.retry_limit;
  });
  if(!hasWork)this.db.prepare("UPDATE campaigns SET status='COMPLETED' WHERE id=?").run(id);
 }
 async tick():Promise<void> {
  if(this.pumping)return;this.pumping=true;
  try{
   this.db.prepare("UPDATE campaigns SET status='RUNNING' WHERE status='SCHEDULED' AND scheduled_at<=?").run(iso());
   const concurrency=Math.max(1,Math.min(10,Number(process.env.MAX_CONCURRENT_CALLS||1)));
   const minGap=Math.max(0,Number(process.env.MIN_SECONDS_BETWEEN_CALLS||2))*1000;
   if(this.active.size>=concurrency||Date.now()-this.lastStarted<minGap)return;
   const campaigns=getRows<Campaign>(this.db,"SELECT * FROM campaigns WHERE status='RUNNING' ORDER BY id");
   for(const campaign of campaigns) {
    const members=getRows<Candidate>(this.db,
     'SELECT c.* FROM candidates c JOIN campaign_candidates cc ON c.id=cc.candidate_id WHERE cc.campaign_id=? AND c.consent=1 AND c.opt_out=0 ORDER BY c.id',campaign.id);
    for(const candidate of members) {
     if([...this.active.values()].some(v=>v.candidateId===candidate.id))continue;
     const global=getRow<{n:number}>(this.db,"SELECT COUNT(*) n FROM calls WHERE candidate_id=? AND status NOT IN ('COMPLETED','NO_ANSWER','BUSY','FAILED','CANCELLED')",candidate.id);
     if(global?.n)continue;
     const previous=getRow<Call>(this.db,'SELECT * FROM calls WHERE campaign_id=? AND candidate_id=? ORDER BY attempt_number DESC LIMIT 1',campaign.id,candidate.id);
     if(previous) {
      if(!['BUSY','NO_ANSWER','FAILED'].includes(previous.status)||previous.attempt_number>campaign.retry_limit) continue;
      const backoff=30000*Math.pow(2,previous.attempt_number-1);
      if(!previous.ended_at||ageMs(previous.ended_at)<backoff)continue;
     }
     this.lastStarted=Date.now();
     void this.runCall(campaign,candidate,(previous?.attempt_number??0)+1);
     return;
    }
    this.maybeFinish(campaign.id);
   }
  }finally{this.pumping=false;}
 }
 activeCount():number{return this.active.size;}
}
