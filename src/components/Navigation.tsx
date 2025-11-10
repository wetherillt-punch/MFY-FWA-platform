'use client';

import Link from 'next/link';

export default function Navigation() {
  const handleUploadNew = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      window.location.href = '/';
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link href="/">
              <h1 className="text-2xl font-bold text-blue-600 cursor-pointer">
                FWA Detection
              </h1>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/rules"
              className="text-gray-700 hover:text-gray-900 font-medium"
            >
              Rules
            </Link>
            <button
              onClick={handleUploadNew}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
            >
              Upload New File
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
