import Link from "next/link";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <div
      className={`${inter.className} min-h-screen bg-white text-slate-800 antialiased`}
    >
      <LandingHeader />
      <HeroSection />
      <PainPointsSection />
      <DarkFeaturesSection />
      <PricingSection />
      <FaqSection />
      <LandingFooter />
    </div>
  );
}

function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
            <InvoiceMarkIcon className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            InvoiceKU
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#fitur"
            className="text-sm font-medium text-slate-600 transition hover:text-teal-700"
          >
            Fitur
          </a>
          <a
            href="#harga"
            className="text-sm font-medium text-slate-600 transition hover:text-teal-700"
          >
            Harga
          </a>
          <a
            href="#kontak"
            className="text-sm font-medium text-slate-600 transition hover:text-teal-700"
          >
            Hubungi Kami
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-semibold text-slate-600 hover:text-teal-700 sm:inline"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700"
          >
            Coba Gratis Sekarang
          </Link>

          <details className="relative md:hidden">
            <summary className="list-none cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
              Menu
            </summary>
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
              <a
                href="#fitur"
                className="block px-4 py-2 text-sm hover:bg-slate-50"
              >
                Fitur
              </a>
              <a
                href="#harga"
                className="block px-4 py-2 text-sm hover:bg-slate-50"
              >
                Harga
              </a>
              <a
                href="#kontak"
                className="block px-4 py-2 text-sm hover:bg-slate-50"
              >
                Hubungi Kami
              </a>
              <Link
                href="/login"
                className="block px-4 py-2 text-sm hover:bg-slate-50"
              >
                Login
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="border-b border-slate-100 bg-gradient-to-b from-teal-50/60 to-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:py-24">
        <div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-[2.5rem]">
            Kelola Bisnis{" "}
            <span className="text-teal-600">Lebih Rapi &amp; Tidak Ribet</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Kelola invoice, stok, purchase order, surat jalan, dan pembayaran
            dalam satu tempat yang sederhana dan mudah dipakai. Cocok untuk
            toko, supplier, kantor kecil, dan workshop yang masih mencatat
            operasional secara manual.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-6 py-3.5 text-base font-bold text-white shadow-md shadow-teal-600/20 transition hover:bg-teal-700"
            >
              Mulai Sekarang
            </Link>
            <Link
              href="#fitur"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
            >
              Lihat Fitur
            </Link>
          </div>
        </div>
        <DashboardMockup />
      </div>
    </section>
  );
}

