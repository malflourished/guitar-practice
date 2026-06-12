import {
  THEORY_SECTIONS,
  getTheoryTopicsBySection,
} from '../lib/music/theoryTopics';
import styles from './TheoryNavigator.module.css';

interface TheoryNavigatorProps {
  activeTopicId: string;
  onTopicChange: (topicId: string) => void;
}

export function TheoryNavigator({
  activeTopicId,
  onTopicChange,
}: TheoryNavigatorProps) {
  return (
    <div className={styles.sections} role="navigation" aria-label="Theory topics">
      {THEORY_SECTIONS.map((section) => {
        const topics = getTheoryTopicsBySection(section);
        return (
          <div key={section} className={styles.section}>
            <h3 className={styles.sectionTitle}>{section}</h3>
            <div className={styles.topics} role="group" aria-label={section}>
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className={
                    activeTopicId === topic.id
                      ? styles.topicButtonSelected
                      : styles.topicButton
                  }
                  aria-pressed={activeTopicId === topic.id}
                  onClick={() => onTopicChange(topic.id)}
                >
                  {topic.title}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
