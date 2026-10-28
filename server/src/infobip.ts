import type { Candidate } from './types.js';
import type { AnswerState, TelephonyProvider } from './telephony.js';

type EventWaiter = { types: string[]; resolve: (event: InfobipEvent | null) => void; timer: ReturnType<typeof setTimeout> };
type InfobipEvent = { type?: string; callId?: string; id?: string; properties?: Record<string, unknown>; [key: string]: unknown };
type CallState = { answer?: AnswerState; established?: boolean; ended?: boolean; digit?: string; waiters: Set<EventWaiter> };

function normalizeEventType(value: unknown): string { return String(value ?? '').toUpperCase().replace(/[.\\s-]/g, '_'); }
function callIdOf(event: InfobipEvent): string { return String(event.callId ?? (event as any).call_id ?? (event as any).call?.id ?? ''); }
function eventList(payload: unknown): InfobipEvent[] {
 if(Array.isArray(payload)) return payload.flatMap(eventList);
 if(!payload || typeof payload !== 'object') return [];
 const obj=payload as Record<string, unknown>;
 if(Array.isArray(obj.results)) return obj.results.flatMap(eventList);
 if(Array.isArray(obj.events)) return obj.events.flatMap(eventList);
 return [obj as InfobipEvent];
}

/** Infobip Calls API adapter. Requires a public HTTPS VOICE_VIDEO event subscription. */
export class InfobipTelephonyProvider implements TelephonyProvider {
 readonly name='infobip'; readonly simulated=false;
 private base:string; private apiKey:string; private configId:string; private fromNumber:string;
 private states=new Map<string,CallState>();
 constructor() {
  const key=process.env.INFOBIP_API_KEY?.trim(),config=process.env.INFOBIP_CALLS_CONFIGURATION_ID?.trim();
  const base=(process.env.INFOBIP_BASE_URL||'https://ndlev2.api.infobip.com').trim();
  if(!key) throw new Error('INFOBIP_API_KEY must be configured');
  if(!config) throw new Error('INFOBIP_CALLS_CONFIGURATION_ID must be configured');
  const parsed=new URL(base.startsWith('http')?base:'https://'+base);
  if(parsed.protocol!=='https:'&&process.env.NODE_ENV==='production') throw new Error('INFOBIP_BASE_URL must use HTTPS in production');
  this.base=parsed.origin;this.apiKey=key;this.configId=config;this.fromNumber=(process.env.INFOBIP_FROM_NUMBER||'').replace(/[^0-9]/g,'');
 }
 private state(id:string):CallState {
  let s=this.states.get(id);if(!s){s={waiters:new Set()};this.states.set(id,s);}return s;
 }
 private async request(path:string,body?:unknown,method='POST'):Promise<any> {
  const response=await fetch(this.base+path,{method,headers:{Authorization:'App '+this.apiKey,Accept:'application/json','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await response.text();let parsed:any=null;
  if(text){try{parsed=JSON.parse(text);}catch{parsed={message:text.slice(0,300)};}}
  if(!response.ok){
   const message=typeof parsed?.requestError?.serviceException?.text==='string'?parsed.requestError.serviceException.text:typeof parsed?.message==='string'?parsed.message:'request rejected';
   throw new Error('Infobip API '+response.status+': '+message.slice(0,240));
  }
  return parsed;
 }
 async startCall(candidate:Candidate):Promise<string> {
  if(process.env.PUBLIC_CALLING_ENABLED!=='true'||process.env.MOCK_ONLY!=='false') throw new Error('Infobip public calls are disabled. Explicitly authorize a single consented test in server environment first.');
  if(!candidate.consent||candidate.opt_out) throw new Error('Calling blocked: candidate consent is missing or candidate opted out');
  if(!/^\\+[1-9]\\d{7,14}$/.test(candidate.phone)) throw new Error('Infobip requires a valid E.164 candidate phone number');
  const payload:any={endpoint:{phoneNumber:candidate.phone.replace(/\\D/g,''),type:'PHONE'},callsConfigurationId:this.configId,connectTimeout:30,maxDuration:180,customData:{hrosCandidateId:String(candidate.id),hrosCandidateName:candidate.name}};
  if(this.fromNumber) payload.from=this.fromNumber;
  const response=await this.request('/calls/1/calls',payload);
  const id=String(response?.id??response?.callId??response?.call?.id??'');
  if(!id) throw new Error('Infobip response did not include a call ID; inspect Infobip API logs');
  this.state(id);return id;
 }
 handleEvent(payload:unknown):void {
  for(const event of eventList(payload)){
   const id=callIdOf(event);if(!id)continue;
   const state=this.state(id),type=normalizeEventType(event.type);
   const props=(event.properties&&typeof event.properties==='object'?event.properties:{}) as Record<string,unknown>;
   if(['CALL_ESTABLISHED','CALL_CONNECTED','ESTABLISHED'].includes(type)){state.established=true;state.answer='answered';}
   else if(['CALL_BUSY','BUSY'].includes(type)){state.answer='busy';state.ended=true;}
   else if(['CALL_NO_ANSWER','NO_ANSWER'].includes(type)){state.answer='no_answer';state.ended=true;}
   else if(['CALL_FAILED','FAILED'].includes(type)){state.answer=state.established?'answered':'failed';state.ended=true;}
   else if(['CALL_FINISHED','CALL_HANGUP','FINISHED'].includes(type)){if(!state.answer)state.answer='no_answer';state.ended=true;}
   else if(type==='DTMF_COLLECTED'){const value=String(props.dtmf??props.digits??props.input??props.value??'');if(/^[0-9*#]$/.test(value))state.digit=value;}
   for(const waiter of [...state.waiters]){
    if(waiter.types.includes(type)||(waiter.types.includes('__ANSWER__')&&(state.answer||state.ended))||(waiter.types.includes('__DTMF__')&&(state.digit||state.ended))){
     clearTimeout(waiter.timer);state.waiters.delete(waiter);waiter.resolve(event);
    }
   }
  }
 }
 private waitFor(id:string,types:string[],timeoutMs:number):Promise<InfobipEvent|null> {
  const state=this.state(id);
  if(types.includes('__ANSWER__')&&(state.answer||state.ended))return Promise.resolve(null);
  if(types.includes('__DTMF__')&&(state.digit||state.ended))return Promise.resolve(null);
  return new Promise(resolve=>{const waiter:EventWaiter={types,resolve,timer:setTimeout(()=>{state.waiters.delete(waiter);resolve(null);},timeoutMs)};state.waiters.add(waiter);});
 }
 async waitForAnswer(id:string,timeoutMs:number):Promise<AnswerState> {
  const state=this.state(id);if(state.answer)return state.answer;
  await this.waitFor(id,['__ANSWER__'],timeoutMs);if(state.answer)return state.answer;return state.established?'answered':'no_answer';
 }
 private prompt(audioName:string):{text:string;language:string} {
  const language=(audioName.match(/_(en|hi|te)$/)?.[1]||process.env.INFOBIP_LANGUAGE||'en').slice(0,2);
  if(audioName.includes('_intro_'))return {language,text:'Hello. This is an automated recruitment screening call from HROS. We are calling about a job opportunity. You may hang up at any time if you do not wish to continue.'};
  if(audioName.includes('_role_'))return {language,text:'We are contacting you regarding a job opportunity. Please listen to the next question.'};
  return {language,text:'Are you interested in discussing this job opportunity? Press 1 if you are interested, or press 2 if you are not interested.'};
 }
 async playAudio(id:string,audioName:string):Promise<void> {
  if(!this.states.has(id))throw new Error('Unknown Infobip call ID');
  const prompt=this.prompt(audioName);
  await this.request('/calls/1/calls/'+encodeURIComponent(id)+'/say',{callId:id,text:prompt.text,language:prompt.language,loopCount:1,stopOn:{type:'DTMF',terminator:'any'}});
  const event=await this.waitFor(id,['SAY_FINISHED'],60000);
  if(!event&&!this.state(id).ended)throw new Error('Timed out waiting for Infobip SAY_FINISHED event; verify the event subscription and public webhook');
 }
 async collectDtmf(id:string,timeoutMs:number):Promise<string|null> {
  const state=this.state(id);if(state.ended)return state.digit??null;state.digit=undefined;
  await this.request('/calls/1/calls/'+encodeURIComponent(id)+'/capture-dtmf',{callId:id,maxLength:1,timeout:Math.max(1,Math.ceil(timeoutMs/1000)),terminator:'#'});
  await this.waitFor(id,['__DTMF__'],timeoutMs+2500);return state.digit??null;
 }
 async endCall(id:string):Promise<void> {
  const state=this.states.get(id);if(!state)return;
  if(!state.ended){try{await this.request('/calls/1/calls/'+encodeURIComponent(id)+'/hangup',{});}catch{/* call may already have ended */}}
  state.ended=true;for(const waiter of [...state.waiters]){clearTimeout(waiter.timer);state.waiters.delete(waiter);waiter.resolve(null);}
 }
 shutdown():void {for(const state of this.states.values())for(const waiter of state.waiters){clearTimeout(waiter.timer);waiter.resolve(null);}this.states.clear();}
}
