import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20" {...props}>
      {children}
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return <IconBase {...props}><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></IconBase>;
}

export function CalendarIcon(props: IconProps) {
  return <IconBase {...props}><path d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" /></IconBase>;
}

export function CheckIcon(props: IconProps) {
  return <IconBase {...props}><path d="m5 12.5 4.2 4L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></IconBase>;
}

export function CopyIcon(props: IconProps) {
  return <IconBase {...props}><rect height="12" rx="2" stroke="currentColor" strokeWidth="1.6" width="12" x="8" y="8" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" /></IconBase>;
}

export function LocationIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" /><circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.6" /></IconBase>;
}

export function TicketIcon(props: IconProps) {
  return <IconBase {...props}><path d="M4 7.5h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4v-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" /><path d="M9 8v9" stroke="currentColor" strokeDasharray="2.5 2.5" strokeWidth="1.4" /></IconBase>;
}
