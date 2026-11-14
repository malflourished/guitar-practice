import { useMemo, useState, type ReactNode } from 'react';
import type {
  KeyMode,
  NoteName,
  TheoryDiagram,
  TheoryTopic,
} from '../types/music';
import { describeKeyDial, type KeyDialInfo } from '../lib/music/keyDial';
import { neckCaption } from '../lib/music/neckChordMap';
import { KeyDial } from './KeyDial';
import { KeyNeck } from './KeyNeck';
import styles from './TheoryStage.module.css';

const DIAGRAM_OPTIONS: { id: TheoryDiagram; label: string }[] = [
  { id: 'in-key', label: 'In key' },
  { id: 'borrowed', label: 'Borrowed' },
  { id: 'dominants', label: 'Dominants' },
];

/**
 * Every caption the stage can show for this key: the dial's and the neck's, in
 * all three views. They are laid out unseen under the caption, so its box is
 * always as tall as the tallest and the title, pills and switch beside the
 * figure never move when the view or the figure changes.
 */
function allCaptions(info: KeyDialInfo): string[][] {
  return DIAGRAM_OPTIONS.flatMap(({ id }) => {
    const shown = id === info.state.view ? info : describeKeyDial({ ...info.state, view: id });
    return [[...shown.caption], neckCaption(shown)];
  });
}

interface TheoryStageProps {
  topic: TheoryTopic;
  selectedRoot: NoteName;
  keyMode: KeyMode;
  /** The diagram shown, if the topic has one. */
  diagramView?: TheoryDiagram;
  /** Draw the key's chords on the vertical neck, in the dial's place. */
  neckShown?: boolean;
  onSelectKey: (root: NoteName, mode: KeyMode) => void;
  /** The theory controls, shown under the caption when the dial has the deck's space. */
  controls?: ReactNode;
}

/**
 * The topic's title, summary and diagram: what Theory shows in the neck. The
 * dial and the vertical neck share one square; the words, the view pills and
 * the controls stay where they are while the figure swaps (see the motion in
 * TheoryStage.module.css), and the caption follows the figure.
 */
export function TheoryStage({
  topic,
  selectedRoot,
  keyMode,
  diagramView,
  neckShown = false,
  onSelectKey,
  controls,
}: TheoryStageProps) {
  // What the dial shows, as it tells us: the neck draws the same chords.
  const [info, setInfo] = useState<KeyDialInfo | null>(null);
  const neck = Boolean(diagramView) && neckShown;
  const caption = info ? (neck ? neckCaption(info) : info.caption) : [];
  const reserve = useMemo(() => (info ? allCaptions(info) : []), [info]);
  return (
    <section
      className={diagramView ? styles.stageWithDial : styles.stage}
      aria-label={topic.title}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>{topic.title}</h2>
        <p className={styles.summary}>{topic.theory.summary}</p>
        {diagramView ? (
          <div className={styles.caption}>
            <div className={styles.captionNow}>
              {caption.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            {reserve.map((lines) => (
              <div key={lines[0]} className={styles.captionReserve} aria-hidden="true">
                {lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ))}
          </div>
        ) : null}
        {diagramView && controls ? (
          <div className={styles.controls}>{controls}</div>
        ) : null}
      </header>

      {diagramView ? (
        <div className={styles.diagram}>
          <div className={styles.layer} data-layer="dial" data-active={!neck} inert={neck}>
            <KeyDial
              selectedRoot={selectedRoot}
              keyMode={keyMode}
              onSelectKey={onSelectKey}
              view={diagramView}
              onInfo={setInfo}
            />
          </div>
          <div className={styles.layer} data-layer="neck" data-active={neck} inert={!neck}>
            <KeyNeck info={info} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

interface TheoryActionsProps {
  topic: TheoryTopic;
  diagramView?: TheoryDiagram;
  onDiagramViewChange: (view: TheoryDiagram) => void;
  /** Neck chosen: the vertical neck in the dial's place, or the fretboard demo where there is no dial. */
  showFretboard: boolean;
  onShowFretboardChange: (show: boolean) => void;
  onPracticeLink?: () => void;
}

/** Theory's controls: diagram choice, Dial | Neck (or the fretboard demo), practice link. */
export function TheoryActions({
  topic,
  diagramView,
  onDiagramViewChange,
  showFretboard,
  onShowFretboardChange,
  onPracticeLink,
}: TheoryActionsProps) {
  const practiceLabel =
    topic.practiceLink?.mode === 'progressions'
      ? 'Try in Progressions →'
      : topic.practiceLink?.mode === 'scales'
        ? 'Practice this across the neck →'
        : topic.practiceLink?.mode === 'chords'
          ? 'Try in Chords →'
          : topic.practiceLink?.mode === 'intervals'
            ? 'Train your ear & eye →'
            : null;

  return (
    <>
      {diagramView ? (
        <div className={styles.diagramToggle} role="group" aria-label="Diagram">
          {DIAGRAM_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={
                diagramView === id
                  ? styles.diagramToggleSelected
                  : styles.diagramToggleButton
              }
              aria-pressed={diagramView === id}
              onClick={() => onDiagramViewChange(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.actions}>
        {diagramView ? (
          <div className={styles.viewSwitch} role="group" aria-label="Show on">
            {(
              [
                { neck: false, label: 'Dial' },
                { neck: true, label: 'Neck' },
              ] as const
            ).map(({ neck, label }) => (
              <button
                key={label}
                type="button"
                className={
                  showFretboard === neck
                    ? styles.viewSwitchSelected
                    : styles.viewSwitchButton
                }
                aria-pressed={showFretboard === neck}
                onClick={() => {
                  if (showFretboard !== neck) onShowFretboardChange(neck);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : topic.fretboardDemo ? (
          <button
            type="button"
            className={
              showFretboard ? styles.actionButtonSelected : styles.actionButton
            }
            aria-pressed={showFretboard}
            onClick={() => onShowFretboardChange(!showFretboard)}
          >
            {showFretboard ? 'Hide fretboard' : 'Show on fretboard'}
          </button>
        ) : null}
        {practiceLabel && onPracticeLink ? (
          <button
            type="button"
            className={styles.actionButton}
            onClick={onPracticeLink}
          >
            {practiceLabel}
          </button>
        ) : null}
      </div>
    </>
  );
}
