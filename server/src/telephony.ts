import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import type { Candidate, Scenario } from './types.js';
import { InfobipTelephonyProvider } from './infobip.js';

export type AnswerState = 'answered'|'no_answer'|'busy'|'failed';
export interface TelephonyProvider {
 readonly name: string;
 readonly simulated: boolean;
 startCall(candidate:Candidate):Promise<string>;
 waitForAnswer(callId:string, timeoutMs:number):Promise<AnswerState>;
 playAudio(callId:string, audioName:string):Promise<void>;
 collectDtmf(callId:string, timeoutMs:number):Promise<string|null>;
 endCall(callId:string):Promise<void>;
 shutdown():void;
 handleEvent?(payload:unknown):void;
}
export class MockTelephonyProvider implements TelephonyProvider {
 readonly name='mock'; readonly simulated=true;
 private scenarios=new Map<string,Scenario>();
 async startCall(candidate:Candidate):Promise<string> {
  const id='mock-'+randomUUID();
  this.scenarios.set(id,candidate.scenario);
  return id;
 }
 async waitForAnswer(id:string):Promise<AnswerState> {
  const value=this.scenarios.get(id);
  if(value==='no_answer'||value==='busy'||value==='failed') return value;
  return 'answered';
 }
 async playAudio():Promise<void> {/* deliberate no-op: all mock audio is simulated */}
 async collectDtmf(id:string):Promise<string|null> {
  const value=this.scenarios.get(id);
  if(value==='interested') return '1';
  if(value==='not_interested') return '2';
  if(value==='invalid') return '9';
  return null;
 }
 async endCall(id:string):Promise<void> {this.scenarios.delete(id);}
 shutdown():void {this.scenarios.clear();}
}
type LiveState={ answer?:AnswerState; digit?:string; destroyed?:boolean };
export class AsteriskTelephonyProvider implements TelephonyProvider {
 readonly name='asterisk'; readonly simulated=false;
 private emitter=new EventEmitter();
 private states=new Map<string,LiveState>();
 private socket:WebSocket;
 private base:string;
 private auth:string;
 private app:string;
 constructor() {
  this.base=process.env.ASTERISK_ARI_URL||'http://asterisk:8088/ari';
  const user=process.env.ASTERISK_ARI_USER||'hros';
  const password=process.env.ASTERISK_ARI_PASSWORD;
  if(!password) throw new Error('AST ERISK_ARI_PASSWORD must be configured'.replace('AST ERISK','ASTERISK'));
  this.auth='Basic '+Buffer.from(user+':'+password).toString('base64');
  this.app=process.env.ASTERISK_APP||'hros';
  const eventUrl=new URL(this.base+'/events');
  eventUrl.protocol=eventUrl.protocol==='https:'?'wss:':'ws:';
  eventUrl.searchParams.set('app',this.app);
  eventUrl.searchParams.set('api_key',user+':'+password);
  this.socket=new WebSocket(eventUrl.toString());
  this.socket.on('message',(data)=> {
   try {this.onEvent(JSON.parse(String(data)));} catch { /* discard malformed event */ }
  });
  this.socket.on('error',()=>{/* reconnect is handled by service restart */});
 }
 private onEvent(e:any):void {
  const id=String(e.channel?.id||'');
  if(!id||!this.states.has(id)) return;
  const state=this.states.get(id)!;
  if ((e.type==='ChannelStateChange'||e.type==='StasisStart')&&e.channel?.state==='Up') {
   state.answer='answered'; this.emitter.emit(id+':answer');
  }
  if(e.type==='ChannelDtmfReceived' && /^[0-9*#]$/.test(String(e.digit))) {
   state.digit=String(e.digit); this.emitter.emit(id+':digit');
  }
  if(e.type==='ChannelDestroyed'||e.type==='StasisEnd') {
   state.destroyed=true;
   if(!state.answer) {
    const cause=Number(e.cause??e.channel?.cause);
    state.answer=cause===17?'busy':(cause===19||cause===18)?'no_answer':'failed';
   }
   this.emitter.emit(id+':answer'); this.emitter.emit(id+':digit');
  }
 }
 private async request(path:string,method='POST',query?:URLSearchParams):Promise<any> {
  const url=new URL(this.base+path);
  if(query) url.search=query.toString();
  const res=await fetch(url,{method,headers:{Authorization:this.auth}});
  if(!res.ok) throw new Error('Asterisk ARI '+res.status+' '+(await res.text()).slice(0,200));
  if(res.status===204) return null;
  const body=await res.text();
  try{return JSON.parse(body);}catch{return body;}
 }
 async startCall(candidate:Candidate):Promise<string> {
  const number=candidate.phone;
  const local=/^1[0-9]{3}$/.test(number);
  if(!local) {
   if(process.env.PUBLIC_CALLING_ENABLED!=='true'||process.env.MOCK_ONLY!=='false')
    throw new Error('Public destinations disabled: explicit authorization required');
   if(!/^\+[1-9][0-9]{7,14}$/.test(number)) throw new Error('Invalid public destination');
  }
  const callerId=process.env.ASTERISK_CALLER_ID;
  if(!callerId) throw new Error('Set authorized ASTERISK_CALLER_ID for Asterisk calling');
  const id=randomUUID();
  this.states.set(id,{});
  const q=new URLSearchParams({endpoint:'PJSIP/'+number,app:this.app,channelId:id,callerId,timeout:'25'});
  try {await this.request('/channels','POST',q);}catch(e){this.states.delete(id);throw e;}
  return id;
 }
 private waitSignal(id:string,event:string,ready:()=>boolean,ms:number):Promise<void> {
  if(ready()) return Promise.resolve();
  return new Promise(resolve=>{
   const fn=()=>{if(ready()){clearTimeout(timer);this.emitter.off(id+':'+event,fn);resolve();}};
   const timer=setTimeout(()=>{this.emitter.off(id+':'+event,fn);resolve();},ms);
   this.emitter.on(id+':'+event,fn);
  });
 }
 async waitForAnswer(id:string,timeoutMs:number):Promise<AnswerState> {
  const state=this.states.get(id);
  if(!state) return 'failed';
  await this.waitSignal(id,'answer',()=>Boolean(state.answer),timeoutMs);
  return state.answer??'no_answer';
 }
 async playAudio(id:string,audioName:string):Promise<void> {
  if(!/^[a-zA-Z0-9_-]+$/.test(audioName)) throw new Error('Invalid audio identifier');
  await this.request('/channels/'+encodeURIComponent(id)+'/play','POST',new URLSearchParams({media:'sound:hros/'+audioName}));
  // This starts playback; configure WAV lengths and timings to allow playback to complete.
  await new Promise(resolve=>setTimeout(resolve,3000));
 }
 async collectDtmf(id:string,timeoutMs:number):Promise<string|null> {
  const state=this.states.get(id);
  if(!state||state.destroyed) return null;
  await this.waitSignal(id,'digit',()=>Boolean(state.digit||state.destroyed),timeoutMs);
  const digit=state.digit??null;
  state.digit=undefined;
  return digit;
 }
 async endCall(id:string):Promise<void> {
  if(!this.states.has(id)) return;
  try {await this.request('/channels/'+encodeURIComponent(id),'DELETE');}catch{/* already hung up */}
  this.states.delete(id);
 }
 shutdown():void {this.socket.close();this.emitter.removeAllListeners();}
}
export function createProvider():TelephonyProvider {
 if(process.env.TELEPHONY_MODE==='asterisk') return new AsteriskTelephonyProvider();
 if(process.env.TELEPHONY_MODE==='infobip') return new InfobipTelephonyProvider();
 return new MockTelephonyProvider();
}
