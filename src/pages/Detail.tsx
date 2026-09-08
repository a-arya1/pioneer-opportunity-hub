import {useEffect} from 'react';
import {Link,useParams} from 'react-router-dom';
import data from '../data/opportunities.json';
import type {Opportunity} from '../types';
import {useSaved,type SavedStatus} from '../hooks/useSaved';
import {useAuth} from '../contexts/AuthContext';
import {useAnalytics} from '../contexts/AnalyticsContext';
import {listingFreshness} from '../lib/freshness';

const all=data as Opportunity[];

export default function Detail(){
  const {slug}=useParams();
  const o=all.find(item=>item.slug===slug);
  const saves=useSaved();
  const {user}=useAuth();
  const {track}=useAnalytics();
  const opportunityId=o?.id;
  const category=o?.category;
  useEffect(()=>{if(opportunityId)track('opportunity_view',{opportunityId,category})},[category,opportunityId,track]);
  if(!o)return <div className="state"><h1>That opportunity isn’t here.</h1><p>The listing may have moved or been removed.</p><Link className="button" to={`/opportunities?q=${encodeURIComponent(slug||'')}`}>Search similar listings</Link></div>;

  const rows=[['What you would do',o.summary],['Eligibility',o.eligibility],['Application requirements',o.requirements],['Deadline and important dates',o.deadlineText],['Schedule and commitment',o.schedule||o.effort],['Student cost',o.cost||'Not stated—do not assume free'],['Compensation',o.compensation||'Not stated'],['Location',o.location||o.format],['Transportation',o.transportation],['Accessibility','The provider has not published specific accessibility information. Contact the provider before relying on an accommodation.']];
  const freshness=listingFreshness(o.lastVerified);
  const currentStatus=saves.statuses[o.id]||'saved';
  const sourceClick=()=>track('official_source_click',{opportunityId:o.id,category:o.category});
  const mark=(status:SavedStatus)=>void saves.markStatus(o.id,status);

  return <article className="detail"><div className="breadcrumb"><Link to="/opportunities">Opportunities</Link> / {o.category}</div><header className="detail-head"><div><p className="kicker">{o.category}{o.subcategory?` · ${o.subcategory}`:''}</p><h1>{o.title}</h1><p className="lede">{o.organization}</p><p>{o.summary}</p></div><aside><span className={`status ${o.status}`}>{o.status}</span><p><strong>{o.confidence} confidence</strong><br/>Last verified {o.lastVerified}<br/><span className={`freshness-label ${freshness.state}`}>{freshness.label}</span></p><a className="button" href={o.sourceUrl} target="_blank" rel="noreferrer" onClick={sourceClick}>Go to official source</a><button className="button secondary" onClick={()=>void saves.toggle(o.id)}>{saves.saved.includes(o.id)?'Saved':'Save opportunity'}</button></aside></header>
    {o.status==='closed'&&<div className="alert error"><strong>This opportunity is closed.</strong> Keep it for reference or check the official source for a new cycle.</div>}
    {o.confidence!=='High'&&<div className="alert"><strong>Confirm before acting.</strong> One or more details need stronger or newer evidence.</div>}
    {freshness.state==='needs-review'&&<div className="alert"><strong>This listing needs rechecking.</strong> It has been {freshness.days} days since the recorded verification. Confirm everything on the official source and <Link to={`/submit?type=expired&opportunity=${encodeURIComponent(o.id)}`}>report anything outdated</Link>.</div>}
    <div className="detail-grid"><div>{rows.map(([key,value])=><section key={key}><h2>{key}</h2><p>{value||'Not published—confirm with the provider.'}</p></section>)}
      <section className="outcome-panel"><h2>Track your outcome</h2>{user?<><p>Privately mark what happened. Only combined totals appear on the impact dashboard.</p><div className="actions"><button className="button secondary" aria-pressed={currentStatus==='applied'} onClick={()=>mark('applied')}>{currentStatus==='applied'?'Applied ✓':'I applied'}</button><button className="button secondary" aria-pressed={currentStatus==='participated'} onClick={()=>mark('participated')}>{currentStatus==='participated'?'Participated ✓':'I participated'}</button></div></>:<p><Link to="/signin">Sign in</Link> to privately record an application or participation.</p>}</section>
    </div><aside className="source-box"><h2>Source record</h2><dl><dt>Publisher</dt><dd>{o.organization}</dd><dt>Source type</dt><dd>{o.sourceType}</dd><dt>Imported row</dt><dd>{o.sourceRow}</dd><dt>Confidence</dt><dd>{o.confidence}</dd><dt>Freshness</dt><dd>{freshness.label}</dd></dl><a href={o.sourceUrl} target="_blank" rel="noreferrer" onClick={sourceClick}>Open official source</a><Link to={`/submit?type=correction&opportunity=${encodeURIComponent(o.id)}`}>Report outdated information</Link></aside></div><p className="detail-disclaimer">Details can change. Confirm eligibility, dates, cost, travel, and safety requirements on the official source before applying or attending.</p>
  </article>;
}
