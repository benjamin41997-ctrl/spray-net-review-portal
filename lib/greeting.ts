export function customerGreeting(name:string){return name?`We loved working with you, ${name}!`:'We loved working with you!';}
export function greetingName(title:string){return /^We loved working with you, (.+)!$/.exec(title)?.[1]||'';}
export function publicGreeting(title:string){return customerGreeting(greetingName(title).trim());}
