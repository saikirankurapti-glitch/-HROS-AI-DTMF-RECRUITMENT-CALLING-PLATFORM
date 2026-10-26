export type Scenario = 'interested'|'not_interested'|'no_input'|'invalid'|'no_answer'|'busy'|'failed';
export type CallStatus = 'INIT'|'CALLING'|'ANSWERED'|'INTRODUCTION'|'ROLE_DESCRIPTION'|'AVAILABILITY_QUESTION'|'WAITING_FOR_DTMF'|'COMPLETED'|'NO_ANSWER'|'BUSY'|'FAILED'|'CANCELLED';
export type CampaignStatus = 'DRAFT'|'SCHEDULED'|'RUNNING'|'PAUSED'|'COMPLETED'|'CANCELLED';
export interface Candidate {
 id:number; name:string; phone:string; email:string; location:string; role:string;
 scenario: Scenario; consent: number; opt_out:number; consent_at:string|null;
}
export interface Campaign {
 id:number; name:string; job_role:string; language:string; status:CampaignStatus;
 retry_limit:number; scheduled_at:string|null;
}
export interface Call {
 id:number; campaign_id:number; candidate_id:number; provider:string; provider_call_id:string|null;
 status:CallStatus; dtmf_response:string|null; attempt_number:number;
 started_at:string; answered_at:string|null; ended_at:string|null;
 duration_seconds:number|null; error_message:string|null; simulated:number;
}
