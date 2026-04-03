"use client"

import Image from "next/image"
import Link from "next/link"

import { DLS } from "@/lib/dls"
import { cn } from "@/lib/utils"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dls-app-bg min-h-svh">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6">
        {children}
      </div>
    </div>
  )
}

export function Icon({
  src,
  alt,
  size = 20,
  className,
}: {
  src: string
  alt: string
  size?: number
  className?: string
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      unoptimized
    />
  )
}

export function PrimaryButton({
  children,
  href,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  href?: string
  onClick?: () => void
  disabled?: boolean
}) {
  const className = cn(
    "inline-flex min-h-14 w-full items-center justify-center rounded-xl px-4 py-3 text-xl font-semibold",
    disabled ? "dls-button-disabled cursor-not-allowed" : "dls-button-primary"
  )
  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  href,
  onClick,
}: {
  children: React.ReactNode
  href?: string
  onClick?: () => void
}) {
  const className =
    "dls-button-secondary inline-flex min-h-14 w-full items-center justify-center rounded-xl px-4 py-3"
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  )
}

export function Card({
  children,
  className,
  ...props
}: {
  children: React.ReactNode
  className?: string
} & React.ComponentProps<"div">) {
  return (
    <div className={cn("dls-card p-4", className)} {...props}>
      {children}
    </div>
  )
}

export function TopNav({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon src={DLS.assets.logo} alt="logo" size={24} />
        <span className="text-lg font-semibold">{title}</span>
      </div>
      <div className="flex items-center gap-4 text-sm font-semibold">
        <Link href="/play">Play</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <a href="#how-to-play">How to Play</a>
      </div>
    </div>
  )
}
