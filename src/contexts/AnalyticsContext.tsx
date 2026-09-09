/* eslint-disable react-refresh/only-export-components */
import {createContext,useCallback,useContext,useMemo,type ReactNode} from 'react';
import {supabase} from '../lib/supabase';

type ImpactEvent='site_visit'|'page_view'|'opportunity_view'|'opportunity_saved'|'official_source_click'|'magic_link_requested';
type EventDetails={opportunityId?:string;coarsePage?:string;category?:string};
type AnalyticsValue={enabled:boolean;track:(event:ImpactEvent,details?:EventDetails)=>void};

const SESSION_KEY='poh:impact-session';
const AnalyticsContext=createContext<AnalyticsValue|null>(null);
const analyticsConfigured=Boolean(supabase);
export function getAnonymousSessionId(){
  try{let value=sessionStorage.getItem(SESSION_KEY);if(!value){value=crypto.randomUUID();sessionStorage.setItem(SESSION_KEY,value)}return value}catch{return crypto.randomUUID()}
}

export function AnalyticsProvider({children}:{children:ReactNode}){
  const track=useCallback((event:ImpactEvent,details:EventDetails={})=>{
    if(!analyticsConfigured||!supabase)return;
    void supabase.rpc('record_impact_event',{
      p_event_name:event,
      p_session_id:getAnonymousSessionId(),
      p_opportunity_id:details.opportunityId??null,
      p_coarse_page:details.coarsePage??null,
      p_category:details.category??null,
    });
  },[]);
  const value=useMemo<AnalyticsValue>(()=>({enabled:analyticsConfigured,track}),[track]);
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(){
  const value=useContext(AnalyticsContext);
  if(!value)throw new Error('useAnalytics must be used inside AnalyticsProvider');
  return value;
}
