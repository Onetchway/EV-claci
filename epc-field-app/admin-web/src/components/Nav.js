'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getUser } from '../lib/api';

const LINKS = [
  { href: '/projects', label: 'Projects', icon: '\u{1F4C1}' },
  { href: '/clients', label: 'Clients', icon: '\u{1F3E2}' },
  { href: '/users', label: 'Users', icon: '\u{1F465}', permission: 'users.manage' },
  { href: '/audit', label: 'Audit Log', icon: '\u{1F4CB}', permission: 'audit.view' },
];

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const permissions = user?.permissions || [];

  return (
    <div className="sidebar">
      <div className="sidebar-brand">NaKJM Infra<span>Field Ops</span></div>
      <nav className="sidebar-nav">
        {LINKS.filter((link) => !link.permission || permissions.includes(link.permission)).map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <a key={link.href} href={link.href} className={active ? 'active' : ''}>
              <span className="sidebar-icon">{link.icon}</span>
              {link.label}
            </a>
          );
        })}
      </nav>
      <div className="sidebar-user">
        {user && (
          <>
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-role">{user.roleName || user.role}</div>
          </>
        )}
        <button onClick={logout}>Log out</button>
      </div>
    </div>
  );
}
