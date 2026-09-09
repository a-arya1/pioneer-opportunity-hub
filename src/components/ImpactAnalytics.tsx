import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {useAnalytics} from '../contexts/AnalyticsContext';

function coarsePage(pathname:string){
  if(/^\/opportunities\/[^/]+/.test(pathname))return'opportunity-detail';
  if(pathname.startsWith('/opportunities'))return'opportunity-directory';
  if(pathname.startsWith('/saved'))return'saved';
  if(pathname.startsWith('/signin'))return'sign-in';
  if(pathname.startsWith('/impact'))return'impact';
  if(pathname.startsWith('/feedback'))return'information';
  return pathname==='/'?'home':'information';
}

export function RouteAnalytics(){
  const {pathname}=useLocation();
  const {track}=useAnalytics();
  useEffect(()=>{track('site_visit');track('page_view',{coarsePage:coarsePage(pathname)})},[pathname,track]);
  return null;
}
