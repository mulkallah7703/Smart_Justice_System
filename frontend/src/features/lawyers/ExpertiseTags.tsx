import styles from './ExpertiseTags.module.css';

interface ExpertiseTagsProps {
  title: string;
  tags: string[];
}

const ExpertiseTags = ({ title, tags }: ExpertiseTagsProps): JSX.Element => {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.tags}>
        {tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
};

export default ExpertiseTags;
