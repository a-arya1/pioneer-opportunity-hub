import {useCallback,useEffect,useState} from 'react';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../lib/supabase';
import {useAnalytics} from '../contexts/AnalyticsContext';

const KEY='poh:saved';
const readDevice=()=>{try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'):[]}catch{return[]}};
export type SavedStatus='saved'|'applied'|'participated';

export function useSaved(){
  const {user}=useAuth();
  const {track}=useAnalytics();
  const [saved,setSaved]=useState<string[]>(readDevice);
  const [statuses,setStatuses]=useState<Record<string,SavedStatus>>({});
  const [syncing,setSyncing]=useState(false);

  useEffect(()=>localStorage.setItem(KEY,JSON.stringify(saved)),[saved]);
  useEffect(()=>{
    if(!supabase||!user)return;
    let active=true;setSyncing(true);
    void (async()=>{
      const {data,error}=await supabase.from('saved_opportunities').select('opportunity_id,status');
      if(error){if(active)setSyncing(false);return}
      const cloud=(data??[]).map(row=>row.opportunity_id as string);
      const cloudStatuses=Object.fromEntries((data??[]).map(row=>[row.opportunity_id,(row.status||'saved') as SavedStatus]));
      const device=readDevice();
      const merged=[...new Set([...cloud,...device])];
      const missing=device.filter(id=>!cloud.includes(id));
      if(missing.length)await supabase.from('saved_opportunities').upsert(missing.map(opportunity_id=>({user_id:user.id,opportunity_id,status:'saved'})),{onConflict:'user_id,opportunity_id'});
      if(active){setSaved(merged);setStatuses({...Object.fromEntries(device.map(id=>[id,'saved'])),...cloudStatuses});setSyncing(false)}
    })();
    return()=>{active=false};
  },[user]);

  const toggle=useCallback(async(id:string)=>{
    const removing=saved.includes(id);
    setSaved(current=>removing?current.filter(x=>x!==id):[...current,id]);
    setStatuses(current=>{const next={...current};if(removing)delete next[id];else next[id]='saved';return next});
    if(!removing)track('opportunity_saved',{opportunityId:id});
    if(!supabase||!user)return;
    if(removing)await supabase.from('saved_opportunities').delete().eq('opportunity_id',id);
    else await supabase.from('saved_opportunities').upsert({user_id:user.id,opportunity_id:id,status:'saved'},{onConflict:'user_id,opportunity_id'});
  },[saved,track,user]);

  const markStatus=useCallback(async(id:string,status:SavedStatus)=>{
    if(!supabase||!user)return;
    setSaved(current=>current.includes(id)?current:[...current,id]);
    setStatuses(current=>({...current,[id]:status}));
    await supabase.from('saved_opportunities').upsert({user_id:user.id,opportunity_id:id,status,updated_at:new Date().toISOString()},{onConflict:'user_id,opportunity_id'});
  },[user]);

  const clear=useCallback(async()=>{
    setSaved([]);
    setStatuses({});
    if(supabase&&user)await supabase.from('saved_opportunities').delete().eq('user_id',user.id);
  },[user]);

  return{saved,statuses,toggle,markStatus,clear,syncing,storage:user?'account' as const:'device' as const};
}
