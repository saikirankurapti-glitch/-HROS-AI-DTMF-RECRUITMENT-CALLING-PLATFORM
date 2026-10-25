import {Activity,AlertTriangle,BookOpen,CheckCircle2,ExternalLink,LockKeyhole,PhoneCall,Server,Settings2,ShieldCheck,Wifi} from 'lucide-react';
import {COUNT} from '../lib/client';
import type {Workspace} from '../lib/useWorkspace';
import {Badge,Panel} from '../components/ui';
const repo='https://github.com/saikirankurapti-glitch/-HROS-AI-DTMF-RECRUITMENT-CALLING-PLATFORM/blob/feat/hros-mvp/';
export function Telephony({work}:{work:Workspace}){
 const sys=work.system;
 return <>
  <section className="page-header"><div><div className="eyebrow">INTEGRATIONS / PROVIDERS</div><h1>Telephony integration</h1><p>Inspect the current adapter mode and follow setup guidance for local SIP testing.</p></div></section>
  <div className="integration-hero"><div className="integration-icon"><PhoneCall size={25}/></div><div><span className="eyebrow">CONFIGURED PROVIDER</span><h2>{sys?.provider==='asterisk'?'Asterisk ARI':'MockTelephonyProvider'}</h2><p>{sys?.simulated===false?'Asterisk adapter is selected. Live SIP connectivity and audio playback are not verified by this endpoint.':'This adapter produces deterministic, simulated call outcomes with no public calling provider.'}</p></div><Badge value={sys?.simulated===false?'ASTERISK MODE':'MOCK MODE'} tone={sys?.simulated===false?'warning':'info'}/></div>
  <div className="dashboard-two">
   <Panel title="Environment status" subtitle="Values reported by the protected HROS system endpoint">
    <div className="setting-list"><div><span><Server size={17}/> Provider adapter</span><strong>{sys?.provider??'Checking...'}</strong></div><div><span><Activity size={17}/> Active engine calls</span><strong>{COUNT(sys?.activeCalls)}</strong></div>
     <div><span><ShieldCheck size={17}/> Result type</span><Badge value={sys?.simulated===false?'LIVE ADAPTER':'SIMULATED'} tone={sys?.simulated===false?'warning':'info'}/></div><div><span><LockKeyhole size={17}/> Public calling setting</span><Badge value={sys?.publicCallingEnabled?'ENABLED':'DISABLED'} tone={sys?.publicCallingEnabled?'danger':'success'}/></div></div>
    <div className="safe-note"><ShieldCheck size={17}/> This page is read-only. No browser toggle can enable public calling or expose SIP credentials.</div>
   </Panel>
   <Panel title="Integration readiness" subtitle="Production availability requires separate verification">
    <div className="readiness-list"><div><CheckCircle2 size={18}/><div><strong>Mock calling adapter</strong><span>Available for local development and automated tests</span></div></div>
     <div><AlertTriangle size={18}/><div><strong>Live SIP call verification</strong><span>Not established by the dashboard. Test with registered softphones and approved provider.</span></div></div>
     <div><AlertTriangle size={18}/><div><strong>Audio and ARI recovery</strong><span>Playback event synchronization and reconnection require further work.</span></div></div></div>
   </Panel>
  </div>
  <Panel title="Setup and documentation" subtitle="Server configuration is managed outside the browser">
   <div className="doc-links"><a href={repo+'docs/telephony.md'} target="_blank" rel="noreferrer"><PhoneCall size={18}/><span><strong>Local SIP & Asterisk setup</strong><small>Softphone registration, audio naming, and provider adapter</small></span><ExternalLink size={15}/></a>
    <a href={repo+'docs/compliance.md'} target="_blank" rel="noreferrer"><BookOpen size={18}/><span><strong>Telecom & privacy checklist</strong><small>Consent, opt-out, caller authorization, and operating policies</small></span><ExternalLink size={15}/></a>
    <a href={repo+'docs/troubleshooting.md'} target="_blank" rel="noreferrer"><Wifi size={18}/><span><strong>Troubleshooting guide</strong><small>API health, local SIP registration, and audio debugging</small></span><ExternalLink size={15}/></a></div>
  </Panel>
 </>;
}
export function Settings({work,onLogout}:{work:Workspace;onLogout:()=>void}){
 return <>
  <section className="page-header"><div><div className="eyebrow">WORKSPACE / ADMINISTRATION</div><h1>Workspace settings</h1><p>View the available configuration and manage the current administrator session.</p></div></section>
  <div className="dashboard-two">
   <Panel title="Account" subtitle="Current single-administrator authentication">
    <div className="profile-summary"><span className="account-avatar large">HR</span><div><strong>HR Administrator</strong><span>admin · Local HROS workspace</span></div></div>
    <div className="setting-list"><div><span>Authentication</span><strong>Environment-based admin credentials</strong></div><div><span>Session duration</span><strong>8 hours (server-issued token)</strong></div><div><span>Workspace access</span><Badge value="AUTHENTICATED" tone="success"/></div></div>
    <button className="settings-signout" onClick={onLogout}><LockKeyhole size={17}/> Sign out of workspace</button>
   </Panel>
   <Panel title="Operational defaults" subtitle="Policies enforced by the backend, not editable here">
    <div className="setting-list"><div><span><Settings2 size={17}/> Provider</span><strong>{work.system?.provider??'Checking...'}</strong></div><div><span><ShieldCheck size={17}/> Result integrity</span><strong>Simulated calls labeled</strong></div>
     <div><span><PhoneCall size={17}/> Public dialing</span><Badge value={work.system?.publicCallingEnabled?'ENABLED':'DISABLED'} tone={work.system?.publicCallingEnabled?'danger':'success'}/></div></div>
    <div className="safe-note">Campaign language, scheduling, and retry limits are set when creating campaigns. Concurrency and network credentials are controlled using server environment variables.</div>
   </Panel>
  </div>
  <div className="inline-info"><AlertTriangle size={18}/> <span>HROS is an MVP. Do not treat these controls as enterprise RBAC, provider certification, or completed telecom compliance.</span></div>
 </>;
}
