import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export default function BrandLogo({
  size = 28,
  className = "",
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      src="/brand/logo-gap.png"
      alt="Edge Desk"
      width={size}
      height={size}
      className={`rounded-desk-sm ${className}`.trim()}
      priority={priority}
    />
  );
}
