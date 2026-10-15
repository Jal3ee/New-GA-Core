document.querySelector('#login').addEventListener('submit', async event => {
  event.preventDefault();
  const form=event.target;
  const result=await chrome.runtime.sendMessage({ type:'CREDENTIALS', email:form.email.value, password:form.password.value });
  document.querySelector('#status').textContent=result.ok?'Login tersimpan untuk sesi browser ini. Buka Auto e-Req di GA Core.':result.error;
  form.password.value='';
});
document.querySelector('#forget').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type:'FORGET' });
  document.querySelector('#status').textContent='Login sesi sudah dihapus.';
});
