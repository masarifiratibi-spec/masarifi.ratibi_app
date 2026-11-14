// Offline consistency validation only; supplied evidence does not authorize service/device admission.
'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
function validateConfirmedCapture({prepared,revalidated,capture,expectedHash,expectedCandidate,now}) {
 assert(['accuracy','ten-events'].includes(prepared.purpose),'ACCURACY_CAPTURE_REQUIRED');
 assert.match(expectedCandidate,/^[0-9a-f]{40}$/);
 assert.equal(prepared.candidate,expectedCandidate);
 assert.equal(prepared.deviceTimezoneVerified,true);
 assert.equal(prepared.workerPausedVerified,true);
 for(const key of ['candidate','purpose','carrierApkSha256','cashAccountId','cardAccountId','categoryIds','deviceTimezone','deviceTimezoneVerified','workerPausedVerified'])
  assert.deepEqual(revalidated[key],prepared[key],'REVALIDATED_REFERENCE_MISMATCH');
 assert.match(expectedHash,/^[0-9a-f]{64}$/);
 assert.equal(createHash('sha256').update(capture.id).digest('hex'),expectedHash,'CONFIRMED_CAPTURE_MISMATCH');
 const opened=Date.parse(prepared.windowOpenedAt),checked=Date.parse(revalidated.windowOpenedAt),recorded=Date.parse(capture.capture_at),expires=Date.parse(capture.expires_at);
 assert([now,opened,checked,recorded,expires].every(Number.isFinite),'CAPTURE_TIME_INVALID');
 assert(now>=opened&&now-opened<=3600000,'CONFIRMED_PREPARATION_TOO_OLD');
 assert(now>=checked&&now-checked<=120000,'REFERENCE_REVALIDATION_REQUIRED');
 assert(recorded>=opened&&recorded<=now,'CONFIRMED_CAPTURE_TIME_INVALID');
 assert(expires-now>180000,'CAPTURE_EXPIRY_TOO_CLOSE');
}
module.exports={validateConfirmedCapture};
