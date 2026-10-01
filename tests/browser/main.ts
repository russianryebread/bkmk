import { createApp, ref, h } from 'vue'
import { createPinia } from 'pinia'
import MarkdownEditor from '../../components/MarkdownEditor.vue'
import {useDataStore} from '../../stores/useDataStore'
import {authenticated,mode,requests} from './network'
const app = createApp({setup() {
  const store = useDataStore()
  const content = ref('')
  const result = ref('Ready')
  async function run() {
    authenticated.value = false
    await store.initialize()
    const note = await store.createNote({content:'Browser sync regression'})
    await store.updateNote(note!.id,{content:'Latest offline edit'})
    authenticated.value = true
    mode.value = '500'
    requests.value = []
    const start = performance.now()
    const failed = await store.triggerSync()
    const retained = store.pendingChangesCount > 0
    const noFanout = requests.value.filter(path=>path.endsWith('/batch')).length === 1
    const recoveredError = !failed && store.syncStatus === 'error' && !store.syncing && retained && noFanout && performance.now()-start < 1000
    mode.value = 'timeout'
    requests.value = []
    await store.triggerSync()
    const timeoutRecovered = store.syncStatus === 'error' && !store.syncing && requests.value.length === 1
    mode.value = 'success'
    const recovered = await store.triggerSync()
    const final = recovered && store.pendingChangesCount === 0 && store.getNoteById(note!.id)?.content === 'Latest offline edit'
    result.value = JSON.stringify({server500:recoveredError,timeout:timeoutRecovered,retry:final})
  }
  return () => h('main',{style:'max-width:600px;margin:30px auto'},[
    h('h1','Browser regression harness'),
    h(MarkdownEditor,{modelValue:content.value,'onUpdate:modelValue':(v:string)=>content.value=v,style:'height:220px;border:1px solid #ccc'}),
    h('pre',{'data-testid':'value'},JSON.stringify(content.value)),
    h('button',{onClick:run},'Run sync regressions'),
    h('pre',{'data-testid':'result'},result.value),
  ])
}})
app.use(createPinia()).mount('#app')
