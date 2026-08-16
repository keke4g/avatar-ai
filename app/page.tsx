import type { Metadata } from 'next';
import HomeExperience from "../components/home/HomeExperience";

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: '/' },
};

export default function Home() {
  return <HomeExperience />;
}
