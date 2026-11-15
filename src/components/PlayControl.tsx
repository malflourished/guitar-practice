import { Popover } from './Popover';
import type { GuitarHold, JamFeel } from '../lib/audio/jamSchedule';
import type { ScaleAnchor } from '../lib/audio/pitch';
import {
  playMenuOptions,
  type Articulation,
  type PlayDirection,
  type PlayLadder,
  type PlayMode,
  type PlayOptionId,
  type PlayOptions,
  type PlayPrompts,
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
const LADDER_NOTE = 'Each pass stays in one stretch of the neck, then moves on.';
const LADDER_HINT =
  'Each pass of the form is played in one stretch of the neck, and the stretch moves between passes. The same chord higher up is nearly the same notes, so the point is where your hand goes.';
const LADDERS: Choice<PlayLadder>[] = [
  { id: 'off', label: 'In place' },
  { id: 'up', label: 'Up the neck', title: 'Each pass a region higher, then back down' },
  { id: 'down', label: 'Down the neck', title: 'From the top, each pass a region lower, then back up' },
];

const GUITARS: Choice<GuitarHold>[] = [
  { id: 'whole', label: 'Whole', title: 'One strum, left to ring through the bar' },
  { id: 'half', label: 'Half', title: 'A strum on beats 1 and 3' },
  { id: 'quarter', label: 'Quarter', title: 'A strum on every beat' },
];
const SWING_HINT = 'Swing adds a bass pickup into each bar, and swung up-strums on quarters.';
const FEELS: Choice<JamFeel>[] = [
  { id: 'straight', label: 'Straight', title: 'Even beats' },
  { id: 'swing', label: 'Swing', title: SWING_HINT },
];

const TARGETS_HINT = 'Rings on the neck show where to land on the next chord.';
const PROMPTS_HINT = 'One thing to try each time round the form.';
const PROMPTS: Choice<PlayPrompts>[] = [
  { id: 'off', label: 'Off' },
  { id: 'rotate', label: 'Rotate', title: 'A new prompt when the last has had eight bars or more' },
  { id: 'hold', label: 'Hold', title: 'Keep the prompt shown. Click the prompt for the next one' },
];

/** Short groups that share a row, so the Progressions menu is no taller for having them. */
const ROW_PAIRS: Partial<Record<PlayOptionId, PlayOptionId>> = {
  click: 'jamLoop',
  targets: 'prompts',
};

const TITLES: Record<PlayOptionId, string> = {
  guitar: 'Guitar',
  feel: 'Feel',
  click: 'Click',
  jamLoop: 'Loop',
  direction: 'Direction',
  anchor: 'Start on',
  articulation: 'Play chords as',
  reach: 'Reach',
  ladder: 'Move along the neck',
  loop: 'Loop',
  targets: 'Targets',
  prompts: 'Prompts',
};

function Choices<T extends string>({
  title,
  hint,
  note,
  choices,
  value,
  onChange,
}: {
  title: string;
  hint?: string;
  /** One line under the title that says what the group does. */
  note?: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={title} title={hint}>
      <span className={styles.groupTitle}>{title}</span>
      {note && <span className={styles.groupNote}>{note}</span>}
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
  const renderOption = (id: PlayOptionId) => {
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
                hint={LADDER_HINT}
                note={LADDER_NOTE}
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
          case 'targets':
            return (
              <Toggle
                key={id}
                title={TITLES[id]}
                hint={TARGETS_HINT}
                on={options.targets}
                onChange={(targets) => onOptionsChange({ targets })}
              />
            );
          case 'prompts':
            return (
              <Choices
                key={id}
                title={TITLES[id]}
                hint={PROMPTS_HINT}
                choices={PROMPTS}
                value={options.prompts}
                onChange={(prompts) => onOptionsChange({ prompts })}
              />
            );
        }
  };
  // the second of each pair is drawn beside the first, not on its own row
  const second = new Set(menu.flatMap((id) => (ROW_PAIRS[id] ? [ROW_PAIRS[id]] : [])));
  return (
    <div className={styles.menu}>
      {menu.map((id) => {
        if (second.has(id)) return null;
        const partner = ROW_PAIRS[id];
        if (partner && menu.includes(partner)) {
          return (
            <div key={id} className={styles.pair}>
              {renderOption(id)}
              {renderOption(partner)}
            </div>
          );
        }
        return renderOption(id);
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
