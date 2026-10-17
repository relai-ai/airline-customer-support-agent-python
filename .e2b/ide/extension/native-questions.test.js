const test = require('node:test');
const assert = require('node:assert/strict');
const { InlineQuestions } = require('./native-questions');
const question = { id: 'review', header: 'Test review', question: 'Build this test?',
  options: [{ label: 'build', description: 'Build this proposal only' }, { label: 'skip' }], isOther: true };
function fixture() { const events = []; const ui = new InlineQuestions(q => events.push(q)); return {ui,events}; }
test('inline choices preserve protocol IDs and exact selected labels without auto approval', async () => {
  const {ui,events}=fixture(); const run=ui.ask([question],new AbortController().signal);
  const view=ui.snapshot(); assert.equal(view.question,question.question);
  assert.equal(view.options[0].description,question.options[0].description);
  assert.throws(()=>ui.answer(view.id,'choice','not an option'),/Choose/);
  assert.equal(ui.snapshot().id,view.id);
  ui.answer(view.id,'choice','build');
  assert.deepEqual((await run).review,{answers:['build']}); assert.equal(events.at(-1),null);
  assert.throws(()=>ui.answer(view.id,'choice','build'),/no longer/);
});
test('multi-question feedback preserves actual text and rejects stale answers after advancing', async () => {
  const {ui}=fixture(); const run=ui.ask([question,{id:'criteria',question:'What should change?'}],new AbortController().signal);
  const first=ui.snapshot().id; ui.answer(first,'text','Revise the criteria');
  await Promise.resolve(); const second=ui.snapshot(); assert.equal(second.index,2);
  assert.throws(()=>ui.answer(first,'choice','build'),/no longer/);
  ui.answer(second.id,'text','Keep the valid booking control'); const result=await run;
  assert.deepEqual(result.review,{answers:['Revise the criteria']});
  assert.deepEqual(result.criteria,{answers:['Keep the valid booking control']});
});
test('skip sends no default and ends the question sequence', async()=>{
  const {ui}=fixture(); const run=ui.ask([question,{id:'later',question:'Later?'}],new AbortController().signal);
  ui.answer(ui.snapshot().id,'skip'); const result=await run;
  assert.deepEqual(result.review,{answers:[]}); assert.equal(Object.hasOwn(result,'later'),false);
});
test('aborting clears the card and does not submit an answer',async()=>{
  const {ui}=fixture(); const controller=new AbortController(); const run=ui.ask([question],controller.signal);
  controller.abort(); assert.equal(ui.snapshot(),null); assert.deepEqual(Object.keys(await run),[]);
});
test('secrets are refused, close unblocks and new runtime IDs cannot approve old questions',async()=>{
  const {ui}=fixture(); await assert.rejects(ui.ask([{...question,isSecret:true}],new AbortController().signal),/terminal/);
  const run=ui.ask([question],new AbortController().signal); const old=ui.snapshot().id;
  ui.close(); await run;
  const next=ui.ask([question],new AbortController().signal);
  assert.notEqual(ui.snapshot().id,old); assert.throws(()=>ui.answer(old,'choice','build'),/no longer/);
  ui.close(); await next;
});
