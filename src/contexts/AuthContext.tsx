/* eslint-disable react-refresh/only-export-components */
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {User} from '@supabase/supabase-js';
import {authRedirectUrl,isSupabaseConfigured,supabase} from '../lib/supabase';

type AuthValue={
  configured:boolean;
  loading:boolean;
  adminLoading:boolean;
  impactAdmin:boolean;
  user:User|null;
  sendMagicLink:(email:string)=>Promise<void>;
  signOut:()=>Promise<void>;
  deleteAccount:()=>Promise<void>;
};

const AuthContext=createContext<AuthValue|null>(null);

export function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<User|null>(null);
  const [loading,setLoading]=useState(isSupabaseConfigured);
  const [impactAdmin,setImpactAdmin]=useState(false);
  const [adminLoading,setAdminLoading]=useState(false);

  useEffect(()=>{
    if(!supabase){setLoading(false);return;}
    let active=true;
    supabase.auth.getSession().then(({data})=>{
      if(active){setUser(data.session?.user??null);setLoading(false);}
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(active){setUser(session?.user??null);setLoading(false);}
    });
    return()=>{active=false;subscription.unsubscribe();};
  },[]);

  useEffect(()=>{
    if(!supabase||!user){setImpactAdmin(false);setAdminLoading(false);return;}
    let active=true;
    setAdminLoading(true);
    void supabase.rpc('is_impact_admin').then(({data,error})=>{
      if(active){setImpactAdmin(!error&&data===true);setAdminLoading(false);}
    });
    return()=>{active=false;};
  },[user]);

  const value=useMemo<AuthValue>(()=>({
    configured:isSupabaseConfigured,
    loading,
    adminLoading,
    impactAdmin,
    user,
    async sendMagicLink(email){
      if(!supabase)throw new Error('Account service is not configured.');
      const {error}=await supabase.auth.signInWithOtp({
        email,
        options:{shouldCreateUser:true,emailRedirectTo:authRedirectUrl()},
      });
      if(error)throw error;
    },
    async signOut(){
      if(!supabase)return;
      const {error}=await supabase.auth.signOut({scope:'global'});
      if(error)throw error;
    },
    async deleteAccount(){
      if(!supabase||!user)throw new Error('You must be signed in.');
      const {error}=await supabase.rpc('delete_own_account');
      if(error)throw error;
      await supabase.auth.signOut({scope:'local'});
      setUser(null);
    },
  }),[adminLoading,impactAdmin,loading,user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(){
  const value=useContext(AuthContext);
  if(!value)throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
