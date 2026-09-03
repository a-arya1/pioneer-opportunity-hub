import {useCallback,useEffect,useState} from 'react';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../lib/supabase';

const KEY='poh:saved';
const readDevice=()=>{try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'):[]}catch{return[]}};

export function useSaved(){
  const {user}=useAuth();
  const [saved,setSaved]=useState<string[]>(readDevice);
  const [syncing,setSyncing]=useState(false);

  useEffect(()=>localStorage.setItem(KEY,JSON.stringify(saved)),[saved]);
  useEffect(()=>{
    if(!supabase||!user)return;
    let active=true;setSyncing(true);
    void (async()=>{
      const {data,error}=await supabase.from('saved_opportunities').select('opportunity_id');
      if(error){if(active)setSyncing(false);return}
      const cloud=(data??[]).map(row=>row.opportunity_id as string);
      const device=readDevice();
      const merged=[...new Set([...cloud,...device])];
      if(device.length)await supabase.from('saved_opportunities').upsert(device.map(opportunity_id=>({user_id:user.id,opportunity_id})),{onConflict:'user_id,opportunity_id'});
      if(active){setSaved(merged);setSyncing(false)}
    })();
    return()=>{active=false};
  },[user]);

  const toggle=useCallback(async(id:string)=>{
    const removing=saved.includes(id);
    setSaved(current=>removing?current.filter(x=>x!==id):[...current,id]);
    if(!supabase||!user)return;
    if(removing)await supabase.from('saved_opportunities').delete().eq('opportunity_id',id);
    else await supabase.from('saved_opportunities').upsert({user_id:user.id,opportunity_id:id},{onConflict:'user_id,opportunity_id'});
  },[saved,user]);

  const clear=useCallback(async()=>{
    setSaved([]);
    if(supabase&&user)await supabase.from('saved_opportunities').delete().eq('user_id',user.id);
  },[user]);

  return{saved,toggle,clear,syncing,storage:user?'account' as const:'device' as const};
}
