import {useState,type ReactNode} from 'react';
import {Activity,BarChart3,BriefcaseBusiness,ChevronDown,ChevronRight,FileClock,Headphones,LayoutDashboard,LogOut,Menu,PanelLeftClose,PanelLeftOpen,PhoneCall,Settings2,ShieldCheck,UsersRound,X} from 'lucide-react';
import {PAGE_NAMES,type Page,type SystemInfo} from '../lib/client';
import {Badge} from './ui';

const menu:[Page,string,typeof LayoutDashboard][]=[
 ['overview','Overview',LayoutDashboard],
 ['candidates','Candidates',UsersRound],
 ['campaigns','Campaigns',BriefcaseBusiness],
 ['monitor','Live Calls',Activity],
 ['history','Call History',FileClock],
 ['analytics','Analytics & Reports',BarChart3],
 ['telephony','Integrations / Telephony',PhoneCall],
 ['settings','Settings',Settings2]
];
export function Shell({page,onPage,system,onLogout,children}:{page:Page;onPage:(p:Page)=>void;system:SystemInfo|null;onLogout:()=>void;children:ReactNode}){
 const [collapsed,setCollapsed]=useState(false),[mobileOpen,setMobileOpen]=useState(false),[accountOpen,setAccountOpen]=useState(false);
 const navigate=(next:Page)=>{onPage(next);setMobileOpen(false);window.scrollTo?.(0,0);};
 return <div className={'app-shell '+(collapsed?'sidebar-collapsed':'')}>
  <aside className={'app-sidebar '+(mobileOpen?'mobile-open':'')}>
   <div className="brand-row">
    <button className="brand-button" aria-label="Go to Overview" onClick={()=>navigate('overview')}>
     <span className="brand-icon">H</span><span className="brand-text"><strong>HROS</strong><small>Talent operations</small></span>
    </button>
    <button className="sidebar-toggle" aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} onClick={()=>setCollapsed(x=>!x)}>{collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button>
    <button className="mobile-close" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}><X size={19}/></button>
   </div>
   <div className="workspace-switcher"><div className="workspace-avatar">G</div><div className="workspace-details"><strong>Recruitment Workspace</strong><span>HROS / Operations</span></div><ChevronDown size={14}/></div>
   <nav aria-label="Primary navigation" className="sidebar-nav">
    {menu.map(([key,label,Icon],i)=><div key={key}>
     {(i===0||i===3||i===6)&&<div className="nav-section">{i===0?'WORKSPACE':i===3?'OPERATIONS':'ADMINISTRATION'}</div>}
     <button className={'nav-link '+(page===key?'active':'')} title={label} aria-current={page===key?'page':undefined} onClick={()=>navigate(key)}>
      <Icon size={18} strokeWidth={1.8}/><span>{label}</span>{page===key&&<span className="active-indicator"/>}
     </button>
    </div>)}
   </nav>
   <div className="sidebar-footer">
    <div className="provider-card"><div className="provider-mark"><ShieldCheck size={17}/></div><div><strong>{system?.simulated===false?'Asterisk connected mode':'Simulation environment'}</strong><span>{system?.simulated===false?'ARI adapter configured':'Safe for mock testing'}</span></div></div>
    <a href="https://github.com/saikirankurapti-glitch/-HROS-AI-DTMF-RECRUITMENT-CALLING-PLATFORM/blob/feat/hros-mvp/README.md" target="_blank" rel="noreferrer" className="help-link"><Headphones size={16}/><span>Help & documentation</span></a>
   </div>
  </aside>
  {mobileOpen&&<button className="mobile-scrim" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/>}
  <div className="app-main">
   <header className="app-topbar">
    <div className="crumbs"><button className="mobile-menu" aria-label="Open navigation" onClick={()=>setMobileOpen(true)}><Menu size={21}/></button>
     <span className="breadcrumb-root">HROS workspace</span><ChevronRight size={15}/><strong>{PAGE_NAMES[page]}</strong>
    </div>
    <div className="topbar-right"><div className={'environment-pill '+(system?.simulated===false?'env-live':'env-mock')}><span className="environment-dot"/>{system?.simulated===false?'ASTERISK MODE':'MOCK MODE'}</div>
     <button className="account-trigger" aria-expanded={accountOpen} aria-label="Account menu" onClick={()=>setAccountOpen(x=>!x)}><span className="account-avatar">HR</span><span className="account-copy"><strong>HR Administrator</strong><small>Workspace admin</small></span><ChevronDown size={14}/></button>
     {accountOpen&&<div className="account-menu"><div className="account-meta">Signed in as <strong>admin</strong></div><button onClick={()=>{setAccountOpen(false);navigate('settings');}}><Settings2 size={15}/> Workspace settings</button><button onClick={()=>{setAccountOpen(false);onLogout();}}><LogOut size={15}/> Sign out</button></div>}
    </div>
   </header>
   <div className="main-scroll"><main className="main-content">{children}</main><footer className="app-footer"><span>HROS • Recruitment calling workspace</span><span><Badge value={system?.simulated===false?'ASTERISK':'SIMULATED'} tone={system?.simulated===false?'warning':'info'}/> <span className="footer-status">Data from your local HROS API</span></span></footer></div>
  </div>
 </div>;
}
