export const Logo = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      viewBox="0 0 160 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Focaccia"
      {...props}
    >
      <text
        x="0"
        y="24"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="26"
        fontStyle="italic"
        fill="white"
        letterSpacing="1"
      >
        Focaccia
      </text>
    </svg>
  );
};
