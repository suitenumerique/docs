import { useRouter } from 'next/router';

import { HOME_URL } from '@/features/auth';

const Page = () => {
  const { replace } = useRouter();
  void replace(HOME_URL);
};

export default Page;
