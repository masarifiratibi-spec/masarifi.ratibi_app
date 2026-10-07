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
});
