import { Access, Role } from '@/docs/doc-management';
import { useAuth } from '@/features/auth';

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
