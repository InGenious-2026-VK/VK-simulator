import logoUrl from '../assets/foodchainiq-logo.png';

/** The FoodChainIQ logo (tree mark + wordmark). Size it with CSS height. */
export default function Logo({ className = 'fciq-logo' }) {
  return <img src={logoUrl} alt="FoodChainIQ" className={className} width="757" height="120" />;
}
