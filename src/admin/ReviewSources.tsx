import {useId} from 'react';
import {Switch} from '@/components/ui/switch';
import {businessReviewLinks,selectableReviewSources,toggleReviewSource} from '@/lib/business';
import {platformNames} from '@/lib/client';

export default function ReviewSources({links,onChange,disabled=false}:{links:Record<string,string>;onChange:(links:Record<string,string>)=>void;disabled?:boolean}){
 const id=useId();
 return <fieldset className="review-sources"><legend>Include these review sources</legend><div className="stack review-source-list">
  {selectableReviewSources.map(platform=><label className="review-source-option" key={platform} htmlFor={`${id}-${platform}`}>
   <span>{platformNames[platform]}{platform==='yelp'&&<small>Business-information link</small>}</span>
   <Switch id={`${id}-${platform}`} className="review-source-toggle" aria-label={platformNames[platform]} checked={!!links[platform]} disabled={disabled||!businessReviewLinks[platform]} onCheckedChange={enabled=>onChange(toggleReviewSource(links,platform,enabled))}/>
  </label>)}
 </div></fieldset>;
}
