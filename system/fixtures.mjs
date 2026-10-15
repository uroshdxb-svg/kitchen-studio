// Isolated test data only. Never write fixtures to the shared coordination branch.
export function fixture(now=Date.now()){
 const iso=offset=>new Date(now+offset).toISOString();
 const task=(id,owner,status,extra={})=>({id,owner,title:'Fixture: '+id,status,generation:1,lease:null,createdAt:iso(-60000),updatedAt:iso(-1000),...extra});
 return {schemaVersion:1,revision:12,updatedAt:iso(-1000),tasks:{
  active:task('active','catalog','leased',{lease:{worker:'catalog',runId:'test-run',generation:1,token:'NEVER-EXPOSE-THIS-TOKEN',claimedAt:iso(-10000),heartbeatAt:iso(-1000),expiresAt:iso(30000)}}),
  blocked:task('blocked','supervisor','blocked',{reason:'Fixture: current publication evidence unavailable'}),
  queue:task('queue','content-qa','ready'),approval:task('approval','social-readiness','needs_approval',{reason:'Fixture: asset-specific approval needed'}),
  handoff:task('handoff','product','awaiting_ack'),done:task('done','reviewer','done',{completedAt:iso(-20000)})
 },workers:{supervisor:{at:iso(-1000),runId:'private-run-ID'},reliability:{at:iso(-30000)}},receipts:{receipt:{taskId:'handoff',from:'product',to:'reviewer',createdAt:iso(-20000),ackDueAt:iso(10000),acceptedAt:null}},operations:{secret:'NO-RAW-OPERATIONS'},privatePlan:'NO-PRIVATE-PLAN',account:'NO-ACCOUNT'};
}
