export type FreshnessState='current'|'review-soon'|'needs-review';

const DAY=86_400_000;

export function listingFreshness(lastVerified:string,now=new Date()){
  const verified=new Date(`${lastVerified}T00:00:00Z`);
  const days=Number.isNaN(verified.getTime())?Number.POSITIVE_INFINITY:Math.max(0,Math.floor((now.getTime()-verified.getTime())/DAY));
  const state:FreshnessState=days<=45?'current':days<=90?'review-soon':'needs-review';
  const label=state==='current'?'Recently checked':state==='review-soon'?'Review soon':'Needs rechecking';
  return{days,state,label};
}
