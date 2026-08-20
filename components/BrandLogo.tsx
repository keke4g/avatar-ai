import Image from 'next/image';

type BrandLogoProps = {
  inverted?: boolean;
  compact?: boolean;
  className?: string;
  markClassName?: string;
  textClassName?: string;
  priority?: boolean;
};

export default function BrandLogo({
  inverted = false,
  compact = false,
  className = '',
  markClassName = '',
  textClassName = '',
  priority = false,
}: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 leading-none ${className}`}>
      <span className={`relative block h-9 w-9 shrink-0 ${markClassName}`}>
        <Image
          src={inverted ? '/towers-mexico-logo-white.png' : '/towers-mexico-logo-blue.png'}
          alt=""
          fill
          sizes="40px"
          priority={priority}
          className="object-contain"
        />
      </span>
      {!compact && (
        <span
          className={`whitespace-nowrap text-[17px] font-extrabold leading-none tracking-[-0.035em] ${
            inverted ? 'text-white' : 'text-slate-950'
          } ${textClassName}`}
        >
          Towers <span className={inverted ? 'text-white/72' : 'text-[#0a77a8]'}>México</span>
        </span>
      )}
    </span>
  );
}
