import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('vg_token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children ? children : <Outlet />;
}
