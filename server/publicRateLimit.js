import crypto from 'node:crypto';
import net from 'node:net';

export function trustedClientIp(req) {
  // Vercel replaces this header at its edge. Local/self-hosted callers cannot
  // choose their own rate-limit bucket by sending spoofed proxy headers.
  const candidate=process.env.VERCEL==='1'?String(req.headers['x-forwarded-for']||'').split(',').at(-1)?.trim():req.socket?.remoteAddress;
  return net.isIP(candidate || '')?candidate:'unknown';
}
export function createPublicRateLimit(query,{clock=()=>Date.now()}={}) {
  let ready,lastCleanup=0;
  const ensure=()=>ready ||= query(`CREATE TABLE IF NOT EXISTS public_api_rate_limits (bucket TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires_at TIMESTAMPTZ NOT NULL);CREATE INDEX IF NOT EXISTS public_api_rate_limits_expiry ON public_api_rate_limits(expires_at);`).catch(error=>{ready=null;throw error;});
  return async(req,res,next)=>{
    try{
      await ensure();
      const now=clock();
      const secret=process.env.JWT_SECRET || process.env.GOOGLE_PRIVATE_KEY;
      if(!secret)throw new Error('Rate limit key is not configured.');
      const hash=value=>crypto.createHmac('sha256',secret).update(value).digest('hex');
      const login=req.path.includes('/auth/') || req.body?.action==='LOGIN';
      const ip=trustedClientIp(req),prefix=login?'login':'lookup';
      const limits=[{name:'minute',window:60000,max:login?10:30,subject:ip},{name:'hour',window:3600000,max:login?50:300,subject:ip}];
      if(!login&&typeof req.body?.nik==='string'&&/^\d{4,24}$/.test(req.body.nik.trim()))limits.push({name:'nik',window:3600000,max:60,subject:req.body.nik.trim().replace(/^0+/,'')});
      const buckets=limits.map(limit=>({...limit,bucket:prefix+':'+limit.name+':'+hash(limit.subject)+':'+Math.floor(now/limit.window),expires_at:new Date((Math.floor(now/limit.window)+2)*limit.window).toISOString()}));
      const result=await query(`INSERT INTO public_api_rate_limits(bucket,hits,expires_at) SELECT bucket,1,expires_at FROM jsonb_to_recordset($1::jsonb) AS x(bucket text,expires_at timestamptz) ON CONFLICT(bucket) DO UPDATE SET hits=public_api_rate_limits.hits+1 RETURNING bucket,hits`,[JSON.stringify(buckets)]);
      if(now-lastCleanup>60000){lastCleanup=now;await query('DELETE FROM public_api_rate_limits WHERE expires_at < $1',[new Date(now).toISOString()]);}
      const exceeded=result.rows.find(row=>Number(row.hits)>buckets.find(bucket=>bucket.bucket===row.bucket).max);
      if(exceeded){const rule=buckets.find(bucket=>bucket.bucket===exceeded.bucket);res.set('Retry-After',String(Math.ceil((rule.window-now%rule.window)/1000)));return res.status(429).json({ok:false,error:'Batas pencarian sementara tercapai. Coba kembali beberapa saat lagi.'});}
      return next();
    }catch(error){console.error('[Public rate limit]',error.message);return res.status(503).json({ok:false,error:'Layanan sementara belum tersedia. Silakan coba kembali.'});}
  };
}
