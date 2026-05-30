import ManualLedgerPageClient from "../manual-ledger-page-client";

export default function ManualReceivablePage() {
  return (
    <ManualLedgerPageClient
      entryType="receivable"
      pageTitle="Piutang Lainnya"
      pageSubtitle="Catat piutang di luar alur invoice formal (tetap praktis untuk UMKM)."
      cardTitle="Daftar Piutang Lainnya"
      addLabel="+ Tambah Piutang Lainnya"
    />
  );
}
