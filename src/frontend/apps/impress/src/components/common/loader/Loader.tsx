import styles from './loader.module.scss';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Loader = ({ size = 'sm' }: LoaderProps) => {
  return <div className={[styles.loader, styles[size]].join(' ')} />;
};
