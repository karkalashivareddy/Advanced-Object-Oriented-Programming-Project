import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ register: vi.fn() }),
}));

import { RegisterPage } from './RegisterPage';

function renderRegister() {
  return render(<MemoryRouter><RegisterPage /></MemoryRouter>);
}

function inputForLabel(labelText: string): HTMLInputElement {
  const label = Array.from(document.querySelectorAll('label'))
    .find((candidate) => candidate.textContent?.trim().startsWith(labelText));
  expect(label).toBeTruthy();
  expect(label?.htmlFor).not.toBe('');
  const input = document.getElementById(label!.htmlFor);
  expect(input?.tagName).toBe('INPUT');
  return input as HTMLInputElement;
}

describe('RegisterPage accessible fields', () => {
  it('associates every registration label with its actual input', () => {
    renderRegister();

    for (const labelText of ['Full name', 'Email address', 'Phone', 'Password', 'Confirm password']) {
      const control = inputForLabel(labelText);
      expect(control.id).not.toBe('');
      expect(document.querySelectorAll(`label[for="${CSS.escape(control.id)}"]`)).toHaveLength(1);
    }
  });

  it('describes password inputs with their hints and errors and toggles them by keyboard', async () => {
    const user = userEvent.setup();
    renderRegister();

    const password = inputForLabel('Password');
    const confirmation = inputForLabel('Confirm password');
    expect(screen.getByLabelText(/^Password\s*\*?$/i)).toBe(password);
    expect(screen.getByLabelText(/^Confirm password\s*\*?$/i)).toBe(confirmation);
    const passwordHintId = password.getAttribute('aria-describedby')?.split(' ')[0];
    expect(passwordHintId).toBeTruthy();
    expect(document.getElementById(passwordHintId!)).toHaveTextContent('10');

    fireEvent.change(confirmation, { target: { value: 'different' } });
    fireEvent.blur(password);
    fireEvent.blur(confirmation);
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(confirmation).toHaveAttribute('aria-invalid', 'true');
    for (const control of [password, confirmation]) {
      const describedBy = control.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
      expect(describedBy.length).toBeGreaterThan(0);
      describedBy.forEach((id) => expect(document.getElementById(id)).not.toBeNull());
    }

    const reveal = screen.getByRole('button', { name: 'Show password' });
    reveal.focus();
    await user.keyboard(' ');
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveFocus();
  });
});
