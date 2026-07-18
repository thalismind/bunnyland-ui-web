import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';

import {
  Button,
  EmptyState,
  Field,
  Pane,
  SearchSelect,
  StatusText,
  TagEditor,
  ThemeSelect,
  Toolbar,
  ToolbarBrand,
  ToolbarRow,
} from '../src/preact';
import { currentTheme, registerThemeOption, setTheme } from '../src/theme';

afterEach(() => {
  cleanup();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
});

describe('shared Preact controls', () => {
  it('adds and removes tags without replacing the input', () => {
    let tags = ['forest'];
    const view = render(<TagEditor value={tags} onChange={next => { tags = next; view.rerender(<TagEditor value={tags} onChange={value => { tags = value; }} />); }} />);
    const input = screen.getByPlaceholderText('add tag...');

    fireEvent.input(input, { target: { value: 'ambient' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(tags).toEqual(['forest', 'ambient']);
    expect(screen.getByPlaceholderText('add tag...')).toBe(input);

    fireEvent.click(screen.getByRole('button', { name: 'Remove tag forest' }));
    expect(tags).toEqual(['ambient']);
  });

  it('filters and selects searchable options', () => {
    let selected = '';
    render(
      <SearchSelect
        options={[
          { value: 'room:1', label: 'Sunlit Meadow' },
          { value: 'room:2', label: 'Hidden Burrow' },
        ]}
        onChange={value => { selected = value; }}
      />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.input(input, { target: { value: 'hidden' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(selected).toBe('room:2');
    expect((input as HTMLInputElement).value).toBe('Hidden Burrow');
  });

  it('reflects a controlled searchable value change without replacing its input', () => {
    const options = [
      { value: 'room:1', label: 'Sunlit Meadow' },
      { value: 'room:2', label: 'Hidden Burrow' },
    ];
    const view = render(<SearchSelect value="room:1" options={options} onChange={() => {}} />);
    const input = screen.getByRole('combobox');

    view.rerender(<SearchSelect value="room:2" options={options} onChange={() => {}} />);

    expect(screen.getByRole('combobox')).toBe(input);
    expect((input as HTMLInputElement).value).toBe('Hidden Burrow');
  });

  it('keeps the hook selector and imperative theme API synchronized', () => {
    registerThemeOption({ value: 'test-night', label: 'Test Night' });
    render(<ThemeSelect aria-label="Theme" />);

    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'test-night' } });
    expect(currentTheme()).toBe('test-night');
    expect(document.documentElement.classList.contains('bl-theme-test-night')).toBe(true);

    act(() => { setTheme('anime-light'); });
    expect((screen.getByLabelText('Theme') as HTMLSelectElement).value).toBe('anime-light');
  });

  it('composes semantic chrome without changing caller classes', () => {
    const view = render(
      <Toolbar class="application-toolbar">
        <ToolbarRow>
          <ToolbarBrand>Editor</ToolbarBrand>
          <StatusText tone="warn">Unsaved</StatusText>
        </ToolbarRow>
        <Pane title="Entity">
          <Field label="Name"><input aria-label="Name" /></Field>
          <Button variant="primary">Save</Button>
          <EmptyState>Nothing selected.</EmptyState>
        </Pane>
      </Toolbar>,
    );

    const toolbar = view.container.querySelector('.application-toolbar');
    expect(toolbar).not.toBeNull();
    expect([...(toolbar?.classList || [])]).toEqual(expect.arrayContaining(['bl-toolbar', 'application-toolbar']));
    expect(screen.getByRole('button', { name: 'Save' }).classList.contains('bl-button-primary')).toBe(true);
    expect(screen.getByText('Unsaved').classList.contains('bl-status-warn')).toBe(true);
    expect(screen.getByText('Nothing selected.').classList.contains('empty')).toBe(true);
  });
});
