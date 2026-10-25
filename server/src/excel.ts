import ExcelJS from 'exceljs';
import type { Database } from './db.js';
import { getRows } from './db.js';
import { candidateInput, mappingSchema, normalizePhone, parseBoolean } from './validation.js';
import type { Candidate } from './types.js';

export interface PreviewRow { row:number; value:Record<string,unknown>|null; errors:string[] }
const headers=['name','phone','email','location','role','scenario','consent'] as const;
function plain(value:ExcelJS.CellValue):string {
 if(value===null||value===undefined)return '';
 if(typeof value==='object') {
  if('text' in value)return String(value.text);
  if('result' in value)return String(value.result??'');
  return '';
 }
 return String(value);
}
export async function inspectExcel(file:Buffer,db:Database,mappingInput:unknown={}):Promise<PreviewRow[]> {
 const mapping=mappingSchema.parse(mappingInput);
 const book=new ExcelJS.Workbook();
 await book.xlsx.load(file as any);
 const sheet=book.worksheets[0];
 if(!sheet)throw new Error('Excel workbook must contain a worksheet');
 const headerMap=new Map<string,number>();
 sheet.getRow(1).eachCell((cell,col)=>headerMap.set(plain(cell.value).trim().toLowerCase(),col));
 for(const required of ['name','phone','email','role','consent']) {
  if(!headerMap.has(mapping[required as keyof typeof mapping].toLowerCase()))
   throw new Error('Missing required column: '+mapping[required as keyof typeof mapping]);
 }
 const rows:PreviewRow[]=[];
 const seen=new Set<string>();
 for(let index=2;index<=sheet.rowCount;index++){
  const row=sheet.getRow(index);
  if(!row.hasValues)continue;
  const raw:Record<string,string>={};
  for(const h of headers) {
   const col=headerMap.get(mapping[h].toLowerCase());
   raw[h]=col?plain(row.getCell(col).value).trim():'';
  }
  const errors:string[]=[];
  let value:Record<string,unknown>|null=null;
  try {
   const phone=normalizePhone(raw.phone,process.env.TELEPHONY_MODE==='asterisk' && process.env.MOCK_ONLY!=='false');
   const data=candidateInput.parse({
    name:raw.name, phone, email:raw.email,
    location:raw.location||'', role:raw.role,
    scenario:raw.scenario||'interested',consent:parseBoolean(raw.consent),
    consent_source:'excel-import'
   });
   value=data;
   if(seen.has(phone)) errors.push('Duplicate phone in uploaded file');
   seen.add(phone);
   if(db.prepare('SELECT id FROM candidates WHERE phone=?').get(phone))
    errors.push('Phone already exists in database');
   if(!data.consent)errors.push('Explicit consent is required before adding a callable candidate');
  }catch(e) {
   if(e instanceof Error)errors.push(e.message.slice(0,300));
  }
  rows.push({row:index,value,errors});
 }
 if(rows.length===0)throw new Error('The Excel file has no candidate rows');
 if(rows.length>10000)throw new Error('Maximum 10,000 rows per import');
 return rows;
}
export function importPreview(db:Database,rows:PreviewRow[]):number {
 if(rows.some(r=>r.errors.length)||rows.some(r=>!r.value))throw new Error('Resolve all preview validation errors before import');
 let count=0;
 db.exec('BEGIN IMMEDIATE');
 try{
  for(const row of rows){
   const c=row.value!;
   db.prepare('INSERT INTO candidates(name,phone,email,location,role,scenario,consent,consent_at,consent_source) VALUES(?,?,?,?,?,?,1,?,?)')
    .run(String(c.name),String(c.phone),String(c.email),String(c.location),String(c.role),String(c.scenario),new Date().toISOString(),String(c.consent_source));
   count++;
  }
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 return count;
}
function safeCell(value:unknown):string|number|null {
 if(value===null||value===undefined)return null;
 if(typeof value==='number')return value;
 const str=String(value);
 // Prevent spreadsheet formula injection in exported data.
 return /^[=+\-@\t\r]/.test(str)?"'"+str:str;
}
export async function reportWorkbook(db:Database,campaignId:number):Promise<Buffer> {
 const book=new ExcelJS.Workbook();
 const sheet=book.addWorksheet('Call Results');
 sheet.columns=[
  {header:'Campaign',key:'campaign',width:24},{header:'Candidate',key:'candidate',width:24},
  {header:'Phone',key:'phone',width:19},{header:'Email',key:'email',width:28},
  {header:'Role',key:'role',width:25},{header:'Attempt',key:'attempt',width:12},
  {header:'Status',key:'status',width:20},{header:'DTMF Result',key:'result',width:22},
  {header:'Started At',key:'started',width:27},{header:'Answered At',key:'answered',width:27},
  {header:'Ended At',key:'ended',width:27},{header:'Duration Seconds',key:'duration',width:18},
  {header:'Provider Call ID',key:'providerId',width:40},{header:'Simulated',key:'simulated',width:12},
  {header:'Error',key:'error',width:40}
 ];
 const rows=getRows<Record<string,string|number|null>>(db,
  'SELECT cp.name campaign,c.name candidate,c.phone,c.email,c.role,cl.attempt_number attempt,cl.status,cl.dtmf_response result,cl.started_at started,cl.answered_at answered,cl.ended_at ended,cl.duration_seconds duration,cl.provider_call_id providerId,cl.simulated,cl.error_message error FROM calls cl JOIN candidates c ON cl.candidate_id=c.id JOIN campaigns cp ON cl.campaign_id=cp.id WHERE cp.id=? ORDER BY cl.id',campaignId);
 for(const r of rows) {
  sheet.addRow(Object.fromEntries(Object.entries(r).map(([k,v])=>[k,safeCell(v)])));
 }
 sheet.getRow(1).font={bold:true};
 sheet.views=[{state:'frozen',ySplit:1}];
 const buf=await book.xlsx.writeBuffer();
 return Buffer.from(buf);
}
export async function candidateWorkbook(candidates:Candidate[]):Promise<Buffer> {
 const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Candidates');
 sheet.addRow(['Name','Phone','Email','Location','Job Role','Consented','Opted Out']);
 for(const c of candidates)sheet.addRow([safeCell(c.name),safeCell(c.phone),safeCell(c.email),safeCell(c.location),safeCell(c.role),c.consent===1?'Yes':'No',c.opt_out===1?'Yes':'No']);
 sheet.getRow(1).font={bold:true};
 return Buffer.from(await book.xlsx.writeBuffer());
}
