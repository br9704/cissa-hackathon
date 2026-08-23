/*
  Hairline glyphs, drawn at 20px on a 20px grid so they line up with the 4px rhythm.
  currentColor throughout: an icon that bakes its own colour is a token leak wearing a
  different hat, and the hex guard treats it as one.
*/
type P = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 20 20",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const LedgerIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M3 4.5h14M3 8h14M3 11.5h9M3 15h9" />
  </svg>
);

export const StrategyIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="10" cy="4" r="2" />
    <circle cx="4.5" cy="15" r="2" />
    <circle cx="15.5" cy="15" r="2" />
    <path d="M9 5.7 5.6 13.2M11 5.7l3.4 7.5" />
  </svg>
);

export const RiskIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M10 2.8a7.2 7.2 0 1 1-5.1 2.1" />
    <path d="M10 6.2V10l2.6 2.6" />
  </svg>
);

export const DebriefIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M3.5 5.5A1.5 1.5 0 0 1 5 4h10a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 15 13H7.5L4 16v-3a1.5 1.5 0 0 1-.5-1.1z" />
  </svg>
);

export const ComplianceIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M5 2.8h7l3 3v11.4H5z" />
    <path d="M12 2.8v3h3M7.5 10h5M7.5 13h5" />
  </svg>
);

export const VerifyIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M10 2.6 16 5v4.7c0 3.3-2.4 6.2-6 7.7-3.6-1.5-6-4.4-6-7.7V5z" />
    <path d="m7.4 9.9 1.9 1.9 3.4-3.9" />
  </svg>
);

/* My record. A person, and the sheet the system holds on them. */
export const MyRecordIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="10" cy="6.6" r="2.9" />
    <path d="M4.4 16.4a5.6 5.6 0 0 1 11.2 0" />
  </svg>
);
