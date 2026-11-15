import {
  CHORD_GUIDE,
  CHORD_MENU_GROUPS,
  TRIAD_STRING_SETS,
  getChordQualityLabel,
  isTriadQuality,
  type ChordVoicing,
  type NotationPreference,
} from '../../lib/music';
import type { ChordQuality, NoteName } from '../../types/music';
import { chordCaption } from '../captions';
import { ModeCaption, ModePicker, PillSwitch, type PickerGroup } from '../ModePicker';
import type { ChordsState } from './useChordsState';

const CHORD_ROWS: PickerGroup<ChordQuality>[][] = CHORD_MENU_GROUPS.map((group) => [
  {
    label: group.label,
    items: group.qualities.map((quality) => ({
      id: quality,
      label: CHORD_GUIDE[quality].symbol,
      title: `${getChordQualityLabel(quality)}: ${CHORD_GUIDE[quality].formula}. ${CHORD_GUIDE[quality].sound}`,
    })),
  },
]);

interface ChordsControlsProps {
  rootNote: NoteName;
  notation: NotationPreference;
  chordQuality: ChordQuality;
  onChordQualityChange: (quality: ChordQuality) => void;
}

/** Chords deck: the Chord menu (triads, sevenths, extended) and one line on the chord chosen. */
export function ChordsControls({
  rootNote,
  notation,
  chordQuality,
  onChordQualityChange,
}: ChordsControlsProps) {
  return (
    <>
      <ModePicker
        label="Chord"
        rows={CHORD_ROWS}
        value={chordQuality}
        onChange={onChordQualityChange}
        symbols
      />
      <ModeCaption {...chordCaption(rootNote, chordQuality, notation)} />
    </>
  );
}

const VOICINGS: { id: ChordVoicing; label: string; title: string }[] = [
  { id: 'shapes', label: 'Shapes', title: 'The full chord shapes up the neck: C, A, G, E and D' },
  {
    id: 'triads',
    label: 'Triads',
    title: 'Three notes on three neighbouring strings: root position and both inversions',
  },
];

type ChordsOptionsProps = Pick<
  ChordsState,
  'chordQuality' | 'chordVoicing' | 'setChordVoicing' | 'triadStrings' | 'setTriadStrings' | 'triadsShown'
>;

/** Chords deck, last row: full shapes or small triads, and which three strings. */
export function ChordsOptions({
  chordQuality,
  chordVoicing,
  setChordVoicing,
  triadStrings,
  setTriadStrings,
  triadsShown,
}: ChordsOptionsProps) {
  const hasTriads = isTriadQuality(chordQuality);
  return (
    <>
      <PillSwitch
        label="Voicing"
        choices={VOICINGS.map((voicing) =>
          voicing.id === 'triads' && !hasTriads
            ? {
                ...voicing,
                disabled: true,
                title: 'Small triads are major, minor, diminished and augmented',
              }
            : voicing,
        )}
        value={triadsShown ? 'triads' : hasTriads ? chordVoicing : 'shapes'}
        onChange={setChordVoicing}
      />
      {triadsShown && (
        <PillSwitch
          label="Strings"
          choices={TRIAD_STRING_SETS.map((set) => ({
            id: set.id,
            label: set.label,
            title: `The ${set.label} strings`,
          }))}
          value={triadStrings}
          onChange={setTriadStrings}
          symbols
        />
      )}
    </>
  );
}
