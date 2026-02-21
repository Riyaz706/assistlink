/**
 * @vitest-environment jsdom
 * Component test: Login form behavior (validation, submit, error display).
 * Uses a minimal form that mirrors LoginScreen validation and submit flow.
 * Purpose: Ensure real user behavior (input -> validate -> submit -> error/success).
 * Run: pnpm test src/__tests__/LoginForm.test.tsx
 * Failure: Form validation or submit flow regression.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { validateEmail, validatePassword } from '../utils/validation';

// Minimal login form component for testing (mirrors LoginScreen logic)
function LoginForm({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.message!);
      return;
    }
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.message!);
      return;
    }
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
    } catch (e: any) {
      setError(e?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <input data-testid="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input data-testid="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
      {error && <p data-testid="error">{error}</p>}
      <button type="submit" data-testid="submit" disabled={loading}>{loading ? 'Logging in...' : 'Log In'}</button>
    </form>
  );
}

describe('LoginForm (component)', () => {
  it('renders email and password inputs and submit button', () => {
    render(<LoginForm onLogin={async () => {}} />);
    expect(screen.getByTestId('email')).toBeInTheDocument();
    expect(screen.getByTestId('password')).toBeInTheDocument();
    expect(screen.getByTestId('submit')).toHaveTextContent('Log In');
  });

  it('shows validation error when email is empty on submit', async () => {
    render(<LoginForm onLogin={async () => {}} />);
    fireEvent.change(screen.getByTestId('password'), { target: { value: 'Pass1234' } });
    fireEvent.click(screen.getByTestId('submit'));
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Email is required');
    });
  });

  it('shows validation error when password is too short', async () => {
    render(<LoginForm onLogin={async () => {}} />);
    fireEvent.change(screen.getByTestId('email'), { target: { value: 'u@example.com' } });
    fireEvent.change(screen.getByTestId('password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByTestId('submit'));
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('at least 8 characters');
    });
  });

  it('shows validation error for invalid email format', async () => {
    render(<LoginForm onLogin={async () => {}} />);
    fireEvent.change(screen.getByTestId('email'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByTestId('password'), { target: { value: 'Pass1234' } });
    fireEvent.click(screen.getByTestId('submit'));
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('valid email');
    });
  });

  it('calls onLogin with trimmed email and password when valid', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onLogin={onLogin} />);
    fireEvent.change(screen.getByTestId('email'), { target: { value: '  user@example.com  ' } });
    fireEvent.change(screen.getByTestId('password'), { target: { value: 'Pass1234' } });
    fireEvent.click(screen.getByTestId('submit'));
    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith('user@example.com', 'Pass1234');
    });
  });

  it('shows error when onLogin throws', async () => {
    render(<LoginForm onLogin={async () => { throw new Error('Invalid credentials'); }} />);
    fireEvent.change(screen.getByTestId('email'), { target: { value: 'u@example.com' } });
    fireEvent.change(screen.getByTestId('password'), { target: { value: 'Pass1234' } });
    fireEvent.click(screen.getByTestId('submit'));
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
    });
  });
});
