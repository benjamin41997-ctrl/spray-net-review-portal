export const reviewNeedsDetailMessage='Please add a few words about your actual project or experience, then check your review again. A short, honest review is fine.';

// Protect older API responses and saved drafts during deployment. This is a
// narrow fallback for assistant prompts, not a filter on customer sentiment.
export function isEditorFollowUp(text:string){
 return /^(?:could|can|would) you (?:please )?(?:share|provide|tell|add|describe)\b/i.test(text.trim())&&/\b(?:notes|project|experience|feedback|details|review)\b/i.test(text)
  || /^(?:please (?:share|provide|add|describe)\b|i (?:can(?:not|'t)|am unable to) (?:write|create|edit|format|help)\b)/i.test(text.trim());
}

export const reviewResultFormat={type:'json_schema',name:'review_edit',strict:true,schema:{
 type:'object',properties:{status:{type:'string',enum:['ready','needs_more_detail']},review:{type:'string'}},
 required:['status','review'],additionalProperties:false
}};
