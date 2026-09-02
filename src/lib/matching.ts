import type {MatchResult,Opportunity,Preferences} from '../types';
const terms=(s:string)=>s.toLowerCase().trim().split(/\s+/).filter(Boolean);
const searchableText=(o:Opportunity)=>[o.title,o.organization,o.category,o.subcategory,o.summary,o.eligibility,o.requirements,o.location,o.effort,...(o.interestTags||[])].filter(Boolean).join(' ').toLowerCase();
const interestText=(o:Opportunity)=>[o.title,o.subcategory].filter(Boolean).join(' ').toLowerCase();
const interestPatterns:Record<string,RegExp>={
 'arts':/visual arts?|performing arts?|fine arts?|art center|arts administration|creative reuse|photograph/,
 'biology':/biology|biomedical|life science|ecology|salamander|frog|toad|turtle|bird|insect/,
 'business':/\bbusiness\b|deca|marketing|entrepreneur|fundraising|sponsorship|finance|\bretail\b/,
 'climate':/climate|sustainability|zero waste|carbon|stormwater/,
 'computer science':/computer science|computing|coding|software|programming|cybersecurity|web development|data science|information technology|uas4stem/,
 'dance':/\bdance\b|\bdancer|ballet|hip hop|\btap\b|\bjazz\b|contemporary|choreograph|\bcontra\b/,
 'engineering':/engineering|robotics|\brobot\b|uas4stem|\bdrone\b|mechanical|electrical|aviation/,
 'environmental science':/environment|conservation|ecology|watershed|\briver\b|stormwater|natural area|stewardship|sustainability|climate/,
 'government / civic engagement':/government|civic engagement|civic education|public policy|election|advocacy|democracy|political|public office|voter|\blaw\b/,
 'journalism':/journalism|newspaper|reporter|editorial/,
 'mathematics':/mathematics|math circle|math corps|statistics/,
 'medicine / health':/medicine|medical|health|healthcare|nursing|public health/,
 'music':/\bmusic\b|choir|vocal|orchestra|symphony|a cappella|\bconcert\b/,
 'outdoors':/\boutdoor|\briver\b|natural area|stewardship|\bfarm\b|\bgarden\b|\btrail\b|\blivery\b|park volunteer|park adoption/,
 'robotics':/robotics|robot|uas4stem|drone engineering|unmanned aircraft/,
 'sports':/\bsports?\b|soccer|volleyball|baseball|softball|basketball|football|athletics|\bcoach|aquatics|\browing\b|\bgolf\b|tennis|\bswim|track and field|track & field|cross country|equestrian|field hockey|water polo|bowling|figure skating|ice hockey|wrestling|lacrosse/,
 'tutoring / education':/tutoring|tutor|education|teaching|literacy|mentor/,
 'writing':/\bwriting\b|songwriting|creative writing|\bauthor\b|poetry|literary|\bessay\b/,
};
const matchesInterest=(o:Opportunity,interest:string)=>{
 const value=interest.toLowerCase();
 if(Array.isArray(o.interestTags))return o.interestTags.some((tag)=>tag.toLowerCase()===value);
 if(value==='community service')return o.category==='Volunteer'||/community service|\bvolunteer|service leadership|philanthropy|community support|stewardship|\bcleanup\b|food distribution|community kitchen|after-school tutor/.test(interestText(o));
 if(value==='computer science'&&/coding|software|programming|cybersecurity|web development|data science/.test(o.summary.toLowerCase()))return true;
 if(value==='medicine / health'&&/farm work|produce share packing|flower garden/.test(o.title.toLowerCase()))return false;
 if(value==='theatre')return !/^dance theatre studio/i.test(o.title)&&/theatre|theater|stage|audition|production crew/.test(interestText(o));
 const pattern=interestPatterns[value]||new RegExp(`\\b${value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`);
 return pattern.test(interestText(o));
};
export function opportunityMatchesFilters(o:Opportunity,p:Preferences,interests:string[]=[],typedQuery=''){
 const hay=searchableText(o);
 if(p.categories.length&&!p.categories.includes(o.category))return false;
 if(interests.length&&!interests.some(interest=>matchesInterest(o,interest)))return false;
 const queryTerms=terms(typedQuery);if(queryTerms.length&&!queryTerms.some(term=>hay.includes(term)))return false;
 if(p.freeOnly&&(!o.cost||!/free|\$0|no fee/i.test(o.cost)))return false;
 if(p.paid&&!/\bpaid\b|hourly|stipend|scholarship|prize/i.test(o.compensation||''))return false;
 if(p.onCampus&&!/pioneer|on campus/i.test(`${o.location||''} ${o.transportation||''}`))return false;
 if(p.verifiedOnly&&o.confidence!=='High')return false;
 if(p.grade&&(!o.eligibility||!(new RegExp(`grade[s]?[^.]*${p.grade}|${p.grade}(?:th)? grade`,'i').test(o.eligibility)||/high school|pioneer students|teens/i.test(o.eligibility))))return false;
 return true;
}
export function matchOpportunity(o:Opportunity,p:Preferences):MatchResult{
 const passed:string[]=[],failed:string[]=[],unknown:string[]=[],relaxed:string[]=[];
 const hay=searchableText(o);
 const queryTerms=terms(p.query); const matchedInterests=queryTerms.filter(t=>hay.includes(t));
 if(p.categories.length){p.categories.some(c=>o.category.toLowerCase().includes(c.toLowerCase())||o.subcategory?.toLowerCase().includes(c.toLowerCase()))?passed.push('Opportunity type'):failed.push('Opportunity type');}
 if(p.freeOnly){if(!o.cost)unknown.push('Cost is not stated'); else if(/free|\$0|no fee/i.test(o.cost))passed.push('Free'); else failed.push('Free only');}
 if(p.paid){if(/\bpaid\b|hourly|stipend|scholarship|prize/i.test(o.compensation||''))passed.push('Paid or funded');else if(!o.compensation)unknown.push('Compensation');else failed.push('Paid');}
 if(p.onCampus){if(/pioneer|on campus/i.test(`${o.location} ${o.transportation}`))passed.push('On campus');else if(!o.location)unknown.push('Location');else failed.push('On campus');}
 if(p.verifiedOnly){o.confidence==='High'?passed.push('High-confidence source'):failed.push('Verified only');}
 if(p.grade){if(!o.eligibility)unknown.push('Grade eligibility');else if(new RegExp(`grade[s]?[^.]*${p.grade}|${p.grade}(?:th)? grade`,'i').test(o.eligibility)||/high school|pioneer students|teens/i.test(o.eligibility))passed.push(`Grade ${p.grade}`);else unknown.push(`Grade ${p.grade} not explicitly published`);}
 if(o.status==='closed')failed.push('Listing is closed'); if(o.status==='verify')unknown.push('Current status needs confirmation');
 let classification:MatchResult['classification']='exact';
 if(failed.length){classification=failed.length<=2?'near':'explore';relaxed.push(...failed);} else if(unknown.length)classification='likely';
 const relevance=queryTerms.length?matchedInterests.length/queryTerms.length:0.5;
 const certainty=(passed.length+unknown.length?passed.length/(passed.length+unknown.length):0.8);
 const freshness=o.confidence==='High'?1:o.confidence==='Medium'?.65:.35;
 const score=Math.round((certainty*.3+relevance*.2+freshness*.05+(o.status==='open'||o.status==='ongoing'?0.15:.05)+.3)*100);
 return {classification,score:Math.min(100,score),passed,failed,unknown,matchedInterests,relaxed,algorithmVersion:'1.0.0'};
}
