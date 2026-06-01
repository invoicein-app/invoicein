import { listTableStyles } from "./list-page-layout";

type Props = {
  columns?: number;
  rows?: number;
};

export default function ListTableSkeleton({ columns = 4, rows = 6 }: Props) {
  return (
    <table style={listTableStyles.table} aria-hidden>
      <tbody>
        {Array.from({ length: rows }).map((_, ri) => (
          <tr key={ri}>
            {Array.from({ length: columns }).map((__, ci) => (
              <td key={ci} style={listTableStyles.td}>
                <div
                  style={{
                    height: 14,
                    borderRadius: 6,
                    background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
                    backgroundSize: "200% 100%",
                    animation: "invoicekuShimmer 1.2s ease-in-out infinite",
                    width: ci === 0 ? "72%" : ci === columns - 1 ? "48%" : "56%",
                  }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
