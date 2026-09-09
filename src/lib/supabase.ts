import {createClient} from '@supabase/supabase-js';

const url=import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey=(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();

export const isSupabaseConfigured=Boolean(url&&publishableKey);
export const supabase=isSupabaseConfigured
  ?createClient(url!,publishableKey!,{
    auth:{
      // This is a client-only static site. Implicit flow lets a magic link
      // finish even when the email opens in a different browser.
      flowType:'implicit',
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true,
    },
  })
  :null;

export function authRedirectUrl(){
  return new URL(import.meta.env.BASE_URL,window.location.origin).toString();
}
