import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',
 testMatch:'**/*.e2e.ts',
 timeout:60000,
 expect:{timeout:15000},
 retries:process.env.CI?1:0,
 use:{baseURL:'http://127.0.0.1:5173',...devices['Desktop Chrome']},
 webServer:[
  {command:'npm run dev --workspace=server',url:'http://127.0.0.1:3001/health',reuseExistingServer:!process.env.CI,
   env:{HROS_USERNAME:'admin',HROS_PASSWORD:'playwright-local-password',SESSION_SECRET:'playwright-local-secret-abcdefghijklmnopqrstuvwxyz',DATABASE_PATH:'/tmp/hros-playwright-test.db',TELEPHONY_MODE:'mock',MIN_SECONDS_BETWEEN_CALLS:'0'}},
  {command:'npm run dev --workspace=web',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI}
 ]
});
