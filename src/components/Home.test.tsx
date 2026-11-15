import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Home } from './Home';
import { getProgressionById } from '../lib/music';

const explore = getProgressionById('blues-12')!;

/** Every element in a tree, so a test can find a button and press it. */
function elements(node: ReactNode, found: ReactElement<Record<string, unknown>>[] = []) {
  if (Array.isArray(node)) node.forEach((child) => elements(child, found));
  else if (isValidElement<Record<string, unknown>>(node)) {
    found.push(node);
    elements(node.props.children as ReactNode, found);
  }
  return found;
}

const setup = () => {
  const onContinue = vi.fn();
  const onChoose = vi.fn();
  const props = { lastMode: 'scales' as const, explore, onContinue, onChoose };
  return { props, onContinue, onChoose, tree: elements(Home(props)) };
};

describe('Home', () => {
  it('shows the wordmark, Continue with the last mode, and three choices', () => {
    const { props } = setup();
    const html = renderToStaticMarkup(<Home {...props} />);
    expect(html).toContain('aria-label="vibrato"');
    expect(html).toContain('Continue · Scales');
    for (const title of ['Practice', 'Explore', 'Learn']) expect(html).toContain(`>${title}<`);
    expect(html.match(/data-choice=/g)).toHaveLength(3);
  });

  it('shows the progression Explore will open, by name and numerals', () => {
    const { props } = setup();
    const html = renderToStaticMarkup(<Home {...props} />);
    expect(html).toContain('12-bar blues');
    expect(html).toContain('I7 – IV7 – V7');
  });

  it('has no panel of its own: only the choices carry edges', () => {
    const { props } = setup();
    const html = renderToStaticMarkup(<Home {...props} />);
    expect(html).toContain('data-region="home"');
    expect(html).not.toContain('panel');
  });

  it('presses Continue to go back to the last mode', () => {
    const { tree, onContinue, onChoose } = setup();
    const button = tree.find((el) => el.type === 'button' && el.props.autoFocus === true);
    expect(button).toBeDefined(); // Continue has the default focus
    (button!.props.onClick as () => void)();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('sends each choice to onChoose with its own id', () => {
    const { tree, onChoose } = setup();
    for (const id of ['practice', 'explore', 'learn']) {
      const button = tree.find((el) => el.props['data-choice'] === id);
      expect(button).toBeDefined();
      (button!.props.onClick as () => void)();
    }
    expect(onChoose.mock.calls.map(([id]) => id)).toEqual(['practice', 'explore', 'learn']);
  });
});
