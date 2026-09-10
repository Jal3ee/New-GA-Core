function doPost(e) {
  try {
    let body;
    if (e.postData && e.postData.type && e.postData.type.includes('application/json')) {
      body = JSON.parse(e.postData.contents);
    } else {
      // Handle multipart/form-data
      body = {
        action: e.parameter.action,
        payload: e.parameter.payload ? JSON.parse(e.parameter.payload) : {},
        userEmail: e.parameter.userEmail || 'anonymous'
      };
      
      // If a file was uploaded, attach it to payload
      if (e.parameter.fileData) {
        body.payload.data = body.payload.data || {};
        body.payload.data.fileData = e.parameter.fileData; // This is a Blob in GAS!
        body.payload.data.fileName = e.parameter.fileName || 'uploaded_file';
      }
    }

    if (!validateSecretToken(body)) {
      return jsonResponse({ ok: false, error: 'UNAUTHORIZED', code: 401 });
    }

    const identifier = body.userEmail || 'anonymous';
    if (!checkRateLimit(identifier)) {
      return jsonResponse({ ok: false, error: 'RATE_LIMITED', code: 429 });
    }

    return routeAction(body);

  } catch (err) {
    return jsonResponse({ ok: false, error: 'SERVER_ERROR', message: err.toString(), code: 500 });
  }
}
