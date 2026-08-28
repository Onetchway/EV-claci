import Hero from '@/components/Hero';
import SolutionsGrid from '@/components/SolutionsGrid';
import TechPlatform from '@/components/TechPlatform';
import NetworkMapIndia from '@/components/NetworkMapIndia';
import FranchiseTeaser from '@/components/FranchiseTeaser';
import ImpactStats from '@/components/ImpactStats';
import InsightsTeaser from '@/components/InsightsTeaser';

export default function HomePage() {
  return (
    <>
      <Hero />
      <SolutionsGrid />
      <TechPlatform />
      <div id="network">
        <NetworkMapIndia />
      </div>
      <FranchiseTeaser />
      <ImpactStats />
      <InsightsTeaser />
    </>
  );
}
