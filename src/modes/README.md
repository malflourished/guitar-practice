# Modes

One folder per study mode. The pattern is the same everywhere:

- `<Mode>Controls.tsx`: the mode's own controls, the first row of the deck.
  (Notes, Chords, Scales, Progressions, Theory.)
- `<Mode>Panel.tsx`: the side panel. It takes the "This key" section as a
  `keyContext` prop and shows it first, then the mode's own sections.
  (Chords, Scales, Progressions, Theory, Intervals. Notes has no panel.)
- `use<Mode>State.ts`: the mode's state, with the same saved keys as before.
  (Chords, Scales, Progressions, Theory.)

Practice and Intervals draw their own neck and deck inside `PracticeSession`
and `IntervalTrainer`, so App wires those in whole. Intervals only adds its
panel here.

Shared across modes:

- `src/hooks/`: `useKeyState` (key, notation), `useDisplaySettings` (dots,
  colours), `useNeckPosition` (position boxes, neck view), `useBoardData`
  (what the fretboard draws), `usePlayback` (tempo and every play button),
  `useFrameState` (focus, side panel), `useAppTheme` (theme, background).
- `ModeDeck` is the deck every neck mode shares (controls, transport, sound).
- `KeyContextSection` is "This key", and `useStudyModeSwitch` carries the key
  across when the mode changes.
- `src/styleOrder.ts` pins the order stylesheets load in. Read it before
  moving a component's imports.

`App.tsx` builds the states, passes them to these pieces and fills the
`Frame` slots (strip, neck, deck, body, panel; settings and home are empty).
