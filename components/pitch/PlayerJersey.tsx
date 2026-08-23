import React from 'react';

interface PlayerJerseyProps {
  teamCode: number;
  isGkp?: boolean;
  className?: string;
}

export default function PlayerJersey({ teamCode, isGkp = false, className = "w-10 h-10" }: PlayerJerseyProps) {
  // Generates unique color themes depending on team code / GK status
  const getJerseyColors = () => {
    if (isGkp) {
      return { primary: '#facc15', secondary: '#ca8a04', stripes: '#713f12' }; // Yellow GK
    }
    
    // Distinct vibrant color accents
    const palette = [
      { primary: '#dc2626', secondary: '#991b1b', stripes: '#ffffff' }, // Arsenal / Liverpool Red
      { primary: '#2563eb', secondary: '#1d4ed8', stripes: '#ffffff' }, // Chelsea Blue
      { primary: '#38bdf8', secondary: '#0284c7', stripes: '#ffffff' }, // Man City Sky Blue
      { primary: '#1e293b', secondary: '#0f172a', stripes: '#ffffff' }, // Newcastle Black/White
      { primary: '#7c3aed', secondary: '#5b21b6', stripes: '#00ff87' }, // Villa Claret/Purple
      { primary: '#ea580c', secondary: '#c2410c', stripes: '#000000' }, // Wolves Gold
      { primary: '#059669', secondary: '#047857', stripes: '#ffffff' }, // Green
      { primary: '#ffffff', secondary: '#e2e8f0', stripes: '#0f172a' }, // Spurs White
    ];

    const idx = (teamCode || 1) % palette.length;
    return palette[idx];
  };

  const colors = getJerseyColors();

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`grad-${teamCode}-${isGkp}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors.primary} />
          <stop offset="100%" stopColor={colors.secondary} />
        </linearGradient>
      </defs>
      {/* Jersey Body */}
      <path
        d="M25 22 L38 12 C44 17 56 17 62 12 L75 22 L86 38 L72 47 L68 33 L68 88 L32 88 L32 33 L28 47 L14 38 Z"
        fill={`url(#grad-${teamCode}-${isGkp})`}
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Collar */}
      <path
        d="M38 12 C44 24 56 24 62 12"
        fill="none"
        stroke={colors.stripes}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Center detail accent */}
      <path
        d="M50 30 L50 82"
        stroke={colors.stripes}
        strokeWidth="2"
        strokeDasharray="4 4"
        opacity="0.6"
      />
    </svg>
  );
}
