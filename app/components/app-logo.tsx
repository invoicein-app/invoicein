import { APP_LOGO_SRC, APP_NAME } from "./app-brand";

type Props = {
  size?: number;
  style?: React.CSSProperties;
};

export default function AppLogo({ size = 36, style }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={APP_LOGO_SRC}
      alt={APP_NAME}
      width={size}
      height={size}
      style={{
        objectFit: "contain",
        display: "block",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
