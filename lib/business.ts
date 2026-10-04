// Public business destination; never put a customer's draft in this URL.
export const googleReviewURL='https://g.page/r/CdBR4AUNk5DkEAI/review';
export const businessReviewLinks:Record<string,string>={
 google:googleReviewURL,
 angi:'https://www.homeadvisor.com/review/164473227?hired=unknown&entry_point_id=33640456',
 thumbtack:'https://www.thumbtack.com/reviews/services/588047505566539776/write-customer-review',
 yelp:'https://www.yelp.com/biz/spray-net-south-charlotte-charlotte-2',
};
export const selectableReviewSources=['google','angi','thumbtack','yelp'] as const;
export function defaultReviewLinks(){return {google:googleReviewURL} as Record<string,string>;}
export function toggleReviewSource(links:Record<string,string>,platform:string,enabled:boolean){
 const next={...links};if(enabled)next[platform]=next[platform]||businessReviewLinks[platform];else delete next[platform];return next;
}
