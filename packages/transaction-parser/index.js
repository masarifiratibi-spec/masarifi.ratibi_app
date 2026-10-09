'use strict';

const defaultSnapshot = require('./default-rules.json');
const evidenceCorpus = require('./corpus.json');
const ENGINE_VERSION = '2.0.0';
const DIRECTIONS = ['outgoing', 'incoming', 'internal', 'unknown'];
const STATUSES = ['completed', 'pending', 'failed', 'declined', 'cancelled', 'administrative', 'unknown'];
const DISPOSITIONS = ['capture_candidate', 'review', 'ignore'];
const SUBTYPES = ['administrative', 'reversal', 'refund', 'salary', 'pos_purchase', 'online_purchase', 'card_purchase', 'bill_payment', 'withdrawal', 'transfer_sent', 'transfer_received', 'generic_debit', 'purchase', 'payment', 'fee', 'deposit', 'generic_credit'];

function normalizeFinancialText(value) {
  return value.normalize('NFKC').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/٫/g, '.').replace(/٬/g, ',')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
}
function boundedStrings(value, max = 64) {
  return Array.isArray(value) && value.length <= max && value.every(s => typeof s === 'string' && s.length > 0 && s.length <= 160);
}
function validateRuleSnapshot(value) {
  const fail = () => { throw new Error('TRACKING_RULE_SNAPSHOT_INVALID'); };
  if (!value || value.schemaVersion !== 2 || value.engineVersion !== ENGINE_VERSION || value.aiEnabled !== false ||
    typeof value.releaseId !== 'string' || value.releaseId.length > 100 || !Number.isSafeInteger(value.releaseNo) || value.releaseNo < 1 ||
    !Array.isArray(value.rules) || value.rules.length > 256 || !Array.isArray(value.currencies) || value.currencies.length > 32) fail();
  const keys = new Set();
  for (const rule of value.rules) {
    if (!rule || typeof rule.ruleKey !== 'string' || !/^[a-z0-9._-]{1,100}$/.test(rule.ruleKey) || keys.has(rule.ruleKey) ||
      !['action', 'status', 'exclusion'].includes(rule.family) || typeof rule.enabled !== 'boolean' || !Number.isInteger(rule.priority) || rule.priority < 0 || rule.priority > 10000 ||
      !boundedStrings(rule.any) || rule.any.length === 0 || ['all', 'not', 'countries', 'locales', 'providers', 'channels'].some(k => rule[k] !== undefined && !boundedStrings(rule[k])) ||
      !rule.effects || Object.keys(rule.effects).some(k => !['direction', 'subtype', 'status', 'disposition'].includes(k))) fail();
    if (rule.effects.direction && !DIRECTIONS.includes(rule.effects.direction) || rule.effects.status && !STATUSES.includes(rule.effects.status) ||
      rule.effects.disposition && !DISPOSITIONS.includes(rule.effects.disposition) || rule.effects.subtype && !SUBTYPES.includes(rule.effects.subtype)) fail();
    keys.add(rule.ruleKey);
  }
  const codes = new Set();
  if(value.discoveryContexts !== undefined && !boundedStrings(value.discoveryContexts)) fail();
  for (const currency of value.currencies) {
    if (!currency || !/^[A-Z]{3}$/.test(currency.code) || codes.has(currency.code) || !Number.isInteger(currency.scale) || currency.scale < 0 || currency.scale > 3 || typeof currency.supported !== 'boolean' || !boundedStrings(currency.aliases, 16) || !currency.aliases.length) fail();
    codes.add(currency.code);
  }
  if(value.providers && (!Array.isArray(value.providers) || value.providers.length>100 || value.providers.some(p=>!p || typeof p.providerKey!=='string' || p.providerKey.length>80 || !/^[A-Z]{2}$/.test(p.country) || !boundedStrings(p.senders) || !boundedStrings(p.packages)))) fail();
  // Lifecycle/exclusion safety is a publishing invariant, even when action wording is customized.
  for(const required of defaultSnapshot.rules.filter(r=>r.family!=='action')) {
    const configured=value.rules.find(r=>r.ruleKey===required.ruleKey);
    if(!configured?.enabled || !required.any.every(phrase=>configured.any.includes(phrase)) ||
      ['family','priority','all','not','countries','locales','providers','channels','effects'].some(key => canonicalJson(configured[key]) !== canonicalJson(required[key]))) fail();
  }
  return value;
}
function canonicalJson(value) {
  if(value === undefined) return 'undefined';
  if(Array.isArray(value)) return '['+value.map(canonicalJson).join(',')+']';
  if(value && typeof value==='object') return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(value[key])).join(',')+'}';
  return JSON.stringify(value);
}
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function phraseMatches(text, phrase) {
  return new RegExp(`(?<![\\p{L}])${escape(normalizeFinancialText(phrase).toLowerCase())}(?![\\p{L}])`, 'u').test(text);
}
function applies(rule, input, text) {
  return rule.enabled && [['countries', input.country], ['locales', input.locale], ['providers', input.sender], ['channels', input.channel]]
    .every(([key, v]) => !rule[key]?.length || v && rule[key].some(s => s.toLowerCase() === v.toLowerCase())) &&
    rule.any.some(p => phraseMatches(text, p)) && (rule.all || []).every(p => phraseMatches(text, p)) && !(rule.not || []).some(p => phraseMatches(text, p));
}
function minorUnits(raw, scale) {
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.replace(/,/g, '').split('.');
  if (fraction.length > scale) return null;
  const value = Number(whole + fraction.padEnd(scale, '0'));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
function moneyCandidates(text, snapshot) {
  const aliases = snapshot.currencies.flatMap(c => c.aliases.map(a => ({alias: normalizeFinancialText(a), currency: c}))).sort((a,b) => b.alias.length-a.alias.length);
  const byAlias = new Map(aliases.map(a => [a.alias.toLowerCase(), a.currency]));
  const token = aliases.map(a => escape(a.alias)).join('|');
  const number = '[0-9][0-9,]*(?:\\.[0-9]+)?';
  const pattern = new RegExp(`(?<![\\p{L}])(?:(${token})\\s*(${number})|(${number})\\s*(${token}))(?![\\p{L}])`, 'giu');
  const candidates = [];
  for (const m of text.matchAll(pattern)) {
    const currency = byAlias.get((m[1] || m[4]).toLowerCase());
    const before = text.slice(Math.max(0,m.index-60),m.index).toLowerCase();
    const after = text.slice(m.index+m[0].length,m.index+m[0].length+32).toLowerCase();
    // Roles are structural boundaries, not a preference for one currency over another.
    const role = /(?:avl\.?\s*bal|available\s+balance|balance|الرصيد|رصيد)[^.;:]*[: ]*$/.test(before) ? 'balance' :
      /(?:fee|fees|charge|commission|رسوم|عمولة)\s*[: ]*$/.test(before) ? 'fee' :
      /(?:equivalent|exchange rate|converted|ما يعادل)\s*[: ]*$/.test(before) || /^\s*(?:equivalent|ما يعادل)/.test(after) ? 'fx' : 'transaction';
    candidates.push({ role, amountMinor: minorUnits(m[2] || m[3],currency.scale), currency:currency.code, supported:currency.supported });
  }
  return candidates;
}
function extractTime(text, input) {
  const offset = input.country === 'SA' ? '+03:00' : input.country === 'AE' ? '+04:00' : null;
  const build = (year,month,day,hour,minute,second='00') => {
    if (!offset || +month < 1 || +month > 12 || +day < 1 || +day > 31 || +hour > 23 || +minute > 59 || +second > 59) return null;
    const stamp = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${minute}:${second}${offset}`;
    const date = new Date(stamp);
    if (!Number.isFinite(date.valueOf())) return null;
    // Reject rollover dates such as 31 February.
    const local = new Date(date.valueOf() + (offset === '+03:00' ? 3 : 4)*3600000);
    return local.getUTCDate() === +day && local.getUTCMonth()+1 === +month ? date.toISOString() : null;
  };
  let m = text.match(/\b(20\d{2})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return {occurredAt:build(m[1],m[2],m[3],m[4],m[5],m[6]), timeProvenance:'embedded'};
  m = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return {occurredAt: +m[1] > 12 ? build(m[3],m[2],m[1],m[4],m[5],m[6]) : null, timeProvenance: +m[1] > 12 ? 'embedded' : 'ambiguous'};
  m = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(20\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (m) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    let hour = +m[4]; if (m[7]) {if(hour < 1 || hour > 12) return {occurredAt:null,timeProvenance:'ambiguous'}; hour = hour%12+(m[7].toUpperCase()==='PM'?12:0);}
    return {occurredAt:build(m[3],months.indexOf(m[1].toLowerCase())+1,m[2],hour,m[5],m[6]),timeProvenance:'embedded'};
  }
  if (/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(text)) return {occurredAt:null,timeProvenance:'ambiguous'};
  return {occurredAt: Number.isFinite(input.receivedAt) ? new Date(input.receivedAt).toISOString() : null,timeProvenance:'received'};
}
function classifyFinancialMessage(input, snapshot = defaultSnapshot) {
  validateRuleSnapshot(snapshot);
  const text = normalizeFinancialText(input.text.slice(0,8000)), lower = text.toLowerCase();
  const matched = snapshot.rules.filter(r => applies(r,input,lower)).sort((a,b) => b.priority-a.priority || a.ruleKey.localeCompare(b.ruleKey));
  // Published database wording can extend the safety vocabulary. The baseline
  // constrains safety effects/precedence; it is not the runtime phrase catalog.
  const protectedKeys=new Set(defaultSnapshot.rules.filter(r=>r.family!=='action').map(r=>r.ruleKey));
  const protectedMatches=matched.filter(r=>protectedKeys.has(r.ruleKey));
  const exclusion = protectedMatches.find(r => r.family==='exclusion') ?? matched.find(r => r.family==='exclusion');
  const action = matched.find(r => r.family==='action');
  const lifecycle = protectedMatches.find(r => r.family==='status') ?? matched.find(r => r.family==='status');
  const result = {direction:'unknown',subtype:'unknown',status:'unknown',disposition:'review',amountMinor:null,currency:null,merchant:null,instruments:[],providerReference:null,
    ...extractTime(text,input),reasonCodes:[],appliedRuleKeys:matched.map(r=>r.ruleKey),releaseId:snapshot.releaseId,engineVersion:ENGINE_VERSION};
  if (action) Object.assign(result,action.effects);
  if (action && matched.some(r=>r.family==='action' && r.effects.direction && r.effects.direction!==action.effects.direction)) result.reasonCodes.push('conflicting_direction');
  if (lifecycle) Object.assign(result,lifecycle.effects);
  if (exclusion) { Object.assign(result,exclusion.effects); result.reasonCodes.push('administrative_or_excluded'); return result; }
  const candidates = moneyCandidates(text,snapshot);
  const amounts = candidates.filter(c=>c.role==='transaction' || result.subtype==='fee' && c.role==='fee');
  if (amounts.length === 1) {result.amountMinor=amounts[0].amountMinor; result.currency=amounts[0].currency; if(!amounts[0].supported) result.reasonCodes.push('unsupported_currency');}
  else result.reasonCodes.push(amounts.length ? 'amount_conflict':'amount_missing');
  if (result.amountMinor===null) result.reasonCodes.push('amount_invalid');
  for (const m of text.matchAll(/(?:\b(debit card|credit card|card|account(?: number)?|acc\.?|acct|ending)(?![\p{L}])|(بطاقة|حساب))\s*[:#-]?\s*([xX*•]*\d{4,12}\*?)/giu)) {
    const label = (m[1]||m[2]).toLowerCase(), suffix=m[3].replace(/[^0-9]/g,'');
    result.instruments.push({role:/card|بطاقة|ending/.test(label)?'card':'account',suffix});
  }
  const merchant = text.match(/(?:\bat\b|\bby\b|لدى|من)\s+(.+?)(?=,?\s*(?:\b(?:AE|SA)\b[.,]|Avl\.?\s*Bal|Available\s+Balance|\bon\b|\busing\b|\bwith\b|\bvia\b|\bcard\b|\baccount\b|في\s+\d|بواسطة|عن طريق)|$)/iu)?.[1];
  result.merchant=merchant ? merchant.replace(/[.,\s]+$/,'').slice(0,160) : null;
  result.providerReference = text.match(/(?:reference(?: number)?|ref\.?|الرقم المرجعي(?: للمعاملة هو)?)\s*[:#]?\s*([A-Za-z0-9-]{6,80})/iu)?.[1] || null;
  if (!action) result.reasonCodes.push('action_unknown');
  if (['generic_credit','deposit','transfer_sent','transfer_received','withdrawal','refund','reversal'].includes(result.subtype)) result.reasonCodes.push('accounting_review_required');
  if (result.timeProvenance === 'ambiguous' || result.timeProvenance === 'embedded' && !result.occurredAt) result.reasonCodes.push('date_ambiguous');
  if (!lifecycle && action && !result.reasonCodes.length) result.disposition='capture_candidate';
  if (/\b(?:offer|promo|discount)\b|عرض|خصم\s*\d+\s*%/iu.test(lower)) result.disposition='ignore';
  return result;
}
function validateClassification(value) {
  const fail = () => {throw new Error('TRACKING_CLASSIFICATION_INVALID');};
  if (!value || Object.keys(value).some(k=>!['direction','subtype','status','disposition','amountMinor','currency','merchant','instruments','occurredAt','timeProvenance','reasonCodes','appliedRuleKeys','releaseId','engineVersion'].includes(k)) ||
    !DIRECTIONS.includes(value.direction) || !STATUSES.includes(value.status) || !DISPOSITIONS.includes(value.disposition) || !['unknown',...SUBTYPES].includes(value.subtype) ||
    value.engineVersion !== ENGINE_VERSION || typeof value.releaseId !== 'string' || value.releaseId.length>100 ||
    !(value.amountMinor===null || Number.isSafeInteger(value.amountMinor) && value.amountMinor>0) || !(value.currency===null || /^[A-Z]{3}$/.test(value.currency)) ||
    !(value.merchant===null || typeof value.merchant==='string' && value.merchant.length<=160) || !boundedStrings(value.reasonCodes,32) || !boundedStrings(value.appliedRuleKeys,64) ||
    !['embedded','received','ambiguous'].includes(value.timeProvenance) || !(value.occurredAt===null || typeof value.occurredAt==='string' && Number.isFinite(Date.parse(value.occurredAt)) && /Z$/.test(value.occurredAt)) ||
    !Array.isArray(value.instruments) || value.instruments.length>8 || value.instruments.some(h=>!h || !['card','account'].includes(h.role) || !/^\d{4,12}$/.test(h.suffix))) fail();
  if(value.disposition==='capture_candidate' && (value.status!=='completed' || value.direction==='unknown' || value.amountMinor===null || value.currency===null || value.reasonCodes.length || ['generic_credit','deposit','transfer_sent','transfer_received','withdrawal','refund','reversal'].includes(value.subtype))) fail();
  return value;
}
function effectiveFinancialSnapshot(snapshot, overrides = []) {
  validateRuleSnapshot(snapshot);
  const disabled = new Set(overrides.filter(r=>r.enabled===false).map(r=>normalizeFinancialText(r.value).toLowerCase()));
  return {...snapshot, rules:snapshot.rules.map(rule=>({...rule,
    any:rule.family==='action' ? rule.any.filter(phrase=>!disabled.has(normalizeFinancialText(phrase).toLowerCase())) : rule.any
  })).filter(rule=>rule.any.length)};
}
function customFinancialEvidence(overrides) {
  return overrides.filter(r=>r.enabled && r.origin==='custom' && typeof r.id==='string' &&
    typeof r.value==='string' && r.value.trim().length>0 && r.value.length<=160).slice(0,256)
    .map(r=>({ruleKey:`custom.${r.id.replace(/[^a-z0-9._-]/gi,'_').slice(0,80)}`,phrase:normalizeFinancialText(r.value).toLowerCase()}));
}
// This pattern is structural marketing syntax shared with the classifier;
// published exclusions supply the editable phrase vocabulary.
const marketingPattern = '\\b(?:offer|promo|discount)\\b|عرض|خصم\\s*\\d+\\s*%';
function compileFinancialDiscoveryPolicy(snapshot, overrides = []) {
  const effective=effectiveFinancialSnapshot(snapshot,overrides);
  return {version:1,releaseId:effective.releaseId,engineVersion:ENGINE_VERSION,
    rules:effective.rules.map(rule=>({...rule,any:rule.any.map(p=>normalizeFinancialText(p).toLowerCase()),
      all:(rule.all||[]).map(p=>normalizeFinancialText(p).toLowerCase()),not:(rule.not||[]).map(p=>normalizeFinancialText(p).toLowerCase())})),
    currencies:effective.currencies,contexts:(effective.discoveryContexts||[]).map(p=>normalizeFinancialText(p).toLowerCase()),
    custom:customFinancialEvidence(overrides),providers:effective.providers||[],marketingPattern};
}
function discoverFinancialMessage(input, snapshot = defaultSnapshot, overrides = []) {
  const effective=effectiveFinancialSnapshot(snapshot,overrides);
  const classification=classifyFinancialMessage(input,effective);
  const text=normalizeFinancialText(input.text.slice(0,8000)).toLowerCase();
  const matched=effective.rules.filter(rule=>applies(rule,input,text));
  const custom=customFinancialEvidence(overrides).filter(rule=>phraseMatches(text,rule.phrase));
  const customRuleKeys=custom.map(rule=>rule.ruleKey);
  classification.appliedRuleKeys=[...new Set([...classification.appliedRuleKeys,...customRuleKeys])].slice(0,64);
  const monetaryEvidence=moneyCandidates(text,effective).some(c=>c.amountMinor!==null &&
    (c.role==='transaction' || classification.subtype==='fee' && c.role==='fee'));
  const financialEvidence=matched.some(rule=>rule.family==='action') || custom.length>0 &&
    (effective.discoveryContexts||[]).some(phrase=>phraseMatches(text,phrase));
  // Discovery grants retention, never source trust, completion or posting authority.
  const strong=classification.disposition!=='ignore' && monetaryEvidence && Boolean(financialEvidence);
  return {strong,classification,customRuleKeys};
}
module.exports = {canonicalJson, classifyFinancialMessage,normalizeFinancialText,validateRuleSnapshot,validateClassification,defaultSnapshot,evidenceCorpus,
  effectiveFinancialSnapshot,compileFinancialDiscoveryPolicy,discoverFinancialMessage};
