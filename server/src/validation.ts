import { z } from 'zod';
export const scenarios = ['interested','not_interested','no_input','invalid','no_answer','busy','failed'] as const;
export const campaignInput = z.object({
 name:z.string().trim().min(2).max(120),
 job_role:z.string().trim().min(2).max(100),
 language:z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default('en'),
 retry_limit:z.number().int().min(0).max(5).default(1),
 scheduled_at:z.string().datetime({offset:true}).nullable().optional()
}).strict();
export const mappingSchema = z.object({
 name:z.string().default('name'),phone:z.string().default('phone'),
 email:z.string().default('email'),location:z.string().default('location'),
 role:z.string().default('role'),consent:z.string().default('consent'),
 scenario:z.string().default('scenario')
});
export function normalizePhone(input:unknown, allowExtension=false):string {
 const raw=String(input??'').trim();
 if (allowExtension && /^1[0-9]{3}$/.test(raw)) return raw;
 const digits=raw.replace(/[()\s.-]/g,'');
 if (!/^\+?[1-9]\d{7,14}$/.test(digits)) throw new Error('Phone must contain 8–15 digits with optional + prefix');
 return digits.startsWith('+')?digits:'+'+digits;
}
export const candidateInput = z.object({
 name:z.string().trim().min(2).max(100),
 phone:z.string(),
 email:z.email(),
 location:z.string().max(100).default(''),
 role:z.string().trim().min(2).max(100),
 scenario:z.enum(scenarios).default('interested'),
 consent:z.boolean(),
 consent_source:z.string().max(120).default('excel-import')
}).strict();
export function parseBoolean(v:unknown):boolean {
 return v===true||v===1||String(v??'').trim().toLowerCase()==='true'||String(v??'').trim().toLowerCase()==='yes'||String(v??'').trim()==='1';
}
