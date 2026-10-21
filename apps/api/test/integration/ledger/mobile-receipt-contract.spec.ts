import { randomUUID } from 'node:crypto';
import { ledgerDetailSchema } from '../../../../mobile/src/services/live/ledger-api-contract';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('actual Manual ledger receipts accepted by the Mobile parser', () => {
  const pool=createLivePool();
  const repository=new LedgerRepository(pool);
  const owner={userId:`manual_contract_${randomUUID()}`,sessionId:'sample-session',factorAgeSeconds:0};
  const accountId=randomUUID();
  beforeAll(async()=>{
    if(!['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL??'').hostname))
      throw Error('DISPOSABLE_LOCAL_DATABASE_REQUIRED');
    await pool.query("insert into public.profiles(id,status) values($1,'active')",[owner.userId]);
    await pool.query("insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Sample Cash','cash','SAR')",[accountId,owner.userId]);
  });
  afterAll(()=>pool.onModuleDestroy());

  it.each(['income','expense'] as const)('parses and replays a committed %s without replacement financial effects',async kind=>{
    const input={operation:'createTransaction',scope:'ledger.transaction.create',principal:owner,
      command:{kind,amountMinor:5700,currency:'SAR',accountId,categoryId:null,title:'Sample contract receipt',
        merchant:null,paymentMethod:null,note:'Sample data',occurredAt:new Date().toISOString(),source:'manual',externalRef:null},
      idempotencyKey:`manual-contract-${kind}-${randomUUID()}`,requestId:randomUUID(),status:201};
    const first=await repository.mutate(input);
    const detail=ledgerDetailSchema.parse(first!==null&&typeof first==='object'?Reflect.get(first,'transaction'):null);
    expect(detail.postings).toHaveLength(1);
    expect(detail.postings[0]).toMatchObject({accountId,postingRole:kind==='income'?'destination':'source',
      amountMinor:kind==='income'?5700:-5700});
    expect(await repository.mutate(input)).toEqual(first);
    const counts=await pool.query<{transactions:number;postings:number}>(
      `select (select count(*)::int from public.transactions where id=$1) transactions,
       (select count(*)::int from public.transaction_postings where transaction_id=$1) postings`,[detail.transaction.id]);
    expect(counts.rows[0]).toEqual({transactions:1,postings:1});
    // The old income/source assumption caused the observed lost receipt.
    const invalid={...detail,postings:[{...detail.postings[0],postingRole:kind==='income'?'source':'destination'}]};
    expect(ledgerDetailSchema.safeParse(invalid).success).toBe(false);
  });

  it.each(['income','expense'] as const)('reads and replays a corrected manual %s with append-only postings',async kind=>{
    const originalKind=kind==='income'?'expense':'income';
    const created=await repository.mutate({operation:'createTransaction',scope:'ledger.transaction.create',principal:owner,
      command:{kind:originalKind,amountMinor:1000,currency:'SAR',accountId,categoryId:null,title:'Synthetic correction',
        merchant:null,paymentMethod:null,note:null,occurredAt:new Date().toISOString(),source:'manual',externalRef:null},
      idempotencyKey:`correction-create-${randomUUID()}`,requestId:randomUUID(),status:201});
    const original=ledgerDetailSchema.parse(Reflect.get(created as object,'transaction'));
    const input={operation:'reviseTransaction',scope:'ledger.transaction.revise',principal:owner,
      command:{transactionId:original.transaction.id,expectedVersion:original.transaction.version,patch:{kind,categoryId:null},reason:'Synthetic correction'},
      idempotencyKey:`correction-${randomUUID()}`,requestId:randomUUID(),status:200};
    const corrected=await repository.mutate(input);
    const detail=ledgerDetailSchema.parse(Reflect.get(corrected as object,'transaction'));
    expect(detail.transaction).toMatchObject({id:original.transaction.id,kind,version:2,source:'manual'});
    expect(detail.postings).toHaveLength(3);
    expect(detail.postings).toEqual(expect.arrayContaining(original.postings));
    expect(detail.postings.reduce((sum,posting)=>sum+posting.amountMinor,0)).toBe(kind==='income'?1000:-1000);
    expect(ledgerDetailSchema.safeParse({...detail,postings:detail.postings.map((posting,index)=>
      index===1?{...posting,amountMinor:posting.amountMinor+1}:posting)}).success).toBe(false);
    expect(await repository.mutate(input)).toEqual(corrected);
    expect(ledgerDetailSchema.parse(await repository.getTransaction(owner,detail.transaction.id)).transaction.kind).toBe(kind);
    const listing=await repository.listTransactions(owner,{});
    expect((listing.items as Array<{id:string;kind:string}>).find(row=>row.id===detail.transaction.id)?.kind).toBe(kind);
    const accountSummary=await repository.getAccountSummary(owner,accountId,{});
    expect((accountSummary.recentTransactions as Array<{id:string;kind:string}>).find(row=>row.id===detail.transaction.id)?.kind).toBe(kind);
    await repository.mutate({operation:'reverseTransaction',scope:'ledger.transaction.reverse',principal:owner,
      command:{transactionId:detail.transaction.id,expectedVersion:2,occurredAt:new Date().toISOString(),reason:'Synthetic reversal'},
      idempotencyKey:`correction-reverse-${randomUUID()}`,requestId:randomUUID(),status:201});
    const reversed=ledgerDetailSchema.parse(await repository.getTransaction(owner,detail.transaction.id));
    expect(reversed.transaction.status).toBe('reversed');
    const canonicalPostings=(postings:typeof detail.postings)=>postings.map(posting=>
      ({...posting,occurredAt:new Date(posting.occurredAt).toISOString()}));
    expect(canonicalPostings(reversed.postings)).toEqual(canonicalPostings(detail.postings));
  });
});
