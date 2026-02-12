import Image from 'next/image';

export interface OnboardingStepImageProps {
  src: string;
  alt: string;
}

export const OnboardingStepImage = ({ src, alt }: OnboardingStepImageProps) => {
  return (
    <Image src={src} alt={alt} width={350} height={350} priority unoptimized />
  );
};
