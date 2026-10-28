import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import { createHmac,timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';
import type { Database } from './db.js';
import { audit,getRow,getRows } from './db.js';
import { authenticate,checkCredentials,token } from './auth.js';
import { campaignInput } from './validation.js';
import { inspectExcel,importPreview,reportWorkbook,candidateWorkbook } from './excel.js';
import type { CallingEngine } from './engine.js';
import type { Campaign,Candidate,Call } from './types.js';

type Fn=(req:Request,res:Response,next:NextFunction)=>Promise<unknown>;
const asyncRoute=(fn:Fn)=>(req:Request,res:Response,next:NextFunction)=>{Promise.resolve(fn(req,res,next)).catch(next);};
const numericId=(value:string):number=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw new Error('Invalid ID');return n;};
export function buildApp(db:Database,engine:CallingEngine) {
 const app=express();
 app.disable('x-powered-by');
 app.use(cors({origin:process.env.CLIENT_ORIGIN||'http://localhost:5173'}));
 app.use(express.json({limit:'128kb'}));
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1},fileFilter(_req,file,cb) {
  if(!/\.xlsx$/i.test(file.originalname))return cb(new Error('Only .xlsx files are supported'));
  cb(null,true);
 }}).single('file');
 app.get('/health',(_req,res)=>res.json({ok:true,mode:process.env.TELEPHONY_MODE||'mock',publicCallingEnabled:process.env.PUBLIC_CALLING_ENABLED==='true'}));
 app.post('/api/auth/login',(req,res)=>{
  if(!checkCredentials(req.body?.username,req.body?.password))return res.status(401).json({error:'Invalid credentials or server auth not configured'});
  return res.json({token:token()});
 });
 // Infobip Calls API events use a dedicated Basic-authenticated subscription webhook.
 // This URL must be publicly reachable over HTTPS; never use the dashboard session token here.
 app.post('/api/telephony/infobip/events',(req,res)=>{
  const username=process.env.INFOBIP_WEBHOOK_USERNAME;
  const password=process.env.INFOBIP_WEBHOOK_PASSWORD;
  if(!username||!password||username.startsWith('replace-')||password.startsWith('replace-'))
   return res.status(503).json({error:'Infobip event webhook is not configured'});
  const header=String(req.headers.authorization||'');
  const expected='Basic '+Buffer.from(username+':'+password).toString('base64');
  const a=Buffer.from(header),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))return res.status(401).set('WWW-Authenticate','Basic realm="HROS Infobip webhook"').json({error:'Unauthorized'});
  engine.handleProviderEvent(req.body);
  return res.status(200).end();
 });
 // This endpoint is signed independently, not accessible with a dashboard token.
 app.post('/api/telephony/events',(req,res)=>{
  const secret=process.env.CALL_WEBHOOK_SECRET;
  if(!secret||secret.startsWith('replace-'))return res.status(503).json({error:'Webhook disabled'});
  const signature=String(req.headers['x-hros-signature']||'');
  const expected=createHmac('sha256',secret).update(JSON.stringify(req.body)).digest('hex');
  const a=Buffer.from(signature),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))return res.status(403).json({error:'Invalid signature'});
  const {event_id,provider,type}=req.body??{};
  if(typeof event_id!=='string'||event_id.length>100||typeof provider!=='string'||typeof type!=='string')
   return res.status(400).json({error:'Invalid event'});
  const result=db.prepare('INSERT OR IGNORE INTO processed_events(provider,event_id) VALUES(?,?)').run(provider.slice(0,50),event_id);
  return res.json({accepted:result.changes===1,duplicate:result.changes===0});
 });
 app.use('/api',authenticate);
 app.get('/api/system',(_req,res)=>res.json({
  provider:process.env.TELEPHONY_MODE||'mock',
  simulated:!['asterisk','infobip'].includes(process.env.TELEPHONY_MODE||'mock'),
  publicCallingEnabled:process.env.PUBLIC_CALLING_ENABLED==='true',
  activeCalls:engine.activeCount()
 }));
 const uploadPromise=(req:Request,res:Response):Promise<void>=>new Promise((resolve,reject)=>upload(req,res,err=>err?reject(err):resolve()));
 function mapping(req:Request):unknown{
  if(!req.body?.mapping)return {};
  try {return JSON.parse(req.body.mapping);}catch{throw new Error('Invalid mapping JSON');}
 }
 app.post('/api/candidates/preview',asyncRoute(async(req,res)=>{
  await uploadPromise(req,res);
  if(!req.file)throw new Error('Upload a file using the file field');
  const rows=await inspectExcel(req.file.buffer,db,mapping(req));
  res.json({total:rows.length,valid:rows.filter(r=>!r.errors.length).length,rows});
 }));
 app.post('/api/candidates/import',asyncRoute(async(req,res)=>{
  await uploadPromise(req,res);
  if(!req.file)throw new Error('Upload a file using the file field');
  const rows=await inspectExcel(req.file.buffer,db,mapping(req));
  if(rows.some(r=>r.errors.length))return res.status(422).json({error:'Import rejected: resolve all row-level issues',rows});
  const imported=importPreview(db,rows);
  audit(db,'admin','import','candidate',undefined,{imported});
  return res.status(201).json({imported});
 }));
 app.get('/api/candidates',(_req,res)=>res.json(getRows<Candidate>(db,'SELECT * FROM candidates ORDER BY id DESC LIMIT 10000')));
 app.get('/api/candidates/export',asyncRoute(async(_req,res)=>{
  const buf=await candidateWorkbook(getRows<Candidate>(db,'SELECT * FROM candidates ORDER BY id'));
  res.setHeader('Content-Disposition','attachment; filename="hros-candidates.xlsx"');
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buf);
 }));
 app.patch('/api/candidates/:id/opt-out',(req,res)=>{
  const id=numericId(String(req.params.id));
  const row=getRow<Candidate>(db,'SELECT * FROM candidates WHERE id=?',id);
  if(!row)return res.status(404).json({error:'Candidate not found'});
  if(typeof req.body?.opt_out!=='boolean')return res.status(400).json({error:'opt_out must be boolean'});
  db.prepare("UPDATE candidates SET opt_out=?,updated_at=datetime('now') WHERE id=?").run(req.body.opt_out?1:0,id);
  audit(db,'admin','opt-out','candidate',id,{opt_out:req.body.opt_out});
  return res.json({ok:true});
 });
 app.get('/api/candidates/:id/history',(req,res)=>{
  const id=numericId(String(req.params.id));
  return res.json(getRows<Call>(db,'SELECT * FROM calls WHERE candidate_id=? ORDER BY id DESC',id));
 });
 app.get('/api/campaigns',(_req,res)=>res.json(getRows<Campaign>(db,'SELECT * FROM campaigns ORDER BY id DESC')));
 app.post('/api/campaigns',(req,res)=>{
  const data=campaignInput.parse(req.body);
  const result=db.prepare('INSERT INTO campaigns(name,job_role,language,status,retry_limit,scheduled_at) VALUES(?,?,?,?,?,?)')
   .run(data.name,data.job_role,data.language,data.scheduled_at?'SCHEDULED':'DRAFT',data.retry_limit,data.scheduled_at??null);
  const id=Number(result.lastInsertRowid);
  db.prepare('INSERT INTO campaign_candidates(campaign_id,candidate_id) SELECT ?,id FROM candidates WHERE lower(role)=lower(?) AND consent=1 AND opt_out=0')
   .run(id,data.job_role);
  audit(db,'admin','create','campaign',id);
  return res.status(201).json({...getRow<Campaign>(db,'SELECT * FROM campaigns WHERE id=?',id),assigned:getRow<{n:number}>(db,'SELECT count(*) n FROM campaign_candidates WHERE campaign_id=?',id)?.n??0});
 });
 app.patch('/api/campaigns/:id/:action',asyncRoute(async(req,res)=>{
  const id=numericId(String(req.params.id));
  const action=String(req.params.action);
  const campaign=getRow<Campaign>(db,'SELECT * FROM campaigns WHERE id=?',id);
  if(!campaign)return res.status(404).json({error:'Campaign not found'});
  const allowed:Record<string,Record<string,string>>={
   start:{DRAFT:'RUNNING',SCHEDULED:'RUNNING'},
   pause:{RUNNING:'PAUSED'},
   resume:{PAUSED:'RUNNING'},
   cancel:{DRAFT:'CANCELLED',SCHEDULED:'CANCELLED',RUNNING:'CANCELLED',PAUSED:'CANCELLED'}
  };
  const next=allowed[action]?.[campaign.status];
  if(!next)return res.status(409).json({error:'Invalid campaign transition: '+campaign.status+' → '+action});
  if(action==='cancel')await engine.cancelCampaign(id);
  else db.prepare('UPDATE campaigns SET status=? WHERE id=?').run(next,id);
  audit(db,'admin',action,'campaign',id);
  if(action==='start'||action==='resume')await engine.tick();
  return res.json(getRow<Campaign>(db,'SELECT * FROM campaigns WHERE id=?',id));
 }));
 app.get('/api/campaigns/:id/calls',(req,res)=>{
  const id=numericId(String(req.params.id));
  return res.json(getRows(db,'SELECT cl.*,c.name,c.phone,c.email FROM calls cl JOIN candidates c ON cl.candidate_id=c.id WHERE campaign_id=? ORDER BY cl.id DESC',id));
 });
 app.get('/api/calls/:id',(req,res)=>{
  const row=getRow<Call>(db,'SELECT * FROM calls WHERE id=?',numericId(String(req.params.id)));
  return row?res.json(row):res.status(404).json({error:'Call not found'});
 });
 app.post('/api/calls/:id/retry',(req,res)=>{
  const id=numericId(String(req.params.id));
  const call=getRow<Call>(db,'SELECT * FROM calls WHERE id=?',id);
  if(!call)return res.status(404).json({error:'Call not found'});
  const campaign=getRow<Campaign>(db,'SELECT * FROM campaigns WHERE id=?',call.campaign_id);
  const candidate=getRow<Candidate>(db,'SELECT * FROM candidates WHERE id=?',call.candidate_id);
  const latest=getRow<Call>(db,'SELECT * FROM calls WHERE campaign_id=? AND candidate_id=? ORDER BY attempt_number DESC LIMIT 1',call.campaign_id,call.candidate_id);
  if(!campaign||!candidate||!latest||latest.id!==id||candidate.opt_out||!candidate.consent||campaign.status==='CANCELLED'
    ||!['FAILED','BUSY','NO_ANSWER'].includes(call.status)||call.attempt_number>campaign.retry_limit)
   return res.status(409).json({error:'Retry not allowed'});
  db.prepare("UPDATE calls SET ended_at=? WHERE id=?").run(new Date(0).toISOString(),id);
  db.prepare("UPDATE campaigns SET status='RUNNING' WHERE id=?").run(campaign.id);
  audit(db,'admin','retry','call',id);
  return res.json({queued:true});
 });
 app.get('/api/campaigns/:id/analytics',(req,res)=>{
  const id=numericId(String(req.params.id));
  const c=getRow<Campaign>(db,'SELECT * FROM campaigns WHERE id=?',id);
  if(!c)return res.status(404).json({error:'Campaign not found'});
  const counts=getRow<Record<string,number>>(db,[
   'SELECT COUNT(*) total_calls,',
   "SUM(CASE WHEN answered_at IS NOT NULL THEN 1 ELSE 0 END) answered,",
   "SUM(CASE WHEN dtmf_response='INTERESTED' THEN 1 ELSE 0 END) interested,",
   "SUM(CASE WHEN dtmf_response='NOT_INTERESTED' THEN 1 ELSE 0 END) not_interested,",
   "SUM(CASE WHEN dtmf_response='NO_RESPONSE' THEN 1 ELSE 0 END) no_response,",
   "SUM(CASE WHEN status IN ('FAILED','BUSY','NO_ANSWER') THEN 1 ELSE 0 END) failed,",
   'SUM(CASE WHEN simulated=1 THEN 1 ELSE 0 END) simulated_calls',
   'FROM calls WHERE campaign_id=?'].join(' '),id);
  res.json({campaign:c,assigned:getRow<{n:number}>(db,'SELECT count(*) n FROM campaign_candidates WHERE campaign_id=?',id)?.n??0,
   ...Object.fromEntries(Object.entries(counts??{}).map(([k,v])=>[k,v??0]))});
 });
 app.get('/api/campaigns/:id/export',asyncRoute(async(req,res)=>{
  const id=numericId(String(req.params.id));
  if(!getRow(db,'SELECT id FROM campaigns WHERE id=?',id))return res.status(404).json({error:'Campaign not found'});
  const buf=await reportWorkbook(db,id);
  res.setHeader('Content-Disposition','attachment; filename="hros-campaign-'+id+'.xlsx"');
  return res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buf);
 }));
 app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{
  void _next;
  const invalid=err instanceof ZodError;
  const error=err instanceof Error?err.message:'Unexpected error';
  const code=invalid||/missing|required|Invalid|duplicate|Only|Upload|Phone|Excel|column|workbook/i.test(error)?400:500;
  if(code===500)console.error('API error',err);
  res.status(code).json({error:invalid?'Validation failed':error,details:invalid?(err as ZodError).issues:undefined});
 });
 return app;
}
