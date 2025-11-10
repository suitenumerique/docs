import { Role } from '@/docs/doc-management';
import { User } from '@/features/auth';

export interface Invitation {
  id: string;
  role: Role;
  document: string;
  created_at: string;
  is_expired: boolean;
  issuer: string;
  email: string;
  abilities: {
    destroy: boolean;
    retrieve: boolean;
    partial_update: boolean;
    update: boolean;
  };
}

/**
 * Type guard to check if an object is an Invitation
 * Invitation has unique properties: email, issuer, is_expired, and document as a string
 */
export const isInvitation = (obj: unknown): obj is Invitation => {
  return obj !== null && typeof obj === 'object' && 'issuer' in obj;
};

export enum OptionType {
  INVITATION = 'invitation',
  NEW_MEMBER = 'new_member',
}

export const isOptionNewMember = (
  data: OptionSelect,
): data is OptionNewMember => {
  return 'id' in data.value;
};

export interface OptionInvitation {
  value: { email: string };
  label: string;
  type: OptionType.INVITATION;
}

export interface OptionNewMember {
  value: User;
  label: string;
  type: OptionType.NEW_MEMBER;
}

export type OptionSelect = OptionNewMember | OptionInvitation;
