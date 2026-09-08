import {useState} from 'react';
import {Link,Navigate} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {useSaved} from '../hooks/useSaved';

export default function Account(){
  const {configured,loading,user,signOut,deleteAccount}=useAuth();
  const saves=useSaved();
  const [confirming,setConfirming]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  if(loading)return <section className="form-page"><h1>Checking your account…</h1></section>;
  if(configured&&!user)return <Navigate to="/signin" replace/>;
  if(!configured)return <section className="form-page"><p className="kicker">PRIVATE ACCOUNT</p><h1>Accounts are being connected</h1><p>You can still browse and save opportunities on this device.</p><Link className="button" to="/opportunities">Browse opportunities</Link></section>;

  const remove=async()=>{
    setBusy(true);setError('');
    try{await deleteAccount()}
    catch{setError('We could not delete the account. Please try again.')}
    finally{setBusy(false)}
  };

  return <section className="form-page account-page"><p className="kicker">PRIVATE ACCOUNT</p><h1>Your account</h1>
    <div className="account-card"><h2>Signed in</h2><p className="account-email">{user?.email}</p><p>{saves.saved.length} saved {saves.saved.length===1?'opportunity':'opportunities'} · {saves.syncing?'Syncing…':'Synced privately'}</p><div className="actions"><Link className="button" to="/saved">View saved items</Link><button className="button secondary" onClick={()=>void signOut()}>Sign out everywhere</button></div></div>
    <div className="privacy-note"><h2>Privacy controls</h2><p>Your profile is not public. We store only your email, authentication records, saved opportunity IDs, and any application or participation status you choose to add. Outcome totals are shown publicly only as combined counts. You can remove saved items or permanently delete your account here.</p><button className="text-button" onClick={()=>void saves.clear()}>Delete all saved items and outcomes</button></div>
    <div className="danger-zone"><h2>Delete account</h2><p>This permanently deletes your account and all account-linked data. It cannot be undone.</p>
      {!confirming?<button className="button danger" onClick={()=>setConfirming(true)}>Delete my account</button>:<div className="actions"><button className="button danger" disabled={busy} onClick={()=>void remove()}>{busy?'Deleting…':'Yes, permanently delete it'}</button><button className="button secondary" onClick={()=>setConfirming(false)}>Cancel</button></div>}
      {error&&<p className="form-error" role="alert">{error}</p>}
    </div>
  </section>;
}
