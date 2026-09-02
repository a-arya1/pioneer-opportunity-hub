import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import data from '../data/opportunities.json';
import type { MatchClass, Opportunity, Preferences } from '../types';
import { matchOpportunity, opportunityMatchesFilters } from '../lib/matching';
import OpportunityCard from '../components/OpportunityCard';
import { useSaved } from '../hooks/useSaved';

const all = (data as Opportunity[]).filter((opportunity) => opportunity.published);
const categories = [...new Set(all.map((opportunity) => opportunity.category))].sort();
const interests = [
  'Arts', 'Biology', 'Business', 'Climate', 'Community service', 'Computer science',
  'Dance', 'Engineering', 'Environmental science', 'Government / civic engagement',
  'Journalism', 'Mathematics', 'Medicine / health', 'Music', 'Outdoors', 'Robotics',
  'Sports', 'Theatre', 'Tutoring / education', 'Writing',
];
type ActiveFilter = { key: string; label: string; value?: string };

function replaceMultiValue(params: URLSearchParams, key: string, value: string, checked: boolean) {
  const next = new URLSearchParams(params);
  const values = next.getAll(key).filter((item) => item !== value);
  next.delete(key);
  [...values, ...(checked ? [value] : [])].forEach((item) => next.append(key, item));
  return next;
}

