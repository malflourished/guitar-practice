import { describe, expect, it } from 'vitest';
import {
  HOME_CHOICES,
  continueLabel,
  escapeGoesHome,
  exploreTeaser,
  homeRoute,
  modeLabel,
  pickExploreProgression,
  type EscapeContext,
} from './home';
import { PROGRESSIONS, getProgressionById } from './music';
import { STUDY_MODES } from '../modes/studyModes';

describe('Home routing', () => {
  it('lands each choice in its mode', () => {
    expect(homeRoute('practice', 'blues-12')).toEqual({ mode: 'practice' });
    expect(homeRoute('learn', 'blues-12')).toEqual({ mode: 'theory' });
    expect(homeRoute('explore', 'jazz-251')).toEqual({
      mode: 'progressions',
      progressionId: 'jazz-251',
    });
  });

  it('offers Practice, Explore and Learn, each with one line', () => {
    expect(HOME_CHOICES.map((choice) => choice.id)).toEqual(['practice', 'explore', 'learn']);
    for (const choice of HOME_CHOICES) {
      expect(choice.blurb.length).toBeGreaterThan(10);
      expect(choice.blurb).not.toContain('\n');
    }
  });

  it('only ever lands in a mode the app has', () => {
    for (const choice of HOME_CHOICES) {
      expect(STUDY_MODES).toContain(homeRoute(choice.id, 'blues-12').mode);
    }
  });
});

describe('Continue', () => {
  it('names the last mode, whichever it was', () => {
    expect(continueLabel('scales')).toBe('Continue · Scales');
    expect(continueLabel('practice')).toBe('Continue · Practice');
    expect(continueLabel('progressions')).toBe('Continue · Progressions');
  });

  it('labels every mode as the mode tabs do', () => {
    expect(STUDY_MODES.map(modeLabel)).toEqual([
      'Practice',
      'Notes',
      'Chords',
      'Scales',
      'Progressions',
      'Intervals',
      'Theory',
    ]);
  });
});

describe('Explore', () => {
  it('picks from the progressions the app already has', () => {
    for (const random of [0, 0.25, 0.5, 0.75, 0.9999]) {
      const pick = pickExploreProgression(PROGRESSIONS, [], () => random);
      expect(getProgressionById(pick.id)).toBe(pick);
    }
  });

  it('can reach every progression, first to last', () => {
    expect(pickExploreProgression(PROGRESSIONS, [], () => 0)).toBe(PROGRESSIONS[0]);
    expect(pickExploreProgression(PROGRESSIONS, [], () => 0.9999)).toBe(
      PROGRESSIONS[PROGRESSIONS.length - 1],
    );
    // Even a random() that returns exactly 1 stays inside the list.
    expect(pickExploreProgression(PROGRESSIONS, [], () => 1)).toBe(
      PROGRESSIONS[PROGRESSIONS.length - 1],
    );
  });

  it('never offers the progression just played or the last one shown', () => {
    const [first, second] = PROGRESSIONS;
    for (let i = 0; i < 50; i += 1) {
      const pick = pickExploreProgression(PROGRESSIONS, [first.id, second.id], () => i / 50);
      expect([first.id, second.id]).not.toContain(pick.id);
    }
  });

  it('falls back to the whole list when everything is avoided', () => {
    const everything = PROGRESSIONS.map((p) => p.id);
    expect(pickExploreProgression(PROGRESSIONS, everything, () => 0)).toBe(PROGRESSIONS[0]);
  });

  it('shows the name and the numerals', () => {
    const blues = getProgressionById('blues-12');
    expect(blues).toBeDefined();
    expect(exploreTeaser(blues!)).toEqual({ name: '12-bar blues', numerals: 'I7 – IV7 – V7' });
  });
});

describe('Esc goes Home', () => {
  const base: EscapeContext = {
    key: 'Escape',
    defaultPrevented: false,
    modified: false,
    inField: false,
    overlayOpen: false,
    layerOpen: false,
    home: false,
  };

  it('goes Home from a mode when nothing is nearer to close', () => {
    expect(escapeGoesHome(base)).toBe(true);
  });

  it('leaves the other keys alone', () => {
    expect(escapeGoesHome({ ...base, key: 'Enter' })).toBe(false);
    expect(escapeGoesHome({ ...base, key: 'h' })).toBe(false);
  });

  it('lets Settings, Focus, the drawer, a menu or a text field have Esc first', () => {
    expect(escapeGoesHome({ ...base, layerOpen: true })).toBe(false);
    expect(escapeGoesHome({ ...base, overlayOpen: true })).toBe(false);
    expect(escapeGoesHome({ ...base, inField: true })).toBe(false);
    expect(escapeGoesHome({ ...base, defaultPrevented: true })).toBe(false);
    expect(escapeGoesHome({ ...base, modified: true })).toBe(false);
  });

  it('does nothing on Home itself', () => {
    expect(escapeGoesHome({ ...base, home: true })).toBe(false);
  });
});
