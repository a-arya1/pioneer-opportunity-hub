import {describe,it,expect} from 'vitest';import {redactAnalytics} from '../src/lib/retention';
describe('analytics redaction',()=>it('does not retain raw search text',()=>{const x=redactAnalytics({query:'my private medical issue',filters:{category:'health'}});expect(x).not.toHaveProperty('query');expect(x.hasFreeText).toBe(true)}));