export default function Opportunities() {
  const [params, setParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const saves = useSaved();
  const selectedInterests = params.getAll('interest');
  const typedQuery = params.get('q') || '';
  const preferences: Preferences = {
    query: [typedQuery, ...selectedInterests].filter(Boolean).join(' '),
    categories: params.getAll('category'),
    freeOnly: params.get('free') === '1', paid: params.get('paid') === '1',
    onCampus: params.get('campus') === '1', verifiedOnly: params.get('verified') === '1',
    grade: params.get('grade') || undefined,
  };

  const update = (key: string, value: string | boolean) => {
    const next = new URLSearchParams(params);
    if (typeof value === 'boolean') value ? next.set(key, '1') : next.delete(key);
    else value ? next.set(key, value) : next.delete(key);
    setParams(next);
  };

  const removeFilter = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value === undefined) next.delete(key);
    else {
      const remaining = next.getAll(key).filter((item) => item !== value);
      next.delete(key);
      remaining.forEach((item) => next.append(key, item));
    }
    setParams(next);
  };

  const results = useMemo(
    () => all.filter((opportunity) => opportunityMatchesFilters(opportunity, preferences, selectedInterests, typedQuery))
      .map((opportunity) => ({ opportunity, match: matchOpportunity(opportunity, preferences) }))
      .sort((a, b) => b.match.score - a.match.score),
    // URL parameters are the source of truth for the filter panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.toString()],
  );
  const groups = (['exact', 'likely', 'near', 'explore'] as MatchClass[]).map(
    (classification) => [classification, results.filter(({ match }) => match.classification === classification)] as const,
  );
  const activeFilters: ActiveFilter[] = [
    ...preferences.categories.map((value) => ({ key: 'category', value, label: value })),
    ...selectedInterests.map((value) => ({ key: 'interest', value, label: value })),
    ...(typedQuery ? [{ key: 'q', label: `Search: “${typedQuery}”` }] : []),
    ...(preferences.freeOnly ? [{ key: 'free', label: 'Free only' }] : []),
    ...(preferences.paid ? [{ key: 'paid', label: 'Paid or funded' }] : []),
    ...(preferences.onCampus ? [{ key: 'campus', label: 'Pioneer / on campus' }] : []),
    ...(preferences.verifiedOnly ? [{ key: 'verified', label: 'High-confidence source' }] : []),
    ...(preferences.grade ? [{ key: 'grade', label: `Grade ${preferences.grade}` }] : []),
  ];

  return <section className="browse">
    <div className="page-heading"><p className="kicker">OPPORTUNITY DIRECTORY</p><h1>Browse opportunities</h1><p>Select any filters that matter. Within a group, selecting more than one option shows opportunities matching any selected option.</p></div>
    <div className="mobile-tools"><button className="button secondary" onClick={() => setMobileFiltersOpen(true)}>Filters {activeFilters.length ? `(${activeFilters.length})` : ''}</button></div>
    <div className="browse-layout">
      <aside className={`filters ${mobileFiltersOpen ? 'open' : ''}`} aria-label="Opportunity filters">
        <div className="filter-title"><h2>Filters</h2><button onClick={() => setMobileFiltersOpen(false)} className="close">Close</button></div>
        <fieldset><legend>Grade</legend><select value={preferences.grade || ''} onChange={(event) => update('grade', event.target.value)}><option value="">Don’t care</option>{['9', '10', '11', '12'].map((grade) => <option key={grade}>{grade}</option>)}</select></fieldset>
        <fieldset><legend>Interests</legend>{interests.map((interest) => <label className="check" key={interest}><input type="checkbox" checked={selectedInterests.includes(interest)} onChange={(event) => setParams(replaceMultiValue(params, 'interest', interest, event.target.checked))}/>{interest}</label>)}</fieldset>
        <fieldset><legend>Opportunity type</legend>{categories.map((category) => <label className="check" key={category}><input type="checkbox" checked={preferences.categories.includes(category)} onChange={(event) => setParams(replaceMultiValue(params, 'category', category, event.target.checked))}/>{category}</label>)}</fieldset>
        <fieldset><legend>Practical fit</legend>
          <label className="check"><input type="checkbox" checked={preferences.freeOnly} onChange={(event) => update('free', event.target.checked)}/>Free only</label>
          <label className="check"><input type="checkbox" checked={preferences.paid} onChange={(event) => update('paid', event.target.checked)}/>Paid or funded</label>
          <label className="check"><input type="checkbox" checked={preferences.onCampus} onChange={(event) => update('campus', event.target.checked)}/>Pioneer / on campus</label>
          <label className="check"><input type="checkbox" checked={preferences.verifiedOnly} onChange={(event) => update('verified', event.target.checked)}/>High-confidence source</label>
        </fieldset>
        <button className="text-button" onClick={() => setParams({})}>Clear all</button>
      </aside>
      <div className="result-column">
        <div className="result-summary" aria-live="polite"><strong>{results.length} opportunities</strong><span>{activeFilters.length ? `${activeFilters.length} active filters` : 'Showing current, publishable listings'}</span></div>
        {activeFilters.length > 0 && <section className="active-filter-bar" aria-labelledby="active-filter-heading">
          <div>
            <p className="eyebrow">YOUR SELECTIONS</p>
            <h2 id="active-filter-heading">Showing results for</h2>
          </div>
          <div className="active-filter-chips">
            {activeFilters.map((filter) => <button
              type="button"
              className="active-filter-chip"
              key={`${filter.key}-${filter.value || filter.label}`}
              onClick={() => removeFilter(filter.key, filter.value)}
              aria-label={`Remove ${filter.label} filter`}
            ><span>{filter.label}</span><span aria-hidden="true">×</span></button>)}
            <button type="button" className="text-button clear-filters" onClick={() => setParams({})}>Clear all</button>
          </div>
        </section>}
        {results.length === 0 ? <div className="empty"><h2>No results yet</h2><p>Try fewer filters. We won’t silently relax a selected filter.</p><button className="button" onClick={() => setParams({})}>Clear filters</button></div> : groups.map(([classification, items]) => items.length > 0 && <section className="match-section" key={classification}>
          <div className="match-heading"><h2>{classification[0].toUpperCase() + classification.slice(1)} match</h2><p>{classification === 'exact' ? 'All known must-haves pass.' : classification === 'likely' ? 'Nothing fails, but a key fact is unknown.' : classification === 'near' ? 'One or two preferences are uncertain.' : 'Additional local options.'}</p></div>
          {items.map(({ opportunity, match }) => <OpportunityCard key={opportunity.id} o={opportunity} match={match} saved={saves.saved.includes(opportunity.id)} onSave={() => saves.toggle(opportunity.id)}/>)}
        </section>)}
      </div>
    </div>
  </section>;
}
