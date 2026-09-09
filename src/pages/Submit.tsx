import {useMemo,useState,type FormEvent} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import opportunitiesData from '../data/opportunities.json';
import {getAnonymousSessionId} from '../contexts/AnalyticsContext';
import {supabase} from '../lib/supabase';
import type {Opportunity} from '../types';

const kinds=[
  ['new','Submit a new opportunity'],['correction','Correct a listing'],['expired','Report expired or broken information'],
  ['claim','Claim a club or organization'],['missing-club','Suggest a missing Pioneer club'],
] as const;

export default function Submit(){
  const [params]=useSearchParams();
  const opportunity=useMemo(()=>(opportunitiesData as Opportunity[]).find(item=>item.id===params.get('opportunity')),[params]);
  const initialKind=kinds.some(([value])=>value===params.get('type'))?params.get('type')!:'new';
  const [kind,setKind]=useState(initialKind);
  const [name,setName]=useState(opportunity?.title||'');
  const [source,setSource]=useState(opportunity?.sourceUrl||'');
  const [details,setDetails]=useState('');
  const [website,setWebsite]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const submit=async(event:FormEvent)=>{
    event.preventDefault();setError('');
    if(website){setSent(true);return}
    if(!supabase){setError('Submissions are temporarily unavailable. Please try again later.');return}
    setBusy(true);
    const {error:submitError}=await supabase.rpc('submit_directory_request',{
      p_session_id:getAnonymousSessionId(),p_kind:kind,p_opportunity_id:opportunity?.id??null,p_name:name,
      p_evidence_url:source||null,p_details:details,p_confirmed:confirmed,
    });
    setBusy(false);
    if(submitError){setError(submitError.message.startsWith('Too many requests')?'Reports are busy right now. Please wait and try again later.':'We could not save this report. Please check the information and try again.');return}
    setSent(true);
  };
  if(sent)return <div className="state"><p className="kicker">SUBMISSION RECEIVED</p><h1>Thanks. It’s waiting for review.</h1><p>Nothing publishes automatically. The evidence will be compared with current official sources.</p><Link className="button" to="/opportunities">Return to opportunities</Link></div>;
  return <section className="form-page"><p className="kicker">HELP KEEP THE DIRECTORY CURRENT</p><h1>Submit or correct a listing</h1><p>Use a public official source when possible. Reports are kept private during review. Do not include private student information.</p><form onSubmit={event=>void submit(event)}><div className="honeypot" aria-hidden="true"><label>Website<input value={website} onChange={event=>setWebsite(event.target.value)} tabIndex={-1} autoComplete="off"/></label></div>
    <label>What do you want to do?<select required value={kind} onChange={event=>setKind(event.target.value)}>{kinds.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
    <label>Opportunity or organization name<input required minLength={2} maxLength={160} value={name} onChange={event=>setName(event.target.value)}/></label>
    <label>Official source URL<input type="url" required={kind==='new'} maxLength={500} placeholder="https://" value={source} onChange={event=>setSource(event.target.value)}/><small>Use the provider’s page, not a social-media repost, when possible.</small></label>
    <label>What should we know?<textarea required minLength={20} maxLength={2000} rows={6} value={details} onChange={event=>setDetails(event.target.value)}/></label>
    <label className="check"><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>I confirm this is accurate to the best of my knowledge and contains no private student information.</label>
    {error&&<p className="form-error" role="alert">{error}</p>}<button className="button" type="submit" disabled={busy}>{busy?'Sending…':'Send for review'}</button></form></section>;
}
