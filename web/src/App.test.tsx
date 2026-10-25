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
