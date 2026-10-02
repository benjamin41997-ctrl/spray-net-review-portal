export const platforms = ['google','angi','thumbtack','apple','yelp'] as const;
export type Platform = typeof platforms[number];
export type Job = {id:string;internal_name:string;title:string;source:string;status:string;links:Record<string,string>;demo:number;revision:number;created_at:string;updated_at:string;photos:Photo[];qrs?:QR[]};
export type Photo = {id:string;job_id:string;label:string;kind:string;position:number;mime:string};
export type QR = {token:string;label:string;batch_id:string;job_id:string|null;assigned_at:string|null};
