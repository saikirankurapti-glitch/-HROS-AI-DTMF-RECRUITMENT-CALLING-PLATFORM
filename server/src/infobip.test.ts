import {afterEach,describe,expect,it,vi} from 'vitest';
import {InfobipTelephonyProvider} from './infobip.js';
import type {Candidate} from './types.js';

const candidate:Candidate={id:7,name:'Self Test',phone:'+919876543210',email:'self@example.invalid',location:'India',role:'Data Engineer',scenario:'interested',consent:1,opt_out:0,consent_at:new Date().toISOString()};
const oldFetch=globalThis.fetch;
const oldEnv={...process.env};
afterEach(()=>{globalThis.fetch=oldFetch;process.env={...oldEnv};vi.restoreAllMocks();});
function configure(){
 process.env.INFOBIP_API_KEY='unit-test-key';
 process.env.INFOBIP_CALLS_CONFIGURATION_ID='hros-outbound-test-01';
 process.env.INFOBIP_BASE_URL='https://ndlev2.api.infobip.com';
 process.env.PUBLIC_CALLING_ENABLED='true';
 process.env.MOCK_ONLY='false';
}
function response(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});}

describe('Infobip Calls API adapter',()=>{
 it('requires server-side API configuration',()=>{
  delete process.env.INFOBIP_API_KEY;
  expect(()=>new InfobipTelephonyProvider()).toThrow(/INFOBIP_API_KEY/);
 });
 it('blocks real calls until both explicit safety gates are enabled',async()=>{
  configure();process.env.PUBLIC_CALLING_ENABLED='false';
  const provider=new InfobipTelephonyProvider();
  await expect(provider.startCall(candidate)).rejects.toThrow(/public calls are disabled/i);
  provider.shutdown();
 });
 it('creates an outbound call with the Calls configuration and E.164 digits',async()=>{
  configure();
  const fetch=vi.fn(async()=>response({id:'call-123'}));globalThis.fetch=fetch as typeof globalThis.fetch;
  const provider=new InfobipTelephonyProvider();
  await expect(provider.startCall(candidate)).resolves.toBe('call-123');
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url,init]=fetch.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe('https://ndlev2.api.infobip.com/calls/1/calls');
  expect(init.headers).toMatchObject({Authorization:'App unit-test-key'});
  expect(JSON.parse(String(init.body))).toMatchObject({endpoint:{phoneNumber:'919876543210',type:'PHONE'},callsConfigurationId:'hros-outbound-test-01',connectTimeout:30,maxDuration:180});
  provider.shutdown();
 });
 it('maps provider call events to answer and DTMF states',async()=>{
  configure();globalThis.fetch=vi.fn(async()=>response({id:'call-456'})) as typeof globalThis.fetch;
  const provider=new InfobipTelephonyProvider();
  const id=await provider.startCall(candidate);
  provider.handleEvent({callId:id,type:'CALL_ESTABLISHED',properties:{}});
  await expect(provider.waitForAnswer(id,20)).resolves.toBe('answered');
  provider.handleEvent({callId:id,type:'DTMF_COLLECTED',properties:{dtmf:'2'}});
  await expect(provider.collectDtmf(id,20)).resolves.toBe('2');
  provider.shutdown();
 });
 it('rejects missing candidate consent and opted-out candidates',async()=>{
  configure();globalThis.fetch=vi.fn(async()=>response({id:'call-789'})) as typeof globalThis.fetch;
  const provider=new InfobipTelephonyProvider();
  await expect(provider.startCall({...candidate,consent:0})).rejects.toThrow(/consent/i);
  await expect(provider.startCall({...candidate,opt_out:1})).rejects.toThrow(/consent/i);
  expect(globalThis.fetch).not.toHaveBeenCalled();
  provider.shutdown();
 });
});
