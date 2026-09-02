export const RETENTION={securityLogsDays:30,analyticsMonths:12,anonymousSubmissionsMonths:12,deletedAccountDays:30,backupsDays:90} as const;
export function redactAnalytics(input:{query?:string;filters?:Record<string,unknown>}){return {filters:input.filters??{},hasFreeText:Boolean(input.query?.trim()),queryLengthBucket:input.query?Math.min(50,Math.ceil(input.query.length/10)*10):0}}
