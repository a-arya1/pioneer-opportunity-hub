import {describe,expect,it} from 'vitest';
import {listingFreshness} from '../src/lib/freshness';

describe('listing freshness',()=>{
  const now=new Date('2026-09-08T12:00:00Z');
  it('marks listings checked within 45 days as recent',()=>{
    expect(listingFreshness('2026-08-27',now)).toMatchObject({state:'current',label:'Recently checked'});
  });
  it('marks listings from 46 to 90 days old for upcoming review',()=>{
    expect(listingFreshness('2026-07-01',now)).toMatchObject({state:'review-soon',label:'Review soon'});
  });
  it('marks listings older than 90 days as needing rechecking',()=>{
    expect(listingFreshness('2026-05-01',now)).toMatchObject({state:'needs-review',label:'Needs rechecking'});
  });
});
