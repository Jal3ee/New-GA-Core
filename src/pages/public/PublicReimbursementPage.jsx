import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Check, ChevronRight, Circle, Clock3, FileCheck2, LoaderCircle, Search } from 'lucide-react';
import { reimbursementClient } from '../../lib/reimbursementClient';
import { REIMBURSEMENT_STEPS } from '../../utils/reimbursementWorkflow';
import './publicReimbursement.css';

function WhatsAppIcon({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}

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
        <a className="rp-brand" href="/cek-reimbursement" aria-label="Beranda cek reimbursement">
          <span className="rp-brand-mark"><FileCheck2 size={22} /></span>
          <span>Reimbursement<span className="rp-brand-sub">PT. Antang Gunung Meratus</span></span>
        </a>
        <a
          className="rp-header-cp"
          href="https://wa.me/6287737469104?text=Halo%20Pak%20Ahmad%20Tajali%2C%20saya%20ingin%20bertanya%20mengenai%20status%20pengajuan%20reimbursement."
          target="_blank"
          rel="noopener noreferrer"
          title="Chat WhatsApp dengan Ahmad Tajali"
        >
          <WhatsAppIcon size={16} />
          <span>CP: <strong>Ahmad Tajali</strong></span>
        </a>
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
          {result && !result.employee && (
            <div className="rp-welcome">
              <Search size={28} />
              <h2>Pengajuan belum ditemukan.</h2>
              <p>Periksa kembali NIK Anda. Jika sudah sesuai namun riwayat belum terdaftar, silakan hubungi Contact Person kami:</p>
              <a
                href="https://wa.me/6287737469104?text=Halo%20Pak%20Ahmad%20Tajali%2C%20NIK%20saya%20belum%20ditemukan%20pada%20portal%20cek%20reimbursement."
                target="_blank"
                rel="noopener noreferrer"
                className="rp-btn-wa-direct"
              >
                <WhatsAppIcon size={16} />
                <span>Hubungi Ahmad Tajali (+62 877-3746-9104)</span>
              </a>
            </div>
          )}
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

        <section className="rp-contact-card" aria-label="Kontak Person Bantuan">
          <div className="rp-contact-info">
            <div className="rp-contact-avatar">
              <WhatsAppIcon size={24} />
            </div>
            <div className="rp-contact-details">
              <span className="rp-contact-badge">Contact Person General Affairs</span>
              <h3 className="rp-contact-name">Ahmad Tajali</h3>
              <p className="rp-contact-phone">+62 877-3746-9104</p>
              <p className="rp-contact-desc">Memiliki pertanyaan tiket, data, atau kendala status pengajuan reimbursement? Hubungi kami langsung.</p>
            </div>
          </div>
          <a
            href="https://wa.me/6287737469104?text=Halo%20Pak%20Ahmad%20Tajali%2C%20saya%20ingin%20bertanya%20mengenai%20status%20pengajuan%20reimbursement."
            target="_blank"
            rel="noopener noreferrer"
            className="rp-contact-btn"
          >
            <WhatsAppIcon size={18} />
            <span>Chat via WhatsApp</span>
          </a>
        </section>

        <footer className="rp-footer">
          <div className="rp-footer-left">
            <span>PT. Antang Gunung Meratus · General Affairs</span>
            <span className="rp-footer-cp">
              Contact Person: <a href="https://wa.me/6287737469104" target="_blank" rel="noopener noreferrer">Ahmad Tajali (+62 877-3746-9104)</a>
            </span>
          </div>
          <span>Informasi status dikelola oleh General Affairs.</span>
        </footer>
      </main>
    </div>
  );
}
