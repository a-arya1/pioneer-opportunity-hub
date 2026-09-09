// @vitest-environment jsdom
import React from 'react';
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({user:null as {id:string}|null,loading:false,fail:false,rows:{} as Record<string,Array<{opportunity_id:string;status:string}>>,writes:[] as unknown[],pending:null as null|Promise<unknown>}));
vi.mock('../src/contexts/AuthContext',()=>({useAuth:()=>state}));
vi.mock('../src/contexts/AnalyticsContext',()=>({useAnalytics:()=>({track:vi.fn()})}));
vi.mock('../src/lib/supabase',()=>({supabase:{from:()=>({
  select:()=>({eq:(_field:string,id:string)=>state.pending??Promise.resolve({data:state.rows[id]??[],error:null})}),
  upsert:async(row:unknown)=>{state.writes.push(row);return {error:state.fail?new Error('network'):null}},
  delete:()=>({eq:()=>({eq:async()=>({error:null}),then:(resolve:(x:unknown)=>unknown)=>Promise.resolve({error:null}).then(resolve)})}),
})}}));
import {SavedProvider,useSaved} from '../src/contexts/SavedContext';
const wrapper=({children}:{children:React.ReactNode})=><SavedProvider>{children}</SavedProvider>;
beforeEach(()=>{localStorage.clear();sessionStorage.clear();state.user=null;state.loading=false;state.fail=false;state.rows={alice:[{opportunity_id:'alice-private',status:'applied'}],bob:[{opportunity_id:'bob-private',status:'saved'}]};state.writes=[];state.pending=null});
afterEach(cleanup);
describe('saved-list privacy behavior',()=>{
  it('discards the mixed legacy cache without uploading it',async()=>{
    localStorage.setItem('poh:saved','["someone-elses-save"]');state.user={id:'alice'};
    const {result}=renderHook(useSaved,{wrapper});
    await waitFor(()=>expect(result.current.saved).toEqual(['alice-private']));
    expect(localStorage.getItem('poh:saved')).toBeNull();expect(state.writes).toEqual([]);
    expect(sessionStorage.getItem('poh:guest-saves:v2')).toBeNull();
  });
  it('clears account saves and outcomes on sign-out and switches accounts cleanly',async()=>{
    state.user={id:'alice'};const {result,rerender}=renderHook(useSaved,{wrapper});
    await waitFor(()=>expect(result.current.statuses['alice-private']).toBe('applied'));
    state.user=null;rerender();expect(result.current.saved).toEqual([]);expect(result.current.statuses).toEqual({});
    state.user={id:'bob'};rerender();expect(result.current.saved).toEqual([]);
    await waitFor(()=>expect(result.current.saved).toEqual(['bob-private']));expect(state.writes).toEqual([]);
  });
  it('keeps guest saves separate instead of silently importing them',async()=>{
    const {result,rerender}=renderHook(useSaved,{wrapper});await act(()=>result.current.toggle('guest-only'));
    state.user={id:'bob'};rerender();await waitFor(()=>expect(result.current.saved).toEqual(['bob-private']));
    expect(state.writes).toEqual([]);state.user=null;rerender();expect(result.current.saved).toEqual(['guest-only']);
  });
  it('does not show a successful save when the server rejects the write',async()=>{
    state.user={id:'alice'};state.fail=true;const {result}=renderHook(useSaved,{wrapper});
    await waitFor(()=>expect(result.current.syncing).toBe(false));await act(()=>result.current.toggle('new-save'));
    expect(result.current.saved).not.toContain('new-save');expect(result.current.error).toContain('could not be saved');
  });
  it('ignores a late response after the account changes',async()=>{
    let resolve!:(data:unknown)=>void;state.pending=new Promise(r=>{resolve=r});state.user={id:'alice'};
    const {result,rerender}=renderHook(useSaved,{wrapper});state.pending=null;state.user={id:'bob'};rerender();
    await waitFor(()=>expect(result.current.saved).toEqual(['bob-private']));
    await act(async()=>resolve({data:state.rows.alice,error:null}));expect(result.current.saved).toEqual(['bob-private']);
  });
});
