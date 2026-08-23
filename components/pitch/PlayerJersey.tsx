'use client';

import React, { useId, useState } from 'react';

interface PlayerJerseyProps {
  teamCode: number;
  isGkp?: boolean;
  className?: string;
}

export default function PlayerJersey({
  teamCode,
  isGkp = false,
  className = "w-10 h-10",
}: PlayerJerseyProps) {
  const [imgError, setImgError] = useState(false);
  // Unique per instance: deriving the id from teamCode produced duplicate DOM
  // ids whenever two players shared a club.
  const gradientId = useId();

  // Official Premier League Shirt CDN URLs
  const officialShirtUrl = isGkp
    ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}_1-110.webp`
    : `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-110.webp`;

  if (!imgError && teamCode) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote shirt art with a runtime SVG fallback; next/image cannot express the onError swap
      <img
        src={officialShirtUrl}
        alt={`Shirt ${teamCode}`}
        className={`${className} object-contain filter drop-shadow-md transition-transform`}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    );
  }

  // Realistic Fallback Vector if CDN is offline
  const palette = [
    { primary: '#dc2626', secondary: '#991b1b', collar: '#ffffff' }, // Arsenal / Liverpool
    { primary: '#1e40af', secondary: '#1e3a8a', collar: '#ffffff' }, // Chelsea
    { primary: '#38bdf8', secondary: '#0284c7', collar: '#ffffff' }, // Man City
    { primary: '#111827', secondary: '#030712', collar: '#ffffff' }, // Newcastle
    { primary: '#6b21a8', secondary: '#4c1d95', collar: '#38bdf8' }, // Villa
    { primary: '#d97706', secondary: '#b45309', collar: '#000000' }, // Wolves
    { primary: '#ffffff', secondary: '#f3f4f6', collar: '#1e3a8a' }, // Spurs
  ];
  const colors = isGkp
    ? { primary: '#facc15', secondary: '#ca8a04', collar: '#000000' }
    : palette[(teamCode || 1) % palette.length];

  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors.primary} />
          <stop offset="100%" stopColor={colors.secondary} />
        </linearGradient>
      </defs>
      <path
        d="M25 22 L38 12 C44 17 56 17 62 12 L75 22 L86 38 L72 47 L68 33 L68 88 L32 88 L32 33 L28 47 L14 38 Z"
        fill={`url(#${gradientId})`}
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M38 12 C44 24 56 24 62 12" fill="none" stroke={colors.collar} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
