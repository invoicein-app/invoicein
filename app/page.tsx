import Link from "next/link";

export default function Home() {
  return (
    <div style={styles.root}>
      {/* Hero */}
      <section style={styles.hero}>
        <div style={styles.container}>
          <h1 style={styles.heroTitle}>
            Bantu usaha kecil yang masih pakai Excel jadi lebih rapi
          </h1>
          <p style={styles.heroSub}>
            Kelola invoice, stok, purchase order, surat jalan, dan pembayaran dalam satu tempat yang sederhana dan mudah dipakai. Cocok untuk toko, supplier, kantor kecil, dan pabrik/workshop yang masih mencatat operasional secara manual.
          </p>
          <div style={styles.heroCta}>
            <Link href="/register" style={styles.btnPrimary}>Coba Gratis</Link>
            <Link href="/login" style={styles.btnSecondary}>Login</Link>
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section style={styles.section}>
        <div style={styles.container}>
          <h2 style={styles.sectionTitle}>Masalah yang sering muncul</h2>
          <p style={styles.sectionSub}>Kalau operasional masih mengandalkan Excel atau catatan manual, hal-hal ini sering terjadi:</p>
          <div style={styles.cardGrid}>
            {painPoints.map((item, i) => (
              <div key={i} style={styles.card}>
                <span style={styles.cardIcon}>{item.icon}</span>
                <h3 style={styles.cardTitle}>{item.title}</h3>
                <p style={styles.cardText}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main features */}
      <section style={styles.sectionAlt}>
        <div style={styles.container}>
          <h2 style={styles.sectionTitle}>Fitur yang bisa dipakai sehari-hari</h2>
          <p style={styles.sectionSub}>Semua dalam satu tempat: dari buat invoice sampai lacak pembayaran.</p>
          <div style={styles.featureGrid}>
            {mainFeatures.map((item, i) => (
              <div key={i} style={styles.featureCard}>
                <span style={styles.featureLabel}>{item.label}</span>
                <p style={styles.featureDesc}>{item.desc}</p>
              </div>
            ))}
          </div>
          <div style={styles.supportFeature}>
            <span style={styles.supportLabel}>Riwayat aktivitas</span>
            <p style={styles.supportDesc}>Pencatatan perubahan penting dan riwayat transaksi untuk membantu pengecekan dan pengawasan.</p>
          </div>
        </div>
      </section>

      {/* Suitable for */}
      <section style={styles.section}>
        <div style={styles.container}>
          <h2 style={styles.sectionTitle}>Cocok untuk siapa?</h2>
          <p style={styles.sectionSub}>Terutama bisnis yang masih pakai Excel atau catatan manual dan ingin lebih tertata.</p>
          <ul style={styles.suitableList}>
            {suitableFor.map((item, i) => (
              <li key={i} style={styles.suitableItem}>
                <span style={styles.suitableCheck}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Benefits */}
      <section style={styles.sectionAlt}>
        <div style={styles.container}>
          <h2 style={styles.sectionTitle}>Dampak yang bisa dirasakan</h2>
          <p style={styles.sectionSub}>Operasional lebih tertata tanpa harus pakai sistem yang rumit.</p>
          <div style={styles.benefitGrid}>
            {benefits.map((item, i) => (
              <div key={i} style={styles.benefitCard}>
                <span style={styles.benefitCheck}>✓</span>
                <span style={styles.benefitText}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trial CTA */}
      <section style={styles.ctaSection}>
        <div style={styles.container}>
          <div style={styles.ctaCard}>
            <h2 style={styles.ctaTitle}>Mulai dengan trial gratis</h2>
            <p style={styles.ctaText}>
              Coba dulu tanpa harus bayar di depan. Langganan bulanan sederhana, cocok untuk bisnis yang baru beralih dari cara manual atau Excel.
            </p>
            <div style={styles.heroCta}>
              <Link href="/register" style={styles.btnPrimary}>Coba Gratis</Link>
              <Link href="/login" style={styles.btnSecondary}>Login</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={styles.section}>
        <div style={styles.container}>
          <h2 style={styles.sectionTitle}>Pertanyaan yang sering diajukan</h2>
          <div style={styles.faqList}>
            {faqs.map((item, i) => (
              <div key={i} style={styles.faqItem}>
                <h3 style={styles.faqQ}>{item.q}</h3>
                <p style={styles.faqA}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.container}>
          <div style={styles.footerInner}>
            <span style={styles.footerBrand}>InvoiceKu</span>
            <div style={styles.footerLinks}>
              <Link href="/login" style={styles.footerLink}>Login</Link>
              <Link href="/register" style={styles.footerLink}>Daftar</Link>
              <Link href="/staff/login" style={styles.footerLink}>Login Staff</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

const painPoints = [
  { icon: "📄", title: "Invoice masih manual", text: "Buat invoice pakai Word/Excel atau tulis tangan, susah dilacak dan rawan salah." },
  { icon: "📦", title: "Stok sering tidak sinkron", text: "Stok di catatan, di kepala, atau di chat beda-beda, bingung mana yang benar." },
  { icon: "💰", title: "Pembayaran sulit dilacak", text: "Sudah bayar atau belum, lunas atau belum, harus cek banyak tempat." },
  { icon: "📋", title: "PO dan surat jalan tersebar", text: "Purchase order dan surat jalan ada di Excel, chat, atau kertas, susah dicari." },
  { icon: "📊", title: "Data ada di Excel, chat, catatan", text: "Data usaha terpencar di banyak file dan percakapan, tidak ada satu sumber benar." },
  { icon: "🔄", title: "Operasional jalan, sistem berantakan", text: "Usaha sudah jalan tapi cara catat dan lacak masih tidak tertata." },
];

const mainFeatures = [
  { label: "Invoice", desc: "Buat dan kelola invoice dalam satu tempat, lebih rapi dan profesional." },
  { label: "Stok", desc: "Pantau stok barang agar tidak kelebihan atau kehabisan tanpa sadar." },
  { label: "Purchase order (PO)", desc: "Catat dan lacak PO dari pembelian sampai penerimaan barang." },
  { label: "Penerimaan barang", desc: "Terima barang sesuai PO dan update stok dengan lebih terstruktur." },
  { label: "Surat jalan", desc: "Kelola surat jalan dan pengiriman agar lebih mudah dilacak." },
  { label: "Lacak pembayaran", desc: "Pantau status pembayaran dan piutang agar tidak ada yang terlewat." },
];

const suitableFor = [
  "Toko kecil",
  "Usaha jual beli barang",
  "Supplier kecil",
  "Kantor operasional kecil",
  "Workshop / pabrik kecil",
  "Bisnis yang masih pakai Excel atau catatan manual",
];

const benefits = [
  "Lebih rapi — data tidak tersebar di banyak file atau chat",
  "Lebih mudah dicek — cari invoice, PO, atau pembayaran jadi lebih cepat",
  "Lebih profesional — invoice dan dokumen tampil lebih tertata",
  "Tidak bingung cari data lama — riwayat tersimpan dan bisa dilihat kapan saja",
  "Operasional lebih tertata — dari stok sampai pembayaran dalam satu alur",
  "Lebih siap berkembang — fondasi data yang rapi memudahkan saat usaha membesar",
];

const faqs = [
  {
    q: "Apakah harus install aplikasi?",
    a: "Tidak. InvoiceKu dipakai lewat browser (web). Cukup buka dari komputer atau HP yang terhubung internet.",
  },
  {
    q: "Apakah cocok untuk usaha kecil?",
    a: "Ya. Dirancang untuk UMKM, toko kecil, supplier kecil, kantor kecil, dan workshop/pabrik kecil yang ingin operasional lebih rapi tanpa sistem yang rumit.",
  },
  {
    q: "Apakah bisa dipakai kalau sebelumnya masih manual?",
    a: "Ya. Cocok untuk yang baru beralih dari Excel, catatan manual, atau chat. Cara pakainya dibuat sederhana agar mudah diikuti.",
  },
  {
    q: "Apakah data tetap bisa dilihat setelah masa aktif habis?",
    a: "Kebijakan penyimpanan data mengikuti ketentuan layanan. Disarankan ekspor atau backup data penting secara berkala.",
  },
  {
    q: "Apakah bisa dipakai untuk toko, kantor kecil, atau workshop?",
    a: "Ya. Bisa dipakai untuk toko, usaha jual beli, supplier, kantor operasional kecil, dan workshop atau pabrik kecil. Fokusnya adalah mengelola invoice, stok, PO, surat jalan, dan pembayaran dalam satu tempat.",
  },
];

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
  },
  container: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "0 24px",
  },
  hero: {
    padding: "64px 0 80px",
    textAlign: "center",
    background: "linear-gradient(180deg, #f1f5f9 0%, #f8fafc 100%)",
    borderBottom: "1px solid #e2e8f0",
  },
  heroTitle: {
    margin: 0,
    fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.25,
    letterSpacing: "-0.02em",
  },
  heroSub: {
    margin: "20px auto 0",
    maxWidth: 640,
    fontSize: "clamp(1rem, 2vw, 1.125rem)",
    color: "#475569",
    lineHeight: 1.6,
  },
  heroCta: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 32,
  },
  btnPrimary: {
    display: "inline-block",
    padding: "14px 28px",
    borderRadius: 12,
    border: "none",
    background: "#0f172a",
    color: "white",
    fontSize: 16,
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
  },
  btnSecondary: {
    display: "inline-block",
    padding: "14px 28px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
  },
  section: {
    padding: "64px 0",
  },
  sectionAlt: {
    padding: "64px 0",
    background: "white",
    borderTop: "1px solid #e2e8f0",
    borderBottom: "1px solid #e2e8f0",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "clamp(1.5rem, 3vw, 1.75rem)",
    fontWeight: 800,
    color: "#0f172a",
    textAlign: "center",
  },
  sectionSub: {
    margin: "12px 0 0",
    fontSize: "1.0625rem",
    color: "#64748b",
    textAlign: "center",
    maxWidth: 560,
    marginLeft: "auto",
    marginRight: "auto",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 20,
    marginTop: 32,
  },
  card: {
    padding: 24,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "white",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  cardIcon: {
    fontSize: 28,
    display: "block",
    marginBottom: 12,
  },
  cardTitle: {
    margin: 0,
    fontSize: "1.0625rem",
    fontWeight: 700,
    color: "#0f172a",
  },
  cardText: {
    margin: "8px 0 0",
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.5,
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 16,
    marginTop: 32,
  },
  featureCard: {
    padding: 20,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  featureLabel: {
    display: "block",
    fontSize: 15,
    fontWeight: 700,
    color: "#0f172a",
  },
  featureDesc: {
    margin: "6px 0 0",
    fontSize: 14,
    color: "#475569",
    lineHeight: 1.5,
  },
  supportFeature: {
    marginTop: 20,
    padding: 20,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#f1f5f9",
    maxWidth: 560,
  },
  supportLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: "#475569",
  },
  supportDesc: {
    margin: "6px 0 0",
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.5,
  },
  suitableList: {
    listStyle: "none",
    margin: "32px 0 0",
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 12,
  },
  suitableItem: {
    padding: "14px 18px 14px 42px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "white",
    fontSize: 15,
    color: "#334155",
    position: "relative",
  },
  suitableCheck: {
    position: "absolute",
    left: 16,
    top: 14,
    color: "#0f172a",
    fontWeight: 700,
  },
  benefitGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 16,
    marginTop: 32,
  },
  benefitCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: 18,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "white",
  },
  benefitCheck: {
    flexShrink: 0,
    width: 24,
    height: 24,
    borderRadius: 8,
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 700,
    fontSize: 14,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    fontSize: 15,
    color: "#334155",
    lineHeight: 1.5,
  },
  ctaSection: {
    padding: "64px 0",
    background: "#f8fafc",
  },
  ctaCard: {
    maxWidth: 560,
    margin: "0 auto",
    padding: 48,
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    background: "white",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    textAlign: "center",
  },
  ctaTitle: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: 800,
    color: "#0f172a",
  },
  ctaText: {
    margin: "16px 0 0",
    fontSize: 16,
    color: "#475569",
    lineHeight: 1.6,
  },
  faqList: {
    marginTop: 32,
    maxWidth: 640,
    marginLeft: "auto",
    marginRight: "auto",
  },
  faqItem: {
    padding: "20px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  faqQ: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
  },
  faqA: {
    margin: "8px 0 0",
    fontSize: 15,
    color: "#475569",
    lineHeight: 1.6,
  },
  footer: {
    padding: "32px 0",
    borderTop: "1px solid #e2e8f0",
    background: "white",
  },
  footerInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
  },
  footerBrand: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
  },
  footerLinks: {
    display: "flex",
    gap: 24,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: 600,
    color: "#475569",
    textDecoration: "none",
  },
};
