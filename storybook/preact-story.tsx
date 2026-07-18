import { render, type JSX } from 'preact';
import { useState } from 'preact/hooks';

import {
  Button,
  EmptyState,
  Field,
  Pane,
  Pill,
  SearchSelect,
  StatusText,
  TagEditor,
  ThemeSelect,
  Toolbar,
  ToolbarBrand,
  ToolbarRow,
} from '../src/preact';

const rooms = [
  { value: 'room:1', label: 'Sunlit Meadow' },
  { value: 'room:2', label: 'Warren Entrance' },
  { value: 'room:3', label: 'Hidden Burrow' },
];

function PreactFoundationStory(): JSX.Element {
  const [room, setRoom] = useState('room:1');
  const [tags, setTags] = useState(['forest', 'ambient']);

  return (
    <div class="sb-preact-stack">
      <Toolbar aria-label="Example application toolbar">
        <ToolbarRow>
          <ToolbarBrand>World tools</ToolbarBrand>
          <StatusText tone="ok">● connected</StatusText>
          <label class="push" for="preact-theme">Theme</label>
          <ThemeSelect id="preact-theme" aria-label="Preact theme selector" />
        </ToolbarRow>
      </Toolbar>

      <div class="sb-preact-grid">
        <Pane
          title="Shared controls"
          tools={<StatusText tone="info">Preact + hooks</StatusText>}
        >
          <div class="control-stack">
            <Field label="Room" description="Search by label or stable entity ID.">
              <SearchSelect
                value={room}
                options={rooms}
                onChange={value => setRoom(value)}
                placeholder="Find a room…"
              />
            </Field>
            <Field label="Tags" description="Committed values stay in the parent; the draft stays local.">
              <TagEditor value={tags} onChange={setTags} />
            </Field>
          </div>
        </Pane>

        <Pane title="Semantic states">
          <div class="control-stack">
            <div class="pill-row">
              <Pill>🏠 {room || 'no room'}</Pill>
              {tags.map(tag => <Pill key={tag}>{tag}</Pill>)}
            </div>
            <div class="button-row">
              <Button variant="primary">Save</Button>
              <Button variant="secondary">Preview</Button>
              <Button variant="danger">Delete</Button>
              <Button variant="quiet">Cancel</Button>
            </div>
            <div class="field-row">
              <StatusText tone="muted">idle</StatusText>
              <StatusText tone="ok">saved</StatusText>
              <StatusText tone="warn">unsaved</StatusText>
              <StatusText tone="error">failed</StatusText>
            </div>
            <EmptyState>No additional components.</EmptyState>
          </div>
        </Pane>
      </div>
    </div>
  );
}

const host = document.getElementById('sb-preact-foundation');
if (!host) throw new Error('Preact foundation story mount is missing');
render(<PreactFoundationStory />, host);
(window as Window & { __preactStoryReady?: boolean }).__preactStoryReady = true;
