import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Check, ChevronRight, Circle, Clock3, FileCheck2, LoaderCircle, Search } from 'lucide-react';
import { reimbursementClient } from '../../lib/reimbursementClient';
import { REIMBURSEMENT_STEPS } from '../../utils/reimbursementWorkflow';
import './publicReimbursement.css';

export default function PublicReimbursementPage() {
  const [nik, setNik] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef(null);
  const latest = useRef(null);

  useEffect(() => {
    document.title = 'Cek Reimbursement | PT. Antang Gunung Meratus';
    document.documentElement.lang = 'id';
    return () => controller.current?.abort();
  }, []);

  async function search(event) {
    event.preventDefault();
    const value = nik.trim();
    if (!/^\d{4,24}$/.test(value)) { setError('Masukkan NIK lengkap sesuai data karyawan.'); return; }
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError(''); setResult(null);
    try {
      const data = await reimbursementClient.lookup(value, AbortSignal.any([request.signal, AbortSignal.timeout(30000)]));
      if (controller.current === request) setResult(data);
    } catch (failure) {
      if (!request.signal.aborted && controller.current === request) setError(failure.message);
    } finally { if (controller.current === request) setBusy(false); }
  }

  return (
    <div className="reimb-public">
      <header className="rp-header">
        <a className="rp-brand" href="/cek-reimbursement" aria-label="Beranda cek reimbursement"><span className="rp-brand-mark"><FileCheck2 size={22} /></span><span>Reimbursement<span className="rp-brand-sub">PT. Antang Gunung Meratus</span></span></a>
        <span className="rp-header-caption">Layanan Karyawan</span>
      </header>
      <main className="rp-main">
        <section className="rp-intro">
          <span className="rp-eyebrow">TIKET & TRANSPORT</span>
          <h1>Pantau reimbursement Anda.</h1>
          <p>Cari dengan NIK untuk melihat riwayat periode dan perkembangan pengajuan.</p>
        </section>
        <form className="rp-search" onSubmit={search}>
          <label htmlFor="rp-nik">Nomor Induk Karyawan (NIK)</label>
          <div className="rp-search-row">
            <div className="rp-input-wrap"><Search size={20} aria-hidden="true" /><input id="rp-nik" type="text" inputMode="numeric" autoComplete="off" maxLength={24} value={nik} onChange={event => setNik(event.target.value)} placeholder="Masukkan NIK Anda" aria-describedby="rp-input-help" required /></div>
            <button type="submit" disabled={busy}>{busy ? <LoaderCircle size={18} className="rp-spin" /> : <ArrowRight size={18} />}<span>{busy ? 'Mencari...' : 'Cek Status'}</span></button>
          </div>
          <p id="rp-input-help">Gunakan NIK lengkap sesuai data karyawan.</p>
        </form>
        <div aria-live="polite" aria-busy={busy}>
          {error && <div role="alert" className="rp-error">{error}</div>}
          {!result && !error && !busy && <div className="rp-welcome"><span className="rp-welcome-icon"><Clock3 size={28} /></span><h2>Perjalanan pengajuan, dalam satu tempat.</h2><p>Riwayat dan status akan tampil setelah Anda mencari NIK.</p></div>}
          {busy && <p className="rp-loading">Sedang memeriksa pengajuan Anda...</p>}
          {result && !result.employee && <div className="rp-welcome"><Search size={28} /><h2>Pengajuan belum ditemukan.</h2><p>Periksa kembali NIK Anda. Jika sudah sesuai, hubungi admin GA Site.</p></div>}
          {result?.employee && <>
            <section className="rp-employee" aria-label="Identitas karyawan"><div><span className="rp-eyebrow">RIWAYAT KARYAWAN</span><h2>{result.employee.nama}</h2><p>NIK {result.employee.nik}<span aria-hidden="true"> · </span>{result.employee.departemen}<span aria-hidden="true"> · </span>Site {result.employee.site}</p></div><span className="rp-period-count">{result.periods.length} periode</span></section>
            <div className="rp-history-heading"><div><h2>Riwayat reimbursement</h2><p>Periode terdahulu hingga terbaru.</p></div>{result.periods.length > 1 && <button className="rp-jump" onClick={() => latest.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Ke periode terbaru <ArrowDown size={15} /></button>}</div>
            <div className="rp-history">
              {result.periods.map((period, index) => {
                const current = REIMBURSEMENT_STEPS.findIndex(step => step.code === period.workflow_status);
                const stage = REIMBURSEMENT_STEPS[current] || REIMBURSEMENT_STEPS[0];
                const newest = index === result.periods.length - 1;
                return <article className={`rp-period ${newest ? 'rp-period-latest' : ''}`} key={period.key} ref={newest ? latest : undefined}>
                  <div className="rp-period-top"><div><div className="rp-period-title"><h3>{period.label}</h3>{newest && <span className="rp-latest-tag">Terbaru</span>}</div>{period.updated_at && <p className="rp-updated">Diperbarui {new Date(period.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' })}</p>}</div><span className={`rp-status ${period.workflow_status === 'paid' ? 'rp-status-paid' : ''}`}>{period.workflow_status === 'paid' ? <Check size={14} /> : <Circle size={10} fill="currentColor" />}{stage.label}</span></div>
                  <p className="rp-stage-description">{stage.description}</p>
                  <ol className="rp-flow" aria-label={`Alur proses ${period.label}`}>
                    {REIMBURSEMENT_STEPS.map((step, stepIndex) => {
                      const done = stepIndex < current || period.workflow_status === 'paid';
                      const active = stepIndex === current && !done;
                      return <li className={`${done ? 'rp-step-done' : active ? 'rp-step-active' : ''}`} key={step.code} aria-current={active ? 'step' : undefined}>
                        <div className="rp-step-symbol"><span>{done ? <Check size={14} /> : stepIndex + 1}</span>{stepIndex < REIMBURSEMENT_STEPS.length - 1 && <ChevronRight size={14} aria-hidden="true" />}</div>
                        <span className="rp-step-label">{step.short}</span>{active && <span className="rp-current-tag">Saat ini</span>}
                      </li>;
                    })}
                  </ol>
                </article>;
              })}
            </div>
          </>}
        </div>
        <footer className="rp-footer"><span>PT. Antang Gunung Meratus</span><span>Informasi status dikelola oleh General Affairs.</span></footer>
      </main>
    </div>
  );
}
