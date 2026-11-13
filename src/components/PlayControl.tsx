import { Popover } from './Popover';
import type { GuitarRhythm, JamFeel } from '../lib/audio/jamSchedule';
import type { ScaleAnchor } from '../lib/audio/pitch';
import {
  playMenuOptions,
  type Articulation,
  type PlayDirection,
  type PlayLadder,
  type PlayMode,
  type PlayOptionId,
  type PlayOptions,
  type PlayReach,
} from '../lib/audio/playOptions';
import glass from '../styles/glass.module.css';
import styles from './PlayControl.module.css';

export interface PlayControlProps {
  mode: PlayMode;
  playing: boolean;
  loading: boolean;
  /** Nothing to play, or the sound is muted. */
  disabled: boolean;
  disabledReason?: string;
  tempo: number;
  options: PlayOptions;
  onOptionsChange: (patch: Partial<PlayOptions>) => void;
  scaleAnchor: ScaleAnchor;
  onScaleAnchorChange: (anchor: ScaleAnchor) => void;
  /** More than one position box: a scale run can cross the whole neck. */
  canCrossNeck: boolean;
  onToggle: () => void;
  /** The tempo readout opens Settings at Tempo. */
  onOpenTempo: () => void;
}

interface Choice<T extends string> {
  id: T;
  label: string;
  title?: string;
}

const DIRECTIONS: Choice<PlayDirection>[] = [
  { id: 'up', label: 'Up' },
  { id: 'down', label: 'Down' },
  { id: 'updown', label: 'Up and down' },
];
const ANCHORS: Choice<ScaleAnchor>[] = [
  { id: 'root', label: 'Root', title: 'Runs start and end on the root' },
  { id: 'third', label: '3rd', title: 'Runs start and end on the 3rd' },
  { id: 'fifth', label: '5th', title: 'Runs start and end on the 5th' },
];
const ARTICULATIONS: Choice<Articulation>[] = [
  { id: 'strum', label: 'Strum', title: 'All the notes together' },
  { id: 'arpeggio', label: 'Arpeggio', title: 'One note after another' },
];
const REACHES: Choice<PlayReach>[] = [
  { id: 'position', label: 'This position' },
  { id: 'neck', label: 'Whole neck', title: 'Every position in turn, up or down the neck' },
];
const LADDERS: Choice<PlayLadder>[] = [
  { id: 'off', label: 'In place' },
  { id: 'up', label: 'Up the neck', title: 'Each chord a position higher' },
  { id: 'down', label: 'Down the neck', title: 'Each chord a position lower' },
];

const GUITARS: Choice<GuitarRhythm>[] = [
  { id: 'off', label: 'Off', title: 'No guitar chords' },
  { id: 'whole', label: 'Whole', title: 'One strum, left to ring through the bar' },
  { id: 'half', label: 'Half', title: 'A strum on beats 1 and 3' },
  { id: 'quarter', label: 'Quarter', title: 'A strum on every beat' },
];
const SWING_HINT = 'Swing adds a bass pickup into each bar, and swung up-strums on quarters.';
const FEELS: Choice<JamFeel>[] = [
  { id: 'straight', label: 'Straight', title: 'Even beats' },
  { id: 'swing', label: 'Swing', title: SWING_HINT },
];

const TITLES: Record<PlayOptionId, string> = {
  guitar: 'Guitar',
  pad: 'Pad',
  feel: 'Feel',
  click: 'Click',
  jamLoop: 'Loop',
  direction: 'Direction',
  anchor: 'Start on',
  articulation: 'Play chords as',
  reach: 'Reach',
  ladder: 'Move along the neck',
  loop: 'Loop',
};

