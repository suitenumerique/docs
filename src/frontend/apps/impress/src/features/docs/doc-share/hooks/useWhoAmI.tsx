import { useAuth } from '@/features/auth';
import { Access, Role } from '@/features/docs/doc-management';

export const useWhoAmI = (access: Access) => {
  const { user } = useAuth();

  const isMyself = user?.id === access.user.id;
  const rolesAllowed = access.abilities.set_role_to;

  const isLastOwner =
    !rolesAllowed.length && access.role === Role.OWNER && isMyself;

  const isOtherOwner = access.role === Role.OWNER && user?.id && !isMyself;

  return {
    isLastOwner,
    isOtherOwner,
    isMyself,
  };
};
