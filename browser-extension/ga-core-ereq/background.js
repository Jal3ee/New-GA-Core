import { validateBhpEreqDraft, EREQ_ORIGIN } from './bhpEreq.js';

const sourceOrigins = new Set(['https://ga-core-seven.vercel.app', 'http://localhost:5173', 'http://localhost:5174']);
chrome.runtime.onInstalled.addListener(() => chrome.storage.session.setAccessLevel({ accessLevel:'TRUSTED_CONTEXTS' }));
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  (async () => {
    const origin = sender.url ? new URL(sender.url).origin : '';
    const target = origin === EREQ_ORIGIN && sender.tab?.id != null;
    const own = sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL(''));
    if (sourceOrigins.has(origin)) {
      if (message.type === 'PING') return { ok:true, version:1 };
      if (message.type === 'OPEN') {
        const draft = validateBhpEreqDraft(message.draft);
        // about:blank reserves the tab before navigating; target cannot race job creation.
        const popup = await chrome.windows.create({ url:'about:blank', type:'popup', width:1280, height:900 });
        const tabId = popup.tabs?.[0]?.id;
        if (tabId == null) throw new Error('Jendela e-Req tidak dapat dibuka.');
        await chrome.storage.session.set({ [`job:${tabId}`]:{ draft, createdAt:Date.now() } });
        await chrome.tabs.update(tabId, { url:EREQ_ORIGIN+'/' });
        return { ok:true };
      }
    }
    if (target) {
      const key = `job:${sender.tab.id}`;
      if (message.type === 'JOB') {
        const job = (await chrome.storage.session.get(key))[key];
        if (job && Date.now()-job.createdAt < 30*60*1000) return { ok:true, job, hasCredentials:Boolean((await chrome.storage.session.get('credentials')).credentials) };
        await chrome.storage.session.remove(key);
        return { ok:true, job:null };
      }
      if (message.type === 'DONE') { await chrome.storage.session.remove(key); return { ok:true }; }
      if (message.type === 'SEEDED') {
        const job=(await chrome.storage.session.get(key))[key];
        if(!job) throw new Error('Draft sesi sudah berakhir. Buka kembali dari GA Core.');
        await chrome.storage.session.set({ [key]:{ ...job, phase:'SEEDED' } });
        return { ok:true };
      }
      if (message.type === 'FORM') {
        const job=(await chrome.storage.session.get(key))[key];
        if(!job || Date.now()-job.createdAt>=30*60*1000)throw new Error('Draft sesi sudah berakhir.');
        const actions=['PAGE','WAIT_FORM','EXISTING','LOGIN','FILL','VERIFY'];
        if(!actions.includes(message.action))throw new Error('Aksi form tidak valid.');
        const credentials=message.action==='LOGIN'?(await chrome.storage.session.get('credentials')).credentials:null;
        await chrome.scripting.executeScript({target:{tabId:sender.tab.id},world:'MAIN',files:['autofill.js']});
        const result=await chrome.scripting.executeScript({target:{tabId:sender.tab.id},world:'MAIN',func:async(action,draft,login)=>{
          try {
          const value=await (async()=>{
          const api=globalThis.GaCoreEreq;
          if(action==='PAGE'){await api.wait(()=>document.querySelector('input[type=email],[name=department]'),'halaman e-Req',30000);return document.querySelector('input[type=email]')?'LOGIN':'FORM';}
          if(action==='WAIT_FORM'){await api.wait(()=>document.querySelector('[name=department]'),'login dan form permintaan',90000);return true;}
          if(action==='EXISTING')return api.hasExisting();
          if(action==='LOGIN'){if(!login)throw new Error('Login sesi belum diisi.');await api.login(login);return true;}
          if(action==='FILL')return api.fillForm(draft);
          if(action==='VERIFY')return api.verifyForm(draft);
          })();
          return {ok:true,value};
          }catch(error){return {ok:false,error:error.message};}
        },args:[message.action,job.draft,credentials]});
        const injected=result[0]?.result;
        if(!injected?.ok)throw new Error(injected?.error || 'Pengisian form e-Req terhenti.');
        return {ok:true,value:injected.value};
      }
    }
    if (target || own) {
      if (message.type === 'CREDENTIALS') {
        const email = String(message.email || '').trim(), password=String(message.password || '');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length>500) throw new Error('Email atau password belum valid.');
        await chrome.storage.session.set({ credentials:{ email, password } });
        return { ok:true };
      }
      if (message.type === 'FORGET') { await chrome.storage.session.remove('credentials'); return { ok:true }; }
    }
    throw new Error('Permintaan ekstensi tidak diizinkan.');
  })().then(respond).catch(error => respond({ ok:false, error:error.message }));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => chrome.storage.session.remove(`job:${tabId}`));
