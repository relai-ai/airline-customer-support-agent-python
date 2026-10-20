const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {SampleComparison,recordedExample,runTurn}=require('./sample-agent');
const recorded=require('./recorded');
test('payment comparison uses the isolated candidate and retains separate ledgers across turns',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'payment-comparison-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.mkdir(path.join(root,'src/airline_support'),{recursive:true});
 await fs.mkdir(path.join(root,'demo/scenarios/unauthorized-payment'),{recursive:true});
 await fs.writeFile(path.join(root,'src/airline_support/agent.py'),'original booking agent');
 await fs.writeFile(path.join(root,'demo/scenarios/unauthorized-payment/agent.py'),'fixed payment agent');
 const manifest={exampleId:'unauthorized-payment',files:[{path:'demo/scenarios/unauthorized-payment/agent.py',
  before:recorded.digest('faulty payment agent'),after:recorded.digest('fixed payment agent'),
  beforeContent:'faulty payment agent',afterContent:'fixed payment agent'}]};
 const calls=[];
 const c=new SampleComparison(root,{},manifest,()=>{},async({source,request})=>{
  const lane=path.basename(source);calls.push({lane,request:structuredClone(request)});
  return{reply:lane,bookings:{SKY123:{seat:lane}},payments:[{id:lane}]};
 });
 t.after(()=>c.close());await c.reset();
 assert.equal(await fs.readFile(path.join(c.dir,'before/airline_support/agent.py'),'utf8'),'faulty payment agent');
 assert.equal(await fs.readFile(path.join(c.dir,'after/airline_support/agent.py'),'utf8'),'fixed payment agent');
 await c.send('first');await c.send('second');
 assert.deepEqual(calls[2].request.payments,[{id:'before'}]);
 assert.deepEqual(calls[3].request.payments,[{id:'after'}]);
 assert.equal(await fs.readFile(path.join(root,'src/airline_support/agent.py'),'utf8'),'original booking agent');
 await fs.writeFile(path.join(root,'demo/scenarios/unauthorized-payment/agent.py'),'another payment edit');
 await assert.rejects(c.send('third'),/source changed/);
});
async function fixture(run,options={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sample-panel-test-'));
 await fs.mkdir(path.join(root,'src/airline_support'),{recursive:true});
 await fs.writeFile(path.join(root,'src/airline_support/agent.py'),options.original?'original':'updated');
 const manifest={files:[{path:'src/airline_support/agent.py',before:recorded.digest('original'),after:recorded.digest('updated'),beforeContent:'original',afterContent:'updated'}]};
 const comparison=new SampleComparison(root,options.env||{},manifest,()=>{},run);
 try{await comparison.reset();await options.check(comparison,root)}finally{await comparison.close();await fs.rm(root,{recursive:true,force:true})}
}
test('comparison snapshots source without switching workspace and isolates both histories and booking state',async()=>{
 const calls=[];
 await fixture(async args=>{calls.push(structuredClone(args.request));return{reply:path.basename(args.source),bookings:{SKY123:{seat:path.basename(args.source)}}}}, {check:async(c,root)=>{
  assert.equal(c.state.ready,true);assert.equal(await fs.readFile(path.join(c.dir,'before/airline_support/agent.py'),'utf8'),'original');
  assert.equal(await fs.readFile(path.join(c.dir,'after/airline_support/agent.py'),'utf8'),'updated');
  await c.send('Look up SKY123');await c.send('Change my seat');
  assert.equal(calls[2].bookings.SKY123.seat,'before');assert.equal(calls[3].bookings.SKY123.seat,'after');
  assert.equal(calls[2].history[1].content,'before');assert.equal(calls[3].history[1].content,'after');
  assert.equal(await fs.readFile(path.join(root,'src/airline_support/agent.py'),'utf8'),'updated');
 }});
});
test('live chat works before Apply with independent original snapshots and histories',async()=>{
 const calls=[];
 await fixture(async ({source,request})=>{
  calls.push({source,request:structuredClone(request)});
  assert.equal(await fs.readFile(path.join(source,'airline_support/agent.py'),'utf8'),'original');
  return {reply:path.basename(source),bookings:{SKY123:{seat:path.basename(source)}},payments:[]};
 },{original:true,check:async c=>{
  assert.equal(c.state.ready,true);assert.equal(c.state.hasChanges,false);
  await c.send('hello');await c.send('follow up');
  assert.equal(calls.length,4);
  assert.notEqual(calls[0].source,calls[1].source);
  assert.equal(calls[2].request.history[1].content,'before');
  assert.equal(calls[3].request.history[1].content,'after');
  assert.equal(c.state.error,'');
 }});
});
test('recorded-only local fixtures still block model calls',async()=>{
 let calls=0;
 await fixture(async()=>{calls++},{env:{PLAYGROUND_SAMPLE_LIVE_DISABLED:'1'},check:async c=>{
  await assert.rejects(c.send('hello'),/disabled/);assert.equal(calls,0);
 }});
});
test('source edits require an explicit reset and do not silently change an ongoing comparison',async()=>{
 await fixture(async()=>({reply:'ok',bookings:{}}),{check:async(c,root)=>{
  await c.send('first');await fs.writeFile(path.join(root,'src/airline_support/agent.py'),'another edit');
  await assert.rejects(c.send('second'),/source changed/);assert.equal(c.state.messages.before.length,2);
  await c.reset();assert.equal(c.state.messages.before.length,0);await c.send('fresh');assert.equal(c.state.error,'');
 }});
});
test('a partial failure commits no turns and cannot be retried without a new comparison',async()=>{
 await fixture(async({source})=>{if(path.basename(source)==='after')throw Error('provider details must not leak');return{reply:'one reply',bookings:{}}},{check:async c=>{
  await c.send('hello');assert.equal(c.state.ready,false);assert.deepEqual(c.state.messages,{before:[],after:[]});
  assert.match(c.state.error,/No partial turn/);assert.ok(!c.state.error.includes('provider details'));
  await assert.rejects(c.send('retry'),/new comparison/);
 }});
});
test('Stop reaches both invocations and leaves the comparison recoverable by reset',async()=>{
 await fixture(({signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('stopped')),{once:true})),{check:async c=>{
  const pending=c.send('long call');while(!c.state.busy)await new Promise(r=>setTimeout(r,1));c.stop();await pending;
  assert.equal(c.state.busy,false);assert.equal(c.state.ready,false);assert.match(c.state.error,/did not finish/);await c.reset();assert.equal(c.state.ready,true);
 }});
});
test('the actual runner serializes input as data and restores booking state inside an async turn without model calls',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sample-python-test-'));
 try{
  await fs.mkdir(path.join(root,'.venv/bin'),{recursive:true});await fs.symlink(execFileSync('which',['python3'],{encoding:'utf8'}).trim(),path.join(root,'.venv/bin/python'));
  const source=path.join(root,'source');await fs.mkdir(path.join(source,'airline_support'),{recursive:true});
  await fs.writeFile(path.join(source,'airline_support/__init__.py'),'');
  await fs.writeFile(path.join(source,'airline_support/sessions.py'),"class ChatMessage:\n def __init__(self,role,content,_):self.role=role;self.content=content\n");
  await fs.writeFile(path.join(source,'airline_support/agent.py'),"BOOKINGS={}\nasync def stream_agent_response(messages):\n assert messages[0].content == 'previous reply'\n BOOKINGS['SKY123']['seat']='14C'\n yield messages[-1].content\n yield ' done'\n");
  const controller=new AbortController();const prompt='$(echo nope) <script>test</script>';
  const result=await runTurn({root,source,env:{},request:{prompt,history:[{role:'assistant',content:'previous reply'}],bookings:{SKY123:{seat:'12A'}}},signal:controller.signal});
  assert.equal(result.reply,prompt+' done');assert.equal(result.bookings.SKY123.seat,'14C');
  await fs.writeFile(path.join(source,'airline_support/agent.py'),"import asyncio\nBOOKINGS={}\nasync def stream_agent_response(messages):\n await asyncio.sleep(60)\n yield 'late'\n");
  const stopping=new AbortController();
  const pending=runTurn({root,source,env:{},request:{prompt:'slow',history:[]},signal:stopping.signal});
  setTimeout(()=>stopping.abort(),40);await assert.rejects(pending,/stopped/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('recorded side-by-side replies are read from hash-verified actual trajectories',async()=>{
 const root=path.resolve(__dirname,'../../..');const manifest=await recorded.loadRecording(root);const example=await recordedExample(root,manifest);
 assert.match(example.before.agent,/Elena Rivera/);assert.match(example.after.agent,/Maya Chen/);
 const bad=structuredClone(manifest);bad.provenance.artifacts.find(a=>a.path===bad.liveEvidence.after.trajectory).sha256='0'.repeat(64);
 await assert.rejects(recordedExample(root,bad),/integrity/);
});
test('sample panel script compiles and never injects model output as HTML',async()=>{
 const html=await fs.readFile(path.join(__dirname,'sample-panel.html'),'utf8');const script=html.match(/<script nonce="NONCE">([\s\S]*?)<\/script>/)[1];
 new(require('node:vm').Script)(script);assert.ok(!script.includes('innerHTML'));
});

test('reset is exclusive and disposal waits for source preparation before removing snapshots',async()=>{
 await fixture(async()=>({reply:'ok',bookings:{}}),{check:async c=>{
  const first=c.reset();await assert.rejects(c.reset(),/Stop/);await first;
  const resetting=c.reset();const closing=c.close();await resetting;await closing;
  await assert.rejects(fs.stat(c.dir),/ENOENT/);
 }});
});

test('relocated payment comparisons use the main source and detect edits there',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'payment-main-source-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.mkdir(path.join(root,'src/airline_support'),{recursive:true});
 const file='src/airline_support/agent.py';
 await fs.writeFile(path.join(root,file),'fixed main agent');
 const manifest={exampleId:'unauthorized-payment',workspaceLayout:{workspaceSource:file},files:[{path:file,
  before:recorded.digest('faulty main agent'),after:recorded.digest('fixed main agent'),
  beforeContent:'faulty main agent',afterContent:'fixed main agent'}]};
 const c=new SampleComparison(root,{},manifest,()=>{},async()=>({reply:'ok',bookings:{},payments:[]}));
 t.after(()=>c.close());await c.reset();
 assert.equal(await fs.readFile(path.join(c.dir,'before/airline_support/agent.py'),'utf8'),'faulty main agent');
 assert.equal(await fs.readFile(path.join(c.dir,'after/airline_support/agent.py'),'utf8'),'fixed main agent');
 await c.send('first');await fs.writeFile(path.join(root,file),'visitor edit');
 await assert.rejects(c.send('again'),/source changed/);
});
