import crypto from 'node:crypto';

export function registerSecurityBoundary(app,{authenticateToken,requireRole}) {
  app.disable('x-powered-by');
  app.use('/api',(req,res,next)=>{
    res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    const origin=req.headers.origin;
    const allowed=new Set(['https://ga-core-seven.vercel.app',...(process.env.NODE_ENV!=='production'?['http://localhost:5173','http://localhost:5174','http://127.0.0.1:5173']:[])]);
    if(origin&&!allowed.has(origin))return res.status(403).json({ok:false,error:'Origin tidak diizinkan.'});
    next();
  });
  // Fail closed: new API routes are private unless explicitly allowed here.
  app.use('/api',(req,res,next)=>{
    const route=req.path;
    if(req.method==='POST' && route==='/public/reimbursements/lookup')return next();
    if(req.method==='POST' && (route==='/auth/login'||route==='/action'&&req.body?.action==='LOGIN'))return next();
    if(req.method==='GET'&&route==='/health')return res.json({status:'online',system:'GA Core API'});
    if(req.method==='GET'&&route==='/cron/check-expiring'){
      const expected=process.env.CRON_SECRET,provided=req.headers.authorization;
      if(expected&&typeof provided==='string'){
        const a=Buffer.from('Bearer '+expected),b=Buffer.from(provided);
        if(a.length===b.length&&crypto.timingSafeEqual(a,b))return next();
      }
      return res.status(401).json({ok:false,error:'UNAUTHORIZED'});
    }
    authenticateToken(req,res,()=>{
      if(route==='/action'&&['CREATE_USER','UPDATE_USER','DELETE_USER','GET_AUDIT_LOGS'].includes(req.body?.action))return requireRole('admin')(req,res,next);
      if(route==='/notifications/whatsapp')return requireRole('admin','ga_admin','ga_gl','ga_sh')(req,res,next);
      return next();
    });
  });
}
