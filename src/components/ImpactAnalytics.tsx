import {useEffect} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useAnalytics} from '../contexts/AnalyticsContext';

function coarsePage(pathname:string){
  if(/^\/opportunities\/[^/]+/.test(pathname))return'opportunity-detail';
  if(pathname.startsWith('/opportunities'))return'opportunity-directory';
  if(pathname.startsWith('/saved'))return'saved';
  if(pathname.startsWith('/signin'))return'sign-in';
  if(pathname.startsWith('/impact'))return'impact';
  return pathname==='/'?'home':'information';
}

export function RouteAnalytics(){
  const {pathname}=useLocation();
  const {track}=useAnalytics();
  useEffect(()=>{track('site_visit');track('page_view',{coarsePage:coarsePage(pathname)})},[pathname,track]);
  return null;
}

export function ImpactConsent(){
  const {enabled,consent,allow,decline}=useAnalytics();
  if(!enabled||consent!=='unknown')return null;
  return <aside className="impact-consent" aria-label="Anonymous impact measurement"><div><strong>Help measure this project’s impact?</strong><p>Allow anonymous visit and click counts. We never record your search text, email, or the filters you choose. <Link to="/privacy">Learn more</Link></p></div><div className="actions"><button className="button" onClick={allow}>Allow anonymous counts</button><button className="button secondary" onClick={decline}>Not now</button></div></aside>;
}
