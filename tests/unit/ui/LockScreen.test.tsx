// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { createLockConfig } from '@/privacy-screen/lock';
import { LockScreen } from '@/ui/lock/LockScreen';

afterEach(cleanup);

function submitForm(input: HTMLElement): void {
  const form = input.closest('form');
  expect(form).not.toBeNull();
  fireEvent.submit(form as HTMLFormElement);
}

describe('<LockScreen> (US5)', () => {
  it('renderiza o campo de senha quando trancado', async () => {
    const config = await createLockConfig('open-sesame');

    render(<LockScreen config={config} onUnlocked={() => {}} />);

    const input = screen.getByLabelText(/senha/i) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe('password');
    // Overlay presente cobrindo o conteúdo.
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('senha correta chama onUnlocked exatamente uma vez', async () => {
    const config = await createLockConfig('open-sesame');
    const onUnlocked = vi.fn();

    render(<LockScreen config={config} onUnlocked={onUnlocked} />);

    const input = screen.getByLabelText(/senha/i);
    fireEvent.change(input, { target: { value: 'open-sesame' } });
    submitForm(input);

    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
  });

  it('senha errada não chama onUnlocked e comunica o erro', async () => {
    const config = await createLockConfig('open-sesame');
    const onUnlocked = vi.fn();

    render(<LockScreen config={config} onUnlocked={onUnlocked} />);

    const input = screen.getByLabelText(/senha/i);
    fireEvent.change(input, { target: { value: 'wrong-pass' } });
    submitForm(input);

    // Estado de erro anunciado por role="alert" (texto + ícone).
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('alert').textContent).toMatch(/incorreta/i);
    expect(onUnlocked).not.toHaveBeenCalled();
  });
});
