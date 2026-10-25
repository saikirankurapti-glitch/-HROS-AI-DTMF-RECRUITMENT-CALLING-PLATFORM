import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import type {Database} from './db.js';
import {openDatabase,getRow,getRows} from './db.js';
import {MockTelephonyProvider} from './telephony.js';
import {CallingEngine,transition} from './engine.js';
import {buildApp} from './app.js';
import {inspectExcel,importPreview,reportWorkbook} from './excel.js';
import {normalizePhone} from './validation.js';
import type {Call,Campaign} from './types.js';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

process.env.HROS_USERNAME='admin';
process.env.HROS_PASSWORD='local-testing-only';
process.env.SESSION_SECRET='local-testing-secret-abcdefghijklmnopqrstuvwxyz';
process.env.TELEPHONY_MODE='mock';
process.env.MIN_SECONDS_BETWEEN_CALLS='0';
let db:Database,engine:CallingEngine;
function seed(scenario='interested',phone='+15550102001',role='Data Engineer'){
 const r=db.prepare("INSERT INTO candidates(name,phone,email,role,scenario,consent,consent_at) VALUES(?,?,?,?,?,1,?)")
  .run('Test Candidate',phone,'test@example.invalid',role,scenario,new Date().toISOString());
 return Number(r.lastInsertRowid);
}
function campaign(retry=1) {
 const id=Number(db.prepare("INSERT INTO campaigns(name,job_role,status,retry_limit) VALUES('QA Screening','Data Engineer','RUNNING',?)").run(retry).lastInsertRowid);
 db.prepare("INSERT INTO campaign_candidates(campaign_id,candidate_id) SELECT ?,id FROM candidates WHERE role='Data Engineer'").run(id);
 return id;
}
async function drain(){await new Promise(resolve=>setTimeout(resolve,40));}
async function workbook(values:(string|boolean)[][]){
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Candidates');
 sheet.addRow(['name','phone','email','location','role','consent','scenario']);
 values.forEach(v=>sheet.addRow(v));
 return Buffer.from(await book.xlsx.writeBuffer());
}
beforeEach(()=>{db=openDatabase(':memory:');engine=new CallingEngine(db,new MockTelephonyProvider());});
afterEach(()=>{engine.shutdown();db.close();});

