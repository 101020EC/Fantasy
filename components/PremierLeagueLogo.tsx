import React from 'react';

export default function PremierLeagueLogo({ className = "w-9 h-9" }: { className?: string }) {
  return (
    // Served at 96px (2380 bytes) rather than the 512px logo.png (252KB) this used
    // to point at. It renders at 40px and lives in the navbar, so that source was
    // shipping a quarter-megabyte on every page view to fill a 40px box.
    // eslint-disable-next-line @next/next/no-img-element -- tiny brand mark; next/image would add a request without saving bytes
    <img
      src="/logo-mark.webp"
      alt="Fanta Logo"
      className={`${className} rounded-full object-cover shadow-sm`}
    />
  );
}
