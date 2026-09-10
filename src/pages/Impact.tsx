import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import opportunitiesData from '../data/opportunities.json';
import {supabase} from '../lib/supabase';
import {listingFreshness} from '../lib/freshness';
import {useAuth} from '../contexts/AuthContext';
import type {Opportunity} from '../types';

type ImpactSummary={
  accounts_created:number;
  students_with_saves:number;
  account_saves:number;
  applications_reported:number;
  participation_reported:number;
  anonymous_sessions:number;
  page_views:number;
  opportunity_views:number;
  save_actions:number;
  official_source_clicks:number;
  sign_in_links_requested:number;
  feedback_responses:number;
  average_helpfulness:number|string|null;
  would_recommend_count:number;
  reports_received:number;
  corrections_completed:number;
  measurement_started_at:string|null;
};
const zero:ImpactSummary={accounts_created:0,students_with_saves:0,account_saves:0,applications_reported:0,participation_reported:0,anonymous_sessions:0,page_views:0,opportunity_views:0,save_actions:0,official_source_clicks:0,sign_in_links_requested:0,feedback_responses:0,average_helpfulness:null,would_recommend_count:0,reports_received:0,corrections_completed:0,measurement_started_at:null};

export default function Impact(){
  const {loading:authLoading,adminLoading,user,impactAdmin}=useAuth();
  const [summary,setSummary]=useState<ImpactSummary>(zero);
  const [loading,setLoading]=useState(false);
  const [copied,setCopied]=useState(false);
  const published=(opportunitiesData as Opportunity[]).filter(item=>item.published);
  const reviewed=published.length;
  const recentlyChecked=published.filter(item=>listingFreshness(item.lastVerified).state==='current').length;
  useEffect(()=>{if(!supabase||!impactAdmin)return;let active=true;setLoading(true);void supabase.rpc('get_impact_summary').then(({data})=>{if(active&&Array.isArray(data)&&data[0])setSummary(data[0] as ImpactSummary);if(active)setLoading(false)});return()=>{active=false}},[impactAdmin]);
  const statement=useMemo(()=>`Built and launched Pioneer Opportunity Hub, a directory of ${reviewed.toLocaleString()} reviewed opportunities. The project has supported ${summary.accounts_created.toLocaleString()} student accounts, ${summary.account_saves.toLocaleString()} current account saves, ${summary.official_source_clicks.toLocaleString()} visits to official opportunity sources, ${summary.applications_reported.toLocaleString()} reported applications, and ${summary.participation_reported.toLocaleString()} reported participations. It has also collected ${summary.feedback_responses.toLocaleString()} private feedback responses and completed ${summary.corrections_completed.toLocaleString()} reported directory corrections.`,[reviewed,summary]);
  const copy=async()=>{await navigator.clipboard.writeText(statement);setCopied(true);window.setTimeout(()=>setCopied(false),2000)};
  const cards=[
    ['Reviewed listings',reviewed,'Current directory coverage'],
    ['Student accounts',summary.accounts_created,'Current registered accounts'],
    ['Students saving opportunities',summary.students_with_saves,'Accounts with at least one save'],
    ['Opportunities saved',summary.account_saves,'Current private account saves'],
    ['Official-source visits',summary.official_source_clicks,'Anonymous source-link clicks'],
    ['Applications reported',summary.applications_reported,'Private student outcome'],
    ['Participation reported',summary.participation_reported,'Stronger student outcome'],
    ['Anonymous sessions',summary.anonymous_sessions,'Opt-in, session-level estimate'],
    ['Page views',summary.page_views,'Anonymous page-category views'],
    ['Opportunity views',summary.opportunity_views,'Anonymous detail views'],
    ['Save actions',summary.save_actions,'Anonymous save clicks'],
    ['Sign-in links requested',summary.sign_in_links_requested,'Anonymous successful requests'],
    ['Recently checked listings',recentlyChecked,'Verified within the last 45 days'],
    ['Feedback responses',summary.feedback_responses,'Private student and counselor surveys'],
    ['Average usefulness',summary.feedback_responses?`${Number(summary.average_helpfulness).toFixed(1)}/5`:'—','Combined survey rating'],
    ['Would recommend',summary.feedback_responses?`${summary.would_recommend_count}/${summary.feedback_responses}`:'—','Combined survey responses'],
    ['Reports received',summary.reports_received,'Corrections and listing suggestions'],
    ['Corrections completed',summary.corrections_completed,'Reviewed and accepted corrections'],
  ] as const;
  if(authLoading||adminLoading)return <section className="state"><p role="status">Checking access…</p></section>;
  if(!user)return <section className="state"><p className="kicker">PRIVATE DASHBOARD</p><h1>Impact metrics are owner-only.</h1><p>Sign in with the project owner account to view this page.</p><Link className="button" to="/signin">Sign in</Link></section>;
  if(!impactAdmin)return <section className="state"><p className="kicker">PRIVATE DASHBOARD</p><h1>This account does not have access.</h1><p>The public directory and your own saved opportunities are still available.</p><Link className="button" to="/opportunities">Browse opportunities</Link></section>;
  return <section className="impact-page"><div className="page-heading"><p className="kicker">TRANSPARENT PROJECT METRICS</p><h1>Impact dashboard</h1><p>Aggregate evidence of how students use the directory. No names, emails, searches, or individual activity appear here.</p></div>
    {loading&&<p className="muted" role="status">Loading current impact…</p>}
    <div className="impact-grid">{cards.map(([label,value,note])=><article className="impact-card" key={label}><strong>{value.toLocaleString()}</strong><h2>{label}</h2><p>{note}</p></article>)}</div>
    <section className="impact-statement"><div><p className="kicker">COLLEGE APPLICATION SUMMARY</p><h2>Copy a factual project summary</h2><p>{statement}</p></div><button className="button secondary" onClick={()=>void copy()}>{copied?'Copied':'Copy summary'}</button></section>
    <section className="impact-method"><h2>How these numbers work</h2><p>Account and save totals come from private account records and are shown only as combined counts. Anonymous usage counts are recorded only after a visitor explicitly allows measurement. A temporary random session ID prevents duplicate counts; it is not connected to an email or account.</p><p>We never record search text, selected filters, names, emails, or individual account activity in this dashboard. Events are deduplicated by session, action, opportunity or page, and day, then removed by daily cleanup after 12 months (up to 24 additional hours while the database is running). Application and participation totals are voluntary self-reports and may undercount real outcomes.</p>{summary.measurement_started_at&&<p className="muted">Anonymous measurement began {new Date(summary.measurement_started_at).toLocaleDateString()}.</p>}</section>
  </section>;
}
