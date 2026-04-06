import type { SVGProps } from "react";

type LogoProps = SVGProps<SVGSVGElement> & {
  iconClassName?: string;
  wordmarkClassName?: string;
};

export const Logo = ({
  className,
  iconClassName: _iconClassName,
  wordmarkClassName,
  ...svgProps
}: LogoProps) => {
  return (
    <svg
      className={className}
      viewBox="0 0 160 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Focaccia"
      {...svgProps}
    >
      <text
        className={wordmarkClassName}
        x="0"
        y="24"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="26"
        fontStyle="italic"
        fill="currentColor"
        letterSpacing="1"
      >
        Focaccia
      </text>
    </svg>
  );
};
