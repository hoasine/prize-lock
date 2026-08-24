/**
 * PrizeLock logo — trophy mark with navy/teal gradient.
 */

import React from "react";

export type LogoVariant = "full" | "mark" | "wordmark";
export type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
}

const sizeMap = {
  sm: { box: "h-7 w-7", icon: "h-4 w-4", text: "text-base" },
  md: { box: "h-9 w-9", icon: "h-5 w-5", text: "text-lg" },
  lg: { box: "h-11 w-11", icon: "h-6 w-6", text: "text-2xl" },
};

function TrophyMark({ size = "md" }: { size?: LogoSize }) {
  const { box, icon } = sizeMap[size];
  return (
    <span
      className={`gradient-brand inline-flex items-center justify-center rounded-xl text-white shadow-[0_8px_20px_-10px_oklch(0.45_0.12_160_/_0.7)] ${box}`}
    >
      <svg
        className={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="PrizeLock"
      >
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    </span>
  );
}

function Wordmark({ size = "md" }: { size?: LogoSize }) {
  const { text } = sizeMap[size];
  return (
    <span
      className={`font-display font-bold tracking-tight text-foreground ${text}`}
      style={{ letterSpacing: "-0.03em" }}
    >
      Prize<span className="text-gradient">Lock</span>
    </span>
  );
}

export function Logo({ variant = "full", size = "md", className = "" }: LogoProps) {
  if (variant === "mark") {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <TrophyMark size={size} />
      </span>
    );
  }

  if (variant === "wordmark") {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <Wordmark size={size} />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <TrophyMark size={size} />
      <Wordmark size={size} />
    </span>
  );
}

export function LogoFull(props: Omit<LogoProps, "variant">) {
  return <Logo {...props} variant="full" />;
}

export function LogoMark(props: Omit<LogoProps, "variant">) {
  return <Logo {...props} variant="mark" />;
}

export function LogoWordmark(props: Omit<LogoProps, "variant">) {
  return <Logo {...props} variant="wordmark" />;
}
