import * as React from "react";

type P = React.SVGProps<SVGSVGElement>;

const base = (d: React.ReactNode, extra: Partial<P> = {}) =>
  function Icon(p: P) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...extra}
        {...p}
      >
        {d}
      </svg>
    );
  };

export const Bolt = base(
  <path d="M13 2 4.5 13.2A.6.6 0 0 0 5 14h5.2l-1.1 7.6a.5.5 0 0 0 .9.36L19.5 10.8a.6.6 0 0 0-.5-.96h-5.2l1-7.5a.5.5 0 0 0-.8-.34Z" />,
  { fill: "currentColor", stroke: "none" }
);

export const Grid = base(
  <>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </>
);

export const QrIcon = base(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 21h1M21 14h-1" />
  </>
);

export const ScanIcon = base(
  <>
    <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
    <path d="M3 12h18" strokeWidth={2.2} />
  </>
);

export const Users = base(
  <>
    <path d="M16 20v-1.8a3.7 3.7 0 0 0-3.7-3.7H6.2A3.7 3.7 0 0 0 2.5 18.2V20" />
    <circle cx="9.2" cy="7.5" r="3.6" />
    <path d="M21.5 20v-1.8a3.7 3.7 0 0 0-2.8-3.58M15.8 4.1a3.7 3.7 0 0 1 0 7.16" />
  </>
);

export const UserPlus = base(
  <>
    <path d="M15 20v-1.8a3.7 3.7 0 0 0-3.7-3.7H5.7A3.7 3.7 0 0 0 2 18.2V20" />
    <circle cx="8.5" cy="7.5" r="3.6" />
    <path d="M19 8v6M22 11h-6" />
  </>
);

export const Clock = base(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.2l3.3 2" />
  </>
);

export const Bell = base(
  <>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.2 7.5-2.2 7.5h16.4S18 14.5 18 8.5Z" />
    <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
  </>
);

export const Tag = base(
  <>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8A2 2 0 0 1 4.8 2.8H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8Z" />
    <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
  </>
);

export const Gear = base(
  <>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.76l.06.06a1.94 1.94 0 1 1-2.74 2.74l-.06-.06a1.6 1.6 0 0 0-1.76-.32 1.6 1.6 0 0 0-.97 1.46V21a1.94 1.94 0 1 1-3.88 0v-.1a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.76.32l-.06.06a1.94 1.94 0 1 1-2.74-2.74l.06-.06a1.6 1.6 0 0 0 .32-1.76 1.6 1.6 0 0 0-1.46-.97H3a1.94 1.94 0 1 1 0-3.88h.1a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.76l-.06-.06a1.94 1.94 0 1 1 2.74-2.74l.06.06a1.6 1.6 0 0 0 1.76.32H9a1.6 1.6 0 0 0 .97-1.46V3a1.94 1.94 0 1 1 3.88 0v.1a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.76-.32l.06-.06a1.94 1.94 0 1 1 2.74 2.74l-.06.06a1.6 1.6 0 0 0-.32 1.76V9a1.6 1.6 0 0 0 1.46.97H21a1.94 1.94 0 1 1 0 3.88h-.1a1.6 1.6 0 0 0-1.46.97Z" />
  </>
);

export const Whats = base(
  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.16c-.24.68-1.42 1.32-1.96 1.36-.5.05-1.14.07-1.83-.11-.42-.13-.96-.31-1.66-.6-2.92-1.26-4.82-4.2-4.97-4.4-.14-.2-1.19-1.58-1.19-3.02s.76-2.14 1.03-2.44c.27-.3.58-.37.78-.37.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.83 2.02.9 2.17.07.15.12.32.02.52-.1.2-.15.32-.29.5-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.36 1.45.29.15.46.12.63-.07.17-.2.73-.85.92-1.14.2-.29.39-.24.66-.15.27.1 1.7.8 1.99.95.29.15.48.22.55.34.07.13.07.73-.17 1.41Z" />,
  { fill: "currentColor", stroke: "none" }
);

