import { openDatabase } from './db.js';
import { buildApp } from './app.js';
import { createProvider } from './telephony.js';
import { CallingEngine } from './engine.js';

if(process.env.NODE_ENV==='production') {
 for(const key of ['HROS_PASSWORD','SESSION_SECRET']){
  const value=process.env[key];
  if(!value||value.startsWith('replace-'))throw new Error('Missing secure environment variable: '+key);
 }
}
const db=openDatabase();
const provider=createProvider();
const engine=new CallingEngine(db,provider);
const app=buildApp(db,engine);
const port=Number(process.env.PORT||3001);
const server=app.listen(port,'0.0.0.0',()=>console.log('HROS API on port '+port+' ('+provider.name+')'));
engine.start();
function stop():void {engine.shutdown();server.close(()=>{db.close();process.exit(0);});}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
