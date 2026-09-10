/* eslint-disable react-refresh/only-export-components */
import {createContext,useCallback,useContext,useMemo,useState,type ReactNode} from 'react';
import {supabase} from '../lib/supabase';

type ImpactEvent='site_visit'|'page_view'|'opportunity_view'|'opportunity_saved'|'official_source_click'|'magic_link_requested';
type EventDetails={opportunityId?:string;coarsePage?:string;category?:string};
type Consent='unknown'|'allowed'|'declined';
type AnalyticsValue={enabled:boolean;consent:Consent;allow:()=>void;decline:()=>void;track:(event:ImpactEvent,details?:EventDetails)=>void};

const SESSION_KEY='poh:impact-session';
const AnalyticsContext=createContext<AnalyticsValue|null>(null);
const analyticsConfigured=Boolean(supabase);
function readConsent():Consent{try{const value=localStorage.getItem('poh:impact-consent');return value==='allowed'||value==='declined'?value:'unknown'}catch{return'unknown'}}
export function getAnonymousSessionId(){
  try{let value=sessionStorage.getItem(SESSION_KEY);if(!value){value=crypto.randomUUID();sessionStorage.setItem(SESSION_KEY,value)}return value}catch{return crypto.randomUUID()}
}

export function AnalyticsProvider({children}:{children:ReactNode}){
  const [consent,setConsent]=useState<Consent>(readConsent);
  const choose=(value:Exclude<Consent,'unknown'>)=>{try{localStorage.setItem('poh:impact-consent',value)}catch{/* Browsing still works without storage. */}setConsent(value)};
  const track=useCallback((event:ImpactEvent,details:EventDetails={})=>{
    if(!analyticsConfigured||consent!=='allowed'||!supabase)return;
    void supabase.rpc('record_impact_event',{
      p_event_name:event,
      p_session_id:getAnonymousSessionId(),
      p_opportunity_id:details.opportunityId??null,
      p_coarse_page:details.coarsePage??null,
      p_category:details.category??null,
    });
  },[consent]);
  const value=useMemo<AnalyticsValue>(()=>({enabled:analyticsConfigured,consent,allow:()=>choose('allowed'),decline:()=>choose('declined'),track}),[consent,track]);
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(){
  const value=useContext(AnalyticsContext);
  if(!value)throw new Error('useAnalytics must be used inside AnalyticsProvider');
  return value;
}
