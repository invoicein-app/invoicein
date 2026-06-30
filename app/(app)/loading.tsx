export default function AppLoading() {
  return (
    <div
      style={{
        minHeight: 240,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#64748b",
        fontSize: 14,
        fontWeight: 600,
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      Memuat halaman...
    </div>
  );
}
