(() => {
  const run=async()=>{
    const response=await chrome.runtime.sendMessage({ type:'JOB' });
    if(!response.job)return;
    const { job }=response;
    const formAction=async action=>{
      const result=await chrome.runtime.sendMessage({type:'FORM',action});
      if(!result.ok)throw new Error(result.error || 'Form e-Req belum dapat diisi.');
      return result.value;
    };
    const host=document.createElement('div');
    host.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:380px;';
    document.body.append(host);
    const shadow=host.attachShadow({ mode:'closed' });
    shadow.innerHTML='<style>@media print{:host{display:none!important}}*{box-sizing:border-box}section{font:13px system-ui;background:white;color:#163b36;border:1px solid #94b7b1;border-radius:12px;box-shadow:0 5px 25px #0003;padding:16px}h3{margin:0 0 8px}p{line-height:1.5}button{background:#0f5c56;color:white;border:0;border-radius:6px;padding:9px 12px;cursor:pointer;margin:4px 4px 0 0}input{display:block;width:100%;border:1px solid #bbb;border-radius:6px;padding:8px;margin:8px 0}</style><section><h3>GA Core · Auto e-Req</h3><p id="status" role="status"></p><div id="actions"></div></section>';
    const status=shadow.querySelector('#status'),actions=shadow.querySelector('#actions');
    const say=text=>{status.textContent=text;};
    const button=(text,handler)=>{const el=document.createElement('button');el.textContent=text;el.addEventListener('click',handler);actions.append(el);return el;};
    const finish=async()=>{
      await formAction('VERIFY');
      await chrome.runtime.sendMessage({ type:'DONE' });
      const noPrice=job.draft.rows.filter(row=>row.price_idr===null).length;
      say(`${job.draft.site}: ${job.draft.rows.length} barang sudah terisi. Kurs Rp16.500/USD. Lengkapi alasan, tanggal, dan PIC; tinjau form sebelum dicetak.${noPrice?' Ada '+noPrice+' barang tanpa harga; lengkapi harga dari GA Core sebelum mencetak.':''}`);
      actions.replaceChildren();button('Tutup petunjuk',()=>host.remove());
    };
    const fill=async()=>{
      actions.replaceChildren();
      say('Mengisi site, departemen, baris PR/IR dan detail barang...');
      await formAction('FILL');
      const saved=await chrome.runtime.sendMessage({ type:'SEEDED' });
      if(!saved.ok)throw new Error(saved.error);
      location.reload();
    };
    const form=async()=>{
      if(job.phase==='SEEDED')return finish();
      if(await formAction('EXISTING')) {
        say('Form e-Req di browser sudah berisi barang. Gunakan draft GA Core untuk mengganti daftar barang serta mengosongkan alasan, tanggal, dan PIC?');
        button('Gunakan draft GA Core',()=>fill().catch(fail));
        button('Batalkan',async()=>{await chrome.runtime.sendMessage({type:'DONE'});host.remove();});
      } else await fill();
    };
    const afterLogin=async()=>{
      say('Menunggu login e-Req. Jika login gagal, perbaiki email/password pada form login dan klik Login.');
      await formAction('WAIT_FORM');
      actions.replaceChildren();
      await form();
    };
    const fail=error=>{
      say(error.message+' Isian yang ada tetap dapat ditinjau. Tutup jendela dan buka Auto e-Req lagi untuk mencoba ulang.');
      actions.replaceChildren();button('Tutup petunjuk',()=>host.remove());
    };
    try {
      say('Menyiapkan draft '+job.draft.site+'...');
      const pageType=await formAction('PAGE');
      if(pageType==='LOGIN') {
        if(response.hasCredentials) {await formAction('LOGIN');await afterLogin();}
        else {
          say('Masukkan login e-Req satu kali untuk sesi browser ini. Password hanya disimpan sementara di ekstensi.');
          const email=document.createElement('input'),password=document.createElement('input');
          email.type='email';email.value='hrga.agm@gmail.com';email.setAttribute('aria-label','Email e-Req');
          password.type='password';password.placeholder='Password e-Req';password.setAttribute('aria-label','Password e-Req');
          actions.append(email,password);
          button('Login & isi form',async()=>{
            try {
              const credentials={ email:email.value.trim(),password:password.value };
              const result=await chrome.runtime.sendMessage({ type:'CREDENTIALS',...credentials });
              if(!result.ok)throw new Error(result.error);
              password.value='';actions.replaceChildren();await formAction('LOGIN');await afterLogin();
            }catch(error){fail(error);}
          });
        }
      } else await form();
    }catch(error){fail(error);}
  };
  run().catch(()=>{});
})();
