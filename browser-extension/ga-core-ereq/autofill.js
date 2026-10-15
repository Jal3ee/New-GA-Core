(() => {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async (read, description, timeout=15000) => {
    const end=Date.now()+timeout;
    while (Date.now()<end) { const value=read(); if(value) return value; await pause(100); }
    throw new Error(`Kolom e-Req belum tersedia: ${description}. Form mungkin berubah; isian dihentikan.`);
  };
  const normalize = value => String(value || '').replace(/\s+/g,' ').trim();
  const setValue = async (input, value) => {
    if (!input || input.disabled) throw new Error('Kolom e-Req tidak dapat diisi.');
    const prototype=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,String(value ?? ''));
    input.dispatchEvent(new Event('input',{ bubbles:true }));
    input.dispatchEvent(new Event('change',{ bubbles:true }));
    await pause(40);
  };
  const label = text => [...document.querySelectorAll('label')].find(el=>normalize(el.textContent)===text);
  const check = async text => {
    const input=await wait(()=>label(text)?.querySelector('input[type=checkbox]'),text);
    if(!input.checked) {input.click(); await pause(100);}
  };
  const store = () => {
    let value;
    try {value=JSON.parse(localStorage.getItem('request-item-storage'));}catch{}
    if(!value || value.version !== 0 || !Array.isArray(value.state?.prItems) || !Array.isArray(value.state?.irItems)) throw new Error('Format penyimpanan form e-Req berubah. Tidak ada data yang diganti.');
    return value;
  };
  const rows = type => {
    const heading=[...document.querySelectorAll('tr')].find(tr=>normalize(tr.textContent).toUpperCase()===(type==='IR'?'ISSUE REQUISITION':'PURCHASE REQUISITION'));
    if(!heading) return [];
    const found=[];
    for(let tr=heading.nextElementSibling;tr && !normalize(tr.textContent).startsWith('Sub Total');tr=tr.nextElementSibling) if(tr.querySelector('input[type=number]'))found.push(tr);
    return found;
  };
  const counter = type => [...document.querySelectorAll('input[type=number][readonly]')].find(input=>normalize(input.parentElement.parentElement.querySelector('span')?.textContent)===type);
  const resize = async (type, count) => {
    for(let n=0;n<200;n++) {
      const input=await wait(()=>counter(type),`jumlah baris ${type}`);
      const current=Number(input.value);
      if(current===count) return;
      const buttons=input.parentElement.querySelectorAll('button');
      if(buttons.length!==2) throw new Error('Tombol plus/minus e-Req berubah.');
      buttons[count>current?1:0].click();
      await wait(()=>Number(counter(type)?.value)!==current,`perubahan baris ${type}`);
    }
    throw new Error('Jumlah baris e-Req melebihi batas.');
  };
  const hasExisting = () => {
    try {return [...store().state.prItems,...store().state.irItems].some(row=>row.description || row.partNumber || row.quantity);}
    catch {return false;}
  };
  async function fillForm(draft, progress=()=>{}) {
    await wait(()=>document.querySelector('[name=department]'),'form permintaan',30000);
    await wait(()=>Object.keys(document.querySelector('[name=department]')).some(key=>key.startsWith('__reactProps$')),'form siap diisi',30000);
    if(localStorage.getItem('request-item-storage'))store(); // Fresh browsers persist only after the first edit.
    progress('Memilih site dan departemen...');
    await check(draft.site);
    const department=document.querySelector('[name=department]');
    department.focus();
    await setValue(department,'HCGA');
    const option=await wait(()=>[...document.querySelectorAll('div')].find(el=>el.children.length===0 && normalize(el.textContent)==='AGM - HCGA'),'pilihan AGM - HCGA');
    option.click(); await pause(100);
    // Clear an old purpose selection before choosing the requested purpose.
    for(const purpose of ['PERBAIKAN','PERGANTIAN','SUDAH DIKERJAKAN','INSIDEN']) {
      const input=label(purpose)?.querySelector('input'); if(input?.checked) {input.click();await pause(50);}
    }
    await check('PENGADAAN BARU');
    for(const name of ['dateNeeded','dateRequest','RequirementReasonInput']) {
      const input=document.querySelector(`[name=${name}]`);
      if(input?.value)await setValue(input,'');
    }
    const requester=document.querySelector('textarea[placeholder=NAMA]');
    if(requester && !requester.disabled)await setValue(requester,'');
    progress('Menyesuaikan baris PR / IR...');
    for(const type of ['PR','IR']) await resize(type,draft.rows.filter(row=>row.type===type).length);
    if(!localStorage.getItem('request-item-storage')) {
      const count=draft.rows.filter(row=>row.type==='IR').length;
      await resize('IR',count+1);await resize('IR',count);
    }
    // IR stock class, unit and price are read-only on the original form. Use its
    // existing persisted draft schema, then reload so React hydrates every field.
    // This edits the browser draft only; no requisition is submitted or printed.
    const data=store();
    for(const type of ['PR','IR']) {
      const key=type==='IR'?'irItems':'prItems';
      const selected=draft.rows.filter(row=>row.type===type);
      if(data.state[key].length!==selected.length) throw new Error('Jumlah baris e-Req belum sesuai.');
      data.state[key]=data.state[key].map((row,index)=>{
        if(typeof row.id!=='string' || !Object.hasOwn(row,'estimatedUnitPriceBeforeTax')) throw new Error('Struktur baris e-Req berubah.');
        const item=selected[index];
        const price=item.price_idr == null ? 0 : Math.round(item.price_idr/16500*100)/100;
        return { ...row, no:index+1, stockClass:type==='IR'?item.stock_class:'GOODS', description:item.name, stockCode:type==='IR'?item.code:'', partNumber:item.part_number, mnemonic:item.mnemonic, quantity:item.qty, unit:item.unit, estimatedUnitPriceBeforeTax:price, estimatedUnitPriceAfterTax:Number((price*1.11).toFixed(2)), totalPrice:Number((price*1.11*item.qty).toFixed(2)) };
      });
      data.state[type==='IR'?'totalSubtotalIR':'totalSubtotalPR']=Number(data.state[key].reduce((sum,item)=>sum+item.totalPrice,0).toFixed(2));
    }
    localStorage.setItem('request-item-storage',JSON.stringify(data));
    return true;
  }
  async function verifyForm(draft) {
    await wait(()=>document.querySelector('[name=department]'),'form setelah pengisian',30000);
    await wait(()=>label(draft.site)?.querySelector('input')?.checked && document.querySelector('[name=department]').value.includes('HCGA') && label('PENGADAAN BARU')?.querySelector('input')?.checked,'site, departemen dan keperluan setelah reload',30000);
    const data=store();
    for(const type of ['PR','IR']) {
      const selected=draft.rows.filter(row=>row.type===type);
      await wait(()=>Number(counter(type)?.value)===selected.length,`jumlah ${type}`);
      const actual=rows(type);
      if(actual.length!==selected.length) throw new Error(`Baris ${type} pada form belum sesuai.`);
      for(let i=0;i<selected.length;i++) {
        const item=selected[i], saved=data.state[type==='IR'?'irItems':'prItems'][i], cells=actual[i].querySelectorAll('td');
        if(cells.length!==11 || cells[4].querySelector('textarea')?.value!==item.part_number || Number(cells[6].querySelector('input')?.value)!==item.qty || saved.unit!==item.unit || Math.abs(saved.estimatedUnitPriceBeforeTax-(item.price_idr==null?0:Math.round(item.price_idr/16500*100)/100))>0.00001) throw new Error(`Periksa hasil pengisian ${item.name}; ada nilai yang tidak cocok.`);
      }
    }
    return true;
  }
  async function login(credentials) {
    const email=await wait(()=>document.querySelector('input[type=email]'),'email login');
    // SSR inputs can exist before React attaches their change/submit handlers.
    await wait(()=>Object.keys(email).some(key=>key.startsWith('__reactProps$')),'halaman login siap',30000);
    await setValue(email,credentials.email);
    await setValue(document.querySelector('input[type=password]'),credentials.password);
    const button=[...document.querySelectorAll('button')].find(el=>normalize(el.textContent)==='Login');
    if(!button) throw new Error('Tombol Login tidak ditemukan.');
    button.click();
  }
  globalThis.GaCoreEreq={ fillForm,verifyForm,login,hasExisting,wait };
})();