describe('candidate validation and Excel import',()=>{
 it('normalizes valid phones and rejects invalid values',()=>{
  expect(normalizePhone(' +1 (555) 010-2233')).toBe('+15550102233');
  expect(()=>normalizePhone('12abc')).toThrow();
 });
 it('previews and imports atomically, rejecting duplicate rows',async()=>{
  const file=await workbook([
   ['Example Person','+15550102001','one@example.invalid','Hyderabad','Data Engineer',true,'interested'],
   ['Example Person Two','+15550102001','two@example.invalid','Hyderabad','Data Engineer',true,'busy']]);
  const rows=await inspectExcel(file,db);
  expect(rows).toHaveLength(2);
  expect(rows[1]?.errors.join()).toContain('Duplicate');
  expect(()=>importPreview(db,rows)).toThrow();
  expect(getRows(db,'SELECT * FROM candidates')).toHaveLength(0);
 });
 it('rejects candidate import without explicit consent',async()=>{
  const file=await workbook([['Sample User','+15550102001','one@example.invalid','','Data Engineer',false,'interested']]);
  const rows=await inspectExcel(file,db);
  expect(rows[0]?.errors.join()).toContain('consent');
 });
 it('imports valid records and identifies existing duplicates',async()=>{
  const file=await workbook([['Sample User','+15550102001','one@example.invalid','','Data Engineer',true,'interested']]);
  const rows=await inspectExcel(file,db);
  expect(importPreview(db,rows)).toBe(1);
  expect((await inspectExcel(file,db))[0]?.errors.join()).toContain('already exists');
 });
});
describe('calling lifecycle and deterministic mock DTMF',()=>{
 it.each([
  ['interested','COMPLETED','INTERESTED',true],
  ['not_interested','COMPLETED','NOT_INTERESTED',true],
  ['no_input','COMPLETED','NO_RESPONSE',true],
  ['invalid','COMPLETED','NO_RESPONSE',true],
  ['no_answer','NO_ANSWER',null,false],
  ['busy','BUSY',null,false],
  ['failed','FAILED',null,false]
 ])('handles %s',async(scenario,status,response,answered)=>{
  seed(scenario);const id=campaign(0);
  await engine.tick();await drain();
  const call=getRow<Call>(db,'SELECT * FROM calls WHERE campaign_id=?',id);
  expect(call?.status).toBe(status);
  expect(call?.dtmf_response).toBe(response);
  expect(Boolean(call?.answered_at)).toBe(answered);
  expect(call?.simulated).toBe(1);
  expect(call?.provider_call_id?.startsWith('mock-')).toBe(true);
  expect(call?.ended_at).toBeTruthy();
 });
 it('rejects invalid state transitions',()=>{
  const candidate=seed();const id=campaign();
  const call=Number(db.prepare("INSERT INTO calls(campaign_id,candidate_id,provider,attempt_number) VALUES(?,?,'mock',1)").run(id,candidate).lastInsertRowid);
  expect(()=>transition(db,call,'ANSWERED')).toThrow(/Invalid call transition/);
 });
 it('does not retry beyond the allowed limit and enforces backoff',async()=>{
  const c=seed('busy');const id=campaign(1);
  await engine.tick();await drain();await engine.tick();
  expect(getRows(db,'SELECT * FROM calls')).toHaveLength(1);
  db.prepare("UPDATE calls SET ended_at='1970-01-01T00:00:00.000Z'").run();
  db.prepare("UPDATE candidates SET scenario='interested' WHERE id=?").run(c);
  await engine.tick();await drain();
  expect(getRows(db,'SELECT * FROM calls')).toHaveLength(2);
  expect(getRow<Call>(db,'SELECT * FROM calls ORDER BY id DESC LIMIT 1')?.dtmf_response).toBe('INTERESTED');
  await engine.tick();
  expect(getRows(db,'SELECT * FROM calls')).toHaveLength(2);
  expect(getRow<Campaign>(db,'SELECT * FROM campaigns WHERE id=?',id)?.status).toBe('COMPLETED');
 });
 it('prevents calls to opted-out candidates',async()=>{
  const c=seed();const id=campaign();
  db.prepare('UPDATE candidates SET opt_out=1 WHERE id=?').run(c);
  await engine.tick();await drain();
  expect(getRows(db,'SELECT * FROM calls')).toHaveLength(0);
  expect(getRow<Campaign>(db,'SELECT * FROM campaigns WHERE id=?',id)?.status).toBe('COMPLETED');
 });
 it('prevents simultaneous dialing to a candidate across campaigns',async()=>{
  seed();campaign();campaign();
  await engine.tick();await drain();
  const calls=getRows<Call>(db,'SELECT * FROM calls');
  expect(calls.length).toBe(1);
 });
 it('persists call results across a database reopen',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hros-'));
  const file=join(dir,'calls.db');
  const persist=openDatabase(file);
  persist.prepare("INSERT INTO candidates(name,phone,email,role,consent) VALUES('Example','+15550102101','x@example.invalid','DE',1)").run();
  persist.close();
  const reopened=openDatabase(file);
  expect(getRows(reopened,'SELECT * FROM candidates')).toHaveLength(1);
  reopened.close();rmSync(dir,{recursive:true,force:true});
 });
 it('exports accurate Excel outcomes',async()=>{
  seed();const id=campaign(0);await engine.tick();await drain();
  const buf=await reportWorkbook(db,id);
  const book=new ExcelJS.Workbook();await book.xlsx.load(buf as any);
  expect(book.worksheets[0]?.getRow(2).getCell(8).text).toBe('INTERESTED');
 });
});
describe('protected API and campaign controls',()=>{
 it('rejects unauthenticated requests and incorrect login',async()=>{
  const app=buildApp(db,engine);
  expect((await request(app).get('/api/candidates')).status).toBe(401);
  expect((await request(app).post('/api/auth/login').send({username:'admin',password:'wrong'})).status).toBe(401);
 });
 it('creates campaigns and records mock results using API',async()=>{
  seed();const app=buildApp(db,engine);
  const signed=await request(app).post('/api/auth/login').send({username:'admin',password:'local-testing-only'});
  const auth={Authorization:'Bearer '+signed.body.token};
  const created=await request(app).post('/api/campaigns').set(auth).send({name:'Test',job_role:'Data Engineer',retry_limit:0});
  expect(created.status).toBe(201);
  expect(created.body.assigned).toBe(1);
  const started=await request(app).patch('/api/campaigns/'+created.body.id+'/start').set(auth);
  expect(started.status).toBe(200);
  await drain();
  const analytics=await request(app).get('/api/campaigns/'+created.body.id+'/analytics').set(auth);
  expect(analytics.body.interested).toBe(1);
  expect(analytics.body.simulated_calls).toBe(1);
 });
 it('does not process duplicate signed provider webhook events twice',async()=>{
  const {createHmac}=await import('node:crypto');
  process.env.CALL_WEBHOOK_SECRET='unit-test-webhook-secret';
  const app=buildApp(db,engine);
  const event={provider:'asterisk',event_id:'evt-123',type:'ChannelStateChange'};
  const signature=createHmac('sha256',process.env.CALL_WEBHOOK_SECRET).update(JSON.stringify(event)).digest('hex');
  const a=await request(app).post('/api/telephony/events').set('x-hros-signature',signature).send(event);
  const b=await request(app).post('/api/telephony/events').set('x-hros-signature',signature).send(event);
  expect(a.body.accepted).toBe(true);expect(b.body.duplicate).toBe(true);
 });
 it('refuses cancellation-to-running transitions',async()=>{
  seed();const app=buildApp(db,engine);
  const signed=await request(app).post('/api/auth/login').send({username:'admin',password:'local-testing-only'});
  const h={Authorization:'Bearer '+signed.body.token};
  const c=await request(app).post('/api/campaigns').set(h).send({name:'Canceled',job_role:'Data Engineer'});
  await request(app).patch('/api/campaigns/'+c.body.id+'/cancel').set(h);
  const restart=await request(app).patch('/api/campaigns/'+c.body.id+'/start').set(h);
  expect(restart.status).toBe(409);
 });
});
