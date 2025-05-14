import { UserTokenManager } from '@/features/user-tokens';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const UserTokensPage: NextPageWithLayout = () => {
  return <UserTokenManager />;
};

UserTokensPage.getLayout = function getLayout(page: React.ReactElement) {
  return <MainLayout backgroundColor="grey">{page}</MainLayout>;
};

export default UserTokensPage;
