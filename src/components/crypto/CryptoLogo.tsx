import btcLogo from "../../assets/coins/btc.png";
import ethLogo from "../../assets/coins/eth.png";
import tonLogo from "../../assets/coins/ton.png";
import solLogo from "../../assets/coins/sol.png";
import bnbLogo from "../../assets/coins/bnb.png";
import apexLogo from "../../assets/coins/apex.png";
import mntLogo from "../../assets/coins/mnt.png";
import tiaLogo from "../../assets/coins/tia.png";
import usdtLogo from "../../assets/coins/usdt.png";
import spacexLogo from "../../assets/coins/spacex.png";
import { assetGlyph } from "../../lib/uiHelpers";

const importedCoinLogos: Record<string, { src: string; mode: "cover" | "contain"; imgClass?: string }> = {
  BTC: { src: btcLogo, mode: "contain", imgClass: "coin-image-btc" },
  ETH: { src: ethLogo, mode: "contain", imgClass: "coin-image-eth" },
  TON: { src: tonLogo, mode: "contain", imgClass: "coin-image-ton" },
  SOL: { src: solLogo, mode: "contain", imgClass: "coin-image-sol" },
  BNB: { src: bnbLogo, mode: "contain", imgClass: "coin-image-bnb" },
  TIA: { src: tiaLogo, mode: "contain", imgClass: "coin-image-tia" },
  MNT: { src: mntLogo, mode: "contain", imgClass: "coin-image-mnt" },
  APEX: { src: apexLogo, mode: "contain", imgClass: "coin-image-apex" },
  USDT: { src: usdtLogo, mode: "contain", imgClass: "coin-image-usdt" },
  SPCXB: { src: spacexLogo, mode: "cover", imgClass: "coin-image-spacex" },
  SPACEX: { src: spacexLogo, mode: "cover", imgClass: "coin-image-spacex" },
};

function UsdcSvg() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="#2775CA" />
      <circle cx="32" cy="32" r="25" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <text x="32" y="27" textAnchor="middle" fill="white" fontSize="13" fontWeight="800" fontFamily="Inter,system-ui,sans-serif" letterSpacing="0.5">USDC</text>
      <text x="32" y="43" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="16" fontWeight="900" fontFamily="Inter,system-ui,sans-serif">$</text>
    </svg>
  );
}

function AtomSvg() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="#1b1b2d" />
      {/* Orbital rings */}
      <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke="#6F4CFF" strokeWidth="2" opacity="0.85" />
      <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke="#6F4CFF" strokeWidth="2" opacity="0.85"
        transform="rotate(60 32 32)" />
      <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke="#6F4CFF" strokeWidth="2" opacity="0.85"
        transform="rotate(120 32 32)" />
      {/* Center nucleus */}
      <circle cx="32" cy="32" r="5" fill="#8B6FFF" />
      <circle cx="32" cy="32" r="3" fill="white" opacity="0.9" />
    </svg>
  );
}

export function CryptoLogo({ asset, className = "" }: { asset: string; className?: string }) {
  const wrap = `crypto-logo ${className}`.trim();

  if (asset === "BTC" || asset === "BTC LONG") {
    return (
      <div className={`${wrap} crypto-logo-image crypto-logo-image-contain coin-image-btc`.trim()} aria-label={asset}>
        <img src={btcLogo} alt={asset} className="crypto-logo-img" />
      </div>
    );
  }

  if (asset === "BTC SHORT") {
    return (
      <div className={`${wrap} crypto-logo-image crypto-logo-image-contain coin-image-btcshort`.trim()} aria-label={asset}>
        <img src={btcLogo} alt={asset} className="crypto-logo-img" />
      </div>
    );
  }

  if (asset === "GOLD LONG") {
    return (
      <div className={`${wrap} crypto-logo-gold`.trim()} aria-label={asset}>
        <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
          <circle cx="32" cy="32" r="32" fill="#02050A" />
          <path d="M13.5 40.5 23.8 20.5h16.4l10.3 20H13.5Z" fill="#F5C84C" />
          <path d="M23.8 20.5h16.4l6 10.8H17.8l6-10.8Z" fill="#FFD96A" />
          <path d="M18.6 31.3h27.8l4.1 9.2h-37l5.1-9.2Z" fill="#E0A91F" />
          <path d="M14.5 39.4h35" stroke="#9F6C00" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <path d="M23.8 20.5 18.6 31.3m21.6-10.8 6.2 10.8" stroke="#B9850A" strokeWidth="1.8" strokeLinecap="round" opacity="0.75" />
        </svg>
      </div>
    );
  }

  if (asset === "USDC" || asset === "USDC HL") {
    return (
      <div className={`${wrap} crypto-logo-svg`.trim()} aria-label={asset}>
        <UsdcSvg />
      </div>
    );
  }

  if (asset === "ATOM") {
    return (
      <div className={`${wrap} crypto-logo-svg`.trim()} aria-label={asset}>
        <AtomSvg />
      </div>
    );
  }

  const imported = importedCoinLogos[asset] ?? (asset === "MNT LONG" ? importedCoinLogos.MNT : undefined)
    ?? (asset === "USDT BNB" ? importedCoinLogos.USDT : undefined);
  if (imported) {
    return (
      <div
        className={`${wrap} crypto-logo-image crypto-logo-image-${imported.mode} ${imported.imgClass ?? ""}`.trim()}
        aria-label={asset}
      >
        <img src={imported.src} alt={asset} className="crypto-logo-img" />
      </div>
    );
  }

  return (
    <div className={wrap} aria-label={asset}>
      <span className="crypto-logo-fallback">{assetGlyph(asset)}</span>
    </div>
  );
}
