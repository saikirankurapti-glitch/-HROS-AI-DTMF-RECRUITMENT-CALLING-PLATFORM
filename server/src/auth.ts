import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request,Response,NextFunction } from 'express';
function secret():string{return process.env.SESSION_SECRET||'';}
function sign(value:string):string{return createHmac('sha256',secret()).update(value).digest('base64url');}
export function checkCredentials(username:unknown,password:unknown):boolean {
 const u=String(process.env.HROS_USERNAME||'admin');
 const p=String(process.env.HROS_PASSWORD||'');
 if(!p||p==='replace-with-a-strong-unique-password'||!secret()||secret().startsWith('replace-'))return false;
 const candidate=String(username??'')+'\0'+String(password??'');
 const expected=u+'\0'+p;
 const a=createHmac('sha256',secret()).update(candidate).digest();
 const b=createHmac('sha256',secret()).update(expected).digest();
 return timingSafeEqual(a,b);
}
export function token():string {
 const payload=Buffer.from(JSON.stringify({sub:'admin',exp:Date.now()+8*60*60*1000})).toString('base64url');
 return payload+'.'+sign(payload);
}
export function authenticate(req:Request,res:Response,next:NextFunction):void {
 const bearer=req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
 if(!bearer||!secret()){res.status(401).json({error:'Authentication required'});return;}
 const [payload,signature]=bearer.split('.');
 if(!payload||!signature){res.status(401).json({error:'Invalid token'});return;}
 const a=Buffer.from(signature);const b=Buffer.from(sign(payload));
 if(a.length!==b.length||!timingSafeEqual(a,b)){res.status(401).json({error:'Invalid token'});return;}
 try{
  const parsed=JSON.parse(Buffer.from(payload,'base64url').toString());
  if(parsed.sub!=='admin'||typeof parsed.exp!=='number'||parsed.exp<Date.now())throw Error();
 }catch{res.status(401).json({error:'Token expired or invalid'});return;}
 next();
}
