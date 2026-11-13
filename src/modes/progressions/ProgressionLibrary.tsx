import { useState } from 'react';
import {
  getProgressionLibraryGroups,
  type ProgressionLibraryEntry,
} from '../../lib/music';
import styles from './ProgressionLibrary.module.css';

interface ProgressionLibraryProps {
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * The library's table of contents: five groups, one open at a time (the active
 * entry's group until the player opens another), each entry a row.
 */
export function ProgressionLibrary({
  activeId,
  onSelect,
}: ProgressionLibraryProps) {
  const groups = getProgressionLibraryGroups();
  const activeGroup = groups.find(({ entries }) =>
    entries.some((entry) => entry.id === activeId),
  )?.group;
  // null follows the active entry (so the deck's picker opens the right group);
  // '' keeps every group shut, as after choosing an entry.
  const [chosenGroup, setChosenGroup] = useState<string | null>(null);
  const openGroup = chosenGroup ?? activeGroup;

  return (
    <div className={styles.library}>
      {groups.map(({ group, entries }) => {
        const open = group === openGroup;
        return (
          <div key={group} className={styles.group}>
            <button
              type="button"
              className={styles.groupHeader}
              aria-expanded={open}
              onClick={() => setChosenGroup(open ? '' : group)}
            >
              <span>{group}</span>
              <span className={styles.groupCount}>
                {!open && group === activeGroup
                  ? (entries.find((entry) => entry.id === activeId)?.title ??
                    '')
                  : entries.length}
              </span>
            </button>
            {open && (
              <ul className={styles.entries}>
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className={
                        entry.id === activeId
                          ? styles.entrySelected
                          : styles.entry
                      }
                      aria-pressed={entry.id === activeId}
                      onClick={() => {
                        // Shut the list so the entry's notes and chords come up
                        // into view; its group header names it.
                        setChosenGroup('');
                        onSelect(entry.id);
                      }}
                    >
                      <span className={styles.entryTitle}>{entry.title}</span>
                      <span className={styles.entryName}>{entry.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The chosen entry: what it is, why it is interesting, and what to aim for. */
export function ProgressionNotes({
  entry,
}: {
  entry: ProgressionLibraryEntry;
}) {
  const facts: [string, string | undefined][] = [
    ['Why', entry.why],
    ['Aim for', entry.aim],
    ['Sound', entry.sound],
    ['Heard in', entry.heard],
  ];
  return (
    <div className={styles.notes}>
      <p className={styles.notesTitle}>{entry.title}</p>
      <p className={styles.notesName}>{entry.name}</p>
      <dl className={styles.facts}>
        {facts.map(([label, text]) =>
          text ? (
            <div key={label} className={styles.fact}>
              <dt className={styles.factLabel}>{label}</dt>
              <dd className={styles.factText}>{text}</dd>
            </div>
          ) : null,
        )}
      </dl>
    </div>
  );
}
