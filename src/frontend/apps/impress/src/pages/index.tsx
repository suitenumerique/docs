import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/core';
import HomeContent from '@/features/home/components/HomeContent';

export default function Index() {
  const router = useRouter();
  const auth = useAuthStore();

  if (auth.userData) {
    const url = auth.getAuthUrl();
    if (url) {
      router.replace(url);
    }
    router.push('/docs/');
    return null;
  }

  return <HomeContent />;
}
