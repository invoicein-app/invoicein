import ManualLedgerPageClient from "../manual-ledger-page-client";

export default function ManualPayablePage() {
  return (
    <ManualLedgerPageClient
      entryType="payable"
      pageTitle="Hutang"
      pageSubtitle="Catat hutang manual untuk transaksi di luar purchase flow formal."
      cardTitle="Daftar Hutang Manual"
      addLabel="+ Tambah Hutang"
    />
  );
}
