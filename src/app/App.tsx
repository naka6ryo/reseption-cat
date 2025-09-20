import { NavLink, Outlet } from 'react-router-dom';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <h1 className="font-bold text-lg">Reception Cat</h1>
        <nav className="flex gap-3 text-sm">
          <NavLink to="/display" className={({isActive})=> isActive? 'font-bold underline' : ''}>/display</NavLink>
          <NavLink to="/setup" className={({isActive})=> isActive? 'font-bold underline' : ''}>/setup</NavLink>
        </nav>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}