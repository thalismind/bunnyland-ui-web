import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useId, useMemo, useState } from 'preact/hooks';

export type Tone = 'error' | 'info' | 'muted' | 'ok' | 'warn';
export type ButtonVariant = 'danger' | 'primary' | 'quiet' | 'secondary';

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ class: className, variant, type = 'button', ...props }: ButtonProps): JSX.Element {
  return <button {...props} type={type} class={classNames(className as string, variant && `bl-button-${variant}`)} />;
}

export interface StatusTextProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  children: ComponentChildren;
  tone?: Tone;
}

export function StatusText({ children, class: className, tone = 'muted', ...props }: StatusTextProps): JSX.Element {
  return <span {...props} class={classNames(className as string, 'bl-status', `bl-status-${tone}`)}>{children}</span>;
}

export function Toolbar({ children, class: className, ...props }: JSX.HTMLAttributes<HTMLElement>): JSX.Element {
  return <header {...props} class={classNames(className as string, 'bl-toolbar')}>{children}</header>;
}

export function ToolbarRow({ children, class: className, ...props }: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div {...props} class={classNames(className as string, 'toolbar-row')}>{children}</div>;
}

export interface ToolbarBrandProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  icon?: ComponentChildren;
}

export function ToolbarBrand({ children, class: className, icon = '🐰', ...props }: ToolbarBrandProps): JSX.Element {
  return <span {...props} class={classNames(className as string, 'toolbar-brand')}>{icon}{children}</span>;
}

export interface PaneProps extends Omit<JSX.HTMLAttributes<HTMLElement>, 'title'> {
  children: ComponentChildren;
  title?: ComponentChildren;
  tools?: ComponentChildren;
}

export function Pane({ children, class: className, title, tools, ...props }: PaneProps): JSX.Element {
  return (
    <section {...props} class={classNames(className as string, 'pane')}>
      {(title || tools) && (
        <header class="pane-header">
          {title && <span class="pane-title">{title}</span>}
          {tools && <span class="pane-tools">{tools}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

export interface FieldProps extends JSX.HTMLAttributes<HTMLLabelElement> {
  children: ComponentChildren;
  description?: ComponentChildren;
  label: ComponentChildren;
  wide?: boolean;
}

export function Field({ children, class: className, description, label, wide, ...props }: FieldProps): JSX.Element {
  return (
    <label {...props} class={classNames(className as string, 'field', wide && 'wide')}>
      <span class="field-label">{label}</span>
      {children}
      {description && <span class="hint">{description}</span>}
    </label>
  );
}

export function Pill({ children, class: className, ...props }: JSX.HTMLAttributes<HTMLSpanElement>): JSX.Element {
  return <span {...props} class={classNames(className as string, 'pill')}>{children}</span>;
}

export function EmptyState({ children, class: className, ...props }: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div {...props} class={classNames(className as string, 'empty')}>{children}</div>;
}

export interface SearchOption {
  label: string;
  value: string;
}

export interface SearchSelectProps {
  disabled?: boolean;
  emptyLabel?: string;
  id?: string;
  label?: string;
  onChange: (value: string, option: SearchOption | null) => void;
  options: SearchOption[];
  placeholder?: string;
  value?: string;
}

export function SearchSelect({
  disabled = false,
  emptyLabel = 'No matches',
  id,
  label,
  onChange,
  options,
  placeholder = 'search...',
  value = '',
}: SearchSelectProps): JSX.Element {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listboxId = `${inputId}-listbox`;
  const selected = options.find(option => option.value === value) || null;
  const [query, setQuery] = useState(selected?.label || '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(option => option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle));
  }, [options, query]);
  const selectedLabel = selected?.label || '';
  useEffect(() => setQuery(selectedLabel), [selectedLabel, value]);
  const choose = (option: SearchOption): void => {
    setQuery(option.label);
    setOpen(false);
    onChange(option.value, option);
  };

  return (
    <span class="search-dropdown">
      {label && <label for={inputId}>{label}</label>}
      <input
        id={inputId}
        class="search-dropdown-input"
        type="text"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        onFocus={(): void => setOpen(true)}
        onBlur={(): void => setOpen(false)}
        onInput={(event): void => {
          setQuery(event.currentTarget.value);
          setActive(0);
          setOpen(true);
          if (!event.currentTarget.value) onChange('', null);
        }}
        onKeyDown={(event): void => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive(index => Math.min(index + 1, filtered.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(index => Math.max(index - 1, 0));
          } else if (event.key === 'Enter' && filtered[active]) {
            event.preventDefault();
            choose(filtered[active]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && (
        <div id={listboxId} class="search-dropdown-menu" role="listbox">
          {filtered.length ? filtered.map((option, index) => (
            <button
              key={option.value}
              type="button"
              class={classNames('search-dropdown-option', index === active && 'active')}
              role="option"
              aria-selected={option.value === value}
              onMouseDown={(event): void => event.preventDefault()}
              onClick={(): void => choose(option)}
            >
              {option.label}
            </button>
          )) : <div class="search-dropdown-empty">{emptyLabel}</div>}
        </div>
      )}
    </span>
  );
}

export interface TagEditorProps {
  addLabel?: string;
  disabled?: boolean;
  emptyLabel?: string;
  onChange: (tags: string[]) => void;
  placeholder?: string;
  value: string[];
}

export function TagEditor({
  addLabel = 'Add Tag',
  disabled = false,
  emptyLabel = 'No tags.',
  onChange,
  placeholder = 'add tag...',
  value,
}: TagEditorProps): JSX.Element {
  const [draft, setDraft] = useState('');
  const add = (): void => {
    const tag = draft.trim();
    if (!tag) return;
    if (!value.includes(tag)) onChange([...value, tag]);
    setDraft('');
  };
  return (
    <div class="tag-editor">
      <div class="tag-list">
        {value.length ? value.map(tag => (
          <span class="tag-pill" key={tag}>
            <span>{tag}</span>
            <Button
              disabled={disabled}
              aria-label={`Remove tag ${tag}`}
              onClick={(): void => onChange(value.filter(item => item !== tag))}
            >x</Button>
          </span>
        )) : <span class="tiny">{emptyLabel}</span>}
      </div>
      <div class="tag-entry">
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          onInput={(event): void => setDraft(event.currentTarget.value)}
          onKeyDown={(event): void => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            add();
          }}
        />
        <Button disabled={disabled} onClick={add}>{addLabel}</Button>
      </div>
    </div>
  );
}