export const Check = base(<path d="m4.5 12.5 5 5 10-11" strokeWidth={2.4} />);
export const X = base(<path d="M18 6 6 18M6 6l12 12" strokeWidth={2.2} />);
export const Plus = base(<path d="M12 5v14M5 12h14" strokeWidth={2.2} />);
export const Search = base(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </>
);
export const ChevronL = base(<path d="m15 18-6-6 6-6" strokeWidth={2.2} />);
export const ChevronR = base(<path d="m9 18 6-6-6-6" strokeWidth={2.2} />);
export const Menu = base(<path d="M3 6h18M3 12h18M3 18h18" strokeWidth={2.2} />);
export const LogOut = base(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </>
);
export const Download = base(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5M12 15V3" />
  </>
);
export const Printer = base(
  <>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" rx="1.5" />
  </>
);
export const Alert = base(
  <>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4.5M12 17.2h.01" />
  </>
);
export const Trending = base(
  <>
    <path d="m22 7-8.5 8.5-5-5L2 17" />
    <path d="M16 7h6v6" />
  </>
);
export const Wallet = base(
  <>
    <path d="M20 12V8.5A2.5 2.5 0 0 0 17.5 6H4.8A1.8 1.8 0 0 1 3 4.2 1.8 1.8 0 0 1 4.8 2.4h12" />
    <path d="M3 4.2v13.3A2.5 2.5 0 0 0 5.5 20h12A2.5 2.5 0 0 0 20 17.5V15" />
    <path d="M22 12v3h-4a1.5 1.5 0 0 1 0-3h4Z" />
  </>
);
export const Globe = base(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.2 9h17.6M3.2 15h17.6" />
    <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
  </>
);
export const Refresh = base(
  <>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </>
);
export const Snowflake = base(
  <>
    <path d="M12 2v20M4.2 6.5l15.6 9M19.8 6.5l-15.6 9" />
    <path d="M12 5.6 9.6 3.4M12 5.6l2.4-2.2M12 18.4l-2.4 2.2M12 18.4l2.4 2.2" />
  </>
);
export const Trash = base(
  <>
    <path d="M3.5 6h17M9 6V4.2A1.2 1.2 0 0 1 10.2 3h3.6A1.2 1.2 0 0 1 15 4.2V6" />
    <path d="M18.5 6 17.7 19a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9L5.5 6" />
  </>
);
export const Phone = base(
  <path d="M21.5 16.9v2.8a1.9 1.9 0 0 1-2.06 1.9 18.7 18.7 0 0 1-8.16-2.9 18.4 18.4 0 0 1-5.66-5.66A18.7 18.7 0 0 1 2.7 4.84 1.9 1.9 0 0 1 4.6 2.78h2.8a1.9 1.9 0 0 1 1.9 1.63c.12.9.35 1.79.67 2.63a1.9 1.9 0 0 1-.43 2l-1.18 1.19a15.2 15.2 0 0 0 5.66 5.66l1.19-1.19a1.9 1.9 0 0 1 2-.42c.84.32 1.72.55 2.63.67a1.9 1.9 0 0 1 1.63 1.93Z" />
);
export const Calendar = base(
  <>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </>
);
export const Sound = base(
  <>
    <path d="M11 5 6.5 8.7H3v6.6h3.5L11 19z" />
    <path d="M15.6 8.4a5 5 0 0 1 0 7.2M18.6 5.4a9 9 0 0 1 0 13.2" />
  </>
);
export const Mute = base(
  <>
    <path d="M11 5 6.5 8.7H3v6.6h3.5L11 19z" />
    <path d="m16.5 9.5 5 5M21.5 9.5l-5 5" />
  </>
);
export const Shield = base(
  <>
    <path d="M12 22s8-3.4 8-9.6V5.4L12 2.4 4 5.4v7C4 18.6 12 22 12 22Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </>
);
export const Lock = base(
  <>
    <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
    <path d="M8 10.5V7.2a4 4 0 0 1 8 0v3.3" />
  </>
);
export const User = base(
  <>
    <circle cx="12" cy="7.8" r="4.2" />
    <path d="M4 21v-1.2A5.8 5.8 0 0 1 9.8 14h4.4a5.8 5.8 0 0 1 5.8 5.8V21" />
  </>
);
export const List = base(
  <>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="3.6" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="3.6" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="3.6" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </>
);
export const Camera = base(
  <>
    <path d="M22 18.5a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5v-10A2.5 2.5 0 0 1 4.5 6H7l1.8-2.6h6.4L17 6h2.5A2.5 2.5 0 0 1 22 8.5Z" />
    <circle cx="12" cy="13" r="3.8" />
  </>
);
export const Flip = base(
  <>
    <path d="M12 3v18" strokeDasharray="3 3" />
    <path d="M7.5 7.5 3.5 12l4 4.5zM16.5 7.5l4 4.5-4 4.5z" />
  </>
);