function Choices<T extends string>({
  title,
  hint,
  choices,
  value,
  onChange,
}: {
  title: string;
  hint?: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={title} title={hint}>
      <span className={styles.groupTitle}>{title}</span>
      <div className={styles.choices}>
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={value === choice.id}
            title={choice.title}
            className={value === choice.id ? glass.pillSelected : glass.pill}
            onClick={() => onChange(choice.id)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  title,
  hint,
  on,
  onChange,
}: {
  title: string;
  hint?: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className={styles.group}>
      <span className={styles.groupTitle}>{title}</span>
      <button
        type="button"
        className={on ? glass.pillSelected : glass.pill}
        aria-pressed={on}
        title={hint}
        onClick={() => onChange(!on)}
      >
        {on ? 'On' : 'Off'}
      </button>
    </div>
  );
}

type PlayMenuProps = Pick<
  PlayControlProps,
  | 'mode'
  | 'options'
  | 'onOptionsChange'
  | 'scaleAnchor'
  | 'onScaleAnchorChange'
  | 'canCrossNeck'
>;

/** The options that apply in this mode (see `playMenuOptions`), nothing else. */
export function PlayMenu({
  mode,
  options,
  onOptionsChange,
  scaleAnchor,
  onScaleAnchorChange,
  canCrossNeck,
}: PlayMenuProps) {
  const menu = playMenuOptions(mode, {
    articulation: options.articulation,
    canCrossNeck,
  });
  return (
    <div className={styles.menu}>
      {menu.map((id) => {
        switch (id) {
          case 'direction':
            return (
              <Choices
                key={id}
                title={TITLES[id]}
                choices={DIRECTIONS}
                value={options.direction}
                onChange={(direction) => onOptionsChange({ direction })}
              />
            );
          case 'anchor':
            return (
              <Choices
                key={id}
                title={TITLES[id]}
                choices={ANCHORS}
                value={scaleAnchor}
                onChange={onScaleAnchorChange}
              />
            );
          case 'articulation':
            return (
              <Choices
                key={id}
                title={TITLES[id]}
                choices={ARTICULATIONS}
                value={options.articulation}
                onChange={(articulation) => onOptionsChange({ articulation })}
              />
            );
          case 'reach':
            return (
              <Choices
                key={id}
                title={TITLES[id]}
                choices={REACHES}
                value={options.reach}
                onChange={(reach) => onOptionsChange({ reach })}
              />
            );
          case 'ladder':
            return (
              <Choices
                key={id}
                title={TITLES[id]}
                choices={LADDERS}
                value={options.ladder}
                onChange={(ladder) => onOptionsChange({ ladder })}
              />
            );
          case 'guitar':
            return (
              <Choices
                key={id}
                title={TITLES[id]}
                choices={GUITARS}
                value={options.guitar}
                onChange={(guitar) => onOptionsChange({ guitar })}
              />
            );
          case 'pad':
            return (
              <Toggle
                key={id}
                title={TITLES[id]}
                hint="A soft pad holds each chord for the bar, under the guitar or alone."
                on={options.pad}
                onChange={(pad) => onOptionsChange({ pad })}
              />
            );
          case 'feel':
            return (
              <Choices
                key={id}
                title={TITLES[id]}
                hint={SWING_HINT}
                choices={FEELS}
                value={options.feel}
                onChange={(feel) => onOptionsChange({ feel })}
              />
            );
          case 'click':
            return (
              <Toggle
                key={id}
                title={TITLES[id]}
                hint="A click on every beat. The count-in always clicks."
                on={options.click}
                onChange={(click) => onOptionsChange({ click })}
              />
            );
          case 'jamLoop':
            return (
              <Toggle
                key={id}
                title={TITLES[id]}
                hint="Off plays the progression once and stops."
                on={options.jamLoop}
                onChange={(jamLoop) => onOptionsChange({ jamLoop })}
              />
            );
          case 'loop':
            return (
              <Toggle
                key={id}
                title={TITLES[id]}
                on={options.loop}
                onChange={(loop) => onOptionsChange({ loop })}
              />
            );
        }
      })}
    </div>
  );
}

/**
 * Play and Stop, a small menu of only the options that apply in this mode,
 * and the tempo, which opens Settings. Space plays and stops too.
 */
export function PlayControl({
  mode,
  playing,
  loading,
  disabled,
  disabledReason,
  tempo,
  options,
  onOptionsChange,
  scaleAnchor,
  onScaleAnchorChange,
  canCrossNeck,
  onToggle,
  onOpenTempo,
}: PlayControlProps) {
  const label = playing ? 'Stop' : loading ? 'Loading…' : 'Play';

  return (
    <div className={styles.control} role="group" aria-label="Playback">
      <button
        type="button"
        className={playing ? styles.stop : styles.play}
        disabled={disabled && !playing}
        title={
          disabled && !playing
            ? disabledReason
            : playing
              ? 'Stop (Space)'
              : 'Play (Space)'
        }
        onClick={onToggle}
      >
        {label}
      </button>
      <Popover
        label="Play options"
        buttonLabel="Play options"
        buttonClassName={styles.menuButton}
        align="start"
        above
        button={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
            <circle cx="15" cy="7" r="2" />
            <circle cx="9" cy="17" r="2" />
          </svg>
        }
      >
        {() => (
          <PlayMenu
            mode={mode}
            options={options}
            onOptionsChange={onOptionsChange}
            scaleAnchor={scaleAnchor}
            onScaleAnchorChange={onScaleAnchorChange}
            canCrossNeck={canCrossNeck}
          />
        )}
      </Popover>
      <button
        type="button"
        className={styles.tempo}
        aria-label={`Tempo ${tempo} beats per minute. Open Settings`}
        title="Change the tempo in Settings"
        onClick={onOpenTempo}
      >
        {tempo} <span className={styles.bpm}>BPM</span>
      </button>
    </div>
  );
}
