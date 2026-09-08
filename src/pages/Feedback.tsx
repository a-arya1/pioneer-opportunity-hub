import {useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {getAnonymousSessionId} from '../contexts/AnalyticsContext';
import {supabase} from '../lib/supabase';

type FormState={audience:string;helpfulness:string;ease:string;recommend:string;missing:string;comments:string;website:string;consent:boolean};
const initial:FormState={audience:'',helpfulness:'',ease:'',recommend:'',missing:'',comments:'',website:'',consent:false};

export default function Feedback(){
  const [form,setForm]=useState<FormState>(initial);
  const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const set=<K extends keyof FormState>(key:K,value:FormState[K])=>setForm(current=>({...current,[key]:value}));
  const submit=async(event:FormEvent)=>{
    event.preventDefault();setError('');
    if(form.website){setSent(true);return}
    if(!supabase){setError('Feedback is temporarily unavailable. Please try again later.');return}
    setBusy(true);
    const {error:submitError}=await supabase.rpc('submit_feedback',{
      p_session_id:getAnonymousSessionId(),p_audience:form.audience,p_helpfulness:Number(form.helpfulness),p_ease:Number(form.ease),
      p_would_recommend:form.recommend==='yes',p_missing:form.missing||null,p_comments:form.comments||null,p_consent:form.consent,
    });
    setBusy(false);
    if(submitError){setError('We could not save your feedback. Please try again.');return}
    setSent(true);
  };
  if(sent)return <section className="state"><p className="kicker">FEEDBACK RECEIVED</p><h1>Thank you for helping improve the hub.</h1><p>Your written response stays private. Only combined ratings and response totals are available to the project owner.</p><div className="actions"><Link className="button" to="/opportunities">Browse opportunities</Link></div></section>;
  return <section className="form-page"><p className="kicker">STUDENT &amp; COUNSELOR FEEDBACK</p><h1>Help improve the opportunity hub</h1><p>This short survey does not ask for your name or email. Please do not include private student information in written responses.</p>
    <form onSubmit={event=>void submit(event)}><div className="honeypot" aria-hidden="true"><label>Website<input value={form.website} onChange={event=>set('website',event.target.value)} tabIndex={-1} autoComplete="off"/></label></div>
      <label>Which best describes you?<select required value={form.audience} onChange={event=>set('audience',event.target.value)}><option value="">Choose one</option><option value="student">Student</option><option value="counselor">Counselor</option><option value="educator">Teacher or educator</option><option value="parent">Parent or guardian</option><option value="community">Community member</option></select></label>
      <Rating label="How useful is this directory?" name="helpfulness" value={form.helpfulness} onChange={value=>set('helpfulness',value)}/>
      <Rating label="How easy is it to find a relevant opportunity?" name="ease" value={form.ease} onChange={value=>set('ease',value)}/>
      <fieldset className="form-fieldset"><legend>Would you recommend it to another student?</legend><div className="choice-row"><label className="check"><input required type="radio" name="recommend" value="yes" checked={form.recommend==='yes'} onChange={event=>set('recommend',event.target.value)}/>Yes</label><label className="check"><input required type="radio" name="recommend" value="no" checked={form.recommend==='no'} onChange={event=>set('recommend',event.target.value)}/>Not yet</label></div></fieldset>
      <label>What opportunity or category is missing? <small>Optional · 500 characters maximum</small><textarea maxLength={500} rows={3} value={form.missing} onChange={event=>set('missing',event.target.value)}/></label>
      <label>What should be improved? <small>Optional · 1,500 characters maximum</small><textarea maxLength={1500} rows={5} value={form.comments} onChange={event=>set('comments',event.target.value)}/></label>
      <label className="check"><input type="checkbox" required checked={form.consent} onChange={event=>set('consent',event.target.checked)}/>I understand my written feedback is stored privately for review and only combined statistics may be published.</label>
      {error&&<p className="form-error" role="alert">{error}</p>}<button className="button" type="submit" disabled={busy}>{busy?'Sending…':'Send feedback'}</button>
    </form>
  </section>;
}

function Rating({label,name,value,onChange}:{label:string;name:string;value:string;onChange:(value:string)=>void}){
  return <fieldset className="form-fieldset"><legend>{label}</legend><div className="rating-row">{[1,2,3,4,5].map(score=><label key={score}><input required type="radio" name={name} value={score} checked={value===String(score)} onChange={event=>onChange(event.target.value)}/><span>{score}</span></label>)}</div><small>1 = low · 5 = high</small></fieldset>;
}
