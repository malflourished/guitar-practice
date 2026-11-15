import {
  SCALE_GUIDE,
  SCALE_MENU_ROWS,
  SCALE_SYSTEM_LINE,
  getQualityLabel,
  type NotationPreference,
} from '../../lib/music';
import displayStyles from '../../components/DisplayToggles.module.css';
import type { NoteName, ScaleQuality, ScaleSystem } from '../../types/music';
import { scaleCaption } from '../captions';
import {
  DeckFootnote,
  ModeCaption,
  ModePicker,
  PillSwitch,
  type PickerGroup,
} from '../ModePicker';

const SCALE_ROWS: PickerGroup<ScaleQuality>[][] = SCALE_MENU_ROWS.map((row) =>
  row.map((group) => ({
    label: group.label,
    labelOptional: group.labelOptional,
    items: group.qualities.map((quality) => ({
      id: quality,
      label: SCALE_GUIDE[quality].short,
      title: `${getQualityLabel(quality)}: ${SCALE_GUIDE[quality].formula}. ${SCALE_GUIDE[quality].line}`,
    })),
  })),
);

interface ScalesControlsProps {
  rootNote: NoteName;
  notation: NotationPreference;
  scaleQuality: ScaleQuality;
  onScaleQualityChange: (quality: ScaleQuality) => void;
}

/** Scales deck: the Scale menu and one line on the scale chosen. */
export function ScalesControls({
  rootNote,
  notation,
  scaleQuality,
  onScaleQualityChange,
}: ScalesControlsProps) {
  return (
    <>
      <ModePicker
        label="Scale"
        rows={SCALE_ROWS}
        value={scaleQuality}
        onChange={onScaleQualityChange}
      />
      <ModeCaption {...scaleCaption(rootNote, scaleQuality, notation)} />
    </>
  );
}

const ONLY_ONE = 'Only major and minor are laid out both ways';

interface ScalesOptionsProps {
  scaleSystem: ScaleSystem;
  /** The layout on the neck now (a mode is always 3 per string, a pentatonic always boxes). */
  shownSystem: ScaleSystem;
  /** Major and minor have both layouts. */
  canSwitchSystem: boolean;
  onScaleSystemChange: (system: ScaleSystem) => void;
  rootLabel: string;
  droneOn: boolean;
  onDroneToggle: () => void;
}

/** Scales deck, last row: the System switch (CAGED first) and the drone. */
export function ScalesOptions({
  scaleSystem,
  shownSystem,
  canSwitchSystem,
  onScaleSystemChange,
  rootLabel,
  droneOn,
  onDroneToggle,
}: ScalesOptionsProps) {
  const shown = canSwitchSystem ? scaleSystem : shownSystem;
  return (
    <>
      <PillSwitch<ScaleSystem>
        label="System"
        choices={[
          {
            id: 'caged',
            label: 'CAGED',
            title: canSwitchSystem ? 'Five shapes tied to the chord shapes' : ONLY_ONE,
            disabled: !canSwitchSystem && shown !== 'caged',
          },
          {
            id: '3nps',
            label: '3 per string',
            title: canSwitchSystem ? 'Three notes on every string: seven positions' : ONLY_ONE,
            disabled: !canSwitchSystem && shown !== '3nps',
          },
        ]}
        value={shown}
        onChange={onScaleSystemChange}
      />
      <button
        type="button"
        className={droneOn ? displayStyles.fingersButtonActive : displayStyles.fingersButton}
        aria-pressed={droneOn}
        aria-label={`Drone on ${rootLabel}${droneOn ? ', sounding' : ''}`}
        title={`Hold ${rootLabel} underneath, so every note of the scale is heard against home`}
        onClick={onDroneToggle}
      >
        Drone {rootLabel}
      </button>
    </>
  );
}

/** The line under the System switch. */
export function ScalesFootnote() {
  return <DeckFootnote>{SCALE_SYSTEM_LINE}</DeckFootnote>;
}