function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-teal-200/40 via-teal-100/20 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400/90" />
          <span className="h-3 w-3 rounded-full bg-amber-400/90" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
          <span className="ml-2 text-xs font-medium text-slate-400">
            InvoiceKU — Dashboard
          </span>
        </div>
        <div className="grid gap-4 p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "Penjualan", val: "Rp 12,4jt", tone: "bg-teal-600" },
              { label: "Piutang", val: "Rp 3,2jt", tone: "bg-teal-500/90" },
              { label: "Invoice", val: "48", tone: "bg-slate-700" },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm"
              >
                <div className={`mb-2 h-1 rounded-full ${c.tone}`} />
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {c.label}
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900">
                  {c.val}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <div className="mb-3 flex items-end justify-between gap-2">
              {[40, 65, 45, 80, 55, 70, 90].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-teal-600 to-teal-400"
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] font-medium text-slate-400">
              <span>Sen</span>
              <span>Sel</span>
              <span>Rab</span>
              <span>Kam</span>
              <span>Jum</span>
              <span>Sab</span>
              <span>Min</span>
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-100 p-3">
            <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold uppercase text-slate-400">
              <span className="col-span-2">Invoice</span>
              <span>Status</span>
              <span className="text-right">Total</span>
            </div>
            {[
              ["INV-2026-0426-001", "Lunas", "Rp 2,1jt"],
              ["INV-2026-0425-014", "Draft", "Rp 890rb"],
            ].map(([inv, st, tot]) => (
              <div
                key={inv}
                className="grid grid-cols-4 items-center gap-2 rounded-lg bg-white py-2 text-xs"
              >
                <span className="col-span-2 font-medium text-slate-700">
                  {inv}
                </span>
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                  {st}
                </span>
                <span className="text-right font-semibold text-slate-800">
                  {tot}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const painPoints = [
  {
    title: "Tidak Ada Monitoring",
    text: "Transaksi dan perubahan sulit diawasi tanpa riwayat yang jelas.",
    img: "from-teal-400 to-teal-600",
  },
  {
    title: "Manajemen Stok Buruk",
    text: "Stok di catatan, chat, atau Excel tidak sinkron dan rawan salah.",
    img: "from-emerald-400 to-teal-600",
  },
  {
    title: "Laporan Manual",
    text: "Rekap penjualan dan piutang harus dirangkai manual dari banyak sumber.",
    img: "from-cyan-400 to-teal-600",
  },
  {
    title: "Stok Tidak Terdata",
    text: "Barang masuk-keluar tidak tercatat rapi sehingga sering bingung stok nyata.",
    img: "from-teal-500 to-slate-600",
  },
  {
    title: "Pembayaran Sulit Dilacak",
    text: "Sudah lunas atau belum harus dicek ke banyak tempat.",
    img: "from-teal-300 to-teal-700",
  },
  {
    title: "PO & Surat Jalan Berceceran",
    text: "Dokumen tersebar di file, chat, atau kertas sehingga sulit dicari.",
    img: "from-slate-400 to-teal-600",
  },
  {
    title: "Data Tercecer",
    text: "Tidak ada satu sumber benar untuk invoice, PO, dan pembayaran.",
    img: "from-teal-400 to-slate-500",
  },
  {
    title: "Sistem Berantakan",
    text: "Operasional jalan tapi cara catat dan lacak belum tertata.",
    img: "from-teal-600 to-emerald-700",
  },
];

function PainPointsSection() {
  return (
    <section id="fitur" className="scroll-mt-20 border-b border-slate-100 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-teal-600">
          Dilema Bisnis
        </p>
        <h2 className="mt-2 text-center text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Kenapa Bisnis Terasa Ribet?
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
          Kalau operasional masih mengandalkan Excel atau catatan manual,
          masalah ini sering muncul setiap hari.
        </p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {painPoints.map((item) => (
            <article
              key={item.title}
              className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md"
            >
              <div
                className={`h-28 bg-gradient-to-br ${item.img} sm:h-32`}
                aria-hidden
              />
              <div className="p-4">
                <h3 className="text-base font-bold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {item.text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const darkFeatures = [
  {
    title: "Monitoring Riwayat Aktivitas",
    desc: "Pantau perubahan penting dan jejak transaksi untuk pengawasan yang lebih baik.",
    icon: "chart",
  },
  {
    title: "Manajemen Akun/Hak yang Aman",
    desc: "Pisahkan peran admin dan staf sesuai kebutuhan operasional.",
    icon: "lock",
  },
  {
    title: "Cetak dan bagikan faktur dengan mudah",
    desc: "Invoice dan dokumen siap cetak atau dibagikan ke pelanggan.",
    icon: "print",
  },
  {
    title: "Dapatkan laporan faktur secara real-time",
    desc: "Gambaran penjualan dan piutang lebih cepat tanpa susun manual.",
    icon: "report",
  },
];

function DarkFeaturesSection() {
  return (
    <section className="bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 py-16 text-white sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8">
        <div>
          <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl lg:text-4xl">
            Masih Pakai Sistem Manual?{" "}
            <span className="text-teal-300">Saatnya Naik Level!</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-teal-100/90">
            InvoiceKU membantu Anda beralih dari spreadsheet dan chat yang
            berantakan ke satu alur kerja yang rapi — tanpa harus memakai sistem
            yang rumit.
          </p>
        </div>
        <ul className="grid gap-4">
          {darkFeatures.map((f) => (
            <li
              key={f.title}
              className="flex gap-4 rounded-2xl border border-white/10 bg-white p-4 shadow-lg shadow-black/10 sm:p-5"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <FeatureIcon name={f.icon} />
              </span>
              <div>
                <h3 className="font-bold text-slate-900">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {f.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const pricingPlans = [
  {
    name: "Starter",
    price: "Rp 49.000",
    period: "/bln",
    badge: null,
    highlight: false,
    features: [
      "1 pengguna staff",
      "Invoice & quotation",
      "Stok dasar",
      "Email support",
      "Trial gratis",
    ],
  },
  {
    name: "Business",
    price: "Rp 99.000",
    period: "/bln",
    badge: "Populer",
    highlight: true,
    features: [
      "Hingga 3 pengguna staff",
      "Semua fitur Starter",
      "Purchase order & penerimaan",
      "Surat jalan",
      "Riwayat aktivitas",
      "Prioritas support",
    ],
  },
  {
    name: "Enterprise",
    price: "Rp 550.000",
    period: "/thn",
    badge: "Hemat",
    highlight: false,
    features: [
      "Paket tahunan untuk operasional stabil",
      "Nilai lebih untuk komitmen jangka panjang",
      "Diskusi kebutuhan khusus",
      "Invoice & stok lengkap",
      "Support & update berkelanjutan",
    ],
  },
];

function PricingSection() {
  return (
    <section id="harga" className="scroll-mt-20 bg-slate-50/80 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-teal-600">
          Harga Paket
        </p>
        <h2 className="mt-2 text-center text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Pilih Paket Sesuai Kebutuhan Bisnis Anda
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
          Mulai dari yang ringan untuk UMKM, hingga paket yang lebih luas untuk
          tim yang berkembang.
        </p>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                plan.highlight
                  ? "border-teal-500 ring-2 ring-teal-500/20 lg:scale-[1.02]"
                  : "border-slate-200"
              }`}
            >
              {plan.badge && (
                <span
                  className={`absolute -top-3 right-4 rounded-full px-3 py-1 text-xs font-bold ${
                    plan.highlight
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {plan.badge}
                </span>
              )}
              <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900">
                  {plan.price}
                </span>
                <span className="text-slate-500">{plan.period}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-slate-600">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700"
                      aria-hidden
                    >
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`mt-8 block w-full rounded-lg py-3 text-center text-sm font-bold transition ${
                  plan.highlight
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : "border border-slate-200 bg-white text-slate-800 hover:border-teal-300 hover:text-teal-800"
                }`}
              >
                Pilih Paket
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const faqs = [
  {
    q: "Apakah harus install aplikasi?",
    a: "Tidak. InvoiceKU dipakai lewat browser (web). Cukup buka dari komputer atau HP yang terhubung internet.",
  },
  {
    q: "Apakah cocok untuk usaha kecil?",
    a: "Ya. Dirancang untuk UMKM, toko kecil, supplier kecil, kantor kecil, dan workshop yang ingin operasional lebih rapi tanpa sistem yang rumit.",
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
    a: "Ya. Bisa dipakai untuk toko, usaha jual beli, supplier, kantor operasional kecil, dan workshop atau pabrik kecil.",
  },
];

function FaqSection() {
  return (
    <section className="border-t border-slate-100 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-slate-900 sm:text-3xl">
          Pertanyaan Umum
        </h2>
        <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="open:[&_.faq-chevron]:rotate-45 px-4 py-1 sm:px-6 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-semibold text-slate-900">
                {item.q}
                <span className="faq-chevron text-xl font-normal text-teal-600 transition">
                  +
                </span>
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer id="kontak" className="scroll-mt-20 border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-white">
                <InvoiceMarkIcon className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold text-white">InvoiceKU</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Platform sederhana untuk kelola invoice, stok, PO, dan surat jalan
              — agar bisnis kecil tetap rapi tanpa ribet.
            </p>
            <div className="mt-5 flex gap-3">
              <SocialLink href="#" label="Facebook" icon="fb" />
              <SocialLink href="#" label="Instagram" icon="ig" />
              <SocialLink href="#" label="WhatsApp" icon="wa" />
              <SocialLink href="#" label="X" icon="x" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-white">
              Head Office
            </h4>
            <p className="mt-3 text-sm leading-relaxed">
              Indonesia
              <br />
              (Alamat lengkap dapat ditambahkan sesuai perusahaan Anda)
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-white">
              Email
            </h4>
            <a
              href="mailto:support@invoiceku.app"
              className="mt-3 block text-sm text-teal-400 hover:text-teal-300"
            >
              support@invoiceku.app
            </a>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-white">
              Sitemap
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href="#fitur" className="hover:text-white">
                  Fitur
                </a>
              </li>
              <li>
                <a href="#harga" className="hover:text-white">
                  Harga
                </a>
              </li>
              <li>
                <Link href="/login" className="hover:text-white">
                  Login
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white">
                  Daftar
                </Link>
              </li>
            </ul>
            <h4 className="mt-6 text-sm font-bold uppercase tracking-wide text-white">
              Bantuan
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/staff/login" className="hover:text-white">
                  Login Staff
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-slate-700 pt-8 text-center text-xs text-slate-500">
          © {year} InvoiceKU. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: "fb" | "ig" | "wa" | "x";
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-slate-300 transition hover:border-teal-500 hover:text-white"
    >
      {icon === "fb" && (
        <span className="text-xs font-bold" aria-hidden>
          f
        </span>
      )}
      {icon === "ig" && (
        <span className="text-xs font-bold" aria-hidden>
          in
        </span>
      )}
      {icon === "wa" && (
        <span className="text-xs font-bold" aria-hidden>
          W
        </span>
      )}
      {icon === "x" && (
        <span className="text-xs font-bold" aria-hidden>
          𝕏
        </span>
      )}
    </a>
  );
}

function InvoiceMarkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M7 3h10a2 2 0 012 2v14l-4-2-4 2-4-2V5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9 8h6M9 11h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FeatureIcon({ name }: { name: string }) {
  const cls = "h-6 w-6";
  switch (name) {
    case "chart":
      return (
        <svg className={cls} width={24} height={24} fill="none" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M4 19V5M4 19h16M8 17V11M12 17V8M16 17v-5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "lock":
      return (
        <svg className={cls} width={24} height={24} fill="none" viewBox="0 0 24 24" aria-hidden>
          <rect
            x="5"
            y="11"
            width="14"
            height="10"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M9 11V8a3 3 0 116 0v3"
            stroke="currentColor"
            strokeWidth="1.75"
          />
        </svg>
      );
    case "print":
      return (
        <svg className={cls} width={24} height={24} fill="none" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M7 17h10v4H7v-4zM7 3h10v6H7V3zM5 9h14a2 2 0 012 2v4H3v-4a2 2 0 012-2z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "report":
      return (
        <svg className={cls} width={24} height={24} fill="none" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M8 5h8v14H8V5zM4 9h2M4 13h2M4 17h2"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}
