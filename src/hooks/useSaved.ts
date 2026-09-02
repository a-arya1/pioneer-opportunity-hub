import {useEffect,useState} from 'react';
const KEY='poh:saved';
export function useSaved(){const [saved,setSaved]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}});useEffect(()=>localStorage.setItem(KEY,JSON.stringify(saved)),[saved]);return{saved,toggle:(id:string)=>setSaved(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]),clear:()=>setSaved([])}}
