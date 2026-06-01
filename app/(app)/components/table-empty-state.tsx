import { listTableStyles } from "./list-page-layout";

type Props = {
  message: string;
  colSpan: number;
  minHeight?: number;
};

export default function TableEmptyState({
  message,
  colSpan,
  minHeight = 72,
}: Props) {
  return (
    <tr>
      <td
        className="app-table-empty-state"
        colSpan={colSpan}
        style={{
          ...listTableStyles.empty,
          minHeight,
          verticalAlign: "middle",
          lineHeight: 1.45,
          letterSpacing: "-0.01em",
        }}
      >
        <div className="app-table-empty-state__text">{message}</div>
      </td>
    </tr>
  );
}
