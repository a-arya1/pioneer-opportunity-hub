/* eslint-disable react-refresh/only-export-components */
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {useAuth} from './AuthContext';
import {useAnalytics} from './AnalyticsContext';
import {supabase} from '../lib/supabase';
export type SavedStatus='saved'|'applied'|'participated';
const GUEST_KEY='poh:guest-saves:v2';
type Value={saved:string[];statuses:Record<string,SavedStatus>;syncing:boolean;error:string;storage:'account'|'device';toggle:(id:string)=>Promise<void>;markStatus:(id:string,status:SavedStatus)=>Promise<void>;clear:()=>Promise<void>};
const Context=createContext<Value|null>(null);
// Remount before rendering another identity. Account saves never enter storage.
export function SavedProvider({children}:{children:ReactNode}){
  const {user,loading}=useAuth();
  return <SavedScope key={loading?'loading':user?.id??'guest'} userId={user?.id??null} authLoading={loading}>{children}</SavedScope>;
}
function SavedScope({children,userId,authLoading}:{children:ReactNode;userId:string|null;authLoading:boolean}){
  const {track}=useAnalytics();
  const [statuses,setStatuses]=useState<Record<string,SavedStatus>>(()=>{
    try{
      // The old cache mixes identities, so it must never be imported.
      localStorage.removeItem('poh:saved');
      if(userId||authLoading)return {};
      const ids:unknown=JSON.parse(sessionStorage.getItem(GUEST_KEY)||'[]');
      return Array.isArray(ids)?Object.fromEntries(ids.filter(id=>typeof id==='string').map(id=>[id,'saved' as const])):{};
    }catch{return {}}
  });
  const [syncing,setSyncing]=useState(Boolean(userId)||authLoading);
  const [error,setError]=useState('');
  const busy=useRef(false);
  const alive=useRef(true);
  useEffect(()=>{
    alive.current=true;
    if(supabase&&userId){
      void supabase.from('saved_opportunities').select('opportunity_id,status').eq('user_id',userId).then(({data,error:failure})=>{
        if(!alive.current)return;
        if(failure)setError('Your saved list could not load. Refresh to try again.');
        else setStatuses(Object.fromEntries((data??[]).map(row=>[row.opportunity_id,row.status as SavedStatus])));
        setSyncing(false);
      });
    }
    return()=>{alive.current=false};
  },[userId]);
  useEffect(()=>{
    if(userId||authLoading)return;
    try{sessionStorage.setItem(GUEST_KEY,JSON.stringify(Object.keys(statuses)))}catch{/* Saves still work for this page session. */}
  },[statuses,userId,authLoading]);
  const change=async(id:string|null,status:SavedStatus|null)=>{
    if(busy.current||syncing||authLoading)return;
    busy.current=true;setError('');
    try{
      if(userId){
        if(!supabase)throw new Error('Account service unavailable');
        const response=id===null
          ?await supabase.from('saved_opportunities').delete().eq('user_id',userId)
          :status===null
            ?await supabase.from('saved_opportunities').delete().eq('user_id',userId).eq('opportunity_id',id)
            :await supabase.from('saved_opportunities').upsert({user_id:userId,opportunity_id:id,status,updated_at:new Date().toISOString()},{onConflict:'user_id,opportunity_id'});
        if(response.error)throw response.error;
      }
      if(!alive.current)return;
      setStatuses(current=>{if(id===null)return {};const next={...current};if(status===null)delete next[id];else next[id]=status;return next});
      if(id&&status&&!statuses[id])track('opportunity_saved',{opportunityId:id});
    }catch{if(alive.current)setError('Your changes could not be saved. Please try again.');}
    finally{busy.current=false;}
  };
  return <Context.Provider value={{saved:Object.keys(statuses),statuses,syncing,error,storage:userId?'account':'device',toggle:id=>change(id,statuses[id]?null:'saved'),markStatus:(id,status)=>userId?change(id,status):Promise.resolve(),clear:()=>change(null,null)}}>{children}{error&&<div className="alert" role="alert">{error}</div>}</Context.Provider>;
}
export function useSaved(){const value=useContext(Context);if(!value)throw new Error('SavedProvider is required');return value;}
