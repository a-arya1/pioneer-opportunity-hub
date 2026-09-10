import {useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {useAnalytics} from '../contexts/AnalyticsContext';

export default function SignIn(){
  const {configured,loading,user,sendMagicLink}=useAuth();
  const {track}=useAnalytics();
  const [email,setEmail]=useState('');
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState('');

  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    setError('');setSending(true);
    try{await sendMagicLink(email.trim());track('magic_link_requested');setSent(true)}
    catch(error:unknown){
      const message=error instanceof Error?error.message.toLowerCase():'';
      setError(message.includes('rate limit')||message.includes('too many')
        ?'Email delivery is temporarily rate-limited. Please wait a little longer before requesting another link.'
        :message.includes('redirect')||message.includes('url')
          ?'This site’s sign-in address is not configured correctly yet. Please try again later.'
          :'We could not send a sign-in link. Please check the email address and try again later.');
    }
    finally{setSending(false)}
  };

  if(loading)return <section className="form-page"><p className="kicker">PRIVATE ACCOUNT</p><h1>Checking your account…</h1></section>;
  if(user)return <section className="form-page"><p className="kicker">PRIVATE ACCOUNT</p><h1>You’re signed in</h1><p>Your saved opportunities can sync privately across your devices.</p><Link className="button" to="/account">Open your account</Link></section>;

  return <section className="form-page"><p className="kicker">OPTIONAL ACCOUNT</p><h1>Sign in or create an account</h1><p>Enter your email and we’ll send a one-time sign-in link. There is no password to remember.</p><p className="privacy-note"><strong>Under 13?</strong> Please browse without an account unless a parent or guardian gives permission.</p>
    {!configured?<div className="alert"><strong>Accounts are being connected.</strong> Browsing and on-device saves still work, but email sign-in is not available on this version yet.</div>:
    sent?<div className="alert success" role="status"><strong>Check your inbox.</strong> If the address can receive mail, a secure link is on its way. For privacy, we show the same message for every address.</div>:
    <form onSubmit={submit}>
      <label>Email<input type="email" autoComplete="email" inputMode="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="button" disabled={sending}>{sending?'Sending…':'Email me a secure sign-in link'}</button>
    </form>}
    <div className="privacy-note"><strong>What gets stored?</strong><p>Only your email, account security records, saved opportunity IDs, and any application or participation status you choose to report. Guest saves stay separate. When signed in, saves belong only to your account. Your profile is not public.</p></div>
    <p className="muted">By continuing, you agree to the <Link to="/terms">terms</Link> and acknowledge the <Link to="/privacy">privacy notice</Link>.</p>
  </section>;
}
