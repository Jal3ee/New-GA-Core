const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRsV4JE1c63MNx3gC4UePMQk45ZkbrMzyzpd0FDGkzrY_kp9THWjzmrASednGzzQpw_g/exec';

async function testUpload() {
  const formData = new FormData();
  formData.append('test', '123');
  
  // Create a 1MB dummy file
  const buffer = Buffer.alloc(1024 * 1024, 'a');
  const blob = new Blob([buffer], { type: 'text/plain' });
  formData.append('file', blob, 'test.txt');

  console.log("Sending request...");
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: formData
  });

  const text = await res.text();
  console.log("Response:", res.status, text);
}

testUpload().catch(console.error);
