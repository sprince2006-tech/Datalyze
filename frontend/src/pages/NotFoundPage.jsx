import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="text-center max-w-md">
        <h1 className="text-5xl font-extrabold text-brand mb-3">404</h1>
        <p className="text-lg font-bold text-gray-900 mb-2">Page not found</p>
        <p className="text-sm text-gray-600 mb-6">
          The page you are looking for does not exist.
        </p>
        <Link to="/" className="btn-wp">
          Back to home
        </Link>
      </div>
    </div>
  );
}
