import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import App from './App';

afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();});
it('renders a secure sign-in view',()=>{
 render(<App/>);
 expect(screen.getByText('Welcome back')).toBeTruthy();
 expect(screen.getByRole('button',{name:/sign in/i})).toBeTruthy();
});
it('shows campaign overview after authenticated login',async()=>{
 const fetcher=vi.fn().mockImplementation((url:string)=>{
  const response=url.endsWith('/auth/login')?{token:'test-token'}:
   url.endsWith('/candidates')?[]:url.endsWith('/campaigns')?[]:
   {provider:'mock',simulated:true,activeCalls:0};
  return Promise.resolve({ok:true,json:()=>Promise.resolve(response)});
 });
 vi.stubGlobal('fetch',fetcher);
 render(<App/>);
 fireEvent.change(screen.getByLabelText('Password'),{target:{value:'anything'}});
 fireEvent.click(screen.getByRole('button',{name:/sign in/i}));
 await waitFor(()=>expect(screen.getByText('Recruitment overview')).toBeTruthy());
 expect(screen.getByText('No campaigns yet')).toBeTruthy();
});

it('shows only API-derived KPIs and the actual mock environment',async()=>{
 const candidate={id:1,name:'Example Candidate',phone:'+15550101911',email:'example@example.invalid',location:'Test',role:'Data Engineer',consent:1,opt_out:0};
 const campaign={id:7,name:'Example Screening',job_role:'Data Engineer',status:'COMPLETED',retry_limit:0,language:'en',scheduled_at:null,created_at:'2026-10-26T00:00:00Z'};
 const call={id:11,campaign_id:7,candidate_id:1,name:'Example Candidate',phone:candidate.phone,status:'COMPLETED',dtmf_response:'INTERESTED',attempt_number:1,answered_at:'2026-10-26T00:00:00Z',started_at:'2026-10-26T00:00:00Z',ended_at:'2026-10-26T00:00:12Z',duration_seconds:12,provider:'mock',provider_call_id:'mock-fixture',simulated:1};
 const mock=vi.fn().mockImplementation((url:string)=>{
  const response=url.endsWith('/auth/login')?{token:'test-token'}:
   url.endsWith('/candidates')?[candidate]:url.endsWith('/campaigns')?[campaign]:
   url.endsWith('/system')?{provider:'mock',simulated:true,activeCalls:0,publicCallingEnabled:false}:
   url.endsWith('/campaigns/7/calls')?[call]:
   url.endsWith('/campaigns/7/analytics')?{assigned:1,total_calls:1,answered:1,interested:1,not_interested:0,no_response:0,failed:0,simulated_calls:1}:{};
  return Promise.resolve({ok:true,json:()=>Promise.resolve(response)});
 });
 vi.stubGlobal('fetch',mock);
 render(<App/>);
 fireEvent.change(screen.getByLabelText('Password'),{target:{value:'test'}});
 fireEvent.click(screen.getByRole('button',{name:/sign in/i}));
 await waitFor(()=>expect(screen.getByText('100%')).toBeTruthy());
 expect(screen.getByText('MOCK MODE')).toBeTruthy();
 expect(screen.getByText('Example Screening')).toBeTruthy();
});
it('shows a recoverable error when the HROS API is unavailable',async()=>{
 const mock=vi.fn().mockImplementation((url:string)=>{
  if(url.endsWith('/auth/login'))return Promise.resolve({ok:true,json:()=>Promise.resolve({token:'test-token'})});
  return Promise.reject(new Error('Network down'));
 });
 vi.stubGlobal('fetch',mock);
 render(<App/>);
 fireEvent.change(screen.getByLabelText('Password'),{target:{value:'test'}});
 fireEvent.click(screen.getByRole('button',{name:/sign in/i}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Network unavailable'));
});
