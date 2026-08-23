import React from 'react';

interface PremierLeagueLogoProps {
  className?: string;
}

export default function PremierLeagueLogo({ className = "w-8 h-8" }: PremierLeagueLogoProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Premier League Purple Circle / Badge */}
      <rect width="120" height="120" rx="30" fill="#38003c" />
      {/* Iconic Premier League Lion silhouette */}
      <path
        d="M60 22 C64 22 67 24 69 27 C72 25 76 25 78 28 C81 29 82 33 81 36 C85 38 87 42 86 46 C89 49 89 54 86 58 C88 62 87 68 83 71 C84 76 81 81 76 83 C74 88 68 91 63 91 C60 91 58 90 56 88 C53 91 47 91 43 88 C38 89 33 86 31 81 C27 80 24 75 25 70 C22 67 21 61 24 57 C21 53 22 47 25 44 C24 40 26 35 30 33 C31 29 35 27 39 28 C42 25 46 24 49 26 C52 23 56 22 60 22 Z"
        fill="#00ff87"
        opacity="0.15"
      />
      {/* Premier League Lion Face & Crown Vector */}
      <path
        d="M60 26 L64 34 L73 31 L69 40 L78 44 L68 49 L72 58 L63 56 L62 65 L57 58 L52 64 L53 56 L44 58 L48 49 L39 44 L47 40 L44 31 L52 34 Z"
        fill="#00ff87"
      />
      {/* Crown Jewels / Accents */}
      <circle cx="45" cy="30" r="2.5" fill="#ffffff" />
      <circle cx="60" cy="24" r="3" fill="#ffffff" />
      <circle cx="75" cy="30" r="2.5" fill="#ffffff" />
      {/* Lion Face Details */}
      <path
        d="M48 64 C48 64 54 75 60 75 C66 75 72 64 72 64 C72 64 68 80 60 82 C52 80 48 64 48 64 Z"
        fill="#ffffff"
      />
      {/* Eyes and Nose */}
      <circle cx="54" cy="68" r="2" fill="#38003c" />
      <circle cx="66" cy="68" r="2" fill="#38003c" />
      <path d="M58 72 L62 72 L60 75 Z" fill="#38003c" />
      {/* Mouth Line */}
      <path d="M56 77 C58 79 62 79 64 77" stroke="#38003c" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
