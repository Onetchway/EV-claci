'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getUser } from '../lib/api';

export default function Nav() {
  const router = useRouter();
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
    <div className="topbar">
      <div className="brand">NaKJM Infra — Field Ops</div>
      <nav>
        <a href="/projects">Projects</a>
        <a href="/clients">Clients</a>
        {permissions.includes('users.manage') && <a href="/users">Users</a>}
        {permissions.includes('audit.view') && <a href="/audit">Audit Log</a>}
      </nav>
      <div className="userbox">
        {user ? <span>{user.name} ({user.roleName || user.role})</span> : null}
        <button onClick={logout}>Log out</button>
      </div>
    </div>
  );
}
