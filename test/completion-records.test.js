import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import { apply, createCompletionRecordStore, NATIVE_RPC_PATH, NATIVE_STREAM_PATH } from '../lib/native-host.js'
import { NATIVE_DEFAULTS } from '../src/native-config.ts'

const record = (id, startedAt = Number(id)) => ({
  id, sessionId: 'synthetic-session', provider: 'test', model: 'small', startedAt,
  status: 'pending', elapsedMs: null, firstTokenMs: null, system: '继续写',
  messages: [{role:'user',text:'合成草稿'}], maxTokens: 64, result: '', error: '', usage: null, truncated: false,
})
function memoryUnit(initial = null) {
  let value = initial
  let fail = false
  return {
    loadAll: async () => ({global:structuredClone(value)}),
    setGlobal: async next => { if (fail) throw new Error('synthetic disk failure'); value = structuredClone(next) },
    close: async () => {},
    snapshot: () => structuredClone(value),
    fail: flag => {fail = flag},
  }
}

test('concurrent requests retain exactly the latest 100 starts and late finishes never resurrect evicted rows', async () => {
  const unit = memoryUnit()
  const store = await createCompletionRecordStore(unit)
  await Promise.all(Array.from({length:105},(_,i) => store.begin(record(String(i)))))
  await Promise.all([store.finish('0',{status:'success',result:'evicted'}),store.finish('104',{status:'success',result:'保留'})])
  const rows = await store.list()
  assert.equal(rows.length,100)
  assert.deepEqual(rows.map(row => row.id),Array.from({length:100},(_,i) => String(104-i)))
  assert.equal(rows[0].result,'保留')
  assert.equal('system' in rows[0],false)
  assert.equal((await store.get('104')).messages[0].text,'合成草稿')
  assert.equal(await store.get('0'),undefined)
  await store.close()
  const reopened = await createCompletionRecordStore(unit)
  assert.equal((await reopened.get('104')).status,'success')
  assert.equal((await reopened.get('103')).status,'interrupted')
  assert.equal(unit.snapshot().length,100)
  await reopened.close()
})

test('failed writes preserve previous records, remain visible and allow retry; malformed data is never overwritten', async () => {
  const unit = memoryUnit()
  const store = await createCompletionRecordStore(unit)
  await store.begin(record('1'))
  unit.fail(true)
  await assert.rejects(store.begin(record('2')),/disk failure/)
  assert.deepEqual((await store.list()).map(row => row.id),['1'])
  unit.fail(false)
  await store.begin(record('2'))
  await store.close()
  await assert.rejects(store.begin(record('3')),/closed/)
  const invalid = memoryUnit([{invalid:true}])
  await assert.rejects(createCompletionRecordStore(invalid))
  assert.deepEqual(invalid.snapshot(),[{invalid:true}])
})

test('registered history routes persist exact requests, provider usage, empty results, failures, timeouts and cancellation', async () => {
  const routes = new Map()
  const disposers = []
  const unit = memoryUnit()
  let mode = 'success'
  const config = {...NATIVE_DEFAULTS,provider:'test',model:'small',timeoutMs:25}
  const ctx = {
    storage:{backend:{get:()=>({kv:{open:async()=>unit}})}},
    sessionProjections:{register:()=>()=>{},stateOf:()=>({finalAssistantIds:{},filesByResultId:{}})},
    settings:{describe:()=>[],update:async()=>{}},
    sessions:{get:()=>({append:()=>{},deriveMessages:()=>[]})},
    connection:{fetch:{register:route=>{routes.set(route.path,route.fetch);return()=>routes.delete(route.path)}}},
    effect:fn=>{const dispose=fn();if(typeof dispose==='function')disposers.push(dispose)},
    llm:{async *stream(options){
      if(mode==='success') {
        yield {type:'text-delta',index:0,text:'，检查日志。'}
        yield {type:'usage',usage:{inputTokens:12,outputTokens:6,cacheReadTokens:8,totalTokens:26,reasoningTokens:2}}
        yield {type:'finish',reason:{kind:'stop'}}
      } else if(mode==='empty') yield {type:'finish',reason:{kind:'error',failure:{code:'EMPTY_RESPONSE',message:'model returned a completed response with no content'}}}
      else if(mode==='error') yield {type:'finish',reason:{kind:'error',failure:{message:'synthetic provider failure'}}}
      else { await new Promise(resolve => options.signal.aborted ? resolve() : options.signal.addEventListener('abort',resolve,{once:true})); options.signal.throwIfAborted() }
    }},
  }
  await apply(ctx,Object.fromEntries(Object.entries(config).map(([key,value])=>[key,{get:()=>value}])))
  const rpc = async(endpoint,payload) => (await routes.get(NATIVE_RPC_PATH)(new Request('http://localhost'+NATIVE_RPC_PATH,{method:'POST',body:JSON.stringify({endpoint,payload})}))).json()
  const complete = async(signal) => {
    const response=await routes.get(NATIVE_STREAM_PATH)(new Request('http://localhost'+NATIVE_STREAM_PATH,{method:'POST',body:JSON.stringify({sessionId:'synthetic-session',prefix:'帮我查一下'}),signal}))
    return response.text()
  }
  await complete()
  let rows = (await rpc('history.list')).value
  let detail = (await rpc('history.get',{id:rows[0].id})).value
  assert.equal(detail.status,'success')
  assert.equal(detail.system,config.systemPrompt)
  assert.deepEqual(detail.messages,[{role:'user',text:'帮我查一下'}])
  assert.deepEqual(detail.usage,{inputTokens:12,outputTokens:6,cacheReadTokens:8,totalTokens:26,reasoningTokens:2})
  assert.ok(detail.elapsedMs>=0)
  assert.ok(detail.firstTokenMs>=0)
  const {id,startedAt,elapsedMs,firstTokenMs,...snapshot}=detail
  assert.deepEqual(snapshot,JSON.parse(readFileSync(new URL('./completion-record.expected.json',import.meta.url),'utf8')))
  for(const state of ['empty','error','timeout','cancelled']) {
    mode=state
    const abort=new AbortController()
    const pending=complete(abort.signal)
    if(state==='cancelled') setTimeout(()=>abort.abort(),5)
    await pending
    rows=(await rpc('history.list')).value
    assert.equal(rows[0].status,state)
    assert.equal(rows[0].usage,null)
  }
  assert.equal((await rpc('history.get',{id:'missing'})).ok,false)
  await Promise.all(disposers.reverse().map(dispose=>dispose()))
  assert.equal(unit.snapshot().length,5)
})
