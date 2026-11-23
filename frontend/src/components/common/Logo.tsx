import React from 'react';
import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
  asLink?: boolean;
  variant?: 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
  asLink = true,
  variant = 'light',
}) => {
  const sizeConfig = {
    sm: {
      badgeSize: 'w-8 h-8',
      badgePx: 32,
      svgSize: 20,
      titleSize: 'text-lg',
      subtitleSize: 'text-[9px] tracking-[0.2em]',
      gap: 'gap-2',
    },
    md: {
      badgeSize: 'w-10 h-10',
      badgePx: 40,
      svgSize: 24,
      titleSize: 'text-xl',
      subtitleSize: 'text-[10px] tracking-[0.25em]',
      gap: 'gap-2.5',
    },
    lg: {
      badgeSize: 'w-12 h-12',
      badgePx: 48,
      svgSize: 30,
      titleSize: 'text-2xl',
      subtitleSize: 'text-xs tracking-[0.3em]',
      gap: 'gap-3',
    },
  }[size];

  const content = (
    <div className={`inline-flex items-center ${sizeConfig.gap} select-none ${className}`}>
      {/* Geometrik Rozet */}
      <div
        className={`${sizeConfig.badgeSize} rounded-xl bg-[#0F172A] p-1.5 flex items-center justify-center shadow-md shadow-slate-900/10 border border-slate-800/80 shrink-0 transition-transform hover:scale-105`}
        style={{
          width: sizeConfig.badgePx,
          height: sizeConfig.badgePx,
          minWidth: sizeConfig.badgePx,
          minHeight: sizeConfig.badgePx,
        }}
      >
        <svg
          width={sizeConfig.svgSize}
          height={sizeConfig.svgSize}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          style={{
            width: sizeConfig.svgSize,
            height: sizeConfig.svgSize,
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          aria-hidden="true"
        >
          {/* E Harfi: Beyaz ve modern köşeli hatlar */}
          <path
            d="M6 8H15M6 16H13M6 24H15"
            stroke="#F8FAFC"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 8V24"
            stroke="#F8FAFC"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* A Harfi: Dinamik eğik çizgiler, yatay köprü Kurumsal Mavi (#2563EB) */}
          <path
            d="M17 24L21.5 8L26 24"
            stroke="#F8FAFC"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19 18.5H24"
            stroke="#2563EB"
            strokeWidth="2.7"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Marka Tipografisi */}
      <div className="flex flex-col leading-none">
        <div className={`font-black tracking-tight ${sizeConfig.titleSize}`}>
          <span className="text-[#2563EB]">EA</span>
          <span className={variant === 'dark' ? 'text-white' : 'text-[#0F172A]'}>raç</span>
        </div>
        {showSubtitle && (
          <span className={`font-semibold uppercase ${sizeConfig.subtitleSize} mt-0.5 ${variant === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Kiralama
          </span>
        )}
      </div>
    </div>
  );

  if (asLink) {
    return (
      <Link href="/" className="inline-flex focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
};
