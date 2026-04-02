import styles from './Badge.module.css';

interface BadgeProps {
  text: string;
}

export function Badge({ text }: BadgeProps) {
  return <span className={styles.badge}>{text}</span>;
}
