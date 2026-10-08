import test from 'node:test'
import assert from 'node:assert/strict'
import { contextFactsProjection, foldContextFacts } from '../src/context-facts.ts'
import { historyReferences } from '../src/history-reference.ts'
import { NATIVE_DEFAULTS } from '../src/native-config.ts'
import { apply, NATIVE_STREAM_PATH } from '../lib/native-host.js'

const assistant = (id, text, calls = []) => ({ id, role: 'assistant', source: {kind:'model'}, content: [{type:'text',text}, ...calls] })
const call = {type:'tool-call', id:'call-1', name:'edit', arguments:'{"file_path":"/synthetic/example.ts"}'}
const result = {id:'result-1',role:'tool',source:{kind:'tool'},toolCallId:'call-1',content:[{type:'text',text:'edited example.ts'}]}
const event = (type, data) => ({type,data})

function replay() {
  let facts=contextFactsProjection.init()
  for (const e of [event('turn/start',{}),event('assistant/message',{message:assistant('progress','正在修改',[call])}),
    event('tool/call',{callId:call.id,name:call.name,arguments:call.arguments}),
    event('tool/result',{message:result,meta:{diffs:[{path:'/synthetic/example.ts',oldText:'old',newText:'new\nline'}]}}),
    event('assistant/message',{message:assistant('final','修改完成')}),event('turn/end',{reason:{kind:'completed'}})]) facts=foldContextFacts(facts,e)
  return facts
}

test('reference filters separate final replies, tools and file changes after replay',()=>{
  const facts=JSON.parse(JSON.stringify(replay()))
  const messages=[{id:'user',role:'user',source:{kind:'user'},content:[{type:'text',text:'修改示例'}]},assistant('progress','正在修改',[call]),result,assistant('final','修改完成')]
  let cfg={...NATIVE_DEFAULTS,historyMessageLimit:20,maxHistoryCharacters:4000}
  assert.deepEqual(historyReferences(cfg,messages,facts),[{role:'user',text:'修改示例'},{role:'assistant',text:'修改完成'}])
  cfg={...cfg,excludeUserMessages:true,includeToolCalls:true,includeFileChanges:true}
  const rows=historyReferences(cfg,messages,facts)
  assert.deepEqual(rows.map(x=>x.role),['tool-call','tool-result','file-change','assistant'])
  assert.equal(JSON.parse(rows[2].text)[0].path,'/synthetic/example.ts')
  assert.equal(rows.some(x=>x.text==='正在修改'),false)
  assert.equal(historyReferences({...cfg,excludeIntermediateAssistant:false},messages,facts).some(x=>x.text==='正在修改'),true)
  assert.equal(historyReferences({...cfg,historyMessageLimit:2},messages,facts).length,2)
  assert.equal(historyReferences({...cfg,maxHistoryCharacters:64},messages,facts).reduce((n,x)=>n+x.text.length,0),64)
})

test('failed edits and interrupted replies never become completed file/final references',()=>{
  let facts=contextFactsProjection.init()
  facts=foldContextFacts(facts,event('tool/result',{message:{...result,isError:true},meta:{diffs:[{path:'/synthetic/failed.ts',oldText:'old',newText:'new'}]}}))
  assert.deepEqual(facts.filesByResultId,{})
  facts=foldContextFacts(facts,event('assistant/message',{message:assistant('interrupted','半句'),interrupted:true}))
  facts=foldContextFacts(facts,event('turn/end',{reason:{kind:'completed'}}))
  assert.deepEqual(facts.finalAssistantIds,{})
})

test('new-file metadata preserves the created path without reading the filesystem',()=>{
  let facts=contextFactsProjection.init()
  facts=foldContextFacts(facts,event('tool/call',{callId:'create',name:'write',arguments:JSON.stringify({file_path:'/synthetic/new.ts',content:'one\ntwo'})}))
  facts=foldContextFacts(facts,event('tool/result',{message:{...result,toolCallId:'create'},meta:{operation:'create',diffs:[]}}))
  assert.deepEqual(facts.filesByResultId['result-1'],[{path:'/synthetic/new.ts',operation:'create',updatedSnippetLines:2,previousSnippetLines:0}])
  assert.deepEqual(facts.pendingCalls,{})
})

test('empty suggestions settle quietly while authentication and partial-stream failures remain errors',async()=>{
  for(const failure of [{code:'EMPTY_RESPONSE',message:'empty'},{code:'UNKNOWN',message:'model returned a completed response with no content'},
    {code:'UNAUTHORIZED',message:'authentication failed'}]) for(const partial of [false,true]) {
    const routes=new Map(), config={...NATIVE_DEFAULTS,provider:'synthetic',model:'small'}
    const ctx={settings:{},sessionProjections:{register:()=>()=>{}},sessions:{get:()=>({append(){}})},
      llm:{async *stream(){if(partial)yield {type:'text-delta',text:'部分建议'};yield {type:'finish',reason:{kind:'error',failure}}}},
      effect: fn=>fn(),connection:{fetch:{register:r=>{routes.set(r.path,r.fetch);return()=>{}}}}}
    apply(ctx,Object.fromEntries(Object.entries(config).map(([k,v])=>[k,{get:()=>v}])))
    const response=await routes.get(NATIVE_STREAM_PATH)(new Request('http://synthetic'+NATIVE_STREAM_PATH,{method:'POST',body:JSON.stringify({prefix:'提交一',sessionId:'synthetic'})}))
    const wire=await response.text()
    assert.equal(wire.includes('"error"'),partial||failure.code==='UNAUTHORIZED')
    if(!partial&&failure.code!=='UNAUTHORIZED')assert.match(wire,/"done":true/u)
  }
})
