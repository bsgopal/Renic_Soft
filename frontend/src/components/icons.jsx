export const Icon = ({ name, className = 'w-5 h-5', strokeWidth = 1.8 }) => {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    viewBox: '0 0 24 24'
  };

  switch (name) {
    case 'dashboard':
      return (<svg {...common}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>);
    case 'license':
      return (<svg {...common}><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M6.5 17l3.5-3.5 2 2 3-3 2.5 2.5"/></svg>);
    case 'quote':
      return (<svg {...common}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 13h6M9 17h6"/></svg>);
    case 'bill':
      return (<svg {...common}><path d="M6 3h12a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1z"/><path d="M9 8h6M9 12h6"/></svg>);
    case 'logout':
      return (<svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>);
    case 'plus':
      return (<svg {...common}><path d="M12 5v14M5 12h14"/></svg>);
    case 'search':
      return (<svg {...common}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>);
    case 'copy':
      return (<svg {...common}><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>);
    case 'key':
      return (<svg {...common}><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.5 12.5L21 2M15 7l3 3M17 5l2 2"/></svg>);
    case 'edit':
      return (<svg {...common}><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>);
    case 'trash':
      return (<svg {...common}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>);
    case 'eye':
      return (<svg {...common}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>);
    case 'check':
      return (<svg {...common}><path d="M20 6L9 17l-5-5"/></svg>);
    case 'x':
      return (<svg {...common}><path d="M18 6L6 18M6 6l12 12"/></svg>);
    case 'menu':
      return (<svg {...common}><path d="M3 6h18M3 12h18M3 18h18"/></svg>);
    case 'print':
      return (<svg {...common}><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>);
    case 'refresh':
      return (<svg {...common}><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>);
    case 'bell':
      return (<svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>);
    case 'store':
      return (<svg {...common}><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v9h14v-9"/><path d="M9 21v-6h6v6"/></svg>);
    case 'users':
      return (<svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
    case 'clock':
      return (<svg {...common}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>);
    case 'network':
      return (<svg {...common}><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>);
    case 'whatsapp':
      return (<svg {...common}><path d="M21 11.5a8.5 8.5 0 0 1-12.36 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z"/><path d="M8.5 8.8c.3-.8 1.4-.9 2-.2.4.5.8 1.1.4 1.9l.6.5c1.6 1 2.4 1 3-1a1.9 1.9 0 0 0-1.2-2.5"/></svg>);
    case 'gitBranch':
      return (<svg {...common}><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>);
    case 'lock':
      return (<svg {...common}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
    case 'unlock':
      return (<svg {...common}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>);
    case 'list':
      return (<svg {...common}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>);
    case 'shield':
      return (<svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);
    case 'alert':
      return (<svg {...common}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>);
    default:
      return null;
  }
};