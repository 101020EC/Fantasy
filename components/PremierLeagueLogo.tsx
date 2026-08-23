import React from 'react';

export default function PremierLeagueLogo({ className = "w-9 h-9" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny brand mark; next/image would add a request without saving bytes
    <img
      src="/logo.png"
      alt="Fanta Logo"
      className={`${className} rounded-full object-cover shadow-sm`}
    />
  );
}
